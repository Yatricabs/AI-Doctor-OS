from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal

TaskType = Literal["clinical_knowledge", "semantic_extraction", "patient_context_reasoning", "next_best_question", "safety_prioritization", "clarification", "multiple_problem_reasoning", "medication_adverse_effect", "patient_reported_diagnosis", "clinical_summarization", "evidence_interpretation", "preference"]


@dataclass(frozen=True)
class SourceMetadata:
    source_id: str
    source_name: str
    source_type: str
    title: str
    license: str
    retrieval_date: str
    language: str
    domain: str
    quality_status: str
    authors: list[str] = field(default_factory=list)
    publication_date: str | None = None
    url: str | None = None


@dataclass(frozen=True)
class PrivacyReview:
    contains_patient_data: bool
    deidentified: bool
    eligibility_status: Literal["PENDING", "REJECTED", "APPROVED"]


@dataclass(frozen=True)
class TrainingExample:
    id: str
    task_type: TaskType
    language: Literal["english", "hindi", "hinglish", "mixed"]
    messages: list[dict[str, str]]
    source: SourceMetadata
    privacy: PrivacyReview

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def validate(self) -> None:
        if not self.id or len(self.messages) < 2:
            raise ValueError("An example needs an id and at least two messages")
        if not self.source.license or self.source.quality_status.startswith("REJECTED"):
            raise ValueError("Source license and approved quality status are required")
        if self.privacy.contains_patient_data or not self.privacy.deidentified or self.privacy.eligibility_status != "APPROVED":
            raise ValueError("Only approved, deidentified, non-patient exports may train")
