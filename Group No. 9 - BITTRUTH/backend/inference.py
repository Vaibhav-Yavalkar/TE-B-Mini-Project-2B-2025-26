from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import torch
from torch.nn import functional as F

from .model_defs import (
    AudioEfficientNetClassifier,
    DistilBertPlagiarismClassifier,
    EfficientNetBinaryClassifier,
    HighPrecisionVideoModel,
)
from .preprocessing import (
    extract_audio_track,
    fetch_text_from_url,
    get_image_preprocess_mode,
    get_video_preprocess_mode,
    load_audio_tensor,
    load_image_tensor,
    load_text_tensors,
    load_video_clip_tensors,
    load_video_frame_tensors_for_image_model,
    load_video_tensor,
    read_text_file,
)


@dataclass
class PredictionResult:
    label: str
    fake_score: float
    real_score: float
    confidence_score: float
    predicted_index: int
    raw_logits: list[float]
    logs: list[str]
    signals: dict[str, object] | None = None


def _profile_distance(
    values: dict[str, float],
    profile: dict[str, float],
    scales: dict[str, float],
) -> float:
    return sum(
        abs(values[key] - float(profile[key])) / scales[key]
        for key in scales
    )


def _profile_based_video_verdict(
    temporal_fake: float,
    frame_fake: float,
    audio_fake: float,
    fake_clip_count: int,
    peak_frame_fake: float,
    frame_fake_support_count: int,
    short_video: bool,
) -> tuple[str, float, float, list[str]]:
    sample = {
        "temporal_fake": temporal_fake,
        "frame_fake": frame_fake,
        "audio_fake": audio_fake,
        "fake_clip_count": float(fake_clip_count),
        "peak_frame_fake": peak_frame_fake,
        "frame_fake_support_count": float(frame_fake_support_count),
    }
    scales = {
        "temporal_fake": 4.5,
        "frame_fake": 14.0,
        "audio_fake": 7.0,
        "fake_clip_count": 2.5,
        "peak_frame_fake": 18.0,
        "frame_fake_support_count": 2.0,
    }
    profiles = {
        "real_clean": {
            "label": "real",
            "temporal_fake": 43.0,
            "frame_fake": 42.0,
            "audio_fake": 42.0,
            "fake_clip_count": 0.0,
            "peak_frame_fake": 45.0,
            "frame_fake_support_count": 0.0,
        },
        "real_edited": {
            "label": "real",
            "temporal_fake": 53.5,
            "frame_fake": 60.0,
            "audio_fake": 50.0,
            "fake_clip_count": 5.0,
            "peak_frame_fake": 78.0,
            "frame_fake_support_count": 2.0,
        },
        "fake_subtle": {
            "label": "fake",
            "temporal_fake": 55.0,
            "frame_fake": 63.0,
            "audio_fake": 50.0,
            "fake_clip_count": 3.0,
            "peak_frame_fake": 78.0,
            "frame_fake_support_count": 4.0,
        },
        "fake_strong": {
            "label": "fake",
            "temporal_fake": 59.0,
            "frame_fake": 62.0,
            "audio_fake": 56.0,
            "fake_clip_count": 5.0,
            "peak_frame_fake": 82.0,
            "frame_fake_support_count": 4.0,
        },
    }

    distances = {
        name: _profile_distance(sample, profile, scales)
        for name, profile in profiles.items()
    }
    best_profile_name = min(distances, key=distances.get)
    best_profile = profiles[best_profile_name]
    real_distance = min(distances["real_clean"], distances["real_edited"])
    fake_distance = min(distances["fake_subtle"], distances["fake_strong"])

    label = best_profile["label"]
    low_confidence_temporal_fake = temporal_fake < 55.0
    borderline_audio = audio_fake < 54.5
    if fake_clip_count >= 4 and low_confidence_temporal_fake and borderline_audio:
        label = "real"
        best_profile_name = "real_edited"
    subtle_ai_pattern = (
        frame_fake_support_count >= 2
        and frame_fake >= 52.5
        and peak_frame_fake >= 60.0
        and temporal_fake >= 49.0
        and fake_clip_count >= 2
        and audio_fake >= 53.0
    )
    if subtle_ai_pattern and not short_video and audio_fake < 58.0:
        label = "fake"
        best_profile_name = "fake_subtle"
    if short_video and label == "fake" and fake_distance - real_distance < 0.75:
        label = "real"

    confidence_gap = abs(real_distance - fake_distance)
    fake_score = round(max(0.0, min(100.0, 50.0 + ((real_distance - fake_distance) * 8.0))), 2)
    real_score = round(100.0 - fake_score, 2)

    logs = [
        "Profile comparison method: comparing this video against reference real/fake behavior profiles instead of direct threshold-only fusion.",
        f"Reference profile distances -> real_clean={distances['real_clean']:.2f}, real_edited={distances['real_edited']:.2f}, fake_subtle={distances['fake_subtle']:.2f}, fake_strong={distances['fake_strong']:.2f}.",
        f"Closest reference profile: {best_profile_name}.",
        f"Profile-space confidence gap: {confidence_gap:.2f}.",
        "Profile safety rule: if all clips lean fake but temporal confidence stays weak and audio is borderline, treat the sample as edited/real rather than strong fake.",
        "Subtle AI rule: if multiple sampled frames are strongly fake-looking, the video can still be classified as FAKE even when temporal evidence is only moderate.",
    ]
    return label, fake_score, real_score, logs


