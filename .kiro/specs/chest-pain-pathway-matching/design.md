# Chest Pain Pathway Matching Bugfix Design

## Overview

The appointment intake currently recognizes curated clinical pathways with contiguous synonym containment. Natural Hindi/Hinglish chest complaints can therefore miss `chest_pain`, especially when a speaker inserts modifiers or uses pressure, heaviness, burning, sudden-onset, or left-sided wording. When that happens, the adaptive interview receives only the generic floor. A separate boundary defect allows complaint words such as `chest` and `seene` to satisfy the `red_flag_screen` coverage dimension even though the patient has not answered the safety question.

This design adds a narrow, high-sensitivity chest-safety recognition profile around the existing curated pathway library. It keeps the existing pathway matcher and adaptive coverage model as the primary abstractions, adds a chest-specific safety-preserving fallback when ordinary matching returns `null`, and separates complaint context from explicit red-flag-screen evidence. The same resolved safety context and evidence evaluator will be used while asking questions, building the pre-visit snapshot, and applying the final deterministic report overlay.

The fix is limited to pathway recognition, adaptive safety coverage, and the deterministic safety overlay. It does not diagnose, prescribe, replace clinician review, create a universal questionnaire, or change unrelated pathway data or urgency meanings.

## Glossary

- **Bug_Condition (C)**: A chest-pain-equivalent complaint is not routed to chest-safety coverage, or complaint wording alone is treated as completed `red_flag_screen` evidence.
- **Property (P)**: Every chest-safety-relevant input is routed to chest-specific adaptive coverage or an explicitly equivalent safety-preserving route, while safety completion requires explicit evidence.
- **Preservation**: Existing valid pathway selection, adaptive required dimensions, general red-flag detection, urgency ordering, no-diagnosis behavior, appointment persistence, and `MAX_DEEP` ceiling behavior remain unchanged outside the bug condition.
- **`matchPathway`**: The existing pure function in `lib/clinicalPathways.ts` that returns the highest-confidence curated pathway or `null`.
- **`ClinicalPathway`**: The existing curated complaint object containing synonyms, bilingual core questions, pathway red flags, investigation considerations, and governance metadata.
- **Chest safety profile**: A deterministic, non-diagnostic recognition and questioning profile derived from the existing `chest_pain` pathway. It can be attached even when ordinary pathway scoring returns `null`.
- **Clinical context**: The resolved intake routing object containing the ordinary pathway result, optional chest safety profile, route reason, and safety evidence state.
- **Explicit safety evidence**: A patient answer or other structured answer explicitly addressing the danger-sign question, such as an affirmative or negative response to radiation, breathlessness, sweating, fainting, or current severe pain. Complaint text is not explicit safety evidence.
- **`red_flag_screen`**: The adaptive coverage dimension representing whether the danger-sign question has actually been answered. It is not equivalent to detecting a danger signal in complaint text.
- **Unresolved safety**: Missing, ambiguous, or contradictory screening evidence. It must never be represented as a safely negative screen.
- **`MAX_DEEP`**: The existing hard ceiling on complaint-specific questions. It remains a ceiling, not a required question count and not a substitute for coverage.

## Bug Details

### Bug Condition

The bug manifests when the patient describes chest or cardiac discomfort in Hindi/Hinglish or a natural variant that is not an existing contiguous synonym, or when the complaint contains chest terminology that is incorrectly counted as a completed safety screen. The current `scorePathway` implementation checks whether a full synonym is contained as a phrase; it does not robustly model meaningful token relationships with inserted words. The current `dimensionHit` implementation scans merged patient text and includes `chest` and `seene` as `red_flag_screen` cues, so the initial complaint can satisfy the safety dimension before the patient has answered it.

**Formal Specification:**

```text
FUNCTION isBugCondition(input)
  INPUT: input containing complaint text, collected answers, and current clinical context
  OUTPUT: boolean

  chestMeaning := hasChestPainEquivalentMeaning(input.complaint)
  routeFailure := ordinaryMatchPathway(input.complaint, input.duration) = null
                   OR ordinaryMatchPathway(input.complaint, input.duration).id != "chest_pain"
  unsafeScreenCompletion := coverage(input).red_flag_screen is satisfied
                           AND no explicit safety-screen evidence exists

  RETURN (chestMeaning AND routeFailure) OR unsafeScreenCompletion
END FUNCTION
```

