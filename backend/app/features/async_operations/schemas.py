from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class OperationProgress(BaseModel):
    current: int | None = None
    total: int | None = None
    label: str | None = None


class OperationResponse(BaseModel):
    operation_id: str
    operation_type: Literal["refresh", "duplicates_scan", "security_scan"]
    status: Literal["queued", "running", "completed", "failed"]
    started_at: str
    completed_at: str | None = None
    progress: OperationProgress | None = None
    context: dict | None = None
    error_message: str | None = None
