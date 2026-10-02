from __future__ import annotations

# ---------------------------------------------------------------------------
# CPU PIPELINE SMOKE  (NOT real Qwen QLoRA validation)
#
# This script exists ONLY to prove that the end-to-end LoRA SFT pipeline wiring
# runs on this CPU-only machine: dataset load -> conversational rows ->
# tokenization -> PEFT LoRA SFT (a couple of steps) -> adapter save -> adapter
# reload -> real generation. It uses a TINY random test model and NO 4-bit
# quantization, because this host has no CUDA/bitsandbytes and only 4 GiB VRAM.
#
# It deliberately does NOT touch, replace, or satisfy the strict real Qwen
# QLoRA validation in scripts/validate_real_qlora.py + training/real_qlora.py.
# Passing here is NOT evidence that Qwen3-4B QLoRA training, its adapter, its
# inference, or its evaluation succeeded. The strict runner remains the only
# real-training authority and stays BLOCKED on this machine.
# ---------------------------------------------------------------------------

import json
import sys
import tempfile
from pathlib import Path

TINY_MODEL = "hf-internal-testing/tiny-random-LlamaForCausalLM"


def main() -> int:
    import torch
    from datasets import Dataset
    from peft import LoraConfig, PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from trl import SFTConfig, SFTTrainer

    from ai_upchar_llm.datasets.sft_dataset import conversational_rows, load_sft

    report: dict[str, object] = {
        "pipeline_mode": "CPU_PIPELINE_SMOKE",
        "is_real_qwen_qlora": False,
        "device": "cpu",
        "cuda_available": torch.cuda.is_available(),
        "tiny_model": TINY_MODEL,
        "quantization": "disabled (no CUDA/bitsandbytes on this host)",
    }

    sft_path = Path("data/sft/real_validation_synthetic.jsonl")
    rows = conversational_rows(load_sft(sft_path))
    report["dataset_examples"] = len(rows)

    try:
        tokenizer = AutoTokenizer.from_pretrained(TINY_MODEL)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        model = AutoModelForCausalLM.from_pretrained(TINY_MODEL, dtype=torch.float32)
    except Exception as error:  # offline / model unavailable
        report["status"] = "SKIPPED_MODEL_UNAVAILABLE"
        report["reason"] = f"{type(error).__name__}: {error}"
        print(json.dumps(report, indent=2))
        return 3

    split = Dataset.from_list(rows).train_test_split(test_size=0.25, seed=7)
    peft_config = LoraConfig(r=4, lora_alpha=8, lora_dropout=0.0, target_modules=["q_proj", "v_proj"], task_type="CAUSAL_LM")

    with tempfile.TemporaryDirectory(prefix="cpu-smoke-") as tmp:
        out = Path(tmp) / "adapter"
        args = SFTConfig(
            output_dir=str(out),
            max_steps=2,
            per_device_train_batch_size=1,
            gradient_accumulation_steps=1,
            max_length=64,
            eval_strategy="steps",
            eval_steps=1,
            save_strategy="steps",
            save_steps=2,
            logging_steps=1,
            seed=7,
            report_to="none",
            use_cpu=True,
        )
        trainer = SFTTrainer(model=model, args=args, train_dataset=split["train"], eval_dataset=split["test"], processing_class=tokenizer, peft_config=peft_config)
        train_result = trainer.train()
        trainer.save_model(out)
        report["training_steps"] = int(train_result.global_step)
        report["train_loss"] = float(train_result.training_loss)
        report["adapter_saved"] = (out / "adapter_config.json").exists()

        del trainer
        base = AutoModelForCausalLM.from_pretrained(TINY_MODEL, dtype=torch.float32)
        reloaded = PeftModel.from_pretrained(base, out)
        report["adapter_reloaded"] = True

        prompt = "Mujhe 5 din se headache hai."
        inputs = tokenizer(prompt, return_tensors="pt")
        generated = reloaded.generate(**inputs, max_new_tokens=8, do_sample=False)
        text = tokenizer.decode(generated[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True)
        report["real_generation_ran"] = True
        report["generated_token_count"] = int(generated.shape[1] - inputs["input_ids"].shape[1])

    report["status"] = "PASSED"
    report["note"] = "CPU pipeline wiring verified with a tiny model. This is NOT real Qwen QLoRA validation."
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
