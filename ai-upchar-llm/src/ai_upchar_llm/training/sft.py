from __future__ import annotations

from pathlib import Path


def _resolve_device_map(config: dict) -> str | dict | None:
    """Resolve the model placement used by the single-process Kaggle trainer.

    ``device_map=\"auto\"`` can shard a quantized model across both Kaggle T4s.
    That is unsafe for this Trainer path: the failed V14 run emitted an
    AccumulateGrad stream-mismatch warning and then crashed during evaluation.
    A config value of ``single_gpu`` deliberately keeps the whole model on GPU
    0 while preserving QLoRA/4-bit loading.
    """
    device_map = config["training"].get("device_map", "auto")
    if device_map == "single_gpu":
        return {"": 0}
    return device_map


def configure_assistant_mask_chat_template(tokenizer):
    """Install the deterministic template required by TRL assistant-only loss."""
    tokenizer.chat_template = (
        "{% for message in messages %}"
        "{% if message['role'] == 'user' %}"
        "{{ '<|im_start|>user\\n' + message['content'] + '<|im_end|>\\n' }}"
        "{% elif message['role'] == 'system' %}"
        "{{ '<|im_start|>system\\n' + message['content'] + '<|im_end|>\\n' }}"
        "{% elif message['role'] == 'assistant' %}"
        "{{ '<|im_start|>assistant\\n' }}{% generation %}{{ message['content'] }}{% endgeneration %}{{ '<|im_end|>\\n' }}"
        "{% endif %}"
        "{% endfor %}"
        "{% if add_generation_prompt %}{{ '<|im_start|>assistant\\n' }}{% endif %}"
    )
    return tokenizer


def train_sft(config: dict, smoke: bool = False) -> dict:
    if smoke:
        from .smoke import run_smoke_training

        return run_smoke_training(config)
    import torch
    from datasets import Dataset
    from peft import LoraConfig, PeftModel, prepare_model_for_kbit_training
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from trl import SFTConfig, SFTTrainer
    from ai_upchar_llm.datasets.sft_dataset import (
        conversational_rows,
        load_candidate_conversations,
        load_sft,
    )
    from ai_upchar_llm.training.real_qlora import _append_assistant_eos

    model_name = config["model"]["name"]
    quant = config["quantization"]
    compute_dtype = {"float16": torch.float16, "bfloat16": torch.bfloat16}[quant["compute_dtype"]]
    bnb = BitsAndBytesConfig(
        load_in_4bit=quant["enabled"],
        bnb_4bit_quant_type=quant["quant_type"],
        bnb_4bit_use_double_quant=quant["double_quant"],
        bnb_4bit_compute_dtype=compute_dtype,
    )
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    device_map = _resolve_device_map(config)
    if device_map == {"": 0}:
        torch.cuda.set_device(0)
    model = prepare_model_for_kbit_training(
        AutoModelForCausalLM.from_pretrained(
            model_name, quantization_config=bnb, device_map=device_map
        )
    )
    lora = config["lora"]
    initial_adapter = config["training"].get("initial_adapter_path")
    if initial_adapter:
        initial_adapter_path = Path(initial_adapter)
        required = ("adapter_config.json", "adapter_model.safetensors")
        missing = [name for name in required if not (initial_adapter_path / name).is_file()]
        if missing:
            raise FileNotFoundError(
                f"Initial adapter is incomplete at {initial_adapter_path}: {missing}"
            )
        model = PeftModel.from_pretrained(model, str(initial_adapter_path), is_trainable=True)
        peft_config = None
    else:
        peft_config = LoraConfig(
            r=lora["rank"],
            lora_alpha=lora["alpha"],
            lora_dropout=lora["dropout"],
            target_modules=lora["target_modules"],
            task_type="CAUSAL_LM",
        )

    # Robust chat template to prevent token merging issues with assistant_only_loss
    configure_assistant_mask_chat_template(tokenizer)

    if config["data"].get("candidate_preproduction_only"):
        rows = load_candidate_conversations(config["data"]["sft_path"])
    else:
        rows = conversational_rows(load_sft(config["data"]["sft_path"]))
    if config["training"].get("append_assistant_eos"):
        rows = _append_assistant_eos(rows, tokenizer.eos_token)
    split = Dataset.from_list(rows).train_test_split(
        test_size=config["training"]["eval_split"], seed=config["project"]["seed"]
    )
    use_fp16 = quant["compute_dtype"] == "float16"
    use_bf16 = quant["compute_dtype"] == "bfloat16"
    eval_during_training = config["training"].get("eval_during_training", True)
    eval_strategy = (
        config["training"].get("eval_strategy", "epoch") if eval_during_training else "no"
    )
    save_strategy = config["training"].get("save_strategy", "epoch")
    args = SFTConfig(
        output_dir=config["training"]["output_dir"],
        num_train_epochs=config["training"]["epochs"],
        learning_rate=config["training"]["learning_rate"],
        per_device_train_batch_size=config["training"]["per_device_train_batch_size"],
        gradient_accumulation_steps=config["training"]["gradient_accumulation_steps"],
        gradient_checkpointing=config["training"]["gradient_checkpointing"],
        gradient_checkpointing_kwargs={"use_reentrant": False},
        max_length=config["model"]["max_sequence_length"],
        assistant_only_loss=config["training"]["assistant_only_loss"],
        eval_strategy=eval_strategy,
        save_strategy=save_strategy,
        logging_steps=config["training"]["logging_steps"],
        seed=config["project"]["seed"],
        fp16=use_fp16,
        bf16=use_bf16,
        report_to="none",
    )
    trainer = SFTTrainer(
        model=model,
        args=args,
        train_dataset=split["train"],
        eval_dataset=split["test"],
        processing_class=tokenizer,
        peft_config=peft_config,
    )
    train_result = trainer.train()
    # Persist the adapter/state before any post-training evaluation.  A CUDA
    # failure in eval must never discard a completed training run.
    trainer.save_model()
    trainer.save_state()
    tokenizer.save_pretrained(Path(args.output_dir))
    eval_metrics = None
    evaluation_status = "deferred"
    if config["training"].get("evaluate_after_training", True):
        try:
            torch.cuda.synchronize()
            eval_metrics = trainer.evaluate()
            evaluation_status = "passed"
        except RuntimeError as error:
            eval_metrics = {"status": "failed", "error": f"{type(error).__name__}: {error}"}
            evaluation_status = "failed"
    checkpoints = sorted(
        path.name for path in Path(args.output_dir).glob("checkpoint-*") if path.is_dir()
    )
    return {
        "status": "trained" if evaluation_status != "failed" else "trained_evaluation_failed",
        "output_dir": args.output_dir,
        "examples": len(rows),
        "train_examples": len(split["train"]),
        "eval_examples": len(split["test"]),
        "global_step": trainer.state.global_step,
        "train_metrics": train_result.metrics,
        "eval_metrics": eval_metrics,
        "evaluation_status": evaluation_status,
        "checkpoints": checkpoints,
    }
