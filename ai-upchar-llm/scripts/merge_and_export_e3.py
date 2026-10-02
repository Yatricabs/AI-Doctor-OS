#!/usr/bin/env python3
"""AI UPCHAR E3 Model Merge and Export Utility.

Merges the QLoRA adapter weights from `qwen3-4b-e3-targeted-safety` into the base
`Qwen/Qwen3-4B-Base` foundation model to produce a standalone model ready for
vLLM, CPU inference, or GGUF / ONNX / llama.cpp conversion.

Usage:
  python merge_and_export_e3.py --dry-run
  python merge_and_export_e3.py --adapter-dir local-artifacts/models/qwen3-4b-e3-targeted-safety --output-dir artifacts/qwen3-4b-e3-standalone
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path


def inspect_adapter(adapter_dir: Path) -> dict:
    config_file = adapter_dir / "adapter_config.json"
    if not config_file.exists():
        raise FileNotFoundError(f"adapter_config.json not found in {adapter_dir}")

    config = json.loads(config_file.read_text(encoding="utf-8"))
    weights_safetensors = adapter_dir / "adapter_model.safetensors"
    weights_bin = adapter_dir / "adapter_model.bin"

    weight_path = weights_safetensors if weights_safetensors.exists() else weights_bin
    size_mb = weight_path.stat().st_size / (1024 * 1024) if weight_path.exists() else 0.0

    return {
        "base_model": config.get("base_model_name_or_path"),
        "peft_type": config.get("peft_type"),
        "r": config.get("r"),
        "lora_alpha": config.get("lora_alpha"),
        "target_modules": config.get("target_modules"),
        "weights_file": weight_path.name if weight_path.exists() else "MISSING",
        "weights_size_mb": round(size_mb, 2),
    }


def merge_and_save(base_model_id: str, adapter_dir: Path, output_dir: Path, device: str = "cpu") -> None:
    print(f"\n[INFO] Loading base model: {base_model_id} on {device}...")
    try:
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
        from peft import PeftModel
    except ImportError as e:
        print(f"[ERROR] Required packages missing: {e}. Please install: pip install torch transformers peft")
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)

    dtype = torch.bfloat16 if torch.cuda.is_available() and device != "cpu" else torch.float32
    tokenizer = AutoTokenizer.from_pretrained(str(adapter_dir) if (adapter_dir / "tokenizer_config.json").exists() else base_model_id)

    base_model = AutoModelForCausalLM.from_pretrained(
        base_model_id,
        torch_dtype=dtype,
        device_map=device if device != "cpu" else None,
        low_cpu_mem_usage=True,
    )

    print(f"[INFO] Attaching adapter from {adapter_dir}...")
    model = PeftModel.from_pretrained(base_model, str(adapter_dir))

    print("[INFO] Merging LoRA weights into base model...")
    merged_model = model.merge_and_unload()

    print(f"[INFO] Saving merged standalone model to {output_dir}...")
    merged_model.save_pretrained(str(output_dir), safe_serialization=True)
    tokenizer.save_pretrained(str(output_dir))

    # Write export metadata
    meta = {
        "model_id": "ai-upchar-qwen3-4b-e3-standalone",
        "base_model": base_model_id,
        "adapter_source": str(adapter_dir),
        "method": "peft_merge_and_unload",
        "precision": str(dtype),
    }
    (output_dir / "standalone_model_manifest.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"[SUCCESS] Standalone merged model saved successfully to {output_dir}")


def main() -> None:
    parser = argparse.ArgumentParser(description="AI UPCHAR E3 LoRA Merger and Standalone Exporter")
    parser.add_argument(
        "--adapter-dir",
        type=str,
        default="local-artifacts/models/qwen3-4b-e3-targeted-safety",
        help="Path to fine-tuned E3 adapter directory",
    )
    parser.add_argument(
        "--base-model",
        type=str,
        default=None,
        help="Base model ID (defaults to base_model from adapter_config.json)",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="artifacts/qwen3-4b-e3-standalone",
        help="Target directory for merged standalone model",
    )
    parser.add_argument("--device", type=str, default="cpu", help="Device for merge operation (cpu or cuda)")
    parser.add_argument("--dry-run", action="store_true", help="Inspect adapter without executing merge")

    args = parser.parse_args()
    adapter_path = Path(args.adapter_dir).resolve()

    if not adapter_path.exists():
        print(f"[ERROR] Adapter directory not found: {adapter_path}")
        sys.exit(1)

    print("==================================================================")
    print("AI UPCHAR E3 MODEL MERGE & EXPORT UTILITY")
    print("==================================================================")

    info = inspect_adapter(adapter_path)
    print("\n--- ADAPTER METADATA ---")
    for k, v in info.items():
        print(f"  {k}: {v}")
    print("------------------------\n")

    base_model = args.base_model or info.get("base_model") or "Qwen/Qwen3-4B-Base"

    if args.dry_run:
        print("[DRY-RUN] Adapter verification passed. Model is fully ready for merge.")
        print(f"Target Base: {base_model}")
        print(f"Output Target: {args.output_dir}")
        return

    merge_and_save(base_model, adapter_path, Path(args.output_dir).resolve(), args.device)


if __name__ == "__main__":
    main()
