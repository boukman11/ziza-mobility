from __future__ import annotations
import os, math, uuid, random, logging, json, time
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from fastapi import FastAPI, Depends, Header, HTTPException, Query, Request, Response, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy import select, update, func, or_, text
from sqlalchemy.orm import Session

from db import get_db
from models import (
    DriverApplication,
    DriverApplicationStatus,
    User,
    DriverProfile,
    DriverStatus,
    PricingRule,
    Trip,
    TripStatus,
    TripEvent,
    DriverLocationHistory,
    Assistance,
    AssistanceStatus,
    Payment,
    PaymentStatus,
    Payout,
    PayoutStatus,
    LedgerEntry,
    AuditLog,
    IdempotencyKey,
    Notification,
    UserPreference,
    EmailOutbox,
    EmailStatus,
    Job,
    JobStatus,
)
from auth import verify_token, CUSTOMER_AUD, DRIVER_AUD, ADMIN_AUD, extract_roles, check_keycloak
from keycloak_admin import user_realm_roles, add_realm_role, remove_realm_role, normalize_user_setup, find_user_id_by_email
from rate_limit import limiter
from errors import http_exception_handler, validation_exception_handler, unhandled_exception_handler
from schemas import (
    TripEstimateRequest, TripCreateRequest, DriverLocationUpdate, CompleteTripRequest,
    AssistanceCreateRequest, SeedRequest
)

app = FastAPI(title="Ziza Core API (Local Sprint 57)", version="4.57.0")


logger = logging.getLogger("ziza")
if not logger.handlers:
    logging.basicConfig(level=os.getenv("LOG_LEVEL","INFO"))

def _cid_from_headers(req: Request) -> str:
    return (
        req.headers.get("x-correlation-id")
        or req.headers.get("x-request-id")
        or str(uuid.uuid4())
    )

@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next):
    cid = _cid_from_headers(request)
    start = time.time()
    try:
        response: Response = await call_next(request)
    except Exception as e:
        dur_ms = int((time.time() - start) * 1000)
        logger.exception("request_error cid=%s method=%s path=%s dur_ms=%s", cid, request.method, request.url.path, dur_ms)
        # re-raise to default handler
        raise
    dur_ms = int((time.time() - start) * 1000)
    response.headers["X-Correlation-Id"] = cid
    logger.info("request cid=%s method=%s path=%s status=%s dur_ms=%s", cid, request.method, request.url.path, getattr(response, "status_code", "?"), dur_ms)
    return response

# --- Observability (Sprint 9)
logger = logging.getLogger("ziza")
logging.basicConfig(level=logging.INFO, format="%(message)s")

@app.middleware("http")
async def add_request_id_and_log(request, call_next):
    req_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())
    start = datetime.utcnow()
    try:
        response = await call_next(request)
        status = response.status_code
    except Exception as e:
        status = 500
        raise
    finally:
        dur_ms = int((datetime.utcnow() - start).total_seconds() * 1000)
        logger.info(json.dumps({
            "ts": start.isoformat() + "Z",
            "requestId": req_id,
            "method": request.method,
            "path": request.url.path,
            "status": status,
            "durationMs": dur_ms,
        }))
    response.headers["X-Request-Id"] = req_id
    # basic security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response

app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=False, allow_methods=["*"], allow_headers=["*"]
)

BASE_FARE=float(os.getenv("BASE_FARE","3.0"))
PER_KM=float(os.getenv("PER_KM","1.6"))
PER_MIN=float(os.getenv("PER_MIN","0.3"))
AVG_SPEED_KMH=float(os.getenv("AVG_SPEED_KMH","30"))
CURRENCY=os.getenv("CURRENCY","USD")
PLATFORM_FEE_PCT=float(os.getenv("PLATFORM_FEE_PCT","0.2"))

def customer_auth(authorization: Optional[str]=Header(default=None)) -> Dict[str,Any]:
    return verify_token(authorization, expected_aud=CUSTOMER_AUD, required_role="customer")
def driver_auth(authorization: Optional[str]=Header(default=None)) -> Dict[str,Any]:
    return verify_token(authorization, expected_aud=DRIVER_AUD, required_role="driver")
def admin_auth(authorization: Optional[str]=Header(default=None)) -> Dict[str,Any]:
    return verify_token(authorization, expected_aud=ADMIN_AUD, required_role="admin")

def any_user_auth(authorization: Optional[str]=Header(default=None)) -> Dict[str,Any]:
    # Accept customer OR driver OR admin token (for preferences/notifications)
    try:
        return verify_token(authorization, expected_aud=CUSTOMER_AUD, required_role="customer")
    except Exception:
        pass
    try:
        return verify_token(authorization, expected_aud=DRIVER_AUD, required_role="driver")
    except Exception:
        pass
    return verify_token(authorization, expected_aud=ADMIN_AUD, required_role="admin")


def upsert_user(db: Session, claims: Dict[str,Any]) -> User:
    """
    Create or update a user based on the OpenID Connect claims.

    Some tokens (e.g. from certain Keycloak configurations) may not include the
    standard ``sub`` (subject) claim. In that case we fall back to other
    identifying attributes such as ``preferred_username`` or the email address.
    If none of these are present we return an authentication error.
    """
    # Try to extract a stable identifier for the user. Prefer the 'sub' claim,
    # but fall back to 'preferred_username' or 'email' when necessary.
    sub = claims.get("sub") or claims.get("preferred_username") or claims.get("email")
    email = claims.get("email")
    if not sub:
        # Without any identifier we cannot map the token to a local user
        raise HTTPException(401, "Token missing sub")
    # Look up the existing user by the OIDC subject
    u = db.execute(select(User).where(User.oidc_sub == sub)).scalar_one_or_none()
    if u:
        # Synchronise email if it has changed
        if email and u.email != email:
            u.email = email
            db.add(u)
            db.commit()
        return u
    # Create a new user record
    u = User(oidc_sub=sub, email=email, created_at=datetime.utcnow())
    db.add(u)
    db.commit()
    db.refresh(u)
    return u

def audit(db: Session, actor_user_id, action: str, entity_type: str, entity_id: str, meta: dict|None=None):
    db.add(AuditLog(actor_user_id=actor_user_id, action=action, entity_type=entity_type, entity_id=entity_id, meta=meta or {}, created_at=datetime.utcnow()))
    db.commit()


def get_user_prefs(db: Session, user_id) -> dict:
    pref = db.get(UserPreference, user_id)
    if not pref:
        pref = UserPreference(user_id=user_id, prefs={}, updated_at=datetime.utcnow())
        db.add(pref); db.commit()
    return pref.prefs or {}

def set_user_prefs(db: Session, user_id, prefs: dict):
    pref = db.get(UserPreference, user_id)
    if not pref:
        pref = UserPreference(user_id=user_id, prefs=prefs or {}, updated_at=datetime.utcnow())
    else:
        pref.prefs = prefs or {}
        pref.updated_at = datetime.utcnow()
    db.add(pref); db.commit()



def enqueue_email(db: Session, user: User, subject: str, body: str):
    """Queue an email notification without breaking request flows on failure."""
    if not user or not user.email:
        return None
    try:
        out = EmailOutbox(
            user_id=user.id,
            to_email=user.email,
            subject=subject,
            body=body,
            status=EmailStatus.PENDING,
            attempts=0,
            next_attempt_at=datetime.utcnow(),
            created_at=datetime.utcnow(),
        )
        db.add(out)
        db.commit()
        return out
    except Exception:
        db.rollback()
        logger.exception("enqueue_email_failed user_id=%s", getattr(user, "id", None))
        return None
def notify_user(db: Session, user_id, notif_type: str, title: str, body: str, meta: dict | None = None):
    prefs = get_user_prefs(db, user_id)
    if prefs.get(notif_type) is False:
        return
    n = Notification(user_id=user_id, notif_type=notif_type, title=title, body=body, meta=meta or {}, is_read=False, created_at=datetime.utcnow(), read_at=None)
    db.add(n); db.commit()
    # email simulation for key events
    if notif_type in ("TRIP_ASSIGNED","TRIP_ARRIVED","TRIP_STARTED","TRIP_COMPLETED","TRIP_CANCELLED"):
        user = db.get(User, user_id)
        if user:
            enqueue_email(db, user, f"[{notif_type}] {title}", body)

def haversine_km(lat1, lon1, lat2, lon2) -> float:
    R=6371.0
    phi1=math.radians(lat1); phi2=math.radians(lat2)
    dphi=math.radians(lat2-lat1); dl=math.radians(lon2-lon1)
    a=math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(a))


def ensure_payment_for_trip(db: Session, trip: Trip) -> Payment:
    """Create a simulated payment + ledger entries for a completed trip if missing."""
    p = db.execute(select(Payment).where(Payment.trip_id==trip.id)).scalar_one_or_none()
    if p:
        return p
    amount = float(trip.final_price or trip.estimated_price)
    p = Payment(
        trip_id=trip.id,
        customer_user_id=trip.customer_user_id,
        amount=amount,
        currency=trip.currency,
        status=PaymentStatus.CAPTURED,
        provider="SIMULATED",
        provider_ref=f"sim_{trip.id}",
        created_at=datetime.utcnow(),
    )
    db.add(p); db.commit(); db.refresh(p)

    # Ledger entries
    platform_fee = round(amount * PLATFORM_FEE_PCT, 2)
    driver_earning = round(amount - platform_fee, 2)

    db.add(LedgerEntry(trip_id=trip.id, payment_id=p.id, payout_id=None, entry_type="CUSTOMER_CHARGE", amount=amount, currency=trip.currency, created_at=datetime.utcnow(), meta={"tripId":str(trip.id)}))
    db.add(LedgerEntry(trip_id=trip.id, payment_id=p.id, payout_id=None, entry_type="PLATFORM_FEE", amount=platform_fee, currency=trip.currency, created_at=datetime.utcnow(), meta={"pct":PLATFORM_FEE_PCT}))
    db.add(LedgerEntry(trip_id=trip.id, payment_id=p.id, payout_id=None, entry_type="DRIVER_EARNING", amount=driver_earning, currency=trip.currency, created_at=datetime.utcnow(), meta={"driverUserId":str(trip.driver_user_id) if trip.driver_user_id else None}))
    db.commit()
    return p

