$ErrorActionPreference="Stop"

Write-Host "[1/5] Validate compose..."
powershell -ExecutionPolicy Bypass -File scripts\validate_compose.ps1

Write-Host "[2/5] Unit tests..."
powershell -ExecutionPolicy Bypass -File scripts\run_tests.ps1

Write-Host "[3/5] Up stack..."
docker compose down -v | Out-Null
docker compose up -d --build

function Wait-Http($url, $timeoutSec=180){
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

Write-Host "[4/5] Wait services..."
Wait-Http "http://localhost:8080/" 240 | Out-Null
Wait-Http "http://localhost:8000/health" 240 | Out-Null

Write-Host "[5/5] Create users + smoke test..."
powershell -ExecutionPolicy Bypass -File scripts\create_users_keycloak.ps1
powershell -ExecutionPolicy Bypass -File scripts\smoke_test.ps1

Write-Host "OK CI local."
