from pathlib import Path
from ai_upchar_llm.config import load_config

ROOT = Path(__file__).parents[1]

def test_models_are_configuration_driven():
    assert load_config(ROOT / "configs/qwen3-4b.yaml")["model"]["name"] == "Qwen/Qwen3-4B-Base"
    assert load_config(ROOT / "configs/qwen3-8b.yaml")["model"]["name"] == "Qwen/Qwen3-8B-Base"

def test_qlora_parameters_are_in_yaml():
    config = load_config(ROOT / "configs/base.yaml")
    assert config["training"]["method"] == "qlora" and config["quantization"]["bits"] == 4
