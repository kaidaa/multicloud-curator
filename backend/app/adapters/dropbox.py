"""Dropbox OAuth and metadata adapter."""

from __future__ import annotations

import logging
import mimetypes
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import dropbox
import httpx

from app.adapters.base import (
    AccountInfo,
    BaseAdapter,
    NormalizedFile,
    OAuthClient,
    ProviderCredentials,
    QuotaInfo,
    TokenBundle,
    coerce_scopes,
)
from app.config import Settings
from app.shared.exceptions import (
    AdapterError,
    FileNotFoundError,
    ProviderUnavailableError,
    RateLimitError,
    ScopeInsufficientError,
    TokenInvalidError,
)

logger = logging.getLogger(__name__)

DROPBOX_SCOPES = [
    "account_info.read",
    "files.metadata.read",
    "files.content.write",
    "sharing.read",
    "sharing.write",
]
_AUTHORIZE_URL = "https://www.dropbox.com/oauth2/authorize"
_TOKEN_URL = "https://api.dropboxapi.com/oauth2/token"


def _ensure_config(settings: Settings) -> None:
    if not settings.dropbox_app_key or not settings.dropbox_app_secret:
        raise AdapterError(
            "Konfigurasi Dropbox OAuth belum lengkap",
            provider="dropbox",
            account_id=None,
            operation="oauth_config",
        )


def _guess_mime_type(name: str) -> str:
    mime_type, _encoding = mimetypes.guess_type(name)
    return mime_type or "application/octet-stream"


class DropboxOAuthClient(OAuthClient):
    provider_name = "dropbox"

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def build_authorization_url(self, state: str) -> str:
        _ensure_config(self.settings)
        query = urlencode(
            {
                "client_id": self.settings.dropbox_app_key,
                "redirect_uri": self.settings.dropbox_redirect_uri,
                "response_type": "code",
                "state": state,
                "token_access_type": "offline",
                "scope": " ".join(DROPBOX_SCOPES),
            }
        )
        return f"{_AUTHORIZE_URL}?{query}"

    def exchange_code(self, code: str) -> TokenBundle:
        _ensure_config(self.settings)
        return self._token_request(
            {
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": self.settings.dropbox_redirect_uri,
            },
            operation="exchange_code",
        )

    def refresh_access_token(self, refresh_token: str) -> TokenBundle:
        _ensure_config(self.settings)
        return self._token_request(
            {
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
            operation="refresh_token",
        )

    def _token_request(self, data: dict[str, str], *, operation: str) -> TokenBundle:
        try:
            response = httpx.post(
                _TOKEN_URL,
                data=data,
                auth=(self.settings.dropbox_app_key, self.settings.dropbox_app_secret),
                timeout=30,
            )
        except httpx.HTTPError as exc:
            raise ProviderUnavailableError(
                "Dropbox token endpoint tidak tersedia",
                provider="dropbox",
                account_id=None,
                operation=operation,
                original_error=exc,
            ) from exc

        if response.status_code in {400, 401}:
            raise TokenInvalidError(
                "Token Dropbox tidak valid",
                provider="dropbox",
                account_id=None,
                operation=operation,
            )
        if response.status_code == 403:
            raise ScopeInsufficientError(
                "Scope Dropbox tidak cukup",
                provider="dropbox",
                account_id=None,
                operation=operation,
                required_scope=DROPBOX_SCOPES,
            )
        if response.status_code == 429:
            raise RateLimitError(
                "Rate limit Dropbox terlampaui",
                provider="dropbox",
                account_id=None,
                operation=operation,
            )
        if response.status_code >= 500:
            raise ProviderUnavailableError(
                "Dropbox token endpoint tidak tersedia",
                provider="dropbox",
                account_id=None,
                operation=operation,
            )
        response.raise_for_status()
        payload = response.json()
        access_token = payload.get("access_token")
        if not access_token:
            raise TokenInvalidError(
                "Access token Dropbox tidak tersedia",
                provider="dropbox",
                account_id=None,
                operation=operation,
            )
        expires_in = payload.get("expires_in")
        expires_at = (
            datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))
            if expires_in
            else None
        )
        return TokenBundle(
            access_token=access_token,
            refresh_token=payload.get("refresh_token"),
            expires_at=expires_at,
            scopes=coerce_scopes(payload.get("scope"), DROPBOX_SCOPES),
        )


