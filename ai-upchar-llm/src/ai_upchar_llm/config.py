from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from typing import Any

SUPPORTED_MODELS = {"Qwen/Qwen3-4B-Base", "Qwen/Qwen3-8B-Base"}


def _merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    result = deepcopy(base)
    for key, value in override.items():
        result[key] = _merge(result.get(key, {}), value) if isinstance(value, dict) else value
    return result


def load_config(path: str | Path) -> dict[str, Any]:
    import yaml

    config_path = Path(path)
    data = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
    if parent := data.pop("extends", None):
        data = _merge(load_config(config_path.parent / parent), data)
    validate_config(data)
    return data


def validate_config(config: dict[str, Any]) -> None:
    model = config.get("model", {}).get("name")
    if model not in SUPPORTED_MODELS:
        raise ValueError(f"Unsupported configured base model: {model}")
    if config.get("training", {}).get("method") not in {"full", "lora", "qlora", "sft"}:
        raise ValueError("training.method must be full, lora, qlora, or sft")
    if not 0 < float(config.get("training", {}).get("eval_split", 0)) < 1:
        raise ValueError("training.eval_split must be between 0 and 1")
