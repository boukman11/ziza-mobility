import os, sys
from alembic import context
from sqlalchemy import engine_from_config, pool
sys.path.insert(0, os.path.abspath(os.getcwd()))
from models import Base  # noqa
config=context.config
db_url=os.getenv("DATABASE_URL")
if db_url: config.set_main_option("sqlalchemy.url", db_url)
target_metadata=Base.metadata
connectable=engine_from_config(config.get_section(config.config_ini_section), prefix="sqlalchemy.", poolclass=pool.NullPool)
with connectable.connect() as connection:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()
