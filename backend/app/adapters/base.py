"""Provider adapter contracts.

Adapter layer owns provider communication and provider quirks. It never writes
database rows directly; service/repository persists encrypted tokens and data.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Any, TypedDict


@dataclass(slots=True)
class ProviderCredentials:
    """Plaintext credentials used inside adapter calls only."""

    account_id: str
    access_token: str
    refresh_token: str
    access_token_expires_at: datetime | None
    scopes: list[str]


@dataclass(slots=True)
class TokenBundle:
    """Token payload returned by OAuth exchange or refresh."""

    access_token: str
    refresh_token: str | None
    expires_at: datetime | None
    scopes: list[str]


class AccountInfo(TypedDict):
    """Return type ``get_account_info()``."""

    email: str
    provider_account_id: str
    provider: str


class QuotaInfo(TypedDict):
    """Return type ``get_quota()``."""

    used_bytes: int
    total_bytes: int


class NormalizedFile(TypedDict, total=False):
    """14-attribute internal file metadata normalized by adapters."""

    file_id: str
    file_name: str
    path: str | None
    size_bytes: int | None
    mime_type: str | None
    modified_time: datetime
    hash: str | None
    owner_account: str
    provider: str
    sharing_status: str | None
    web_view_link: str | None
    trashed: bool
    is_folder: bool
    is_owned: bool


class OAuthClient(ABC):
    """Provider-specific OAuth operations."""

    provider_name: str

    @abstractmethod
    def build_authorization_url(self, state: str) -> str:
        """Build provider authorization URL for the given opaque state."""

    @abstractmethod
    def exchange_code(self, code: str) -> TokenBundle:
        """Exchange authorization code for OAuth tokens."""

    @abstractmethod
    def refresh_access_token(self, refresh_token: str) -> TokenBundle:
        """Use refresh token to obtain a new access token."""


class BaseAdapter(ABC):
    """Abstract base for provider data adapters."""

    provider_name: str

    def __init__(self, credentials: ProviderCredentials) -> None:
        self.credentials = credentials

    @abstractmethod
    def get_account_info(self) -> AccountInfo:
        """Validate connection and return provider account identity."""

    @abstractmethod
    def get_quota(self) -> QuotaInfo:
        """Read used/total quota for the account."""

    @abstractmethod
    def fetch_metadata(self, limit: int | None = None) -> list[NormalizedFile]:
        """Fetch normalized metadata. Adapter hides provider pagination."""

    @abstractmethod
    def fetch_recent(self, limit: int = 10) -> list[NormalizedFile]:
        """Fetch N recently modified files."""

    @abstractmethod
    def delete_file(self, file_id: str) -> bool:
        """Delete provider file. Not used by M3-1, but part of adapter contract."""

    @abstractmethod
    def set_sharing_private(self, file_id: str) -> bool:
        """Revoke public sharing. Not used by M3-1, but part of adapter contract."""


def coerce_scopes(scopes: Any, fallback: list[str]) -> list[str]:
    """Normalize scope values returned by provider libraries."""
    if scopes is None:
        return fallback
    if isinstance(scopes, str):
        return [scope for scope in scopes.split() if scope]
    return [str(scope) for scope in scopes]
