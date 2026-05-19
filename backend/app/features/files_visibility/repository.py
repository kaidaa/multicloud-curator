"""Database queries for Files Visibility endpoints."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.features.accounts.models import Account
from app.features.files_visibility.models import File


@dataclass(slots=True)
class ActivityFileRow:
    file: File
    account_email: str


def list_recent_activity_files(db: Session, *, limit: int) -> list[ActivityFileRow]:
    """Return recently modified files from accounts with a complete refresh snapshot."""
    rows = db.execute(
        select(File, Account.email)
        .join(Account, File.account_id == Account.id)
        .where(
            File.trashed.is_(False),
            File.is_folder.is_(False),
            Account.last_good_sync_at.is_not(None),
        )
        .order_by(File.modified_time.desc())
        .limit(limit)
    ).all()
    return [ActivityFileRow(file=row[0], account_email=row[1]) for row in rows]


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def list_search_candidate_files(
    db: Session,
    *,
    query: str,
    owned_only: bool,
    provider: str,
) -> list[ActivityFileRow]:
    """Return DB-local search candidates before type filtering and pagination."""
    pattern = f"%{_escape_like(query.lower())}%"
    stmt = (
        select(File, Account.email)
        .join(Account, File.account_id == Account.id)
        .where(
            File.trashed.is_(False),
            File.is_folder.is_(False),
            Account.last_good_sync_at.is_not(None),
            or_(
                func.lower(File.file_name).like(pattern, escape="\\"),
                func.lower(func.coalesce(File.path, "")).like(pattern, escape="\\"),
            ),
        )
    )
    if owned_only:
        stmt = stmt.where(File.is_owned.is_(True))
    if provider != "all":
        stmt = stmt.where(File.provider == provider)
    rows = db.execute(stmt).all()
    return [ActivityFileRow(file=row[0], account_email=row[1]) for row in rows]


def latest_file_snapshot_at(db: Session) -> datetime | None:
    return db.execute(
        select(func.max(File.updated_at))
        .join(Account, File.account_id == Account.id)
        .where(
            File.trashed.is_(False),
            File.is_folder.is_(False),
            Account.last_good_sync_at.is_not(None),
        )
    ).scalar_one()


def list_accounts_for_quota(db: Session) -> list[Account]:
    return list(db.execute(select(Account).order_by(Account.provider, Account.email)).scalars().all())


def latest_account_snapshot_at(db: Session) -> datetime | None:
    return db.execute(select(func.max(Account.updated_at))).scalar_one()
