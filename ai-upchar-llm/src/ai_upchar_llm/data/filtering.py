ALLOWED_SOURCE_TYPES = {
    "GOVERNMENT",
    "PUBLIC_HEALTH",
    "RESEARCH",
    "PEER_REVIEWED",
    "INSTITUTIONAL",
    "GUIDELINE",
    "LICENSED",
    "CURATED_INTERNAL",
    "APPROVED_SYNTHETIC",
}


def eligible_source(source: dict) -> tuple[bool, str]:
    if source.get("source_type") not in ALLOWED_SOURCE_TYPES:
        return False, "UNAPPROVED_SOURCE_TYPE"
    if not source.get("license"):
        return False, "MISSING_LICENSE"
    if not str(source.get("quality_status", "")).startswith("APPROVED"):
        return False, "QUALITY_NOT_APPROVED"
    return True, "APPROVED"
