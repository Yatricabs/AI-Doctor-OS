import argparse
import json
from ai_upchar_llm.config import load_config
from ai_upchar_llm.training.domain_adaptation import build_domain_training_args

parser = argparse.ArgumentParser()
parser.add_argument("--config", default="configs/qwen3-8b.yaml")
args = parser.parse_args()
print(
    json.dumps(
        {
            "status": "PLAN_ONLY_NO_LARGE_TRAINING_STARTED",
            **build_domain_training_args(load_config(args.config)),
        },
        indent=2,
    )
)