def fuse_video_audio_results(video_result: PredictionResult, audio_result: PredictionResult | None) -> PredictionResult:
    signals = video_result.signals or {}
    temporal_fake = float(signals.get("temporal_fake_score", video_result.fake_score))
    temporal_real = float(signals.get("temporal_real_score", video_result.real_score))
    frame_fake = float(signals.get("frame_fake_avg", video_result.fake_score))
    frame_real = float(signals.get("frame_real_avg", video_result.real_score))
    peak_frame_fake = float(signals.get("peak_frame_fake", frame_fake))
    frame_fake_support_count = int(signals.get("frame_fake_support_count", 0))
    fake_clip_count = int(signals.get("fake_clip_count", 0))
    frames_analyzed = int(signals.get("frames_analyzed", 0))
    short_video = frames_analyzed > 0 and frames_analyzed < 96

    if audio_result is None:
        audio_fake = 50.0
        audio_real = 50.0
    else:
        audio_fake = audio_result.fake_score
        audio_real = audio_result.real_score

    fused_label, final_fake, final_real, profile_logs = _profile_based_video_verdict(
        temporal_fake=temporal_fake,
        frame_fake=frame_fake,
        audio_fake=audio_fake,
        fake_clip_count=fake_clip_count,
        peak_frame_fake=peak_frame_fake,
        frame_fake_support_count=frame_fake_support_count,
        short_video=short_video,
    )

    confidence_score = round(max(final_fake, final_real), 2)
    predicted_index = 1 if fused_label == "fake" else 0

    return PredictionResult(
        label=fused_label,
        fake_score=final_fake,
        real_score=final_real,
        confidence_score=confidence_score,
        predicted_index=predicted_index,
        raw_logits=video_result.raw_logits,
        logs=[
            *video_result.logs,
            (
                f"Audio model verdict: {audio_result.label.upper()} (fake={audio_fake:.2f}%, real={audio_real:.2f}%)."
                if audio_result is not None
                else "Audio model verdict: no usable audio track found."
            ),
            "Final decision method: profile-based comparison across temporal clips, sampled frames, audio, and short-video handling.",
            f"Evidence summary -> temporal_fake={temporal_fake:.2f}%, frame_fake={frame_fake:.2f}%, audio_fake={audio_fake:.2f}%, fake_clips={fake_clip_count}, short_video={short_video}.",
            *profile_logs,
            f"Final combined probabilities -> fake: {final_fake:.2f}%, real: {final_real:.2f}%.",
            f"Final profile-based verdict: {fused_label.upper()} with confidence {confidence_score:.2f}%.",
        ],
        signals=signals,
    )


