import argparse
import json
from ai_upchar_llm.data.validation import validate_dataset

parser = argparse.ArgumentParser()
parser.add_argument("path")
args = parser.parse_args()
print(json.dumps(validate_dataset(args.path), indent=2))
