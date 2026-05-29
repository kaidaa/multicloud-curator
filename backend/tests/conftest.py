from __future__ import annotations

import os
from collections.abc import Generator

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault(
    "TOKEN_ENCRYPTION_KEY",
    "MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA=",
)
os.environ.setdefault("DATABASE_URL", "sqlite://")

from app.database import Base
from app.features.accounts.models import Account, OAuthState  # noqa: F401
from app.features.async_operations.models import Operation  # noqa: F401
from app.features.duplicates.models import DuplicateGroup, DuplicateGroupMember  # noqa: F401
from app.features.files_visibility.models import File  # noqa: F401
from app.features.large_stale.models import LargeStaleResult  # noqa: F401
from app.features.keywords.models import SensitiveKeyword  # noqa: F401
from app.features.scan_metadata.models import ScanMetadata  # noqa: F401
from app.features.security.models import ScanResult  # noqa: F401
from app.shared.audit_log_model import ActionLog  # noqa: F401


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )

    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
        class_=Session,
    )
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)
