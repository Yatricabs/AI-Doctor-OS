import argparse
import json
from ai_upchar_llm.evaluation.benchmark import load_benchmark, run_benchmark
from ai_upchar_llm.inference.model import SmokeAdapter

parser = argparse.ArgumentParser()
parser.add_argument("--dataset", default="data/evaluation/smoke.jsonl")
parser.add_argument("--adapter", required=True)
args = parser.parse_args()
adapter = SmokeAdapter(args.adapter)
result = run_benchmark(
    load_benchmark(args.dataset), lambda text: adapter.generate({"current_answer": text})
)
print(json.dumps(result, ensure_ascii=False, indent=2))
raise SystemExit(0 if result["passed"] == result["total"] else 1)
