import json
import os
import platform
from datetime import datetime, timezone
from pathlib import Path

from ai_upchar_llm.datasets.sft_dataset import load_sft


def run_smoke_training(config: dict) -> dict:
    """Contract smoke backend; it never claims clinical/model capability."""
    examples = load_sft(config["data"]["sft_path"])
    tokens = sorted(
        {
            word.lower().strip(".,?!")
            for item in examples
            for msg in item.messages
            for word in msg["content"].split()
        }
    )
    artifact = Path(config["training"]["output_dir"]) / "smoke-adapter"
    artifact.mkdir(parents=True, exist_ok=True)
    manifest = {
        "artifact_type": "CONTRACT_SMOKE_ADAPTER",
        "adapter_status": "SMOKE_ONLY",
        "clinically_capable": False,
        "base_model": config["model"]["name"],
        "dataset_version": config["project"]["dataset_version"],
        "config_version": config["project"]["model_version"],
        "evaluation_version": config["project"]["evaluation_version"],
        "code_commit": os.environ.get("CODE_COMMIT", "WORKTREE_SMOKE"),
        "training_date": datetime.now(timezone.utc).isoformat(),
        "training_method": "synthetic-smoke",
        "experiment_id": f"smoke-{config['project']['model_version']}",
        "hyperparameters": config["training"],
        "gpu_configuration": "none-contract-smoke",
        "runtime": platform.python_version(),
        "training_tokens": len(tokens),
        "duration_seconds": 0,
        "token_count": len(tokens),
        "examples": len(examples),
    }
    (artifact / "adapter_config.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (artifact / "tokenizer.json").write_text(
        json.dumps({"vocabulary": tokens}, ensure_ascii=False), encoding="utf-8"
    )
    return {"status": "smoke_passed", "artifact": str(artifact), **manifest}
