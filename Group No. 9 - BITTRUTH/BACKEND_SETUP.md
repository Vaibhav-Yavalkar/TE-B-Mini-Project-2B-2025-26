# Backend Setup

This project's current React UI is still mock-driven. The backend added here provides real inference endpoints without changing the GUI.

## Model mapping

- Image model: `EfficientNet-B0`
- Video model: high-precision `R(2+1)D`
- Audio model: `EfficientNet-B0` over mel-spectrogram images
- Text model: `DistilBERT` plagiarism classifier
- Checkpoint: `model/final_deepfake_model.pth`
- Video checkpoint: `model/high_precision_deepfake_model.pth`
- Audio checkpoint: `model/audio_deepfake_detector.pth`
- Text checkpoint: `model/plagiarism_detector.pth`
- Expected checkpoint keys:
  - `image_model_state`

## macOS setup

1. Install Python `3.11` or `3.12`.
   Do not use Python `3.14` for this backend setup. The pinned scientific stack in this project is intended for the stable PyTorch wheel path, and your `numpy` install log shows it is trying to compile from source under `3.14`.
2. Create and activate a virtual environment:

```bash
python3.11 -m venv .venv
source .venv/bin/activate
```

3. Install backend dependencies:

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

If `python3.11` is not installed on macOS with Homebrew:

```bash
brew install python@3.11
```

4. Start the inference API:

```bash
uvicorn backend.app:app --reload --host 127.0.0.1 --port 8000
```

Default backend behavior is already:

```bash
DEEPFAKE_FAKE_CLASS_INDEX=0
DEEPFAKE_IMAGE_NORMALIZATION=none
```

So you can launch directly with:

```bash
python -m uvicorn backend.app:app --reload --host 127.0.0.1 --port 8000
```

Optional backend tuning:

```bash
export DEEPFAKE_FAKE_CLASS_INDEX=0
export DEEPFAKE_IMAGE_NORMALIZATION=none
```

Notes:

- `DEEPFAKE_FAKE_CLASS_INDEX` controls which class index means `fake`. Valid values: `0` or `1`.
- `DEEPFAKE_IMAGE_NORMALIZATION` controls image preprocessing. Valid values:
  - `none`
  - `imagenet`

5. In another terminal, start the React frontend:

```bash
npm install
npm run dev
```

Frontend default URL:

```text
http://localhost:5173
```

Backend default URL:

```text
http://127.0.0.1:8000
```

## Test the backend directly

Analyze an image file:

```bash
python3 -m backend.cli --image /absolute/path/to/image.jpg
```

Analyze a video file:

```bash
python3 -m backend.cli --video /absolute/path/to/video.mp4
```

Health check:

```bash
curl http://127.0.0.1:8000/health
```

Upload image:

```bash
curl -X POST http://127.0.0.1:8000/analyze/image \
  -F "file=@/absolute/path/to/image.jpg"
```

Upload video:

```bash
curl -X POST http://127.0.0.1:8000/analyze/video \
  -F "file=@/absolute/path/to/video.mp4"
```

Analyze remote image:

```bash
curl -X POST http://127.0.0.1:8000/analyze/image-url \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/example.jpg"}'
```

Analyze remote video:

```bash
curl -X POST http://127.0.0.1:8000/analyze/video-url \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/example.mp4"}'
```

Upload audio:

```bash
curl -X POST http://127.0.0.1:8000/analyze/audio \
  -F "file=@/absolute/path/to/audio.wav"
```

Analyze remote audio:

```bash
curl -X POST http://127.0.0.1:8000/analyze/audio-url \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/example.wav"}'
```

Analyze direct text:

```bash
curl -X POST http://127.0.0.1:8000/analyze/plagiarism-text \
  -H "Content-Type: application/json" \
  -d '{"text":"Your text goes here"}'
```

Analyze text from URL:

```bash
curl -X POST http://127.0.0.1:8000/analyze/plagiarism-url \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/article"}'
```

Analyze text file:

```bash
curl -X POST http://127.0.0.1:8000/analyze/plagiarism-file \
  -F "file=@/absolute/path/to/text.txt"
```

## Notes

- The UI still shows simulated results because you asked not to modify the GUI.
- Once you want it wired up, the frontend can call the backend endpoints above without changing the visual design.
