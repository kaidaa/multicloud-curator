from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Google OAuth
    google_client_id: str = Field(default="")
    google_client_secret: str = Field(default="")
    google_redirect_uri: str = Field(
        default="http://localhost:8000/api/accounts/connect/callback"
    )

    # Dropbox OAuth
    dropbox_app_key: str = Field(default="")
    dropbox_app_secret: str = Field(default="")
    dropbox_redirect_uri: str = Field(
        default="http://localhost:8000/api/accounts/connect/callback"
    )

    # Token encryption
    token_encryption_key: str = Field(default="")

    # Database
    database_url: str = Field(default="sqlite:///./app.db")

    # Server
    backend_port: int = Field(default=8000)
    frontend_dev_port: int = Field(default=5173)
    frontend_redirect_base_url: str = Field(default="http://localhost:5173")

    # Logging
    log_level: str = Field(default="INFO")

    # CORS
    cors_allowed_origins: str = Field(default="http://localhost:5173")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
