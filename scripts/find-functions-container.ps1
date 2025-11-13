# Find Supabase Functions Container (PowerShell)
# Usage: .\scripts\find-functions-container.ps1

Write-Host "🔍 Searching for Supabase Functions containers..." -ForegroundColor Cyan
Write-Host ""

$containers = docker ps -a --format "{{.Names}}\t{{.Image}}\t{{.Status}}" | Where-Object { $_ -match "function|deno|edge" }

if ($containers) {
    Write-Host "Found potential functions containers:" -ForegroundColor Green
    Write-Host ""
    docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" | Where-Object { $_ -match "function|deno|edge|NAMES" }
    Write-Host ""
    Write-Host "💡 Use one of these container names with the deploy script:" -ForegroundColor Yellow
    Write-Host "   .\scripts\deploy-functions.ps1 -DockerContainer CONTAINER_NAME"
} else {
    Write-Host "⚠️  No functions containers found. Listing all containers:" -ForegroundColor Yellow
    Write-Host ""
    docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
    Write-Host ""
    Write-Host "💡 Look for containers with names like:" -ForegroundColor Yellow
    Write-Host "   - supabase_functions"
    Write-Host "   - supabase-edge-functions"
    Write-Host "   - supabase-functions"
}

