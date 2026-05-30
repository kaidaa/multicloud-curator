from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.adapters.base import ProviderCredentials
from app.adapters.factory import get_adapter, get_oauth_client
from app.config import Settings, get_settings
from app.database import SessionLocal
from app.features.accounts import repository as accounts_repo
from app.features.accounts.models import Account
from app.features.async_operations import repository as ops_repo
from app.features.files_visibility.models import File
from app.features.files_visibility.service import derive_file_type, sanitize_display_path
from app.features.scan_metadata import repository as scan_metadata_repo
from app.features.scan_metadata.schemas import ScanCoverageResponse
from app.features.security import repository
from app.features.security.schemas import (
    BatchRevokeFailureItem,
    BatchRevokeResponse,
    BatchRevokeSuccessItem,
    SecurityPublicFileResponse,
    SecurityScanResponse,
)
from app.shared.audit_log_model import ActionLog
from app.shared.encryption import decrypt_token
from app.shared.exceptions import (
    AdapterError,
    RateLimitError,
    ScopeInsufficientError,
    TokenInvalidError,
    ValidationError,
)
from app.shared.exceptions import (
    FileNotFoundError as ProviderFileNotFoundError,
)

logger = logging.getLogger(__name__)


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat().replace("+00:00", "Z")


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


def _strip_extension(file_name: str) -> str:
    if "." not in file_name:
        return file_name
    return file_name.rsplit(".", 1)[0]


def match_keywords(file_name: str, keyword_words: list[str]) -> list[str]:
    base_name = _strip_extension(file_name).casefold()
    return [word for word in keyword_words if word.casefold() in base_name]


def build_security_scan_results(
    candidates: list[repository.SecurityScanCandidate],
    keyword_words: list[str],
) -> list[repository.SecurityScanResultInput]:
    results = []
    for candidate in candidates:
        matched = match_keywords(candidate.file.file_name, keyword_words)
        results.append(
            repository.SecurityScanResultInput(
                file_id=candidate.file.id,
                is_sensitive=bool(matched),
                matched_keywords=matched,
            )
        )
    return results


def trigger_security_scan(
    db: Session,
    *,
    background_tasks: BackgroundTasks,
) -> SecurityScanResponse:
    operation = ops_repo.create_operation(
        db,
        operation_type="security_scan",
        context={"triggered_by": "security_scan"},
    )
    background_tasks.add_task(execute_security_scan, operation.id)
    return SecurityScanResponse(
        operation_id=operation.id,
        operation_type="security_scan",
        status=operation.status,
    )


def run_security_scan(
    db: Session,
    *,
    scanned_at: datetime,
) -> tuple[int, ScanCoverageResponse]:
    account_snapshot = scan_metadata_repo.snapshot_connected_accounts(
        accounts_repo.list_accounts(db)
    )
    candidates = repository.list_scan_candidates(
        db,
        account_ids=account_snapshot.active_account_ids,
    )
    keywords = repository.list_active_keywords(db)
    keyword_words = [keyword.word for keyword in keywords]
    coverage = scan_metadata_repo.coverage_from_active_accounts(account_snapshot)
    scan_results = build_security_scan_results(candidates, keyword_words)
    repository.replace_security_scan_results(
        db,
        results=scan_results,
        scanned_at=scanned_at,
        coverage=coverage,
    )
    return len(candidates), coverage


def execute_security_scan(operation_id: str) -> None:
    db = SessionLocal()
    try:
        operation = ops_repo.get_operation(db, operation_id)
        ops_repo.mark_running(db, operation, label="Membaca metadata publik lokal")
        ops_repo.update_progress(
            db,
            operation,
            current=0,
            total=0,
            label="Mendeteksi keyword sensitif",
        )
        candidates_count, _coverage = run_security_scan(db, scanned_at=ops_repo.utc_now())
        ops_repo.update_progress(
            db,
            operation,
            current=candidates_count,
            total=candidates_count,
            label="Scan keamanan selesai",
        )
        ops_repo.mark_completed(db, operation)
    except Exception as exc:
        logger.exception("Security scan failed | operation_id=%s", operation_id)
        try:
            operation = ops_repo.get_operation(db, operation_id)
            ops_repo.mark_failed(db, operation, str(exc))
        except Exception:
            logger.exception("Failed to mark security scan operation failed")
    finally:
        db.close()


