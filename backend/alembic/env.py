import asyncio
import os

from dotenv import load_dotenv
from sqlalchemy import pool

load_dotenv()
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context
from app.models import Base

target_metadata = Base.metadata


def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations():
    configuration = context.config.get_section(context.config.config_ini_section)
    configuration["sqlalchemy.url"] = os.environ["DATABASE_URL"]
    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # REQUIRED: prevents event loop errors on script exit
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_offline():
    url = os.environ.get("DATABASE_URL", context.config.get_main_option("sqlalchemy.url"))
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
