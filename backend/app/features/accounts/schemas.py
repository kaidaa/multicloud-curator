"""Pydantic schemas for account management endpoints."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict

ProviderName = Literal["google", "dropbox"]
AccountStatus = Literal["active", "token_invalid", "revoked", "syncing", "never_synced"]
DataState = Literal["BelumTersedia", "Parsial", "Lengkap"]


class ConnectInitiateRequest(BaseModel):
    provider: ProviderName


class OAuthInitiateResponse(BaseModel):
    authorization_url: str
    state: str


class AccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    provider: ProviderName
    email: str
    status: AccountStatus
    quota_used_bytes: int
    quota_total_bytes: int
    last_sync_at: str | None
    last_good_sync_at: str | None
    data_state: DataState


class RefreshOperationResponse(BaseModel):
    operation_id: str
    operation_type: Literal["refresh"]
    account_id: str
    status: Literal["queued", "running"]


class RefreshAllItemResponse(BaseModel):
    account_id: str
    operation_id: str
    operation_type: Literal["refresh"]
    status: Literal["queued", "running"]


class RefreshAllResponse(BaseModel):
    operations: list[RefreshAllItemResponse]
