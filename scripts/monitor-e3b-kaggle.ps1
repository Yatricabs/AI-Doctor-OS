$ErrorActionPreference = 'Continue'
$repo = 'D:\Github Repo\Cursor\AI Doctor OS'
$python = 'D:\VS Code\Tools\Python312\Scripts\kaggle.exe'
$slug = 'yatricabs/ai-upchar-phase-e3b-behavioral'
$output = Join-Path $repo 'local-artifacts\kaggle\e3b-v22-output'
$log = Join-Path $repo 'local-artifacts\kaggle\e3b-v22-monitor.log'

New-Item -ItemType Directory -Force -Path $output | Out-Null
$status = (& $python kernels status $slug 2>&1 | Out-String).Trim()
Add-Content -LiteralPath $log -Value "$(Get-Date -Format o) $status"

if ($status -match 'COMPLETE|ERROR|CANCEL') {
    & $python kernels output $slug -p $output --force --file-pattern '.*(log|json|txt|tar|gz|safetensors|bin)$' 2>&1 |
        Add-Content -LiteralPath $log
    Add-Content -LiteralPath $log -Value "$(Get-Date -Format o) terminal state reached; output collection attempted."
}
