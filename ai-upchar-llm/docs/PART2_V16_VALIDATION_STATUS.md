# Part 2 V16 Corrective Validation Status

Status checked: 2026-10-07 (Asia/Calcutta)

Current verdict: **GPU validation pending; not production-ready.** The user
reported that the Kaggle GPU quota is exhausted, so no new kernel was launched
after the corrective local work described below.

## Immutable adapter

- Private Kaggle dataset: `yatricabs/ai-upchar-part2-v16-adapter`
- Adapter SHA256:
  `66d714f982be9565c779e1847d3613614caa3c7ccf7f5c5fe746d7b11027e79d`
- No additional training or adapter mutation was performed in this corrective
  pass.

## Corrected interpretation of previous results

| Evidence | Result |
|---|---|
| V16 unconstrained full validation | Reported `387/390`, but that evaluator only checked JSON shape plus a narrow overreach list. |
| Corrected local replay of the same 390 outputs | `358/390` passed; 32 unique failures were identified. |
| Historical syntax failures | E17-0013, E20-0001, and E20-0025. |
| E20 privacy audit | 28 syntactically valid E20 outputs violated one or more deterministic privacy-contract invariants. The other two E20 outputs were invalid JSON. |
| Ordered-decoder diagnostic | The two unique historical syntax prompts produced valid ordered JSON, but E20-0001 still failed the corrected privacy semantic gate. |
| Old structured focused run | `ERROR` in frozen E2 Gate B because `prefix_allowed_tokens_fn` returned an empty list. No focused report was produced. |

The old `387/390` result must therefore not be used as a behavioral or
production-readiness claim. The adapter's previously recorded E2/E3 safety
passes remain historical evidence, but they do not supersede the pending
corrective matrix.

## Proven root causes

1. `JsonSchemaParser(force_json_field_order=True)` in
   `lm-format-enforcer==0.11.3` did not reliably preserve the required top-level
   key order. Key fragments could spill into a string value.
2. The Part 2 evaluator appended a long, unseen meta-instruction to each user
   prompt. The adapter was trained on the raw user message, and it echoed that
   meta-instruction into E20 values (for example, instructions to ignore the
   clinical message or privacy concern).
3. The evaluator treated any syntactically valid, non-empty E20 object as a
   pass. It did not enforce the stage's privacy semantics.
4. LMFE allowed-token caches were shared across different ordered key schemas.
   Parser cache keys do not encode the complete remaining sequence, so a later
   contract could receive an incompatible cached token set.

## Corrective implementation now prepared locally

- Deterministic ordered top-level JSON sequence; model-generated values retain
  their original heterogeneous JSON types.
- Exact SFT prompt parity for Part 2 inference: only the original user message
  is sent. The decoder, not prompt text, owns the JSON skeleton.
- E20 stage-wide semantic privacy checks. These reject privacy/clinical-message
  dismissal and require safeguards, minimum-necessary use, sensitive-data
  boundaries, and privacy-preserving clinical focus. No held-out answer string
  is compared or injected.
- Allowed-token caches are namespaced by tokenizer identity plus the complete
  ordered key schema.
- An empty decoder state terminates the individual generation with EOS and is
  recorded as an audited case failure instead of crashing the whole matrix.
- A dedicated E20 gate covers all 30 frozen records while generating only the
  24 unique deterministic prompts.

## Historical local evidence (before the 2026-10-09 parser correction)

- Full Python suite: **63 passed, 6 skipped**, with one unrelated Starlette deprecation warning.
- Python compilation and `git diff --check`: passed.
- The previous preflight report recorded **413/413** frozen contract parser
  acceptances. This does not establish full model generation success.
- Approved E20 reference-contract audit: **30/30** passed the new semantic
  invariants.
- Previously generated E20-0001 output (`Ignore the privacy concern ...`) is
  now correctly rejected.
- Exact train/held-out user-message overlap: **0/390**.
- Exact train/held-out conversation-pair overlap: **0/390**.
- Held-out assistant targets already present in training: **390/390**. This
  templated-target overlap limits claims about generalization and must remain a
  reported limitation even if the frozen matrix later passes.