def _parse_keywords(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return [str(item) for item in parsed]


def _deletability(file: File, account: Account) -> tuple[bool, str | None]:
    if not file.is_owned:
        return False, "File ini bukan milik Anda"
    if account.status != "active":
        return False, "Akun perlu otorisasi ulang sebelum akses publik bisa dicabut"
    return True, None


def _to_public_file_response(row: repository.SecurityPublicFileRow) -> SecurityPublicFileResponse:
    file = row.file
    account = row.account
    deletable, reason = _deletability(file, account)
    return SecurityPublicFileResponse(
        id=file.id,
        file_id=file.file_id,
        name=file.file_name,
        type=derive_file_type(mime_type=file.mime_type, name=file.file_name),
        mime_type=file.mime_type,
        size_bytes=file.size_bytes,
        modified_at=_iso(file.modified_time) or "",
        account_id=file.account_id,
        account_email=account.email,
        provider=file.provider,
        is_owned=file.is_owned,
        is_sensitive=row.scan_result.is_sensitive,
        matched_keywords=_parse_keywords(row.scan_result.matched_keywords),
        deletable=deletable,
        deletable_reason=reason,
        path=sanitize_display_path(provider=file.provider, path=file.path),
        location_type=file.location_type,
        open_url=file.open_url,
        open_url_type=file.open_url_type,
    )


def list_public_files(
    db: Session,
    *,
    mode: str,
    provider: str = "all",
) -> tuple[list[SecurityPublicFileResponse], str | None, ScanCoverageResponse | None]:
    rows = repository.list_public_file_rows(
        db,
        sensitive_only=mode == "sensitive",
        provider=provider,
    )
    return (
        [_to_public_file_response(row) for row in rows],
        _iso(repository.latest_security_scan_at(db)),
        repository.latest_security_scan_coverage(db),
    )


def _failure(file_id: str, error_code: str, message: str) -> BatchRevokeFailureItem:
    return BatchRevokeFailureItem(
        id=file_id,
        success=False,
        error_code=error_code,
        message=message,
    )


def batch_revoke_files(
    db: Session,
    *,
    ids: list[str],
    settings: Settings | None = None,
) -> BatchRevokeResponse:
    if not ids:
        raise ValidationError("ids tidak boleh kosong", details={"field": "ids"})
    if len(ids) > 100:
        raise ValidationError("Maksimum 100 file per batch", details={"field": "ids", "max": 100})

    app_settings = settings or get_settings()
    revoked: list[BatchRevokeSuccessItem] = []
    failed: list[BatchRevokeFailureItem] = []
    for file_id in ids:
        row = repository.get_file_with_account(db, file_id)
        if row is None:
            failed.append(_failure(file_id, "not_found", "File tidak ditemukan"))
            continue
        file = row.file
        account = row.account
        deletable, reason = _deletability(file, account)
        if not deletable:
            error_code = "not_owned" if not file.is_owned else "account_token_invalid"
            failed.append(_failure(file_id, error_code, reason or "Akses publik tidak dapat dicabut"))
            continue
        if file.sharing_status != "public":
            failed.append(_failure(file_id, "not_public", "File tidak berstatus publik"))
            continue
        try:
            credentials = _credentials_for_account(db, account, settings=app_settings)
            adapter = get_adapter(account.provider, credentials, app_settings)
            if not adapter.set_sharing_private(file.file_id):
                failed.append(_failure(file_id, "not_public", "File tidak lagi berstatus publik"))
                continue
            repository.mark_file_private_and_remove_scan_result(db, file)
            db.add(ActionLog(action="change_permission", file_id=file.id, account_id=account.id))
            db.commit()
            revoked.append(BatchRevokeSuccessItem(id=file_id, success=True))
        except TokenInvalidError:
            accounts_repo.set_account_status(db, account, status="token_invalid")
            failed.append(_failure(file_id, "account_token_invalid", "Token akun expired"))
        except ProviderFileNotFoundError:
            failed.append(_failure(file_id, "not_found", "File tidak ditemukan di provider"))
        except (ScopeInsufficientError, RateLimitError, AdapterError) as exc:
            failed.append(
                _failure(
                    file_id,
                    "provider_unavailable",
                    getattr(exc, "message", "Provider gagal mencabut akses publik"),
                )
            )
        except Exception:
            logger.exception("Batch revoke failed for file | file_id=%s", file_id)
            failed.append(_failure(file_id, "internal_error", "Akses publik gagal dicabut"))
    return BatchRevokeResponse(revoked=revoked, failed=failed)
