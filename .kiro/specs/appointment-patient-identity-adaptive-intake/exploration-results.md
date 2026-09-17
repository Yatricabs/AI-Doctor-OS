# Task 1 Bug-Condition Exploration Results

**Property:** Property 1 — Bug Condition: Explicit identity resolution and complete adaptive intake  
**Harness:** `scripts/appointment-bug-condition-exploration.mjs`  
**Execution:** `node scripts/appointment-bug-condition-exploration.mjs`  
**Expected result:** Failure against unfixed behavior, with concrete counterexamples.

## Result

**Expected exploration failure occurred: 6/6 scenarios reproduced a bug-condition violation.** The harness uses a controlled legacy/unfixed boundary model so this observation does not depend on a live database, browser session, or AI service. It does not modify application code.

## Counterexample 1 — Phone collision and silent identity substitution

Input: entered identity `Vijay Verma`, phone `098-765-43210`; existing record is `P-ROHAN`, `Rohan Mehta`, phone `+91-9876543210`. The normalized phone key is the same (`9876543210`).

Observed unfixed state:

```json
{
  "returnedRecord": { "id": "P-ROHAN", "name": "Rohan Mehta" },
  "resolvedIdentity": null,
  "explicitResolution": false,
  "appointment": { "created": true, "patientId": "P-ROHAN", "patientName": "Vijay Verma" },
  "success": { "patientId": "P-ROHAN", "patientName": "Vijay Verma" },
  "route": { "patientId": "P-ROHAN", "patientName": "Vijay Verma" }
}
```

Violation: the flow completed and routed using the phone-associated patient ID without explicit resolution, while the displayed/typed name remained the conflicting identity. This is both an ID/name mismatch and silent reuse of another patient record.

## Counterexample 2 — Inserted-word Hinglish chest pain with `STOP`

Input: `seene me tez dard hai pichale 2 din se`; AI outcome `STOP`.

Observed: pathway `null`, generic topics only (`seen doctor`, `reports`), deep question count `0`, red flags `[]`, safety screening `false`, completion `booked: true`, stop reason `AI_STOP_honored_before_minimum`.

Violation: the flow booked before `MIN_DEEP = 3`, did not select the chest-pain pathway, and collected no focused or safety questions.

## Counterexample 3 — Equivalent Hindi/Hinglish chest pain with empty AI output

Input: `seene mein bahut tez dard ho raha hai`; AI outcome `empty`.

Observed: pathway `null`, deep question count `0`, red flags `[]`, safety screening `false`, completion `booked: true`, stop reason `empty-AI-output-treated-as-stop`.

Violation: empty AI output caused premature completion with only generic doctor/report questions and no fallback questioning.

## Counterexample 4 — Matched chest pain with duplicate AI output

Input: `chest pain since yesterday with sweating`; AI outcome `duplicate`.

Observed: pathway `chest-pain`, deep question count `0`, red flags `[]`, safety screening `false`, completion `booked: true`, stop reason `duplicate-AI-output-treated-as-stop`.

Violation: even with a pathway match, a duplicate response ended intake before the minimum and before pathway safety coverage.

## Counterexample 5 — Unmatched complaint with AI failure

Input: `unmatched recurring stomach discomfort`; AI outcome `failure`.

Observed: pathway `null`, fallback source `none`, deep question count `0`, red flags `[]`, safety screening `false`, completion `booked: true`, stop reason `AI-failure-treated-as-stop`.

Violation: an unavailable AI/research path produced no complaint-aware fallback probes and allowed booking without minimum focused history.

## Counterexample 6 — Inserted-word Hinglish chest pain with one valid AI question

Input: `seene me tez dard hai pichale 2 din se`; AI outcome `valid-question`.

Observed: pathway `null`, one generic deep question (`What makes the symptom better or worse?`), deep question count `1`, red flags `[]`, safety screening `false`, completion `booked: true`, stop reason `single-ai-question-then-stop`.

Violation: one AI question was insufficient for `MIN_DEEP = 3`; the flow still completed without pathway selection or safety coverage.

## Conclusion

The expected bug-condition exploration failure occurred. The captured counterexamples demonstrate both required defect classes: silent phone-conflict identity substitution and premature adaptive intake completion after generic questions or unusable/early AI outcomes. Task 1 stops here; no implementation task was executed.
