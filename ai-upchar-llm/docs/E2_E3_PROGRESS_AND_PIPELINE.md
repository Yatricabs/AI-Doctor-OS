# AI UPCHAR LLM E2/E3 progress and next pipeline

**Last updated:** 2026-10-02 (Post-E3 Prep & Local E2 Audit)  
**Scope:** Phase 4A E2 QLoRA recovery, repeated-JSON diagnosis, corrected-E2 path, and E3 setup state.

This document records what has been completed so far, what is known from
evidence, what remains unconfirmed, and the next safe pipeline steps. It is an
engineering status document, not a clinical-readiness sign-off.

## Current headline status

| Area | Status | Notes |
| --- | --- | --- |
| Original E2 QLoRA training | Complete | 138/138 steps completed on Kaggle. |
| Original E2 artifact persistence | Safe | Adapter/checkpoints recovered locally and uploaded as a private Kaggle Dataset. |
| Original E2 held-out behavior | Failed strict full JSON parsing | All six held-out cases produced a valid first JSON object followed by repeated JSON/trailing content. |
| Root-cause investigation | Strongly supported | Repetition is adapter/training-induced EOS suppression, not missing data, missing adapter, or missing `<\|im_end\|>` labels. |
| Minimal correction | Implemented locally | `training.append_assistant_eos: true` with corrected output directory `artifacts/qwen3-4b-e2-corrected`. |
| Corrected E2 Kaggle notebook | Complete & Verified | Recovered locally at `D:\Github Repo\AIUPCHAR\models\qwen3-4b-e2-corrected` (66MB adapter, checkpoints 46/92/138, manifest SHA256 verified). |
| E3 source packaging | Resolved | Uploaded `yatricabs/ai-upchar-e3-targeted-safety-source` containing `ai-upchar-llm.tar.gz` + `kagglehub` fallback added. |
| E3 targeted safety setup | Ready for relaunch | Branch `feature/e3-targeted-clinical-safety` authored; 24 train + 12 heldout cases; config (36 steps, assistant-EOS); Gates A/B/C harness ready. |

## Completed work

### 1. Kaggle and artifact recovery

- Kaggle CLI/API authentication and notebook access were verified earlier.
- The original production E2 notebook was inspected and pulled read-only.
- The original E2 138/138 training run completed on Kaggle.
- Required E2 outputs were persisted and recovered:
  - `adapter_model.safetensors`
  - `adapter_config.json`
  - `checkpoint-46`
  - `checkpoint-92`
  - `checkpoint-138`
  - tokenizer/config files
- Golden local archive:
  - `D:\Github Repo\AIUPCHAR\e2_qwen3_4b_validation_outputs\qwen3-4b-e2-qlora-validation-artifacts.tar.gz`
- Golden archive SHA256:
  - `99E4020CCBDAFE58B60D163A1CD310E81EE6DABE85AEBCEBC98E876A45C707C6`
- Private Kaggle Dataset created:
  - `yatricabs/ai-upchar-e2-qlora-validation-artifacts`

### 2. Raw-output diagnosis

The frozen evaluator initially reported:

```text
Total: 6
Valid: 0
Invalid: 6
JSONDecodeError: Extra data
```

Raw generation diagnostics showed the underlying model output was not random
schema failure. Each held-out case began with a valid JSON object, then produced
additional repeated JSON/trailing content until the generation limit. The strict
parser therefore failed with `Extra data`.

### 3. Inference-only support assets

Private Kaggle support datasets were created for inference diagnostics:

- `yatricabs/ai-upchar-e2-inference-support`
  - `e2_held_out_contract.jsonl`
  - `evaluate_e2_held_out.py`
- `yatricabs/ai-upchar-e2-inference-package`
  - exact `ai_upchar_llm` Python package snapshot for Kaggle runtime imports

The separate inference notebook:

- `yatricabs/ai-upchar-e2-inference-diagnostic`

successfully loaded:

- `Qwen/Qwen3-4B-Base`
- the recovered E2 adapter
- the six held-out examples
- the authoritative evaluator/prompt path

### 4. Termination and label audits

The following hypotheses were tested and ruled out:

- The recovered adapter was missing: ruled out.
- The held-out evaluator was using the wrong cases: ruled out.
- `<|im_end|>` was absent from rendered training sequences: ruled out.
- `<|im_end|>` was masked from the actual runtime labels: ruled out.
- The E2 training data contained duplicated assistant JSON, trailing text, or
  assistant-to-assistant continuation: ruled out.

Evidence:

- `<|im_end|>` token id: `151645`
- Runtime TRL preprocessing verified, for representative examples:
  - `input_id = 151645`
  - `label = 151645`
  - `label != -100`
- All 122 E2 training examples were structurally clean:
  - single assistant JSON response
  - no duplicated JSON object inside the assistant message
  - no trailing assistant text after JSON
  - no assistant-to-assistant continuation

### 5. Base vs adapter diagnosis

