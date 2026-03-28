$ErrorActionPreference="Stop"
Write-Host "[tests] Build api image..."
docker compose build api | Out-Null
Write-Host "[tests] Running pytest..."
docker compose run --rm api pytest -q
