# Apply pending SQL migrations on self-hosted Supabase Postgres (via SSH + docker exec psql).
#
# Usage:
#   .\scripts\run-migrations-vps.ps1
#   .\scripts\run-migrations-vps.ps1 -DryRun
#   .\scripts\run-migrations-vps.ps1 -MarkVersion 20260603000000_zoom_webinar_auto_create
#   .\scripts\run-migrations-vps.ps1 -BaselineThrough 20260522100000_email_campaign_jobs_missing_fields
#
# First run on a DB that already has schema from SQL Editor: use -BaselineThrough with the
# last migration you know is live, then run without flags to apply only newer files.
#
# Requires: SSH_TARGET (or VPS_USER+VPS_HOST) in .env.deploy; OpenSSH on Windows.
# Optional .env.deploy: POSTGRES_CONTAINER, POSTGRES_USER, POSTGRES_DB
#   POSTGRES_USER=supabase_admin — use when public tables are owned by supabase_admin (typical)
# Or set DATABASE_URL to run psql locally (no SSH) if you have psql installed.

param(
    [switch]$DryRun,
    [switch]$Force,
    [string]$MarkVersion,
    [string]$BaselineThrough
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$MigrationsDir = Join-Path $RepoRoot "supabase\migrations"
$BootstrapSql = Join-Path $PSScriptRoot "sql\hkra_schema_migrations_bootstrap.sql"

function Import-DeployEnvFile {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return }
    Get-Content -LiteralPath $Path | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq '' -or $line.StartsWith('#')) { return }
        $eq = $line.IndexOf('=')
        if ($eq -lt 1) { return }
        $key = $line.Substring(0, $eq).Trim()
        $val = $line.Substring($eq + 1).Trim()
        if ($val.Length -ge 2) {
            $q = $val[0]
            if (($q -eq '"' -or $q -eq "'") -and $val.EndsWith($q)) {
                $val = $val.Substring(1, $val.Length - 2)
            }
        }
        if ($key) {
            $existing = Get-Item -Path "env:$key" -ErrorAction SilentlyContinue
            if (-not $existing -or [string]::IsNullOrEmpty($existing.Value)) {
                Set-Item -Path "env:$key" -Value $val
            }
        }
    }
}

function Escape-SqlLiteral {
    param([string]$Value)
    return $Value -replace "'", "''"
}

function Get-SshExe {
    $openSsh = Join-Path $env:WINDIR "System32\OpenSSH\ssh.exe"
    if (Test-Path -LiteralPath $openSsh) { return $openSsh }
    if (Get-Command ssh.exe -ErrorAction SilentlyContinue) { return (Get-Command ssh.exe).Source }
    throw "ssh.exe not found on PATH"
}

function Get-SshArgumentList {
    $args = @("-o", "BatchMode=yes")
    if ($env:SSH_KEY) {
        $args = @("-i", $env:SSH_KEY) + $args
    }
    return $args
}

function Escape-BashSingleQuoted {
    param([string]$Value)
    return $Value -replace "'", "'\''"
}

function Invoke-SshRemote {
    param([string]$RemoteCommand)
    & $script:SshExe @(Get-SshArgumentList) $script:SshTarget $RemoteCommand
    if ($LASTEXITCODE -ne 0) { throw "SSH failed (exit $LASTEXITCODE)" }
}

function Invoke-RemotePsqlCommand {
    param([string]$Sql)
    if ($script:UseDatabaseUrl) {
        & psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -c $Sql
        if ($LASTEXITCODE -ne 0) { throw "psql failed (exit $LASTEXITCODE)" }
        return
    }
    $escaped = Escape-BashSingleQuoted $Sql
    $remote = "docker exec $($script:PostgresContainer) psql -U $($script:PostgresUser) -d $($script:PostgresDb) -v ON_ERROR_STOP=1 -c '$escaped'"
    Invoke-SshRemote -RemoteCommand $remote
}

