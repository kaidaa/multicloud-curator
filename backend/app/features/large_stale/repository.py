from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.features.accounts.models import Account
from app.features.files_visibility.models import File
from app.features.large_stale.models import LargeStaleResult
from app.features.scan_metadata import repository as scan_metadata_repo
from app.features.scan_metadata.schemas import ScanCoverageResponse

LARGE_STALE_SCAN_TYPE = "large_stale_scan"


@dataclass(slots=True)
class LargeStaleCandidateRow:
    file: File
    account: Account


@dataclass(frozen=True, slots=True)
class LargeStaleResultInput:
    file_id: str
    trigger_reason: str
    is_large: bool
    is_stale: bool
    modified_age_months: int


@dataclass(slots=True)
class LargeStaleResultRow:
    file: File
    account: Account
    result: LargeStaleResult


def list_candidate_files(
    db: Session,
    *,
    account_ids: set[str] | None = None,
) -> list[LargeStaleCandidateRow]:
    if account_ids is not None and not account_ids:
        return []
    stmt = (
        select(File, Account)
        .join(Account, File.account_id == Account.id)
        .where(
            File.is_owned.is_(True),
            File.trashed.is_(False),
            File.is_folder.is_(False),
        )
    )
    if account_ids is not None:
        stmt = stmt.where(File.account_id.in_(account_ids))
    rows = db.execute(stmt).all()
    return [LargeStaleCandidateRow(file=row[0], account=row[1]) for row in rows]


def replace_large_stale_results(
    db: Session,
    *,
    results: list[LargeStaleResultInput],
    scanned_at: datetime,
    coverage: ScanCoverageResponse,
) -> None:
    db.execute(delete(LargeStaleResult))
    for result in results:
        db.add(
            LargeStaleResult(
                file_id=result.file_id,
                scan_at=scanned_at,
                trigger_reason=result.trigger_reason,
                is_large=result.is_large,
                is_stale=result.is_stale,
                modified_age_months=result.modified_age_months,
            )
        )
    scan_metadata_repo.replace_scan_metadata(
        db,
        scan_type=LARGE_STALE_SCAN_TYPE,
        scan_at=scanned_at,
        coverage=coverage,
    )
    db.commit()


def list_large_stale_result_rows(db: Session) -> list[LargeStaleResultRow]:
    rows = db.execute(
        select(File, Account, LargeStaleResult)
        .join(LargeStaleResult, LargeStaleResult.file_id == File.id)
        .join(Account, File.account_id == Account.id)
    ).all()
    return [
        LargeStaleResultRow(file=row[0], account=row[1], result=row[2])
        for row in rows
    ]


def latest_scan_at(db: Session) -> datetime | None:
    metadata = scan_metadata_repo.get_latest_scan_metadata(
        db,
        scan_type=LARGE_STALE_SCAN_TYPE,
    )
    if metadata is not None:
        return metadata.scan_at
    return db.execute(select(func.max(LargeStaleResult.scan_at))).scalar_one()


def latest_scan_coverage(db: Session) -> ScanCoverageResponse | None:
    metadata = scan_metadata_repo.get_latest_scan_metadata(
        db,
        scan_type=LARGE_STALE_SCAN_TYPE,
    )
    return scan_metadata_repo.coverage_response(metadata)


def oldest_eligible_snapshot_at(
    db: Session,
    *,
    account_ids: set[str] | None = None,
) -> datetime | None:
    if account_ids is not None and not account_ids:
        return None
    stmt = select(func.min(Account.last_good_sync_at)).where(Account.last_good_sync_at.is_not(None))
    if account_ids is not None:
        stmt = stmt.where(Account.id.in_(account_ids))
    return db.execute(stmt).scalar_one()