Controlled diagnostic on `e2-ho--001` showed:

| Condition | Generated tokens | Full JSON valid | Repeated JSON | Trailing content | `<\|im_end\|>` generated |
| --- | ---: | --- | --- | --- | --- |
| Base `Qwen/Qwen3-4B-Base` | 97 | Yes | No | No | No |
| Old E2 adapter | 128 | No | Yes | Yes | No |

Conclusion: the repetition behavior is adapter/training-induced, not baseline
Qwen3 behavior for the same prompt.

### 6. Checkpoint and logit analysis

Checkpoint progression showed:

| Model/checkpoint | Behavior |
| --- | --- |
| Base model | Clean one-object JSON termination |
| `checkpoint-46` | Clean one-object JSON termination |
| `checkpoint-92` | Repeated JSON begins |
| `checkpoint-138` | Repeated JSON persists |
| Final old E2 adapter | Repeated JSON persists |

Logit/probability evidence after the first JSON showed strong EOS suppression:

| Model | EOS probability after first JSON |
| --- | ---: |
| Base model | ~0.9233 |
| Final old E2 adapter | ~0.0053 |

Supported root cause:

> E2 fine-tuning progressively suppressed the base model's natural end-of-response
> behavior after the first JSON object.

### 7. Minimal correction implemented locally

Files changed for the corrected E2 path:

- `src/ai_upchar_llm/training/real_qlora.py`
- `configs/qwen3-4b-e2-corrected.yaml`

The correction is opt-in:

```yaml
training:
  append_assistant_eos: true
  output_dir: artifacts/qwen3-4b-e2-corrected
```

The code copies training rows and appends the tokenizer EOS token to assistant
messages before chat-template rendering only when `append_assistant_eos` is
enabled. The original dataset remains unchanged.

CPU validation already passed for:

- Python compile of `real_qlora.py`
- corrected YAML parse
- helper idempotence/non-mutating behavior
- E2 training count = 122
- held-out count = 6

## Current Kaggle inventory snapshot

As of the latest read-only Kaggle check:

| Kaggle notebook | Status | Notes |
| --- | --- | --- |
| `yatricabs/ai-upchar-phase-4a-e2-qlora-training` | COMPLETE | Original E2 training notebook. |
| `yatricabs/ai-upchar-e2-inference-diagnostic` | COMPLETE | Used for E2 inference diagnostics. |
| `yatricabs/ai-upchar-e2-corrected-qlora-training` | COMPLETE | Training complete; corrected adapter & checkpoints recovered locally in `models/qwen3-4b-e2-corrected`. |
| `yatricabs/ai-upchar-e3-targeted-clinical-safety-training` | STANDBY | Version #2 prepared with dedicated dataset source `yatricabs/ai-upchar-e3-targeted-safety-source`; standing by for GPU execution. |

### Corrected E2 artifact recovery confirmation

The corrected training run and output persistence have been confirmed and recovered locally:

- **Local path:** `D:\Github Repo\AIUPCHAR\models\qwen3-4b-e2-corrected\`
  - `adapter_model.safetensors` (66,126,768 bytes)
  - `adapter_config.json`
  - `checkpoint-46/`, `checkpoint-92/`, `checkpoint-138/`
  - tokenizer and chat template files
- **Archive:** `D:\Github Repo\AIUPCHAR\kaggle-downloads\e2-corrected\extracted\qwen3-4b-e2-corrected-training-artifacts.tar.gz` (626,198,913 bytes)
- **Manifest:** `e2_corrected_persistence_manifest.json` with SHA256: `83d85fa773a8eaa22d3680bce5e12d77954c464308c66c2808c4327eea3fbc82`
- **Kaggle Dataset:** `yatricabs/ai-upchar-e2-corrected-qlora-artifacts`

With artifact persistence confirmed, the pending behavioral item is execution of the controlled single-case comparison (`e2-ho--001`) and the frozen six-case held-out evaluation.

## Current local repo snapshot

The primary local repo/workspace is:

```text
D:\Github Repo\Cursor\AI Doctor OS
```

Large recovered artifacts are organized under the Git-ignored local-only folder:

```text
D:\Github Repo\Cursor\AI Doctor OS\local-artifacts
```

See `LOCAL_ARTIFACTS_AND_WORKSPACE.md` for the full local folder map.

Important local E2 files:

- `ai-upchar-llm/src/ai_upchar_llm/training/real_qlora.py`
- `ai-upchar-llm/configs/qwen3-4b-e2-corrected.yaml`
- `ai-upchar-llm/artifacts/e2_checkpoint_logit_diagnostic_corrected.json`
- `ai-upchar-llm/artifacts/e2_checkpoint_logit_diagnostic_corrected.md`
- `ai-upchar-llm/artifacts/e2_minimal_correction_design.json`
- `ai-upchar-llm/artifacts/e2_minimal_correction_design.md`

Local corrected adapter was verified and recovered locally in the primary model repository:

```text
D:\Github Repo\Cursor\AI Doctor OS\local-artifacts\models\qwen3-4b-e2-corrected\
  ├── adapter_model.safetensors (66,126,768 bytes)
  ├── adapter_config.json
  ├── checkpoint-46/
  ├── checkpoint-92/
  ├── checkpoint-138/
  └── tokenizer files
