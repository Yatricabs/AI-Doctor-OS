# Bugfix Requirements Document

## Introduction

This bugfix addresses a clinical-safety defect in appointment symptom intake: common Hindi/Hinglish descriptions of chest pressure or pain can fail to select the existing `chest_pain` pathway and instead fall through to the generic intake floor. The resulting flow can omit chest-pain-specific history and safety screening before the appointment is completed. A related boundary defect is that the initial complaint text can currently satisfy `red_flag_screen` cues merely because it contains words such as “chest” or “seene”, even though the patient has not explicitly answered the safety-screen question.

The bug condition is `C(X) = X is one of the eight reported chest-pain expressions, or X is an equivalent chest-pain/pressure complaint that the supported matcher is expected to recognize, and the matcher either returns no chest-pain pathway or the intake treats complaint wording as completed safety-screen evidence`. `F` is the current matcher and intake flow; `F'` is the fixed flow. The fix-checking property is: for every `X` where `C(X)` is true, `F'(X)` selects or safely routes to the chest-pain-relevant adaptive coverage and does not mark safety screening complete without explicit evidence. The preservation property is: for every `X` where `C(X)` is false, `F'(X)` preserves the existing valid pathway, adaptive coverage, urgency handling, and appointment behavior.

The Expected Behavior clauses are the acceptance criteria for the fix. Validation SHALL use the complete eight-phrase investigation corpus; the exact observed phrase and the two currently matching examples are named below, while the remaining corpus phrases SHALL be taken verbatim from the investigation report rather than replaced with invented examples.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the patient says “Mere seene mein pressure aur dard ho raha hai” THEN the system can return no pathway, fall to the generic floor, and omit the `chest_pain` pathway’s relevant history and red-flag screening.

1.2 WHEN a patient uses one of the other six reported chest-pain expressions that contains inserted words or describes pressure, heaviness, burning, or a colloquial equivalent not present as a contiguous current synonym THEN the system can fail to match `chest_pain`, even though the expression describes the same safety-relevant complaint.

1.3 WHEN the patient says “Seene mein dard hai” or “Baaye taraf seene mein dard ho raha hai” THEN the system can match `chest_pain`, but the complaint’s own “chest” or “seene” wording can also satisfy the current `red_flag_screen` cue logic without an explicit safety-screen response.

1.4 WHEN `matchPathway()` returns `null` for a chest-pain-equivalent complaint THEN the system supplies only the generic four required dimensions, with no pathway-specific `relevant_history` or `red_flag_screen` dimension and no other deterministic layer that compensates for the missing pathway.

1.5 WHEN a chest-pain complaint is matched only by the current contiguous-synonym scoring behavior THEN recognition depends on the best synonym score reaching the existing threshold, so natural phrasing with word insertion or a missing pressure/heaviness/burning variant can be routed as if it were an unrelated complaint.

1.6 WHEN intake reaches a safety-screen state using complaint text alone rather than an explicit answer or other explicit safety evidence THEN the system can record the screen as covered even though the patient has not confirmed or denied the relevant red flags.

### Expected Behavior (Correct)

2.1 WHEN any of the eight reported phrase inputs is submitted, including “Mere seene mein pressure aur dard ho raha hai”, “Seene mein dard hai”, and “Baaye taraf seene mein dard ho raha hai” THEN the system SHALL recognize the complaint as chest-pain-equivalent and SHALL select the `chest_pain` pathway or an explicitly equivalent safety-preserving route rather than silently falling to the unrelated generic floor.

2.2 WHEN a chest-pain-equivalent complaint is recognized THEN the system SHALL retain the adaptive coverage model and SHALL require the pathway-relevant information needed for safe review, including applicable onset/duration, location, character or pressure, severity/acuity, associated symptoms, relevant history, and pathway-specific red-flag screening; covered information MAY satisfy a dimension when it is actually present, so redundant questions SHALL remain avoidable.

2.3 WHEN a recognized chest-pain complaint includes or the patient later provides radiation, sweating, breathlessness, or exertion-related information THEN the system SHALL preserve the existing pathway red-flag semantics and urgency distinctions, including emergency versus urgent handling where the explicit evidence meets those pathway rules.

