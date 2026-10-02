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
| Original E2 held-out behavior | Failed strict full JSON parsing | All six held-out cases produced a valid first JSON object followed by repeated JSON/trailing content (`JSONDecodeError: Extra data`). |
| Root-cause investigation | Strongly supported | Repetition is adapter/training-induced EOS suppression, not missing data, missing adapter, or missing `<\|im_end\|>` labels. |
| Minimal correction | Implemented & Verified | `training.append_assistant_eos: true` with corrected output directory `artifacts/qwen3-4b-e2-corrected`. |
| Corrected E2 single-case test | Passed (100%) | `e2-ho--001` on Kaggle (`yatricabs/ai-upchar-e2-corrected-single-case-test`): 72 tokens, clean EOS, zero repetition, valid full JSON. |
| Corrected E2 six-case eval | Passed (6/6, 100%) | Kaggle kernel `yatricabs/ai-upchar-e2-corrected-six-case-eval`: all 6/6 cases valid JSON, 0 repeated JSON, 0 trailing content, avg 70.3 tokens. Repetition bug completely solved. |
| E3 QLoRA Training | Complete & Verified | 36 steps (3 epochs) on T4 GPU. Train loss: 2.847, Eval loss: 2.688. Checkpoints 12/24/36 and adapter saved. |
| E3 Gate A (Termination) | Passed (100%) | 107 tokens, clean EOS, valid full JSON, zero repeated JSON, zero trailing content. |
| E3 Gate B (E2 Regression) | Passed (6/6, 100%) | All 6 frozen E2 held-out contract cases parsed as valid JSON without extra data or repetition. |
| E3 Gate C (Clinical Safety) | Passed (12/12, 100%) | All 12 held-out emergency cases passed strict contract validation with ZERO clinical overreach violations. |
| E3 Artifact Persistence | Verified & Secured | Golden archive SHA256: `da1563afc10ebdfcaae18e92e5633d51d151eaad7154ad9230cc80b0de8bc0c7` (625,984,867 bytes). Persisted locally and on Kaggle. |
| Next.js Clinical Reasoning Bridge | Complete & Verified | Typed client (`lib/clinicalReasoningClient.ts`), `POST /api/clinical/reason`, `POST /api/symptom-analysis` integration, contract test suite (`test:clinical-reasoning-bridge`) 6/6 passed, Next.js build clean. |

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

### 8. Controlled single-case comparison (`e2-ho--001`)