def get_active_pricing_rule(db: Session) -> PricingRule:
    pr=db.execute(select(PricingRule).where(PricingRule.is_active==True).order_by(PricingRule.created_at.desc())).scalar_one_or_none()
    if pr: return pr
    pr=PricingRule(name="default",currency=CURRENCY,base_fare=BASE_FARE,per_km=PER_KM,per_min=PER_MIN,avg_speed_kmh=AVG_SPEED_KMH,is_active=True,created_at=datetime.utcnow())
    db.add(pr); db.commit(); db.refresh(pr); return pr

def estimate_with_rule(rule: PricingRule, pickup: dict, dropoff: dict) -> dict:
    dist=haversine_km(float(pickup["lat"]),float(pickup["lng"]),float(dropoff["lat"]),float(dropoff["lng"]))
    duration_min=(dist/max(rule.avg_speed_kmh,1e-6))*60.0
    price=rule.base_fare+rule.per_km*dist+rule.per_min*duration_min
    snap={"rule_id":str(rule.id),"name":rule.name,"currency":rule.currency,"base_fare":rule.base_fare,"per_km":rule.per_km,"per_min":rule.per_min,"avg_speed_kmh":rule.avg_speed_kmh}
    return {"currency":rule.currency,"distance_km":round(dist,3),"duration_min":round(duration_min,1),"estimated_price":round(price,2),"pricing":snap}

TRIP_ALLOWED={
    TripStatus.REQUESTED:{TripStatus.ASSIGNED,TripStatus.CANCELLED},
    TripStatus.ASSIGNED:{TripStatus.ARRIVED,TripStatus.CANCELLED},
    TripStatus.ARRIVED:{TripStatus.IN_PROGRESS,TripStatus.CANCELLED},
    TripStatus.IN_PROGRESS:{TripStatus.COMPLETED},
    TripStatus.COMPLETED:set(),
    TripStatus.CANCELLED:set(),
}
ASSIST_ALLOWED={
    AssistanceStatus.REQUESTED:{AssistanceStatus.ASSIGNED,AssistanceStatus.CANCELLED},
    AssistanceStatus.ASSIGNED:{AssistanceStatus.COMPLETED,AssistanceStatus.CANCELLED},
    AssistanceStatus.COMPLETED:set(),
    AssistanceStatus.CANCELLED:set(),
}

def record_trip_event(db: Session, trip: Trip, actor_user_id, to_status: TripStatus):
    db.add(TripEvent(trip_id=trip.id, actor_user_id=actor_user_id, from_status=str(trip.status), to_status=str(to_status), created_at=datetime.utcnow()))

def set_trip_status(db: Session, trip: Trip, actor_user_id, new_status: TripStatus):
    if new_status not in TRIP_ALLOWED[trip.status]:
        raise HTTPException(409,f"Invalid trip transition {trip.status}->{new_status}")
    record_trip_event(db, trip, actor_user_id, new_status)
    trip.status=new_status; trip.updated_at=datetime.utcnow()
    now=datetime.utcnow()
    if new_status==TripStatus.ASSIGNED: trip.assigned_at=now
    if new_status==TripStatus.ARRIVED: trip.arrived_at=now
    if new_status==TripStatus.IN_PROGRESS: trip.started_at=now
    if new_status==TripStatus.COMPLETED: trip.completed_at=now
    if new_status==TripStatus.CANCELLED: trip.cancelled_at=now
    db.add(trip)

def find_active_trip_for_driver(db: Session, driver_id):
    q=select(Trip).where(Trip.driver_user_id==driver_id, Trip.status.in_([TripStatus.ASSIGNED,TripStatus.ARRIVED,TripStatus.IN_PROGRESS])).order_by(Trip.updated_at.desc())
    return db.execute(q).scalars().first()

def ensure_driver_trip(db: Session, driver_id, tid: uuid.UUID) -> Trip:
    t=db.get(Trip,tid)
    if not t: raise HTTPException(404,"Trip not found")
    if t.driver_user_id!=driver_id: raise HTTPException(403,"Not your trip")
    return t

# --- Idempotency helper
def idem_get_or_set(db: Session, user_id, scope: str, key: Optional[str], compute_fn):
    if not key:
        return None, compute_fn()
    existing=db.get(IdempotencyKey, key)
    if existing:
        if existing.user_id != user_id or existing.scope != scope:
            raise HTTPException(409,"Idempotency-Key conflict")
        return existing, existing.response_json
    resp=compute_fn()
    rec=IdempotencyKey(key=key, user_id=user_id, scope=scope, response_json=resp, created_at=datetime.utcnow())
    db.add(rec); db.commit()
    return rec, resp



# --- Health
@app.get("/health")
def health(db: Session=Depends(get_db)):
    db_ok=True
    try: db.execute(select(1)).one()
    except Exception: db_ok=False
    return {"status":"ok" if (db_ok and check_keycloak()) else "degraded", "db_ok": db_ok, "keycloak_ok": check_keycloak()}

# --- ME

@app.get("/v1/system/version")
def system_version():
    return {
        "service": "ziza-api",
        "sprint": 44,
        "version": "4.4.0",
        "time_utc": datetime.utcnow().isoformat() + "Z",
    }

@app.get("/v1/customer/me", dependencies=[Depends(limiter("me"))])
def customer_me(claims=Depends(customer_auth), db: Session=Depends(get_db)):
    u=upsert_user(db,claims)
    return {"id":str(u.id),"email":u.email,"roles":extract_roles(claims)}
# --- User preferences (Sprint 8)

@app.get("/v1/customer/driver/application", dependencies=[Depends(limiter("customer"))])
def customer_driver_application(claims=Depends(customer_auth), db: Session=Depends(get_db)):
    u = upsert_user(db, claims)
    app_row = db.execute(
        select(DriverApplication).where(DriverApplication.user_id == u.id).order_by(DriverApplication.created_at.desc())
    ).scalars().first()
    roles = extract_roles(claims)
    return {
        "email": u.email,
        "oidc_sub": u.oidc_sub,
        "roles": roles,
        "application": (
            {
                "id": str(app_row.id),
                "status": app_row.status.value,
                "created_at": app_row.created_at.isoformat(),
                "updated_at": app_row.updated_at.isoformat(),
                "note": app_row.note,
            } if app_row else None
        ),
    }

@app.post("/v1/customer/driver/apply", dependencies=[Depends(limiter("customer"))])
def customer_apply_driver(claims=Depends(customer_auth), db: Session=Depends(get_db)):
    u = upsert_user(db, claims)
    roles = extract_roles(claims)
    if "driver" in roles:
        return {"ok": True, "status": "ALREADY_DRIVER"}

    existing = db.execute(
        select(DriverApplication).where(DriverApplication.user_id == u.id).order_by(DriverApplication.created_at.desc())
    ).scalars().first()

    if existing and existing.status == DriverApplicationStatus.PENDING:
        return {"ok": True, "status": "PENDING", "application_id": str(existing.id)}

    app_row = DriverApplication(
        user_id=u.id,
        oidc_sub=u.oidc_sub or "",
        email=u.email or "",
        status=DriverApplicationStatus.PENDING,
        note=None,
    )
    db.add(app_row)
    db.commit()
    db.refresh(app_row)

    # Add driver_pending realm role in Keycloak to signal pending status
    if u.oidc_sub:
        normalize_user_setup(u.oidc_sub)
        try:
            add_realm_role(u.oidc_sub, "driver_pending")
        except Exception:
            # role might already exist or not be present; ignore to keep MVP resilient
            pass

    audit(db, u.id, "CUSTOMER_APPLY_DRIVER", "driver_application", str(app_row.id), {"email": u.email})
    return {"ok": True, "status": "PENDING", "application_id": str(app_row.id)}

@app.get("/v1/user/preferences", dependencies=[Depends(limiter("prefs"))])
def user_preferences(claims=Depends(any_user_auth), db: Session=Depends(get_db)):
    u=upsert_user(db,claims)
    return {"userId": str(u.id), "prefs": get_user_prefs(db, u.id)}

@app.put("/v1/user/preferences", dependencies=[Depends(limiter("prefs"))])
def user_preferences_update(payload: dict, claims=Depends(any_user_auth), db: Session=Depends(get_db)):
    u=upsert_user(db,claims)
    prefs = payload.get("prefs") or {}
    if not isinstance(prefs, dict):
        raise HTTPException(400,"prefs must be an object")
    set_user_prefs(db, u.id, prefs)
    return {"userId": str(u.id), "prefs": get_user_prefs(db, u.id)}



@app.get("/v1/driver/me", dependencies=[Depends(limiter("me"))])
def driver_me(claims=Depends(driver_auth), db: Session=Depends(get_db)):
    u=upsert_user(db,claims)
    dp=db.get(DriverProfile,u.id)
    if not dp:
        dp=DriverProfile(user_id=u.id,status=DriverStatus.ACTIVE,is_online=False,updated_at=datetime.utcnow())
        db.add(dp); db.commit()
    return {"id":str(u.id),"email":u.email,"roles":extract_roles(claims),"driver":{"status":dp.status,"is_online":dp.is_online}}

@app.get("/v1/admin/me", dependencies=[Depends(limiter("me"))])
def admin_me(claims=Depends(admin_auth), db: Session=Depends(get_db)):
    u=upsert_user(db,claims)
    return {"id":str(u.id),"email":u.email,"roles":extract_roles(claims)}

# --- Pricing
@app.get("/v1/admin/pricing/active", dependencies=[Depends(limiter("admin"))])
def admin_pricing_active(claims=Depends(admin_auth), db: Session=Depends(get_db)):
    u=upsert_user(db,claims); pr=get_active_pricing_rule(db)
    audit(db,u.id,"ADMIN_PRICING_ACTIVE","pricing_rule",str(pr.id),{})
    return {"id":str(pr.id),"name":pr.name,"currency":pr.currency,"base_fare":pr.base_fare,"per_km":pr.per_km,"per_min":pr.per_min,"avg_speed_kmh":pr.avg_speed_kmh,"is_active":pr.is_active}

