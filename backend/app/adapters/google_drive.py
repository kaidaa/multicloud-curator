from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

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

GOOGLE_DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"]
_TOKEN_URI = "https://oauth2.googleapis.com/token"
_FOLDER_MIME = "application/vnd.google-apps.folder"


def _client_config(settings: Settings) -> dict[str, Any]:
    if not settings.google_client_id or not settings.google_client_secret:
        raise AdapterError(
            "Konfigurasi Google OAuth belum lengkap",
            provider="google",
            account_id=None,
            operation="oauth_config",
        )
    return {
        "web": {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": _TOKEN_URI,
            "redirect_uris": [settings.google_redirect_uri],
        }
    }


def _parse_dt(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _classify_google_location(item: dict[str, Any]) -> str:
    if item.get("driveId"):
        return "SHARED_DRIVE"
    if item.get("sharedWithMeTime") and item.get("ownedByMe") is False:
        return "SHARED_WITH_ME"
    if item.get("ownedByMe") is True:
        return "MY_DRIVE"
    return "UNKNOWN"


def _google_credentials(
    credentials: ProviderCredentials,
    settings: Settings,
) -> Credentials:
    return Credentials(
        token=credentials.access_token,
        refresh_token=credentials.refresh_token,
        token_uri=_TOKEN_URI,
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=credentials.scopes or GOOGLE_DRIVE_SCOPES,
    )


class GoogleDriveOAuthClient(OAuthClient):
    provider_name = "google"

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def _flow(self) -> Flow:
        flow = Flow.from_client_config(_client_config(self.settings), scopes=GOOGLE_DRIVE_SCOPES)
        flow.redirect_uri = self.settings.google_redirect_uri
        return flow

    def build_authorization_url(self, state: str) -> str:
        flow = self._flow()
        authorization_url, _state = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
            state=state,
        )
        return authorization_url

    def exchange_code(self, code: str) -> TokenBundle:
        try:
            response = httpx.post(
                _TOKEN_URI,
                data={
                    "code": code,
                    "client_id": self.settings.google_client_id,
                    "client_secret": self.settings.google_client_secret,
                    "redirect_uri": self.settings.google_redirect_uri,
                    "grant_type": "authorization_code",
                },
                timeout=30,
            )
        except httpx.HTTPError as exc:
            raise TokenInvalidError(
                "Token exchange Google gagal",
                provider="google",
                account_id=None,
                operation="exchange_code",
                original_error=exc,
            ) from exc

        if response.status_code in {400, 401}:
            raise TokenInvalidError(
                "Token exchange Google gagal",
                provider="google",
                account_id=None,
                operation="exchange_code",
            )
        if response.status_code >= 500:
            raise ProviderUnavailableError(
                "Google token endpoint tidak tersedia",
                provider="google",
                account_id=None,
                operation="exchange_code",
            )
        response.raise_for_status()
        payload = response.json()
        access_token = payload.get("access_token")
        refresh_token = payload.get("refresh_token")
        scopes = coerce_scopes(payload.get("scope"), GOOGLE_DRIVE_SCOPES)
        if GOOGLE_DRIVE_SCOPES[0] not in scopes:
            raise ScopeInsufficientError(
                "Scope Google Drive tidak diberikan",
                provider="google",
                account_id=None,
                operation="exchange_code",
                required_scope=GOOGLE_DRIVE_SCOPES,
            )
        if not access_token:
            raise TokenInvalidError(
                "Access token Google tidak tersedia",
                provider="google",
                account_id=None,
                operation="exchange_code",
            )
        if not refresh_token:
            raise TokenInvalidError(
                "Refresh token Google tidak tersedia. Ulangi consent dengan prompt consent.",
                provider="google",
                account_id=None,
                operation="exchange_code",
            )
        expires_in = payload.get("expires_in")
        expires_at = (
            datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))
            if expires_in
            else None
        )
        return TokenBundle(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=expires_at,
            scopes=scopes,
        )

    def refresh_access_token(self, refresh_token: str) -> TokenBundle:
        credentials = Credentials(
            token=None,
            refresh_token=refresh_token,
            token_uri=_TOKEN_URI,
            client_id=self.settings.google_client_id,
            client_secret=self.settings.google_client_secret,
            scopes=GOOGLE_DRIVE_SCOPES,
        )
        try:
            credentials.refresh(Request())
        except RefreshError as exc:
            raise TokenInvalidError(
                "Refresh token Google gagal",
                provider="google",
                account_id=None,
                operation="refresh_token",
                original_error=exc,
            ) from exc
        return TokenBundle(
            access_token=credentials.token,
            refresh_token=credentials.refresh_token,
            expires_at=credentials.expiry,
            scopes=coerce_scopes(credentials.scopes, GOOGLE_DRIVE_SCOPES),
        )


