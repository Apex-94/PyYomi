param(
  [string]$PythonPath,
  [switch]$InstallDependencies,
  [switch]$Clean,
  [switch]$SkipPipUpgrade
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$backendDir = Join-Path $repoRoot 'backend'

$resolvedPythonPath = if ($PythonPath) {
  $PythonPath
} elseif (Test-Path (Join-Path $backendDir 'venv\Scripts\python.exe')) {
  Join-Path $backendDir 'venv\Scripts\python.exe'
} elseif (Test-Path (Join-Path $backendDir '.venv\Scripts\python.exe')) {
  Join-Path $backendDir '.venv\Scripts\python.exe'
} else {
  'python'
}

Write-Host "Using Python: $resolvedPythonPath"

Push-Location $backendDir
try {
  if ($InstallDependencies) {
    if (-not $SkipPipUpgrade) {
      & $resolvedPythonPath -m pip install --upgrade pip
    }
    & $resolvedPythonPath -m pip install -r requirements.txt
    & $resolvedPythonPath -m pip install pyinstaller
  }

  $pyInstallerArgs = @('-m', 'PyInstaller', 'pyinstaller.spec')
  if ($Clean) {
    $pyInstallerArgs += '--clean'
  }

  & $resolvedPythonPath @pyInstallerArgs
} finally {
  Pop-Location
}
