$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$frontendPath = Join-Path $projectRoot 'frontend'
$backendPath = Join-Path $projectRoot 'backend'

function Find-Command([string[]] $Candidates) {
    foreach ($candidate in $Candidates) {
        $command = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($command) { return $command.Source }
    }
    return $null
}

$packageManager = Find-Command @('pnpm.cmd', 'pnpm')
if (-not $packageManager) {
    throw 'pnpm을 찾지 못했습니다. Node.js LTS 설치 후 `corepack enable`을 실행하세요.'
}

$pythonLauncher = Find-Command @('py.exe', 'py', 'python.exe', 'python')
if (-not $pythonLauncher) {
    throw 'Python을 찾지 못했습니다. Python 3.12 이상을 설치하고 PATH에 추가하세요.'
}

if (-not (Test-Path (Join-Path $frontendPath '.env.local'))) {
    Copy-Item (Join-Path $frontendPath '.env.example') (Join-Path $frontendPath '.env.local')
}

Push-Location $frontendPath
try {
    & $packageManager install
} finally {
    Pop-Location
}

$venvPath = Join-Path $backendPath '.venv'
if (-not (Test-Path $venvPath)) {
    & $pythonLauncher -m venv $venvPath
}

if (-not (Test-Path (Join-Path $backendPath '.env'))) {
    Copy-Item (Join-Path $backendPath '.env.example') (Join-Path $backendPath '.env')
}

$venvPython = Join-Path $venvPath 'Scripts\python.exe'
& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -e "${backendPath}[dev]"

Write-Host 'Taste Report 개발 환경 설정이 완료되었습니다.' -ForegroundColor Green

