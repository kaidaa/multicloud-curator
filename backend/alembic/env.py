from __future__ import annotations

from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context
from app.config import get_settings
from app.database import Base

# Import models for Alembic autogenerate side effects.
from app.features.accounts.models import Account, OAuthState  # noqa: F401
from app.features.async_operations.models import Operation  # noqa: F401
from app.features.duplicates.models import DuplicateGroup, DuplicateGroupMember  # noqa: F401
from app.features.files_visibility.models import File  # noqa: F401
from app.features.large_stale.models import LargeStaleResult  # noqa: F401
from app.features.keywords.models import SensitiveKeyword  # noqa: F401
from app.features.scan_metadata.models import ScanMetadata  # noqa: F401
from app.features.security.models import ScanResult  # noqa: F401
from app.shared.audit_log_model import ActionLog  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Use the same database URL as the running app.
config.set_main_option("sqlalchemy.url", get_settings().database_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,  # SQLite-compatible ALTER TABLE flow.
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,  # SQLite-compatible ALTER TABLE flow.
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
