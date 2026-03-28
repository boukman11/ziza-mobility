#!/usr/bin/env bash
set -euo pipefail
echo "[api] Waiting for Postgres..."
python - <<'PY'
import os, time, psycopg
url=os.getenv("DATABASE_URL"); url2=url.replace("postgresql+psycopg://","postgresql://")
deadline=time.time()+60; last=None
while time.time()<deadline:
    try:
        c=psycopg.connect(url2, connect_timeout=3); c.close()
        print("[api] Postgres ready."); break
    except Exception as e:
        last=e; time.sleep(2)
else:
    raise SystemExit(f"[api] Postgres not ready: {last}")
PY

echo "[api] Alembic version compat check..."
python - <<'PY'
import os, psycopg
url=os.getenv("DATABASE_URL")
url2=url.replace("postgresql+psycopg://","postgresql://")
try:
    conn=psycopg.connect(url2, connect_timeout=5)
    cur=conn.cursor()
    # Check if alembic_version table exists
    cur.execute("SELECT to_regclass('public.alembic_version')")
    reg=cur.fetchone()[0]
    if reg:
        cur.execute("SELECT version_num FROM alembic_version LIMIT 1")
        row=cur.fetchone()
        if row and row[0] == "0001":
            # Historical DBs may have '0001' stored while code uses '0001_init'
            cur.execute("UPDATE alembic_version SET version_num='0001_init' WHERE version_num='0001'")
            conn.commit()
            print("[api] Updated alembic_version: 0001 -> 0001_init")
        else:
            print("[api] alembic_version OK")
    else:
        print("[api] alembic_version table not present yet (fresh DB)")
    cur.close()
    conn.close()
except Exception as e:
    # Non-fatal; alembic will still attempt upgrade and show the real error if any.
    print(f"[api] Alembic compat check skipped: {e}")
PY

alembic upgrade head
exec uvicorn main:app --host 0.0.0.0 --port 8000
