# Cloud GPU setup for Phase 4A real Qwen QLoRA validation

This document is a **handoff / setup guide only**. It does not change any Phase 4A
code, does not weaken the strict real-training semantics, and does not start,
create, or pay for any cloud resource. It explains how to run the **existing**
Phase 4A validation on a capable remote GPU host, unmodified.

- The real runner is `scripts/validate_real_qlora.py` → `src/ai_upchar_llm/training/real_qlora.py`.
- The preflight is `scripts/check_training_environment.py`.
- The runner **hard-requires CUDA** and refuses any smoke/CPU fallback. On a host
  without a supported GPU it prints `status: BLOCKED` and exits non-zero. That is
  by design and must not be bypassed.

> No fake success. No smoke/CPU result presented as real training. No dependency
> downgrade to bypass the environment. Same repo, same scripts, run unmodified.

---

## A. Current local blocker

The developer laptop cannot perform real Qwen QLoRA training:

| Factor | Local value | Requirement for this workload |
| --- | --- | --- |
| OS | Windows 10 | Linux strongly preferred for bitsandbytes/CUDA |
| Python | 3.14.7 on the system PATH | `>=3.11,<3.14` (per `pyproject.toml`) |
| GPU | NVIDIA GTX 1650 | NVIDIA CUDA GPU |
| VRAM | 4 GiB | insufficient for Qwen3-4B NF4 QLoRA |
| System RAM | ~8 GiB | low for model load + tokenization |
| Driver CUDA | 11.5 (reported) | modern CUDA-enabled PyTorch build |
| PyTorch CUDA | unavailable (`torch.cuda.is_available() == False`) | must be `True` |

Note: a Python 3.12 environment exists locally at
`D:\VS Code\Python Environments\ai-upchar-llm-py312`, which removes the Python
version blocker, but the GPU/VRAM/CUDA blockers remain. Therefore
`scripts/validate_real_qlora.py` correctly reports **BLOCKED** on this machine.

**Why local real QLoRA is blocked:** no CUDA runtime, only 4 GiB VRAM (below the
practical NF4 QLoRA minimum for a 4B model), and limited system RAM. These are
hardware/runtime limits, not implementation defects.

---

## B. Free option — Kaggle GPU and Google Colab Free

Both can run the validation because they provide an NVIDIA CUDA GPU with enough
VRAM for a tiny 2-step Qwen3-4B NF4 QLoRA validation. Their main weakness for our
purpose is **not** compute — it is **weak/again unofficial VS Code/SSH support**
and **non-persistent storage**. Verify current quotas on the official sites, as
free-tier limits change over time.

### Practical limitations (verify on official docs before relying on them)
- **GPU class:** free notebooks typically expose a single mid-tier NVIDIA GPU
  with roughly 15–16 GiB VRAM, which is comfortably above our minimum target.
- **Session/runtime:** free sessions are time-limited and can be interrupted or
  reclaimed; long idle periods disconnect. Our validation is only 2 steps, so it
  fits well within a single short session.
- **Persistent storage:** the working filesystem is ephemeral. Anything not
  downloaded out before the session ends is lost. Model/HF caches also reset,
  so the Qwen weights are re-downloaded each new session.
- **VS Code/SSH:** neither free tier offers a first-class, officially-supported
  persistent SSH target for VS Code Remote-SSH. They are notebook-first. Treat
  them as "run the scripts in a notebook cell", not "remote-develop over SSH".

### Kaggle / Colab run recipe (notebook cells)

Enable the GPU accelerator in the notebook settings first. Then in cells:

```bash
# 1. Clone (public repo) or upload the repo. If private, use a token via
#    tooling/secret manager — never paste a token into a committed cell.
git clone https://github.com/Yatricabs/AI-Doctor-OS.git
cd AI-Doctor-OS/ai-upchar-llm
```

```bash
# 2. Point caches at the session's larger scratch disk (paths differ per host):
#    Kaggle scratch is typically /kaggle/working ; Colab is typically /content .
export HF_HOME="$PWD/.hf-cache"
export TRANSFORMERS_CACHE="$PWD/.hf-cache/transformers"
export PYTHONPATH="src"
```

```bash
# 3. Install the project's pinned dependencies + CUDA extra (bitsandbytes).
#    Use the pinned versions from pyproject.toml; do not invent versions.
python -m pip install -e ".[cuda]"
```

```bash
# 4. Verify the GPU.
nvidia-smi
```

```bash
# 5. Preflight (exit 0 = ready, 2 = blocked).
python scripts/check_training_environment.py
```

