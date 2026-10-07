from __future__ import annotations

import importlib
import importlib.util
import json
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

PACKAGES = ["torch", "transformers", "peft", "bitsandbytes", "trl", "datasets"]


def command(args: list[str]) -> str | None:
    try:
        return subprocess.check_output(
            args, text=True, stderr=subprocess.STDOUT, timeout=15
        ).strip()
    except Exception:
        return None


def package_report(name: str) -> dict:
    try:
        module = importlib.import_module(name)
        return {
            "installed": True,
            "version": getattr(module, "__version__", "unknown"),
            "import_ok": True,
            "error": None,
        }
    except Exception as error:
        return {
            "installed": importlib.util.find_spec(name) is not None,
            "version": None,
            "import_ok": False,
            "error": f"{type(error).__name__}: {error}",
        }


def gpu_report() -> dict:
    query = command(
        [
            "nvidia-smi",
            "--query-gpu=name,memory.total,memory.free,driver_version",
            "--format=csv,noheader,nounits",
        ]
    )
    if not query:
        return {"nvidia_smi": False, "gpus": []}
    gpus = []
    for line in query.splitlines():
        name, total, free, driver = [item.strip() for item in line.split(",", 3)]
        gpus.append(
            {
                "name": name,
                "vram_total_mib": int(total),
                "vram_free_mib": int(free),
                "driver_version": driver,
            }
        )
    return {
        "nvidia_smi": True,
        "reported_cuda_version": (command(["nvidia-smi"]) or "")
        .split("CUDA Version:")[-1]
        .split()[0]
        if "CUDA Version:" in (command(["nvidia-smi"]) or "")
        else None,
        "gpus": gpus,
    }


def memory_report() -> dict:
    if platform.system() == "Windows":
        value = command(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory",
            ]
        )
        total = int(value) if value and value.isdigit() else None
    else:
        total = (
            os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES")
            if hasattr(os, "sysconf")
            else None
        )
    return {"total_bytes": total, "total_gib": round(total / 2**30, 2) if total else None}


def main() -> int:
    packages = {name: package_report(name) for name in PACKAGES}
    gpu = gpu_report()
    torch_cuda = {"available": False, "runtime_version": None, "device_count": 0, "error": None}
    if packages["torch"]["import_ok"]:
        try:
            import torch

            torch_cuda = {
                "available": torch.cuda.is_available(),
                "runtime_version": torch.version.cuda,
                "device_count": torch.cuda.device_count(),
                "error": None,
            }
        except Exception as error:
            torch_cuda["error"] = f"{type(error).__name__}: {error}"
    blockers = []
    if not (sys.version_info >= (3, 11) and sys.version_info < (3, 14)):
        blockers.append("PYTHON_INCOMPATIBLE: use Python 3.11-3.13 for the pinned vLLM/QLoRA stack")
    missing = [name for name, value in packages.items() if not value["import_ok"]]
    if missing:
        blockers.append(f"REAL_ML_PACKAGES_MISSING: {', '.join(missing)}")
    if not torch_cuda["available"]:
        blockers.append("PYTORCH_CUDA_UNAVAILABLE")
    if not gpu["gpus"]:
        blockers.append("NVIDIA_GPU_UNAVAILABLE")
    elif max(item["vram_total_mib"] for item in gpu["gpus"]) < 8192:
        blockers.append(
            "INSUFFICIENT_VRAM_FOR_QWEN3_4B_QLORA: minimum validation target is 8 GiB, 12+ GiB recommended"
        )
    report = {
        "training_mode": "REAL_QWEN_QLORA",
        "ready": not blockers,
        "os": {
            "system": platform.system(),
            "release": platform.release(),
            "version": platform.version(),
        },
        "python": {"version": platform.python_version(), "executable": sys.executable},
        "cuda": torch_cuda,
        "nvidia": gpu,
        "system_ram": memory_report(),
        "disk": {
            str(Path.cwd().anchor): {
                "total_gib": round(shutil.disk_usage(Path.cwd()).total / 2**30, 2),
                "free_gib": round(shutil.disk_usage(Path.cwd()).free / 2**30, 2),
            }
        },
        "packages": packages,
        "cache": {
            "model_name": os.environ.get("MODEL_NAME", "Qwen/Qwen3-4B-Base"),
            "hf_home": os.environ.get("HF_HOME"),
            "transformers_cache": os.environ.get("TRANSFORMERS_CACHE"),
        },
        "blockers": blockers,
    }
    print(json.dumps(report, indent=2))
    return 0 if report["ready"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
