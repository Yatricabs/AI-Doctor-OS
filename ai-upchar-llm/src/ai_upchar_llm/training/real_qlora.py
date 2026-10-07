from __future__ import annotations

import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

# AI UPCHAR clinical reasoning contract: an inference is only behaviorally valid
# when the generated text is genuine JSON that carries these required keys. This
# is used ONLY to judge Gate B; it never rewrites or repairs model output.
CONTRACT_REQUIRED_KEYS = ("semantic_interpretation", "recommended_action")

# Behavioral validation is only fair when inference is formatted the same way
# training was. The SFT dataset is conversational ([{"role": "user"}, {"role":
# "assistant"}]) and SFTTrainer applies the model's chat template, so inference
# must build the same chat-formatted prompt and prime the assistant turn. The
# instruction asks for the contract JSON only; the evaluator is unchanged and
# still judges the raw generation strictly.
INFERENCE_USER_MESSAGE = (
    "Mujhe 5 din se headache hai. "
    "Return ONLY one JSON object using exactly the AI UPCHAR clinical reasoning "
    "schema with these top-level keys: semantic_interpretation, recommended_action, "
    "next_best_question, missing_information, clinical_considerations, confidence. "
    "Do not add or rename keys. No explanatory prose and no markdown code fences."
)
INFERENCE_MAX_NEW_TOKENS = 512


def _append_assistant_eos(rows: list[dict[str, object]], eos_token: str | None) -> list[dict[str, object]]:
    """Return a copy of conversational SFT rows where assistant messages end
    with the tokenizer EOS token.

    This is opt-in and intended for corrected E2 runs only. The original E2
    JSONL is not modified. The motivation is evidence from the E2 diagnostics:
    the base model naturally terminates with the base EOS after a complete JSON
    object, while the E2 adapter suppresses EOS after the first JSON and
    continues with another object. Adding an explicit EOS target after assistant
    JSON keeps the existing Qwen chat-template `<|im_end|>` boundary while also
    preserving the base model's end-of-response behavior.
    """
    if not eos_token:
        return rows
    transformed: list[dict[str, object]] = []
    for row in rows:
        copied = dict(row)
        messages = []
        for message in row["messages"]:  # type: ignore[index]
            copied_message = dict(message)
            if copied_message.get("role") == "assistant":
                content = str(copied_message.get("content", ""))
                if not content.endswith(eos_token):
                    copied_message["content"] = content + eos_token
            messages.append(copied_message)
        copied["messages"] = messages
        transformed.append(copied)
    return transformed


def build_inference_prompt(tokenizer) -> str:
    """Format the inference prompt with the tokenizer's chat template so it
    matches how SFTTrainer formatted the conversational training data, and prime
    the assistant turn with add_generation_prompt=True. This does not alter or
    relax Gate B; it only makes the generation format consistent with training."""
    messages = [{"role": "user", "content": INFERENCE_USER_MESSAGE}]
    return tokenizer.apply_chat_template(
        messages, add_generation_prompt=True, tokenize=False
    )


def _strip_json_markdown_fence(text: str) -> str:
    """Remove a single surrounding ```json ... ``` (or ``` ... ```) fence if the
    model wrapped its whole answer in one. This is a formatting unwrap only: it
    does not strip arbitrary prose, does not extract a partial object, and does
    not otherwise alter the payload. If no clean single fence is present the
    text is returned unchanged so Gate B still judges the real output."""
    stripped = text.strip()
    if not stripped.startswith("```"):
        return stripped
    newline = stripped.find("\n")
    if newline == -1:
        return stripped
    first_line = stripped[3:newline].strip().lower()
    if first_line not in ("", "json"):
        return stripped  # a fence but not a plain json fence; do not touch
    if not stripped.endswith("```"):
        return stripped  # opening fence but no closing fence (e.g. truncated)
    return stripped[newline + 1 : -3].strip()


