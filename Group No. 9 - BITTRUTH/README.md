
# MINI_DEEPFAKE

This is a code bundle for MINI_DEEPFAKE. The original project is available at https://www.figma.com/design/pM0oVIpdACUnrBdFTfaj1o/MINI_DEEPFAKE.

## Frontend

Run `npm i` to install the dependencies.

Run `npm run dev` to start the Vite development server.

## Backend inference

This repository now includes a Python backend for real model inference using:

- `EfficientNet-B0` for images
- `R(2+1)D` high-precision model for videos from `model/high_precision_deepfake_model.pth`
- `EfficientNet-B0` on audio spectrograms for audio deepfake detection
- `DistilBERT` for plagiarism detection on text

The image checkpoint is loaded from `model/final_deepfake_model.pth`.

Use Python `3.11` or `3.12` for the backend virtual environment. Python `3.14` is not the recommended interpreter for this pinned dependency set.

See `BACKEND_SETUP.md` for macOS setup, API usage, and CLI examples.

## PHP auth API

This repository also includes a PHP API for:

- sign up
- login
- subscription updates
- free-plan upload usage tracking

Run it with:

```bash
cd /Users/arjun/MINI_DEEPFAKE
php -S 127.0.0.1:8080 -t php-api/public
```

Free plan rule:

- only `4` file uploads are allowed

If needed, set the frontend PHP API base URL with `VITE_PHP_API_URL`.
  
