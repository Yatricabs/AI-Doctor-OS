from __future__ import annotations

import argparse
import base64
import hashlib
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parent
UPLOAD_ROOT = WORKSPACE / "local-artifacts/kaggle/uploads"
ADAPTER_DATASET = "yatricabs/ai-upchar-part2-v16-adapter"
EXPECTED_ADAPTER_SHA256 = "66d714f982be9565c779e1847d3613614caa3c7ccf7f5c5fe746d7b11027e79d"
STRUCTURED_DECODING = "ai-upchar-ordered-json-sequence-v4+positioned-cache+strict-boundary-token-check+lm-format-enforcer==0.11.3"
DEPENDENCIES = (
    "transformers==4.57.3",
    "peft==0.18.0",
    "accelerate==1.12.0",
    "bitsandbytes==0.48.2",
    "lm-format-enforcer==0.11.3",
)
MODES = {
    "diagnostic": {
        "script": "scripts/evaluate_part2_v16_structured_diagnostic.py",
        "report": "part2_v16_structured_diagnostic_report.json",
        "title": "AI UPCHAR Part2 V16 Structured Diagnostic",
    },
    "privacy": {
        "script": "scripts/evaluate_part2_v16_privacy_diagnostic.py",
        "report": "part2_v16_privacy_diagnostic_report.json",
        "title": "AI UPCHAR Part2 V16 E20 Privacy Diagnostic",
    },
    "focused": {
        "script": "scripts/evaluate_part2_v16_structured_focused.py",
        "report": "part2_v16_structured_focused_report.json",
        "title": "AI UPCHAR Part2 V16 Structured Focused Validation",
    },
    "full": {
        "script": "scripts/evaluate_part2_v12_full.py",
        "report": "part2_v16_structured_full_report.json",
        "title": "AI UPCHAR Part2 V16 Structured Full Validation",
    },
}

SOURCE_FILES = (
    "scripts/structured_json_generation.py",
    "scripts/evaluate_part2_heldout.py",
    "scripts/evaluate_e3_safety.py",
    "scripts/evaluate_part2_v12_focused.py",
    "scripts/evaluate_part2_v12_full.py",
    "scripts/evaluate_part2_v16_structured_diagnostic.py",
    "scripts/evaluate_part2_v16_structured_focused.py",
    "scripts/evaluate_part2_v16_privacy_diagnostic.py",
    "scripts/privacy_fail_closed.py",
    "data/evaluation/part2_advanced_held_out.jsonl",
    "data/evaluation/e2_held_out_contract.jsonl",
    "data/evaluation/e3_targeted_safety_heldout.jsonl",
    "data/evaluation/e3b_patient_interview_held_out.jsonl",
)


