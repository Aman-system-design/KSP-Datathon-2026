param(
    [string]$ProjectRoot = "",
    [string]$BaseRef = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
} else {
    $ProjectRoot = (Resolve-Path $ProjectRoot).Path
}

$required = @(
    "docs\architecture\challenge-traceability.md",
    "docs\architecture\business-architecture-blueprint.md",
    "docs\architecture\role-access-and-experience-design.md",
    "docs\PROJECT_MEMORY.md",
    "Police_FIR_ER_Diagram.pdf"
)

$missing = @()
foreach ($relative in $required) {
    if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot $relative))) {
        $missing += $relative
    }
}

if ($missing.Count -gt 0) {
    Write-Output "FAIL: required alignment sources are missing:"
    $missing | ForEach-Object { Write-Output "- $_" }
    exit 1
}

Write-Output "PASS: required alignment sources are present."

$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
    Write-Output "WARN: Git executable is unavailable; inspect changed files manually."
    exit 0
}

Push-Location $ProjectRoot
try {
    $savedErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $insideWorkTree = & git rev-parse --is-inside-work-tree 2>$null
    $ErrorActionPreference = $savedErrorActionPreference
    if ($LASTEXITCODE -ne 0 -or $insideWorkTree -ne "true") {
        Write-Output "WARN: project is not a valid Git repository; no push diff can be inspected."
        exit 0
    }

    if (-not [string]::IsNullOrWhiteSpace($BaseRef)) {
        $changed = & git diff --name-only "$BaseRef...HEAD"
    } else {
        $changed = & git diff --name-only --cached
        if (-not $changed) {
            $changed = & git diff --name-only
        }
        $untracked = & git ls-files --others --exclude-standard 2>$null
        $changed = @($changed) + @($untracked) | Where-Object { $_ } | Sort-Object -Unique
    }

    if ($changed) {
        Write-Output "Changed files for semantic review:"
        $changed | ForEach-Object { Write-Output "- $_" }
    } else {
        Write-Output "WARN: no changed files detected in the selected review range."
    }
} finally {
    Pop-Location
}
