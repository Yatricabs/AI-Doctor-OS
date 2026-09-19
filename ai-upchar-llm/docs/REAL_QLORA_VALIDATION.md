# Real Qwen QLoRA validation

Run `python scripts/check_training_environment.py` first. Exit code `0` means
the strict real-training prerequisites passed; exit code `2` means blocked.
The command reports `training_mode: REAL_QWEN_QLORA` and never invokes the
contract smoke backend.

Use Python 3.11-3.13 in a separate virtual environment. Install the pinned
project with CUDA extras, set optional `HF_HOME` / `TRANSFORMERS_CACHE`, then:

```powershell
$env:PYTHONPATH="src"
python scripts/validate_dataset.py data/sft/real_validation_synthetic.jsonl
python scripts/validate_real_qlora.py --config configs/qwen3-4b-real-validation.yaml
```

The validation runner refuses to continue when preflight fails. On a passing
host it loads `Qwen/Qwen3-4B-Base`, applies NF4 4-bit quantization and PEFT LoRA,
runs two configured SFT steps, saves/reloads the adapter, generates output,
parses the clinical contract, and writes `training_metadata.json`.

Minimum validation target: a modern NVIDIA CUDA environment with at least 8 GiB
VRAM and adequate system RAM/disk; 12+ GiB VRAM and 16+ GiB RAM are recommended.
Actual needs vary with kernels, sequence length, driver, and package versions.
Tokens must be provided only through environment/tooling and must never be
printed or committed.

## Current host result (2026-09-19)

Blocked: Windows 10, Python 3.14.7, GTX 1650 4 GiB, driver-reported CUDA 11.5,
7.42 GiB system RAM, no installed real ML packages, and no PyTorch CUDA runtime.
No model download, quantization, training, adapter, or real inference occurred.

## Two separate validation gates

The validation now reports two independent gates so genuine infrastructure
evidence is not lost when post-training behavior is not yet learned:

- **Gate A — `REAL_QWEN_QLORA_INFRASTRUCTURE`**: model downloaded/loaded, NF4
  4-bit initialized, LoRA adapter attached, real training steps > 0, training
  metrics produced, adapter saved, adapter reloaded, evaluation completed, real
  inference executed.
- **Gate B — `REAL_QWEN_QLORA_BEHAVIORAL_CONTRACT`**: the generated text is
  genuine AI UPCHAR contract JSON (parses as a JSON object and carries the
  required contract keys). Gate B is strict: it never accepts partial/truncated
  JSON, never strips arbitrary prose, and never converts malformed output into
  success. A single clean ```json fence may be unwrapped (formatting only).

`overall_status` is `SUCCESS` only when BOTH gates pass. Gate A `SUCCESS` with
Gate B `NOT_VALIDATED` is an honest, expected intermediate state. Runner exit
codes: `1` = Gate A failed, `3` = Gate A success but Gate B not validated,
`0` = both gates success.

## Kaggle run evidence (real, recorded)

A real run on Kaggle GPU demonstrated Gate A end-to-end:

- Base model: `Qwen/Qwen3-4B-Base` downloaded successfully (3 checkpoint shards loaded)
- NF4 4-bit quantization initialized
- LoRA adapter attached
- Data: 4 train + 2 eval examples tokenized
- Real training: 2/2 steps completed
- Training metrics: step 1 loss = 4.1505, step 2 loss = 3.105, train_loss = 3.627749
- Evaluation completed
- Adapter saved and reloaded
- Real inference executed (non-empty generation)

**Gate A: SUCCESS.**

Behavioral result on the same run:

- The generation began with prose ("The clinical reasoning JSON contract ... can
  be structured as follows:") followed by a ```json fence and an unrelated,
  invented schema (`patient/name/age/gender/...`), and was truncated by the
  128-token generation budget before any closing brace.
- Therefore the output is not valid AI UPCHAR contract JSON.

**Gate B: NOT_VALIDATED** — reason: prose/markdown preamble plus truncation
before a closing brace. This is a behavioral validation failure, not an
infrastructure failure.

Note: `Qwen/Qwen3-4B-Base` is a base (non-instruct) model, and 2 training steps
on 4 examples are not sufficient to teach the strict JSON contract. Making Gate B
pass reliably requires a separate decision (more steps/examples, constrained
generation, or an instruct base) and is intentionally out of scope for this
2-step infrastructure validation.

## Completed Kaggle validation (verified)

This is the verified result of the completed Kaggle real QLoRA validation. It
supersedes the preliminary run above for the environment details and the Gate B
reason, while confirming the same Gate A / Gate B / overall separation.

### Environment

- Python 3.12.13
- PyTorch 2.9.1+cu128
- CUDA available
- 2x Tesla T4
- 15,360 MiB VRAM each
- bitsandbytes 0.48.2
- transformers 4.57.3
- peft 0.18.0
- trl 0.25.1
- datasets 4.4.1
- Qwen/Qwen3-4B-Base

### Gate A — `REAL_QWEN_QLORA_INFRASTRUCTURE` = SUCCESS

Evidence:

- Qwen3-4B-Base downloaded and loaded
- 4-bit NF4 model initialization succeeded
- LoRA adapter attached
- 2 real training steps completed
- training metrics recorded
- evaluation completed
- adapter saved
- saved adapter reloaded successfully
- real inference executed

### Gate B — `REAL_QWEN_QLORA_BEHAVIORAL_CONTRACT` = NOT_VALIDATED

Latest observed result:

- valid: false
- reason: no_json_object_present

The generated output repeated the user text and did not produce a valid AI
UPCHAR contract JSON.

### Overall = PARTIAL

Preserve this distinction explicitly:

- Gate A proves the real QLoRA infrastructure/training pipeline works on the
  Kaggle T4 environment.
- Gate B has NOT been validated.
- Therefore Phase 4A must NOT be described as fully behaviorally validated or
  production-ready.

The validation still uses only 2 training steps and a very small synthetic
dataset, so behavioral quality and generalization have not been established.
This remains an infrastructure-validated milestone, not a behavioral or
production sign-off.