```bash
# 6. Validate the dataset, then run the REAL strict validation.
python scripts/validate_dataset.py data/sft/real_validation_synthetic.jsonl
python scripts/validate_real_qlora.py --config configs/qwen3-4b-real-validation.yaml
```

```bash
# 7. Collect the adapter + validation metadata BEFORE the session ends
#    (ephemeral storage). Download this directory out of the notebook:
ls -la artifacts/qwen3-4b-real-validation
#   Key files: adapter weights/config + training_metadata.json
```

If a Hugging Face token is required for the model, provide it only through the
platform's secret/environment mechanism (e.g. Kaggle Secrets, Colab userdata).
Never print it and never commit it.

**Free-tier verdict:** usable to *produce a real validation result*, but not a
comfortable *VS Code remote-development* experience. Best when you just need the
`training_metadata.json` + adapter artifact once.

---

## C. VS Code / Kiro remote GPU option (SSH)

This is the best fit if you want to drive the **same repo and same scripts** from
VS Code/Kiro directly on a GPU box. It requires a Linux cloud GPU host that
exposes SSH (most low-cost providers do). Free notebook tiers generally do not.

- **Local:** Windows + VS Code / Kiro with the **Remote - SSH** extension.
- **Remote:** Ubuntu + NVIDIA GPU + CUDA driver + Python 3.11 or 3.12.

### SSH connection requirements
- An SSH endpoint (host/IP + port) and a key pair. Generate the key locally
  (`ssh-keygen`), add the **public** key to the provider. Keep the **private**
  key local and never commit it.
- Confirm you can `ssh user@host` from a local terminal before using VS Code.

