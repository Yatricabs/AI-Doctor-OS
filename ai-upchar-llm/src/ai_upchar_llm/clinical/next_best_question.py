ALLOWED_ACTIONS = {"ASK_QUESTION", "CLARIFY", "SAFETY_REVIEW"}


def validate_reasoning_response(value: dict) -> None:
    if value.get("recommended_action") not in ALLOWED_ACTIONS:
        raise ValueError("Unsupported recommendation")
    if not isinstance(value.get("semantic_interpretation"), dict):
        raise ValueError("semantic_interpretation is required")
    if value.get("recommended_action") == "ASK_QUESTION" and not value.get("next_best_question"):
        raise ValueError("ASK_QUESTION requires one next question")
