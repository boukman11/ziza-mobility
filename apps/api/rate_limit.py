import os, time, base64, json
from typing import Dict, Tuple
from fastapi import Request, HTTPException

# Default global window + max request
DEFAULT_WINDOW_SEC = int(os.getenv("RL_WINDOW_SEC", "60"))
DEFAULT_MAX_REQ = int(os.getenv("RL_MAX_REQ", "180"))

# Per-bucket overrides via env:
# RL_BUCKETS='admin_sensitive=30:60,auth=20:60'
# meaning bucket=MAX:WINDOW_SEC
_BUCKETS_ENV = os.getenv("RL_BUCKETS", "")
_BUCKET_LIMITS = {}  # bucket -> (max_req, window_sec)
if _BUCKETS_ENV.strip():
    for part in _BUCKETS_ENV.split(","):
        part = part.strip()
        if not part or "=" not in part or ":" not in part:
            continue
        name, rest = part.split("=", 1)
        mx, win = rest.split(":", 1)
        try:
            _BUCKET_LIMITS[name.strip()] = (int(mx), int(win))
        except Exception:
            pass

_state: Dict[Tuple[str, str], Tuple[float, int]] = {}

def _jwt_sub(auth: str) -> str | None:
    try:
        if not auth.startswith("Bearer "):
            return None
        token = auth.split(" ", 1)[1].strip()
        parts = token.split(".")
        if len(parts) < 2:
            return None
        payload_b64 = parts[1] + "==="  # padding
        payload = json.loads(base64.urlsafe_b64decode(payload_b64.encode()).decode())
        return payload.get("sub")
    except Exception:
        return None

def _key(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    sub = _jwt_sub(auth) if auth else None
    if sub:
        return f"sub:{sub}"
    ip = request.client.host if request.client else "unknown"
    return f"ip:{ip}"

def _limits(bucket: str) -> Tuple[int, int]:
    if bucket in _BUCKET_LIMITS:
        return _BUCKET_LIMITS[bucket]
    return (DEFAULT_MAX_REQ, DEFAULT_WINDOW_SEC)

def limiter(bucket: str):
    async def _dep(request: Request):
        max_req, window_sec = _limits(bucket)
        k = (_key(request), bucket)
        now = time.time()
        start, count = _state.get(k, (now, 0))
        if now - start >= window_sec:
            start, count = now, 0
        count += 1
        _state[k] = (start, count)
        if count > max_req:
            raise HTTPException(429, f"Rate limit exceeded ({max_req}/{window_sec}s) bucket={bucket}")
    return _dep