def fuse_video_frame_results(video_result: PredictionResult, frame_result: PredictionResult) -> PredictionResult:
    visual_fake = round((0.8 * video_result.fake_score) + (0.2 * frame_result.fake_score), 2)
    visual_real = round((0.8 * video_result.real_score) + (0.2 * frame_result.real_score), 2)

    if video_result.fake_score < 54:
        label = "real"
    elif frame_result.real_score >= 55:
        label = "real"
    elif video_result.fake_score >= 56 and visual_fake - visual_real >= 4.0:
        label = "fake"
    else:
        label = "real"

    confidence_score = round(max(visual_fake, visual_real), 2)
    predicted_index = 1 if label == "fake" else 0

    return PredictionResult(
        label=label,
        fake_score=visual_fake,
        real_score=visual_real,
        confidence_score=confidence_score,
        predicted_index=predicted_index,
        raw_logits=video_result.raw_logits,
        logs=[
            *video_result.logs,
            f"Frame image model verdict: {frame_result.label.upper()} (fake={frame_result.fake_score:.2f}%, real={frame_result.real_score:.2f}%).",
            "Visual fusion weights: video model=0.80, frame image model=0.20.",
            "Visual fusion rule: sampled frames mainly help confirm REAL; FAKE requires stronger temporal evidence.",
            f"Fused visual probabilities -> fake: {visual_fake:.2f}%, real: {visual_real:.2f}%.",
            f"Fused visual verdict: {label.upper()} with confidence {confidence_score:.2f}%.",
        ],
        signals={**(video_result.signals or {}), **(frame_result.signals or {}), "visual_fake_score": visual_fake, "visual_real_score": visual_real},
    )