The chest meaning predicate is intentionally narrower than “contains chest language.” It requires a chest location/cardiac anchor combined with a pain or pressure-quality anchor (for example `seene` + `dard`, `chest` + `pressure`, `baaye taraf` + `jalan`), with supported modifiers such as sudden onset allowed between meaningful tokens. A standalone `chest`, `seene`, `pain`, `dard`, `pressure`, or left-sided body reference is not sufficient.

### Examples

- `Mere seene mein pressure aur dard ho raha hai` currently lacks the contiguous `seene mein dard` synonym because `pressure aur` is inserted. The fixed route must recognize `chest_pain` or attach the equivalent chest safety profile and require adaptive chest coverage.
- `Seene mein dard hai` is already a pathway-matching example, but its complaint words must not by themselves satisfy `red_flag_screen`. The screen remains unanswered until an explicit safety response is collected.
- `Baaye taraf seene mein dard ho raha hai` contains a left-sided location modifier between the meaningful location and symptom words. It must match the chest safety profile without converting left-sided wording into a diagnosis or automatic emergency result.
- A phrase using pressure, heaviness, or burning in the chest, including natural Hindi/Hinglish variants such as `seene mein bhaaripan`, `dabav`, or `jalan`, must be treated as chest-safety relevant even if the word `dard` is absent.
- A complaint describing sudden onset, such as `achanak seene mein dabav`, must preserve the onset information for adaptive coverage and route to chest safety when paired with a chest discomfort quality.
- `Persistent cough` and `pet mein dard` must retain their existing pathway behavior. `dard`, `pressure`, `chest`, or `seene` alone must not create a chest pathway.
- A chest complaint with explicit later evidence such as `haan, dard baaye haath tak ja raha hai aur paseena aa raha hai` must retain the existing emergency chest red-flag signal and urgency semantics. The positive signal does not mean the screening question was answered earlier by the complaint.
- An answer such as `pata nahi` or a contradictory answer such as `pehle nahi, ab saans phool rahi hai` leaves the safety status unresolved or positive as appropriate; it must not be coerced into a safe negative.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**

- Existing curated pathway matching for non-chest complaints continues to select the same pathway with the same valid confidence behavior. Existing pathway questions, relevant-history dimensions, and red-flag definitions remain authoritative.
- Adaptive coverage remains data-driven. A dimension already supported by patient evidence is not re-asked, dimensions vary by pathway, and no rigid universal questionnaire or fixed question count is introduced.
- `MAX_DEEP` remains a hard safety ceiling only. It is never used as the condition that declares coverage complete.
- Existing general red flags and pathway-specific red flags continue to be detected from relevant patient-provided words, sorted with emergency signals first, and mapped to their existing urgency values. The fix must not downgrade, hide, or reinterpret an explicit emergency or urgent signal.
- Pathway selection, urgency, red-flag detection, and missing information remain intake support only. No code path may infer or state a diagnosis.
- Complaint words remain useful context. They may trigger a safety signal for clinician visibility, but they cannot satisfy `red_flag_screen` unless they are also part of explicit safety-screen evidence.
- Non-buggy patient, appointment, report, transcript, queue, and final-report persistence behavior remains unchanged.

**Scope:**

All inputs outside the chest-safety bug condition must behave as before. This includes unrelated curated pathways, genuinely unmatched non-chest complaints, mouse/UI behavior, ordinary fixed-script answers, uploaded reports, general red flags, explicit urgency signals, and appointment completion subject to the current flow. For a chest-safety input, only the additional safety-preserving routing and evidence requirements are allowed to differ.

## Hypothesized Root Cause

1. **Contiguous synonym scoring is too narrow for natural language.** `scorePathway` looks for complete synonym strings after normalization. Inserted modifiers, conjunctions, left-sided location wording, and alternate quality terms prevent a score even when the meaning is clear.

2. **The chest synonym inventory is incomplete for safety-relevant qualities.** The current pathway includes pain, tightness, and some Roman Hindi variants, but does not consistently represent pressure, heaviness, burning, sudden onset, and location variants as a structured combination.

