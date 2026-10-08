def preference_plan(config: dict) -> dict:
    return {
        "enabled": False,
        "future_method": "DPO",
        "base_model": config["model"]["name"],
        "reason": "Not required for first runnable milestone",
    }
