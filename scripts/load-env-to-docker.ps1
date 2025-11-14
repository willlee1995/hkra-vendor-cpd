# Load .env file and set environment variables in Docker container
# Usage: .\scripts\load-env-to-docker.ps1 [CONTAINER_NAME]
#
# This script reads a .env file and prepares environment variables for Docker.
# Note: For persistent environment variables, you should recreate the container
# with these variables set, or use Docker Compose with env_file directive.

param(
    [string]$ContainerName = $env:DOCKER_CONTAINER,
    [string]$EnvFile = ".env"
)

if (-not $ContainerName) {
    $ContainerName = "supabase_functions"
}

if (-not (Test-Path $EnvFile)) {
    Write-Host "❌ .env file not found: $EnvFile" -ForegroundColor Red
    Write-Host "   Create a .env file in the project root with your environment variables" -ForegroundColor Yellow
    exit 1
}

$containerExists = docker ps -a --format "{{.Names}}" | Select-String -Pattern "^$ContainerName$"
if (-not $containerExists) {
    Write-Host "❌ Docker container '$ContainerName' not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Available containers:" -ForegroundColor Yellow
    docker ps -a --format "table {{.Names}}\t{{.Status}}"
    exit 1
}

Write-Host "📝 Loading environment variables from $EnvFile into container: $ContainerName" -ForegroundColor Cyan
Write-Host ""

$envVars = @{}
Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()
    # Skip comments and empty lines
    if ($line -and -not $line.StartsWith('#')) {
        if ($line -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            if ($key -and $value) {
                $envVars[$key] = $value
                Write-Host "  ✓ $key" -ForegroundColor Green
            }
        }
    }
}

if ($envVars.Count -eq 0) {
    Write-Host "⚠️  No environment variables found in $EnvFile" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "⚠️  Note: Setting environment variables in a running container is temporary." -ForegroundColor Yellow
Write-Host "   For persistent environment variables, you should:" -ForegroundColor Yellow
Write-Host ""
Write-Host "   1. Use Docker Compose with env_file directive (recommended):" -ForegroundColor Cyan
Write-Host "      env_file:" -ForegroundColor Gray
Write-Host "        - .env" -ForegroundColor Gray
Write-Host ""
Write-Host "   2. Or recreate the container with environment variables" -ForegroundColor Cyan
Write-Host ""

$response = Read-Host "Continue anyway? (y/N)"
if ($response -ne 'y' -and $response -ne 'Y') {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "❌ Cannot set environment variables in a running container." -ForegroundColor Red
Write-Host ""
Write-Host "To set environment variables, you need to:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Option 1: Use Docker Compose (Recommended)" -ForegroundColor Cyan
Write-Host "  Add to your docker-compose.yml:" -ForegroundColor Gray
Write-Host "    services:" -ForegroundColor Gray
Write-Host "      supabase_functions:" -ForegroundColor Gray
Write-Host "        env_file:" -ForegroundColor Gray
Write-Host "          - .env" -ForegroundColor Gray
Write-Host ""
Write-Host "Option 2: Recreate container with environment variables" -ForegroundColor Cyan
Write-Host "  Stop and remove the container, then recreate it with:" -ForegroundColor Gray
Write-Host "    docker run -d --name $ContainerName \" -ForegroundColor Gray
$envVars.GetEnumerator() | ForEach-Object {
    Write-Host "      -e $($_.Key)=$($_.Value) \" -ForegroundColor Gray
}
Write-Host "      your-image:tag" -ForegroundColor Gray
Write-Host ""
Write-Host "Option 3: Export variables and restart (temporary)" -ForegroundColor Cyan
Write-Host "  The variables will be lost on container restart" -ForegroundColor Gray

