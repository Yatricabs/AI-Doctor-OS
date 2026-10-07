# ============================================================================
# Kaggle Phase 4A — REAL Qwen QLoRA validation driver
# ============================================================================
# HOW TO USE ON KAGGLE
#   1. New Notebook -> Settings -> Accelerator = GPU (T4 x1 is enough).
#      Settings -> Internet = ON (needed to clone + download the model).
#   2. If Qwen requires a token, add it via Kaggle "Add-ons -> Secrets" with
#      the label HF_TOKEN. Do NOT paste the token into a cell. Do NOT commit it.
#   3. Copy each numbered CELL below into its own Kaggle cell (or paste the whole
#      file into one cell). Run top to bottom.
#
# WHAT THIS DOES
#   - Runs the EXISTING repo scripts unmodified:
#       scripts/check_training_environment.py
#       scripts/validate_real_qlora.py --config configs/qwen3-4b-real-validation.yaml
#   - Uses the EXISTING config: Qwen/Qwen3-4B-Base, NF4, LoRA r=8/alpha=16,
#     seq_len=256, max_steps=2, eval_split=0.25.
#   - Installs the project's pinned dependencies from pyproject.toml.
#   - Prints the A-L handoff report from the produced training_metadata.json.
#
# STRICT RULES ENFORCED
#   - Does NOT modify the real QLoRA implementation.
#   - Does NOT use validate_cpu_pipeline_smoke.py.
#   - Does NOT print/commit the HF token.
#   - Reports SUCCESS only if the runner itself wrote status/metadata proving
#     every gate passed. Any failure => BLOCKED/FAILED, no fake success.
# ============================================================================

import glob
import json
import os
import platform
import shutil
import subprocess
import sys


# ---------------------------------------------------------------------------
# CELL 1 — Hardware + Python + CUDA verification (requirement 9)
# ---------------------------------------------------------------------------
print("=== nvidia-smi ===")
print(
    subprocess.run(["nvidia-smi"], capture_output=True, text=True).stdout
    or "nvidia-smi not available"
)
print("=== python ===", platform.python_version(), sys.executable)
try:
    import torch

    print("torch:", torch.__version__, "| cuda_available:", torch.cuda.is_available())
    if torch.cuda.is_available():
        print(
            "gpu:",
            torch.cuda.get_device_name(0),
            "| vram_gib:",
            round(torch.cuda.get_device_properties(0).total_memory / 2**30, 2),
        )
except Exception as e:
    print("torch not imported yet (installed in CELL 3):", e)


# ---------------------------------------------------------------------------
# CELL 2 — Bring the project from the Kaggle Dataset into WRITABLE working dir
# ---------------------------------------------------------------------------
# We use Option 1 (Kaggle Dataset upload), NOT GitHub, because ai-upchar-llm is
# not yet on GitHub. /kaggle/input is READ-ONLY, so pip install -e (editable)
# and any cache/artifact writes must happen under /kaggle/working. This cell
# locates the dataset copy of ai-upchar-llm and copies it to a writable path.
WORK_DIR = "/kaggle/working/ai-upchar-llm"

# Find the uploaded dataset folder that actually contains pyproject.toml.
candidates = []
for base in glob.glob("/kaggle/input/*"):
    for root, _dirs, files in os.walk(base):
        if "pyproject.toml" in files and os.path.isdir(os.path.join(root, "scripts")):
            candidates.append(root)
print("Candidate dataset source(s):", candidates)
assert candidates, (
    "No ai-upchar-llm source found under /kaggle/input. Add the "
    "dataset (ai-upchar-llm-phase4a) to this notebook first."
)
SRC_DIR = candidates[0]

# Copy read-only dataset -> writable working dir (idempotent).
if os.path.isdir(WORK_DIR):
    shutil.rmtree(WORK_DIR)
shutil.copytree(SRC_DIR, WORK_DIR)
REPO_DIR = WORK_DIR
print("SRC_DIR  =", SRC_DIR)
print("REPO_DIR =", REPO_DIR, "| writable copy exists:", os.path.isdir(REPO_DIR))
print("top-level:", sorted(os.listdir(REPO_DIR)))


# ---------------------------------------------------------------------------
# CELL 3 — HF cache on ephemeral disk + install PINNED deps (requirements 6,7,8)
# ---------------------------------------------------------------------------
os.chdir(REPO_DIR)
os.environ["HF_HOME"] = "/kaggle/working/hf-cache"
os.environ["TRANSFORMERS_CACHE"] = "/kaggle/working/hf-cache/transformers"
os.environ["PYTHONPATH"] = "src"

# Install the project's pinned dependencies + CUDA extra (bitsandbytes) exactly
# as declared in pyproject.toml. Do NOT hand-edit versions here. If pip reports
# a resolver conflict with Kaggle's preinstalled stack, capture the EXACT error
# below and stop (requirement 7 + 14) — do not force versions to hide it.
proc = subprocess.run(
    [sys.executable, "-m", "pip", "install", "-e", ".[cuda]"],
    capture_output=True,
    text=True,
)
print(proc.stdout[-4000:])
print("=== pip stderr tail ===")
print(proc.stderr[-4000:])
print("=== pip exit code:", proc.returncode, "===")
if proc.returncode != 0:
    print(
        "DEPENDENCY_INSTALL_FAILED: report the exact conflict above. Do not "
        "silently change pinned versions to bypass it."
    )


