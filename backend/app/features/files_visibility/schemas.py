from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

ProviderName = Literal["google", "dropbox"]
LocationType = Literal["MY_DRIVE", "SHARED_WITH_ME", "SHARED_DRIVE", "UNKNOWN"]
OpenUrlType = Literal["google_web_view", "dropbox_private_quickview"]
SearchProviderFilter = Literal["all", "google", "dropbox"]
SearchSort = Literal["modified_desc", "modified_asc", "name_asc"]
SearchTypeFilter = Literal["all", "photo", "video", "document", "audio", "other"]


class FileActivityItemResponse(BaseModel):
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
    path: str | None
    location_type: LocationType | None
    open_url: str | None
    open_url_type: OpenUrlType | None


class QuotaAccountResponse(BaseModel):
    account_id: str
    provider: ProviderName
    email: str
    used_bytes: int
    total_bytes: int


class QuotaSummaryResponse(BaseModel):
    total_used_bytes: int
    total_capacity_bytes: int
    per_account: list[QuotaAccountResponse]
