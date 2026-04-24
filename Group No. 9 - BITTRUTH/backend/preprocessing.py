from __future__ import annotations

import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import urlopen

import cv2
import librosa
import numpy as np
import torch
from PIL import Image
from pypdf import PdfReader
from transformers import DistilBertTokenizerFast
from torchvision import transforms

IMAGE_SIZE = 224
VIDEO_SIZE = 112
VIDEO_RESIZE_SIDE = 128
VIDEO_FRAMES = 16
VIDEO_CLIPS = 5
MEL_BINS = 224
SPEC_TIME_STEPS = 224
DEFAULT_IMAGE_NORMALIZATION = "none"
DEFAULT_VIDEO_NORMALIZATION = "kinetics"
KINETICS_MEAN = np.array([0.43216, 0.394666, 0.37645], dtype=np.float32)
KINETICS_STD = np.array([0.22803, 0.22145, 0.216989], dtype=np.float32)
ALLOWED_IMAGE_TYPES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
ALLOWED_VIDEO_TYPES = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
ALLOWED_AUDIO_TYPES = {".wav", ".mp3", ".m4a", ".flac", ".ogg", ".aac"}
ALLOWED_TEXT_TYPES = {".txt", ".md", ".pdf"}
MAX_TEXT_TOKENS = 512


def get_image_preprocess_mode() -> str:
    return os.getenv("DEEPFAKE_IMAGE_NORMALIZATION", DEFAULT_IMAGE_NORMALIZATION).strip().lower()


def get_video_preprocess_mode() -> str:
    return os.getenv("DEEPFAKE_VIDEO_NORMALIZATION", DEFAULT_VIDEO_NORMALIZATION).strip().lower()


def normalize_video_frame(frame: np.ndarray) -> np.ndarray:
    mode = get_video_preprocess_mode()
    if mode == "symmetric":
        return (frame - 0.5) / 0.5
    if mode == "kinetics":
        return (frame - KINETICS_MEAN) / KINETICS_STD
    return frame


def resize_and_center_crop_video_frame(frame: np.ndarray) -> np.ndarray:
    height, width = frame.shape[:2]
    if min(height, width) <= 0:
        raise ValueError("Invalid video frame dimensions.")

    scale = VIDEO_RESIZE_SIDE / float(min(height, width))
    resized_width = int(round(width * scale))
    resized_height = int(round(height * scale))
    frame = cv2.resize(frame, (resized_width, resized_height), interpolation=cv2.INTER_LINEAR)

    start_x = max((resized_width - VIDEO_SIZE) // 2, 0)
    start_y = max((resized_height - VIDEO_SIZE) // 2, 0)
    end_x = start_x + VIDEO_SIZE
    end_y = start_y + VIDEO_SIZE
    return frame[start_y:end_y, start_x:end_x]


def build_image_transform() -> transforms.Compose:
    mode = get_image_preprocess_mode()
    transform_steps: list[object] = [
        transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
        transforms.ToTensor(),
    ]
    if mode == "imagenet":
        transform_steps.append(
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225],
            )
        )
    return transforms.Compose(transform_steps)


def _safe_suffix_from_url(url: str, fallback: str) -> str:
    path = urlparse(url).path
    suffix = Path(path).suffix.lower()
    return suffix or fallback


def download_to_tempfile(url: str, fallback_suffix: str) -> Path:
    suffix = _safe_suffix_from_url(url, fallback_suffix)
    with urlopen(url) as response:
        data = response.read()

    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    temp_file.write(data)
    temp_file.flush()
    temp_file.close()
    return Path(temp_file.name)


def is_youtube_url(url: str) -> bool:
    host = (urlparse(url).netloc or "").lower()
    return any(domain in host for domain in ("youtube.com", "youtu.be", "youtube-nocookie.com"))


def download_video_to_tempfile(url: str, fallback_suffix: str = ".mp4") -> Path:
    if not is_youtube_url(url):
        return download_to_tempfile(url, fallback_suffix)

    if shutil.which("yt-dlp") is None:
        raise RuntimeError(
            "YouTube URLs require `yt-dlp`. Install it in your active environment with `pip install yt-dlp`."
        )

    temp_dir = Path(tempfile.mkdtemp(prefix="youtube_video_"))
    output_template = temp_dir / "downloaded.%(ext)s"

    command = [
        "yt-dlp",
        "-f",
        "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "--no-playlist",
        "--merge-output-format",
        "mp4",
        "-o",
        str(output_template),
        url,
    ]
    completed = subprocess.run(command, capture_output=True, text=True)
    if completed.returncode != 0:
        error_message = (completed.stderr or completed.stdout or "").strip()
        shutil.rmtree(temp_dir, ignore_errors=True)
        if not error_message:
            error_message = "Unable to download the YouTube video URL."
        raise RuntimeError(f"YouTube download failed: {error_message}")

    candidates = sorted(temp_dir.glob("downloaded.*"))
    output_path = next((path for path in candidates if path.suffix.lower() in ALLOWED_VIDEO_TYPES), None)
    if output_path is None or not output_path.exists() or output_path.stat().st_size == 0:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise RuntimeError(
            "YouTube download finished but no playable video file was produced. "
            "Please verify `yt-dlp` and `ffmpeg` are installed."
        )
    return output_path