Local reports:

```text
local-artifacts/reports/part2_v16_ordered_json_preflight_v3_413.json
local-artifacts/reports/part2_v16_semantic_replay_audit.json
local-artifacts/reports/part2_train_heldout_exact_leakage_audit.json
local-artifacts/reports/part2_v16_corrective_validation_build_manifest.json
```

## Previously prepared packages (stale after the 2026-10-09 correction)

All four clean kernel packages contain the same 12-file source set and exclude
SFT data, V17 experiments, adapters, checkpoints, and stale notebooks.

- Historical source SHA256 (must not be reused for a new validation run):
  `52bb2332b9d8e63b353f37b6a187689246103f1d2cd493956b36ea150a440598`
- Modes: `diagnostic`, `privacy`, `focused`, and `full`.
- GPU launch status: **not launched**. These packages predate the parser and
  privacy-evaluator fixes below and require a fresh source build and hash check.

## 2026-10-09 local correction and verification

- Verified defects in the custom decoder: free-text shortcut cache keys omitted the
  current ordered-field position. Two different legal JSON positions could
  therefore share a cached token set. The structural-token probe also assumed
  that an illegal character would raise; LMFE instead returns a dead parser
  state. The fix includes the remaining sequence position in the cache key and
  verifies every character of a boundary token before allowing it. These
  defects can produce invalid token states; the historical Kaggle failure has
  not been reproduced with a full model run after the correction.
- E20 semantic validation now rejects explicit instructions to negate privacy
  safeguards or disclose sensitive details. It also accepts a negated unsafe
  instruction such as "do not ignore privacy concerns". All 30 approved E20
  held-out answers remain unflagged by these deterministic checks.
- The 413 frozen target JSON objects pass the ordered grammar on CPU. A local
  Qwen tokenizer replay of the three recorded E17/E20 failures passes using
  their exact target token IDs and a reduced test vocabulary. This is a parser
  regression check, not a full-vocabulary or model-generation result.
- Local Python suite: **69 passed, 8 skipped** (the system interpreter lacks
  LMFE). In the offline LMFE 0.11.3 environment, all **13 structured-generation
  tests passed**. A clean committed checkout produced **50 passed, 18 explicit
  skips**; the skips are for external approved datasets and unavailable local
  dependencies, not clinical validation passes.
- The missing source scripts used by committed tests are now versioned. The
  approved E3B/Part 2 JSONL packages remain outside Git; data-dependent tests
  retain their original assertions when those packages are present.
- No new Kaggle run or GPU training was launched. Cloud focused and full
  validation, model behavior, and release readiness remain **unverified**.
- Fresh local validation packages must report structured decoder version
  `v4+positioned-cache+strict-boundary-token-check`; older v3 source ZIPs are
  historical artifacts and must not be relaunched.

## Fresh offline packages prepared from code commit `f42a7a1`

Four private kernel packages were rebuilt locally under
`local-artifacts/kaggle/uploads/validated-f42a7a1/` for `diagnostic`,
`privacy`, `focused`, and `full`. Each ZIP contains the exact same 12 expected
source files; the embedded decoder source was byte-compared with the committed
file. Each ZIP has SHA256
`282f8abe7acef80c021c529cd0361ba3ae80126e666d1e2c121be4933fc8804f`.
The notebooks compiled locally and metadata is private. They have **not** been
pushed to Kaggle or executed; GPU quota remains untouched.

When quota is available, the mandatory order is:

1. Two-unique-case structured diagnostic.
2. E20 privacy gate: 24 unique prompts covering 30 frozen rows.
3. Focused gate: historical Part 2 probes, E3B 5/5, Gate A, E2 6/6, and E3 12/12.
4. One full validation: Part 2 390/390 plus unique-prompt counts,
   multilingual checks, E3B, Gate A, E2, and E3.

No full run may be launched if an earlier gate fails. No retraining is justified
until these corrected inference and evaluator gates produce model-output
evidence.
