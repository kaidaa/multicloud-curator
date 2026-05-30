from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.adapters.base import ProviderCredentials
from app.adapters.factory import get_adapter, get_oauth_client
from app.config import Settings, get_settings
from app.database import SessionLocal
from app.features.accounts import repository as accounts_repo
from app.features.accounts.models import Account
from app.features.accounts.schemas import (
    AccountResponse,
    OAuthInitiateResponse,
    RefreshAllItemResponse,
    RefreshAllResponse,
    RefreshOperationResponse,
)
from app.features.async_operations import repository as ops_repo
from app.features.duplicates import repository as duplicates_repo
from app.features.scan_metadata import repository as scan_metadata_repo
from app.shared.encryption import decrypt_token
from app.shared.exceptions import (
    AdapterError,
    OperationInProgressError,
    ScopeInsufficientError,
    TokenInvalidError,
    ValidationError,
)

logger = logging.getLogger(__name__)


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat().replace("+00:00", "Z")


def _frontend_redirect(settings: Settings, params: dict[str, str]) -> str:
    base = settings.frontend_redirect_base_url.rstrip("/")
    return f"{base}/pengaturan/akun?{urlencode(params)}"


def _oauth_failure_redirect(
    settings: Settings,
    *,
    error: str,
    provider: str | None = None,
) -> str:
    params = {"status": "failed", "error": error}
    if provider:
        params["provider"] = provider
    return _frontend_redirect(settings, params)


def _fallback_previous_status(account: Account) -> str:
    if account.status != "syncing":
        return account.status
    return "active" if account.last_good_sync_at else "never_synced"


def _is_initial_load_context(
    context: dict,
    *,
    account: Account,
    previous_data_state: str | None,
) -> bool:
    triggered_by = context.get("triggered_by")
    if triggered_by == "initial_load":
        return True
    if triggered_by in {"single_refresh", "refresh_all"}:
        return False

    return account.last_good_sync_at is None and previous_data_state != "Lengkap"


def to_account_response(account: Account) -> AccountResponse:
    return AccountResponse(
        id=account.id,
        provider=account.provider,
        email=account.email,
        status=account.status,
        quota_used_bytes=account.quota_used_bytes,
        quota_total_bytes=account.quota_total_bytes,
        last_sync_at=_iso(account.last_sync_at),
        last_good_sync_at=_iso(account.last_good_sync_at),
        data_state=account.data_state,
    )


def list_accounts(db: Session) -> list[AccountResponse]:
    return [to_account_response(account) for account in accounts_repo.list_accounts(db)]


def latest_account_data_at(db: Session) -> str | None:
    return _iso(accounts_repo.latest_successful_sync_at(db))


def initiate_connect(
    db: Session,
    *,
    provider: str,
    settings: Settings | None = None,
) -> OAuthInitiateResponse:
    app_settings = settings or get_settings()
    raw_state = accounts_repo.create_oauth_state(
        db,
        provider=provider,
        mode="connect",
        account_id=None,
    )
    authorization_url = get_oauth_client(provider, app_settings).build_authorization_url(raw_state)
    return OAuthInitiateResponse(authorization_url=authorization_url, state=raw_state)


def initiate_reauthorize(
    db: Session,
    *,
    account_id: str,
    settings: Settings | None = None,
) -> OAuthInitiateResponse:
    app_settings = settings or get_settings()
    account = accounts_repo.get_account(db, account_id)
    raw_state = accounts_repo.create_oauth_state(
        db,
        provider=account.provider,
        mode="reauthorize",
        account_id=account.id,
    )
    authorization_url = get_oauth_client(account.provider, app_settings).build_authorization_url(raw_state)
    return OAuthInitiateResponse(authorization_url=authorization_url, state=raw_state)


