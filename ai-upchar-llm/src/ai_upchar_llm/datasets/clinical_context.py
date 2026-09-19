from dataclasses import dataclass, field


@dataclass(frozen=True)
class ClinicalContextTarget:
    problems: list[dict[str, str]] = field(default_factory=list)
    temporal_facts: list[str] = field(default_factory=list)
    triggers: list[str] = field(default_factory=list)
    associated_symptoms: list[str] = field(default_factory=list)
    patient_reported_diagnoses: list[str] = field(default_factory=list)
    confirmed_diagnoses: list[str] = field(default_factory=list)
