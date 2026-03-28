from __future__ import annotations
import enum, uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Enum, Boolean, ForeignKey, Float, JSON, Text, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase): ...

class DriverStatus(str, enum.Enum):
    PENDING="PENDING"; ACTIVE="ACTIVE"; SUSPENDED="SUSPENDED"

class TripStatus(str, enum.Enum):
    REQUESTED="REQUESTED"
    ASSIGNED="ASSIGNED"
    ARRIVED="ARRIVED"
    IN_PROGRESS="IN_PROGRESS"
    COMPLETED="COMPLETED"
    CANCELLED="CANCELLED"

class AssistanceStatus(str, enum.Enum):
    REQUESTED="REQUESTED"
    ASSIGNED="ASSIGNED"
    COMPLETED="COMPLETED"
    CANCELLED="CANCELLED"

class User(Base):
    __tablename__="users"
    id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    oidc_sub: Mapped[str]=mapped_column(String(128), unique=True, nullable=False, index=True)
    email: Mapped[str|None]=mapped_column(String(255), unique=True, nullable=True, index=True)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

class DriverProfile(Base):
    __tablename__="driver_profiles"
    user_id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    status: Mapped[DriverStatus]=mapped_column(Enum(DriverStatus), default=DriverStatus.PENDING, nullable=False)
    is_online: Mapped[bool]=mapped_column(Boolean, default=False, nullable=False)
    last_lat: Mapped[float|None]=mapped_column(Float, nullable=True)
    last_lng: Mapped[float|None]=mapped_column(Float, nullable=True)
    updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

class PricingRule(Base):
    __tablename__="pricing_rules"
    id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str]=mapped_column(String(80), nullable=False)
    currency: Mapped[str]=mapped_column(String(8), nullable=False, default="USD")
    base_fare: Mapped[float]=mapped_column(Float, nullable=False)
    per_km: Mapped[float]=mapped_column(Float, nullable=False)
    per_min: Mapped[float]=mapped_column(Float, nullable=False)
    avg_speed_kmh: Mapped[float]=mapped_column(Float, nullable=False)
    is_active: Mapped[bool]=mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

class Trip(Base):
    __tablename__="trips"
    id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_user_id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    driver_user_id: Mapped[uuid.UUID|None]=mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    status: Mapped[TripStatus]=mapped_column(Enum(TripStatus), default=TripStatus.REQUESTED, nullable=False, index=True)
    pickup_lat: Mapped[float]=mapped_column(Float, nullable=False)
    pickup_lng: Mapped[float]=mapped_column(Float, nullable=False)
    dropoff_lat: Mapped[float]=mapped_column(Float, nullable=False)
    dropoff_lng: Mapped[float]=mapped_column(Float, nullable=False)
    currency: Mapped[str]=mapped_column(String(8), default="USD", nullable=False)
    distance_km: Mapped[float]=mapped_column(Float, default=0.0, nullable=False)
    duration_min: Mapped[float]=mapped_column(Float, default=0.0, nullable=False)
    estimated_price: Mapped[float]=mapped_column(Float, default=0.0, nullable=False)
    final_price: Mapped[float|None]=mapped_column(Float, nullable=True)
    pricing_snapshot: Mapped[dict]=mapped_column(JSON, default=dict, nullable=False)
    assigned_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True), nullable=True)
    arrived_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

class TripEvent(Base):
    __tablename__="trip_events"
    id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), ForeignKey("trips.id"), nullable=False, index=True)
    actor_user_id: Mapped[uuid.UUID|None]=mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    from_status: Mapped[str]=mapped_column(String(32), nullable=False)
    to_status: Mapped[str]=mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

class DriverLocationHistory(Base):
    __tablename__="driver_location_history"
    id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    driver_user_id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    trip_id: Mapped[uuid.UUID|None]=mapped_column(UUID(as_uuid=True), ForeignKey("trips.id"), nullable=True, index=True)
    lat: Mapped[float]=mapped_column(Float, nullable=False)
    lng: Mapped[float]=mapped_column(Float, nullable=False)
    recorded_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

class Assistance(Base):
    __tablename__="assistances"
    id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_user_id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    driver_user_id: Mapped[uuid.UUID|None]=mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    status: Mapped[AssistanceStatus]=mapped_column(Enum(AssistanceStatus), default=AssistanceStatus.REQUESTED, nullable=False, index=True)
    lat: Mapped[float]=mapped_column(Float, nullable=False)
    lng: Mapped[float]=mapped_column(Float, nullable=False)
    note: Mapped[str|None]=mapped_column(Text, nullable=True)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

class AuditLog(Base):
    __tablename__="audit_logs"
    id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_user_id: Mapped[uuid.UUID|None]=mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    action: Mapped[str]=mapped_column(String(100), nullable=False, index=True)
    entity_type: Mapped[str]=mapped_column(String(50), nullable=False, index=True)
    entity_id: Mapped[str]=mapped_column(String(100), nullable=False, index=True)
    meta: Mapped[dict]=mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

class PaymentStatus(str, enum.Enum):
    PENDING="PENDING"
    CAPTURED="CAPTURED"
    FAILED="FAILED"
    REFUNDED="REFUNDED"