def _queue_initial_load(
    db: Session,
    *,
    account: Account,
    background_tasks: BackgroundTasks | None,
) -> None:
    if background_tasks is None or account.data_state == "Lengkap":
        return

    previous_status = _fallback_previous_status(account)
    try:
        operation = ops_repo.create_operation(
            db,
            operation_type="refresh",
            context={
                "account_id": account.id,
                "provider": account.provider,
                "previous_status": previous_status,
                "previous_data_state": account.data_state,
                "triggered_by": "initial_load",
            },
            enforce_global_limit=False,
        )
    except OperationInProgressError:
        logger.info(
            "Initial load skipped because refresh is already running | account_id=%s",
            account.id,
        )
        return

    accounts_repo.set_account_status(
        db,
        account,
        status="syncing",
        last_sync_at=accounts_repo.utc_now(),
    )
    background_tasks.add_task(execute_refresh_operation, operation.id, account.id)


def handle_oauth_callback(
    db: Session,
    *,
    code: str | None,
    state: str | None,
    provider_error: str | None = None,
    settings: Settings | None = None,
    background_tasks: BackgroundTasks | None = None,
) -> str:
    app_settings = settings or get_settings()
    if provider_error:
        return _oauth_failure_redirect(app_settings, error="oauth_token_error")
    if not code or not state:
        return _oauth_failure_redirect(app_settings, error="invalid_state")

    try:
        state_context = accounts_repo.consume_oauth_state(db, state)
        oauth_client = get_oauth_client(state_context.provider, app_settings)
        token_bundle = oauth_client.exchange_code(code)
        pending_credentials = ProviderCredentials(
            account_id=state_context.account_id or "pending",
            access_token=token_bundle.access_token,
            refresh_token=token_bundle.refresh_token or "",
            access_token_expires_at=token_bundle.expires_at,
            scopes=token_bundle.scopes,
        )
        adapter = get_adapter(state_context.provider, pending_credentials, app_settings)
        account_info = adapter.get_account_info()

        existing_account_id = state_context.account_id if state_context.mode == "reauthorize" else None
        if existing_account_id is not None:
            existing = accounts_repo.get_account(db, existing_account_id)
            if existing.provider != state_context.provider:
                raise ValidationError(
                    "Provider akun tidak cocok",
                    details={
                        "oauth_error": "account_mismatch",
                        "provider": state_context.provider,
                    },
                )
            if existing.provider_account_id != account_info["provider_account_id"]:
                logger.warning(
                    "OAuth reauthorize account mismatch | account_id=%s | provider=%s",
                    existing.id,
                    existing.provider,
                )
                raise ValidationError(
                    "Akun provider yang dipilih berbeda dari akun existing",
                    details={
                        "oauth_error": "account_mismatch",
                        "provider": state_context.provider,
                    },
                )

        quota = adapter.get_quota()
        account = accounts_repo.upsert_account_tokens(
            db,
            provider=state_context.provider,
            provider_account_id=account_info["provider_account_id"],
            email=account_info["email"],
            token_bundle=token_bundle,
            quota_used_bytes=quota["used_bytes"],
            quota_total_bytes=quota["total_bytes"],
            existing_account_id=existing_account_id,
        )
        account_credentials = ProviderCredentials(
            account_id=account.id,
            access_token=token_bundle.access_token,
            refresh_token=token_bundle.refresh_token or decrypt_token(account.encrypted_refresh_token),
            access_token_expires_at=token_bundle.expires_at,
            scopes=token_bundle.scopes,
        )
        recent_files = get_adapter(account.provider, account_credentials, app_settings).fetch_recent(limit=10)
        deleted_files = accounts_repo.replace_files_if_partial(db, account=account, files=recent_files)
        if deleted_files:
            duplicates_repo.cleanup_duplicate_groups(db)
        if state_context.mode == "connect":
            _queue_initial_load(db, account=account, background_tasks=background_tasks)
        redirect_url = _frontend_redirect(
            app_settings,
            {
                "status": "connected",
                "provider": account.provider,
                "email": account.email,
            },
        )
        logger.info(
            "Account OAuth callback success | account_id=%s | provider=%s",
            account.id,
            account.provider,
        )
        return redirect_url
    except ValidationError as exc:
        oauth_error = exc.details.get("oauth_error", "invalid_state")
        provider = exc.details.get("provider")
        logger.warning("OAuth callback validation failed | error=%s", oauth_error)
        return _oauth_failure_redirect(app_settings, error=oauth_error, provider=provider)
    except ScopeInsufficientError as exc:
        logger.warning(
            "OAuth callback scope validation failed | provider=%s | operation=%s",
            exc.provider,
            exc.operation,
        )
        return _oauth_failure_redirect(
            app_settings,
            error="oauth_scope_error",
            provider=exc.provider,
        )
    except TokenInvalidError:
        logger.warning("OAuth callback token exchange failed")
        return _oauth_failure_redirect(app_settings, error="oauth_token_error")
    except AdapterError as exc:
        logger.warning(
            "OAuth callback provider operation failed | provider=%s | operation=%s",
            exc.provider,
            exc.operation,
        )
        return _oauth_failure_redirect(
            app_settings,
            error="oauth_callback_failed",
            provider=exc.provider,
        )
    except Exception:
        logger.exception("OAuth callback failed unexpectedly")
        return _oauth_failure_redirect(app_settings, error="oauth_callback_failed")