def extract_audio_track(file_path: Path, sample_rate: int = 16000) -> Path | None:
    output_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    output_path = Path(output_file.name)
    output_file.close()

    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(file_path),
        "-vn",
        "-ac",
        "1",
        "-ar",
        str(sample_rate),
        str(output_path),
    ]

    completed = subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if completed.returncode != 0 or not output_path.exists() or output_path.stat().st_size == 0:
        output_path.unlink(missing_ok=True)
        return None
    return output_path


def fetch_text_from_url(url: str) -> str:
    with urlopen(url) as response:
        html = response.read().decode("utf-8", errors="ignore")
    html = re.sub(r"(?is)<script.*?>.*?</script>", " ", html)
    html = re.sub(r"(?is)<style.*?>.*?</style>", " ", html)
    text = re.sub(r"(?s)<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def read_text_file(file_path: Path) -> str:
    if file_path.suffix.lower() == ".pdf":
        reader = PdfReader(str(file_path))
        extracted_pages = [(page.extract_text() or "") for page in reader.pages]
        return "\n".join(extracted_pages).strip()
    return file_path.read_text(encoding="utf-8", errors="ignore").strip()


def detect_image_suffix(file_path: Path) -> str:
    try:
        with Image.open(file_path) as image:
            image_format = (image.format or "").lower()
    except (OSError, ValueError):
        return file_path.suffix.lower()

    if image_format == "jpeg":
        return ".jpg"
    if image_format:
        return f".{image_format}"
    return file_path.suffix.lower()


def load_image_tensor(file_path: Path) -> torch.Tensor:
    image = Image.open(file_path).convert("RGB")
    tensor = build_image_transform()(image)
    return tensor.unsqueeze(0)


def load_video_frame_tensors_for_image_model(file_path: Path, num_frames: int = 5) -> tuple[list[torch.Tensor], int]:
    capture = cv2.VideoCapture(str(file_path))
    if not capture.isOpened():
        raise ValueError(f"Unable to open video file: {file_path}")

    total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_indices = _sample_frame_indices(total_frames, num_frames)
    image_transform = build_image_transform()

    frame_tensors: list[torch.Tensor] = []
    for frame_index in frame_indices:
        capture.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
        success, frame = capture.read()
        if not success:
            continue
        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        image = Image.fromarray(frame)
        frame_tensors.append(image_transform(image).unsqueeze(0))

    capture.release()

    if not frame_tensors:
        raise ValueError(f"No representative frames could be extracted from: {file_path}")

    return frame_tensors, total_frames


def estimate_faces_in_video(file_path: Path, num_frames: int = 8) -> int:
    capture = cv2.VideoCapture(str(file_path))
    if not capture.isOpened():
        return 0

    cascade_path = Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml"
    face_cascade = cv2.CascadeClassifier(str(cascade_path))
    if face_cascade.empty():
        capture.release()
        return 0

    total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_indices = _sample_frame_indices(total_frames, num_frames)
    max_faces_detected = 0

    for frame_index in frame_indices:
        capture.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
        success, frame = capture.read()
        if not success:
            continue
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(30, 30))
        max_faces_detected = max(max_faces_detected, len(faces))

    capture.release()
    return int(max_faces_detected)


def _sample_frame_indices(total_frames: int, target_frames: int) -> list[int]:
    if total_frames <= 0:
        return [0] * target_frames
    if total_frames == 1:
        return [0] * target_frames
    return np.linspace(0, total_frames - 1, num=target_frames, dtype=int).tolist()


