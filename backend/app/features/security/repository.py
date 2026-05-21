"""Persistence helpers for security audit."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.features.accounts.models import Account
from app.features.files_visibility.models import File
from app.features.keywords.models import SensitiveKeyword
from app.features.security.models import ScanResult

SECURITY_SCAN_TYPE = "security_audit"


@dataclass(slots=True)
class SecurityScanCandidate:
    file: File


@dataclass(slots=True)
class SecurityPublicFileRow:
    file: File
    account: Account
    scan_result: ScanResult


@dataclass(frozen=True, slots=True)
class SecurityScanResultInput:
    file_id: str
    is_sensitive: bool
    matched_keywords: list[str]


@dataclass(slots=True)
class FileWithAccount:
    file: File
    account: Account


def list_scan_candidates(db: Session) -> list[SecurityScanCandidate]:
    files = db.execute(
        select(File).where(
            File.is_owned.is_(True),
            File.sharing_status == "public",
            File.trashed.is_(False),
            File.is_folder.is_(False),
        )
    ).scalars()
    return [SecurityScanCandidate(file=file) for file in files.all()]


def list_active_keywords(db: Session) -> list[SensitiveKeyword]:
    return list(
        db.execute(
            select(SensitiveKeyword)
            .where(SensitiveKeyword.active.is_(True))
            .order_by(SensitiveKeyword.word.asc())
        )
        .scalars()
        .all()
    )


def replace_security_scan_results(
    db: Session,
    *,
    results: list[SecurityScanResultInput],
    scanned_at: datetime,
) -> None:
    try:
        db.execute(delete(ScanResult).where(ScanResult.scan_type == SECURITY_SCAN_TYPE))
        for result in results:
            db.add(
                ScanResult(
                    file_id=result.file_id,
                    scan_type=SECURITY_SCAN_TYPE,
                    is_sensitive=result.is_sensitive,
                    matched_keywords=json.dumps(result.matched_keywords) if result.matched_keywords else None,
                    scanned_at=scanned_at,
                )
            )
        db.commit()
    except Exception:
        db.rollback()
        raise


def latest_security_scan_at(db: Session) -> datetime | None:
    return db.execute(
        select(func.max(ScanResult.scanned_at)).where(ScanResult.scan_type == SECURITY_SCAN_TYPE)
    ).scalar_one()


def list_public_file_rows(db: Session, *, sensitive_only: bool) -> list[SecurityPublicFileRow]:
    stmt = (
        select(File, Account, ScanResult)
        .join(ScanResult, ScanResult.file_id == File.id)
        .join(Account, File.account_id == Account.id)
        .where(ScanResult.scan_type == SECURITY_SCAN_TYPE)
        .order_by(File.modified_time.desc(), File.id)
    )
    if sensitive_only:
        stmt = stmt.where(ScanResult.is_sensitive.is_(True))
    rows = db.execute(stmt).all()
    return [
        SecurityPublicFileRow(file=row[0], account=row[1], scan_result=row[2])
        for row in rows
    ]


def get_file_with_account(db: Session, file_id: str) -> FileWithAccount | None:
    row = db.execute(
        select(File, Account)
        .join(Account, File.account_id == Account.id)
        .where(File.id == file_id)
    ).first()
    if row is None:
        return None
    return FileWithAccount(file=row[0], account=row[1])


def mark_file_private_and_remove_scan_result(db: Session, file: File) -> None:
    file.sharing_status = "private"
    db.execute(
        delete(ScanResult).where(
            ScanResult.file_id == file.id,
            ScanResult.scan_type == SECURITY_SCAN_TYPE,
        )
    )
