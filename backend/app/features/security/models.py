"""Hasil scan keamanan (deteksi nama file mengandung keyword sensitif).

``scan_type`` saat ini hanya 'security_audit'; field disiapkan untuk ekstensi
ke tipe scan lain di masa depan. ``matched_keywords`` di-store sebagai JSON
array string dan di-parse di service layer.

Deteksi file besar/usang dijalankan on-demand di service tanpa persistensi,
jadi tidak masuk tabel ini.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ScanResult(Base):
    __tablename__ = "scan_results"
    __table_args__ = (
        UniqueConstraint("file_id", "scan_type", name="uq_scan_results_file_type"),
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
    )
    scan_type: Mapped[str] = mapped_column(String, nullable=False, index=True)
    is_sensitive: Mapped[bool] = mapped_column(Boolean, nullable=False, index=True)
    matched_keywords: Mapped[str | None] = mapped_column(String, nullable=True)
    scanned_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
