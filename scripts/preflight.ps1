$ErrorActionPreference="Stop"

Write-Host "[1/5] Validate compose..."
powershell -ExecutionPolicy Bypass -File scripts\validate_compose.ps1

Write-Host "[2/5] Build + up..."
docker compose down -v | Out-Null
docker compose up -d --build

function Wait-Http($url, $timeoutSec=120){
  $start = Get-Date
  while(((Get-Date) - $start).TotalSeconds -lt $timeoutSec){
    try {
      $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 $url
      if($r.StatusCode -ge 200 -and $r.StatusCode -lt 500){ return $true }
    } catch { }
    Start-Sleep -Seconds 2
  }
  throw "Timeout waiting for $url"
}

Write-Host "[3/5] Wait services..."
Wait-Http "http://localhost:8080/" 180 | Out-Null
Wait-Http "http://localhost:8000/health" 180 | Out-Null

Write-Host "[4/5] Create users in Keycloak..."
powershell -ExecutionPolicy Bypass -File scripts\create_users_keycloak.ps1

Write-Host "[5/5] Smoke test..."
powershell -ExecutionPolicy Bypass -File scripts\smoke_test.ps1

Write-Host "OK preflight."
