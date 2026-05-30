from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ScanMetadata(Base):
    __tablename__ = "scan_metadata"
    __table_args__ = (
        UniqueConstraint("scan_type", name="uq_scan_metadata_scan_type"),
    )

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    scan_type: Mapped[str] = mapped_column(String, nullable=False, index=True)
    scan_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )
    covered_account_ids: Mapped[str] = mapped_column(String, nullable=False, default="[]")
    eligible_account_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
