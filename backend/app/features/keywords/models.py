"""SensitiveKeyword model.

Default keywords (KTP, NPWP, BPJS) di-seed via migration awal. Unique constraint
pada ``word`` case-sensitive di SQLite; service layer melakukan check
case-insensitive sebelum insert untuk mencegah varian seperti 'ktp' dan 'KTP'.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, CheckConstraint, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SensitiveKeyword(Base):
    __tablename__ = "sensitive_keywords"
    __table_args__ = (
        CheckConstraint("length(word) >= 2", name="ck_sensitive_keywords_min_length"),
    )

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    word: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    category: Mapped[str] = mapped_column(String, nullable=False, index=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
