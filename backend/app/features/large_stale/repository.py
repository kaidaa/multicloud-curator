"""Database queries for large/stale file management."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.features.accounts.models import Account
from app.features.files_visibility.models import File


@dataclass(slots=True)
class LargeStaleCandidateRow:
    file: File
    account: Account


def list_candidate_files(db: Session) -> list[LargeStaleCandidateRow]:
    rows = db.execute(
        select(File, Account)
        .join(Account, File.account_id == Account.id)
        .where(
            File.is_owned.is_(True),
            File.trashed.is_(False),
            File.is_folder.is_(False),
            Account.last_good_sync_at.is_not(None),
        )
    ).all()
    return [LargeStaleCandidateRow(file=row[0], account=row[1]) for row in rows]


def oldest_eligible_snapshot_at(db: Session) -> datetime | None:
    return db.execute(
        select(func.min(Account.last_good_sync_at)).where(Account.last_good_sync_at.is_not(None))
    ).scalar_one()
