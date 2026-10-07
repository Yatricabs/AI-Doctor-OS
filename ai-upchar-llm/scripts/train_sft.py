import argparse
import json
from ai_upchar_llm.config import load_config
from ai_upchar_llm.training.sft import train_sft

parser = argparse.ArgumentParser()
parser.add_argument("--config", default="configs/qwen3-4b.yaml")
parser.add_argument("--smoke", action="store_true")
args = parser.parse_args()
print(json.dumps(train_sft(load_config(args.config), smoke=args.smoke), indent=2))
