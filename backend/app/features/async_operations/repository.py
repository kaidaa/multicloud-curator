"""Persistence helpers for async operations."""

from __future__ import annotations

import json
import threading
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.features.async_operations.models import Operation
from app.shared.exceptions import NotFoundError, OperationInProgressError, ServiceUnavailableError

_operation_lock = threading.Lock()
_MAX_GLOBAL_ACTIVE = 3


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def load_context(operation: Operation) -> dict[str, Any]:
    if not operation.context:
        return {}
    try:
        parsed = json.loads(operation.context)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def create_operation(
    db: Session,
    *,
    operation_type: str,
    context: dict[str, Any] | None = None,
) -> Operation:
    with _operation_lock:
        cleanup_old_operations(db)
        active = active_operations(db)
        if len(active) >= _MAX_GLOBAL_ACTIVE:
            raise ServiceUnavailableError(
                "Terlalu banyak operasi berjalan. Coba lagi nanti.",
                details={"max_concurrent": _MAX_GLOBAL_ACTIVE},
            )
        for operation in active:
            if operation.operation_type != operation_type:
                continue
            existing_context = load_context(operation)
            if (context or {}).get("account_id") == existing_context.get("account_id"):
                raise OperationInProgressError(
                    "Operasi sedang berjalan. Tunggu hingga selesai.",
                    operation_type=operation.operation_type,
                    operation_id=operation.id,
                    started_at=operation.started_at,
                )

        operation = Operation(
            operation_type=operation_type,
            status="queued",
            context=json.dumps(context or {}, separators=(",", ":")),
            started_at=utc_now(),
        )
        db.add(operation)
        db.commit()
        db.refresh(operation)
        return operation


def get_operation(db: Session, operation_id: str) -> Operation:
    operation = db.get(Operation, operation_id)
    if operation is None:
        raise NotFoundError("Operation tidak ditemukan", details={"operation_id": operation_id})
    return operation


def active_operations(db: Session) -> list[Operation]:
    stmt = select(Operation).where(Operation.status.in_(["queued", "running"]))
    return list(db.execute(stmt).scalars().all())


def cleanup_old_operations(db: Session) -> int:
    cutoff = utc_now() - timedelta(hours=24)
    stmt = delete(Operation).where(
        Operation.status.in_(["completed", "failed"]),
        Operation.completed_at < cutoff,
    )
    result = db.execute(stmt)
    db.commit()
    return int(result.rowcount or 0)


def mark_running(db: Session, operation: Operation, *, label: str | None = None) -> Operation:
    operation.status = "running"
    operation.progress_label = label
    db.commit()
    db.refresh(operation)
    return operation


def update_progress(
    db: Session,
    operation: Operation,
    *,
    current: int | None = None,
    total: int | None = None,
    label: str | None = None,
) -> Operation:
    operation.progress_current = current
    operation.progress_total = total
    operation.progress_label = label
    db.commit()
    db.refresh(operation)
    return operation


def mark_completed(db: Session, operation: Operation) -> Operation:
    operation.status = "completed"
    operation.completed_at = utc_now()
    operation.error_message = None
    db.commit()
    db.refresh(operation)
    return operation


def mark_failed(db: Session, operation: Operation, message: str) -> Operation:
    operation.status = "failed"
    operation.completed_at = utc_now()
    operation.error_message = message[:500]
    db.commit()
    db.refresh(operation)
    return operation
