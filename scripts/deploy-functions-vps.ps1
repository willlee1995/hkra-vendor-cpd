# Deploy Edge Functions to a self-hosted Supabase VPS over SSH (Windows PowerShell).
#
# Usage:
#   $env:SSH_TARGET = "deploy@203.0.113.10"
#   .\scripts\deploy-functions-vps.ps1
#
# Optional:
#   $env:SSH_KEY = "C:\Users\you\.ssh\id_ed25519"
#   $env:REMOTE_EDGE_FUNCTIONS_DIR = "/tmp/hkra-edge-functions"
#   $env:DOCKER_CONTAINER = "supabase-edge-functions"
#   $env:FUNCTIONS_PATH = "/home/deno/functions"
#
# Requires: OpenSSH Client (ssh), tar (Windows 10+).
# NOTE: All piping to SSH is done via cmd.exe to avoid PowerShell binary pipe / stdin issues.

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$FuncRoot = Join-Path $RepoRoot "supabase\functions"

$sshTarget = $env:SSH_TARGET
if (-not $sshTarget -and $env:VPS_USER -and $env:VPS_HOST) {
    $sshTarget = "$($env:VPS_USER)@$($env:VPS_HOST)"
}
if (-not $sshTarget) {
    Write-Host "Set SSH_TARGET (e.g. deploy@your.vps.ip) or VPS_USER + VPS_HOST" -ForegroundColor Red
    exit 1
}

$remoteDir = if ($env:REMOTE_EDGE_FUNCTIONS_DIR) { $env:REMOTE_EDGE_FUNCTIONS_DIR } else { "/tmp/hkra-edge-functions" }
$dockerContainer = if ($env:DOCKER_CONTAINER) { $env:DOCKER_CONTAINER } else { "supabase-edge-functions" }
$functionsPath = if ($env:FUNCTIONS_PATH) { $env:FUNCTIONS_PATH } else { "/home/deno/functions" }

# Keep in sync with scripts/deploy-functions.sh
$functionDirs = @(
    "_shared",
    "hkra-create-event",
    "vendor-requests",
    "vendor-upload",
    "vendor-upload-poster",
    "vendor-info",
    "vendor-reminders",
    "manage-users"
)

$missingDirs = @()
foreach ($d in $functionDirs) {
    $p = Join-Path $FuncRoot $d
    if (-not (Test-Path $p)) {
        $missingDirs += $d
    }
}
if ($missingDirs.Count -gt 0) {
    Write-Host "Missing directories under supabase\functions\:" -ForegroundColor Red
    $missingDirs | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}

# Build SSH args string for cmd.exe (no splatting — just a flat string).
$sshOptsStr = "-o BatchMode=yes"
if ($env:SSH_KEY) {
    $sshOptsStr = "-i `"$($env:SSH_KEY)`" $sshOptsStr"
}

# Prefer Windows built-in OpenSSH over Git ssh.
$openSsh = Join-Path $env:WINDIR "System32\OpenSSH\ssh.exe"
if (Test-Path -LiteralPath $openSsh) {
    $sshExe = $openSsh
} elseif (Get-Command ssh.exe -ErrorAction SilentlyContinue) {
    $sshExe = (Get-Command ssh.exe).Source
} else {
    Write-Host "ssh.exe not found on PATH" -ForegroundColor Red
    exit 1
}

Write-Host "Deploying Edge Functions -> $sshTarget" -ForegroundColor Cyan
Write-Host "  Remote temp dir: $remoteDir"
Write-Host "  Container: ${dockerContainer}:${functionsPath}"
Write-Host "  SSH: $sshExe"
Write-Host ""

# --- Step 1: create remote temp directory -----------------------------------------
Write-Host "Step 1/3  Creating remote temp directory..." -ForegroundColor Cyan
$cmdMkdir = "`"$sshExe`" $sshOptsStr $sshTarget `"rm -rf '$remoteDir' && mkdir -p '$remoteDir'`""
& cmd /c $cmdMkdir
if ($LASTEXITCODE -ne 0) {
    Write-Host "SSH failed (exit $LASTEXITCODE). Check connectivity: ssh $sshTarget" -ForegroundColor Red
    exit $LASTEXITCODE
}

# --- Step 2: tar | ssh (via cmd.exe for reliable binary pipe) ---------------------
Write-Host "Step 2/3  Uploading functions (tar | ssh)..." -ForegroundColor Cyan
$dirsList = $functionDirs -join " "
# cmd /c runs: cd /d <funcRoot> && tar czf - <dirs> | ssh <opts> <target> "tar xzf - -C <remoteDir>"
$cmdUpload = "cd /d `"$FuncRoot`" && tar czf - $dirsList | `"$sshExe`" $sshOptsStr $sshTarget `"tar xzf - -C '$remoteDir'`""
& cmd /c $cmdUpload
if ($LASTEXITCODE -ne 0) {
    Write-Host "Upload failed (exit $LASTEXITCODE)" -ForegroundColor Red
    exit $LASTEXITCODE
}

# --- Step 3: docker cp + restart (single SSH command, no piping) ------------------
Write-Host "Step 3/3  docker cp + restart on VPS..." -ForegroundColor Cyan

# Build a single semicolon-delimited command string (no heredoc / stdin piping).
$dockerCmds = @()
$dockerCmds += "docker exec '$dockerContainer' mkdir -p '$functionsPath' 2>/dev/null || true"
foreach ($d in $functionDirs) {
    $dockerCmds += "docker cp '$remoteDir/$d' '$dockerContainer':'$functionsPath'/"
}
$dockerCmds += "docker restart '$dockerContainer'"
$dockerCmds += "rm -rf '$remoteDir'"
$remoteCmd = $dockerCmds -join " && "

$cmdDocker = "`"$sshExe`" $sshOptsStr $sshTarget `"$remoteCmd`""
& cmd /c $cmdDocker
if ($LASTEXITCODE -ne 0) {
    Write-Host "docker cp / restart failed (exit $LASTEXITCODE)" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Deploy finished." -ForegroundColor Green
Write-Host "Logs: ssh $sshTarget 'docker logs -f $dockerContainer'" -ForegroundColor Gray
