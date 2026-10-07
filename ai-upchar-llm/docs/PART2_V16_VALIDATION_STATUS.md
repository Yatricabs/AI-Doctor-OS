# Part 2 V16 Validation Status

Status checked: 2026-10-07 (Asia/Calcutta)

## Kaggle runs

| Run | Kaggle state | Verified result |
|---|---|---|
| `ai-upchar-part2-v16-full-validation` | Complete | `FAIL`: 387/390 Part 2 cases; Gate B E2 4/6; Gate C E3 9/12 |
| `ai-upchar-part2-v16-structured-diagnostic` (version 5) | Complete | `PASS`: 2 unique historical failure prompts covering 3 frozen failure IDs |
| `ai-upchar-part2-v16-structured-focused-validation` | Stopped before completion | Intentionally stopped while running because the Kaggle GPU quota had only 24 minutes remaining; no result is claimed |

The V16 adapter used by these runs is unchanged. Its recorded SHA256 is:

`66d714f982be9565c779e1847d3613614caa3c7ccf7f5c5fe746d7b11027e79d`

The validated structured-decoding source used by diagnostic version 5 has
SHA256:

`a91563b8b4959d778e7f0078e6a2c10a7f99c888cf12e5e8dcf8f182ae6fd389`

## Root cause and fix

The remaining failures were inference-time JSON generation failures, not a
training or safety regression. Direct use of `force_json_field_order` with
`lm-format-enforcer==0.11.3` did not preserve the requested field order. The
model could then spill the next key into the preceding string value.

`structured_json_generation.py` now uses a deterministic ordered top-level
JSON sequence, retains LMFE's fast free-text path for values, and blocks
contract-key fragments from leaking into string values. The frozen evaluator
still owns validity, keys, non-empty values, repetition, and safety verdicts.

## Local evidence

- Full relevant Python test suite after the fix: `62 passed`.
- Structured preflight: `413/413` records, zero parser failures, zero tokenizer
  round-trip failures.
- Kaggle diagnostic version 5: PASS on all unique historical failure probes.

These checks do not replace the pending 390-case full validation. No further
training is justified by the current evidence.

## Dataset and artifact handling

The raw Part 2 JSONL packages are intentionally not committed here. The
repository audit found duplicated templates and complete train/held-out
overlap across E12-E24, so those files remain quarantined until independently
authored, clinically reviewed, de-identified data passes the required audit.

Local Kaggle downloads, checkpoints, adapters, logs, and generated notebooks
also remain outside Git. They are reproducibility artifacts, not source code.

## Next safe action

After Kaggle quota refresh, run one clean full validation using the versioned
structured decoder and retain its report. Do not retrain V16 or launch another
focused GPU run before that full run.