3. **Coverage conflates context with explicit screening.** `DIMENSION_CUES.red_flag_screen` includes `chest` and `seene`, and `coverageFor` receives flattened patient text without source or question context. The complaint can therefore appear to answer a danger-sign question.

4. **The null-pathway route has no safety-aware fallback.** When `matchPathway` returns `null`, `requiredDimensions` returns only the generic four dimensions. There is no equivalent chest profile to add relevant history and red-flag coverage without changing the generic behavior for unrelated complaints.

5. **The final overlay resolves safety independently from adaptive coverage.** The final deterministic overlay calls `detectRedFlags` with the pathway reference and flattened text. Without a shared clinical context, a missed chest route and an incorrectly completed screen can produce inconsistent questioning, snapshot, and report behavior.

## Correctness Properties

Property 1: Bug Condition - Chest-Safety Recognition and Routing

_For any_ input where `isBugCondition` is true because the complaint has chest-pain-equivalent meaning, the fixed resolver SHALL select `chest_pain` or attach an explicitly equivalent chest safety profile, and SHALL expose chest-relevant adaptive coverage including the applicable onset/duration, severity/character, associated symptoms, relevant history, and red-flag screen dimensions without imposing a universal question list.

**Validates: Requirements 2.1, 2.2, 2.5, 2.7**

Property 2: Preservation - Non-Chest and Existing Pathway Behavior

_For any_ input where the bug condition does NOT hold, the fixed functions SHALL produce the same valid pathway, adaptive required dimensions, red-flag signals, urgency semantics, no-diagnosis behavior, persistence behavior, and completion behavior as the original functions, including generic fallback behavior for genuinely unrelated unmatched complaints.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 3.8**

Property 3: Explicit Safety Evidence Boundary

_For any_ chest-safety input, complaint context alone SHALL leave `red_flag_screen` unanswered even when the complaint contains `chest`, `seene`, `dard`, pressure, radiation, sweating, breathlessness, or left-sided wording; only explicit, attributable safety-screen evidence may mark the screen negative or positive. Positive explicit evidence SHALL retain the established signal and urgency, while ambiguous or contradictory evidence SHALL remain unresolved rather than becoming a safe pass.

**Validates: Requirements 2.3, 2.4, 2.10, 3.6**

Property 4: Shared Final Safety Evaluation and Ceiling Preservation

_For any_ collected intake state, the adaptive coverage decision and final deterministic overlay SHALL consume the same resolved clinical context and safety evidence. The final overlay SHALL preserve the worst established urgency, SHALL not lower an AI urgency, SHALL not declare an unresolved screen safe, and SHALL respect `MAX_DEEP` as a ceiling rather than a completion count.

**Validates: Requirements 2.8, 2.9, 3.3, 3.5**

## Fix Implementation

### Architecture and Module Boundaries

**`lib/clinicalPathways.ts` — pure clinical routing and evidence library**

Keep the existing `ClinicalPathway`, `RedFlag`, `DetectedRedFlag`, `coverageFor`, `requiredDimensions`, and `questionForDimension` concepts. Add a narrowly scoped chest-safety layer and source-aware safety evaluation in the same browser-safe pure module so client questioning and finalization cannot drift.

The proposed public types are:

```text
type EvidenceSource = "complaint" | "patient_answer" | "structured_safety_answer" | "clinician_input"
type SafetyScreenState = "unanswered" | "negative" | "positive" | "uncertain"
type ChestConfidence = "high" | "possible"

type ChestSafetyAssessment = {
  relevant: boolean
  confidence: ChestConfidence | null
  evidence: string[]
  profileId: "chest_pain" | null
}

type ClinicalContext = {
  pathway: ClinicalPathway | null
  chestSafety: ChestSafetyAssessment
  route: "curated_pathway" | "chest_safety_fallback" | "generic_fallback"
}

type SafetyEvidence = {
  source: EvidenceSource
  text: string
  questionDimension?: "red_flag_screen"
  state: SafetyScreenState
  signals: DetectedRedFlag[]
}
```

Names may be adjusted to local conventions, but the separation is required: pathway selection, chest-safety recognition, and explicit screening state must not be represented by one nullable pathway value.

