"""Pydantic schemas for duplicate detection endpoints."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from app.features.files_visibility.schemas import SearchTypeFilter


class DuplicatesScanResponse(BaseModel):
    operation_id: str
    operation_type: Literal["duplicates_scan"]
    status: Literal["queued", "running"]


class DuplicateMemberResponse(BaseModel):
    id: str
    file_id: str
    name: str
    type: str
    mime_type: str | None
    size_bytes: int | None
    modified_at: str
    account_id: str
    account_email: str
    provider: Literal["google", "dropbox"]
    is_owned: bool
    deletable: bool
    deletable_reason: str | None
    path: str | None
    web_view_link: str | None


class DuplicateGroupResponse(BaseModel):
    id: str
    representative_name: str
    members_count: int
    total_size_bytes: int
    match_basis: Literal["hash", "name_size"]
    members: list[DuplicateMemberResponse]


class BatchDeleteRequest(BaseModel):
    ids: list[str]


class BatchDeleteSuccessItem(BaseModel):
    id: str
    success: Literal[True]


class BatchDeleteFailureItem(BaseModel):
    id: str
    success: Literal[False]
    error_code: str
    message: str


class BatchDeleteResponse(BaseModel):
    deleted: list[BatchDeleteSuccessItem]
    failed: list[BatchDeleteFailureItem]


DuplicateTypeFilter = SearchTypeFilter
