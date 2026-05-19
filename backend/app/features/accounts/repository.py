"""Persistence helpers for account management and OAuth state."""

from __future__ import annotations

import hashlib
import json
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.adapters.base import NormalizedFile, TokenBundle
from app.features.accounts.models import Account, OAuthState
from app.features.async_operations.models import Operation
from app.features.files_visibility.models import File
from app.shared.encryption import encrypt_token
from app.shared.exceptions import NotFoundError, ValidationError

_OAUTH_STATE_TTL_MINUTES = 10


@dataclass(slots=True)
class ConsumedOAuthState:
    provider: str
    mode: str
    account_id: str | None


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def state_hash(raw_state: str) -> str:
    return hashlib.sha256(raw_state.encode("utf-8")).hexdigest()


def normalize_db_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def cleanup_expired_oauth_states(db: Session, *, now: datetime | None = None) -> int:
    """Delete expired/consumed OAuth state rows.

    Called lazily when a new state is created. This keeps the table small without
    requiring a scheduler.
    """
    current = now or utc_now()
    stmt = delete(OAuthState).where(
        (OAuthState.expires_at < current) | (OAuthState.consumed_at.is_not(None))
    )
    result = db.execute(stmt)
    return int(result.rowcount or 0)


def create_oauth_state(
    db: Session,
    *,
    provider: str,
    mode: str,
    account_id: str | None,
) -> str:
    raw_state = secrets.token_urlsafe(32)
    now = utc_now()
    cleanup_expired_oauth_states(db, now=now)
    db.add(
        OAuthState(
            state_hash=state_hash(raw_state),
            provider=provider,
            mode=mode,
            account_id=account_id,
            expires_at=now + timedelta(minutes=_OAUTH_STATE_TTL_MINUTES),
            created_at=now,
        )
    )
    db.commit()
    return raw_state


def consume_oauth_state(db: Session, raw_state: str) -> ConsumedOAuthState:
    """Validate and mark OAuth state as consumed in one DB transaction."""
    now = utc_now()
    hashed = state_hash(raw_state)
    record = db.execute(
        select(OAuthState).where(OAuthState.state_hash == hashed)
    ).scalar_one_or_none()
    if record is None or record.expires_at < now or record.consumed_at is not None:
        db.rollback()
        raise ValidationError("State OAuth tidak valid atau sudah kedaluwarsa")

    result = db.execute(
        update(OAuthState)
        .where(
            OAuthState.id == record.id,
            OAuthState.consumed_at.is_(None),
            OAuthState.expires_at >= now,
        )
        .values(consumed_at=now)
    )
    if result.rowcount != 1:
        db.rollback()
        raise ValidationError("State OAuth sudah digunakan")
    db.commit()
    return ConsumedOAuthState(
        provider=record.provider,
        mode=record.mode,
        account_id=record.account_id,
    )


def get_account(db: Session, account_id: str) -> Account:
    account = db.get(Account, account_id)
    if account is None:
        raise NotFoundError("Akun tidak ditemukan", details={"account_id": account_id})
    return account


def list_accounts(db: Session) -> list[Account]:
    stmt = select(Account).order_by(Account.created_at.asc())
    return list(db.execute(stmt).scalars().all())


def list_refreshable_accounts(db: Session) -> list[Account]:
    stmt = select(Account).where(Account.status.not_in(["token_invalid", "revoked"]))
    return list(db.execute(stmt).scalars().all())


def find_account_by_provider_id(
    db: Session,
    *,
    provider: str,
    provider_account_id: str,
) -> Account | None:
    stmt = select(Account).where(
        Account.provider == provider,
        Account.provider_account_id == provider_account_id,
    )
    return db.execute(stmt).scalar_one_or_none()