Expose a new pure resolver, for example `resolveClinicalContext(complaint, extra?)`, while keeping `matchPathway(complaint, extra?)` source-compatible for existing callers. The resolver first evaluates the existing curated matcher, then applies the chest-specific recognition only when a meaningful chest combination is present. It must not change the result for unrelated pathways merely because the word `chest` or `seene` appears as a body location.

**`app/patient/appointment/page.tsx` — intake orchestration**

Replace the single `pathwayRef`-only decision with a context reference and retain source metadata for every deep answer. The fixed complaint answer resolves the context once. `patientTextsFrom` may continue to support coverage text aggregation, but `coverageFor` must additionally receive the explicit safety evidence or a structured evidence collection so complaint text cannot satisfy the safety dimension.

The AI prompt receives the resolved pathway/safety guidance. Deterministic fallback questions use `questionForDimension` against the resolved pathway/profile, so a null ordinary match can still ask chest-specific questions without turning the whole interview into a fixed questionnaire. Deep-question metadata records the target dimension for each deterministic question; answers to a question tagged `red_flag_screen` are eligible for explicit screen evidence.

**Finalization in the same page**

Build one `ClinicalContext` and one `SafetyEvaluation` from the complete evidence collection. Reuse those objects for the snapshot, report overlay, urgency comparison, and unresolved-screen annotation. Do not call a second differently configured chest detector in the overlay.

The separate legacy `app/api/intake/next/route.ts` generic decision tree is not expanded into a second chest questionnaire by this design. If it is later wired to this library, it must consume the same resolver and evidence contract rather than duplicate keyword logic.

### Recognition Algorithm and Decision Rules

1. **Normalize without losing language meaning.** Apply Unicode normalization, case folding, punctuation/whitespace normalization, and the existing Roman Hindi/Hinglish handling. Keep meaningful token boundaries. Add only reviewed chest vocabulary and variants; do not globally loosen every pathway synonym.

2. **Recognize meaningful chest combinations.** Use weighted token evidence in three groups:
   - location/cardiac anchors: `chest`, `seene`, `सीने`, `chhati`, `छाती`, `dil`, and supported left-sided forms such as `baaye taraf`, `left side`;
   - discomfort/quality anchors: `pain`, `dard`, `pressure`, `dabav`, `heaviness`, `bhaari`, `bharipan`, `burning`, `jalan`, `tightness`, `jakdan`, and reviewed natural variants;
   - acuity/modifier anchors: `sudden`, `achanak`, `abhi`, and equivalent terms.

   A high-confidence match requires a location/cardiac anchor plus a discomfort/quality anchor within a bounded token window, allowing inserted modifiers and conjunctions. Pressure, heaviness, or burning can serve as the quality anchor without requiring the word pain. Sudden onset and left-sided wording increase evidence and must be retained as coverage context, but neither alone creates a chest-pain match.

3. **Avoid generic false positives.** Do not route on standalone `pain`, `dard`, `pressure`, `chest`, `seene`, `left`, or `baaye`. Do not let a non-pain use of chest location, such as a chest rash or chest skin complaint, supersede its valid pathway. Add explicit non-chest controls to the test fixture.

4. **Preserve curated match precedence.** Run the existing matcher for all pathways. A high-confidence chest-safety assessment returns the curated `chest_pain` pathway when no stronger unrelated complaint is established. If an input contains both a valid unrelated pathway and explicit chest pain, preserve the unrelated pathway as the primary complaint only if the resolver attaches the chest safety profile and its required safety dimensions; never silently discard the safety concern. This prevents broad chest keywords from reclassifying ordinary cough, rash, or musculoskeletal complaints while preserving safety for an explicit concurrent chest complaint.

5. **Handle ordinary `null` safely.** When the ordinary matcher returns `null` but the chest assessment is `possible` or `high`, return a `ClinicalContext` with `pathway: null`, `route: chest_safety_fallback`, and a chest-derived safety profile. `requiredDimensions`/coverage then uses the chest profile’s applicable dimensions and curated questions, not the unrelated generic floor. A genuinely unrelated `null` remains `generic_fallback` with the existing four generic dimensions.

