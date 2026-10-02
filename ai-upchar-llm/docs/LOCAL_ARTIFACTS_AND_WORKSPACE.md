# AI UPCHAR local workspace and artifact layout

**Last updated:** 2026-10-02
**Primary repository:** `D:\Github Repo\Cursor\AI Doctor OS`

This repository is the primary working clone for AI UPCHAR application code,
LLM code, Kaggle notebook/package source, and documentation. Large model
artifacts and Kaggle downloads are organized inside the repository under a
local-only, Git-ignored folder so they are easy to find without accidentally
committing large files.

## Primary repo

```text
D:\Github Repo\Cursor\AI Doctor OS
```

Use this as the source-of-truth workspace for:

- application code,
- `ai-upchar-llm` code/configs/scripts,
- Kaggle notebook/package source,
- project documentation,
- future commits and branch work.

## Local-only artifact root

```text
D:\Github Repo\Cursor\AI Doctor OS\local-artifacts
```

This folder is intentionally listed in `.gitignore`:

```text
/local-artifacts/
```

Do not commit files from this folder. It contains local model artifacts, Kaggle
downloads, staging packages, and recovered archives.

## Organized structure

```text
local-artifacts/
+-- models/
|   +-- qwen3-4b-e2-corrected/
+-- golden-archives/
|   +-- e2_qwen3_4b_validation_outputs/
+-- kaggle/
    +-- datasets/
    +-- downloads/
    +-- runs/
```

## What was copied here

The following external artifact folders were copied into `local-artifacts`
without deleting or moving the originals:

| Original location | New organized location |
| --- | --- |
| `D:\Github Repo\AIUPCHAR\models` | `local-artifacts\models` |
| `D:\Github Repo\AIUPCHAR\e2_qwen3_4b_validation_outputs` | `local-artifacts\golden-archives\e2_qwen3_4b_validation_outputs` |
| `D:\Github Repo\AIUPCHAR\kaggle-downloads` | `local-artifacts\kaggle\downloads` |
| `D:\Github Repo\AIUPCHAR\kaggle-datasets` | `local-artifacts\kaggle\datasets` |
| `D:\Github Repo\AIUPCHAR\kaggle-runs` | `local-artifacts\kaggle\runs` |

Original folders remain in place for now. Delete or archive them only after a
separate explicit cleanup approval.

## Cleanup plan for old scattered folders

The copy into `local-artifacts/` has been verified by file counts, folder sizes,
and selected SHA256 checks. The following old scattered folders are now
duplicates of the organized local-artifact copies and can be cleaned up only
after explicit deletion approval.

### Verified duplicate folders

| Old scattered folder | Organized copy | Files | Size | Status |
| --- | --- | ---: | ---: | --- |
| `D:\Github Repo\AIUPCHAR\models` | `local-artifacts\models` | 56 | 692.27 MB | Copy verified |
| `D:\Github Repo\AIUPCHAR\e2_qwen3_4b_validation_outputs` | `local-artifacts\golden-archives\e2_qwen3_4b_validation_outputs` | 4 | 597.25 MB | Copy verified |
| `D:\Github Repo\AIUPCHAR\kaggle-downloads` | `local-artifacts\kaggle\downloads` | 106 | 1290.16 MB | Copy verified |
| `D:\Github Repo\AIUPCHAR\kaggle-datasets` | `local-artifacts\kaggle\datasets` | 6 | 597.31 MB | Copy verified |
| `D:\Github Repo\AIUPCHAR\kaggle-runs` | `local-artifacts\kaggle\runs` | 28 | 0.39 MB | Copy verified |

Total verified duplicate local-artifact copy:

```text
200 files
3177.39 MB
```

### Selected hash verification