# --- Customer estimate/create trips (idempotent)
@app.post("/v1/customer/trips/estimate", dependencies=[Depends(limiter("estimate"))])
def customer_estimate(payload: TripEstimateRequest, claims=Depends(customer_auth), db: Session=Depends(get_db)):
    return estimate_with_rule(get_active_pricing_rule(db), payload.pickup.model_dump(), payload.dropoff.model_dump())

@app.post("/v1/customer/trips", dependencies=[Depends(limiter("create_trip"))])
def customer_create_trip(payload: TripCreateRequest, claims=Depends(customer_auth), db: Session=Depends(get_db), idempotency_key: Optional[str]=Header(default=None, alias="Idempotency-Key")):
    u=upsert_user(db,claims)
    def compute():
        rule=get_active_pricing_rule(db)
        est=estimate_with_rule(rule, payload.pickup.model_dump(), payload.dropoff.model_dump())
        t=Trip(customer_user_id=u.id,status=TripStatus.REQUESTED,
               pickup_lat=payload.pickup.lat,pickup_lng=payload.pickup.lng,
               dropoff_lat=payload.dropoff.lat,dropoff_lng=payload.dropoff.lng,
               currency=est["currency"],distance_km=est["distance_km"],duration_min=est["duration_min"],
               estimated_price=est["estimated_price"],final_price=None,pricing_snapshot=est["pricing"],
               created_at=datetime.utcnow(),updated_at=datetime.utcnow())
        db.add(t); db.commit(); db.refresh(t)
        db.add(TripEvent(trip_id=t.id, actor_user_id=u.id, from_status=str(t.status), to_status=str(t.status), created_at=datetime.utcnow()))
        db.commit()
        audit(db,u.id,"TRIP_CREATED","trip",str(t.id),{"estimated_price":t.estimated_price})
        return {"tripId":str(t.id),"status":str(t.status),"estimate":est}
    _, resp = idem_get_or_set(db, u.id, "customer_create_trip", idempotency_key, compute)
    return resp

@app.get("/v1/customer/trips", dependencies=[Depends(limiter("list_trips"))])
def customer_list_trips(claims=Depends(customer_auth), db: Session=Depends(get_db), limit:int=Query(20,ge=1,le=100), offset:int=Query(0,ge=0)):
    u=upsert_user(db,claims)
    q=select(Trip).where(Trip.customer_user_id==u.id).order_by(Trip.created_at.desc()).limit(limit).offset(offset)
    items=db.execute(q).scalars().all()
    return {"items":[{"tripId":str(t.id),"status":str(t.status),"driverUserId":str(t.driver_user_id) if t.driver_user_id else None,"currency":t.currency,"estimated_price":t.estimated_price,"final_price":t.final_price} for t in items],
            "paging":{"limit":limit,"offset":offset}}

# Customer trip detail
# In earlier iterations of this project, the customer web app attempted to fetch trip details
# from /v1/customer/trips/{trip_id}, but no such endpoint existed, resulting in a 404
# error. The new endpoint below returns basic information about a single trip for the
# authenticated customer. If the trip does not belong to the requesting user, a 404 is
# returned.
@app.get("/v1/customer/trips/{trip_id}", dependencies=[Depends(limiter("track"))])
def customer_trip_detail(trip_id: str, claims=Depends(customer_auth), db: Session=Depends(get_db)):
    u = upsert_user(db, claims)
    try:
        tid = uuid.UUID(trip_id)
    except Exception:
        raise HTTPException(404, "Trip not found")
    t = db.get(Trip, tid)
    # Ensure the trip exists and belongs to this customer
    if not t or t.customer_user_id != u.id:
        raise HTTPException(404, "Trip not found")
    return {
        "tripId": str(t.id),
        "status": str(t.status),
        "customerUserId": str(t.customer_user_id),
        "driverUserId": str(t.driver_user_id) if t.driver_user_id else None,
        "pickup": {"lat": t.pickup_lat, "lng": t.pickup_lng},
        "dropoff": {"lat": t.dropoff_lat, "lng": t.dropoff_lng},
        "currency": t.currency,
        "distance_km": t.distance_km,
        "duration_min": t.duration_min,
        "estimated_price": t.estimated_price,
        "final_price": t.final_price,
        "created_at": t.created_at.isoformat(),
        "updated_at": t.updated_at.isoformat(),
    }

@app.post("/v1/customer/trips/{trip_id}/cancel", dependencies=[Depends(limiter("cancel"))])
def customer_cancel_trip(trip_id:str, claims=Depends(customer_auth), db: Session=Depends(get_db)):
    u=upsert_user(db,claims)
    t=db.get(Trip, uuid.UUID(trip_id))
    if not t or t.customer_user_id!=u.id: raise HTTPException(404,"Trip not found")
    set_trip_status(db,t,u.id,TripStatus.CANCELLED); db.commit()
    audit(db,u.id,"TRIP_CANCELLED","trip",str(t.id),{})
    if t.driver_user_id:
        notify_user(db, t.driver_user_id, "TRIP_CANCELLED", "Trip cancelled", f"Trip {t.id} was cancelled", {"tripId": str(t.id)})
    notify_user(db, t.customer_user_id, "TRIP_CANCELLED", "Trip cancelled", f"Trip {t.id} was cancelled", {"tripId": str(t.id)})
    return {"tripId":str(t.id),"status":str(t.status)}

@app.get("/v1/customer/trips/{trip_id}/track", dependencies=[Depends(limiter("track"))])
def customer_track(trip_id:str, claims=Depends(customer_auth), db: Session=Depends(get_db), limit:int=Query(200,ge=1,le=1000)):
    u=upsert_user(db,claims); tid=uuid.UUID(trip_id)
    t=db.get(Trip,tid)
    if not t or t.customer_user_id!=u.id: raise HTTPException(404,"Trip not found")
    pts=db.execute(select(DriverLocationHistory).where(DriverLocationHistory.trip_id==tid).order_by(DriverLocationHistory.recorded_at.desc()).limit(limit)).scalars().all()
    pts=list(reversed(pts))
    return {"tripId":str(tid),"points":[{"lat":p.lat,"lng":p.lng,"at":p.recorded_at.isoformat()} for p in pts]}


@app.get("/v1/customer/trips/{trip_id}/receipt", dependencies=[Depends(limiter("receipt"))])
def customer_receipt(trip_id: str, claims=Depends(customer_auth), db: Session=Depends(get_db)):
    u=upsert_user(db,claims)
    tid=uuid.UUID(trip_id)
    t=db.get(Trip, tid)
    if not t or t.customer_user_id != u.id:
        raise HTTPException(404,"Trip not found")
    if t.status != TripStatus.COMPLETED:
        raise HTTPException(409,"Trip not completed")
    p=ensure_payment_for_trip(db, t)
    # compute ledger breakdown
    entries=db.execute(select(LedgerEntry).where(LedgerEntry.trip_id==tid).order_by(LedgerEntry.created_at.asc())).scalars().all()
    return {
        "tripId": str(t.id),
        "status": str(t.status),
        "amount": p.amount,
        "currency": p.currency,
        "payment": {"id": str(p.id), "status": str(p.status), "provider": p.provider, "provider_ref": p.provider_ref},
        "breakdown": [{"type": e.entry_type, "amount": e.amount, "currency": e.currency, "meta": e.meta} for e in entries],
        "pricing_snapshot": t.pricing_snapshot,
    }

# --- Customer assistances (idempotent create)
@app.post("/v1/customer/assistances", dependencies=[Depends(limiter("assist_create"))])
def customer_create_assistance(payload: AssistanceCreateRequest, claims=Depends(customer_auth), db: Session=Depends(get_db), idempotency_key: Optional[str]=Header(default=None, alias="Idempotency-Key")):
    u=upsert_user(db,claims)
    def compute():
        a=Assistance(customer_user_id=u.id,status=AssistanceStatus.REQUESTED,lat=payload.location.lat,lng=payload.location.lng,note=payload.note,created_at=datetime.utcnow(),updated_at=datetime.utcnow())
        db.add(a); db.commit(); db.refresh(a)
        audit(db,u.id,"ASSISTANCE_CREATED","assistance",str(a.id),{})
        return {"assistanceId":str(a.id),"status":str(a.status)}
    _, resp = idem_get_or_set(db, u.id, "customer_create_assistance", idempotency_key, compute)
    return resp

