import argparse
import os
import subprocess
from ai_upchar_llm.inference.server import vllm_command

parser = argparse.ArgumentParser(); parser.add_argument("--vllm", action="store_true", help="Start the private OpenAI-compatible vLLM worker")
args = parser.parse_args()
command = vllm_command() if args.vllm else ["uvicorn", "ai_upchar_llm.inference.server:create_app", "--factory", "--host", "127.0.0.1", "--port", os.environ.get("PORT", "8001")]
raise SystemExit(subprocess.call(command))
