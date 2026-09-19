def compare_scores(baseline: dict, candidate: dict, tolerance: float = 0.0) -> dict:
    delta = candidate["passed"] - baseline["passed"]
    return {"passed": delta >= -tolerance, "delta": delta}
