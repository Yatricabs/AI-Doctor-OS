# AI UPCHAR proprietary LLM workspace

Independent Python workspace for healthcare domain adaptation, QLoRA/SFT,
evaluation, and private inference. It does not modify or directly control the
AI-Doctor-OS interview state machine.

## Models and strategy

Default: `Qwen/Qwen3-8B-Base`; economical experiments:
`Qwen/Qwen3-4B-Base`. YAML controls the model and every training hyperparameter.
The first production path is 4-bit QLoRA SFT; full continued pretraining is
available only after corpus and GPU approval. Preference/DPO is intentionally a
future stage.

## Local contract smoke test

Use Python 3.11-3.13:

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install PyYAML==6.0.3 pytest==9.0.1
$env:PYTHONPATH="src"
.venv\Scripts\python -m pytest
.venv\Scripts\python scripts/validate_dataset.py data/sft/smoke.jsonl
.venv\Scripts\python scripts/train_sft.py --config configs/qwen3-4b.yaml --smoke
.venv\Scripts\python scripts/evaluate.py --adapter artifacts/ai-upchar-med-qwen3-4b-v0.1.0/smoke-adapter
```

The contract smoke backend exercises dataset -> tokenizer vocabulary -> model
contract -> synthetic adapter save/load -> inference -> evaluation without
downloading Qwen. It is explicitly **not clinically capable** and is not a
substitute for a CUDA QLoRA run.

Install the real stack with `pip install -e ".[cuda,serve,dev]"` in a supported
Linux/CUDA environment. Run `scripts/serve.py --vllm` for the private vLLM
worker and `scripts/serve.py` for the `/v1/clinical/reason` gateway. Both bind
to `127.0.0.1`; expose only the gateway through application authentication.

Large training, push, and deployment are never performed by the smoke commands.