function Invoke-RemotePsqlFile {
    param([string]$FilePath)
    if ($script:UseDatabaseUrl) {
        & psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f $FilePath
        if ($LASTEXITCODE -ne 0) { throw "psql failed (exit $LASTEXITCODE)" }
        return
    }
    # Binary-safe pipe: local file -> ssh stdin -> docker exec psql (via cmd.exe).
    $remote = "docker exec -i $($script:PostgresContainer) psql -U $($script:PostgresUser) -d $($script:PostgresDb) -v ON_ERROR_STOP=1"
    $sshArgs = Get-SshArgumentList
    $sshOptsForCmd = ($sshArgs | ForEach-Object {
        if ($_ -match '\s') { " `"$_`"" } else { " $_" }
    }) -join ""
    $cmd = "type `"$FilePath`" | `"$($script:SshExe)`"$sshOptsForCmd $($script:SshTarget) `"$remote`""
    & cmd /c $cmd
    if ($LASTEXITCODE -ne 0) { throw "Remote psql failed (exit $LASTEXITCODE)" }
}

function Get-AppliedVersions {
    $query = "SELECT version FROM public.hkra_schema_migrations ORDER BY version;"
    if ($script:UseDatabaseUrl) {
        $out = & psql $env:DATABASE_URL -tAc $query 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Could not read hkra_schema_migrations (is the tracker table created?): $out" -ForegroundColor Red
            exit 1
        }
        return @($out | Where-Object { $_.Trim() -ne '' } | ForEach-Object { $_.Trim() })
    }
    $escaped = Escape-BashSingleQuoted $query
    $remote = "docker exec $($script:PostgresContainer) psql -U $($script:PostgresUser) -d $($script:PostgresDb) -tAc '$escaped'"
    $out = & $script:SshExe @(Get-SshArgumentList) $script:SshTarget $remote 2>&1
    if ($LASTEXITCODE -ne 0) {
        $msg = ($out | Out-String).Trim()
        if ($msg -match 'does not exist') {
            Write-Host "Tracker table public.hkra_schema_migrations not found yet (first run will create it)." -ForegroundColor Gray
            return @()
        }
        Write-Host "Failed to read applied migrations (exit $LASTEXITCODE). Not treating as empty — fix SSH/DB and retry." -ForegroundColor Red
        if ($msg) { Write-Host $msg -ForegroundColor Red }
        exit 1
    }
    return @($out | Where-Object { $_ -is [string] -and $_.Trim() -ne '' -and $_ -notmatch '^psql:' } | ForEach-Object { $_.Trim() })
}

function Get-RegisterMigrationSql {
    param([string]$Version, [string]$Name)
    $v = Escape-SqlLiteral $Version
    $n = Escape-SqlLiteral $Name
    return "INSERT INTO public.hkra_schema_migrations (version, name) VALUES ('$v', '$n') ON CONFLICT (version) DO NOTHING;"
}

function Register-Migration {
    param([string]$Version, [string]$Name)
    Invoke-RemotePsqlCommand -Sql (Get-RegisterMigrationSql -Version $Version -Name $Name)
}

function New-TrackerOnlySql {
    param(
        [switch]$IncludeBootstrap,
        [System.IO.FileInfo[]]$Files
    )
    $parts = New-Object System.Collections.Generic.List[string]
    if ($IncludeBootstrap) {
        $parts.Add((Get-Content -LiteralPath $BootstrapSql -Raw))
    }
    foreach ($f in $Files) {
        $parts.Add((Get-RegisterMigrationSql -Version $f.BaseName -Name $f.Name))
    }
    return ($parts -join "`n")
}

function New-CombinedMigrationSql {
    param(
        [switch]$IncludeBootstrap,
        [System.IO.FileInfo[]]$Files
    )
    $parts = New-Object System.Collections.Generic.List[string]
    if ($IncludeBootstrap -and $script:AppliedCount -eq 0) {
        $parts.Add((Get-Content -LiteralPath $BootstrapSql -Raw))
    }
    foreach ($f in $Files) {
        $parts.Add("-- file: $($f.Name)")
        $parts.Add((Get-Content -LiteralPath $f.FullName -Raw))
        $parts.Add((Get-RegisterMigrationSql -Version $f.BaseName -Name $f.Name))
    }
    return ($parts -join "`n")
}

function Invoke-RemotePsqlBatch {
    param([string]$CombinedSql)
    $tempFile = [System.IO.Path]::GetTempFileName() + ".sql"
    try {
        [System.IO.File]::WriteAllText($tempFile, $CombinedSql, [System.Text.UTF8Encoding]::new($false))
        Invoke-RemotePsqlFile -FilePath $tempFile
    } finally {
        if (Test-Path -LiteralPath $tempFile) {
            Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
        }
    }
}

Import-DeployEnvFile -Path (Join-Path $RepoRoot ".env.deploy")

$script:PostgresContainer = if ($env:POSTGRES_CONTAINER) { $env:POSTGRES_CONTAINER } else { "supabase-db" }
# Self-hosted HKRA: public tables are owned by supabase_admin; postgres gets "must be owner of table vendors".
$script:PostgresUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "supabase_admin" }
$script:PostgresDb = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "postgres" }
$script:UseDatabaseUrl = [bool]$env:DATABASE_URL
if ($env:POSTGRES_ROLE -and $script:PostgresUser -eq 'postgres') {
    Write-Host "POSTGRES_ROLE is ignored. Set POSTGRES_USER=supabase_admin instead (postgres cannot SET ROLE on this host)." -ForegroundColor Yellow
}

if (-not $script:UseDatabaseUrl) {
    $script:SshTarget = $env:SSH_TARGET
    if (-not $script:SshTarget -and $env:VPS_USER -and $env:VPS_HOST) {
        $script:SshTarget = "$($env:VPS_USER)@$($env:VPS_HOST)"
    }
    if (-not $script:SshTarget) {
        Write-Host "Set SSH_TARGET in .env.deploy, or DATABASE_URL for local psql." -ForegroundColor Red
        exit 1
    }
    $script:SshExe = Get-SshExe
} elseif (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-Host "DATABASE_URL is set but psql was not found on PATH." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $MigrationsDir)) {
    Write-Host "Missing migrations directory: $MigrationsDir" -ForegroundColor Red
    exit 1
}

