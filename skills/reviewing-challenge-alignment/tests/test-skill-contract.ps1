param(
    [string]$SkillPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$required = @(
    "SKILL.md",
    "agents\openai.yaml",
    "references\review-contract.md",
    "references\output-template.md",
    "scripts\check-required-files.ps1",
    "tests\pressure-scenarios.md"
)

foreach ($relative in $required) {
    if (-not (Test-Path -LiteralPath (Join-Path $SkillPath $relative))) {
        Write-Error "Missing required skill artifact: $relative"
        exit 1
    }
}

$skill = Get-Content -Raw -LiteralPath (Join-Path $SkillPath "SKILL.md")
$contract = Get-Content -Raw -LiteralPath (Join-Path $SkillPath "references\review-contract.md")
$scenarios = Get-Content -Raw -LiteralPath (Join-Path $SkillPath "tests\pressure-scenarios.md")

$skillTerms = @("PASS", "WARN", "FAIL", "git diff", "challenge-traceability.md", "verification")
foreach ($term in $skillTerms) {
    if ($skill -notmatch [regex]::Escape($term)) {
        Write-Error "SKILL.md is missing gate term: $term"
        exit 1
    }
}

foreach ($id in 1..11) {
    $requirement = "CH02-{0:d2}" -f $id
    if ($contract -notmatch [regex]::Escape($requirement)) {
        Write-Error "Review contract is missing requirement: $requirement"
        exit 1
    }
}

$scenarioTerms = @("Supabase", "future-offence", "regression tests", "district correlation", "chatbot")
foreach ($term in $scenarioTerms) {
    if ($scenarios -notmatch [regex]::Escape($term)) {
        Write-Error "Pressure scenarios are missing: $term"
        exit 1
    }
}

$placeholderMatches = Get-ChildItem -LiteralPath $SkillPath -Recurse -File |
    Where-Object { $_.FullName -ne $PSCommandPath } |
    Select-String -Pattern "TODO|TBD|\[TODO" -SimpleMatch:$false
if ($placeholderMatches) {
    Write-Error "Skill contains unresolved placeholders."
    exit 1
}

Write-Output "PASS: skill artifacts, gates, requirements, and pressure scenarios are complete."
