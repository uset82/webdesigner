[CmdletBinding()]
param(
    [string]$BlenderPath,
    [string]$BlendFile,
    [string]$WorkspaceRoot = (Get-Location).Path,
    [ValidateRange(1, 65535)]
    [int]$Port = 9876,
    [ValidateRange(5, 120)]
    [int]$TimeoutSeconds = 30
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Resolve-BlenderExecutable {
    param([string]$ExplicitPath)

    $candidates = [System.Collections.Generic.List[string]]::new()
    if ($ExplicitPath) {
        $candidates.Add($ExplicitPath)
    }
    if ($env:BLENDER_PATH) {
        $candidates.Add($env:BLENDER_PATH)
    }

    $pathCommand = Get-Command blender -ErrorAction SilentlyContinue
    if ($pathCommand -and $pathCommand.Source) {
        $candidates.Add($pathCommand.Source)
    }

    $candidates.Add("C:\Program Files\Blender Foundation\Blender 4.5\blender.exe")

    foreach ($candidate in $candidates) {
        if (-not $candidate) {
            continue
        }
        try {
            $resolved = (Resolve-Path -LiteralPath $candidate -ErrorAction Stop).Path
        }
        catch {
            continue
        }
        if ((Get-Item -LiteralPath $resolved).PSIsContainer) {
            continue
        }
        return $resolved
    }

    throw "Blender was not found. Set BLENDER_PATH or install Blender 4.5 in its standard location."
}

function Get-PortListeners {
    param([int]$LocalPort)

    return @(Get-NetTCPConnection -State Listen -LocalPort $LocalPort -ErrorAction SilentlyContinue)
}

function Assert-BlenderListeners {
    param(
        [object[]]$Listeners,
        [int]$LocalPort,
        [int]$ExpectedProcessId = 0
    )

    foreach ($listener in $Listeners) {
        $owner = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
        if (-not $owner -or $owner.ProcessName -ne "blender") {
            $ownerLabel = if ($owner) { "$($owner.ProcessName) (PID $($owner.Id))" } else { "PID $($listener.OwningProcess)" }
            throw "Port $LocalPort is already owned by unrelated process $ownerLabel. Refusing to reuse it."
        }
        if ($ExpectedProcessId -and $owner.Id -ne $ExpectedProcessId) {
            throw "Port $LocalPort is owned by Blender PID $($owner.Id), not the Blender process just launched (PID $ExpectedProcessId)."
        }
    }
}

$resolvedWorkspaceRoot = (Resolve-Path -LiteralPath $WorkspaceRoot).Path
$blenderExecutable = Resolve-BlenderExecutable -ExplicitPath $BlenderPath
$versionLine = (& $blenderExecutable --version 2>&1 | Select-Object -First 1).ToString()
if ($versionLine -notmatch '^Blender\s+(?<version>\d+\.\d+\.\d+)') {
    throw "Could not determine the Blender version from $blenderExecutable."
}
$blenderVersion = [version]$Matches.version
if ($blenderVersion -lt [version]"3.6.0") {
    throw "Blender $blenderVersion is unsupported. Blender 3.6 or newer is required."
}

$listeners = @(Get-PortListeners -LocalPort $Port)
if ($listeners.Count -gt 0) {
    Assert-BlenderListeners -Listeners $listeners -LocalPort $Port
    $ownerId = $listeners[0].OwningProcess
    [pscustomobject]@{
        Status = "already-listening"
        ProcessId = $ownerId
        Port = $Port
        BlenderPath = $blenderExecutable
        BlenderVersion = $blenderVersion.ToString()
    }
    exit 0
}

$runningBlender = @(Get-Process -Name "blender" -ErrorAction SilentlyContinue)
if ($runningBlender.Count -gt 0) {
    $processList = ($runningBlender | ForEach-Object { "$($_.ProcessName) PID $($_.Id)" }) -join ", "
    throw "Blender is already running ($processList), but localhost:$Port is not listening. Start or repair the Blender MCP server in that visible session; this launcher will not open a second Blender process."
}

$arguments = [System.Collections.Generic.List[string]]::new()
$arguments.Add("--disable-autoexec")

if ($BlendFile) {
    $resolvedBlend = (Resolve-Path -LiteralPath $BlendFile -ErrorAction Stop).Path
    $blendItem = Get-Item -LiteralPath $resolvedBlend
    if ($blendItem.PSIsContainer -or $blendItem.Extension -ne ".blend") {
        throw "BlendFile must point to an existing .blend file."
    }

    $safeWorkRoot = [System.IO.Path]::GetFullPath((Join-Path $resolvedWorkspaceRoot "work\blender"))
    $normalizedBlend = [System.IO.Path]::GetFullPath($resolvedBlend)
    $safePrefix = $safeWorkRoot.TrimEnd('\') + '\'
    if (-not $normalizedBlend.StartsWith($safePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to open a source scene directly. Copy it under $safeWorkRoot first, then pass that working copy."
    }
    if ($blendItem.LinkType) {
        throw "Refusing to open a linked .blend file. Use a physical working copy under work\blender."
    }
    $arguments.Add($normalizedBlend)
}

$process = Start-Process -FilePath $blenderExecutable -ArgumentList $arguments -PassThru
$deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)

do {
    Start-Sleep -Milliseconds 500
    $process.Refresh()
    if ($process.HasExited) {
        throw "Blender exited before the MCP server became ready (exit code $($process.ExitCode))."
    }

    $listeners = @(Get-PortListeners -LocalPort $Port)
    if ($listeners.Count -gt 0) {
        Assert-BlenderListeners -Listeners $listeners -LocalPort $Port -ExpectedProcessId $process.Id
        [pscustomobject]@{
            Status = "started"
            ProcessId = $process.Id
            Port = $Port
            BlenderPath = $blenderExecutable
            BlenderVersion = $blenderVersion.ToString()
        }
        exit 0
    }
} while ([DateTime]::UtcNow -lt $deadline)

throw "Blender opened, but localhost:$Port did not become ready within $TimeoutSeconds seconds. Blender was left open; inspect the add-on state and auto-start setting in the visible application."