def evaluate_contract_json(generated: str) -> dict:
    """Strictly judge whether generated text is valid AI UPCHAR contract JSON.

    Returns a structured verdict. It NEVER accepts partial/truncated JSON, never
    silently strips arbitrary text, and never converts malformed output into a
    success. The only tolerated transformation is unwrapping a single clean
    ```json fence (a formatting convention), after which the payload must parse
    as JSON on its own and contain the required contract keys."""
    payload = _strip_json_markdown_fence(generated)
    verdict: dict = {"valid": False, "reason": None, "missing_keys": None}
    try:
        parsed = json.loads(payload)
    except Exception as error:
        # Distinguish the common failure modes for honest reporting.
        has_open = "{" in generated
        has_close = "}" in generated
        if has_open and not has_close:
            verdict["reason"] = "truncated_before_closing_brace"
        elif not has_open:
            verdict["reason"] = "no_json_object_present"
        else:
            verdict["reason"] = f"json_decode_error: {type(error).__name__}: {error}"
        return verdict
    if not isinstance(parsed, dict):
        verdict["reason"] = "top_level_not_object"
        return verdict
    missing = [key for key in CONTRACT_REQUIRED_KEYS if key not in parsed]
    if missing:
        verdict["reason"] = "missing_contract_keys"
        verdict["missing_keys"] = missing
        return verdict
    verdict["valid"] = True
    verdict["parsed"] = parsed
    return verdict


