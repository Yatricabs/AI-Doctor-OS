# Task 3.8 Property 1 Verification

## Scope

Task 3.8 re-ran the exact Task 1 exploration command and verified the implemented behavior with a fixed-behavior companion. The original exploration harness was not modified or replaced:

```text
node scripts/appointment-bug-condition-exploration.mjs
```

Because that harness intentionally models the unfixed boundary, its expected failure remains the preserved legacy baseline. The fixed verification command is:

```text
node scripts/appointment-bug-condition-fixed-regression.mjs
```

The companion is deterministic and dependency-free. It uses the same scoped bug-condition inputs as Task 1, plus source contracts for the application boundaries that cannot be exercised without a browser/database session.

## Results

| Validation | Result | Meaning |
|---|---:|---|
| Exact Task 1 exploration | Expected failure: 6/6 violations | The preserved legacy fixture still proves both original defects; this is not a fixed-property failure. |
| Task 3.8 fixed companion | **PASS: 6/6 scenarios** | Every scoped bug-condition input satisfies Property 1 in the fixed behavior model and implementation contracts. |

The original harness reported the same six counterexamples documented in `exploration-results.md`: one silent phone-collision identity substitution and five premature adaptive-intake completions (`STOP`, empty, duplicate, AI failure, and one valid question).

## Fixed-property coverage

1. **Collision resolution:** `Vijay Verma` with Rohan Mehta's equivalent phone format pauses in `awaiting-explicit-resolution`, cannot book while unconfirmed, and only books after explicit confirmation. The fixture asserts no overwrite and no duplicate.
2. **Immutable identity propagation:** After confirmation, `P-ROHAN` / `Rohan Mehta` is asserted across pre-visit, report upload, appointment, transcript, success, queue, and doctor-route artifacts.
3. **Non-adjacent chest-pain matching:** `seene me tez dard hai pichale 2 din se` and the equivalent Hindi phrase select the chest-pain pathway despite inserted words.
4. **Pathway deep questioning:** Matched chest pain uses pathway questions and collects at least `MIN_DEEP = 3` focused questions.
5. **No-pathway fallback:** `unmatched recurring stomach discomfort` with AI failure uses complaint-aware fallback probes and still collects three questions.
6. **Early-stop handling:** `STOP`, empty, duplicate, and failure outcomes do not produce zero/early completion; fallback questioning continues.
7. **Bounds:** The fixed companion asserts completion at or above `MIN_DEEP` and never above `MAX_DEEP = 5` for the scoped ordinary flows.
8. **Deterministic safety:** Chest-pain sweating is retained as a deterministic safety signal; source contracts verify scanning of patient answers and preservation of unresolved safety limitations.

## Validation command

```text
node scripts/appointment-bug-condition-fixed-regression.mjs
```

Output status: `passed`, `minDeep: 3`, `maxDeep: 5`, six scenarios passed. No later spec task was executed.
