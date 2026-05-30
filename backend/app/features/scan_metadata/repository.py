from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.features.accounts.models import Account
from app.features.scan_metadata.models import ScanMetadata
from app.features.scan_metadata.schemas import ScanCoverageResponse

ScanMetadataType = Literal["duplicates_scan", "security_scan", "large_stale_scan"]


@dataclass(frozen=True, slots=True)
class AccountSnapshot:
    connected_account_ids: list[str]
    active_account_ids: set[str]


def snapshot_connected_accounts(accounts: list[Account]) -> AccountSnapshot:
    connected_account_ids = [account.id for account in accounts]
    active_account_ids = {
        account.id for account in accounts if account.status == "active"
    }
    return AccountSnapshot(
        connected_account_ids=connected_account_ids,
        active_account_ids=active_account_ids,
    )


def coverage_from_active_accounts(snapshot: AccountSnapshot) -> ScanCoverageResponse:
    covered_account_ids = [
        account_id
        for account_id in snapshot.connected_account_ids
        if account_id in snapshot.active_account_ids
    ]
    return ScanCoverageResponse(
        covered_account_ids=covered_account_ids,
        covered_account_count=len(covered_account_ids),
        eligible_account_count=len(snapshot.connected_account_ids),
    )


def replace_scan_metadata(
    db: Session,
    *,
    scan_type: ScanMetadataType,
    scan_at: datetime,
    coverage: ScanCoverageResponse,
) -> None:
    db.execute(delete(ScanMetadata).where(ScanMetadata.scan_type == scan_type))
    db.add(
        ScanMetadata(
            scan_type=scan_type,
            scan_at=scan_at,
            covered_account_ids=json.dumps(coverage.covered_account_ids),
            eligible_account_count=coverage.eligible_account_count,
        )
    )


def get_latest_scan_metadata(
    db: Session,
    *,
    scan_type: ScanMetadataType,
) -> ScanMetadata | None:
    return db.execute(
        select(ScanMetadata).where(ScanMetadata.scan_type == scan_type)
    ).scalar_one_or_none()


def coverage_response(metadata: ScanMetadata | None) -> ScanCoverageResponse | None:
    if metadata is None:
        return None
    try:
        parsed = json.loads(metadata.covered_account_ids)
    except json.JSONDecodeError:
        parsed = []
    if not isinstance(parsed, list):
        parsed = []
    covered_account_ids = [str(item) for item in parsed]
    return ScanCoverageResponse(
        covered_account_ids=covered_account_ids,
        covered_account_count=len(covered_account_ids),
        eligible_account_count=metadata.eligible_account_count,
    )


def delete_all_scan_metadata(db: Session) -> None:
    db.execute(delete(ScanMetadata))
