import os, time
from typing import Optional, Dict, Any, List
import requests
from fastapi import HTTPException
from jose import jwt

# Docker-local split:
# - Browser tokens: issuer uses host URL (localhost)
# - Containers reach Keycloak via service DNS (keycloak)
# We allow both issuers but fetch JWKS from internal URL.

OIDC_ISSUER_PUBLIC=os.getenv("OIDC_ISSUER_PUBLIC","http://localhost:8080/realms/ziza").rstrip("/")
OIDC_ISSUER_INTERNAL=os.getenv("OIDC_ISSUER_INTERNAL","http://keycloak:8080/realms/ziza").rstrip("/")

_allowed=os.getenv("OIDC_ALLOWED_ISSUERS","").strip()
if _allowed:
    OIDC_ALLOWED_ISSUERS=[s.strip().rstrip("/") for s in _allowed.split(",") if s.strip()]
else:
    OIDC_ALLOWED_ISSUERS=[OIDC_ISSUER_PUBLIC, OIDC_ISSUER_INTERNAL]

JWKS_URL=os.getenv("OIDC_JWKS_URL", f"{OIDC_ISSUER_INTERNAL}/protocol/openid-connect/certs")
WELL_KNOWN=os.getenv("OIDC_WELL_KNOWN", f"{OIDC_ISSUER_INTERNAL}/.well-known/openid-configuration")

CUSTOMER_AUD=os.getenv("CUSTOMER_AUD","customer-api")
DRIVER_AUD=os.getenv("DRIVER_AUD","driver-api")
ADMIN_AUD=os.getenv("ADMIN_AUD","admin-api")
_cache={"jwks":None,"ts":0}; TTL=60

def jwks():
    now=time.time()
    if _cache["jwks"] and now-_cache["ts"]<TTL: return _cache["jwks"]
    r=requests.get(JWKS_URL,timeout=5); r.raise_for_status()
    _cache["jwks"]=r.json(); _cache["ts"]=now
    return _cache["jwks"]

def extract_roles(claims: Dict[str,Any]) -> List[str]:
    return (claims.get("realm_access") or {}).get("roles") or []

def verify_token(authorization: Optional[str], expected_aud: str, required_role: str) -> Dict[str,Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401,"Missing Bearer token")
    token=authorization.split(" ",1)[1].strip()
    hdr=jwt.get_unverified_header(token)
    kid=hdr.get("kid")
    key=next((k for k in jwks().get("keys",[]) if k.get("kid")==kid),None)
    if not key: raise HTTPException(401,"Unknown signing key (kid)")
    try:
        claims=jwt.decode(token,key,algorithms=[hdr.get("alg","RS256")],options={"verify_aud":False,"verify_iss":False})
    except Exception as e:
        raise HTTPException(401,f"Invalid token: {e}")
    iss=(claims.get("iss") or "").rstrip("/")
    if iss not in OIDC_ALLOWED_ISSUERS:
        raise HTTPException(401, f"Invalid token: Invalid issuer (got {iss})")
    aud=claims.get("aud"); aud_list=aud if isinstance(aud,list) else [aud]
    if expected_aud not in aud_list:
        raise HTTPException(403,f"Wrong audience (expected {expected_aud})")
    roles=extract_roles(claims)
    if required_role not in roles:
        raise HTTPException(403,f"Missing role '{required_role}'")
    return claims

def check_keycloak() -> bool:
    try:
        return requests.get(WELL_KNOWN,timeout=3).status_code==200
    except Exception:
        return False
