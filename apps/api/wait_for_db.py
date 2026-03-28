import os, time
import psycopg

def main():
    url = os.getenv("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL not set")
    url2 = url.replace("postgresql+psycopg://", "postgresql://")
    deadline = time.time() + 90
    last = None
    while time.time() < deadline:
        try:
            conn = psycopg.connect(url2, connect_timeout=3)
            conn.close()
            print("[wait_for_db] Postgres ready")
            return
        except Exception as e:
            last = e
            time.sleep(2)
    raise SystemExit(f"[wait_for_db] Postgres not ready after 90s: {last}")

if __name__ == "__main__":
    main()