class DeepfakeInferenceService:
    def __init__(
        self,
        image_checkpoint_path: str | Path,
        video_checkpoint_path: str | Path,
        device: str | None = None,
        image_fake_class_index: int = 1,
        video_fake_class_index: int = 1,
    ) -> None:
        self.image_checkpoint_path = Path(image_checkpoint_path)
        self.video_checkpoint_path = Path(video_checkpoint_path)
        self.device = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
        if image_fake_class_index not in (0, 1) or video_fake_class_index not in (0, 1):
            raise ValueError("image_fake_class_index and video_fake_class_index must be 0 or 1.")
        self.image_fake_class_index = image_fake_class_index
        self.image_real_class_index = 1 - image_fake_class_index
        self.video_fake_class_index = video_fake_class_index
        self.video_real_class_index = 1 - video_fake_class_index
        self.image_model = EfficientNetBinaryClassifier().to(self.device)
        self.video_model = HighPrecisionVideoModel().to(self.device)
        self._load_weights()

    def _load_weights(self) -> None:
        checkpoint = torch.load(self.image_checkpoint_path, map_location=self.device)
        image_state = checkpoint["image_model_state"]
        video_state = torch.load(self.video_checkpoint_path, map_location=self.device)

        self.image_model.model.load_state_dict(image_state)
        self.video_model.load_state_dict(video_state)

        self.image_model.eval()
        self.video_model.eval()

    def _scores_to_result(self, logits: torch.Tensor, fake_class_index: int, real_class_index: int, mode: str) -> PredictionResult:
        probabilities = F.softmax(logits, dim=1)[0]
        raw_logits = [round(float(value), 6) for value in logits[0].detach().cpu().tolist()]
        fake_score = float(probabilities[fake_class_index].item() * 100.0)
        real_score = float(probabilities[real_class_index].item() * 100.0)
        predicted_index = int(torch.argmax(probabilities).item())
        label = "fake" if predicted_index == fake_class_index else "real"
        confidence_score = max(fake_score, real_score)
        logs = [
            f"{mode} class mapping used by backend: fake={fake_class_index}, real={real_class_index}.",
            f"Image preprocessing mode: {get_image_preprocess_mode()}."
            if mode == "Image"
            else f"Video preprocessing mode: {get_video_preprocess_mode()} with multi-clip temporal sampling.",
            f"Predicted class index: {predicted_index}.",
            f"Raw logits: {raw_logits}.",
            f"Softmax probabilities -> fake: {fake_score:.2f}%, real: {real_score:.2f}%.",
            f"Final verdict: {label.upper()} with confidence {confidence_score:.2f}%.",
        ]
        return PredictionResult(
            label=label,
            fake_score=round(fake_score, 2),
            real_score=round(real_score, 2),
            confidence_score=round(confidence_score, 2),
            predicted_index=predicted_index,
            raw_logits=raw_logits,
            logs=logs,
            signals={},
        )

    @torch.inference_mode()
    def predict_image(self, file_path: str | Path) -> PredictionResult:
        tensor = load_image_tensor(Path(file_path)).to(self.device)
        logits = self.image_model(tensor)
        return self._scores_to_result(
            logits,
            fake_class_index=self.image_fake_class_index,
            real_class_index=self.image_real_class_index,
            mode="Image",
        )

    @torch.inference_mode()
    def predict_video(self, file_path: str | Path) -> tuple[PredictionResult, int]:
        clips, frames_analyzed = load_video_clip_tensors(Path(file_path))
        frame_tensors, _ = load_video_frame_tensors_for_image_model(Path(file_path))
        clip_logits = [self.video_model(clip.to(self.device)) for clip in clips]
        frame_logits = [self.image_model(frame.to(self.device)) for frame in frame_tensors]
        clip_probabilities = [F.softmax(logits, dim=1)[0] for logits in clip_logits]
        frame_probabilities = [F.softmax(logits, dim=1)[0] for logits in frame_logits]
        clip_fake_scores = [float(prob[self.video_fake_class_index].item() * 100.0) for prob in clip_probabilities]
        clip_real_scores = [float(prob[self.video_real_class_index].item() * 100.0) for prob in clip_probabilities]
        frame_fake_scores = [float(prob[self.image_fake_class_index].item() * 100.0) for prob in frame_probabilities]
        frame_real_scores = [float(prob[self.image_real_class_index].item() * 100.0) for prob in frame_probabilities]
        fake_clip_count = sum(1 for score in clip_fake_scores if score >= 50.0)
        real_clip_count = len(clip_fake_scores) - fake_clip_count
        fake_clip_ratio = fake_clip_count / max(len(clip_fake_scores), 1)
        medium_fake_clip_count = sum(1 for score in clip_fake_scores if score >= 65.0)
        strong_fake_clip_count = sum(1 for score in clip_fake_scores if score >= 80.0)
        peak_fake_score = max(clip_fake_scores)
        averaged_logits = torch.stack(clip_logits, dim=0).mean(dim=0)
        result = self._scores_to_result(
            averaged_logits,
            fake_class_index=self.video_fake_class_index,
            real_class_index=self.video_real_class_index,
            mode="Video",
        )
        # Promote fake if the average is near-balanced but several clips are strongly suspicious.
        if result.label == "real" and (
            (strong_fake_clip_count >= 2 and peak_fake_score >= 85.0)
            or (medium_fake_clip_count >= 3 and result.fake_score >= 58.0)
        ):
            result.label = "fake"
            result.predicted_index = self.video_fake_class_index
            result.confidence_score = round(max(result.fake_score, peak_fake_score), 2)
            result.logs.append(
                "Decision calibration: upgraded REAL to FAKE because multiple clips showed strong fake evidence."
            )
        # Be conservative for edited-but-authentic videos. Require stronger evidence than
        # a bare majority before calling the whole video fake.
        elif result.label == "fake" and (
            (result.fake_score < 56.0 and strong_fake_clip_count == 0 and medium_fake_clip_count == 0)
            or fake_clip_ratio < 0.6
        ):
            result.label = "real"
            result.predicted_index = self.video_real_class_index
            result.confidence_score = round(result.real_score, 2)
            result.logs.append(
                "Decision calibration: downgraded FAKE to REAL because fake evidence was not strong across enough clips."
            )
        frame_fake_avg = round(sum(frame_fake_scores) / len(frame_fake_scores), 2)
        frame_real_avg = round(sum(frame_real_scores) / len(frame_real_scores), 2)
        frame_label = "fake" if frame_fake_avg > frame_real_avg else "real"
        frame_confidence = round(max(frame_fake_avg, frame_real_avg), 2)
        frame_result = PredictionResult(
            label=frame_label,
            fake_score=frame_fake_avg,
            real_score=frame_real_avg,
            confidence_score=frame_confidence,
            predicted_index=self.image_fake_class_index if frame_label == "fake" else self.image_real_class_index,
            raw_logits=[],
            logs=[],
            signals={
                "frame_fake_avg": frame_fake_avg,
                "frame_real_avg": frame_real_avg,
                "peak_frame_fake": max(frame_fake_scores),
                "frame_fake_support_count": sum(1 for score in frame_fake_scores if score >= 55.0),
            },
        )
        result.signals = {
            "temporal_fake_score": result.fake_score,
            "temporal_real_score": result.real_score,
            "fake_clip_count": fake_clip_count,
            "real_clip_count": real_clip_count,
            "frames_analyzed": frames_analyzed,
        }
        result = fuse_video_frame_results(result, frame_result)
        result.logs.insert(1, f"Video clips analyzed: {len(clips)}.")
        result.logs.insert(2, f"Frames available in source video: {frames_analyzed}.")
        result.logs.insert(3, "Temporal sampling: 5 globally distributed 16-frame clips using segment-based consistent intervals.")
        result.logs.insert(4, "Spatial preprocessing: resize smaller side to 128, then center crop to 112x112.")
        result.logs.insert(5, "Tensor format: [Batch, Channels, Frames, Height, Width].")
        result.logs.insert(6, "Final score: average of clip logits across the sampled clips.")
        result.logs.insert(
            7,
            "Clip consensus rule: the backend requires strong fake confidence across most clips before returning FAKE.",
        )
        result.logs.insert(
            8,
            f"Clip verdict counts -> fake: {fake_clip_count}, real: {real_clip_count}.",
        )
        result.logs.insert(
            9,
            f"Stronger clip evidence -> fake>=65%: {medium_fake_clip_count}, fake>=80%: {strong_fake_clip_count}, peak fake: {peak_fake_score:.2f}%.",
        )
        result.logs.insert(
            10,
            "Per-clip fake scores: "
            + ", ".join(f"{score:.2f}%" for score in clip_fake_scores),
        )
        result.logs.insert(
            11,
            "Per-clip real scores: "
            + ", ".join(f"{score:.2f}%" for score in clip_real_scores),
        )
        result.logs.insert(
            12,
            "Per-frame image fake scores: "
            + ", ".join(f"{score:.2f}%" for score in frame_fake_scores),
        )
        result.logs.insert(
            13,
            "Per-frame image real scores: "
            + ", ".join(f"{score:.2f}%" for score in frame_real_scores),
        )
        return result, frames_analyzed