```

Manifest confirmed at `D:\Github Repo\Cursor\AI Doctor OS\local-artifacts\kaggle\downloads\e2-corrected\extracted\e2_corrected_persistence_manifest.json` with SHA256: `83d85fa773a8eaa22d3680bce5e12d77954c464308c66c2808c4327eea3fbc82`.

## What remains in the E2 pipeline

### Immediate E2 verification gate

Artifact persistence and recovery are confirmed. The next behavioral verification steps are:

1. Run **only one case first** using the recovered corrected adapter:
   - `e2-ho--001`
   - BASE vs OLD E2 vs CORRECTED E2
   - `do_sample=False`
   - `max_new_tokens=128`
2. Evaluate Gate criteria:
   - first JSON parseable = Yes
   - full output JSON parseable = Yes
   - repeated JSON = No
   - trailing content = No
3. Stop after the single-case comparison to inspect raw output.

### E2 success gate

Corrected E2 is promising only if `e2-ho--001` shows:

- first JSON parseable = Yes
- full output JSON parseable = Yes
- repeated JSON = No
- trailing content = No

`<|im_end|>` generation is not required if the output cleanly terminates as one
valid JSON object, because the base model already demonstrated clean termination
without visibly generating `<|im_end|>`.

### Six-case evaluation gate

Only after the single-case corrected result is clean:

1. Run the frozen six-case held-out evaluator.
2. Run raw-generation diagnostic for all six cases.
3. Preserve raw outputs and strict parser results.
4. Do not declare behavioral success unless strict full-output JSON passes.

### Artifact persistence gate

For any successful corrected run:

- archive the full corrected artifact directory,
- verify non-zero archive size,
- verify archive contains final adapter and checkpoints,
- store manifest with SHA256,
- recover/download the archive locally,
- keep old/golden E2 adapter untouched.

## E3 pipeline status and next work

### Resolved packaging blocker
The previous failure (`AssertionError: ai-upchar-llm.tar.gz not found!`) has been permanently resolved:
1. Created private Kaggle dataset `yatricabs/ai-upchar-e3-targeted-safety-source` containing `ai-upchar-llm.tar.gz`.
2. Added `kagglehub` automatic download fallback in the training notebook if `/kaggle/input` mount is delayed.

### Completed E3 preparation on `feature/e3-targeted-clinical-safety`:
1. **Dataset Authoring & Static QA:**
   - 24 training records (`data/sft/e3_targeted_safety_train.jsonl`) covering 6 emergency categories with strict clinical restraint.
   - 12 independent held-out records (`data/evaluation/e3_targeted_safety_heldout.jsonl`).
   - 6 frozen E2 held-out records (`data/evaluation/e2_held_out_contract.jsonl`).
   - Static QA passed with zero schema errors, zero leakage, zero overreach violations.
2. **QLoRA Configuration:**
   - `configs/qwen3-4b-e3-targeted-safety.yaml` (36 steps, 3 epochs, `append_assistant_eos: true`, checkpoints at 12/24/36).
3. **Automated Evaluation Harness:**
   - `scripts/evaluate_e3_safety.py` testing Gate A (single-case termination), Gate B (frozen 6/6 E2 regression), and Gate C (12/12 safety restraint & boundary check).
4. **Dedicated Kernel Setup:**
   - Notebook & metadata ready at `D:\Github Repo\AIUPCHAR\kaggle-runs\e3-targeted-safety-training`.
   - Kernel ID: `yatricabs/ai-upchar-e3-targeted-clinical-safety-training`.
   - Standing by in clean state ready for one-shot GPU relaunch.

## Guardrails for the next steps

- Do not overwrite the original E2 adapter or checkpoints.
- Do not modify the frozen evaluator during E2 correction testing.
- Do not modify the held-out dataset.
- Do not run six-case evaluation before the corrected single-case test passes.
- Do not commit/push until the dirty worktree is reviewed and unrelated files
  are separated.
- Keep GPU off when doing static inspection, packaging, and documentation.
- Report GPU ON/OFF status for every Kaggle-related step.

## Recommended next action

1. Run the controlled single-case comparison for `e2-ho--001` (BASE vs OLD E2 vs CORRECTED E2) using the recovered adapter in `D:\Github Repo\Cursor\AI Doctor OS\local-artifacts\models\qwen3-4b-e2-corrected`.
2. Confirm clean single-object JSON termination without continuation bias.
3. Proceed to frozen six-case held-out evaluation (`e2_held_out_contract.jsonl`).
4. Execute E3 targeted clinical safety training on Kaggle when GPU slot is open.
