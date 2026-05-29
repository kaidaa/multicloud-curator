"""Provider file metadata after normalization.

Folders are excluded; ``is_folder`` remains as a provider-data safeguard.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class File(Base):
    __tablename__ = "files"
    __table_args__ = (
        UniqueConstraint("account_id", "file_id", name="uq_files_account_file"),
    )

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    account_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    file_id: Mapped[str] = mapped_column(String, nullable=False)
    file_name: Mapped[str] = mapped_column(String, nullable=False)
    path: Mapped[str | None] = mapped_column(String, nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String, nullable=True)
    modified_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    hash: Mapped[str | None] = mapped_column(String, nullable=True)
    owner_account: Mapped[str] = mapped_column(String, nullable=False)
    provider: Mapped[str] = mapped_column(String, nullable=False, index=True)
    sharing_status: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    location_type: Mapped[str | None] = mapped_column(String, nullable=True)
    open_url: Mapped[str | None] = mapped_column(String, nullable=True)
    open_url_type: Mapped[str | None] = mapped_column(String, nullable=True)
    has_public_shared_link: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    shared_link_url: Mapped[str | None] = mapped_column(String, nullable=True)
    shared_link_visibility: Mapped[str | None] = mapped_column(String, nullable=True)
    trashed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_folder: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_owned: Mapped[bool] = mapped_column(Boolean, nullable=False, index=True)
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