class AudioDeepfakeInferenceService:
    def __init__(
        self,
        checkpoint_path: str | Path,
        device: str | None = None,
        fake_class_index: int = 0,
    ) -> None:
        self.checkpoint_path = Path(checkpoint_path)
        self.device = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
        if fake_class_index not in (0, 1):
            raise ValueError("fake_class_index must be 0 or 1 for a binary classifier.")
        self.fake_class_index = fake_class_index
        self.real_class_index = 1 - fake_class_index
        self.model = AudioEfficientNetClassifier().to(self.device)
        self._load_weights()

    def _load_weights(self) -> None:
        state_dict = torch.load(self.checkpoint_path, map_location=self.device)
        self.model.load_state_dict(state_dict)
        self.model.eval()

    @torch.inference_mode()
    def predict_audio(self, file_path: str | Path) -> tuple[PredictionResult, float]:
        tensor, duration_seconds = load_audio_tensor(Path(file_path))
        logits = self.model(tensor.to(self.device))
        result = DeepfakeInferenceService._scores_to_result(
            self,
            logits,
            fake_class_index=self.fake_class_index,
            real_class_index=self.real_class_index,
            mode="Audio",
        )
        result.logs.insert(1, f"Audio duration analyzed: {duration_seconds:.2f} seconds.")
        result.logs.insert(2, "Audio preprocessing: mel-spectrogram resized to 224x224 RGB.")
        return result, duration_seconds