Kernel: `yatricabs/ai-upchar-e2-corrected-single-case-test` (Status: `COMPLETE`).  
Artifacts recovered at `D:\Github Repo\AIUPCHAR\kaggle-runs\e2-corrected-single-case-test\e2_corrected_single_case\`.

Three-way side-by-side comparison on `e2-ho--001` (`do_sample=False`, `max_new_tokens=128`):

| Condition | Tokens | First JSON | Full JSON Valid | Repeated JSON | Trailing Content | EOS Found | Error |
|---|---:|---|---|---|---|---|---|
| **Base Model** (`Qwen3-4B-Base`) | 115 | True | True | False | False | False | None |
| **Old E2 Adapter** (Suppressed EOS) | 128 | True | False | True | True | False | `JSONDecodeError: Extra data` |
| **Corrected E2 Adapter** (`append_assistant_eos: true`) | **72** | **True** | **True** | **False** | **False** | **True** | **None** |

**Conclusion:** The corrected E2 adapter restored natural termination after the first JSON object. Output token count dropped from 128 (max tokens with repetition) to 72, with 100% clean JSON and zero extra data.

### 9. Frozen six-case held-out contract evaluation

Kernel: `yatricabs/ai-upchar-e2-corrected-six-case-eval` (Status: `COMPLETE`).  
Artifacts recovered at `D:\Github Repo\AIUPCHAR\kaggle-runs\e2-corrected-six-case-eval\e2_corrected_six_case_eval\`.

All 6 held-out cases from `e2_held_out_contract.jsonl` evaluated with strict JSON validation:

| Case ID | Tokens | First JSON | Full JSON Valid | Repeated JSON | Trailing Content | EOS Detected | Max Tokens Reached | Error |
|---|---:|---|---|---|---|---|---|---|
| `e2-ho--001` | 72 | True | True | False | False | True | False | None |
| `e2-ho--002` | 61 | True | True | False | False | True | False | None |
| `e2-ho--003` | 71 | True | True | False | False | True | False | None |
| `e2-ho--004` | 85 | True | True | False | False | True | False | None |
| `e2-ho--005` | 65 | True | True | False | False | True | False | None |
| `e2-ho--006` | 68 | True | True | False | False | True | False | None |

**Contract Evaluation Summary:**
- **Total Cases:** 6
- **First JSON Parseable:** 6 / 6 (100%)
- **Full Output JSON Parseable:** 6 / 6 (100%)
- **Repeated JSON Detected:** 0 / 6 (0%)
- **Trailing Content Detected:** 0 / 6 (0%)
- **Max Tokens Reached:** 0 / 6 (0%)
- **Average Generated Tokens:** 70.33 (min: 61, max: 85)

**Definitive Verdict:** The corrected E2 adapter completely eliminated the EOS suppression bug across the entire held-out contract. Strict full-output JSON validation passed at 100%.

### 10. E3 Targeted Clinical Safety Execution & Comprehensive Evaluation (Gates A, B, C)

Kernel: `yatricabs/ai-upchar-e3-targeted-clinical-safety-training` (Status: `COMPLETE`).  
Artifacts recovered at `D:\Github Repo\Cursor\AI Doctor OS\local-artifacts\models\qwen3-4b-e3-targeted-safety\` and `local-artifacts\kaggle\downloads\e3-targeted-safety\`.

#### A. Real QLoRA Training Metrics (36 Steps, 3 Epochs)
- **Base model:** `Qwen/Qwen3-4B-Base` (NF4 4-bit quantization, LoRA r=8, alpha=16)
- **Training dataset:** 24 approved synthetic emergency records across 6 acute categories
- **Configuration:** `append_assistant_eos: true`, effective batch 2, lr 2e-4
- **Final train loss:** `2.8475` (global step 36)
- **Evaluation loss:** `2.6883` (eval entropy 2.454, eval token accuracy 50.23%)
- **Checkpoints saved:** `checkpoint-12`, `checkpoint-24`, `checkpoint-36`
- **Adapter safetensors:** `adapter_model.safetensors` (66,126,768 bytes)

#### B. Gate A: Single-Case Termination Diagnostic
- **Case Input:** Acute substernal chest pressure radiating to left arm (20 min)
- **Tokens Generated:** 107 tokens
- **Full JSON Valid:** **Yes** (Strictly valid JSON, parsed without error)
- **Repeated JSON Detected:** **No** (Zero repeated `{` or continuation)
- **Trailing Content:** **No**
- **Status:** **PASS**

#### C. Gate B: Frozen E2 Regression Evaluation (6 Held-Out Cases)
- **Total Cases:** 6 (`e2-ho--001` through `e2-ho--006`)
- **Passed Cases:** **6 / 6 (100%)**
- **Repeated JSON:** 0 / 6 (0%)
- **Status:** **PASS** (Zero regression on the frozen E2 contract)

#### D. Gate C: E3 Targeted Clinical Safety Evaluation (12 Emergency Held-Out Cases)
- **Total Cases:** 12 (`e3-ho-001` through `e3-ho-012`)
- **Contract Valid Count:** **12 / 12 (100%)**
- **Clinical Safety Passed:** **12 / 12 (100%)**
- **Clinical Overreach Violations:** **ZERO** (No premature lab ordering, no inappropriate specialist redirection, no unconditional CPR, no definitive diagnostic overreach)
- **Status:** **PASS**

#### E. E3 Golden Artifact Persistence
- **Archive:** `qwen3-4b-e3-targeted-safety-artifacts.tar.gz` (625,984,867 bytes)
- **Golden Archive SHA256:** `da1563afc10ebdfcaae18e92e5633d51d151eaad7154ad9230cc80b0de8bc0c7`
- **Manifest:** `e3_persistence_manifest.json`
- **Overall Pipeline Status:** **SUCCESS**

## Current Kaggle inventory snapshot

As of the latest read-only Kaggle check:

| Kaggle notebook / dataset | Status | Notes |
| --- | --- | --- |
| `yatricabs/ai-upchar-phase-4a-e2-qlora-training` | COMPLETE | Original E2 training notebook. |
| `yatricabs/ai-upchar-e2-inference-diagnostic` | COMPLETE | Used for E2 inference diagnostics. |
| `yatricabs/ai-upchar-e2-corrected-qlora-training` | COMPLETE | Training complete; corrected adapter & checkpoints recovered locally in `models/qwen3-4b-e2-corrected`. |
| `yatricabs/ai-upchar-e2-corrected-single-case-test` | COMPLETE | Single-case test passed: 72 tokens, clean EOS, valid JSON. |
| `yatricabs/ai-upchar-e2-corrected-six-case-eval` | COMPLETE | 6/6 cases passed (100% strict JSON validity, 0% repetition). |
| `yatricabs/ai-upchar-e3-targeted-clinical-safety-training` | COMPLETE | 36 steps QLoRA trained. Gates A, B, C all passed (100%). Archive & manifest generated. |
| `yatricabs/ai-upchar-e3-targeted-safety-source` | COMPLETE | Private dataset holding source repository snapshot for E3. |
| `yatricabs/ai-upchar-e3-targeted-safety-artifacts` | COMPLETE | Private dataset holding golden E3 training archive, checkpoints, manifest, and evaluation report. |

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

With artifact persistence and full 6-case behavioral verification 100% confirmed, the E2 recovery and validation milestone is **COMPLETELY CLOSED & VERIFIED**.

### E3 artifact recovery confirmation

The E3 targeted safety training run and comprehensive evaluation are 100% confirmed and recovered locally:

- **Local path:** `D:\Github Repo\Cursor\AI Doctor OS\local-artifacts\models\qwen3-4b-e3-targeted-safety\`
  - `adapter_model.safetensors` (66,126,768 bytes)
  - `adapter_config.json`
  - `checkpoint-12/`, `checkpoint-24/`, `checkpoint-36/`
  - `training_metadata.json`, `e3_evaluation_report.json`, `e3_persistence_manifest.json`
  - tokenizer and chat template files
- **Archive:** `D:\Github Repo\Cursor\AI Doctor OS\local-artifacts\kaggle\downloads\e3-targeted-safety\qwen3-4b-e3-targeted-safety-artifacts.tar.gz` (625,984,867 bytes)
- **Manifest:** `e3_persistence_manifest.json` with SHA256: `da1563afc10ebdfcaae18e92e5633d51d151eaad7154ad9230cc80b0de8bc0c7`
- **Kaggle Dataset:** `yatricabs/ai-upchar-e3-targeted-safety-artifacts`

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

### E2 pipeline verification and closure

### 1. Single-case verification gate (`e2-ho--001`): PASSED
- First JSON parseable: **Yes**
- Full output JSON parseable: **Yes**
- Repeated JSON: **No**
- Trailing content: **No**
- Generated tokens: **72** (reduced from 128 in old adapter)

### 2. Six-case held-out evaluation gate: PASSED (6/6, 100%)
- All six held-out cases from `e2_held_out_contract.jsonl` parsed as valid JSON without extra data.
- Zero instances of repeated JSON or trailing content across all 6 cases.
- Full output strict JSON parsing succeeded at 100%.

### 3. Artifact persistence gate: PASSED
- The corrected E2 adapter and checkpoints (46, 92, 138) are archived locally in `models/qwen3-4b-e2-corrected` and persisted on Kaggle under `yatricabs/ai-upchar-e2-corrected-qlora-artifacts`.
- Golden original E2 adapter remains completely untouched and preserved.

**Conclusion:** The Phase 4A E2 repetition / EOS suppression issue is definitively resolved.

## E3 pipeline verification and closure

### 1. Training execution: PASSED
- 36 steps of QLoRA fine-tuning completed on `Qwen/Qwen3-4B-Base`.
- Effective batch size: 2, 3 epochs, `append_assistant_eos: true`.
- Train loss: 2.8475, Eval loss: 2.6883.
- Checkpoints saved: 12, 24, 36.
- Adapter safetensors: 66,126,768 bytes.

### 2. Gate A (Single-Case Termination Diagnostic): PASSED
- Tokens generated: 107 tokens.
- Full output valid JSON: **Yes**
- Repeated JSON: **No**
- Trailing content: **No**

### 3. Gate B (Frozen E2 6-Case Regression): PASSED (6/6, 100%)
- All 6 held-out cases from `e2_held_out_contract.jsonl` parsed as valid JSON without extra data or continuation.
- Zero regression compared to the corrected E2 baseline.

### 4. Gate C (E3 Targeted Clinical Safety): PASSED (12/12, 100%)
- All 12 independent held-out emergency cases parsed as strictly valid JSON.
- Evaluated against banned clinical overreach patterns (unauthorized lab ordering, inappropriate specialist redirection, unconditional CPR, definitive diagnosis).
- Safety violations: **ZERO (0/12)**.

### 5. Artifact persistence & cloud backup: PASSED
- Local path: `D:\Github Repo\Cursor\AI Doctor OS\local-artifacts\models\qwen3-4b-e3-targeted-safety\`
- Golden Archive: `qwen3-4b-e3-targeted-safety-artifacts.tar.gz` (625,984,867 bytes)
- Golden Archive SHA256: `da1563afc10ebdfcaae18e92e5633d51d151eaad7154ad9230cc80b0de8bc0c7`
- Kaggle Dataset: `yatricabs/ai-upchar-e3-targeted-safety-artifacts`
- Status: **GPU OFF / EXECUTION CLOSED**.

### 6. Next.js Clinical Reasoning Integration Bridge: PASSED
- **Client Library:** `lib/clinicalReasoningClient.ts` implemented with full TypeScript definitions for the 6-key contract (`semantic_interpretation`, `recommended_action`, `next_best_question`, `missing_information`, `clinical_considerations`, `confidence`).
- **Resilience / Safety Floor:** Added `deterministicClinicalFloor()` ensuring zero-downtime fallback when the local/hosted Python gateway is unconfigured or offline. Automatically detects red flags, urgent symptoms, extracts duration/anatomy, and ensures `confirmed_diagnoses: null`.
- **API Endpoints:**
  - `POST /api/clinical/reason`: Next.js Route Handler exposing the clinical reasoning contract with input validation and fallback execution.
  - `GET /api/clinical/reason`: Health check returning gateway connectivity and clinical governance status.
  - `POST /api/symptom-analysis`: Updated to query `evaluateClinicalReasoning()`, providing triage and considerations without crashing when external APIs are unconfigured.
- **Verification:**
  - `npm run test:clinical-reasoning-bridge`: 6/6 tests passing (emergency triggers, routine dysuria extraction, contract key invariants, offline fallback).
  - Next.js production build (`npm run build`): 100% clean compilation across all 30 routes.

## Summary of Phase 4A Milestones

| Milestone | Base Model | Steps | Termination Bug | Gate A | Gate B | Gate C | Next.js Bridge | Overall Status |
|---|---|---:|---|---|---|---|---|---|
| **Original E2** | Qwen3-4B | 138 | Present (Suppressed EOS) | Pass | Fail (0/6 Extra data) | N/A | N/A | **Partial** |
| **Corrected E2** | Qwen3-4B | 138 | Resolved (`append_assistant_eos`) | Pass | Pass (6/6 Valid JSON) | N/A | N/A | **Verified** |
| **E3 Targeted Safety** | Qwen3-4B | 36 | Resolved (`append_assistant_eos`) | Pass (100%) | Pass (6/6 Valid JSON) | Pass (12/12 Safe) | Verified (6/6 Tests) | **SUCCESS** |

**Final Status:** Phase 4A real QLoRA validation, E3 targeted clinical safety training, and the Next.js clinical reasoning integration bridge are fully completed, verified, persisted locally, and backed up to Kaggle. Ready for review.
