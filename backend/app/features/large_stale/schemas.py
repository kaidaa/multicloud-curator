"""Pydantic schemas for large/stale file endpoints."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from app.features.files_visibility.schemas import ProviderName, SearchTypeFilter

LargeStaleSort = Literal["size_desc", "size_asc", "modified_asc", "modified_desc"]
LargeStaleTypeFilter = SearchTypeFilter
TriggerReason = Literal["large", "stale", "both"]


class LargeStaleFileResponse(BaseModel):
    id: str
    file_id: str
    name: str
    type: str
    mime_type: str | None
    size_bytes: int | None
    modified_at: str | None
    modified_age_months: int
    account_id: str
    account_email: str
    provider: ProviderName
    is_owned: bool
    deletable: bool
    deletable_reason: str | None
    trigger_reason: TriggerReason
    path: str | None
    web_view_link: str | None