# ---------------------------------------------------------------------------
# CELL 4 — Provide HF token from Kaggle Secrets WITHOUT printing it (req 17)
# ---------------------------------------------------------------------------
try:
    from kaggle_secrets import UserSecretsClient

    _tok = UserSecretsClient().get_secret("HF_TOKEN")
    if _tok:
        os.environ["HF_TOKEN"] = _tok
        os.environ["HUGGING_FACE_HUB_TOKEN"] = _tok
        print("HF token loaded from Kaggle Secrets (value hidden).")
    else:
        print("No HF_TOKEN secret set. Continue if the model is ungated.")
except Exception as e:
    print("Kaggle Secrets unavailable or HF_TOKEN not set; continuing ungated:", type(e).__name__)


# ---------------------------------------------------------------------------
# CELL 5 — Preflight: the EXISTING environment check (requirement 10)
# ---------------------------------------------------------------------------
env = dict(os.environ, PYTHONPATH="src")
pf = subprocess.run(
    [sys.executable, "scripts/check_training_environment.py"],
    capture_output=True,
    text=True,
    env=env,
    cwd=REPO_DIR,
)
print(pf.stdout)
print(pf.stderr[-2000:])
print("=== preflight exit code:", pf.returncode, "(0 = ready, 2 = blocked) ===")


# ---------------------------------------------------------------------------
# CELL 6 — Dataset validation + REAL strict runner (requirements 11,12,13)
# ---------------------------------------------------------------------------
# Only runs the real runner. Never substitutes validate_cpu_pipeline_smoke.py.
env = dict(os.environ, PYTHONPATH="src")

dv = subprocess.run(
    [sys.executable, "scripts/validate_dataset.py", "data/sft/real_validation_synthetic.jsonl"],
    capture_output=True,
    text=True,
    env=env,
    cwd=REPO_DIR,
)
print("=== dataset validation ===")
print(dv.stdout)
print(dv.stderr[-1500:])

if pf.returncode == 0:
    run = subprocess.run(
        [
            sys.executable,
            "scripts/validate_real_qlora.py",
            "--config",
            "configs/qwen3-4b-real-validation.yaml",
        ],
        capture_output=True,
        text=True,
        env=env,
        cwd=REPO_DIR,
    )
    print("=== validate_real_qlora stdout ===")
    print(run.stdout[-8000:])
    print("=== validate_real_qlora stderr tail ===")
    print(run.stderr[-4000:])
    print("=== runner exit code:", run.returncode, "===")
else:
    print(
        "PREFLIGHT_BLOCKED: not running the real runner. Report the blockers "
        "printed in CELL 5. Do not bypass preflight."
    )


# ---------------------------------------------------------------------------
# CELL 7 — A-L handoff report, derived ONLY from real artifacts
# ---------------------------------------------------------------------------
art = os.path.join(REPO_DIR, "artifacts", "qwen3-4b-real-validation")
meta_path = os.path.join(art, "training_metadata.json")
print("=== artifacts dir listing ===")
print(subprocess.run(["ls", "-la", art], capture_output=True, text=True).stdout or "(missing)")

report = {"J_REAL_QWEN_QLORA_status": "BLOCKED/FAILED (no metadata written)"}
if os.path.isfile(meta_path):
    meta = json.load(open(meta_path, encoding="utf-8"))
    report = {
        "A_kaggle_gpu_detected": meta.get("environment", {}).get("gpu", "unknown"),
        "B_gpu_and_vram": meta.get("environment", {}).get("gpu", "unknown"),
        "C_python_version": platform.python_version(),
        "D_pytorch_cuda": meta.get("environment", {}).get("cuda", "unknown"),
        "F_qwen_download_loaded": meta.get("base_model", "unknown"),
        "G_qlora_training": "executed"
        if meta.get("training_mode") == "REAL_QWEN_QLORA"
        else "not-executed",
        "H_adapter": {"path": meta.get("adapter_path"), "reload": meta.get("adapter_reload")},
        "I_real_inference": meta.get("inference_non_empty"),
        "contract_parse": meta.get("contract_parse"),
        "J_REAL_QWEN_QLORA_status": "SUCCESS"
        if (
            meta.get("training_mode") == "REAL_QWEN_QLORA"
            and meta.get("adapter_reload") is True
            and meta.get("inference_non_empty") is True
            and meta.get("contract_parse") is True
        )
        else "INCOMPLETE",
        "K_artifacts": os.listdir(art),
    }
print("=== A-L HANDOFF REPORT ===")
print(json.dumps(report, indent=2))
print(
    "\nNOTE: Report SUCCESS only if J == SUCCESS above AND CELL 6 runner exit "
    "code was 0. Otherwise the status is BLOCKED/FAILED. Download the "
    "artifacts folder before the session ends (ephemeral storage)."
)
