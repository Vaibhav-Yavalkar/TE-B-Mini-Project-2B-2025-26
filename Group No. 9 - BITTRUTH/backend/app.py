from __future__ import annotations

import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl

from .inference import AudioDeepfakeInferenceService, DeepfakeInferenceService, PlagiarismInferenceService
from .preprocessing import (
    ALLOWED_AUDIO_TYPES,
    ALLOWED_IMAGE_TYPES,
    ALLOWED_TEXT_TYPES,
    ALLOWED_VIDEO_TYPES,
    detect_image_suffix,
    download_to_tempfile,
    download_video_to_tempfile,
    estimate_faces_in_video,
    extract_audio_track,
)
from .inference import fuse_video_audio_results

ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_MODEL_PATH = ROOT_DIR / "model" / "final_deepfake_model.pth"
DEFAULT_VIDEO_MODEL_PATH = ROOT_DIR / "model" / "high_precision_deepfake_model.pth"
DEFAULT_AUDIO_MODEL_PATH = ROOT_DIR / "model" / "audio_deepfake_detector.pth"
DEFAULT_PLAGIARISM_MODEL_PATH = ROOT_DIR / "model" / "plagiarism_detector.pth"
DEFAULT_FAKE_CLASS_INDEX = 0

app = FastAPI(title="Mini Deepfake Inference API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
service = DeepfakeInferenceService(
    image_checkpoint_path=os.getenv("DEEPFAKE_MODEL_PATH", str(DEFAULT_MODEL_PATH)),
    video_checkpoint_path=os.getenv("DEEPFAKE_VIDEO_MODEL_PATH", str(DEFAULT_VIDEO_MODEL_PATH)),
    image_fake_class_index=int(os.getenv("DEEPFAKE_FAKE_CLASS_INDEX", str(DEFAULT_FAKE_CLASS_INDEX))),
    video_fake_class_index=int(os.getenv("DEEPFAKE_VIDEO_FAKE_CLASS_INDEX", "1")),
)
audio_service = AudioDeepfakeInferenceService(
    checkpoint_path=os.getenv("AUDIO_DEEPFAKE_MODEL_PATH", str(DEFAULT_AUDIO_MODEL_PATH)),
    fake_class_index=int(os.getenv("AUDIO_DEEPFAKE_FAKE_CLASS_INDEX", "1")),
)
plagiarism_service = PlagiarismInferenceService(
    checkpoint_path=os.getenv("PLAGIARISM_MODEL_PATH", str(DEFAULT_PLAGIARISM_MODEL_PATH)),
    plagiarized_class_index=int(os.getenv("PLAGIARISM_CLASS_INDEX", "1")),
)


class UrlRequest(BaseModel):
    url: HttpUrl


class TextRequest(BaseModel):
    text: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _ensure_suffix(file_name: str | None, allowed_types: set[str], fallback: str) -> str:
    suffix = Path(file_name or "").suffix.lower()
    suffix = suffix or fallback
    if suffix not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {suffix}")
    return suffix


def _save_upload(upload_file: UploadFile, allowed_types: set[str], fallback_suffix: str) -> Path:
    suffix = _ensure_suffix(upload_file.filename, allowed_types, fallback_suffix)
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_file.write(upload_file.file.read())
        return Path(temp_file.name)


def _cleanup_file(file_path: Path) -> None:
    try:
        file_path.unlink(missing_ok=True)
    except OSError:
        pass
    parent = file_path.parent
    if parent.name.startswith("youtube_video_"):
        try:
            parent.rmdir()
        except OSError:
            pass


@app.post("/analyze/image")
async def analyze_image(file: UploadFile = File(...)) -> dict[str, object]:
    temp_path = _save_upload(file, ALLOWED_IMAGE_TYPES, ".jpg")
    try:
        detected_suffix = detect_image_suffix(temp_path)
        if detected_suffix not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail="Uploaded file is not a valid image.")
        result = service.predict_image(temp_path)
        return {
            "type": "image",
            "model": "EfficientNet-B0",
            "label": result.label,
            "fake_score": result.fake_score,
            "real_score": result.real_score,
            "confidence_score": result.confidence_score,
            "predicted_index": result.predicted_index,
            "raw_logits": result.raw_logits,
            "logs": result.logs,
            "source": file.filename,
        }
    finally:
        _cleanup_file(temp_path)


@app.post("/analyze/image-url")
async def analyze_image_url(payload: UrlRequest) -> dict[str, object]:
    temp_path = download_to_tempfile(str(payload.url), ".jpg")
    try:
        detected_suffix = detect_image_suffix(temp_path)
        if detected_suffix not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail="Remote file is not a valid image.")
        result = service.predict_image(temp_path)
        return {
            "type": "image",
            "model": "EfficientNet-B0",
            "label": result.label,
            "fake_score": result.fake_score,
            "real_score": result.real_score,
            "confidence_score": result.confidence_score,
            "predicted_index": result.predicted_index,
            "raw_logits": result.raw_logits,
            "logs": result.logs,
            "source": str(payload.url),
        }
    finally:
        _cleanup_file(temp_path)


@app.post("/analyze/plagiarism-text")
async def analyze_plagiarism_text(payload: TextRequest) -> dict[str, object]:
    result = plagiarism_service.predict_text(payload.text, source_type="text")
    return {
        "type": "text",
        "model": "DistilBERT Plagiarism Detector",
        "label": result.label,
        "plagiarism_score": result.fake_score,
        "originality_score": result.real_score,
        "confidence_score": result.confidence_score,
        "predicted_index": result.predicted_index,
        "raw_logits": result.raw_logits,
        "logs": result.logs,
        "source": "direct-text",
    }


