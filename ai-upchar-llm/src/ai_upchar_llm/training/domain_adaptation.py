def build_domain_training_args(config: dict) -> dict:
    return {
        "model_name": config["model"]["name"],
        "output_dir": config["training"]["output_dir"],
        "max_sequence_length": config["model"]["max_sequence_length"],
        "seed": config["project"]["seed"],
    }
