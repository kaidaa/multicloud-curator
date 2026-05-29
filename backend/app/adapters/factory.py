from __future__ import annotations

from app.adapters.base import BaseAdapter, OAuthClient, ProviderCredentials
from app.adapters.dropbox import DropboxAdapter, DropboxOAuthClient
from app.adapters.google_drive import GoogleDriveAdapter, GoogleDriveOAuthClient
from app.config import Settings
from app.shared.exceptions import ValidationError


def get_oauth_client(provider: str, settings: Settings) -> OAuthClient:
    if provider == "google":
        return GoogleDriveOAuthClient(settings)
    if provider == "dropbox":
        return DropboxOAuthClient(settings)
    raise ValidationError("Provider tidak valid", details={"provider": provider})


def get_adapter(
    provider: str,
    credentials: ProviderCredentials,
    settings: Settings,
) -> BaseAdapter:
    if provider == "google":
        return GoogleDriveAdapter(credentials, settings)
    if provider == "dropbox":
        return DropboxAdapter(credentials)
    raise ValidationError("Provider tidak valid", details={"provider": provider})