class GoogleDriveAdapter(BaseAdapter):
    provider_name = "google"

    def __init__(self, credentials: ProviderCredentials, settings: Settings) -> None:
        super().__init__(credentials)
        self.settings = settings

    def _service(self):
        return build(
            "drive",
            "v3",
            credentials=_google_credentials(self.credentials, self.settings),
            cache_discovery=False,
        )

    def get_account_info(self) -> AccountInfo:
        try:
            about = self._service().about().get(fields="user").execute()
        except HttpError as exc:
            self._raise_http_error(exc, "get_account_info")
        user = about.get("user", {})
        email = user.get("emailAddress", "")
        provider_account_id = user.get("permissionId") or email
        return {
            "email": email,
            "provider_account_id": provider_account_id,
            "provider": "google",
        }

    def get_quota(self) -> QuotaInfo:
        try:
            about = self._service().about().get(fields="storageQuota").execute()
        except HttpError as exc:
            self._raise_http_error(exc, "get_quota")
        quota = about.get("storageQuota", {})
        return {
            "used_bytes": int(quota.get("usage") or 0),
            "total_bytes": int(quota.get("limit") or 0),
        }

    def fetch_recent(self, limit: int = 10) -> list[NormalizedFile]:
        return self._fetch_files(limit=limit, order_by="modifiedTime desc")

    def fetch_metadata(self, limit: int | None = None) -> list[NormalizedFile]:
        return self._fetch_files(limit=limit)

    def delete_file(self, file_id: str) -> bool:
        try:
            self._service().files().delete(fileId=file_id).execute()
        except HttpError as exc:
            self._raise_http_error(exc, "delete_file", file_id=file_id)
        return True

    def set_sharing_private(self, file_id: str) -> bool:
        service = self._service()
        try:
            permissions = service.permissions().list(fileId=file_id, fields="permissions(id,type)").execute()
            for permission in permissions.get("permissions", []):
                if permission.get("type") == "anyone":
                    service.permissions().delete(fileId=file_id, permissionId=permission["id"]).execute()
                    return True
        except HttpError as exc:
            self._raise_http_error(exc, "set_sharing_private", file_id=file_id)
        return False

    def _fetch_files(self, *, limit: int | None, order_by: str | None = None) -> list[NormalizedFile]:
        service = self._service()
        files: list[NormalizedFile] = []
        page_token: str | None = None
        fields = (
            "nextPageToken,"
            "files(id,name,mimeType,size,modifiedTime,parents,md5Checksum,"
            "ownedByMe,trashed,webViewLink,permissions,shared,driveId,sharedWithMeTime)"
        )
        while True:
            page_size = min(100, limit - len(files)) if limit else 100
            if page_size <= 0:
                break
            try:
                response = (
                    service.files()
                    .list(
                        q="trashed=false",
                        spaces="drive",
                        pageSize=page_size,
                        pageToken=page_token,
                        fields=fields,
                        orderBy=order_by,
                    )
                    .execute()
                )
            except HttpError as exc:
                self._raise_http_error(exc, "fetch_metadata")
            for item in response.get("files", []):
                if item.get("mimeType") == _FOLDER_MIME:
                    continue
                files.append(self._normalize_file(item))
                if limit and len(files) >= limit:
                    return files
            page_token = response.get("nextPageToken")
            if not page_token:
                return files
        return files

    def _normalize_file(self, item: dict[str, Any]) -> NormalizedFile:
        permissions = item.get("permissions") or []
        has_anyone = any(permission.get("type") == "anyone" for permission in permissions)
        sharing_status: str | None
        if item.get("ownedByMe") is False and not permissions:
            sharing_status = None
        else:
            sharing_status = "public" if has_anyone else "private"
        google_web_url = item.get("webViewLink")
        return {
            "file_id": item["id"],
            "file_name": item.get("name", ""),
            # Google parent IDs are opaque; leave path empty until names are resolved.
            "path": None,
            "size_bytes": int(item["size"]) if item.get("size") else None,
            "mime_type": item.get("mimeType"),
            "modified_time": _parse_dt(item.get("modifiedTime")),
            "hash": item.get("md5Checksum"),
            "owner_account": self.credentials.account_id,
            "provider": "google",
            "sharing_status": sharing_status,
            "location_type": _classify_google_location(item),
            "open_url": google_web_url,
            "open_url_type": "google_web_view" if google_web_url else None,
            "has_public_shared_link": has_anyone,
            "shared_link_url": google_web_url if has_anyone else None,
            "shared_link_visibility": "public" if has_anyone else None,
            "trashed": bool(item.get("trashed", False)),
            "is_folder": False,
            "is_owned": bool(item.get("ownedByMe", False)),
        }

    def _raise_http_error(
        self,
        exc: HttpError,
        operation: str,
        *,
        file_id: str | None = None,
    ) -> None:
        status = getattr(exc.resp, "status", None)
        logger.warning(
            "Google adapter error | account_id=%s | operation=%s | status=%s",
            self.credentials.account_id,
            operation,
            status,
        )
        if status == 401:
            raise TokenInvalidError(
                "Token Google tidak valid",
                provider="google",
                account_id=self.credentials.account_id,
                operation=operation,
                original_error=exc,
            ) from exc
        if status == 403:
            raise ScopeInsufficientError(
                "Scope Google tidak cukup",
                provider="google",
                account_id=self.credentials.account_id,
                operation=operation,
                required_scope=GOOGLE_DRIVE_SCOPES,
                original_error=exc,
            ) from exc
        if status == 404 and file_id:
            raise FileNotFoundError(
                "File Google tidak ditemukan",
                provider="google",
                account_id=self.credentials.account_id,
                operation=operation,
                file_id=file_id,
                original_error=exc,
            ) from exc
        if status == 429:
            raise RateLimitError(
                "Rate limit Google terlampaui",
                provider="google",
                account_id=self.credentials.account_id,
                operation=operation,
                original_error=exc,
            ) from exc
        if status and status >= 500:
            raise ProviderUnavailableError(
                "Google Drive tidak tersedia",
                provider="google",
                account_id=self.credentials.account_id,
                operation=operation,
                original_error=exc,
            ) from exc
        raise AdapterError(
            "Operasi Google Drive gagal",
            provider="google",
            account_id=self.credentials.account_id,
            operation=operation,
            original_error=exc,
        ) from exc
