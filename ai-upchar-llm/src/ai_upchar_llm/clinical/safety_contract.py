SAFETY_ACTION = "SAFETY_REVIEW"


def enforce_safety_floor(application_safety: dict, recommendation: dict) -> dict:
    if application_safety.get("status") == "SAFETY_CONCERN":
        return {
            **recommendation,
            "recommended_action": SAFETY_ACTION,
            "next_best_question": recommendation.get("next_best_question")
            or "Please confirm the urgent warning signs for immediate safety review.",
        }
    return recommendation