def upsert_account_tokens(
    db: Session,
    *,
    provider: str,
    provider_account_id: str,
    email: str,
    token_bundle: TokenBundle,
    quota_used_bytes: int,
    quota_total_bytes: int,
    existing_account_id: str | None = None,
) -> Account:
    now = utc_now()
    account = db.get(Account, existing_account_id) if existing_account_id else None
    if account is None:
        account = find_account_by_provider_id(
            db,
            provider=provider,
            provider_account_id=provider_account_id,
        )

    encrypted_refresh = (
        encrypt_token(token_bundle.refresh_token)
        if token_bundle.refresh_token is not None
        else None
    )
    if account is None:
        if encrypted_refresh is None:
            raise ValidationError("Refresh token tidak tersedia dari provider")
        account = Account(
            provider=provider,
            provider_account_id=provider_account_id,
            email=email,
            encrypted_access_token=encrypt_token(token_bundle.access_token),
            encrypted_refresh_token=encrypted_refresh,
            access_token_expires_at=normalize_db_datetime(token_bundle.expires_at),
            scopes=json.dumps(token_bundle.scopes),
            status="never_synced",
            quota_used_bytes=quota_used_bytes,
            quota_total_bytes=quota_total_bytes,
            data_state="Parsial",
            created_at=now,
            updated_at=now,
        )
        db.add(account)
        db.commit()
        db.refresh(account)
        return account

    account.email = email
    account.encrypted_access_token = encrypt_token(token_bundle.access_token)
    if encrypted_refresh is not None:
        account.encrypted_refresh_token = encrypted_refresh
    account.access_token_expires_at = normalize_db_datetime(token_bundle.expires_at)
    account.scopes = json.dumps(token_bundle.scopes)
    account.quota_used_bytes = quota_used_bytes
    account.quota_total_bytes = quota_total_bytes
    account.status = "active" if account.data_state == "Lengkap" else "never_synced"
    if account.data_state == "BelumTersedia":
        account.data_state = "Parsial"
    account.updated_at = now
    db.commit()
    db.refresh(account)
    return account


def persist_refreshed_token(
    db: Session,
    account: Account,
    token_bundle: TokenBundle,
) -> Account:
    account.encrypted_access_token = encrypt_token(token_bundle.access_token)
    if token_bundle.refresh_token is not None:
        account.encrypted_refresh_token = encrypt_token(token_bundle.refresh_token)
    account.access_token_expires_at = normalize_db_datetime(token_bundle.expires_at)
    account.scopes = json.dumps(token_bundle.scopes)
    account.updated_at = utc_now()
    db.commit()
    db.refresh(account)
    return account


def set_account_status(
    db: Session,
    account: Account,
    *,
    status: str,
    data_state: str | None = None,
    last_sync_at: datetime | None = None,
    last_good_sync_at: datetime | None = None,
    quota_used_bytes: int | None = None,
    quota_total_bytes: int | None = None,
) -> Account:
    account.status = status
    if data_state is not None:
        account.data_state = data_state
    if last_sync_at is not None:
        account.last_sync_at = last_sync_at
    if last_good_sync_at is not None:
        account.last_good_sync_at = last_good_sync_at
    if quota_used_bytes is not None:
        account.quota_used_bytes = quota_used_bytes
    if quota_total_bytes is not None:
        account.quota_total_bytes = quota_total_bytes
    account.updated_at = utc_now()
    db.commit()
    db.refresh(account)
    return account


def replace_files_for_account(
    db: Session,
    *,
    account_id: str,
    files: list[NormalizedFile],
) -> None:
    db.execute(delete(File).where(File.account_id == account_id))
    _insert_files(db, account_id=account_id, files=files)
    db.commit()


def replace_files_if_partial(
    db: Session,
    *,
    account: Account,
    files: list[NormalizedFile],
) -> None:
    if account.data_state == "Lengkap":
        return
    db.execute(delete(File).where(File.account_id == account.id))
    _insert_files(db, account_id=account.id, files=files)
    db.commit()


def _insert_files(
    db: Session,
    *,
    account_id: str,
    files: list[NormalizedFile],
) -> None:
    now = utc_now()
    for file_item in files:
        db.add(
            File(
                account_id=account_id,
                file_id=file_item["file_id"],
                file_name=file_item["file_name"],
                path=file_item.get("path"),
                size_bytes=file_item.get("size_bytes"),
                mime_type=file_item.get("mime_type"),
                modified_time=file_item["modified_time"],
                hash=file_item.get("hash"),
                owner_account=file_item.get("owner_account") or account_id,
                provider=file_item["provider"],
                sharing_status=file_item.get("sharing_status"),
                web_view_link=file_item.get("web_view_link"),
                trashed=bool(file_item.get("trashed", False)),
                is_folder=bool(file_item.get("is_folder", False)),
                is_owned=bool(file_item.get("is_owned", False)),
                created_at=now,
                updated_at=now,
            )
        )


def count_files_for_account(db: Session, account_id: str) -> int:
    return int(
        db.execute(
            select(func.count()).select_from(File).where(File.account_id == account_id)
        ).scalar_one()
    )


def delete_account_cascade(db: Session, account: Account) -> None:
    db.execute(delete(OAuthState).where(OAuthState.account_id == account.id))
    db.execute(delete(Operation).where(Operation.context.like(f'%"{account.id}"%')))
    db.delete(account)
    db.commit()
