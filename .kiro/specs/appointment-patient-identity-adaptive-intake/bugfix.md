# Bugfix Requirements Document

## Introduction

This bugfix addresses two failures in the patient appointment flow: patient identity can change or be routed to the wrong phone-associated record during appointment creation, and symptom intake can stop after generic questions without collecting the complaint-specific information needed for safe clinician review. The fix must be checked for every input that triggers either defect while preserving the existing behavior for non-triggering inputs.

For bug-condition methodology, let `C(X)` identify an appointment/intake input where the entered patient identity conflicts with the selected or phone-associated patient record, or where a complaint requires adaptive complaint-specific questioning. The fix-checking property is: for every `X` where `C(X)` is true, the resulting appointment and intake state satisfies the expected behavior in Section 2. The preservation property is: for every `X` where `C(X)` is false, the fixed flow continues to produce the same valid patient, appointment, routing, and intake behavior described in Section 3 as the original flow.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a patient is entered as one identity, such as Vijay Verma, and the appointment flow encounters an existing or previously selected phone-associated record for a different identity, such as Rohan Mehta, THEN the system can silently use the other patient record and display or route the appointment under the wrong patient identity.

1.2 WHEN a new patient’s phone number matches a phone record belonging to another patient THEN the system can silently associate the new patient with that existing patient instead of preserving the newly entered identity as a distinct, confirmed patient.

1.3 WHEN a complaint such as “seene me tez dard hai pichale 2 din se” matches an available complaint-specific clinical pathway THEN the system can ask only generic questions, such as whether the patient has seen a doctor or has reports, and create the appointment without asking the pathway’s relevant deep questions or completing the associated safety screening.

1.4 WHEN a complaint needs adaptive complaint-specific questioning but no usable curated pathway is selected THEN the system can stop after generic questions and create the appointment without using an available research/AI fallback to gather the minimum relevant information.

### Expected Behavior (Correct)

2.1 WHEN a patient is entered with an identity and an appointment is created for that patient THEN the system SHALL preserve the confirmed patient identity consistently through patient creation or selection, appointment creation, success display, and doctor routing, with no substitution from another patient record.

2.2 WHEN the entered patient identity conflicts with the identity associated with an existing phone record THEN the system SHALL not silently reuse or overwrite the other patient’s record; it SHALL require explicit resolution or confirmation and SHALL create, select, display, and route the appointment only against the resolved identity.

2.3 WHEN a complaint matches a curated clinical pathway THEN the system SHALL use that pathway as the starting frame and ask at least the pathway’s minimum relevant deep questions before completing the appointment intake, including complaint-specific duration/onset, characteristics or location, severity or acuity where relevant, associated symptoms, and pathway-specific red-flag screening.

2.4 WHEN the complaint is chest pain or an equivalent recognized Hindi/Hinglish expression, including “seene me tez dard,” THEN the system SHALL not complete intake after only generic doctor/report questions; it SHALL collect the available chest-pain pathway questions needed to establish onset/current status, location, character, radiation, exertional pattern, associated breathlessness/sweating/nausea/dizziness, relevant history, and emergency or urgent red flags.

2.5 WHEN a complaint requires adaptive complaint-specific questioning and no curated pathway is available or the pathway cannot answer the next relevant question THEN the system SHALL use the configured research/AI fallback to continue asking relevant questions, perform the applicable safety screening, and SHALL not prematurely complete the appointment with only generic answers.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the entered patient identity is unambiguous and does not conflict with another patient record THEN the system SHALL CONTINUE TO create or select the intended patient and use that same identity for the appointment, success display, and doctor routing.

3.2 WHEN a phone number belongs to the same confirmed patient identity that the user entered or selected THEN the system SHALL CONTINUE TO reuse the valid patient record and must not create an unnecessary duplicate solely because the identity-preservation fix is present.

3.3 WHEN a complaint does not trigger a curated pathway or adaptive-intake bug condition and the existing intake answers are sufficient for the configured flow THEN the system SHALL CONTINUE TO complete the appointment using the existing valid intake, appointment creation, and routing behavior.

3.4 WHEN a curated pathway is correctly selected and its relevant questions have already been answered by the patient’s complaint or prior responses THEN the system SHALL CONTINUE TO allow the adaptive flow to skip covered or redundant questions while retaining the pathway’s safety screening and minimum information requirements.

3.5 WHEN the appointment flow receives valid patient, complaint, contact, and intake data that does not trigger an identity conflict or premature-questioning condition THEN the system SHALL CONTINUE TO persist the appointment successfully and show the established success state without changing unrelated appointment-flow behavior.
