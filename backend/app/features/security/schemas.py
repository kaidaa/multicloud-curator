from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from app.features.files_visibility.schemas import ProviderName

SecurityMode = Literal["sensitive", "public"]
SecurityProviderFilter = Literal["all", "google", "dropbox"]


class SecurityScanResponse(BaseModel):
    operation_id: str
    operation_type: Literal["security_scan"]
    status: Literal["queued", "running"]


class SecurityPublicFileResponse(BaseModel):
    id: str
    file_id: str
    name: str
    type: str
    mime_type: str | None
    size_bytes: int | None
    modified_at: str
    account_id: str
    account_email: str
    provider: ProviderName
    is_owned: bool
    is_sensitive: bool
    matched_keywords: list[str]
    deletable: bool
    deletable_reason: str | None
    path: str | None
    location_type: str | None
    open_url: str | None
    open_url_type: str | None


class BatchRevokeRequest(BaseModel):
    ids: list[str]


class BatchRevokeSuccessItem(BaseModel):
    id: str
    success: Literal[True]


class BatchRevokeFailureItem(BaseModel):
    id: str
    success: Literal[False]
    error_code: str
    message: str


class BatchRevokeResponse(BaseModel):
    revoked: list[BatchRevokeSuccessItem]
    failed: list[BatchRevokeFailureItem]