6. **Separate detection from screening completion.** `detectRedFlags` can continue to identify explainable signals from all patient words for clinician visibility and urgency preservation. However, `red_flag_screen` coverage must be computed from `SafetyEvidence` whose source is an explicit answer or structured safety response. Remove `chest`, `seene`, and ordinary complaint terms as standalone screen-completion cues. A positive signal in complaint context can make the route urgent while the screen state remains `unanswered`; it cannot be recorded as a completed negative screen.

7. **Use conservative evidence states.** An explicit affirmative answer with a recognized red-flag signal is `positive`. An explicit negative response to the targeted safety question is `negative` only when its scope is clear. `pata nahi`, `shayad`, an answer that addresses a different topic, missing answers, or contradictory answers are `uncertain`/`unanswered`. Uncertainty keeps the safety dimension missing and is surfaced to the clinician. It must not be converted to a safe negative by pathway selection, an AI `STOP`, generic answers, or reaching `MAX_DEEP`.

8. **Preserve urgency semantics.** Keep existing general and pathway red-flag IDs, signal text, and urgency values. Merge explicit detected signals without duplicates and retain the existing emergency-over-urgent ordering. The overlay may raise an AI report urgency to the worst deterministic signal, but never lower it. A positive chest signal remains emergency/urgent exactly according to the existing curated definition.

9. **Respect adaptive completion and `MAX_DEEP`.** Coverage remains the completion criterion. The matcher/profile supplies required dimensions; patient evidence can satisfy dimensions already addressed; deterministic questions target only missing dimensions. `MAX_DEEP` still prevents an unbounded loop. If it is reached while safety is unresolved, stop asking at the ceiling and persist an explicit unresolved-safety state/clinician-review limitation; never label the screen as safely passed. Non-chest behavior at the ceiling remains unchanged.

### Data and Control Flow

1. The complaint answer is stored as complaint-context evidence and passed to `resolveClinicalContext`.
2. The resolver returns the ordinary curated pathway, chest assessment, and route. The context is stored for the rest of the intake.
3. `coverageFor` receives all patient text for ordinary dimensions plus source-aware safety evidence for `red_flag_screen`. It returns missing/satisfied dimensions and evidence without treating complaint keywords as screening answers.
4. `nextDeepQuestion` asks an AI-phrased question only when it targets a missing dimension. On AI failure, duplicate output, or premature `STOP`, `questionForDimension` selects a curated chest question for chest route or the existing generic question for generic route.
5. Each answer is appended with its question/dimension metadata. A targeted safety answer is evaluated into `negative`, `positive`, or `uncertain`; complaint text remains context only.
6. Finalization builds the snapshot with pathway and detected signals, then invokes the same context/evidence safety evaluator for the deterministic overlay. The overlay adds explainable signals, escalates only when required, and records unresolved safety without implying a diagnosis.

### Compatibility and Regression Considerations

- Keep `matchPathway`’s existing return type and behavior available to current callers. Add the richer resolver rather than forcing every caller to understand a union type.
- Keep all existing `PATHWAYS` IDs, non-chest synonym scores, red-flag IDs, signal wording, urgency values, core questions, and governance metadata unchanged unless a narrowly reviewed chest synonym addition is required.
- Do not replace `GENERIC_REQUIRED_DIMENSIONS` with a chest or universal list. Only the explicit chest fallback receives chest-specific requirements.
- Preserve adaptive dimension derivation from pathway data. The chest profile may reuse `chest_pain`’s requirements, but it must not make all unmatched complaints require relevant history and a red-flag screen.
- Preserve report, appointment, transcript, and queue payload shapes where possible. If unresolved safety needs to be stored, add an optional field rather than changing existing fields or inferring a diagnosis.
- Treat the investigation corpus as a test fixture, not production vocabulary copied from an unreviewed source. The six additional literals must be imported verbatim from the investigation findings. The current repository does not contain that report, and the requirements mention both “eight” total phrases and “six missed plus three named” phrases (which would total nine). Before implementation, assert that the authoritative fixture contains exactly eight entries, includes the three named phrases, and reconcile any source count mismatch explicitly. Never invent, silently deduplicate, or silently omit a phrase to make the count pass.

### Explicit Non-Goals

