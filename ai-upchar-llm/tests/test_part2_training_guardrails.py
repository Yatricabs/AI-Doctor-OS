from pathlib import Path

from ai_upchar_llm.config import load_config


ROOT = Path(__file__).parents[1]


def test_v15_training_is_single_gpu_and_evaluation_is_deferred():
    config = load_config(ROOT / "configs/qwen3-4b-part2-advanced-v15.yaml")
    training = config["training"]
    assert config["model"]["name"] == "Qwen/Qwen3-4B-Base"
    assert config["quantization"]["enabled"] is True
    assert config["quantization"]["quant_type"] == "nf4"
    assert config["quantization"]["double_quant"] is True
    assert training["device_map"] == "single_gpu"
    assert training["eval_during_training"] is False
    assert training["evaluate_after_training"] is False
    assert config["data"]["production_approved"] is False


def test_training_saves_before_optional_evaluation():
    source = (ROOT / "src/ai_upchar_llm/training/sft.py").read_text(encoding="utf-8")
    save_position = source.index("trainer.save_model()")
    evaluate_position = source.index("trainer.evaluate()")
    assert save_position < evaluate_position
    assert "device_map=device_map" in source
    assert 'gradient_checkpointing_kwargs={"use_reentrant": False}' in source


def test_training_supports_explicit_trainable_adapter_continuation():
    source = (ROOT / "src/ai_upchar_llm/training/sft.py").read_text(encoding="utf-8")
    assert 'config["training"].get("initial_adapter_path")' in source
    assert "PeftModel.from_pretrained(" in source
    assert "is_trainable=True" in source
    assert "Initial adapter is incomplete" in source