$migrationFiles = Get-ChildItem -Path $MigrationsDir -Filter "*.sql" -File |
    Sort-Object Name -Unique

if ($MarkVersion) {
    $match = $migrationFiles | Where-Object { $_.BaseName -eq $MarkVersion }
    if (-not $match) {
        Write-Host "No migration file named ${MarkVersion}.sql" -ForegroundColor Red
        exit 1
    }
    Write-Host "Marking applied (single SSH batch)..." -ForegroundColor Cyan
    $sql = New-TrackerOnlySql -IncludeBootstrap -Files @($match)
    Invoke-RemotePsqlBatch -CombinedSql $sql
    Write-Host "Marked as applied (SQL not run): $($match.Name)" -ForegroundColor Green
    exit 0
}

if ($BaselineThrough) {
    $toMark = @()
    $found = $false
    foreach ($f in $migrationFiles) {
        $toMark += $f
        if ($f.BaseName -eq $BaselineThrough) {
            $found = $true
            break
        }
    }
    if (-not $found) {
        Write-Host "BaselineThrough not found: $BaselineThrough" -ForegroundColor Red
        exit 1
    }
    Write-Host "Baseline $($toMark.Count) file(s) (single SSH batch)..." -ForegroundColor Cyan
    $sql = New-TrackerOnlySql -IncludeBootstrap -Files $toMark
    Invoke-RemotePsqlBatch -CombinedSql $sql
    $toMark | ForEach-Object { Write-Host "  Marked: $($_.Name)" -ForegroundColor Gray }
    Write-Host "Baseline complete through $BaselineThrough (SQL not run)." -ForegroundColor Green
    exit 0
}