@app.get("/v1/customer/assistances", dependencies=[Depends(limiter("assist_list"))])
def customer_list_assistances(claims=Depends(customer_auth), db: Session=Depends(get_db), limit:int=Query(20,ge=1,le=100), offset:int=Query(0,ge=0)):
    """
    List roadside assistance requests for the currently authenticated customer.

    The API previously returned only the assistance ID and status, which was
    insufficient for the front‑end to display useful information. This version
    includes additional fields such as the note, latitude/longitude and the
    creation timestamp. The response structure remains backwards‑compatible
    while enriching each item.
    """
    u = upsert_user(db, claims)
    q = (
        select(Assistance)
        .where(Assistance.customer_user_id == u.id)
        .order_by(Assistance.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    items = db.execute(q).scalars().all()
    return {
        "items": [
            {
                "assistanceId": str(a.id),
                "status": str(a.status),
                "driverUserId": str(a.driver_user_id) if a.driver_user_id else None,
                # Additional fields for UI display
                "note": a.note,
                "lat": a.lat,
                "lng": a.lng,
                "created_at": a.created_at.isoformat(),
            }
            for a in items
        ],
        "paging": {"limit": limit, "offset": offset},
    }

# --- Driver status/location (block if suspended)
@app.post("/v1/driver/status/online", dependencies=[Depends(limiter("driver"))])
def driver_online(claims=Depends(driver_auth), db: Session=Depends(get_db)):
    u=upsert_user(db,claims)
    dp=db.get(DriverProfile,u.id) or DriverProfile(user_id=u.id,status=DriverStatus.ACTIVE,is_online=False,updated_at=datetime.utcnow())
    if dp.status == DriverStatus.SUSPENDED:
        raise HTTPException(403,"Driver suspended")
    dp.is_online=True; dp.updated_at=datetime.utcnow()
    db.add(dp); db.commit()
    audit(db,u.id,"DRIVER_ONLINE","driver",str(u.id),{})
    return {"driverUserId":str(u.id),"is_online":True}

@app.post("/v1/driver/status/offline", dependencies=[Depends(limiter("driver"))])
def driver_offline(claims=Depends(driver_auth), db: Session=Depends(get_db)):
    u=upsert_user(db,claims)
    dp=db.get(DriverProfile,u.id) or DriverProfile(user_id=u.id,status=DriverStatus.ACTIVE,is_online=False,updated_at=datetime.utcnow())
    dp.is_online=False; dp.updated_at=datetime.utcnow()
    db.add(dp); db.commit()
    audit(db,u.id,"DRIVER_OFFLINE","driver",str(u.id),{})
    return {"driverUserId":str(u.id),"is_online":False}

@app.patch("/v1/driver/location", dependencies=[Depends(limiter("driver_loc"))])
def driver_location(payload: DriverLocationUpdate, claims=Depends(driver_auth), db: Session=Depends(get_db)):
    u=upsert_user(db,claims)
    dp=db.get(DriverProfile,u.id) or DriverProfile(user_id=u.id,status=DriverStatus.ACTIVE,is_online=False,updated_at=datetime.utcnow())
    dp.last_lat=payload.lat; dp.last_lng=payload.lng; dp.updated_at=datetime.utcnow()
    db.add(dp); db.commit()
    active=find_active_trip_for_driver(db,u.id)
    db.add(DriverLocationHistory(driver_user_id=u.id, trip_id=active.id if active else None, lat=payload.lat, lng=payload.lng, recorded_at=datetime.utcnow()))
    db.commit()
    return {"driverUserId":str(u.id),"tripId":str(active.id) if active else None}

@app.get("/v1/driver/trips/active", dependencies=[Depends(limiter("driver"))])
def driver_active_trip(claims=Depends(driver_auth), db: Session=Depends(get_db)):
    u=upsert_user(db,claims)
    t=find_active_trip_for_driver(db,u.id)
    if not t:
        return {"active": None}
    # include pickup/dropoff locations so the driver UI can display them on the map
    return {
        "active": {
            "tripId": str(t.id),
            "status": str(t.status),
            "customerUserId": str(t.customer_user_id),
            "pickup": {"lat": t.pickup_lat, "lng": t.pickup_lng},
            "dropoff": {"lat": t.dropoff_lat, "lng": t.dropoff_lng},
        }
    }

@app.get("/v1/driver/trips/available", dependencies=[Depends(limiter("avail"))])
def driver_available_trips(claims=Depends(driver_auth), db: Session=Depends(get_db), radius_km:float=Query(10,gt=0,le=50), limit:int=Query(20,ge=1,le=100), offset:int=Query(0,ge=0)):
    u=upsert_user(db,claims)
    dp=db.get(DriverProfile,u.id)
    # When the driver profile or location is missing/offline, return all available trips instead of empty list.
    # This allows drivers to see available missions even if they haven't gone online or set a location yet.
    trips = db.execute(select(Trip).where(Trip.status == TripStatus.REQUESTED).order_by(Trip.created_at.asc())).scalars().all()
    scored: list[tuple[float, Trip]] = []
    if dp and dp.last_lat is not None and dp.last_lng is not None:
        # compute distance from driver's last known location and filter by radius
        for t in trips:
            d = haversine_km(dp.last_lat, dp.last_lng, t.pickup_lat, t.pickup_lng)
            if d <= radius_km:
                scored.append((d, t))
        scored.sort(key=lambda x: x[0])
    else:
        # no location: include all trips with distance_km=0 to preserve sort order
        scored = [(0.0, t) for t in trips]
    page = scored[offset:offset + limit]
    return {
        "items": [
            {
                "tripId": str(t.id),
                "distance_km": round(d, 3),
                "pickup": {"lat": t.pickup_lat, "lng": t.pickup_lng},
                "dropoff": {"lat": t.dropoff_lat, "lng": t.dropoff_lng},
                "pricing": {"currency": t.currency, "estimated_price": t.estimated_price},
            }
            for d, t in page
        ],
        "paging": {"limit": limit, "offset": offset, "radius_km": radius_km},
    }

@app.post("/v1/driver/trips/{trip_id}/accept", dependencies=[Depends(limiter("accept"))])
def driver_accept(trip_id:str, claims=Depends(driver_auth), db: Session=Depends(get_db)):
    u=upsert_user(db,claims)
    dp=db.get(DriverProfile,u.id)
    if not dp or not dp.is_online: raise HTTPException(400,"Driver must be online")
    if dp.status==DriverStatus.SUSPENDED: raise HTTPException(403,"Driver suspended")
    tid=uuid.UUID(trip_id)
    res=db.execute(update(Trip).where(Trip.id==tid,Trip.status==TripStatus.REQUESTED).values(driver_user_id=u.id, updated_at=datetime.utcnow()).execution_options(synchronize_session=False))
    db.commit()
    if res.rowcount==0: raise HTTPException(409,"Trip already taken")
    t=db.get(Trip,tid)
    set_trip_status(db,t,u.id,TripStatus.ASSIGNED); db.commit()
    audit(db,u.id,"TRIP_ACCEPTED","trip",str(tid),{})
    notify_user(db, t.customer_user_id, "TRIP_ASSIGNED", "Driver assigned", f"Driver accepted trip {t.id}", {"tripId": str(t.id), "driverUserId": str(u.id)})
    notify_user(db, u.id, "TRIP_ASSIGNED", "Trip assigned", f"You accepted trip {t.id}", {"tripId": str(t.id)})
    return {"tripId":str(tid),"status":str(t.status)}

@app.post("/v1/driver/trips/{trip_id}/arrived", dependencies=[Depends(limiter("step"))])
def driver_arrived(trip_id:str, claims=Depends(driver_auth), db: Session=Depends(get_db)):
    u=upsert_user(db,claims); t=ensure_driver_trip(db,u.id,uuid.UUID(trip_id))
    set_trip_status(db,t,u.id,TripStatus.ARRIVED); db.commit()
    notify_user(db, t.customer_user_id, "TRIP_ARRIVED", "Driver arrived", f"Driver arrived for trip {t.id}", {"tripId": str(t.id)})
    notify_user(db, u.id, "TRIP_ARRIVED", "Arrived", f"You marked arrived for trip {t.id}", {"tripId": str(t.id)})
    return {"tripId":str(t.id),"status":str(t.status)}

@app.post("/v1/driver/trips/{trip_id}/start", dependencies=[Depends(limiter("step"))])
def driver_start(trip_id:str, claims=Depends(driver_auth), db: Session=Depends(get_db)):
    u=upsert_user(db,claims); t=ensure_driver_trip(db,u.id,uuid.UUID(trip_id))
    set_trip_status(db,t,u.id,TripStatus.IN_PROGRESS); db.commit()
    notify_user(db, t.customer_user_id, "TRIP_STARTED", "Trip started", f"Trip {t.id} started", {"tripId": str(t.id)})
    notify_user(db, u.id, "TRIP_STARTED", "Trip started", f"You started trip {t.id}", {"tripId": str(t.id)})
    return {"tripId":str(t.id),"status":str(t.status)}

@app.post("/v1/driver/trips/{trip_id}/complete", dependencies=[Depends(limiter("step"))])
def driver_complete(trip_id:str, payload: CompleteTripRequest|None=None, claims=Depends(driver_auth), db: Session=Depends(get_db)):
    u=upsert_user(db,claims); t=ensure_driver_trip(db,u.id,uuid.UUID(trip_id))
    if TripStatus.COMPLETED not in TRIP_ALLOWED[t.status]: raise HTTPException(409,"Not completable")
    t.final_price=round(float(payload.final_price) if payload and payload.final_price is not None else float(t.estimated_price),2)
    set_trip_status(db,t,u.id,TripStatus.COMPLETED); db.commit()
    _=ensure_payment_for_trip(db, t)
    db.commit()
    notify_user(db, t.customer_user_id, "TRIP_COMPLETED", "Trip completed", f"Trip {t.id} completed", {"tripId": str(t.id), "final_price": t.final_price})
    notify_user(db, u.id, "TRIP_COMPLETED", "Trip completed", f"You completed trip {t.id}", {"tripId": str(t.id), "final_price": t.final_price})
    return {"tripId":str(t.id),"status":str(t.status),"final_price":t.final_price,"currency":t.currency}

@app.get("/v1/driver/earnings/summary", dependencies=[Depends(limiter("earn"))])
def driver_earnings(claims=Depends(driver_auth), db: Session=Depends(get_db), days:int=Query(7,ge=1,le=90)):
    u=upsert_user(db,claims)
    since=datetime.utcnow()-timedelta(days=days)
    count_, total_ = db.execute(select(func.count(Trip.id), func.coalesce(func.sum(Trip.final_price),0.0)).where(Trip.driver_user_id==u.id, Trip.status==TripStatus.COMPLETED, Trip.updated_at>=since)).one()
    pr=get_active_pricing_rule(db)
    return {"driverUserId":str(u.id),"days":days,"completed_trips":int(count_ or 0),"total_earned":float(total_ or 0.0),"currency":pr.currency}
@app.get("/v1/driver/payouts", dependencies=[Depends(limiter("payouts"))])
def driver_payouts(claims=Depends(driver_auth), db: Session=Depends(get_db),
                   limit:int=Query(50,ge=1,le=200), offset:int=Query(0,ge=0)):
    u=upsert_user(db,claims)
    q=select(Payout).where(Payout.driver_user_id==u.id).order_by(Payout.created_at.desc()).limit(limit).offset(offset)
    items=db.execute(q).scalars().all()
    return {"items":[{"id":str(p.id),"amount":p.amount,"currency":p.currency,"status":str(p.status),"created_at":p.created_at.isoformat(),"note":p.note} for p in items],
            "paging":{"limit":limit,"offset":offset}}



# --- Trip events helpers (Sprint 6)
def serialize_trip_event(ev: TripEvent) -> dict:
    return {
        "id": str(ev.id),
        "tripId": str(ev.trip_id),
        "actorUserId": str(ev.actor_user_id) if ev.actor_user_id else None,
        "from": ev.from_status,
        "to": ev.to_status,
        "at": ev.created_at.isoformat(),
    }

async def sse_trip_events(db: Session, trip_id: uuid.UUID, since: datetime, poll_sec: float = 1.0):
    """Naive DB-polling SSE for local dev."""
    last = since
    while True:
        rows = db.execute(
            select(TripEvent)
            .where(TripEvent.trip_id == trip_id, TripEvent.created_at > last)
            .order_by(TripEvent.created_at.asc())
            .limit(100)
        ).scalars().all()
        if rows:
            last = rows[-1].created_at
            for ev in rows:
                data = json.dumps(serialize_trip_event(ev))
                yield f"event: trip_event\ndata: {data}\n\n"
        else:
            yield "event: ping\ndata: {}\n\n"
        import asyncio
        await asyncio.sleep(poll_sec)


# --- Trip events (REST + SSE) (Sprint 6)
@app.get("/v1/customer/trips/{trip_id}/events", dependencies=[Depends(limiter("events"))])
def customer_trip_events(trip_id: str, claims=Depends(customer_auth), db: Session=Depends(get_db),
                         limit: int=Query(200,ge=1,le=1000)):
    u=upsert_user(db,claims)
    tid=uuid.UUID(trip_id)
    t=db.get(Trip,tid)
    if not t or t.customer_user_id!=u.id:
        raise HTTPException(404,"Trip not found")
    evs=db.execute(select(TripEvent).where(TripEvent.trip_id==tid).order_by(TripEvent.created_at.asc()).limit(limit)).scalars().all()
    return {"tripId":str(tid),"items":[serialize_trip_event(e) for e in evs]}

@app.get("/v1/customer/trips/{trip_id}/events/stream", dependencies=[Depends(limiter("events_stream"))])
async def customer_trip_events_stream(trip_id: str, claims=Depends(customer_auth), db: Session=Depends(get_db),
                                      since_seconds: int=Query(300,ge=0,le=3600)):
    u=upsert_user(db,claims)
    tid=uuid.UUID(trip_id)
    t=db.get(Trip,tid)
    if not t or t.customer_user_id!=u.id:
        raise HTTPException(404,"Trip not found")
    since = datetime.utcnow() - timedelta(seconds=since_seconds)
    gen = sse_trip_events(db, tid, since)
    return StreamingResponse(gen, media_type="text/event-stream")

@app.get("/v1/driver/trips/{trip_id}/events", dependencies=[Depends(limiter("events"))])
def driver_trip_events(trip_id: str, claims=Depends(driver_auth), db: Session=Depends(get_db),
                       limit: int=Query(200,ge=1,le=1000)):
    u=upsert_user(db,claims)
    tid=uuid.UUID(trip_id)
    t=ensure_driver_trip(db,u.id,tid)
    evs=db.execute(select(TripEvent).where(TripEvent.trip_id==tid).order_by(TripEvent.created_at.asc()).limit(limit)).scalars().all()
    return {"tripId":str(tid),"items":[serialize_trip_event(e) for e in evs]}

@app.get("/v1/driver/trips/{trip_id}/events/stream", dependencies=[Depends(limiter("events_stream"))])
async def driver_trip_events_stream(trip_id: str, claims=Depends(driver_auth), db: Session=Depends(get_db),
                                    since_seconds: int=Query(300,ge=0,le=3600)):
    u=upsert_user(db,claims)
    tid=uuid.UUID(trip_id)
    _=ensure_driver_trip(db,u.id,tid)
    since = datetime.utcnow() - timedelta(seconds=since_seconds)
    gen = sse_trip_events(db, tid, since)
    return StreamingResponse(gen, media_type="text/event-stream")

# --- Admin ops
@app.get("/v1/admin/users", dependencies=[Depends(limiter("admin"))])
def admin_users(claims=Depends(admin_auth), db: Session=Depends(get_db), q: Optional[str]=Query(None), limit:int=Query(50,ge=1,le=200), offset:int=Query(0,ge=0)):
    u=upsert_user(db,claims)
    query=select(User).order_by(User.created_at.desc()).limit(limit).offset(offset)
    if q:
        query=select(User).where(or_(User.email.ilike(f"%{q}%"), User.oidc_sub.ilike(f"%{q}%"))).order_by(User.created_at.desc()).limit(limit).offset(offset)
    items=db.execute(query).scalars().all()
    audit(db,u.id,"ADMIN_LIST_USERS","user","*",{"q":q})
    return {"items":[{"id":str(x.id),"email":x.email,"oidc_sub":x.oidc_sub,"created_at":x.created_at.isoformat(),"roles":(user_realm_roles(x.oidc_sub) if x.oidc_sub else [])} for x in items],"paging":{"limit":limit,"offset":offset}}


@app.get("/v1/admin/iam/users/{oidc_sub}/roles", dependencies=[Depends(limiter("admin_sensitive"))])
def admin_iam_user_roles(oidc_sub: str, claims=Depends(admin_auth)):
    return {"oidc_sub": oidc_sub, "roles": user_realm_roles(oidc_sub)}

@app.post("/v1/admin/iam/users/{oidc_sub}/roles/add", dependencies=[Depends(limiter("admin_sensitive"))])
def admin_iam_add_role(oidc_sub: str, role: str = Query(..., min_length=1), claims=Depends(admin_auth), db: Session=Depends(get_db)):
    u = upsert_user(db, claims)
    normalize_user_setup(oidc_sub)
    add_realm_role(oidc_sub, role)
    audit(db, u.id, "ADMIN_IAM_ADD_ROLE", "iam", oidc_sub, {"role": role})
    return {"ok": True, "oidc_sub": oidc_sub, "roles": user_realm_roles(oidc_sub)}

@app.post("/v1/admin/iam/users/{oidc_sub}/roles/remove", dependencies=[Depends(limiter("admin_sensitive"))])
def admin_iam_remove_role(oidc_sub: str, role: str = Query(..., min_length=1), claims=Depends(admin_auth), db: Session=Depends(get_db)):
    u = upsert_user(db, claims)
    remove_realm_role(oidc_sub, role)
    audit(db, u.id, "ADMIN_IAM_REMOVE_ROLE", "iam", oidc_sub, {"role": role})
    return {"ok": True, "oidc_sub": oidc_sub, "roles": user_realm_roles(oidc_sub)}

@app.post("/v1/admin/iam/promote-driver", dependencies=[Depends(limiter("admin_sensitive"))])
def admin_iam_promote_driver(email: str = Query(..., min_length=3), claims=Depends(admin_auth), db: Session=Depends(get_db)):
    u = upsert_user(db, claims)
    oidc_sub = None
    row = db.execute(select(User).where(User.email == email)).scalars().first()
    if row:
        oidc_sub = row.oidc_sub
    else:
        oidc_sub = find_user_id_by_email(email)

    if not oidc_sub:
        raise HTTPException(404, f"Keycloak user not found for email {email}")

    normalize_user_setup(oidc_sub)
    add_realm_role(oidc_sub, "driver")
    audit(db, u.id, "ADMIN_IAM_PROMOTE_DRIVER", "iam", oidc_sub, {"email": email})
    return {"ok": True, "email": email, "oidc_sub": oidc_sub, "roles": user_realm_roles(oidc_sub)}


@app.get("/v1/admin/driver-applications", dependencies=[Depends(limiter("admin_sensitive"))])
def admin_list_driver_applications(
    status: Optional[str] = Query(None),
    claims=Depends(admin_auth),
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    admin_u = upsert_user(db, claims)
    q = select(DriverApplication).order_by(DriverApplication.created_at.desc()).limit(limit).offset(offset)
    if status:
        q = select(DriverApplication).where(DriverApplication.status == DriverApplicationStatus(status)).order_by(DriverApplication.created_at.desc()).limit(limit).offset(offset)
    items = db.execute(q).scalars().all()
    audit(db, admin_u.id, "ADMIN_LIST_DRIVER_APPLICATIONS", "driver_application", "*", {"status": status})
    return {
        "items": [
            {
                "id": str(a.id),
                "email": a.email,
                "oidc_sub": a.oidc_sub,
                "status": a.status.value,
                "created_at": a.created_at.isoformat(),
                "updated_at": a.updated_at.isoformat(),
                "note": a.note,
            }
            for a in items
        ],
        "paging": {"limit": limit, "offset": offset},
    }

@app.post("/v1/admin/driver-applications/{app_id}/approve", dependencies=[Depends(limiter("admin_sensitive"))])
def admin_approve_driver_application(
    app_id: str,
    claims=Depends(admin_auth),
    db: Session = Depends(get_db),
):
    admin_u = upsert_user(db, claims)
    a = db.execute(select(DriverApplication).where(DriverApplication.id == uuid.UUID(app_id))).scalars().first()
    if not a:
        raise HTTPException(404, "Application not found")
    a.status = DriverApplicationStatus.APPROVED
    a.updated_at = datetime.utcnow()
    db.add(a)
    db.commit()

    if a.oidc_sub:
        normalize_user_setup(a.oidc_sub)
        add_realm_role(a.oidc_sub, "driver")
        try:
            remove_realm_role(a.oidc_sub, "driver_pending")
        except Exception:
            pass

    audit(db, admin_u.id, "ADMIN_APPROVE_DRIVER_APPLICATION", "driver_application", app_id, {"email": a.email})
    return {"ok": True, "id": app_id, "status": a.status.value}

@app.post("/v1/admin/driver-applications/{app_id}/reject", dependencies=[Depends(limiter("admin_sensitive"))])
def admin_reject_driver_application(
    app_id: str,
    note: Optional[str] = Query(None),
    claims=Depends(admin_auth),
    db: Session = Depends(get_db),
):
    admin_u = upsert_user(db, claims)
    a = db.execute(select(DriverApplication).where(DriverApplication.id == uuid.UUID(app_id))).scalars().first()
    if not a:
        raise HTTPException(404, "Application not found")
    a.status = DriverApplicationStatus.REJECTED
    a.note = note
    a.updated_at = datetime.utcnow()
    db.add(a)
    db.commit()
    if a.oidc_sub:
        try:
            remove_realm_role(a.oidc_sub, "driver_pending")
        except Exception:
            pass
    audit(db, admin_u.id, "ADMIN_REJECT_DRIVER_APPLICATION", "driver_application", app_id, {"email": a.email, "note": note})
    return {"ok": True, "id": app_id, "status": a.status.value}

@app.get("/v1/admin/drivers", dependencies=[Depends(limiter("admin"))])
def admin_drivers(claims=Depends(admin_auth), db: Session=Depends(get_db), q: Optional[str]=Query(None), limit:int=Query(50,ge=1,le=200), offset:int=Query(0,ge=0)):
    u=upsert_user(db,claims)
    # join-ish via driver_profiles
    dpq=select(DriverProfile, User).join(User, User.id==DriverProfile.user_id).order_by(DriverProfile.updated_at.desc()).limit(limit).offset(offset)
    rows=db.execute(dpq).all()
    items=[]
    for dp,user in rows:
        if q and (not (user.email and q.lower() in user.email.lower()) and q.lower() not in str(user.id)):
            continue
        items.append({"userId":str(user.id),"email":user.email,"status":str(dp.status),"is_online":dp.is_online})
    audit(db,u.id,"ADMIN_LIST_DRIVERS","driver","*",{"q":q})
    return {"items":items,"paging":{"limit":limit,"offset":offset}}

@app.post("/v1/admin/drivers/{driver_user_id}/suspend", dependencies=[Depends(limiter("admin"))])
def admin_suspend_driver(driver_user_id:str, claims=Depends(admin_auth), db: Session=Depends(get_db)):
    u=upsert_user(db,claims)
    did=uuid.UUID(driver_user_id)
    dp=db.get(DriverProfile,did)
    if not dp: raise HTTPException(404,"Driver profile not found")
    dp.status=DriverStatus.SUSPENDED
    dp.is_online=False
    dp.updated_at=datetime.utcnow()
    db.add(dp); db.commit()
    audit(db,u.id,"ADMIN_DRIVER_SUSPEND","driver",driver_user_id,{})
    return {"driverUserId":driver_user_id,"status":str(dp.status),"is_online":dp.is_online}


@app.get("/v1/admin/trips", dependencies=[Depends(limiter("admin"))])
def admin_trips(claims=Depends(admin_auth), db: Session=Depends(get_db),
                status: Optional[str]=Query(None),
                limit:int=Query(100,ge=1,le=500), offset:int=Query(0,ge=0)):
    u=upsert_user(db,claims)
    q=select(Trip).order_by(Trip.created_at.desc())
    if status:
        q=q.where(Trip.status==status)
    q=q.limit(limit).offset(offset)
    items=db.execute(q).scalars().all()
    audit(db,u.id,"ADMIN_LIST_TRIPS","trip","*",{"status":status})
    return {"items":[{"tripId":str(t.id),"status":str(t.status),"customerUserId":str(t.customer_user_id),
                      "driverUserId":str(t.driver_user_id) if t.driver_user_id else None,
                      "currency":t.currency,"estimated_price":t.estimated_price,"final_price":t.final_price,
                      "created_at":t.created_at.isoformat()} for t in items],
            "paging":{"limit":limit,"offset":offset,"status":status}}

@app.get("/v1/admin/trips/{trip_id}", dependencies=[Depends(limiter("admin"))])
def admin_trip_detail(trip_id:str, claims=Depends(admin_auth), db: Session=Depends(get_db)):
    u=upsert_user(db,claims)
    tid=uuid.UUID(trip_id)
    t=db.get(Trip,tid)
    if not t: raise HTTPException(404,"Trip not found")
    audit(db,u.id,"ADMIN_GET_TRIP","trip",trip_id,{})
    return {"tripId":str(t.id),"status":str(t.status),"customerUserId":str(t.customer_user_id),
            "driverUserId":str(t.driver_user_id) if t.driver_user_id else None,
            "pickup":{"lat":t.pickup_lat,"lng":t.pickup_lng},
            "dropoff":{"lat":t.dropoff_lat,"lng":t.dropoff_lng},
            "currency":t.currency,"distance_km":t.distance_km,"duration_min":t.duration_min,
            "estimated_price":t.estimated_price,"final_price":t.final_price,
            "created_at":t.created_at.isoformat(),"updated_at":t.updated_at.isoformat()}

@app.get("/v1/admin/trips/{trip_id}/events", dependencies=[Depends(limiter("admin"))])
def admin_trip_events(trip_id:str, claims=Depends(admin_auth), db: Session=Depends(get_db),
                      limit:int=Query(200,ge=1,le=500)):
    u=upsert_user(db,claims)
    tid=uuid.UUID(trip_id)
    t=db.get(Trip,tid)
    if not t: raise HTTPException(404,"Trip not found")
    q=select(TripEvent).where(TripEvent.trip_id==tid).order_by(TripEvent.created_at.asc()).limit(limit)
    items=db.execute(q).scalars().all()
    audit(db,u.id,"ADMIN_LIST_TRIP_EVENTS","trip",trip_id,{"limit":limit})
    return {"items":[{"id":str(e.id),"from_status":e.from_status,"to_status":e.to_status,"created_at":e.created_at.isoformat()} for e in items],
            "paging":{"limit":limit}}

@app.get("/v1/admin/assistances", dependencies=[Depends(limiter("admin_sensitive"))])
def admin_list_assistances(claims=Depends(admin_auth), db: Session=Depends(get_db), status: Optional[str]=Query(None), limit:int=Query(50,ge=1,le=200), offset:int=Query(0,ge=0)):
    u=upsert_user(db,claims)
    q=select(Assistance).order_by(Assistance.created_at.desc())
    if status: q=q.where(Assistance.status==status)
    q=q.limit(limit).offset(offset)
    items=db.execute(q).scalars().all()
    audit(db,u.id,"ADMIN_LIST_ASSISTANCES","assistance","*",{"status":status})
    return {"items":[{"assistanceId":str(a.id),"status":str(a.status),"customerUserId":str(a.customer_user_id),"driverUserId":str(a.driver_user_id) if a.driver_user_id else None} for a in items],
            "paging":{"limit":limit,"offset":offset,"status":status}}

@app.post("/v1/admin/dev/seed", dependencies=[Depends(limiter("admin"))])

@app.get("/v1/admin/metrics", dependencies=[Depends(limiter("admin"))])
def admin_metrics(claims=Depends(admin_auth), db: Session=Depends(get_db)):
    u=upsert_user(db,claims)
    trips_total = db.execute(select(func.count(Trip.id))).scalar_one()
    trips_requested = db.execute(select(func.count(Trip.id)).where(Trip.status==TripStatus.REQUESTED)).scalar_one()
    assist_total = db.execute(select(func.count(Assistance.id))).scalar_one()
    drivers_total = db.execute(select(func.count(DriverProfile.user_id))).scalar_one()
    drivers_online = db.execute(select(func.count(DriverProfile.user_id)).where(DriverProfile.is_online==True)).scalar_one()
    audit(db,u.id,"ADMIN_METRICS","metrics","*",{})
    return {
        "trips": {"total": int(trips_total), "requested": int(trips_requested)},
        "assistances": {"total": int(assist_total)},
        "drivers": {"total": int(drivers_total), "online": int(drivers_online)},
    }


def admin_seed(payload: SeedRequest, claims=Depends(admin_auth), db: Session=Depends(get_db)):
    u=upsert_user(db,claims)
    # create a default customer row if none exists in DB yet (using admin as customer is fine for local)
    customer_id=u.id
    rule=get_active_pricing_rule(db)
    created={"trips":0,"assistances":0}
    for _ in range(max(0,min(payload.trips,100))):
        p={"lat":40.73+random.uniform(-0.05,0.05),"lng":-74.00+random.uniform(-0.05,0.05)}
        d={"lat":40.73+random.uniform(-0.08,0.08),"lng":-74.00+random.uniform(-0.08,0.08)}
        est=estimate_with_rule(rule,p,d)
        t=Trip(customer_user_id=customer_id,status=TripStatus.REQUESTED,pickup_lat=p["lat"],pickup_lng=p["lng"],dropoff_lat=d["lat"],dropoff_lng=d["lng"],
               currency=est["currency"],distance_km=est["distance_km"],duration_min=est["duration_min"],estimated_price=est["estimated_price"],pricing_snapshot=est["pricing"],
               created_at=datetime.utcnow(),updated_at=datetime.utcnow())
        db.add(t); db.commit(); created["trips"]+=1
    for _ in range(max(0,min(payload.assistances,100))):
        a=Assistance(customer_user_id=customer_id,status=AssistanceStatus.REQUESTED,lat=40.73+random.uniform(-0.05,0.05),lng=-74.00+random.uniform(-0.05,0.05),
                     note="seed",created_at=datetime.utcnow(),updated_at=datetime.utcnow())
        db.add(a); db.commit(); created["assistances"]+=1
    audit(db,u.id,"ADMIN_DEV_SEED","seed","*",created)
    return {"created":created}


@app.get("/v1/admin/email-outbox", dependencies=[Depends(limiter("admin"))])
def admin_email_outbox(claims=Depends(admin_auth), db: Session=Depends(get_db),
                       status: Optional[str]=Query(None),
                       limit:int=Query(100,ge=1,le=500), offset:int=Query(0,ge=0)):
    u=upsert_user(db,claims)
    q = select(EmailOutbox).order_by(EmailOutbox.created_at.desc())
    if status:
        q = q.where(EmailOutbox.status==status)
    q = q.limit(limit).offset(offset)
    items = db.execute(q).scalars().all()
    audit(db,u.id,"ADMIN_LIST_EMAIL_OUTBOX","email_outbox","*",{"status":status})
    return {"items":[{"id":str(e.id),"userId":str(e.user_id),"to":e.to_email,"subject":e.subject,"status":str(e.status),"attempts":int(e.attempts),"created_at":e.created_at.isoformat(),"last_error":e.last_error} for e in items],
            "paging":{"limit":limit,"offset":offset,"status":status}}

@app.post("/v1/admin/email-outbox/process", dependencies=[Depends(limiter("admin"))])
def admin_email_outbox_process(claims=Depends(admin_auth), db: Session=Depends(get_db), limit:int=Query(50,ge=1,le=200)):
    u=upsert_user(db,claims)
    sent = _process_email_outbox_once(db, limit=limit)
    audit(db,u.id,"ADMIN_PROCESS_EMAIL_OUTBOX","email_outbox","*",{"sent":sent})
    return {"sent": sent}


@app.get("/v1/admin/jobs", dependencies=[Depends(limiter("admin"))])
def admin_jobs(claims=Depends(admin_auth), db: Session=Depends(get_db),
               status: Optional[str]=Query(None), job_type: Optional[str]=Query(None),
               limit:int=Query(100,ge=1,le=500), offset:int=Query(0,ge=0)):
    u=upsert_user(db,claims)
    q = select(Job).order_by(Job.created_at.desc())
    if status:
        q=q.where(Job.status==status)
    if job_type:
        q=q.where(Job.job_type==job_type)
    q=q.limit(limit).offset(offset)
    items=db.execute(q).scalars().all()
    audit(db,u.id,"ADMIN_LIST_JOBS","job","*",{"status":status,"job_type":job_type})
    return {"items":[{"id":str(j.id),"type":j.job_type,"status":str(j.status),"attempts":j.attempts,"run_after":j.run_after.isoformat(),
                      "created_at":j.created_at.isoformat(),"updated_at":j.updated_at.isoformat(),"last_error":j.last_error,"payload":j.payload} for j in items],
            "paging":{"limit":limit,"offset":offset}}

@app.post("/v1/admin/jobs/run", dependencies=[Depends(limiter("admin"))])
def admin_jobs_run(claims=Depends(admin_auth), db: Session=Depends(get_db),
                   job_type: str=Query("EMAIL_OUTBOX"), payload: Optional[str]=Query(None)):
    """Create a job (or a batch of jobs) for the worker."""
    u=upsert_user(db,claims)
    pl = {}
    if payload:
        try:
            import json as _json  # use standard json library
            # parse the JSON payload into a dictionary
            pl = _json.loads(payload)
        except Exception:
            # return a 400 error when payload is not a valid JSON string
            raise HTTPException(400, "payload must be JSON string")
    j = Job(job_type=job_type, payload=pl, status=JobStatus.PENDING, attempts=0, run_after=datetime.utcnow(), last_error=None, created_at=datetime.utcnow(), updated_at=datetime.utcnow())
    db.add(j); db.commit(); db.refresh(j)
    audit(db,u.id,"ADMIN_CREATE_JOB","job",str(j.id),{"type":job_type})
    return {"id":str(j.id),"type":j.job_type,"status":str(j.status)}

@app.post("/v1/admin/email-outbox/process", dependencies=[Depends(limiter("admin"))])
def admin_email_outbox_process(claims=Depends(admin_auth), db: Session=Depends(get_db), limit:int=Query(50,ge=1,le=200)):
    """Enqueue an EMAIL_OUTBOX job to be processed by the worker."""
    u=upsert_user(db,claims)
    j = Job(job_type="EMAIL_OUTBOX", payload={"limit": int(limit)}, status=JobStatus.PENDING, attempts=0, run_after=datetime.utcnow(), last_error=None, created_at=datetime.utcnow(), updated_at=datetime.utcnow())
    db.add(j); db.commit(); db.refresh(j)
    audit(db,u.id,"ADMIN_ENQUEUE_EMAIL_OUTBOX","job",str(j.id),{"limit":limit})
    return {"queued_job_id": str(j.id)}

@app.post("/v1/admin/payouts/run-async", dependencies=[Depends(limiter("admin"))])
def admin_payout_run_async(payload: dict, claims=Depends(admin_auth), db: Session=Depends(get_db)):
    """Enqueue a PAYOUT_RUN job."""
    u=upsert_user(db,claims)
    days=int(payload.get("days",7))
    j = Job(job_type="PAYOUT_RUN", payload={"days": days}, status=JobStatus.PENDING, attempts=0, run_after=datetime.utcnow(), last_error=None, created_at=datetime.utcnow(), updated_at=datetime.utcnow())
    db.add(j); db.commit(); db.refresh(j)
    audit(db,u.id,"ADMIN_ENQUEUE_PAYOUT_RUN","job",str(j.id),{"days":days})
    return {"queued_job_id": str(j.id), "days": days}


@app.post("/v1/admin/dev/seed-scenario", dependencies=[Depends(limiter("admin"))])
def admin_seed_scenario(claims=Depends(admin_auth), db: Session=Depends(get_db)):
    """Create a complete demo scenario for frontend development."""
    u=upsert_user(db,claims)

    # Ensure there is at least one driver profile for a driver user (reuse admin as driver for local if none)
    # Create a REQUESTED trip(s) owned by admin-as-customer
    from random import uniform
    customer_id = u.id

    # Seed 3 trips
    created_trip_ids=[]
    for _ in range(3):
        p={"lat":40.73+uniform(-0.03,0.03),"lng":-74.00+uniform(-0.03,0.03)}
        d={"lat":40.73+uniform(-0.05,0.05),"lng":-74.00+uniform(-0.05,0.05)}
        # use existing estimate function
        rule=get_active_pricing_rule(db)
        est=estimate_with_rule(rule,p,d)
        t=Trip(customer_user_id=customer_id,status=TripStatus.REQUESTED,
               pickup_lat=p["lat"],pickup_lng=p["lng"],dropoff_lat=d["lat"],dropoff_lng=d["lng"],
               currency=est["currency"],distance_km=est["distance_km"],duration_min=est["duration_min"],
               estimated_price=est["estimated_price"],final_price=None,pricing_snapshot=est["pricing"],
               created_at=datetime.utcnow(),updated_at=datetime.utcnow())
        db.add(t); db.commit(); db.refresh(t)
        db.add(TripEvent(trip_id=t.id, actor_user_id=customer_id, from_status=str(t.status), to_status=str(t.status), created_at=datetime.utcnow()))
        db.commit()
        created_trip_ids.append(str(t.id))

    audit(db,u.id,"ADMIN_SEED_SCENARIO","seed","*",{"trips":created_trip_ids})
    return {"created":{"trips":created_trip_ids}, "note":"Use a real customer/driver via Keycloak for full E2E; this is for frontend fixtures."}

@app.get("/v1/admin/audit-logs", dependencies=[Depends(limiter("admin"))])

@app.get("/v1/admin/payments", dependencies=[Depends(limiter("admin"))])
def admin_payments(claims=Depends(admin_auth), db: Session=Depends(get_db),
                   status: Optional[str]=Query(None), limit:int=Query(50,ge=1,le=200), offset:int=Query(0,ge=0)):
    u=upsert_user(db,claims)
    q=select(Payment).order_by(Payment.created_at.desc())
    if status: q=q.where(Payment.status==status)
    q=q.limit(limit).offset(offset)
    items=db.execute(q).scalars().all()
    audit(db,u.id,"ADMIN_LIST_PAYMENTS","payment","*",{"status":status})
    return {"items":[{"id":str(p.id),"tripId":str(p.trip_id),"customerUserId":str(p.customer_user_id),"amount":p.amount,"currency":p.currency,"status":str(p.status),"provider":p.provider,"created_at":p.created_at.isoformat()} for p in items],
            "paging":{"limit":limit,"offset":offset,"status":status}}

@app.get("/v1/admin/payouts", dependencies=[Depends(limiter("admin"))])
def admin_payouts(claims=Depends(admin_auth), db: Session=Depends(get_db),
                  status: Optional[str]=Query(None), limit:int=Query(50,ge=1,le=200), offset:int=Query(0,ge=0)):
    u=upsert_user(db,claims)
    q=select(Payout).order_by(Payout.created_at.desc())
    if status: q=q.where(Payout.status==status)
    q=q.limit(limit).offset(offset)
    items=db.execute(q).scalars().all()
    audit(db,u.id,"ADMIN_LIST_PAYOUTS","payout","*",{"status":status})
    return {"items":[{"id":str(p.id),"driverUserId":str(p.driver_user_id),"amount":p.amount,"currency":p.currency,"status":str(p.status),"created_at":p.created_at.isoformat(),"note":p.note} for p in items],
            "paging":{"limit":limit,"offset":offset,"status":status}}

@app.post("/v1/admin/payouts/run", dependencies=[Depends(limiter("admin"))])
def admin_payout_run(payload: dict, claims=Depends(admin_auth), db: Session=Depends(get_db)):
    """Simulate a payout run: create one payout per driver for DRIVER_EARNING ledger entries in last N days."""
    u=upsert_user(db,claims)
    days=int(payload.get("days",7))
    since=datetime.utcnow()-timedelta(days=days)

    # Sum driver earnings from ledger
    rows=db.execute(
        select(Trip.driver_user_id, func.coalesce(func.sum(LedgerEntry.amount),0.0), func.min(LedgerEntry.currency))
        .join(LedgerEntry, LedgerEntry.trip_id==Trip.id)
        .where(LedgerEntry.entry_type=="DRIVER_EARNING", LedgerEntry.created_at>=since, Trip.driver_user_id.isnot(None))
        .group_by(Trip.driver_user_id)
    ).all()

    created=0
    for driver_id, total_amt, currency in rows:
        if not driver_id or float(total_amt or 0.0) <= 0.0:
            continue
        p=Payout(driver_user_id=driver_id, amount=round(float(total_amt),2), currency=currency or CURRENCY, status=PayoutStatus.PAID, created_at=datetime.utcnow(), note=f"payout_run_{days}d")
        db.add(p); db.commit(); db.refresh(p)
        # ledger entry
        db.add(LedgerEntry(trip_id=None, payment_id=None, payout_id=p.id, entry_type="PAYOUT", amount=p.amount, currency=p.currency, created_at=datetime.utcnow(), meta={"driverUserId":str(driver_id), "days":days}))
        db.commit()
        created += 1

    audit(db,u.id,"ADMIN_PAYOUT_RUN","payout","*",{"days":days,"created":created})
    return {"days":days,"created":created}

def admin_audit(claims=Depends(admin_auth), db: Session=Depends(get_db), limit:int=Query(200,ge=1,le=500), offset:int=Query(0,ge=0)):
    upsert_user(db,claims)
    logs=db.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)).scalars().all()
    return {"items":[{"id":str(a.id),"action":a.action,"entity_type":a.entity_type,"entity_id":a.entity_id,"created_at":a.created_at.isoformat(),"meta":a.meta} for a in logs],
            "paging":{"limit":limit,"offset":offset}}


# --- Notifications (Sprint 8)
@app.get("/v1/customer/notifications", dependencies=[Depends(limiter("notifs"))])
def customer_notifications(claims=Depends(customer_auth), db: Session=Depends(get_db),
                           unread_only: bool=Query(False), limit:int=Query(50,ge=1,le=200), offset:int=Query(0,ge=0)):
    u=upsert_user(db,claims)
    q=select(Notification).where(Notification.user_id==u.id).order_by(Notification.created_at.desc())
    if unread_only:
        q=q.where(Notification.is_read==False)
    q=q.limit(limit).offset(offset)
    items=db.execute(q).scalars().all()
    return {"items":[{"id":str(n.id),"type":n.notif_type,"title":n.title,"body":n.body,"meta":n.meta,"is_read":n.is_read,"created_at":n.created_at.isoformat()} for n in items],
            "paging":{"limit":limit,"offset":offset,"unread_only":unread_only}}

@app.post("/v1/customer/notifications/{notif_id}/read", dependencies=[Depends(limiter("notifs"))])
def customer_notification_read(notif_id: str, claims=Depends(customer_auth), db: Session=Depends(get_db)):
    u=upsert_user(db,claims)
    n=db.get(Notification, uuid.UUID(notif_id))
    if not n or n.user_id!=u.id: raise HTTPException(404,"Notification not found")
    n.is_read=True; n.read_at=datetime.utcnow()
    db.add(n); db.commit()
    # email simulation for key events
    if notif_type in ("TRIP_ASSIGNED","TRIP_ARRIVED","TRIP_STARTED","TRIP_COMPLETED","TRIP_CANCELLED"):
        user = db.get(User, user_id)
        if user:
            enqueue_email(db, user, f"[{notif_type}] {title}", body)
    return {"id": str(n.id), "is_read": n.is_read}

@app.get("/v1/driver/notifications", dependencies=[Depends(limiter("notifs"))])
def driver_notifications(claims=Depends(driver_auth), db: Session=Depends(get_db),
                         unread_only: bool=Query(False), limit:int=Query(50,ge=1,le=200), offset:int=Query(0,ge=0)):
    u=upsert_user(db,claims)
    q=select(Notification).where(Notification.user_id==u.id).order_by(Notification.created_at.desc())
    if unread_only:
        q=q.where(Notification.is_read==False)
    q=q.limit(limit).offset(offset)
    items=db.execute(q).scalars().all()
    return {"items":[{"id":str(n.id),"type":n.notif_type,"title":n.title,"body":n.body,"meta":n.meta,"is_read":n.is_read,"created_at":n.created_at.isoformat()} for n in items],
            "paging":{"limit":limit,"offset":offset,"unread_only":unread_only}}

@app.post("/v1/driver/notifications/{notif_id}/read", dependencies=[Depends(limiter("notifs"))])
def driver_notification_read(notif_id: str, claims=Depends(driver_auth), db: Session=Depends(get_db)):
    u=upsert_user(db,claims)
    n=db.get(Notification, uuid.UUID(notif_id))
    if not n or n.user_id!=u.id: raise HTTPException(404,"Notification not found")
    n.is_read=True; n.read_at=datetime.utcnow()
    db.add(n); db.commit()
    # email simulation for key events
    if notif_type in ("TRIP_ASSIGNED","TRIP_ARRIVED","TRIP_STARTED","TRIP_COMPLETED","TRIP_CANCELLED"):
        user = db.get(User, user_id)
        if user:
            enqueue_email(db, user, f"[{notif_type}] {title}", body)
    return {"id": str(n.id), "is_read": n.is_read}

@app.get("/v1/admin/notifications", dependencies=[Depends(limiter("admin"))])
def admin_notifications(claims=Depends(admin_auth), db: Session=Depends(get_db),
                        limit:int=Query(100,ge=1,le=500), offset:int=Query(0,ge=0)):
    u=upsert_user(db,claims)
    q=select(Notification).order_by(Notification.created_at.desc()).limit(limit).offset(offset)
    items=db.execute(q).scalars().all()
    audit(db,u.id,"ADMIN_LIST_NOTIFICATIONS","notification","*",{})
    return {"items":[{"id":str(n.id),"userId":str(n.user_id),"type":n.notif_type,"title":n.title,"is_read":n.is_read,"created_at":n.created_at.isoformat()} for n in items],
            "paging":{"limit":limit,"offset":offset}}




def system_readiness_snapshot(db: Session) -> dict:
    """Return a lightweight readiness snapshot used by staging/prod checks.

    This endpoint is intended for deployment and smoke-test automation in Sprint 58.
    It validates that the API can talk to the database and that core runtime
    variables expected by Cloud Run deployments are present.
    """
    db_ok = True
    db_err = None
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_ok = False
        db_err = str(e)

    required_env_vars = [
        "KEYCLOAK_URL",
        "KEYCLOAK_REALM",
        "CUSTOMER_AUD",
        "DRIVER_AUD",
        "ADMIN_AUD",
    ]
    missing_env = [name for name in required_env_vars if not os.getenv(name)]

    return {
        "ok": db_ok and not missing_env,
        "db": {"ok": db_ok, "error": db_err},
        "env": {"missing": missing_env},
        "project": os.getenv("GCP_PROJECT_ID", "local"),
        "region": os.getenv("GCP_REGION", "local"),
        "time_utc": datetime.utcnow().isoformat() + "Z",
    }


@app.get("/v1/system/readiness")
def system_readiness(db: Session = Depends(get_db)):
    """Public readiness probe used for Cloud Run staging health automation."""
    return system_readiness_snapshot(db)





@app.get("/v1/user/accessibility", dependencies=[Depends(limiter("prefs"))])
def get_accessibility_preferences(claims=Depends(any_user_auth), db: Session = Depends(get_db)):
    """Sprint 60: role-agnostic accessibility preferences for responsive UX."""
    u = upsert_user(db, claims)
    prefs = get_user_prefs(db, u.id)
    accessibility = prefs.get("accessibility") or {
        "highContrast": False,
        "reducedMotion": False,
        "fontScale": 1.0,
    }
    return {"userId": str(u.id), "accessibility": accessibility}


@app.put("/v1/user/accessibility", dependencies=[Depends(limiter("prefs"))])
def set_accessibility_preferences(
    payload: dict = Body(default={}),
    claims=Depends(any_user_auth),
    db: Session = Depends(get_db),
):
    """Sprint 60: update accessibility preferences used by web applications."""
    u = upsert_user(db, claims)
    current = get_user_prefs(db, u.id)
    current_accessibility = current.get("accessibility") or {}

    high_contrast = bool(payload.get("highContrast", current_accessibility.get("highContrast", False)))
    reduced_motion = bool(payload.get("reducedMotion", current_accessibility.get("reducedMotion", False)))
    font_scale = float(payload.get("fontScale", current_accessibility.get("fontScale", 1.0)))
    font_scale = max(0.8, min(1.6, font_scale))

    current["accessibility"] = {
        "highContrast": high_contrast,
        "reducedMotion": reduced_motion,
        "fontScale": font_scale,
    }
    set_user_prefs(db, u.id, current)
    return {"ok": True, "accessibility": current["accessibility"]}
@app.get("/v1/system/onboarding/checklist")
def onboarding_checklist(role: str = Query("customer", pattern="^(customer|driver|admin)$")):
    """Sprint 59: simple onboarding checklist for role-based guided flows."""
    common = [
        "Complete profile information",
        "Read safety and privacy notice",
        "Enable in-app notifications",
    ]
    role_steps = {
        "customer": [
            "Save pickup favorites",
            "Run first ride estimate",
            "Validate payment method",
        ],
        "driver": [
            "Upload driver documents",
            "Set availability to online",
            "Accept first mission",
        ],
        "admin": [
            "Review pending driver applications",
            "Check system status dashboard",
            "Run first analytics export",
        ],
    }
    return {
        "role": role,
        "sprint": 59,
        "items": common + role_steps[role],
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }
@app.get("/v1/admin/system/status", dependencies=[Depends(limiter("admin_sensitive"))])
def admin_system_status(claims=Depends(admin_auth), db: Session = Depends(get_db)):
    admin_u = upsert_user(db, claims)

    # DB check
    db_ok = True
    db_err = None
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_ok = False
        db_err = str(e)

    # Keycloak discovery check (best effort)
    kc_ok = True
    kc_err = None
    try:
        check_keycloak()
    except Exception as e:
        kc_ok = False
        kc_err = str(e)

    # Quick counts
    def _count(model):
        try:
            return int(db.execute(select(func.count()).select_from(model)).scalar() or 0)
        except Exception:
            return 0

    counts = {
        "users": _count(User),
        "trips": _count(Trip),
        "assistances": _count(Assistance),
        "jobs": _count(Job),
        "email_outbox": _count(EmailOutbox),
        "driver_applications": _count(DriverApplication),
    }

    audit(db, admin_u.id, "ADMIN_SYSTEM_STATUS", "system", "status", {"db_ok": db_ok, "kc_ok": kc_ok})
    return {
        "ok": db_ok and kc_ok,
        "db": {"ok": db_ok, "error": db_err},
        "keycloak": {"ok": kc_ok, "error": kc_err},
        "counts": counts,
        "time_utc": datetime.utcnow().isoformat() + "Z",
    }