class PayoutStatus(str, enum.Enum):
    PENDING="PENDING"
    PAID="PAID"
    FAILED="FAILED"

class Payment(Base):
    __tablename__="payments"
    id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), ForeignKey("trips.id"), nullable=False, unique=True, index=True)
    customer_user_id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    amount: Mapped[float]=mapped_column(Float, nullable=False)
    currency: Mapped[str]=mapped_column(String(8), nullable=False)
    status: Mapped[PaymentStatus]=mapped_column(Enum(PaymentStatus), default=PaymentStatus.PENDING, nullable=False, index=True)
    provider: Mapped[str]=mapped_column(String(40), default="SIMULATED", nullable=False)
    provider_ref: Mapped[str|None]=mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

class Payout(Base):
    __tablename__="payouts"
    id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    driver_user_id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    amount: Mapped[float]=mapped_column(Float, nullable=False)
    currency: Mapped[str]=mapped_column(String(8), nullable=False)
    status: Mapped[PayoutStatus]=mapped_column(Enum(PayoutStatus), default=PayoutStatus.PENDING, nullable=False, index=True)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    note: Mapped[str|None]=mapped_column(Text, nullable=True)

class LedgerEntry(Base):
    __tablename__="ledger_entries"
    id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID|None]=mapped_column(UUID(as_uuid=True), ForeignKey("trips.id"), nullable=True, index=True)
    payment_id: Mapped[uuid.UUID|None]=mapped_column(UUID(as_uuid=True), ForeignKey("payments.id"), nullable=True, index=True)
    payout_id: Mapped[uuid.UUID|None]=mapped_column(UUID(as_uuid=True), ForeignKey("payouts.id"), nullable=True, index=True)
    entry_type: Mapped[str]=mapped_column(String(40), nullable=False, index=True)  # e.g. CUSTOMER_CHARGE, PLATFORM_FEE, DRIVER_EARNING, PAYOUT
    amount: Mapped[float]=mapped_column(Float, nullable=False)
    currency: Mapped[str]=mapped_column(String(8), nullable=False)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    meta: Mapped[dict]=mapped_column(JSON, default=dict, nullable=False)

class Notification(Base):
    __tablename__="notifications"
    id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    notif_type: Mapped[str]=mapped_column(String(60), nullable=False, index=True)
    title: Mapped[str]=mapped_column(String(120), nullable=False)
    body: Mapped[str]=mapped_column(Text, nullable=False)
    meta: Mapped[dict]=mapped_column(JSON, default=dict, nullable=False)
    is_read: Mapped[bool]=mapped_column(Boolean, default=False, nullable=False, index=True)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    read_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True), nullable=True)

class UserPreference(Base):
    __tablename__="user_preferences"
    user_id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    prefs: Mapped[dict]=mapped_column(JSON, default=dict, nullable=False)
    updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

class EmailStatus(str, enum.Enum):
    PENDING="PENDING"
    SENT="SENT"
    FAILED="FAILED"

class EmailOutbox(Base):
    __tablename__="email_outbox"
    id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    to_email: Mapped[str|None]=mapped_column(String(255), nullable=True)
    subject: Mapped[str]=mapped_column(String(200), nullable=False)
    body: Mapped[str]=mapped_column(Text, nullable=False)
    status: Mapped[EmailStatus]=mapped_column(Enum(EmailStatus), default=EmailStatus.PENDING, nullable=False, index=True)
    attempts: Mapped[int]=mapped_column(Integer, default=0, nullable=False)
    next_attempt_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    last_error: Mapped[str|None]=mapped_column(Text, nullable=True)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

class JobStatus(str, enum.Enum):
    PENDING="PENDING"
    RUNNING="RUNNING"
    DONE="DONE"
    FAILED="FAILED"

class Job(Base):
    __tablename__="jobs"
    id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_type: Mapped[str]=mapped_column(String(60), nullable=False, index=True)  # EMAIL_OUTBOX, PAYOUT_RUN
    payload: Mapped[dict]=mapped_column(JSON, default=dict, nullable=False)
    status: Mapped[JobStatus]=mapped_column(Enum(JobStatus), default=JobStatus.PENDING, nullable=False, index=True)
    attempts: Mapped[int]=mapped_column(Integer, default=0, nullable=False)
    run_after: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False, index=True)
    last_error: Mapped[str|None]=mapped_column(Text, nullable=True)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

class IdempotencyKey(Base):
    __tablename__="idempotency_keys"
    key: Mapped[str]=mapped_column(String(80), primary_key=True)
    user_id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    scope: Mapped[str]=mapped_column(String(40), nullable=False)
    response_json: Mapped[dict]=mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class DriverApplicationStatus(str, enum.Enum):
    PENDING="PENDING"
    APPROVED="APPROVED"
    REJECTED="REJECTED"

class DriverApplication(Base):
    __tablename__="driver_applications"
    id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID]=mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    oidc_sub: Mapped[str]=mapped_column(String(120), nullable=False, index=True)
    email: Mapped[str]=mapped_column(String(255), nullable=False, index=True)
    status: Mapped[DriverApplicationStatus]=mapped_column(Enum(DriverApplicationStatus), nullable=False, default=DriverApplicationStatus.PENDING)
    note: Mapped[str|None]=mapped_column(Text, nullable=True)
    created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