### VS Code Remote-SSH workflow
1. Install the "Remote - SSH" extension in VS Code/Kiro.
2. Add the host to your SSH config (Command Palette → "Remote-SSH: Add New SSH
   Host"), pointing at the key and endpoint.
3. Connect. VS Code installs its remote server on the box; your editor, terminal,
   and tools now run **on the GPU host**.
4. Open the cloned repo folder on the remote and work normally.

### Remote setup commands (Ubuntu GPU host)

```bash
git clone https://github.com/Yatricabs/AI-Doctor-OS.git
cd AI-Doctor-OS/ai-upchar-llm

python3 --version                 # expect 3.11.x or 3.12.x
python3 -m venv .venv
source .venv/bin/activate

nvidia-smi                        # confirm the NVIDIA GPU + driver

export HF_HOME="$HOME/hf-cache"   # put model cache on the biggest volume
export TRANSFORMERS_CACHE="$HOME/hf-cache/transformers"
export PYTHONPATH="src"
# export HF_TOKEN=...             # only via secure env/secret, never committed

python -m pip install --upgrade pip
python -m pip install -e ".[cuda]"

python scripts/check_training_environment.py
python scripts/validate_dataset.py data/sft/real_validation_synthetic.jsonl
python scripts/validate_real_qlora.py --config configs/qwen3-4b-real-validation.yaml
```

The scripts are unchanged: the same `check_training_environment.py`,
`validate_real_qlora.py`, and `configs/qwen3-4b-real-validation.yaml` run exactly
as they would locally — they simply pass preflight on a real GPU host.

---

## D. Low-cost fallback — RunPod and Vast.ai (optional, paid)

Use only if free tiers are insufficient or you need a persistent SSH box. Both
rent Linux NVIDIA GPU instances by the hour with SSH access, which suits the
VS Code Remote-SSH workflow in section C.

- **RunPod:** GPU "pods" with SSH; pick a PyTorch/CUDA base image, then follow
  section C commands.
- **Vast.ai:** marketplace of GPU hosts with SSH; pick an image with a recent
  NVIDIA driver + CUDA, then follow section C commands.

Pricing is not quoted here because it changes and varies by GPU/region; check the
provider's official pricing page at the time of use. **Do not** create an
account, start an instance, or spend money as part of this documentation step.
Choosing and paying for a provider is a manual decision for you.

---

## E. Recommended GPU for this exact workload

Sizing is for the **existing** Phase 4A validation config
(`configs/qwen3-4b-real-validation.yaml`): Qwen3-4B-Base, NF4 4-bit,
LoRA r=8/α=16, sequence length 256, batch size 1, 2 steps. This is a tiny
validation run, not a full training job.

| Target | VRAM | Notes |
| --- | --- | --- |
| Practical minimum | **8 GiB** | Enough for Qwen3-4B in NF4 with LoRA at seq len 256, batch 1. Matches the preflight's 8 GiB gate in `check_training_environment.py`. |
| Recommended | **12–16 GiB** | Comfortable headroom for weights, activations, and cache; avoids edge-case OOM from kernel/driver/version differences. |

Do not scale the workload beyond the existing config. The goal is a real,
reproducible *validation*, not a large training run.

---

## F. Exact copy-paste commands (Linux remote GPU host)

```bash
git clone https://github.com/Yatricabs/AI-Doctor-OS.git
cd AI-Doctor-OS/ai-upchar-llm
python --version
python -m venv .venv
source .venv/bin/activate
nvidia-smi
export HF_HOME="$HOME/hf-cache"
export TRANSFORMERS_CACHE="$HOME/hf-cache/transformers"
export PYTHONPATH="src"
python -m pip install --upgrade pip
python -m pip install -e ".[cuda]"
python scripts/check_training_environment.py
python scripts/validate_dataset.py data/sft/real_validation_synthetic.jsonl
python scripts/validate_real_qlora.py --config configs/qwen3-4b-real-validation.yaml
```

Pinned dependency set comes from `pyproject.toml` (do not substitute versions):

- `torch==2.9.1`, `transformers==4.57.3`, `datasets==4.4.1`, `trl==0.25.1`,
  `peft==0.18.0`, `accelerate==1.12.0`, `PyYAML==6.0.3`, `pydantic==2.12.5`,
  `safetensors==0.7.0`
- CUDA extra: `bitsandbytes==0.48.2` (installed via the `.[cuda]` extra)

If the host image ships a CUDA-specific PyTorch wheel index, install `torch`
from that index at the same pinned version rather than downgrading it.

---

## G. Validation gate (strict success definition)

A run counts as real success **only** when the runner reports:

```
training_mode: REAL_QWEN_QLORA
status: SUCCESS
```

and every one of the following is true (all enforced by the existing
`real_qlora.py`, not by this document):

- [ ] Qwen model downloaded
- [ ] Qwen model loaded
- [ ] NF4 4-bit quantization initialized
- [ ] Real QLoRA training executed
- [ ] Training steps completed > 0
- [ ] Adapter produced (saved to `artifacts/qwen3-4b-real-validation`)
- [ ] Adapter reload successful
- [ ] Real inference executed (non-empty generation)
- [ ] JSON clinical contract parsed from the generated output
- [ ] Evaluation split completed
- [ ] `training_metadata.json` written

If any item fails, the status must remain **BLOCKED** (preflight failure) or
**FAILED** (runtime failure). A smoke/CPU/mock result must never be presented as
success.

---

## H. Git safety

Creating this document is a **documentation-only** change. Do not create a
Phase 4A commit just because this guide exists. Before any commit, show and check:

```bash
git status
git diff --check
git diff --name-only        # confirm doc-only and Phase 4A-scoped
```

Rules for this repository state:

1. Per the Phase 4A instruction, the Phase 4A implementation files must not be
   committed until a **successful real Qwen QLoRA run** is achieved. This guide
   does not change that.
2. The strict runner and training implementation must remain unmodified.
3. `.vscode/settings.json`, `.env.example`, and build/test artifacts are not
   Phase 4A deliverables; keep them out of any Phase 4A commit.

### Safe path to publish the LLM work on GitHub (no history loss)

The LLM project currently lives only in the local checkout at
`ai-upchar-prescription/AI-Doctor-OS`. Its `main` is **ahead 4, behind 11** of the
shared remote `origin/main`, and `ai-upchar-llm/` does not exist on the remote at
all. The remote `main` also holds the live web-app history.

- **Do NOT** `git push --force` this `main` to the shared `origin/main`; that
  would overwrite the 11 web-app commits.
- **Do** publish the LLM work on a **dedicated branch**, then open a PR:

```bash
# from ai-upchar-prescription/AI-Doctor-OS
git switch -c feature/ai-upchar-llm
git push -u origin feature/ai-upchar-llm    # only after you approve pushing
```

This keeps `origin/main` intact and lets the LLM work be reviewed/merged
deliberately rather than force-overwriting shared history. Consider whether the
LLM belongs in this same repository or a separate one before merging.

---

## Summary

- **Free & usable now:** Kaggle or Colab Free can produce a real validation
  result in a notebook; they are weak for persistent VS Code/SSH development.
- **Best VS Code/Kiro experience:** a Linux cloud GPU box over Remote-SSH (paid,
  e.g. RunPod/Vast.ai), running the same repo and scripts unchanged.
- **Minimum GPU:** 8 GiB VRAM; **recommended:** 12–16 GiB.
- **Nothing is faked, purchased, or force-pushed by this document.**