- No diagnosis of myocardial infarction, angina, reflux, musculoskeletal pain, or any other condition.
- No prescription, treatment recommendation, emergency medical advice generator, or replacement for clinician triage.
- No universal questionnaire, fixed question sequence, guaranteed minimum count, or removal of adaptive coverage.
- No broad rewrite of all pathway matching or generic red-flag semantics.
- No automatic inference that left-sided, sudden, burning, pressure, or heaviness wording is itself an emergency; urgency still depends on explicit established pathway/general signals.
- No use of AI output as authoritative safety evidence without attributable patient/structured-screen evidence.
- No modification to unrelated production modules, tests, package files, or the coverage model during this design phase.

## Testing Strategy

### Validation Approach

Validation follows the bug-condition methodology: first demonstrate failures on the unfixed behavior, then verify the recognition and evidence fixes, and finally run preservation checks against unrelated pathways and non-chest controls. Tests should exercise pure library functions directly and use source/integration contracts for the appointment orchestration and final overlay. The test corpus must retain exact input strings, not normalized substitutes.

### Exploratory Bug Condition Checking

**Goal:** Reproduce the existing failures and confirm the two root causes before implementation.

**Test plan:** Run the ordinary matcher and current coverage model against the authoritative investigation corpus. Record which entries return `null` or a non-chest pathway, and separately show that `coverageFor(chestPathway, [complaint])` reports `red_flag_screen` satisfied for complaint-only inputs containing `chest` or `seene`.

**Required exploratory cases:**

1. `Mere seene mein pressure aur dard ho raha hai` — expected current miss or generic route.
2. `Seene mein dard hai` — expected current chest match but unsafe complaint-only screen completion.
3. `Baaye taraf seene mein dard ho raha hai` — expected current chest match but unsafe complaint-only screen completion.
4. The remaining five exact literals from the investigation corpus, copied verbatim and labeled with their source order. If the investigation artifact actually contains six missed literals, the corpus-integrity check must fail and the discrepancy must be resolved before implementation.
5. Complaint-only variants containing pressure, heaviness, burning, sudden onset, inserted words, and left-sided wording.
6. `persistent cough`, `pet mein dard`, `bukhar`, `headache`, `seene mein khujli`, `dard`, `pressure`, and `chest` as non-chest/generic controls.

**Expected counterexamples:** missed chest route, generic four-dimension fallback for a chest-equivalent complaint, or `red_flag_screen` satisfied by a complaint token without an explicit safety answer.

### Fix Checking

**Goal:** Verify the bug-condition property for every exact corpus entry and supported natural variant.

```text
FOR ALL phrase IN authoritativeEightPhraseCorpus DO
  context := resolveClinicalContext(phrase)
  ASSERT context.route IN {curated_pathway, chest_safety_fallback}
  ASSERT context.pathway.id = "chest_pain" OR context.chestSafety.relevant = true

  coverage := coverageFor(context, complaintEvidenceOnly(phrase))
  ASSERT coverage.required includes chest-relevant adaptive dimensions
  ASSERT coverage.red_flag_screen is missing
END FOR
```

The fix suite must additionally generate bounded inserted-word variants from approved anchors, vary case/punctuation/Unicode and Roman Hindi spelling, and exercise pressure, heaviness, burning, sudden, and left-sided forms. Generated variants must be constrained to clinically reviewed vocabulary; this is a recognition robustness test, not an open-ended language model test.

Explicit safety evidence cases must assert:

- Complaint-only `Seene mein dard hai` remains `unanswered` and cannot complete `red_flag_screen`.
- A clear negative answer to the targeted screen becomes `negative` and allows that dimension to be satisfied without raising urgency.
- A clear affirmative radiation/sweating/breathlessness answer retains the existing emergency signal and urgency.
- `pata nahi`, `shayad`, missing answers, and contradictory answers remain unresolved; they do not become a safe pass.
- A null ordinary match with chest meaning uses the chest safety fallback, while a null ordinary match such as `something feels bad` keeps the generic four dimensions.

### Preservation Checking

**Goal:** Prove `F'(x) = F(x)` for `¬C(x)` and preserve explicit established safety behavior.

Run the existing preservation suites plus focused comparisons for:

