# E3B Part 1 Core — V23 Validation

Date: 2026-10-04

## Result

E3B V23 passed the available frozen validation gates on Kaggle using
`Qwen/Qwen3-4B-Base` with QLoRA. The previous V22 artifact was rejected after
repeated JSON generation; V23 includes the missing assistant-EOS training fix.

## Training

- Model: `Qwen/Qwen3-4B-Base`
- Method: 4-bit QLoRA, NF4, double quantization
- Dataset: E3B train 20 records; held-out 5 records
- Steps: 24
- Final eval loss: 0.4363068938
- Final mean token accuracy: 0.9195652008
- Checkpoints: 8, 16, 24

## Validation evidence

- Gate A termination: PASS; valid JSON, no repeated JSON, no trailing content
- E2 frozen regression: 6/6 PASS
- E3 held-out: 5/5 contract-valid and 5/5 safety-pass
- Overall validation status: SUCCESS

The E3 held-out count is 5 because the current local E3B dataset was reduced
earlier from the original source package. This is a limitation and should be
resolved before expanding the behavioral program.

The original Part 1 Core package cannot provide a larger leakage-free holdout:
its 250 train rows contain only 25 unique conversations, while its 30 holdout
rows contain 21 conversations that all overlap train. The current 20/5 split
is therefore the maximum justified leakage-free split from the available
unique examples; synthetic duplication is not used to inflate evaluation.

## Root-cause fix

`training.append_assistant_eos` was configured but not applied by `sft.py`.
V23 applies `_append_assistant_eos` before SFT preprocessing. The tokenizer
assistant-mask regression and EOS regression tests pass locally.

## Artifact

- Local adapter: `local-artifacts/kaggle/e3b-v23-output/ai-upchar-llm/artifacts/qwen3-4b-e3b-behavioral`
- Adapter SHA256: `6855DAFB70E2D3E786657F51F779C23538F782961BB6E723F829AF8BD9AD436B`
- Kaggle persistence: adapter split across private datasets
  `yatricabs/ai-upchar-e3b-adapter-v22-c00` and `yatricabs/ai-upchar-e3b-adapter-v22-c01`;
  metadata in `yatricabs/ai-upchar-e3b-adapter-v22-meta`.

## Readiness

E3B V23 is validated against the available 5-case E3B held-out set and the
6-case E2 frozen regression. The separate authoritative targeted-safety set
also passed 12/12 contract and safety cases with no repeated/trailing output.
It is not unrestricted production approval because the Part 1 Core held-out
set remains reduced to 5 records and application-level behavioural integration
has not been re-run against this adapter.

Application contract regression remains green independently of model loading:
clinical reasoning bridge 6/6, intake validation 22/22, appointment context
10/10, and clinical report semantic/state 10/10.
