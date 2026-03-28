$ErrorActionPreference="Stop"
Write-Host "[validate] docker compose config..."
docker compose config | Out-Null
Write-Host "OK: docker-compose.yml valide"
