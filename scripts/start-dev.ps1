$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$frontendPath = Join-Path $projectRoot 'frontend'
$backendPath = Join-Path $projectRoot 'backend'
$backendPython = Join-Path $backendPath '.venv\Scripts\python.exe'

if (-not (Test-Path $backendPython)) {
    throw 'backend/.venv가 없습니다. 먼저 scripts/setup.ps1을 실행하세요.'
}

Start-Process powershell -WindowStyle Normal -ArgumentList '-NoExit', '-Command', "Set-Location -LiteralPath '$backendPath'; & '$backendPython' -m uvicorn app.main:app --reload --port 8000"
Start-Process powershell -WindowStyle Normal -ArgumentList '-NoExit', '-Command', "Set-Location -LiteralPath '$frontendPath'; pnpm dev"

Write-Host '프론트엔드와 백엔드 개발 서버 창을 열었습니다.' -ForegroundColor Green

