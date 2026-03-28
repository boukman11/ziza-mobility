FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir fastapi==0.115.6 uvicorn[standard]==0.30.6 python-jose==3.3.0 requests==2.32.3 sqlalchemy==2.0.32 alembic==1.13.2 psycopg[binary]==3.2.1 pytest==8.3.2 httpx==0.27.2
COPY . /app
RUN python -m compileall -q /app
EXPOSE 8000
CMD ["bash","start.sh"]
