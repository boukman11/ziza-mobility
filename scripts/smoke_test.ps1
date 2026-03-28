$ErrorActionPreference="Stop"

$api="http://localhost:8000"
$kc="http://localhost:8080"
$realm="ziza"
$pwd="Passw0rd!"

function Get-Token($role,$email){
  $clientId = switch ($role) { "customer"{"ziza-customer"} "driver"{"ziza-driver"} "admin"{"ziza-admin"} }
  (Invoke-RestMethod -Method Post "$kc/realms/$realm/protocol/openid-connect/token" `
    -ContentType "application/x-www-form-urlencoded" `
    -Body "client_id=$clientId&grant_type=password&username=$email&password=$pwd").access_token
}

Write-Host "[1] Health..."
$h = Invoke-RestMethod "$api/health"
$h | ConvertTo-Json -Depth 5 | Write-Host

$customerTok = Get-Token "customer" "customer1@example.com"
$driverTok   = Get-Token "driver"   "driver1@example.com"

$hdrCustomer = @{ Authorization = "Bearer $customerTok"; "X-Request-Id" = [guid]::NewGuid().ToString() }
$hdrDriver   = @{ Authorization = "Bearer $driverTok";   "X-Request-Id" = [guid]::NewGuid().ToString() }

Write-Host "[2] Driver online + location..."
Invoke-RestMethod -Method Post "$api/v1/driver/status/online" -Headers $hdrDriver | Out-Null
Invoke-RestMethod -Method Patch "$api/v1/driver/location" -Headers $hdrDriver `
  -ContentType "application/json" -Body '{"lat":40.7357,"lng":-74.1724}' | Out-Null

Write-Host "[3] Estimate..."
$est = Invoke-RestMethod -Method Post "$api/v1/customer/trips/estimate" -Headers $hdrCustomer `
  -ContentType "application/json" -Body '{"pickup":{"lat":40.7357,"lng":-74.1724},"dropoff":{"lat":40.7300,"lng":-74.1400}}'
$est | ConvertTo-Json -Depth 5 | Write-Host

Write-Host "[4] Create trip..."
$idem = [guid]::NewGuid().ToString()
$hdrCustomer2 = $hdrCustomer.Clone(); $hdrCustomer2["Idempotency-Key"] = $idem
$trip = Invoke-RestMethod -Method Post "$api/v1/customer/trips" -Headers $hdrCustomer2 `
  -ContentType "application/json" -Body '{"pickup":{"lat":40.7357,"lng":-74.1724},"dropoff":{"lat":40.7300,"lng":-74.1400}}'
$tripId = $trip.tripId
Write-Host "tripId=$tripId"

Write-Host "[5] Driver available + accept + arrived + start + complete..."
$avail = Invoke-RestMethod "$api/v1/driver/trips/available?radius_km=50&limit=10&offset=0" -Headers $hdrDriver
$avail.items | ConvertTo-Json -Depth 5 | Write-Host

Invoke-RestMethod -Method Post "$api/v1/driver/trips/$tripId/accept"  -Headers $hdrDriver | Out-Null
Invoke-RestMethod -Method Post "$api/v1/driver/trips/$tripId/arrived" -Headers $hdrDriver | Out-Null
Invoke-RestMethod -Method Post "$api/v1/driver/trips/$tripId/start"   -Headers $hdrDriver | Out-Null
Invoke-RestMethod -Method Post "$api/v1/driver/trips/$tripId/complete" -Headers $hdrDriver -ContentType "application/json" -Body '{}' | Out-Null

Write-Host "[6] Receipt..."
$receipt = Invoke-RestMethod "$api/v1/customer/trips/$tripId/receipt" -Headers $hdrCustomer
$receipt | ConvertTo-Json -Depth 6 | Write-Host

Write-Host "[7] Notifications (customer + driver)..."
$cnot = Invoke-RestMethod "$api/v1/customer/notifications?limit=10&offset=0" -Headers $hdrCustomer
$dnot = Invoke-RestMethod "$api/v1/driver/notifications?limit=10&offset=0" -Headers $hdrDriver
Write-Host "Customer notifications: $($cnot.items.Count)"
Write-Host "Driver notifications: $($dnot.items.Count)"

Write-Host "OK smoke test."