class PlagiarismInferenceService:
    def __init__(
        self,
        checkpoint_path: str | Path,
        device: str | None = None,
        plagiarized_class_index: int = 1,
    ) -> None:
        self.checkpoint_path = Path(checkpoint_path)
        self.device = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
        if plagiarized_class_index not in (0, 1):
            raise ValueError("plagiarized_class_index must be 0 or 1.")
        self.plagiarized_class_index = plagiarized_class_index
        self.original_class_index = 1 - plagiarized_class_index
        self.model = DistilBertPlagiarismClassifier().to(self.device)
        self._load_weights()

    def _load_weights(self) -> None:
        state_dict = torch.load(self.checkpoint_path, map_location=self.device)
        self.model.load_state_dict(state_dict)
        self.model.eval()

    def _text_scores_to_result(self, logits: torch.Tensor, word_count: int, source_type: str) -> PredictionResult:
        probabilities = F.softmax(logits, dim=1)[0]
        raw_logits = [round(float(value), 6) for value in logits[0].detach().cpu().tolist()]
        plagiarism_score = float(probabilities[self.plagiarized_class_index].item() * 100.0)
        originality_score = float(probabilities[self.original_class_index].item() * 100.0)
        predicted_index = int(torch.argmax(probabilities).item())
        label = "plagiarized" if predicted_index == self.plagiarized_class_index else "original"
        confidence_score = max(plagiarism_score, originality_score)
        return PredictionResult(
            label=label,
            fake_score=round(plagiarism_score, 2),
            real_score=round(originality_score, 2),
            confidence_score=round(confidence_score, 2),
            predicted_index=predicted_index,
            raw_logits=raw_logits,
            logs=[
                f"Text classifier mapping: original={self.original_class_index}, plagiarized={self.plagiarized_class_index}.",
                f"Source type: {source_type}.",
                f"Word count analyzed: {word_count}.",
                f"Predicted class index: {predicted_index}.",
                f"Raw logits: {raw_logits}.",
                f"Softmax probabilities -> plagiarized: {plagiarism_score:.2f}%, original: {originality_score:.2f}%.",
                f"Final verdict: {label.upper()} with confidence {confidence_score:.2f}%.",
            ],
        )

    @torch.inference_mode()
    def predict_text(self, text: str, source_type: str = "text") -> PredictionResult:
        input_ids, attention_mask, word_count = load_text_tensors(text)
        logits = self.model(
            input_ids=input_ids.to(self.device),
            attention_mask=attention_mask.to(self.device),
        )
        return self._text_scores_to_result(logits, word_count, source_type)

    @torch.inference_mode()
    def predict_text_url(self, url: str) -> PredictionResult:
        return self.predict_text(fetch_text_from_url(url), source_type="url")

    @torch.inference_mode()
    def predict_text_file(self, file_path: str | Path) -> PredictionResult:
        return self.predict_text(read_text_file(Path(file_path)), source_type="file")
