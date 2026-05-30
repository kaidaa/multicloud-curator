from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LargeStaleResult(Base):
    __tablename__ = "large_stale_results"
    __table_args__ = (
        UniqueConstraint("file_id", name="uq_large_stale_results_file"),
    )

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    file_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("files.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scan_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )
    trigger_reason: Mapped[str] = mapped_column(String, nullable=False)
    is_large: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_stale: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    modified_age_months: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