@app.post("/analyze/plagiarism-url")
async def analyze_plagiarism_url(payload: UrlRequest) -> dict[str, object]:
    result = plagiarism_service.predict_text_url(str(payload.url))
    return {
        "type": "text",
        "model": "DistilBERT Plagiarism Detector",
        "label": result.label,
        "plagiarism_score": result.fake_score,
        "originality_score": result.real_score,
        "confidence_score": result.confidence_score,
        "predicted_index": result.predicted_index,
        "raw_logits": result.raw_logits,
        "logs": result.logs,
        "source": str(payload.url),
    }


@app.post("/analyze/plagiarism-file")
async def analyze_plagiarism_file(file: UploadFile = File(...)) -> dict[str, object]:
    temp_path = _save_upload(file, ALLOWED_TEXT_TYPES, ".txt")
    try:
        result = plagiarism_service.predict_text_file(temp_path)
        return {
            "type": "text",
            "model": "DistilBERT Plagiarism Detector",
            "label": result.label,
            "plagiarism_score": result.fake_score,
            "originality_score": result.real_score,
            "confidence_score": result.confidence_score,
            "predicted_index": result.predicted_index,
            "raw_logits": result.raw_logits,
            "logs": result.logs,
            "source": file.filename,
        }
    finally:
        _cleanup_file(temp_path)


@app.post("/analyze/video")
async def analyze_video(file: UploadFile = File(...)) -> dict[str, object]:
    temp_path = _save_upload(file, ALLOWED_VIDEO_TYPES, ".mp4")
    try:
        result, frames_analyzed = service.predict_video(temp_path)
        faces_detected = estimate_faces_in_video(temp_path)
        audio_temp_path = extract_audio_track(temp_path)
        audio_result = None
        if audio_temp_path is not None:
            try:
                audio_result, _ = audio_service.predict_audio(audio_temp_path)
            finally:
                audio_temp_path.unlink(missing_ok=True)
        result = fuse_video_audio_results(result, audio_result)
        return {
            "type": "video",
            "model": "R(2+1)D + Audio Fusion",
            "label": result.label,
            "fake_score": result.fake_score,
            "real_score": result.real_score,
            "confidence_score": result.confidence_score,
            "predicted_index": result.predicted_index,
            "raw_logits": result.raw_logits,
            "logs": result.logs,
            "frames_analyzed": frames_analyzed,
            "faces_detected": faces_detected,
            "source": file.filename,
        }
    finally:
        _cleanup_file(temp_path)


@app.post("/analyze/video-url")
async def analyze_video_url(payload: UrlRequest) -> dict[str, object]:
    try:
        temp_path = download_video_to_tempfile(str(payload.url), ".mp4")
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    try:
        if temp_path.suffix.lower() not in ALLOWED_VIDEO_TYPES and temp_path.suffix.lower() != ".mp4":
            raise HTTPException(status_code=400, detail="Unsupported remote video file type.")
        result, frames_analyzed = service.predict_video(temp_path)
        faces_detected = estimate_faces_in_video(temp_path)
        audio_temp_path = extract_audio_track(temp_path)
        audio_result = None
        if audio_temp_path is not None:
            try:
                audio_result, _ = audio_service.predict_audio(audio_temp_path)
            finally:
                audio_temp_path.unlink(missing_ok=True)
        result = fuse_video_audio_results(result, audio_result)
        return {
            "type": "video",
            "model": "R(2+1)D + Audio Fusion",
            "label": result.label,
            "fake_score": result.fake_score,
            "real_score": result.real_score,
            "confidence_score": result.confidence_score,
            "predicted_index": result.predicted_index,
            "raw_logits": result.raw_logits,
            "logs": result.logs,
            "frames_analyzed": frames_analyzed,
            "faces_detected": faces_detected,
            "source": str(payload.url),
        }
    finally:
        _cleanup_file(temp_path)


@app.post("/analyze/audio")
async def analyze_audio(file: UploadFile = File(...)) -> dict[str, object]:
    temp_path = _save_upload(file, ALLOWED_AUDIO_TYPES, ".wav")
    try:
        result, duration_seconds = audio_service.predict_audio(temp_path)
        return {
            "type": "audio",
            "model": "EfficientNet-B0 Audio",
            "label": result.label,
            "fake_score": result.fake_score,
            "real_score": result.real_score,
            "confidence_score": result.confidence_score,
            "predicted_index": result.predicted_index,
            "raw_logits": result.raw_logits,
            "logs": result.logs,
            "duration_seconds": duration_seconds,
            "source": file.filename,
        }
    finally:
        _cleanup_file(temp_path)


@app.post("/analyze/audio-url")
async def analyze_audio_url(payload: UrlRequest) -> dict[str, object]:
    temp_path = download_to_tempfile(str(payload.url), ".wav")
    try:
        if temp_path.suffix.lower() not in ALLOWED_AUDIO_TYPES:
            raise HTTPException(status_code=400, detail="Unsupported remote audio file type.")
        result, duration_seconds = audio_service.predict_audio(temp_path)
        return {
            "type": "audio",
            "model": "EfficientNet-B0 Audio",
            "label": result.label,
            "fake_score": result.fake_score,
            "real_score": result.real_score,
            "confidence_score": result.confidence_score,
            "predicted_index": result.predicted_index,
            "raw_logits": result.raw_logits,
            "logs": result.logs,
            "duration_seconds": duration_seconds,
            "source": str(payload.url),
        }
    finally:
        _cleanup_file(temp_path)
