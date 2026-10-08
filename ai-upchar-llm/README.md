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

## Current E2/E3 progress

The latest Phase 4A E2 status, repeated-JSON root-cause evidence, corrected-E2
training path, Kaggle notebook/dataset inventory, and remaining pipeline gates
are tracked in:

- [`docs/E2_E3_PROGRESS_AND_PIPELINE.md`](docs/E2_E3_PROGRESS_AND_PIPELINE.md)

## Local workspace/artifact organization

The primary local working clone is `D:\Github Repo\Cursor\AI Doctor OS`.
Large local artifacts are organized under the Git-ignored
`local-artifacts/` folder in that repo. See:

- [`docs/LOCAL_ARTIFACTS_AND_WORKSPACE.md`](docs/LOCAL_ARTIFACTS_AND_WORKSPACE.md)

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

## Reproducible local validation

The repository contains the evaluation code and frozen E2/E3 contracts. The
approved E3B and Part 2 train/held-out JSONL packages are kept outside Git.
Tests that require those packages report an explicit skip when the files are
absent; their frozen count, ID, and safety assertions still run when the files
are present. A green clean-checkout test run with skips is not a full clinical
validation result.

From this directory, run `python -m pytest tests -q -rs`. To exercise the
structured grammar locally, install `lm-format-enforcer==0.11.3` in a CPU test
environment and rerun `tests/test_structured_json_generation.py`. The offline
Qwen tokenizer integration test also requires the local tokenizer
artifact. Its CPU replay uses the recorded answer tokens, not the full Qwen
vocabulary. Full model generation and cloud validation are separate gates; no
GPU is required for these local tests.