def load_video_tensor(file_path: Path, num_frames: int = VIDEO_FRAMES) -> tuple[torch.Tensor, int]:
    capture = cv2.VideoCapture(str(file_path))
    if not capture.isOpened():
        raise ValueError(f"Unable to open video file: {file_path}")

    total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_indices = _sample_frame_indices(total_frames, num_frames)

    frames: list[np.ndarray] = []
    for frame_index in frame_indices:
        capture.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
        success, frame = capture.read()
        if not success:
            continue
        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        frame = resize_and_center_crop_video_frame(frame)
        frame = frame.astype(np.float32) / 255.0
        frame = normalize_video_frame(frame)
        frames.append(frame)

    capture.release()

    if not frames:
        raise ValueError(f"No frames could be extracted from: {file_path}")

    while len(frames) < num_frames:
        frames.append(frames[-1])

    video_array = np.stack(frames[:num_frames], axis=0)
    video_tensor = torch.from_numpy(video_array).permute(3, 0, 1, 2).unsqueeze(0)
    return video_tensor, len(frames[:num_frames])


def load_video_clip_tensors(
    file_path: Path,
    num_frames: int = VIDEO_FRAMES,
    num_clips: int = VIDEO_CLIPS,
) -> tuple[list[torch.Tensor], int]:
    capture = cv2.VideoCapture(str(file_path))
    if not capture.isOpened():
        raise ValueError(f"Unable to open video file: {file_path}")

    total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    if total_frames <= 0:
        capture.release()
        raise ValueError(f"No frames found in video file: {file_path}")

    clips: list[torch.Tensor] = []
    segment_edges = np.linspace(0, total_frames, num=num_frames + 1, dtype=int)

    for clip_index in range(max(1, num_clips)):
        frames: list[np.ndarray] = []
        relative_position = (clip_index + 0.5) / max(1, num_clips)
        sampled_indices: list[int] = []

        for segment_index in range(num_frames):
            start = int(segment_edges[segment_index])
            end = int(segment_edges[segment_index + 1])
            if end <= start:
                sampled_indices.append(min(start, total_frames - 1))
                continue

            span = end - start
            chosen = start + int(round((span - 1) * relative_position))
            sampled_indices.append(min(max(chosen, start), end - 1))

        frames: list[np.ndarray] = []
        for frame_index in sampled_indices:
            capture.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
            success, frame = capture.read()
            if not success:
                continue
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frame = resize_and_center_crop_video_frame(frame)
            frame = frame.astype(np.float32) / 255.0
            frame = normalize_video_frame(frame)
            frames.append(frame)

        if not frames:
            continue

        while len(frames) < num_frames:
            frames.append(frames[-1])

        clip_array = np.stack(frames[:num_frames], axis=0)
        clip_tensor = torch.from_numpy(clip_array).permute(3, 0, 1, 2).unsqueeze(0)
        clips.append(clip_tensor)

    capture.release()

    if not clips:
        raise ValueError(f"No clips could be extracted from: {file_path}")

    return clips, total_frames


def load_audio_tensor(file_path: Path, sample_rate: int = 16000) -> tuple[torch.Tensor, float]:
    audio, sr = librosa.load(str(file_path), sr=sample_rate, mono=True)
    if audio.size == 0:
        raise ValueError(f"No audio samples could be loaded from: {file_path}")

    duration_seconds = float(len(audio) / sample_rate)
    mel = librosa.feature.melspectrogram(
        y=audio,
        sr=sample_rate,
        n_mels=MEL_BINS,
        n_fft=1024,
        hop_length=256,
    )
    mel_db = librosa.power_to_db(mel, ref=np.max)

    mel_min = float(mel_db.min())
    mel_max = float(mel_db.max())
    mel_norm = (mel_db - mel_min) / max(mel_max - mel_min, 1e-6)
    mel_uint8 = (mel_norm * 255.0).astype(np.uint8)

    spectrogram = Image.fromarray(mel_uint8).convert("RGB")
    spectrogram = spectrogram.resize((SPEC_TIME_STEPS, MEL_BINS))
    tensor = transforms.ToTensor()(spectrogram).unsqueeze(0)
    return tensor, round(duration_seconds, 2)


_tokenizer: DistilBertTokenizerFast | None = None


def get_plagiarism_tokenizer() -> DistilBertTokenizerFast:
    global _tokenizer
    if _tokenizer is None:
        _tokenizer = DistilBertTokenizerFast.from_pretrained("distilbert-base-uncased")
    return _tokenizer


def load_text_tensors(text: str) -> tuple[torch.Tensor, torch.Tensor, int]:
    cleaned_text = re.sub(r"\s+", " ", text).strip()
    tokenizer = get_plagiarism_tokenizer()
    encoded = tokenizer(
        cleaned_text,
        truncation=True,
        padding="max_length",
        max_length=MAX_TEXT_TOKENS,
        return_tensors="pt",
    )
    word_count = len(cleaned_text.split()) if cleaned_text else 0
    return encoded["input_ids"], encoded["attention_mask"], word_count