def run_real_qlora_validation(config: dict) -> dict:
    import torch
    from datasets import Dataset
    from peft import LoraConfig, PeftModel, prepare_model_for_kbit_training
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from trl import SFTConfig, SFTTrainer
    from ai_upchar_llm.datasets.sft_dataset import conversational_rows, load_sft

    if not torch.cuda.is_available():
        raise RuntimeError("REAL_QWEN_QLORA requires CUDA; smoke fallback is prohibited")
    model_name = os.environ.get("MODEL_NAME", config["model"]["name"])
    output_dir = Path(config["training"]["output_dir"])

    # ---- Gate A: real QLoRA infrastructure/training -------------------------
    # Every step below is genuine work; the gate records evidence, not claims.
    gate_a: dict = {
        "gate": "REAL_QWEN_QLORA_INFRASTRUCTURE",
        "status": "FAILED",
        "model_downloaded_loaded": False,
        "nf4_quantization_initialized": False,
        "lora_adapter_attached": False,
        "training_steps": 0,
        "training_metrics": None,
        "adapter_saved": False,
        "adapter_reloaded": False,
        "evaluation_completed": False,
        "inference_executed": False,
    }

    rows = conversational_rows(load_sft(config["data"]["sft_path"]))
    dtype = {"float16": torch.float16, "bfloat16": torch.bfloat16}[config["quantization"]["compute_dtype"]]
    quantization = BitsAndBytesConfig(load_in_4bit=config["quantization"]["enabled"], bnb_4bit_quant_type=config["quantization"]["quant_type"], bnb_4bit_use_double_quant=config["quantization"]["double_quant"], bnb_4bit_compute_dtype=dtype)
    gate_a["nf4_quantization_initialized"] = config["quantization"]["quant_type"] == "nf4" and config["quantization"]["enabled"]
    tokenizer = AutoTokenizer.from_pretrained(model_name, cache_dir=os.environ.get("TRANSFORMERS_CACHE"))
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    if config["training"].get("append_assistant_eos"):
        rows = _append_assistant_eos(rows, tokenizer.eos_token)
    split = Dataset.from_list(rows).train_test_split(test_size=config["training"]["eval_split"], seed=config["project"]["seed"])
    model = AutoModelForCausalLM.from_pretrained(model_name, cache_dir=os.environ.get("TRANSFORMERS_CACHE"), quantization_config=quantization, device_map="auto")
    gate_a["model_downloaded_loaded"] = True
    model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=config["training"]["gradient_checkpointing"])
    lora = config["lora"]
    peft_config = LoraConfig(r=lora["rank"], lora_alpha=lora["alpha"], lora_dropout=lora["dropout"], target_modules=lora["target_modules"], task_type="CAUSAL_LM")
    args = SFTConfig(output_dir=str(output_dir), max_steps=config["training"]["max_steps"], per_device_train_batch_size=config["training"]["per_device_train_batch_size"], gradient_accumulation_steps=config["training"]["gradient_accumulation_steps"], gradient_checkpointing=config["training"]["gradient_checkpointing"], max_length=config["model"]["max_sequence_length"], eval_strategy="steps", eval_steps=1, save_strategy="steps", save_steps=config["training"]["save_steps"], logging_steps=config["training"]["logging_steps"], seed=config["project"]["seed"], fp16=dtype == torch.float16, bf16=dtype == torch.bfloat16, report_to="none")
    trainer = SFTTrainer(model=model, args=args, train_dataset=split["train"], eval_dataset=split["test"], processing_class=tokenizer, peft_config=peft_config)
    gate_a["lora_adapter_attached"] = True
    train_result = trainer.train()
    gate_a["training_steps"] = int(train_result.global_step)
    gate_a["training_metrics"] = {"train_loss": float(train_result.training_loss), "global_step": int(train_result.global_step)}
    eval_metrics = trainer.evaluate()
    gate_a["evaluation_completed"] = True
    gate_a["evaluation_metrics"] = {key: float(value) for key, value in eval_metrics.items() if isinstance(value, (int, float))}
    trainer.save_model(output_dir)
    tokenizer.save_pretrained(output_dir)
    gate_a["adapter_saved"] = (output_dir / "adapter_config.json").exists()
    del trainer, model
    torch.cuda.empty_cache()
    base = AutoModelForCausalLM.from_pretrained(model_name, cache_dir=os.environ.get("TRANSFORMERS_CACHE"), quantization_config=quantization, device_map="auto")
    reloaded = PeftModel.from_pretrained(base, output_dir)
    gate_a["adapter_reloaded"] = True
    prompt = build_inference_prompt(tokenizer)
    inputs = tokenizer(prompt, return_tensors="pt").to(reloaded.device)
    generated = tokenizer.decode(reloaded.generate(**inputs, max_new_tokens=INFERENCE_MAX_NEW_TOKENS, do_sample=False)[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True).strip()
    gate_a["inference_executed"] = bool(generated)

    gate_a["status"] = "SUCCESS" if (
        gate_a["model_downloaded_loaded"]
        and gate_a["nf4_quantization_initialized"]
        and gate_a["lora_adapter_attached"]
        and gate_a["training_steps"] > 0
        and gate_a["training_metrics"] is not None
        and gate_a["adapter_saved"]
        and gate_a["adapter_reloaded"]
        and gate_a["evaluation_completed"]
        and gate_a["inference_executed"]
    ) else "FAILED"

    # ---- Gate B: post-training behavioral JSON-contract validation ----------
    # Strict and independent. A prose/markdown/truncated/invalid generation is a
    # BEHAVIORAL failure, not an infrastructure failure. Never accept partial
    # JSON; never convert malformed output into success.
    contract = evaluate_contract_json(generated)
    gate_b = {
        "gate": "REAL_QWEN_QLORA_BEHAVIORAL_CONTRACT",
        "status": "SUCCESS" if contract["valid"] else "NOT_VALIDATED",
        "contract_valid": contract["valid"],
        "reason": contract.get("reason"),
        "missing_keys": contract.get("missing_keys"),
        "generated_preview": generated[:300],
    }

    metadata = {
        "training_mode": "REAL_QWEN_QLORA",
        "base_model": model_name,
        "dataset_version": config["project"]["dataset_version"],
        "evaluation_version": config["project"]["evaluation_version"],
        "git_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "hyperparameters": {"training": config["training"], "lora": config["lora"], "quantization": config["quantization"]},
        "environment": {"torch": torch.__version__, "cuda": torch.version.cuda, "gpu": torch.cuda.get_device_name(0)},
        "adapter_path": str(output_dir),
        "gate_a_infrastructure": gate_a,
        "gate_b_behavioral_contract": gate_b,
        # Overall success requires BOTH gates. Gate A can be SUCCESS while Gate B
        # remains NOT_VALIDATED; that is an honest, expected intermediate state.
        "overall_status": "SUCCESS" if (gate_a["status"] == "SUCCESS" and gate_b["status"] == "SUCCESS") else "PARTIAL" if gate_a["status"] == "SUCCESS" else "FAILED",
    }
    if contract["valid"]:
        metadata["generated_output"] = contract["parsed"]
    (output_dir / "training_metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata
