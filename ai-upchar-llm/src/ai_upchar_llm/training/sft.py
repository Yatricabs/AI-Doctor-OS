from __future__ import annotations

from pathlib import Path


def train_sft(config: dict, smoke: bool = False) -> dict:
    if smoke:
        from .smoke import run_smoke_training
        return run_smoke_training(config)
    from datasets import Dataset
    from peft import LoraConfig, prepare_model_for_kbit_training
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from trl import SFTConfig, SFTTrainer
    from ai_upchar_llm.datasets.sft_dataset import conversational_rows, load_sft

    model_name = config["model"]["name"]
    quant = config["quantization"]
    bnb = BitsAndBytesConfig(load_in_4bit=quant["enabled"], bnb_4bit_quant_type=quant["quant_type"], bnb_4bit_use_double_quant=quant["double_quant"])
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = prepare_model_for_kbit_training(AutoModelForCausalLM.from_pretrained(model_name, quantization_config=bnb, device_map="auto"))
    lora = config["lora"]
    peft_config = LoraConfig(r=lora["rank"], lora_alpha=lora["alpha"], lora_dropout=lora["dropout"], target_modules=lora["target_modules"], task_type="CAUSAL_LM")
    rows = conversational_rows(load_sft(config["data"]["sft_path"]))
    split = Dataset.from_list(rows).train_test_split(test_size=config["training"]["eval_split"], seed=config["project"]["seed"])
    args = SFTConfig(output_dir=config["training"]["output_dir"], num_train_epochs=config["training"]["epochs"], learning_rate=config["training"]["learning_rate"], per_device_train_batch_size=config["training"]["per_device_train_batch_size"], gradient_accumulation_steps=config["training"]["gradient_accumulation_steps"], gradient_checkpointing=config["training"]["gradient_checkpointing"], max_length=config["model"]["max_sequence_length"], assistant_only_loss=config["training"]["assistant_only_loss"], eval_strategy="epoch", save_strategy="epoch", seed=config["project"]["seed"])
    trainer = SFTTrainer(model=model, args=args, train_dataset=split["train"], eval_dataset=split["test"], processing_class=tokenizer, peft_config=peft_config)
    trainer.train(); trainer.save_model(); tokenizer.save_pretrained(Path(args.output_dir))
    return {"status": "trained", "output_dir": args.output_dir, "examples": len(rows)}