class DropboxAdapter(BaseAdapter):
    provider_name = "dropbox"

    def __init__(self, credentials: ProviderCredentials) -> None:
        super().__init__(credentials)
        self.client = dropbox.Dropbox(oauth2_access_token=credentials.access_token)

    def get_account_info(self) -> AccountInfo:
        try:
            account = self.client.users_get_current_account()
        except Exception as exc:  # Dropbox SDK exposes several provider-specific exception classes.
            self._raise_dropbox_error(exc, "get_account_info")
        return {
            "email": account.email,
            "provider_account_id": account.account_id,
            "provider": "dropbox",
        }

    def get_quota(self) -> QuotaInfo:
        try:
            usage = self.client.users_get_space_usage()
        except Exception as exc:
            self._raise_dropbox_error(exc, "get_quota")
        allocated = usage.allocation.get_individual().allocated if usage.allocation.is_individual() else 0
        return {"used_bytes": int(usage.used), "total_bytes": int(allocated or 0)}

    def fetch_recent(self, limit: int = 10) -> list[NormalizedFile]:
        files = self.fetch_metadata(limit=None)
        return sorted(files, key=lambda item: item["modified_time"], reverse=True)[:limit]

    def fetch_metadata(self, limit: int | None = None) -> list[NormalizedFile]:
        public_links = self._public_links()
        public_ids: dict[str, str] = {}
        public_paths: dict[str, str] = {}
        for link in public_links:
            link_id = getattr(link, "id", None)
            path_lower = getattr(link, "path_lower", None)
            if link_id:
                public_ids[link_id] = link.url
            if path_lower:
                public_paths[path_lower] = link.url

        results: list[NormalizedFile] = []
        try:
            listing = self.client.files_list_folder(path="", recursive=True)
            while True:
                for entry in listing.entries:
                    if entry.__class__.__name__ != "FileMetadata":
                        continue
                    results.append(self._normalize_file(entry, public_ids, public_paths))
                    if limit and len(results) >= limit:
                        return results
                if not listing.has_more:
                    break
                listing = self.client.files_list_folder_continue(listing.cursor)
        except Exception as exc:
            self._raise_dropbox_error(exc, "fetch_metadata")
        return results

    def delete_file(self, file_id: str) -> bool:
        try:
            self.client.files_delete_v2(file_id)
        except Exception as exc:
            self._raise_dropbox_error(exc, "delete_file", file_id=file_id)
        return True

    def set_sharing_private(self, file_id: str) -> bool:
        links = self._public_links()
        revoked_any = False
        for link in links:
            if getattr(link, "id", None) == file_id or getattr(link, "path_lower", None) == file_id.lower():
                try:
                    self.client.sharing_revoke_shared_link(link.url)
                except Exception as exc:
                    self._raise_dropbox_error(exc, "set_sharing_private", file_id=file_id)
                revoked_any = True
        return revoked_any

    def _public_links(self) -> list[Any]:
        try:
            response = self.client.sharing_list_shared_links()
            return list(response.links)
        except Exception as exc:
            self._raise_dropbox_error(exc, "sharing_list_shared_links")
        return []

    def _normalize_file(
        self,
        entry: Any,
        public_ids: dict[str, str],
        public_paths: dict[str, str],
    ) -> NormalizedFile:
        link = public_ids.get(entry.id) or public_paths.get(entry.path_lower)
        return {
            "file_id": entry.id,
            "file_name": entry.name,
            "path": entry.path_display,
            "size_bytes": int(entry.size),
            "mime_type": _guess_mime_type(entry.name),
            "modified_time": entry.server_modified.replace(tzinfo=timezone.utc)
            if entry.server_modified.tzinfo is None
            else entry.server_modified,
            "hash": entry.content_hash,
            "owner_account": self.credentials.account_id,
            "provider": "dropbox",
            "sharing_status": "public" if link else "private",
            "web_view_link": link,
            "trashed": False,
            "is_folder": False,
            "is_owned": True,
        }

    def _raise_dropbox_error(
        self,
        exc: BaseException,
        operation: str,
        *,
        file_id: str | None = None,
    ) -> None:
        class_name = exc.__class__.__name__
        logger.warning(
            "Dropbox adapter error | account_id=%s | operation=%s | class=%s",
            self.credentials.account_id,
            operation,
            class_name,
        )
        if "Auth" in class_name:
            raise TokenInvalidError(
                "Token Dropbox tidak valid",
                provider="dropbox",
                account_id=self.credentials.account_id,
                operation=operation,
                original_error=exc,
            ) from exc
        if "RateLimit" in class_name:
            raise RateLimitError(
                "Rate limit Dropbox terlampaui",
                provider="dropbox",
                account_id=self.credentials.account_id,
                operation=operation,
                original_error=exc,
            ) from exc
        if "NotFound" in str(exc) and file_id:
            raise FileNotFoundError(
                "File Dropbox tidak ditemukan",
                provider="dropbox",
                account_id=self.credentials.account_id,
                operation=operation,
                file_id=file_id,
                original_error=exc,
            ) from exc
        if "InternalServer" in class_name or "Http" in class_name:
            raise ProviderUnavailableError(
                "Dropbox tidak tersedia",
                provider="dropbox",
                account_id=self.credentials.account_id,
                operation=operation,
                original_error=exc,
            ) from exc
        raise AdapterError(
            "Operasi Dropbox gagal",
            provider="dropbox",
            account_id=self.credentials.account_id,
            operation=operation,
            original_error=exc,
        ) from exc
