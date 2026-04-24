from __future__ import annotations

import torch
from torch import nn
try:
    from efficientnet_pytorch import EfficientNet
except ModuleNotFoundError as exc:  # pragma: no cover - import-time guidance
    raise ModuleNotFoundError(
        "Missing dependency 'efficientnet_pytorch'. Install backend requirements with "
        "`pip install -r requirements.txt` inside the project's virtual environment."
    ) from exc
try:
    from transformers import DistilBertConfig, DistilBertForSequenceClassification
except ModuleNotFoundError as exc:  # pragma: no cover - import-time guidance
    raise ModuleNotFoundError(
        "Missing dependency 'transformers'. Install backend requirements with "
        "`pip install -r requirements.txt` inside the project's virtual environment."
    ) from exc
from torchvision.models import efficientnet_b0
from torchvision.models.video import r2plus1d_18


class EfficientNetBinaryClassifier(nn.Module):
    """EfficientNet-B0 with a 2-class head matching the checkpoint layout."""

    def __init__(self) -> None:
        super().__init__()
        self.model = efficientnet_b0(weights=None)
        in_features = self.model.classifier[1].in_features
        self.model.classifier[1] = nn.Linear(in_features, 2)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.model(x)


class HighPrecisionVideoModel(nn.Module):
    """R(2+1)D video model matching `high_precision_deepfake_model.pth` with `backbone.*` keys."""

    def __init__(self) -> None:
        super().__init__()
        self.backbone = r2plus1d_18(weights=None)
        self.backbone.fc = nn.Sequential(
            nn.Linear(512, 512),
            nn.ReLU(inplace=True),
            nn.Dropout(p=0.5),
            nn.Linear(512, 2),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.backbone(x)


class AudioEfficientNetClassifier(nn.Module):
    """EfficientNet-B0 wrapper matching checkpoints with `network.*` keys."""

    def __init__(self) -> None:
        super().__init__()
        self.network = EfficientNet.from_name("efficientnet-b0", num_classes=2)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.network(x)


class DistilBertPlagiarismClassifier(nn.Module):
    """Wrapper that matches checkpoints with `transformer.*` keys."""

    def __init__(self) -> None:
        super().__init__()
        config = DistilBertConfig(
            vocab_size=30522,
            max_position_embeddings=512,
            n_layers=6,
            dim=768,
            hidden_dim=3072,
            n_heads=12,
            num_labels=2,
        )
        self.transformer = DistilBertForSequenceClassification(config)

    def forward(self, input_ids: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
        return self.transformer(input_ids=input_ids, attention_mask=attention_mask).logits
