import json
from pathlib import Path

out = Path('local-artifacts/kaggle/uploads/e3b-validation-kernel')
out.mkdir(parents=True, exist_ok=True)
metadata = {
    'id': 'yatricabs/ai-upchar-e3b-validation',
    'title': 'AI UPCHAR E3B Validation',
    'code_file': 'e3b_validation.ipynb',
    'language': 'python',
    'kernel_type': 'notebook',
    'is_private': True,
    'enable_gpu': True,
    'enable_internet': True,
    'dataset_sources': ['yatricabs/ai-upchar-e3b-behavioral-source', 'yatricabs/ai-upchar-e3b-adapter-v22-c00', 'yatricabs/ai-upchar-e3b-adapter-v22-c01', 'yatricabs/ai-upchar-e3b-adapter-v22-meta'],
}
(out / 'kernel-metadata.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
code = """import os, sys, tarfile, subprocess, shutil
from pathlib import Path
ROOT = Path('/kaggle/working/ai-upchar-llm')
source = next(Path('/kaggle/input').glob('**/pyproject.toml')).parent
subprocess.run(['cp', '-a', str(source), str(ROOT)], check=True)
os.chdir(ROOT)
subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'bitsandbytes==0.48.2', 'peft==0.18.0', 'trl', 'datasets==4.4.1', 'pydantic'], check=True)
env = os.environ.copy(); env['PYTHONPATH'] = str(ROOT / 'src'); env['HF_HOME'] = '/kaggle/working/.hf-cache'
chunks = sorted(Path('/kaggle/input').glob('**/adapter.chunk.*'))
if len(chunks) != 2: raise RuntimeError(f'Expected 2 adapter chunks, found {len(chunks)}')
adapter = Path('/kaggle/working/e3b-artifacts/qwen3-4b-e3b-behavioral'); adapter.mkdir(parents=True, exist_ok=True)
with (adapter / 'adapter_model.safetensors').open('wb') as target:
    for chunk in chunks: target.write(chunk.read_bytes())
for source_file in Path('/kaggle/input').glob('**/qwen3-4b-e3b-behavioral/*.json'):
    shutil.copy2(source_file, adapter / source_file.name)
for source_file in Path('/kaggle/input').glob('**/qwen3-4b-e3b-behavioral/*.bin'):
    shutil.copy2(source_file, adapter / source_file.name)
for source_file in Path('/kaggle/input').glob('**/adapter_config.json'):
    shutil.copy2(source_file, adapter / source_file.name)
from transformers import AutoTokenizer
AutoTokenizer.from_pretrained('Qwen/Qwen3-4B-Base', trust_remote_code=True).save_pretrained(adapter)
cmd = [sys.executable, 'scripts/evaluate_e3_safety.py', '--adapter', str(adapter), '--e2-heldout', 'data/evaluation/e2_held_out_contract.jsonl', '--e3-heldout', 'data/evaluation/e3b_patient_interview_held_out.jsonl', '--output', '/kaggle/working/e3b_validation.json']
result = subprocess.run(cmd, env=env, text=True, capture_output=True)
Path('/kaggle/working/e3b_validation_stdout.txt').write_text(result.stdout + '\\n' + result.stderr)
if result.returncode: raise RuntimeError(result.stderr)
print(Path('/kaggle/working/e3b_validation.json').read_text())
targeted = [sys.executable, 'scripts/evaluate_e3_safety.py', '--adapter', str(adapter), '--e2-heldout', 'data/evaluation/e2_held_out_contract.jsonl', '--e3-heldout', 'data/evaluation/e3_targeted_safety_heldout.jsonl', '--output', '/kaggle/working/e2_1_safety_regression.json']
targeted_result = subprocess.run(targeted, env=env, text=True, capture_output=True)
Path('/kaggle/working/e2_1_safety_stdout.txt').write_text(targeted_result.stdout + '\\n' + targeted_result.stderr)
if targeted_result.returncode: raise RuntimeError(targeted_result.stderr)
print(Path('/kaggle/working/e2_1_safety_regression.json').read_text())
"""
notebook = {'cells': [{'cell_type': 'code', 'execution_count': None, 'metadata': {}, 'outputs': [], 'source': code.splitlines(True)}], 'metadata': {'kernelspec': {'display_name': 'Python 3', 'language': 'python', 'name': 'python3'}}, 'nbformat': 4, 'nbformat_minor': 5}
(out / 'e3b_validation.ipynb').write_text(json.dumps(notebook, indent=2), encoding='utf-8')
