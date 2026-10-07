from __future__ import annotations

import json
from pathlib import Path


V16_MODEL_VERSION = "ai-upchar-med-part2-advanced-v16.0.0"
V16_BASE_MODEL = "Qwen/Qwen3-4B-Base"
V16_ARTIFACT_SHA256 = "66d714f982be9565c779e1847d3613614caa3c7ccf7f5c5fe746d7b11027e79d"
REQUIRED_V16_FILES = (
    "adapter_config.json",
    "adapter_model.safetensors",
    "tokenizer_config.json",
    "part2_v16_manifest.json",
)


class ModelRegistryError(ValueError):
    """Raised when a model path is not an explicitly verified candidate."""


def validate_v16_adapter_path(model_path: str | Path) -> Path:
    """Resolve and verify the only currently allowed preproduction adapter.

    This is intentionally fail-closed. A path is not trusted merely because it
    exists or contains model-looking files. V17, unmanifested paths, and files
    with a mismatched artifact hash are rejected before inference.
    """
    if not str(model_path).strip():
        raise ModelRegistryError("MODEL_PATH is empty")

    path = Path(model_path).expanduser().resolve()
    if not path.is_dir():
        raise ModelRegistryError(f"V16 adapter directory does not exist: {path}")

    if "v17" in str(path).lower():
        raise ModelRegistryError("V17 is rejected and is not production-approved")

    missing = [name for name in REQUIRED_V16_FILES if not (path / name).is_file()]
    if missing:
        raise ModelRegistryError(f"V16 adapter is missing required files: {missing}")

    try:
        manifest = json.loads(
            (path / "part2_v16_manifest.json").read_text(encoding="utf-8")
        )
    except (OSError, json.JSONDecodeError) as error:
        raise ModelRegistryError("V16 manifest cannot be read") from error

    if manifest.get("model") != V16_BASE_MODEL:
        raise ModelRegistryError("V16 manifest has an unexpected base model")
    if manifest.get("artifact_sha256") != V16_ARTIFACT_SHA256:
        raise ModelRegistryError("V16 adapter artifact SHA256 does not match the registry")
    if manifest.get("production_approved") is not False:
        raise ModelRegistryError("V16 must remain explicitly preproduction")

    return path
