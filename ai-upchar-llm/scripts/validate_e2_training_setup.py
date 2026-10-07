"""Read-only validation of the E2 training setup. Modifies nothing."""

from __future__ import annotations

import math
from importlib import import_module
from pathlib import Path

from ai_upchar_llm.config import load_config
from ai_upchar_llm.training.real_qlora import CONTRACT_REQUIRED_KEYS, evaluate_contract_json

ROOT = Path(__file__).resolve().parents[1]

print("=" * 72)
print("E2 TRAINING SETUP — READ-ONLY VALIDATION")
print("=" * 72)

# 1. E2 config resolves correctly
print("\n[1] E2 config resolution")
e2_cfg = load_config(ROOT / "configs" / "qwen3-4b-e2-validation.yaml")
print(f"  model.name              = {e2_cfg['model']['name']}")
print(f"  training.method         = {e2_cfg['training']['method']}")
print(f"  training.max_steps      = {e2_cfg['training']['max_steps']}")
print(f"  training.epochs         = {e2_cfg['training'].get('epochs')}")
print(f"  training.num_train_epochs = {e2_cfg['training'].get('num_train_epochs')}")
print(f"  training.eval_split     = {e2_cfg['training']['eval_split']}")
print(f"  training.per_device_bs  = {e2_cfg['training']['per_device_train_batch_size']}")
print(f"  training.grad_accum     = {e2_cfg['training']['gradient_accumulation_steps']}")
print(f"  model.max_sequence_len  = {e2_cfg['model']['max_sequence_length']}")
print(f"  quantization.quant_type = {e2_cfg['quantization']['quant_type']}")
print(f"  quantization.double_quant = {e2_cfg['quantization']['double_quant']}")
print(
    f"  lora.rank/alpha/dropout = {e2_cfg['lora']['rank']}/{e2_cfg['lora']['alpha']}/{e2_cfg['lora']['dropout']}"
)
print(f"  lora.target_modules     = {e2_cfg['lora']['target_modules']}")
print(f"  project.seed            = {e2_cfg['project']['seed']}")
print(f"  data.sft_path           = {e2_cfg['data']['sft_path']}")
print(f"  data.evaluation_path    = {e2_cfg['data']['evaluation_path']}")

# 2. Verify 122-record dataset
print("\n[2] E2 dataset record count")
sft_path = ROOT / e2_cfg["data"]["sft_path"]
train_records = [
    line for line in sft_path.read_text(encoding="utf-8").strip().split("\n") if line.strip()
]
print(f"  {sft_path.name}: {len(train_records)} records")
eval_path = ROOT / e2_cfg["data"]["evaluation_path"]
held_records = [
    line for line in eval_path.read_text(encoding="utf-8").strip().split("\n") if line.strip()
]
print(f"  {eval_path.name}: {len(held_records)} records")

# 3. Verify 91/31 split using the actual library
print("\n[3] Internal train/eval split (actual library)")
Dataset = import_module("datasets").Dataset

rows = [{"i": i} for i in range(len(train_records))]
split = Dataset.from_list(rows).train_test_split(
    test_size=e2_cfg["training"]["eval_split"], seed=e2_cfg["project"]["seed"]
)
print(
    f"  train: {len(split['train'])}  eval: {len(split['test'])}  (seed={e2_cfg['project']['seed']})"
)

# 4. Verify max_steps and step budget
print("\n[4] max_steps + step budget")
eff_batch = (
    e2_cfg["training"]["per_device_train_batch_size"]
    * e2_cfg["training"]["gradient_accumulation_steps"]
)
steps_per_epoch = math.ceil(len(split["train"]) / eff_batch)
print(f"  max_steps          = {e2_cfg['training']['max_steps']}")
print(f"  effective batch    = {eff_batch}")
print(f"  steps/epoch (91)   = {steps_per_epoch}")
print(
    f"  3 epochs           = {steps_per_epoch * 3} steps  (max_steps caps at {e2_cfg['training']['max_steps']})"
)

# 5. Verify E1 config/data unchanged (still points to E1 data)
print("\n[5] E1 config integrity (must still point to E1 data)")
e1_cfg = load_config(ROOT / "configs" / "qwen3-4b-real-validation.yaml")
print(f"  E1 sft_path        = {e1_cfg['data']['sft_path']}")
print(f"  E1 evaluation_path = {e1_cfg['data']['evaluation_path']}")
print(f"  E1 max_steps       = {e1_cfg['training']['max_steps']}")
e1_ok = (
    e1_cfg["data"]["sft_path"] == "data/sft/real_validation_synthetic.jsonl"
    and e1_cfg["data"]["evaluation_path"] == "data/evaluation/smoke.jsonl"
    and e1_cfg["training"]["max_steps"] == 2
)
print(f"  E1 config unchanged: {e1_ok}")

# 6. Verify evaluator + CONTRACT_REQUIRED_KEYS unchanged
print("\n[6] Frozen evaluator + contract")
print(f"  CONTRACT_REQUIRED_KEYS = {CONTRACT_REQUIRED_KEYS}")
contract_ok = CONTRACT_REQUIRED_KEYS == ("semantic_interpretation", "recommended_action")
# Behavioral spot-check of the frozen evaluator (does not modify it)
v_good = evaluate_contract_json(
    '{"semantic_interpretation": {}, "recommended_action": "ASK_QUESTION"}'
)
v_bad = evaluate_contract_json("not json")
v_missing = evaluate_contract_json('{"recommended_action": "ASK_QUESTION"}')
print(f"  evaluator valid-case  -> valid={v_good['valid']}")
print(f"  evaluator non-json    -> valid={v_bad['valid']} reason={v_bad['reason']}")
print(f"  evaluator missing-key -> valid={v_missing['valid']} reason={v_missing['reason']}")
evaluator_ok = contract_ok and v_good["valid"] and not v_bad["valid"] and not v_missing["valid"]
print(f"  evaluator + contract unchanged: {evaluator_ok}")

# 7. Summary
print("\n" + "=" * 72)
print("VALIDATION SUMMARY")
print("=" * 72)
checks = {
    "E2 config resolves": e2_cfg["model"]["name"] == "Qwen/Qwen3-4B-Base",
    "E2 dataset = 122": len(train_records) == 122,
    "E2 held-out = 6": len(held_records) == 6,
    "Split = 91/31": len(split["train"]) == 91 and len(split["test"]) == 31,
    "max_steps = 138": e2_cfg["training"]["max_steps"] == 138,
    "eval_split = 0.25": e2_cfg["training"]["eval_split"] == 0.25,
    "seed = 42": e2_cfg["project"]["seed"] == 42,
    "LoRA r8/a16/d0.05": (
        e2_cfg["lora"]["rank"],
        e2_cfg["lora"]["alpha"],
        e2_cfg["lora"]["dropout"],
    )
    == (8, 16, 0.05),
    "NF4 + double_quant": e2_cfg["quantization"]["quant_type"] == "nf4"
    and e2_cfg["quantization"]["double_quant"],
    "seq_len = 256": e2_cfg["model"]["max_sequence_length"] == 256,
    "E2 -> E2 data": e2_cfg["data"]["sft_path"] == "data/sft/e2_contract_sft.jsonl",
    "E1 config unchanged": e1_ok,
    "Evaluator+contract frozen": evaluator_ok,
}
all_ok = True
for name, ok in checks.items():
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}")
    all_ok = all_ok and ok

print("\n" + ("ALL CHECKS PASS" if all_ok else "SOME CHECKS FAILED"))
