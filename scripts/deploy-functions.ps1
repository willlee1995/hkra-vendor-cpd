# Deploy Edge Functions to Self-Hosted Supabase (PowerShell for Windows)
# Usage: .\scripts\deploy-functions.ps1

param(
    [string]$DockerContainer = "supabase_functions",
    [string]$FunctionsPath = "/home/deno/functions",
    [string]$SupabaseUrl = "https://your-supabase-instance.com"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Deploying Edge Functions to Self-Hosted Supabase" -ForegroundColor Cyan
Write-Host "📍 URL: $SupabaseUrl" -ForegroundColor Gray
Write-Host ""

# Check if Docker is available
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Docker not found. Please install Docker Desktop." -ForegroundColor Red
    exit 1
}

# Check if functions directory exists
if (-not (Test-Path "supabase/functions")) {
    Write-Host "❌ Functions directory not found: supabase/functions" -ForegroundColor Red
    exit 1
}

# Check if container exists
$containerExists = docker ps -a --format "{{.Names}}" | Select-String -Pattern "^$DockerContainer$"
if (-not $containerExists) {
    Write-Host "❌ Docker container '$DockerContainer' not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Available containers:" -ForegroundColor Yellow
    docker ps -a --format "table {{.Names}}\t{{.Status}}"
    Write-Host ""
    Write-Host "Please specify container name:" -ForegroundColor Yellow
    Write-Host "   .\scripts\deploy-functions.ps1 -DockerContainer your-container-name"
    exit 1
}

# Create functions directory if it doesn't exist
Write-Host "📁 Preparing functions directory..." -ForegroundColor Cyan
docker exec $DockerContainer mkdir -p $FunctionsPath 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Could not create directory, trying alternative path..." -ForegroundColor Yellow
    $FunctionsPath = "/var/lib/docker/volumes/supabase_functions/_data"
}

# Deploy vendor-requests function
Write-Host ""
Write-Host "📦 Deploying vendor-requests function..." -ForegroundColor Cyan
docker cp supabase/functions/vendor-requests "${DockerContainer}:${FunctionsPath}/"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to copy vendor-requests" -ForegroundColor Red
    exit 1
}

# Deploy vendor-upload function
Write-Host ""
Write-Host "📦 Deploying vendor-upload function..." -ForegroundColor Cyan
docker cp supabase/functions/vendor-upload "${DockerContainer}:${FunctionsPath}/"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to copy vendor-upload" -ForegroundColor Red
    exit 1
}

# Restart the functions service
Write-Host ""
Write-Host "🔄 Restarting functions service..." -ForegroundColor Cyan
docker restart $DockerContainer
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Could not restart container automatically" -ForegroundColor Yellow
    Write-Host "   Please restart manually: docker restart $DockerContainer" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ All functions deployed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "🔗 Function URLs:" -ForegroundColor Cyan
Write-Host "   - vendor-requests: $SupabaseUrl/functions/v1/vendor-requests"
Write-Host "   - vendor-upload: $SupabaseUrl/functions/v1/vendor-upload"
Write-Host ""
Write-Host "💡 Check logs with: docker logs $DockerContainer" -ForegroundColor Gray

