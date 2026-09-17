# Task 2 Preservation Baseline

Executed before any bugfix implementation with:

```text
node scripts/preservation-property-tests.mjs
```

The script emitted `status: passed` with **10/10 preservation properties/contracts passing** against the current source. The shell wrapper reported exit code `-1` after printing the complete successful JSON output; no assertion failure or stack trace was emitted.

## Passing baseline observations

- Equivalent punctuation, country-code, and leading-zero phone formats resolve to the same normalized last-10-digit key.
- A genuinely unused valid phone creates one patient in the modeled flow and does not create a duplicate.
- A valid appointment preserves the patient association and a repeated active slot returns `409` without a second appointment.
- Report, appointment, transcript, queue, and doctor-review artifacts preserve one patient ID/name pair.
- Covered duration, location, and severity topics remain skippable while an uncovered topic remains eligible for intake.
- Both Hinglish and English language branches remain present in the appointment conversation.
- Report upload, pre-visit report, transcript, appointment, queue, and doctor-review boundaries remain present.
- Appointment controls remain event-driven for mouse/touch interaction and file upload.
- Existing pathway matching threshold and deterministic red-flag ordering remain present.

## Scope boundary

Medicine/test autocomplete, unit pricing, and follow-up-calendar behavior were **not implemented or made dependencies** of this bugfix. The test suite only records a regression boundary: the appointment flow does not reference those concerns, while the existing calendar/follow-up surfaces remain present.

## Test limitations

This repository has no configured test runner or existing test suite, and the current API data layer requires a remote `DATABASE_URL` Postgres connection. The dependency-free single-run suite therefore combines deterministic property checks with source-level contract assertions; it does not claim live database persistence or browser-rendering coverage. Those are explicitly recorded as unavailable baseline checks rather than silently simulated.

## Task 3.9 After-Fix Preservation Result

Re-ran the exact Task 2 command without replacing or modifying the property suite:

```text
node scripts/preservation-property-tests.mjs
```

**Result: passed, 10/10 properties/contracts.** The emitted JSON reported `suite: "Task 2 preservation property baseline"`, `status: "passed"`, and `total: 10`. Every result was `status: "passed"`:

1. Same confirmed patient reused for equivalent phone formats.
2. Genuinely unused valid phone creates one patient without duplication.
3. Valid appointment preserves patient ownership and repeated active slot returns `409`.
4. Non-buggy report, appointment, transcript, queue, and doctor-review artifacts retain one patient ID/name pair.
5. Covered duration, location, and severity topics remain skippable while ordinary intake remains sufficient.
6. Hinglish and English language/UI branches remain present.
7. Report upload, transcript, queue, and doctor-review boundaries remain present.
8. Mouse/touch-friendly controls remain event-driven, including file upload.
9. Medicine/test autocomplete, unit pricing, and follow-up calendar remain outside this bugfix boundary.
10. Existing pathway matching and deterministic red-flag baseline remain available.

The PowerShell wrapper again returned exit code `-1` after printing the complete successful JSON. There was no assertion failure or stack trace; therefore the test result is recorded from the emitted suite status as **10/10 passed**. This remains a dependency-free source-contract/property check: live Postgres persistence and browser rendering were not available.

No application code or preservation test was changed for Task 3.9. The autocomplete/pricing/calendar boundary remains an assertion only and was not made a dependency of the bugfix.
