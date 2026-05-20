"""Business logic for large/stale file management."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.features.accounts.models import Account
from app.features.files_visibility.models import File
from app.features.files_visibility.service import (
    _iso,
    categorize_file_for_search,
    derive_file_type,
    sanitize_display_path,
)
from app.features.large_stale import repository
from app.features.large_stale.schemas import (
    LargeStaleFileResponse,
    LargeStaleSort,
    LargeStaleTypeFilter,
    TriggerReason,
)

LARGE_THRESHOLD_PERCENT = 0.005
LARGE_THRESHOLD_PERCENT_META = 0.5
STALE_MONTHS = 12
STALE_THRESHOLD_DAYS = 365


@dataclass(frozen=True, slots=True)
class LargeStaleEvaluation:
    is_large: bool
    is_stale: bool
    trigger_reason: TriggerReason | None
    modified_age_months: int


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _iso_optional(value: datetime | None) -> str | None:
    value = _as_utc(value)
    if value is None:
        return None
    return value.isoformat().replace("+00:00", "Z")


def evaluate_file(
    file: File,
    account: Account,
    *,
    now: datetime,
) -> LargeStaleEvaluation:
    quota_total = account.quota_total_bytes or 0
    size_bytes = file.size_bytes or 0
    is_large = quota_total > 0 and size_bytes > quota_total * LARGE_THRESHOLD_PERCENT

    modified_at = _as_utc(file.modified_time)
    stale_cutoff = now - timedelta(days=STALE_THRESHOLD_DAYS)
    is_stale = modified_at is not None and modified_at < stale_cutoff
    age_months = 0 if modified_at is None else max(0, (now - modified_at).days // 30)

    trigger_reason: TriggerReason | None
    if is_large and is_stale:
        trigger_reason = "both"
    elif is_large:
        trigger_reason = "large"
    elif is_stale:
        trigger_reason = "stale"
    else:
        trigger_reason = None

    return LargeStaleEvaluation(
        is_large=is_large,
        is_stale=is_stale,
        trigger_reason=trigger_reason,
        modified_age_months=age_months,
    )


def _deletability(account: Account) -> tuple[bool, str | None]:
    if account.status != "active":
        return False, "Akun perlu otorisasi ulang sebelum file bisa dihapus"
    return True, None


def _to_response(
    row: repository.LargeStaleCandidateRow,
    *,
    evaluation: LargeStaleEvaluation,
) -> LargeStaleFileResponse:
    file = row.file
    account = row.account
    deletable, reason = _deletability(account)
    return LargeStaleFileResponse(
        id=file.id,
        file_id=file.file_id,
        name=file.file_name,
        type=derive_file_type(mime_type=file.mime_type, name=file.file_name),
        mime_type=file.mime_type,
        size_bytes=file.size_bytes,
        modified_at=_iso_optional(file.modified_time),
        modified_age_months=evaluation.modified_age_months,
        account_id=file.account_id,
        account_email=account.email,
        provider=file.provider,
        is_owned=file.is_owned,
        deletable=deletable,
        deletable_reason=reason,
        trigger_reason=evaluation.trigger_reason or "stale",
        path=sanitize_display_path(provider=file.provider, path=file.path),
        web_view_link=file.web_view_link,
    )


def _sort_rows(
    rows: list[tuple[repository.LargeStaleCandidateRow, LargeStaleEvaluation]],
    *,
    sort: LargeStaleSort,
) -> list[tuple[repository.LargeStaleCandidateRow, LargeStaleEvaluation]]:
    if sort == "size_asc":
        return sorted(rows, key=lambda item: (item[0].file.size_bytes or 0, item[0].file.id))
    if sort == "modified_asc":
        return sorted(
            rows,
            key=lambda item: (
                item[0].file.modified_time is None,
                _as_utc(item[0].file.modified_time) or datetime.max.replace(tzinfo=timezone.utc),
                item[0].file.id,
            ),
        )
    if sort == "modified_desc":
        return sorted(
            rows,
            key=lambda item: (
                item[0].file.modified_time is None,
                -(_as_utc(item[0].file.modified_time) or datetime.min.replace(tzinfo=timezone.utc)).timestamp(),
                item[0].file.id,
            ),
        )
    return sorted(rows, key=lambda item: (-(item[0].file.size_bytes or 0), item[0].file.id))


def list_large_stale_files(
    db: Session,
    *,
    file_type: LargeStaleTypeFilter,
    sort: LargeStaleSort,
    limit: int,
    offset: int,
    now: datetime | None = None,
) -> tuple[list[LargeStaleFileResponse], int, str]:
    current_time = now or _utc_now()
    rows = repository.list_candidate_files(db)

    evaluated: list[tuple[repository.LargeStaleCandidateRow, LargeStaleEvaluation]] = []
    for row in rows:
        evaluation = evaluate_file(row.file, row.account, now=current_time)
        if evaluation.trigger_reason is None:
            continue
        if file_type != "all" and categorize_file_for_search(
            mime_type=row.file.mime_type,
            name=row.file.file_name,
        ) != file_type:
            continue
        evaluated.append((row, evaluation))

    sorted_rows = _sort_rows(evaluated, sort=sort)
    total = len(sorted_rows)
    paginated_rows = sorted_rows[offset : offset + limit]
    snapshot_at = repository.oldest_eligible_snapshot_at(db)
    return (
        [_to_response(row, evaluation=evaluation) for row, evaluation in paginated_rows],
        total,
        _iso(snapshot_at),
    )