Write-Host "Migration target: $(if ($script:UseDatabaseUrl) { 'DATABASE_URL' } else { $script:SshTarget })" -ForegroundColor Cyan
Write-Host "  Postgres: $($script:PostgresContainer) / $($script:PostgresDb) (user $($script:PostgresUser))" -ForegroundColor Gray
if ($script:PostgresUser -eq 'postgres' -and -not $script:UseDatabaseUrl) {
    Write-Host "  ERROR: POSTGRES_USER=postgres cannot ALTER vendors (owned by supabase_admin)." -ForegroundColor Red
    Write-Host "  Set POSTGRES_USER=supabase_admin in .env.deploy (or unset `$env:POSTGRES_USER in this shell)." -ForegroundColor Yellow
    exit 1
}
if ($DryRun) { Write-Host "  Dry run — no SQL executed" -ForegroundColor Yellow }
Write-Host ""

$appliedList = @(Get-AppliedVersions)
$script:AppliedCount = $appliedList.Count
$applied = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
foreach ($v in $appliedList) { [void]$applied.Add($v) }

$pending = @()
foreach ($f in $migrationFiles) {
    if (-not $applied.Contains($f.BaseName)) {
        $pending += $f
    }
}

if ($applied.Count -gt 0) {
    Write-Host "Already applied ($($applied.Count)):" -ForegroundColor DarkGray
    $applied | Sort-Object | ForEach-Object { Write-Host "  + $_" -ForegroundColor DarkGray }
    Write-Host ""
}

if ($pending.Count -eq 0) {
    Write-Host "No pending migrations." -ForegroundColor Green
    exit 0
}

$firstPending = $pending[0].BaseName
if ($firstPending -match '^20250101' -and $applied.Count -eq 0) {
    Write-Host "WARNING: All repo migrations look pending on a live DB." -ForegroundColor Yellow
    Write-Host "  Run baseline first (no SQL), then apply only new files:" -ForegroundColor Yellow
    Write-Host '  .\scripts\run-migrations-vps.ps1 -BaselineThrough 20260522100000_email_campaign_jobs_missing_fields' -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Pending ($($pending.Count)):" -ForegroundColor Cyan
$pending | ForEach-Object { Write-Host "  - $($_.Name)" }

if ($DryRun) { exit 0 }

if (-not $Force -and $pending.Count -gt 3 -and $pending[0].BaseName -match '^20250101') {
    Write-Host "Refusing to apply $($pending.Count) migrations from 20250101 — live DB likely already has this schema." -ForegroundColor Red
    Write-Host "  1) Set POSTGRES_USER=supabase_admin in .env.deploy" -ForegroundColor Yellow
    Write-Host "  2) Re-baseline, then apply:" -ForegroundColor Yellow
    Write-Host '     .\scripts\run-migrations-vps.ps1 -BaselineThrough 20260522100000_email_campaign_jobs_missing_fields' -ForegroundColor Yellow
    Write-Host "     .\scripts\run-migrations-vps.ps1" -ForegroundColor Yellow
    Write-Host "  Or pass -Force only if you intend a full re-apply." -ForegroundColor DarkGray
    exit 1
}

Write-Host ""
Write-Host "Applying $($pending.Count) migration(s) in one batch (single SSH upload)..." -ForegroundColor Cyan
$batchSql = New-CombinedMigrationSql -IncludeBootstrap -Files $pending
Invoke-RemotePsqlBatch -CombinedSql $batchSql
$pending | ForEach-Object { Write-Host "  OK $($_.Name)" -ForegroundColor Green }

Write-Host ""
Write-Host "All pending migrations applied." -ForegroundColor Green
