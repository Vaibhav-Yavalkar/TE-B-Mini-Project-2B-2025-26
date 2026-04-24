from __future__ import annotations

import argparse
import json
from pathlib import Path

from .inference import DeepfakeInferenceService


def main() -> None:
    parser = argparse.ArgumentParser(description="Run deepfake inference from the terminal.")
    parser.add_argument("--model", default="model/final_deepfake_model.pth", help="Path to the .pth checkpoint")
    parser.add_argument("--image", help="Path to an image file")
    parser.add_argument("--video", help="Path to a video file")
    args = parser.parse_args()

    if not args.image and not args.video:
        parser.error("Provide either --image or --video.")

    service = DeepfakeInferenceService(args.model)

    if args.image:
        result = service.predict_image(Path(args.image))
        print(json.dumps({"type": "image", **result.__dict__}, indent=2))
        return

    result, frames_analyzed = service.predict_video(Path(args.video))
    print(json.dumps({"type": "video", "frames_analyzed": frames_analyzed, **result.__dict__}, indent=2))


if __name__ == "__main__":
    main()
