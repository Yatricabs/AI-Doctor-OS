from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys

from ai_upchar_llm.config import load_config
from ai_upchar_llm.training.real_qlora import run_real_qlora_validation

parser = argparse.ArgumentParser()
parser.add_argument("--config", default="configs/qwen3-4b-real-validation.yaml")
args = parser.parse_args()
diagnostic = subprocess.run([sys.executable, "scripts/check_training_environment.py"], check=False)
if diagnostic.returncode:
    print(
        json.dumps(
            {
                "training_mode": "REAL_QWEN_QLORA",
                "status": "BLOCKED",
                "reason": "Environment preflight failed; smoke fallback is forbidden.",
            },
            indent=2,
        )
    )
    raise SystemExit(diagnostic.returncode)
config = load_config(args.config)
config["model"]["name"] = os.environ.get("MODEL_NAME", config["model"]["name"])
result = run_real_qlora_validation(config)
print(json.dumps(result, indent=2))

# Exit-code semantics separate the two gates:
#   Gate A (infrastructure) FAILED           -> exit 1 (real failure)
#   Gate A SUCCESS, Gate B NOT_VALIDATED     -> exit 3 (infra proven, behavior not yet validated)
#   Both gates SUCCESS                        -> exit 0
gate_a = result.get("gate_a_infrastructure", {}).get("status")
gate_b = result.get("gate_b_behavioral_contract", {}).get("status")
if gate_a != "SUCCESS":
    raise SystemExit(1)
if gate_b != "SUCCESS":
    raise SystemExit(3)
raise SystemExit(0)
