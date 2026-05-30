from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.features.accounts.models import Account
from app.features.async_operations.models import Operation
from app.features.async_operations.repository import (
    active_operations,
    get_operation,
    load_context,
    mark_failed,
)
from app.features.async_operations.schemas import OperationProgress, OperationResponse

logger = logging.getLogger(__name__)


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat().replace("+00:00", "Z")


def to_operation_response(operation: Operation) -> OperationResponse:
    progress = None
    if operation.progress_current is not None or operation.progress_label is not None:
        progress = OperationProgress(
            current=operation.progress_current,
            total=operation.progress_total,
            label=operation.progress_label,
        )
    return OperationResponse(
        operation_id=operation.id,
        operation_type=operation.operation_type,
        status=operation.status,
        started_at=_iso(operation.started_at) or "",
        completed_at=_iso(operation.completed_at),
        progress=progress,
        context=load_context(operation) or None,
        error_message=operation.error_message,
    )


def get_status(db: Session, operation_id: str) -> OperationResponse:
    return to_operation_response(get_operation(db, operation_id))


def _is_initial_load_context(
    context: dict,
    *,
    account: Account,
    previous_data_state: str | None,
) -> bool:
    triggered_by = context.get("triggered_by")
    if triggered_by == "initial_load":
        return True
    if triggered_by in {"single_refresh", "refresh_all"}:
        return False

    return account.last_good_sync_at is None and previous_data_state != "Lengkap"


def recover_orphan_operations(db: Session) -> int:
    """Mark active operations failed after backend restart and unstick accounts."""
    recovered = 0
    for operation in active_operations(db):
        context = load_context(operation)
        mark_failed(db, operation, "Backend restart saat operation berjalan")
        recovered += 1
        if operation.operation_type != "refresh":
            continue
        account_id = context.get("account_id")
        if not account_id:
            continue
        account = db.get(Account, account_id)
        if account is None or account.status != "syncing":
            continue
        previous_status = context.get("previous_status")
        previous_data_state = context.get("previous_data_state") or account.data_state
        if _is_initial_load_context(
            context,
            account=account,
            previous_data_state=previous_data_state,
        ):
            account.status = "load_failed"
            account.data_state = previous_data_state
        elif previous_status and previous_status != "syncing":
            account.status = previous_status
        elif account.last_good_sync_at is not None:
            account.status = "active"
        else:
            account.status = "never_synced"
        db.commit()
    if recovered:
        logger.warning("Recovered orphan operations | count=%s", recovered)
    return recovered
