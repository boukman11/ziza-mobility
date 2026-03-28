$BASE=$env:KEYCLOAK_BASE_URL; if(!$BASE){$BASE="http://localhost:8080"}
$REALM=$env:KEYCLOAK_REALM; if(!$REALM){$REALM="ziza"}
$ADMIN_USER=$env:KEYCLOAK_ADMIN_USER; if(!$ADMIN_USER){$ADMIN_USER="admin"}
$ADMIN_PASS=$env:KEYCLOAK_ADMIN_PASS; if(!$ADMIN_PASS){$ADMIN_PASS="admin"}
$PWD=$env:DEFAULT_PASSWORD; if(!$PWD){$PWD="Passw0rd!"}

$tokenResp = Invoke-RestMethod -Method Post "$BASE/realms/master/protocol/openid-connect/token" `
  -ContentType "application/x-www-form-urlencoded" `
  -Body "client_id=admin-cli&grant_type=password&username=$ADMIN_USER&password=$ADMIN_PASS"
$TOKEN = $tokenResp.access_token

function Create-User($email){
  try {
    Invoke-RestMethod -Method Post "$BASE/admin/realms/$REALM/users" `
      -Headers @{Authorization="Bearer $TOKEN"} `
      -ContentType "application/json" `
      -Body (@{username=$email; email=$email; enabled=$true; emailVerified=$true} | ConvertTo-Json)
  } catch { }
}
function Get-UserId($email){
  $u = Invoke-RestMethod -Method Get "$BASE/admin/realms/$REALM/users?email=$email" `
    -Headers @{Authorization="Bearer $TOKEN"}
  return $u[0].id
}
function Set-Password($id){
  Invoke-RestMethod -Method Put "$BASE/admin/realms/$REALM/users/$id/reset-password" `
    -Headers @{Authorization="Bearer $TOKEN"} `
    -ContentType "application/json" `
    -Body (@{type="password"; temporary=$false; value=$PWD} | ConvertTo-Json)
}
function Get-Role($role){
  Invoke-RestMethod -Method Get "$BASE/admin/realms/$REALM/roles/$role" `
    -Headers @{Authorization="Bearer $TOKEN"}
}
function Assign-Role($id,$role){
  $r = Get-Role $role
  Invoke-RestMethod -Method Post "$BASE/admin/realms/$REALM/users/$id/role-mappings/realm" `
    -Headers @{Authorization="Bearer $TOKEN"} `
    -ContentType "application/json" `
    -Body ( @($r) | ConvertTo-Json )
}

$customer=$env:CUSTOMER_EMAIL; if(!$customer){$customer="customer1@example.com"}
$driver=$env:DRIVER_EMAIL; if(!$driver){$driver="driver1@example.com"}
$admin=$env:ADMIN_EMAIL; if(!$admin){$admin="admin1@example.com"}

Create-User $customer; Create-User $driver; Create-User $admin
$cid=Get-UserId $customer; $did=Get-UserId $driver; $aid=Get-UserId $admin
Set-Password $cid; Set-Password $did; Set-Password $aid
Assign-Role $cid "customer"; Assign-Role $did "driver"; Assign-Role $aid "admin"
"OK: users created/updated"
