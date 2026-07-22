$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$source = if ($env:WEBDESIGNER_SOURCE) { $env:WEBDESIGNER_SOURCE } else { "uset82/webdesigner" }
$ref = if ($env:WEBDESIGNER_REF) { $env:WEBDESIGNER_REF } else { "main" }
$marketplace = if ($env:WEBDESIGNER_MARKETPLACE) { $env:WEBDESIGNER_MARKETPLACE } else { "webdesigner-repo-marketplace" }
$plugin = if ($env:WEBDESIGNER_PLUGIN) { $env:WEBDESIGNER_PLUGIN } else { "webdesigner" }

foreach ($commandName in @("codex", "git", "node")) {
    if (-not (Get-Command $commandName -ErrorAction SilentlyContinue)) {
        throw "WebDesigner requires '$commandName' on PATH."
    }
}

$nodeMajor = [int](& node -p "process.versions.node.split('.')[0]")
if ($LASTEXITCODE -ne 0 -or $nodeMajor -lt 20) {
    throw "WebDesigner requires Node.js 20 or newer."
}

$marketplaces = (& codex plugin marketplace list 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0) {
    throw "Unable to list Codex plugin marketplaces.`n$marketplaces"
}

$escapedMarketplace = [regex]::Escape($marketplace)
$sourceIsLocal = Test-Path -LiteralPath $source -PathType Container
if ($marketplaces -match "(?m)^\s*$escapedMarketplace\s+") {
    if ($sourceIsLocal) {
        Write-Host "Using existing local WebDesigner marketplace..."
    }
    else {
        Write-Host "Updating WebDesigner marketplace..."
        & codex plugin marketplace upgrade $marketplace
    }
}
else {
    Write-Host "Adding WebDesigner marketplace..."
    if ($sourceIsLocal) {
        & codex plugin marketplace add $source
    }
    else {
        & codex plugin marketplace add $source --ref $ref
    }
}

if ($LASTEXITCODE -ne 0) {
    throw "Unable to add or update the WebDesigner marketplace."
}

Write-Host "Installing WebDesigner plugin..."
& codex plugin add "$plugin@$marketplace"
if ($LASTEXITCODE -ne 0) {
    throw "Unable to install the WebDesigner plugin."
}

Write-Host ""
Write-Host "WebDesigner is installed. Start a new Codex task to use the updated skills and tools." -ForegroundColor Green