def _needs_refresh(account: Account) -> bool:
    expires_at = account.access_token_expires_at
    if expires_at is None:
        return False
    if expires_at.tzinfo is not None:
        expires_at = expires_at.astimezone(timezone.utc).replace(tzinfo=None)
    return expires_at <= datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=2)


def _credentials_for_account(
    db: Session,
    account: Account,
    *,
    settings: Settings,
) -> ProviderCredentials:
    refresh_token = decrypt_token(account.encrypted_refresh_token)
    access_token = decrypt_token(account.encrypted_access_token)
    scopes = json.loads(account.scopes) if account.scopes else []
    if _needs_refresh(account):
        token_bundle = get_oauth_client(account.provider, settings).refresh_access_token(refresh_token)
        account = accounts_repo.persist_refreshed_token(db, account, token_bundle)
        access_token = token_bundle.access_token
        if token_bundle.refresh_token:
            refresh_token = token_bundle.refresh_token
        scopes = token_bundle.scopes

    return ProviderCredentials(
        account_id=account.id,
        access_token=access_token,
        refresh_token=refresh_token,
        access_token_expires_at=account.access_token_expires_at,
        scopes=scopes,
    )


def trigger_refresh(
    db: Session,
    *,
    account_id: str,
    background_tasks: BackgroundTasks,
) -> RefreshOperationResponse:
    account = accounts_repo.get_account(db, account_id)
    if account.status in {"token_invalid", "revoked"}:
        raise TokenInvalidError(
            "Token akun tidak valid. Silakan otorisasi ulang.",
            provider=account.provider,
            account_id=account.id,
            operation="refresh",
        )
    previous_status = _fallback_previous_status(account)
    triggered_by = "initial_load" if account.status == "load_failed" else "single_refresh"
    operation = ops_repo.create_operation(
        db,
        operation_type="refresh",
        context={
            "account_id": account.id,
            "provider": account.provider,
            "previous_status": previous_status,
            "previous_data_state": account.data_state,
            "triggered_by": triggered_by,
        },
    )
    background_tasks.add_task(execute_refresh_operation, operation.id, account.id)
    return RefreshOperationResponse(
        operation_id=operation.id,
        operation_type="refresh",
        account_id=account.id,
        status=operation.status,
    )


