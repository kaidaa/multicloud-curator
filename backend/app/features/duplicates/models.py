"""Duplicate group storage.

``match_basis`` is internal metadata and is not shown directly in the UI.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DuplicateGroup(Base):
    __tablename__ = "duplicate_groups"
    __table_args__ = (
        CheckConstraint("members_count >= 2", name="ck_duplicate_groups_min_members"),
    )

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    representative_name: Mapped[str] = mapped_column(String, nullable=False)
    match_basis: Mapped[str] = mapped_column(String, nullable=False)
    total_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    members_count: Mapped[int] = mapped_column(Integer, nullable=False)
    scanned_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )


class DuplicateGroupMember(Base):
    __tablename__ = "duplicate_group_members"
    __table_args__ = (
        UniqueConstraint("group_id", "file_id", name="uq_duplicate_group_members_group_file"),
    )

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    group_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("duplicate_groups.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    file_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("files.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
