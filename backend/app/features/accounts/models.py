"""Account token storage and OAuth state tracking.

Encrypted token fields store Fernet ciphertext. OAuth states store hashes, not
raw state values.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Account(Base):
    __tablename__ = "accounts"
    __table_args__ = (
        UniqueConstraint("provider", "provider_account_id", name="uq_accounts_provider_account"),
    )

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    provider: Mapped[str] = mapped_column(String, nullable=False, index=True)
    provider_account_id: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False)

    encrypted_access_token: Mapped[str] = mapped_column(String, nullable=False)
    encrypted_refresh_token: Mapped[str] = mapped_column(String, nullable=False)
    access_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    scopes: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(
        String,
        nullable=False,
        default="never_synced",
        index=True,
    )

    quota_used_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    quota_total_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_good_sync_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    data_state: Mapped[str] = mapped_column(
        String,
        nullable=False,
        default="BelumTersedia",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class OAuthState(Base):
    __tablename__ = "oauth_states"
    __table_args__ = (
        UniqueConstraint("state_hash", name="uq_oauth_states_state_hash"),
    )

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    state_hash: Mapped[str] = mapped_column(String, nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String, nullable=False, index=True)
    mode: Mapped[str] = mapped_column(String, nullable=False)
    account_id: Mapped[str | None] = mapped_column(String, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
