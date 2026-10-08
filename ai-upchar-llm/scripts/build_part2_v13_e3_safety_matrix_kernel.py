from __future__ import annotations

import json
from pathlib import Path

from build_part2_v13_validation_kernels import ADAPTER_DATASET, source_payload


ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parent
UPLOAD = WORKSPACE / "local-artifacts/kaggle/uploads/part2-v13-e3-safety-matrix"


def main() -> None:
    UPLOAD.mkdir(parents=True, exist_ok=True)
    payload, source_sha256 = source_payload(UPLOAD)
    code = r"""import base64, hashlib, os, subprocess, sys, zipfile
from pathlib import Path

source_zip = Path("/kaggle/temp/ai-upchar-llm-v13-validation.zip")
source_zip.parent.mkdir(parents=True, exist_ok=True)
source_zip.write_bytes(base64.b64decode("__PAYLOAD__"))
assert hashlib.sha256(source_zip.read_bytes()).hexdigest() == "__SOURCE_SHA256__"
subprocess.run([sys.executable, "-m", "pip", "install", "-q", "transformers==4.57.3", "peft==0.18.0", "accelerate==1.12.0", "bitsandbytes==0.48.2"], check=True)

project_root = Path("/kaggle/temp/v13-e3-safety-matrix")
project_root.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(source_zip) as archive:
    archive.extractall(project_root)
project = project_root / "ai-upchar-llm"
os.chdir(project)
sys.path.insert(0, str(project))
sys.path.insert(0, str(project / "src"))
sys.path.insert(0, str(project / "scripts"))
from scripts.build_part2_v13_validation_kernels import select_adapter_dir
adapter = select_adapter_dir(Path("/kaggle/input"))
subprocess.run([
    sys.executable,
    "scripts/diagnose_part2_v13_e3_safety.py",
    "--adapter", str(adapter),
    "--all-e3",
    "--output", "/kaggle/working/part2_v13_e3_safety_matrix.json",
], check=True)
""".replace("__PAYLOAD__", payload).replace("__SOURCE_SHA256__", source_sha256)

    notebook_name = "Part2_V13_E3_Safety_Matrix.ipynb"
    notebook = {
        "cells": [
            {
                "id": "part2-v13-e3-safety-matrix",
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
    (UPLOAD / notebook_name).write_text(json.dumps(notebook, indent=2), encoding="utf-8")
    metadata = {
        "id": "yatricabs/ai-upchar-part2-v13-e3-safety-matrix",
        "title": "AI UPCHAR Part2 V13 E3 Safety Matrix",
        "code_file": notebook_name,
        "language": "python",
        "kernel_type": "notebook",
        "is_private": True,
        "enable_gpu": True,
        "enable_internet": True,
        "dataset_sources": [ADAPTER_DATASET],
    }
    (UPLOAD / "kernel-metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    compile(code, notebook_name, "exec")
    print(json.dumps({"source_sha256": source_sha256, "metadata": metadata}, indent=2))


if __name__ == "__main__":
    main()
