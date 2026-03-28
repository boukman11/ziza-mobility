param(
  [Parameter(Mandatory=$true)][ValidateSet("customer","driver","admin")][string]$Role,
  [Parameter(Mandatory=$true)][string]$Email,
  [Parameter(Mandatory=$true)][string]$Password,
  [string]$BaseUrl="http://localhost:8080",
  [string]$Realm="ziza"
)

$clientId = switch ($Role) {
  "customer" { "ziza-customer" }
  "driver"   { "ziza-driver" }
  "admin"    { "ziza-admin" }
}

$tokenResp = Invoke-RestMethod -Method Post "$BaseUrl/realms/$Realm/protocol/openid-connect/token" `
  -ContentType "application/x-www-form-urlencoded" `
  -Body "client_id=$clientId&grant_type=password&username=$Email&password=$Password"

$tokenResp.access_token
