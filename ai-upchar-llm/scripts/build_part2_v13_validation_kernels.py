from __future__ import annotations

import base64
import hashlib
from importlib import import_module
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parent
UPLOAD_ROOT = WORKSPACE / "local-artifacts/kaggle/uploads"
ADAPTER_DATASET = "yatricabs/ai-upchar-part2-v13-adapter"
sys.path.insert(0, str(ROOT))
v12 = import_module("scripts.build_part2_v12_validation_kernels")


def select_adapter_dir(input_root: Path) -> Path:
    required = ("adapter_config.json", "adapter_model.safetensors", "tokenizer_config.json")
    discovered = sorted({path.parent for path in input_root.rglob("adapter_config.json")})
    valid = [path for path in discovered if all((path / name).is_file() for name in required)]
    non_checkpoint = [
        path for path in valid if not any(part.startswith("checkpoint-") for part in path.parts)
    ]
    manifest_roots = [
        path for path in non_checkpoint if (path / "part2_v13_manifest.json").is_file()
    ]
    if len(manifest_roots) == 1:
        return manifest_roots[0]
    if len(non_checkpoint) == 1:
        return non_checkpoint[0]
    if non_checkpoint:
        depth = min(len(path.relative_to(input_root).parts) for path in non_checkpoint)
        shallowest = [
            path for path in non_checkpoint if len(path.relative_to(input_root).parts) == depth
        ]
        if len(shallowest) == 1:
            return shallowest[0]
    raise AssertionError(
        {"input_root": str(input_root), "discovered": [str(p) for p in discovered]}
    )


def include(path: Path) -> bool:
    relative = path.relative_to(ROOT)
    return not any(part in {"__pycache__", ".pytest_cache", "artifacts"} for part in relative.parts)


def source_payload(upload: Path) -> tuple[str, str]:
    source_zip = upload / "ai-upchar-llm-v13-validation.zip"
    with zipfile.ZipFile(source_zip, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(ROOT.rglob("*")):
            if path.is_file() and include(path):
                archive.write(path, Path("ai-upchar-llm", path.relative_to(ROOT)).as_posix())
    data = source_zip.read_bytes()
    return base64.b64encode(data).decode("ascii"), hashlib.sha256(data).hexdigest()


def notebook_code(payload: str, source_sha256: str, mode: str) -> str:
    code = v12.notebook_code(payload, source_sha256, mode)
    replacements = {
        "ai-upchar-llm-v12-validation.zip": "ai-upchar-llm-v13-validation.zip",
        "/kaggle/temp/v12-validation": "/kaggle/temp/v13-validation",
        "build_part2_v12_validation_kernels": "build_part2_v13_validation_kernels",
        "yatricabs/ai-upchar-part2-v12-adapter": ADAPTER_DATASET,
        "part2_v12_focused": "part2_v13_focused",
        "part2_v12_full": "part2_v13_full",
        "part2_v12_validation": "part2_v13_validation",
    }
    for old, new in replacements.items():
        code = code.replace(old, new)
    code = code.replace(
        "scripts/evaluate_part2_v13_focused.py",
        "scripts/evaluate_part2_v12_focused.py",
    )
    code = code.replace(
        "scripts/evaluate_part2_v13_full.py",
        "scripts/evaluate_part2_v12_full.py",
    )
    return code


def build(mode: str) -> dict[str, str]:
    slug = f"yatricabs/ai-upchar-part2-v13-{mode}-validation"
    upload = UPLOAD_ROOT / f"part2-v13-{mode}-validation-kernel"
    upload.mkdir(parents=True, exist_ok=True)
    payload, source_sha256 = source_payload(upload)
    notebook_name = f"Part2_V13_{mode.title()}_Validation.ipynb"
    notebook = {
        "cells": [
            {
                "id": f"part2-v13-{mode}",
                "cell_type": "code",
                "execution_count": None,
                "metadata": {},
                "outputs": [],
                "source": notebook_code(payload, source_sha256, mode).splitlines(True),
            }
        ],
        "metadata": {
            "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"}
        },
        "nbformat": 4,
        "nbformat_minor": 5,
    }
    (upload / notebook_name).write_text(json.dumps(notebook, indent=2), encoding="utf-8")
    (upload / "kernel-metadata.json").write_text(
        json.dumps(
            {
                "id": slug,
                "title": f"AI UPCHAR Part2 V13 {mode.title()} Validation",
                "code_file": notebook_name,
                "language": "python",
                "kernel_type": "notebook",
                "is_private": True,
                "enable_gpu": True,
                "enable_internet": True,
                "dataset_sources": [ADAPTER_DATASET],
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    return {"mode": mode, "slug": slug, "upload": str(upload), "source_sha256": source_sha256}


if __name__ == "__main__":
    print(json.dumps([build("focused"), build("full")], indent=2))
