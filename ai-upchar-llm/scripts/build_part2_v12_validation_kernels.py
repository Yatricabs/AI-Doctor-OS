from __future__ import annotations

import base64
import hashlib
import json
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parent
UPLOAD_ROOT = WORKSPACE / "local-artifacts/kaggle/uploads"
ADAPTER_DATASET = "yatricabs/ai-upchar-part2-v12-adapter"


def select_adapter_dir(input_root: Path) -> Path:
    required = ("adapter_config.json", "adapter_model.safetensors", "tokenizer_config.json")
    discovered = sorted({path.parent for path in input_root.rglob("adapter_config.json")})
    valid = [
        directory
        for directory in discovered
        if all((directory / name).is_file() for name in required)
    ]
    non_checkpoint = [
        directory
        for directory in valid
        if not any(part.startswith("checkpoint-") for part in directory.parts)
    ]
    manifest_roots = [
        directory
        for directory in non_checkpoint
        if (directory / "part2_v12_manifest.json").is_file()
    ]
    if len(manifest_roots) == 1:
        return manifest_roots[0]
    if len(non_checkpoint) == 1:
        return non_checkpoint[0]
    if non_checkpoint:
        minimum_depth = min(len(path.relative_to(input_root).parts) for path in non_checkpoint)
        shallowest = [
            path
            for path in non_checkpoint
            if len(path.relative_to(input_root).parts) == minimum_depth
        ]
        if len(shallowest) == 1:
            return shallowest[0]
    raise AssertionError(
        {
            "input_root": str(input_root),
            "discovered": [str(path) for path in discovered],
            "valid": [str(path) for path in valid],
            "non_checkpoint": [str(path) for path in non_checkpoint],
            "manifest_roots": [str(path) for path in manifest_roots],
        }
    )


def include(path: Path) -> bool:
    relative = path.relative_to(ROOT)
    return not any(part in {"__pycache__", ".pytest_cache", "artifacts"} for part in relative.parts)


def source_payload(upload: Path) -> tuple[str, str]:
    source_zip = upload / "ai-upchar-llm-v12-validation.zip"
    with zipfile.ZipFile(source_zip, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(ROOT.rglob("*")):
            if path.is_file() and include(path):
                archive.write(path, Path("ai-upchar-llm", path.relative_to(ROOT)).as_posix())
    source_bytes = source_zip.read_bytes()
    return base64.b64encode(source_bytes).decode("ascii"), hashlib.sha256(source_bytes).hexdigest()


def notebook_code(payload: str, source_sha256: str, mode: str) -> str:
    if mode == "focused":
        command = [
            "scripts/evaluate_part2_v12_focused.py",
            "--adapter",
            "{adapter}",
            "--output",
            "/kaggle/working/part2_v12_focused_report.json",
        ]
        report = "/kaggle/working/part2_v12_focused_report.json"
    elif mode == "full":
        command = [
            "scripts/evaluate_part2_v12_full.py",
            "--adapter",
            "{adapter}",
            "--output",
            "/kaggle/working/part2_v12_full_report.json",
            "--checkpoint",
            "/kaggle/working/part2_v12_full_checkpoint.json",
        ]
        report = "/kaggle/working/part2_v12_full_report.json"
    else:
        raise ValueError(mode)

    return (
        r"""import base64, hashlib, json, os, subprocess, sys, zipfile
from pathlib import Path

EXPECTED_SOURCE_SHA256 = "__SOURCE_SHA256__"
source_zip = Path("/kaggle/temp/ai-upchar-llm-v12-validation.zip")
source_zip.parent.mkdir(parents=True, exist_ok=True)
source_zip.write_bytes(base64.b64decode("__PAYLOAD__"))
assert hashlib.sha256(source_zip.read_bytes()).hexdigest() == EXPECTED_SOURCE_SHA256
subprocess.run([sys.executable, "-m", "pip", "install", "-q", "transformers==4.57.3", "datasets==4.4.1", "trl==0.25.1", "peft==0.18.0", "accelerate==1.12.0", "bitsandbytes==0.48.2", "pyyaml==6.0.3"], check=True)

project_root = Path("/kaggle/temp/v12-validation")
project_root.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(source_zip) as archive:
    archive.extractall(project_root)
project = project_root / "ai-upchar-llm"
os.chdir(project)
sys.path.insert(0, str(project))
sys.path.insert(0, str(project / "src"))
os.environ["PYTHONPATH"] = str(project / "src")
os.environ["HF_HOME"] = "/kaggle/temp/hf-cache"

from scripts.build_part2_v12_validation_kernels import select_adapter_dir
adapter = select_adapter_dir(Path("/kaggle/input"))

command = __COMMAND__
command = [part.format(adapter=str(adapter)) for part in command]
process = subprocess.run([sys.executable, *command], text=True, capture_output=True)
Path("/kaggle/working/part2_v12_validation_stdout.txt").write_text(process.stdout + "\n" + process.stderr, encoding="utf-8")
report_path = Path("__REPORT__")
assert report_path.is_file(), process.stderr
report = json.loads(report_path.read_text(encoding="utf-8"))
summary = {
    "evaluator_returncode": process.returncode,
    "report_status": report["status"],
    "source_zip_sha256": EXPECTED_SOURCE_SHA256,
    "adapter_path": str(adapter),
}
Path("/kaggle/working/part2_v12_validation_kernel_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
print(json.dumps(summary, indent=2))
""".replace("__PAYLOAD__", payload)
        .replace("__SOURCE_SHA256__", source_sha256)
        .replace("__COMMAND__", repr(command))
        .replace("__REPORT__", report)
    )


def build(mode: str) -> dict[str, str]:
    slug = f"ai-upchar-part2-v12-{mode}-validation"
    upload = UPLOAD_ROOT / f"part2-v12-{mode}-validation-kernel"
    upload.mkdir(parents=True, exist_ok=True)
    payload, source_sha256 = source_payload(upload)
    code = notebook_code(payload, source_sha256, mode)
    notebook_name = f"Part2_V12_{mode.title()}_Validation.ipynb"
    notebook = {
        "cells": [
            {
                "id": f"part2-v12-{mode}",
                "cell_type": "code",
                "execution_count": None,
                "metadata": {},
                "outputs": [],
                "source": code.splitlines(True),
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
                "id": f"yatricabs/{slug}",
                "title": slug.replace("-", " ").upper(),
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