def trigger_refresh_all(
    db: Session,
    *,
    background_tasks: BackgroundTasks,
) -> RefreshAllResponse:
    operations: list[RefreshAllItemResponse] = []
    for account in accounts_repo.list_refreshable_accounts(db):
        previous_status = _fallback_previous_status(account)
        try:
            operation = ops_repo.create_operation(
                db,
                operation_type="refresh",
                context={
                    "account_id": account.id,
                    "provider": account.provider,
                    "previous_status": previous_status,
                    "previous_data_state": account.data_state,
                    "triggered_by": "refresh_all",
                },
                enforce_global_limit=False,
            )
        except Exception as exc:
            logger.info(
                "Skipping refresh-all account | account_id=%s | reason=%s",
                account.id,
                exc.__class__.__name__,
            )
            continue
        background_tasks.add_task(execute_refresh_operation, operation.id, account.id)
        operations.append(
            RefreshAllItemResponse(
                account_id=account.id,
                operation_id=operation.id,
                operation_type="refresh",
                status=operation.status,
            )
        )
    return RefreshAllResponse(operations=operations)


def disconnect_account(db: Session, account_id: str) -> None:
    account = accounts_repo.get_account(db, account_id)
    accounts_repo.delete_account_cascade(db, account)
    duplicates_repo.cleanup_duplicate_groups(db)
    if not accounts_repo.list_accounts(db):
        scan_metadata_repo.delete_all_scan_metadata(db)
        db.commit()


def execute_refresh_operation(operation_id: str, account_id: str) -> None:
    settings = get_settings()
    db = SessionLocal()
    try:
        operation = ops_repo.get_operation(db, operation_id)
        context = ops_repo.load_context(operation)
        account = accounts_repo.get_account(db, account_id)
        previous_status = context.get("previous_status") or _fallback_previous_status(account)
        previous_data_state = context.get("previous_data_state") or account.data_state
        is_initial_load = _is_initial_load_context(
            context,
            account=account,
            previous_data_state=previous_data_state,
        )

        ops_repo.mark_running(db, operation, label="Mengambil metadata")
        now = accounts_repo.utc_now()
        accounts_repo.set_account_status(db, account, status="syncing", last_sync_at=now)

        try:
            credentials = _credentials_for_account(db, account, settings=settings)
            adapter = get_adapter(account.provider, credentials, settings)
            quota = adapter.get_quota()
            files = adapter.fetch_metadata()
            ops_repo.update_progress(
                db,
                operation,
                current=len(files),
                total=len(files),
                label="Menyimpan metadata",
            )
            deleted_files = accounts_repo.replace_files_for_account(db, account_id=account.id, files=files)
            if deleted_files:
                duplicates_repo.cleanup_duplicate_groups(db)
            accounts_repo.set_account_status(
                db,
                account,
                status="active",
                data_state="Lengkap",
                last_good_sync_at=accounts_repo.utc_now(),
                quota_used_bytes=quota["used_bytes"],
                quota_total_bytes=quota["total_bytes"],
            )
            ops_repo.mark_completed(db, operation)
        except TokenInvalidError:
            accounts_repo.set_account_status(
                db,
                account,
                status="load_failed" if is_initial_load else "token_invalid",
                data_state=previous_data_state if is_initial_load else None,
            )
            ops_repo.mark_failed(db, operation, "Token akun expired. Silakan otorisasi ulang.")
            logger.warning(
                "Refresh failed due to invalid token | account_id=%s | provider=%s",
                account.id,
                account.provider,
            )
        except AdapterError as exc:
            accounts_repo.set_account_status(
                db,
                account,
                status="load_failed" if is_initial_load else previous_status,
                data_state=previous_data_state,
            )
            ops_repo.mark_failed(db, operation, exc.message)
            logger.warning(
                "Refresh provider operation failed | account_id=%s | provider=%s | operation=%s",
                account.id,
                account.provider,
                exc.operation,
            )
        except Exception as exc:
            accounts_repo.set_account_status(
                db,
                account,
                status="load_failed" if is_initial_load else previous_status,
                data_state=previous_data_state,
            )
            ops_repo.mark_failed(db, operation, "Refresh metadata gagal")
            logger.exception(
                "Refresh operation failed | account_id=%s | operation_id=%s",
                account.id,
                operation_id,
            )
            raise exc
    except Exception:
        # BackgroundTasks cannot surface errors; callers poll the operation row.
        pass
    finally:
        db.close()
