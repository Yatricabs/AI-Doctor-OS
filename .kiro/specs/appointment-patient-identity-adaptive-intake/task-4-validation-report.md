# Task 4 End-to-End Integration and Regression Validation

## Scope

Task 4 validation was run without executing Task 5. The repository has no configured browser integration runner, live database fixture, or test script, so the available deterministic harnesses were run as the integration/regression substitute. No development server, production server, watch mode, or dependency installation was used.

The bugfix requirements source is `bugfix.md`; `requirements.md` does not exist in this bugfix spec. The spec configuration is `.config.kiro` with `specType: "bugfix"`.

## Deterministic validation results

All harnesses below emitted the stated JSON result and no assertion failure or stack trace. The PowerShell execution wrapper returned exit code `-1` after each Node process, including successful scripts; this is recorded as a wrapper limitation rather than an assertion failure.

| Command | Exact emitted result | Coverage |
|---|---|---|
| `node scripts/appointment-bug-condition-exploration.mjs` | `expectedFailureOccurred: true`; `6/6` violations reproduced | Preserved unfixed fixture: phone collision plus STOP, empty, duplicate, AI failure, and one-question premature intake. Expected failure. |
| `node scripts/appointment-bug-condition-fixed-regression.mjs` | `status: "passed"`; `6` scenarios; `minDeep: 3`; `maxDeep: 5` | Explicit collision confirmation, immutable `P-ROHAN`/`Rohan Mehta` propagation across pre-visit/report/appointment/transcript/success/queue/doctor route, Hinglish chest pathway, unusable AI fallback, unmatched complaint fallback, duplicate safety signal, and bounds. |
| `node scripts/preservation-property-tests.mjs` | `status: "passed"`; `total: 10`; all 10 results `status: "passed"` | Same-identity reuse, unique-phone creation, appointment/slot conflict, artifact routing, covered-topic skipping, language, report upload/transcript/queue/doctor review, event-driven UI controls, out-of-scope boundary, pathway/red-flag baseline. |
| `node scripts/clinical-pathways-task-3-3-tests.mjs` | `status: "passed"`; `total: 12` | Inserted-token Hinglish, punctuation/case, Hindi Unicode, adjacent English, partial phrase, cough match, generic false-positive rejection, threshold, and pathway framing. |
| `node scripts/appointment-task-3-4-contracts.mjs` | `status: "passed"`; `minDeep: 3`; `maxDeep: 5` | STOP/empty/duplicate/unusable/throw outcomes, minimum-before-finalize, bounded completion, unresolved safety visibility, covered-topic skipping, deep Q/A folding. |
| `node scripts/appointment-task-3-5-contracts.mjs` | `status: "passed"` | Background research, curated pathway authority, no-pathway probes, all-answer red-flag scan, unresolved safety preservation, clinician disclaimer. |
| `node scripts/appointment-task-3-6-tests.mjs` | `status: "passed"`; `total: 10`; `unitTests: 5`; `propertyTests: 5`; `contractChecks: 0` | Phone/collision/appointment units; identity, pathway, deep-loop, fallback, safety, immutable artifact, and preservation properties. |
| `node scripts/appointment-task-3-7-tests.mjs` | `status: "passed"`; `total: 6` | Invalid phone, identity recovery, collision confirmation/correction, 404/409/persistence gating, malformed JSON and mismatch recovery, non-fatal observable transcript/enrichment failures. |

### Fixed companion exact scenario summary

The fixed companion reported these six scenarios as `status: "passed"`:

1. `phone collision pauses until explicit confirmation` — resolved patient `P-ROHAN`, `Rohan Mehta`; artifacts: `pre-visit`, `report-upload`, `appointment`, `transcript`, `success`, `queue`, `doctor-route`.
2. `non-adjacent Hinglish chest pain selects pathway` — pathway `chest-pain`, deep count `3`, fallback `pathway`.
3. `equivalent Hindi chest pain and unusable AI retain focused questions` — pathway `chest-pain`, deep count `3`.
4. `matched chest pain duplicate output does not stop early` — deep count `3`, deterministic cardiac red flag retained.
5. `unmatched complaint uses complaint-aware fallback after AI failure` — no pathway, deep count `3`, fallback `complaint-aware`.
6. `valid early AI question remains bounded by MIN_DEEP/MAX_DEEP` — deep count `3`, stop reason `minimum-and-safety-check`.

## Repository commands

### Requested commands

The literal commands were attempted first:

```text
npm run lint
npm run build
```

Both were blocked before project execution by the machine PowerShell policy:

```text
npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system.
FullyQualifiedErrorId : UnauthorizedAccess
Exit Code: -1
```

The Windows executable shim was then used to execute the same package scripts:

```text
cmd.exe /d /c "npm.cmd run lint"
cmd.exe /d /c "npm.cmd run build"
```

Observed output:

- Lint reached the package script: `> ai-doctor-os@1.0.0 lint` and `> next lint`; the wrapper terminated with `Exit Code: -1` before exposing a normal completion status or diagnostics.
- Build reached `prebuild` and emitted the exact guard result: `CSS guard passed: Tailwind directives, content globs, and app entry points are present.` The wrapper terminated with `Exit Code: -1` before exposing subsequent `next build` output or a normal completion status.

Direct bounded invocations were also attempted:

```text
node node_modules/next/dist/bin/next lint
node node_modules/next/dist/bin/next build
```

Both were terminated by the same execution wrapper with `Exit Code: -1` and no lint/build diagnostic output. This prevents claiming a normal lint/build pass; the available evidence is that lint/build started and the build preflight passed.

### Other configured package command

```text
cmd.exe /d /c "npm.cmd run audit:api"
```

The script started as `> ai-doctor-os@1.0.0 audit:api` / `> node scripts/audit-frontend-api.mjs`, then the wrapper terminated with `Exit Code: -1` without report output.

### Test runner availability

```text
cmd.exe /d /c "npm.cmd test -- --runInBand"
```

Exact package-manager result:

```text
npm error Missing script: "test"
npm error To see a list of scripts, run:
npm error   npm run
```

Therefore all configured targeted tests are the deterministic `scripts/*.mjs` harnesses listed above; there is no `npm test` runner in `package.json`.

## Integration limitations

The deterministic suites cover the requested identity, intake, API-boundary, routing, fallback, safety, language/UI contract, transcript, queue, doctor-review, refresh/retry/error, report-upload, and slot-conflict scenarios through modeled state and source contracts. They do not claim live persistence or browser rendering.

Live end-to-end execution was unavailable because:

- No configured browser/integration test runner exists.
- The API data layer requires a remote `DATABASE_URL` Postgres connection and no live integration fixture was provided.
- The execution wrapper terminates npm/Next child processes with `-1` before normal completion output can be observed.

The medicine/test autocomplete, unit pricing, and follow-up calendar remain an explicit out-of-scope regression boundary. The appointment page has no autocomplete/pricing/calendar dependency, and the preservation harness reported that boundary as passed. No implementation or validation change was made to those unrelated surfaces.

## Conclusion

The deterministic Task 4 regression evidence passes: fixed bug-condition scenarios `6/6`, preservation checks `10/10`, pathway checks `12`, focused unit/property checks `10/10`, adaptive-boundary contracts passed, fallback/safety contracts passed, and API/browser error contracts `6/6`. The legacy exploration’s `6/6` failures remain intentionally preserved as proof of the original defects. Live browser/database integration and normal npm/Next exit statuses could not be verified due repository/environment limitations documented above. Task 5 was not executed.