def source_payload(upload: Path, mode: str) -> tuple[str, str]:
    source_zip = upload / f"ai-upchar-llm-v16-structured-{mode}.zip"
    paths = [ROOT / relative for relative in SOURCE_FILES]
    missing = [str(path) for path in paths if not path.is_file()]
    if missing:
        raise FileNotFoundError(missing)
    with zipfile.ZipFile(source_zip, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in paths:
            archive.write(path, Path("ai-upchar-llm", path.relative_to(ROOT)).as_posix())
    data = source_zip.read_bytes()
    return base64.b64encode(data).decode("ascii"), hashlib.sha256(data).hexdigest()


def notebook_code(payload: str, source_sha256: str, mode: str) -> str:
    settings = MODES[mode]
    checkpoint_argument = (
        ', "--checkpoint", "/kaggle/working/part2_v16_structured_full_checkpoint.json"'
        if mode == "full"
        else ""
    )
    template = r"""import base64, hashlib, json, os, subprocess, sys, zipfile
from pathlib import Path

source_zip = Path("/kaggle/temp/ai-upchar-llm-v16-structured-__MODE__.zip")
source_zip.parent.mkdir(parents=True, exist_ok=True)
source_zip.write_bytes(base64.b64decode("__PAYLOAD__"))
assert hashlib.sha256(source_zip.read_bytes()).hexdigest() == "__SOURCE_SHA256__"
subprocess.run([sys.executable, "-m", "pip", "install", "-q", __DEPENDENCIES__], check=True)

project_root = Path("/kaggle/temp/v16-structured-__MODE__")
project_root.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(source_zip) as archive:
    archive.extractall(project_root)
project = project_root / "ai-upchar-llm"
os.chdir(project)
sys.path.insert(0, str(project))
sys.path.insert(0, str(project / "src"))
sys.path.insert(0, str(project / "scripts"))
os.environ["HF_HOME"] = "/kaggle/temp/hf-cache"
os.environ["CUDA_VISIBLE_DEVICES"] = "0"

required = ("adapter_config.json", "adapter_model.safetensors", "tokenizer_config.json")
manifests = [
    path for path in Path("/kaggle/input").rglob("part2_v16_manifest.json")
    if all((path.parent / name).is_file() for name in required)
]
assert len(manifests) == 1, [str(path) for path in manifests]
adapter = manifests[0].parent
manifest = json.loads(manifests[0].read_text(encoding="utf-8"))
assert manifest["artifact_sha256"] == "__ADAPTER_SHA256__"
process = subprocess.run([
    sys.executable,
    "__SCRIPT__",
    "--adapter", str(adapter),
    "--output", "/kaggle/working/__REPORT__"__CHECKPOINT_ARGUMENT__
], text=True, capture_output=True)
Path("/kaggle/working/part2_v16_structured___MODE___stdout.txt").write_text(
    process.stdout + "\n" + process.stderr, encoding="utf-8"
)
report_path = Path("/kaggle/working/__REPORT__")
assert report_path.is_file(), process.stderr
report = json.loads(report_path.read_text(encoding="utf-8"))
summary = {
    "evaluator_returncode": process.returncode,
    "report_status": report["status"],
    "source_zip_sha256": "__SOURCE_SHA256__",
    "adapter_sha256": "__ADAPTER_SHA256__",
    "adapter_path": str(adapter),
    "structured_decoding": "__STRUCTURED_DECODING__",
}
Path("/kaggle/working/part2_v16_structured___MODE___kernel_summary.json").write_text(
    json.dumps(summary, indent=2), encoding="utf-8"
)
print(json.dumps(summary, indent=2))
if process.returncode != 0:
    raise SystemExit(process.returncode)
"""
    replacements = {
        "__MODE__": mode,
        "__PAYLOAD__": payload,
        "__SOURCE_SHA256__": source_sha256,
        "__DEPENDENCIES__": ", ".join(repr(item) for item in DEPENDENCIES),
        "__ADAPTER_SHA256__": EXPECTED_ADAPTER_SHA256,
        "__STRUCTURED_DECODING__": STRUCTURED_DECODING,
        "__SCRIPT__": settings["script"],
        "__REPORT__": settings["report"],
        "__CHECKPOINT_ARGUMENT__": checkpoint_argument,
    }
    for old, new in replacements.items():
        template = template.replace(old, new)
    return template


def build(mode: str) -> dict[str, str]:
    if mode not in MODES:
        raise ValueError(f"Unsupported mode: {mode}")
    slug = (
        "yatricabs/ai-upchar-part2-v16-e20-privacy-diagnostic"
        if mode == "privacy"
        else f"yatricabs/ai-upchar-part2-v16-structured-{mode}"
    )
    if mode not in {"diagnostic", "privacy"}:
        slug += "-validation"
    upload = UPLOAD_ROOT / f"part2-v16-structured-{mode}-kernel"
    upload.mkdir(parents=True, exist_ok=True)
    payload, source_sha256 = source_payload(upload, mode)
    code = notebook_code(payload, source_sha256, mode)
    notebook_name = f"Part2_V16_Structured_{mode.title()}.ipynb"
    notebook = {
        "cells": [
            {
                "id": f"part2-v16-structured-{mode}",
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
    metadata = {
        "id": slug,
        "title": MODES[mode]["title"],
        "code_file": notebook_name,
        "language": "python",
        "kernel_type": "notebook",
        "is_private": True,
        "enable_gpu": True,
        "enable_internet": True,
        "dataset_sources": [ADAPTER_DATASET],
    }
    (upload / "kernel-metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    compile(code, notebook_name, "exec")
    return {
        "mode": mode,
        "slug": slug,
        "upload": str(upload),
        "source_sha256": source_sha256,
        "source_files": list(SOURCE_FILES),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=tuple(MODES))
    args = parser.parse_args()
    print(json.dumps(build(args.mode), indent=2))


if __name__ == "__main__":
    main()