2.4 WHEN the intake evaluates `red_flag_screen` for a chest-pain complaint THEN the system SHALL treat the initial complaint wording as context only and SHALL mark the safety screen complete only when an explicit patient answer or other explicit safety-screen evidence addresses the relevant red flags; the presence of “chest”, “seene”, or another symptom keyword alone SHALL NOT count as a completed screen.

2.5 WHEN a complaint is not matched to a pathway but contains a chest-pain-equivalent meaning or otherwise presents a plausible chest-safety concern THEN the system SHALL not complete intake on generic answers alone; it SHALL use the configured adaptive fallback or another safety-preserving route to obtain explicit safety-screen evidence before completion, without requiring a universal questionnaire or a predetermined question count.

2.6 WHEN an unrelated complaint remains genuinely unmatched to a curated pathway and does not present the chest-pain-equivalent safety condition THEN the system SHALL preserve the existing generic fallback behavior and its generic required dimensions, without fabricating chest-pain questions or red flags.

2.7 WHEN the complete eight-phrase validation corpus is exercised one input at a time THEN each phrase SHALL produce the chest-pain pathway or an explicitly equivalent safety-preserving route, the relevant adaptive dimensions SHALL be requested or satisfied from explicit evidence, and no phrase SHALL be accepted as completing `red_flag_screen` solely because of its wording. The validation SHALL include the six currently missed phrases verbatim from the investigation corpus, not only the three examples named in this document.

2.8 WHEN adaptive coverage determines that some required information is already covered and other information is missing THEN the system SHALL ask only the missing relevant questions, SHALL not replace adaptive coverage with a rigid universal questionnaire or fixed question count, and SHALL preserve `MAX_DEEP` as a ceiling rather than a guaranteed number of questions.

2.9 WHEN the fixed flow presents or records chest-pain information THEN it SHALL not infer, assert, or imply a diagnosis from pathway selection, synonym recognition, red-flag answers, urgency, or missing information; it SHALL remain an intake and safety-screening flow.

2.10 WHEN explicit safety-screen evidence is absent, ambiguous, or contradictory THEN the system SHALL preserve that uncertainty as incomplete or unresolved safety information and SHALL not represent the screen as safely passed merely because a pathway was selected or generic intake completed.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a non-chest complaint matches an existing curated pathway under the existing valid matcher behavior THEN the system SHALL CONTINUE TO select that pathway and apply its existing relevant coverage and red-flag semantics without being reclassified as chest pain.

3.2 WHEN a recognized pathway’s required information is explicitly present in the complaint or prior answers THEN the system SHALL CONTINUE TO allow adaptive coverage to skip redundant questions while retaining any still-missing relevant history and safety-screen dimensions.

3.3 WHEN the flow is handling any complaint THEN the system SHALL CONTINUE TO use adaptive coverage rather than a rigid universal questionnaire, SHALL not impose a fixed question count, and SHALL preserve `MAX_DEEP` as the maximum-depth ceiling.

3.4 WHEN pathway selection, question generation, or coverage evaluation has insufficient evidence THEN the system SHALL CONTINUE TO avoid diagnosis inference and SHALL not turn a symptom match or red-flag cue into a diagnostic conclusion.

3.5 WHEN a patient provides explicit evidence for a pathway red flag or urgency condition THEN the system SHALL CONTINUE TO apply the established pathway-specific urgency behavior; this bugfix SHALL not weaken, hide, or downgrade an existing explicit emergency or urgent signal.

3.6 WHEN complaint text contains ordinary symptom words but no explicit safety-screen response THEN the system SHALL CONTINUE to preserve those words as complaint context while treating the associated safety dimension as unanswered, rather than treating keyword presence as affirmative or negative clinical evidence.

3.7 WHEN the complaint is genuinely unrelated to chest pain and has no chest-safety concern THEN the system SHALL CONTINUE to support the current unmatched-pathway generic behavior, subject to the existing valid intake and appointment-completion rules.

3.8 WHEN valid patient, appointment, coverage, snapshot, and final red-flag-overlay data are produced for a non-buggy input THEN the system SHALL CONTINUE to persist and display the established appointment flow behavior; this requirements change SHALL not alter unrelated appointment functionality.
