import os, time
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update, text
from sqlalchemy.orm import Session
from sqlalchemy.exc import ProgrammingError, OperationalError

from db import SessionLocal
from models import Job, JobStatus, EmailOutbox, EmailStatus, Payout, PayoutStatus, LedgerEntry, Trip
from sqlalchemy import func

def utcnow():
    return datetime.now(timezone.utc)

POLL_SEC = float(os.getenv("WORKER_POLL_SEC","2.0"))
MAX_JOBS = int(os.getenv("WORKER_MAX_JOBS","50"))
MAX_ATTEMPTS = int(os.getenv("WORKER_MAX_ATTEMPTS","5"))


def jobs_table_exists(db: Session) -> bool:
    try:
        r = db.execute(text("SELECT to_regclass('public.jobs')")).scalar()
        return r is not None
    except Exception:
        return False


def process_email_outbox(db: Session, limit: int = 50) -> int:
    now = utcnow()
    q = select(EmailOutbox).where(EmailOutbox.status==EmailStatus.PENDING, EmailOutbox.next_attempt_at <= now).order_by(EmailOutbox.created_at.asc()).limit(limit)
    items = db.execute(q).scalars().all()
    sent = 0
    for e in items:
        e.status = EmailStatus.SENT
        e.attempts += 1
        e.last_error = None
        db.add(e)
        sent += 1
    db.commit()
    return sent

def run_payouts(db: Session, days: int = 7) -> int:
    since = utcnow() - timedelta(days=days)
    rows=db.execute(
        select(Trip.driver_user_id, func.coalesce(func.sum(LedgerEntry.amount),0.0), func.min(LedgerEntry.currency))
        .join(LedgerEntry, LedgerEntry.trip_id==Trip.id)
        .where(LedgerEntry.entry_type=="DRIVER_EARNING", LedgerEntry.created_at>=since, Trip.driver_user_id.isnot(None))
        .group_by(Trip.driver_user_id)
    ).all()
    created=0
    for driver_id, total_amt, currency in rows:
        if not driver_id or float(total_amt or 0.0)<=0.0:
            continue
        p=Payout(driver_user_id=driver_id, amount=round(float(total_amt),2), currency=currency or "USD", status=PayoutStatus.PAID, created_at=utcnow(), note=f"payout_run_{days}d")
        db.add(p); db.commit(); db.refresh(p)
        db.add(LedgerEntry(trip_id=None,payment_id=None,payout_id=p.id,entry_type="PAYOUT",amount=p.amount,currency=p.currency,created_at=utcnow(),meta={"driverUserId":str(driver_id),"days":days}))
        db.commit()
        created+=1
    return created

def claim_jobs(db: Session) -> list[Job]:
    now = utcnow()
    # atomic claim using SKIP LOCKED (safe if multiple workers later)
    sql = text("""
        WITH cte AS (
            SELECT id
            FROM jobs
            WHERE status = 'PENDING' AND run_after <= :now
            ORDER BY run_after ASC
            LIMIT :limit
            FOR UPDATE SKIP LOCKED
        )
        UPDATE jobs
        SET status = 'RUNNING', updated_at = :now
        WHERE id IN (SELECT id FROM cte)
        RETURNING id
    """)
    ids = [row[0] for row in db.execute(sql, {"now": now, "limit": MAX_JOBS}).all()]
    if not ids:
        return []
    jobs = db.execute(select(Job).where(Job.id.in_(ids))).scalars().all()
    return jobs

def complete_job(db: Session, job: Job, ok: bool, err: str|None=None):
    job.attempts += 1
    job.updated_at = utcnow()
    if ok:
        job.status = JobStatus.DONE
        job.last_error = None
    else:
        job.last_error = err
        if job.attempts >= MAX_ATTEMPTS:
            job.status = JobStatus.FAILED
        else:
            job.status = JobStatus.PENDING
            job.run_after = utcnow() + timedelta(seconds=10)
    db.add(job); db.commit()

def main():
    print("[worker] started")
    while True:
        db = SessionLocal()
        try:
            if not jobs_table_exists(db):
                time.sleep(2)
                continue
            try:
                jobs = claim_jobs(db)
            except (ProgrammingError, OperationalError) as ex:
                # likely migrations not applied yet (e.g., jobs table missing)
                print(f"[worker] DB not ready for jobs: {ex}\n")
                time.sleep(2)
                continue
            for j in jobs:
                try:
                    if j.job_type == "EMAIL_OUTBOX":
                        process_email_outbox(db, limit=int(j.payload.get("limit",50)))
                        complete_job(db, j, True)
                    elif j.job_type == "PAYOUT_RUN":
                        days = int(j.payload.get("days",7))
                        run_payouts(db, days=days)
                        complete_job(db, j, True)
                    else:
                        complete_job(db, j, False, f"Unknown job_type {j.job_type}")
                except Exception as ex:
                    complete_job(db, j, False, str(ex))
        finally:
            db.close()
        time.sleep(POLL_SEC)

if __name__ == "__main__":
    main()