| Artifact | Old hash | Organized-copy hash | Result |
| --- | --- | --- | --- |
| corrected E2 `adapter_model.safetensors` | `84AF3503EDEE7B7DDAA536B5736109404554DA8B807BBB1FB2F0101628458ABB` | `84AF3503EDEE7B7DDAA536B5736109404554DA8B807BBB1FB2F0101628458ABB` | Match |
| original E2 golden archive | `99E4020CCBDAFE58B60D163A1CD310E81EE6DABE85AEBCEBC98E876A45C707C6` | `99E4020CCBDAFE58B60D163A1CD310E81EE6DABE85AEBCEBC98E876A45C707C6` | Match |
| corrected E2 persistence manifest | `91037D880D06C9C3DF0176515CB3854E922FD9BED2D5FF3FD73145A0C1E53A75` | `91037D880D06C9C3DF0176515CB3854E922FD9BED2D5FF3FD73145A0C1E53A75` | Match |

### Recommended cleanup sequence

1. Keep the organized copies under `local-artifacts/`.
2. Do not delete old folders until the next model/inference step confirms that
   the primary repo path works as expected.
3. After explicit approval, remove only the five verified duplicate folders:
   - `D:\Github Repo\AIUPCHAR\models`
   - `D:\Github Repo\AIUPCHAR\e2_qwen3_4b_validation_outputs`
   - `D:\Github Repo\AIUPCHAR\kaggle-downloads`
   - `D:\Github Repo\AIUPCHAR\kaggle-datasets`
   - `D:\Github Repo\AIUPCHAR\kaggle-runs`
4. Do not delete old application/repo folders yet, including:
   - `D:\Github Repo\AIUPCHAR\ai-upchar-prescription`
   - `D:\Github Repo\AIUPCHAR\AI-Doctor-OS-updated`
   - `D:\Github Repo\AIUPCHAR\AI-UPCHAR-Landing-NewDesign`
   - `D:\Github Repo\AIUPCHAR\AI-UPCHAR-Landing-Next`
   - `D:\Github Repo\AIUPCHAR\_archived-from-c-2026-09-24`

Those older application/repo folders need separate review because they may
contain unrelated work, historical code, or manual backups.

## Important local artifacts

### Corrected E2 adapter

```text
local-artifacts\models\qwen3-4b-e2-corrected
```

Expected important files:

- `adapter_model.safetensors`
- `adapter_config.json`
- `checkpoint-46/`
- `checkpoint-92/`
- `checkpoint-138/`
- tokenizer files

### Original E2 golden output archive

```text
local-artifacts\golden-archives\e2_qwen3_4b_validation_outputs
```

Includes the original recovered E2 validation outputs and archive. This is the
safe reference for the pre-correction E2 adapter/artifact recovery work.

### Kaggle downloads

```text
local-artifacts\kaggle\downloads
```

Contains downloaded Kaggle outputs, extracted corrected E2 artifacts, logs, and
diagnostic result folders.

### Kaggle dataset staging

```text
local-artifacts\kaggle\datasets
```

Contains local staging folders used for Kaggle Dataset creation/upload.

### Kaggle run packages

```text
local-artifacts\kaggle\runs
```

Contains local notebook/package preparation for Kaggle runs.

## Git-tracked vs local-only boundary

Git-tracked:

- `ai-upchar-llm/src/`
- `ai-upchar-llm/configs/`
- `ai-upchar-llm/scripts/`
- `ai-upchar-llm/kaggle/` source packages/notebook definitions when intentionally versioned
- `ai-upchar-llm/docs/`

Local-only:

- model weights,
- checkpoint folders,
- `.tar.gz` artifact archives,
- downloaded Kaggle outputs,
- temporary extracted Kaggle result folders,
- local dataset-upload staging copies.

## Current next pipeline reference

For the current E2/E3 model-training and evaluation status, see:

- `ai-upchar-llm/docs/E2_E3_PROGRESS_AND_PIPELINE.md`

At the time of this organization step, the next model step is still the
controlled `e2-ho--001` comparison:

```text
BASE vs OLD E2 vs CORRECTED E2
```

Only after that passes should the frozen six-case held-out evaluation proceed.
