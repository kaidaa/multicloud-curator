from __future__ import annotations

from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class EnvelopeMeta(BaseModel):
    model_config = ConfigDict(extra="allow")

    snapshot_at: str | None = None
    scan_at: str | None = None
    thresholds: dict[str, Any] | None = None
    coverage: dict[str, Any] | None = None
    pagination: dict[str, Any] | None = None


class DataEnvelope(BaseModel, Generic[T]):
    data: T
    meta: EnvelopeMeta | None = None


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None


class ErrorEnvelope(BaseModel):
    error: ErrorDetail