1. Every non-chest curated pathway (`cough_breathing`, abdominal pain, fever, headache, urinary, back pain, rash, mental health, and vomiting) retains its pathway ID, required dimensions, curated question availability, and red-flag semantics.
2. Generic unmatched controls remain on the generic floor and do not gain chest `relevant_history` or `red_flag_screen` requirements.
3. A chest word in an unrelated complaint (`chest rash`, `chest itching`, or a cough-only control) does not falsely select `chest_pain`; explicit concurrent chest pain is the only case that attaches the safety profile.
4. Existing explicit general red flags (`unconscious`, severe breathing difficulty, uncontrolled bleeding, very high fever/seizure, dehydration) retain their signals, source, urgency, and ordering.
5. Existing explicit chest red flags for radiation, sweating, breathlessness, and exertion retain their signal and emergency/urgent distinction.
6. Covered dimensions continue to be skipped; required dimension sets differ by pathway; no test asserts a fixed count. `MAX_DEEP` remains a ceiling and is never used as the completeness predicate.
7. AI `STOP`, duplicate, blank, and failure branches still use deterministic missing-dimension questions. Unresolved chest safety is surfaced rather than silently completed when the ceiling is reached.
8. No report or UI output introduces diagnostic language; persistence and appointment behavior for non-buggy inputs remains byte/shape compatible where the current tests require it.

### Unit Tests

- Test normalization and chest token scoring for all exact corpus entries, inserted-word variants, punctuation/case, Roman Hindi, and Hindi Unicode.
- Test pressure, heaviness, burning, sudden-onset, and left-sided chest forms, including quality-only forms that do not contain `dard`.
- Test standalone generic words and non-chest controls do not match chest safety.
- Test ordinary pathway precedence and null-pathway chest fallback.
- Test source-aware `red_flag_screen` states: complaint-only, explicit negative, explicit positive, ambiguous, and contradictory.
- Test unchanged red-flag IDs, signal text, urgency ordering, duplicate merging, and AI-urgency non-downgrade behavior.

### Property-Based Tests

- Generate approved chest anchor combinations with bounded inserted modifiers and assert chest routing for every generated case.
- Generate non-chest pathway complaints and generic controls, including chest as a non-pain body-location word, and assert unchanged pathway/fallback results.
- Generate evidence streams with complaint context separated from explicit safety answers and assert that only eligible sources can satisfy `red_flag_screen`.
- Generate missing, ambiguous, and contradictory safety answers and assert no unresolved state is represented as safely negative.
- Generate varied numbers of covered and uncovered dimensions and assert adaptive completion behavior; separately assert that `MAX_DEEP` only bounds question attempts.

### Integration Tests

- Exercise the appointment flow with each exact corpus phrase one at a time through complaint capture, deep questioning, final snapshot, deterministic overlay, and persisted report payload.
- Verify a complaint-only chest phrase reaches the chest safety route, asks/records explicit red-flag screening, and does not complete that dimension from the initial text.
- Verify a chest complaint with explicit radiation/sweating/breathlessness reaches the existing emergency/urgent overlay behavior and that the same signal appears in the doctor-facing report.
- Verify an ordinary unmatched non-chest complaint still follows the generic adaptive route and does not acquire chest questions.
- Verify switching between AI phrasing and deterministic fallback uses the same context and does not introduce duplicate or fixed-count questions.
- Verify unresolved safety at the `MAX_DEEP` ceiling is recorded as unresolved/clinician-review-needed rather than as a passed screen, without changing non-chest appointment persistence.

### Validation Corpus Integrity Gate

The validation harness must load the eight exact phrases from the investigation findings as an immutable fixture and assert:

```text
ASSERT corpus.length = 8
ASSERT corpus includes "Mere seene mein pressure aur dard ho raha hai"
ASSERT corpus includes "Seene mein dard hai"
ASSERT corpus includes "Baaye taraf seene mein dard ho raha hai"
ASSERT every entry is a non-empty verbatim investigation string
```

Because the available requirements text also says “six currently missed phrases” while naming one observed phrase and two matching examples, the harness must report a clear source-count error if the findings contain nine entries or if any named entry is absent. This is a prerequisite for implementation and prevents a seemingly passing test suite from validating the wrong corpus.
