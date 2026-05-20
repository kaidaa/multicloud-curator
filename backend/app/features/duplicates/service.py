"""Business logic for duplicate detection and batch delete."""

from __future__ import annotations

import json
import logging
import re
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
from app.features.duplicates import repository
from app.features.duplicates.schemas import (
    BatchDeleteFailureItem,
    BatchDeleteResponse,
    BatchDeleteSuccessItem,
    DuplicateGroupResponse,
    DuplicateMemberResponse,
    DuplicatesScanResponse,
    DuplicateTypeFilter,
)
from app.features.files_visibility.models import File
from app.features.files_visibility.service import (
    categorize_file_for_search,
    derive_file_type,
    sanitize_display_path,
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


def normalize_duplicate_name(name: str) -> str:
    if "." in name:
        base, extension = name.rsplit(".", 1)
        suffix = f".{extension.casefold()}"
    else:
        base = name
        suffix = ""
    normalized = re.sub(r"\s*\(\d+\)\s*$", "", base)
    normalized = re.sub(r"\s*-\s*copy\s*$", "", normalized, flags=re.IGNORECASE)
    return f"{normalized.strip().casefold()}{suffix}"


def _row_identity(file: File) -> str:
    return file.id or f"transient:{id(file)}"


def _stable_file_key(file: File) -> str:
    return file.id or f"{file.provider}:{file.account_id}:{file.file_id}:{file.file_name.casefold()}"


def _canonical_sort_key(
    file: File,
    account_status_by_file_id: dict[str, str] | None,
) -> tuple[bool, bool, str]:
    status = account_status_by_file_id.get(file.id) if account_status_by_file_id and file.id else None
    return (
        not file.is_owned,
        status != "active",
        _stable_file_key(file),
    )


def canonicalize_physical_files(
    files: list[File],
    *,
    account_status_by_file_id: dict[str, str] | None = None,
) -> list[File]:
    physical_files: dict[tuple[str, str], list[File]] = {}
    for file in files:
        physical_files.setdefault((file.provider, file.file_id), []).append(file)
    return sorted(
        (
            sorted(
                members,
                key=lambda item: _canonical_sort_key(item, account_status_by_file_id),
            )[0]
            for members in physical_files.values()
        ),
        key=_stable_file_key,
    )


def _qualifies(members: list[File]) -> bool:
    return len(members) >= 2 and any(file.is_owned for file in members)


def _hash_groups(files: list[File]) -> list[tuple[str, list[File]]]:
    groups: dict[tuple[str, str], list[File]] = {}
    for file in files:
        if not file.hash:
            continue
        groups.setdefault((file.provider, file.hash), []).append(file)
    return [
        ("hash", sorted(members, key=_stable_file_key))
        for members in groups.values()
        if _qualifies(members)
    ]


def _name_size_groups(files: list[File], grouped_rows: set[str]) -> list[tuple[str, list[File]]]:
    groups: dict[tuple[str, int], list[File]] = {}
    for file in files:
        if _row_identity(file) in grouped_rows or not file.size_bytes or file.size_bytes <= 0:
            continue
        key = (normalize_duplicate_name(file.file_name), file.size_bytes)
        groups.setdefault(key, []).append(file)
    return [
        ("name_size", sorted(members, key=_stable_file_key))
        for members in groups.values()
        if _qualifies(members)
    ]


def build_duplicate_groups(
    files: list[File],
    *,
    account_status_by_file_id: dict[str, str] | None = None,
) -> list[tuple[str, list[File]]]:
    canonical_files = canonicalize_physical_files(
        files,
        account_status_by_file_id=account_status_by_file_id,
    )
    hash_groups = _hash_groups(canonical_files)
    grouped_rows = {_row_identity(file) for _basis, members in hash_groups for file in members}
    name_size_groups = _name_size_groups(canonical_files, grouped_rows)
    return sorted(
        [*hash_groups, *name_size_groups],
        key=lambda item: (-sum(file.size_bytes or 0 for file in item[1]), item[0], _stable_file_key(item[1][0])),
    )


def trigger_duplicates_scan(
    db: Session,
    *,
    background_tasks: BackgroundTasks,
) -> DuplicatesScanResponse:
    operation = ops_repo.create_operation(
        db,
        operation_type="duplicates_scan",
        context={"triggered_by": "duplicates_scan"},
    )
    background_tasks.add_task(execute_duplicates_scan, operation.id)
    return DuplicatesScanResponse(
        operation_id=operation.id,
        operation_type="duplicates_scan",
        status=operation.status,
    )


def execute_duplicates_scan(operation_id: str) -> None:
    db = SessionLocal()
    try:
        operation = ops_repo.get_operation(db, operation_id)
        ops_repo.mark_running(db, operation, label="Membaca metadata lokal")
        rows = repository.list_file_rows_for_scan(db)
        files = [row.file for row in rows]
        account_status_by_file_id = {row.file.id: row.account.status for row in rows}
        ops_repo.update_progress(
            db,
            operation,
            current=0,
            total=len(files),
            label="Mendeteksi duplikasi",
        )
        groups = build_duplicate_groups(files, account_status_by_file_id=account_status_by_file_id)
        repository.replace_duplicate_groups(
            db,
            groups=groups,
            scanned_at=ops_repo.utc_now(),
        )
        ops_repo.update_progress(
            db,
            operation,
            current=len(files),
            total=len(files),
            label="Scan duplikasi selesai",
        )
        ops_repo.mark_completed(db, operation)
    except Exception as exc:
        logger.exception("Duplicates scan failed | operation_id=%s", operation_id)
        try:
            operation = ops_repo.get_operation(db, operation_id)
            ops_repo.mark_failed(db, operation, str(exc))
        except Exception:
            logger.exception("Failed to mark duplicates scan operation failed")
    finally:
        db.close()


def _member_deletability(file: File, account: Account) -> tuple[bool, str | None]:
    if not file.is_owned:
        return False, "File ini bukan milik Anda"
    if account.status != "active":
        return False, "Akun perlu otorisasi ulang sebelum file bisa dihapus"
    return True, None


def _to_member_response(row: repository.FileWithAccount) -> DuplicateMemberResponse:
    file = row.file
    account = row.account
    deletable, reason = _member_deletability(file, account)
    return DuplicateMemberResponse(
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
        deletable=deletable,
        deletable_reason=reason,
        path=sanitize_display_path(provider=file.provider, path=file.path),
        web_view_link=file.web_view_link,
    )


def _group_matches_type(group: repository.DuplicateGroupWithMembers, file_type: str) -> bool:
    if file_type == "all":
        return True
    return any(
        categorize_file_for_search(mime_type=row.file.mime_type, name=row.file.file_name) == file_type
        for row in group.members
    )


def list_duplicate_groups(
    db: Session,
    *,
    file_type: DuplicateTypeFilter,
    limit: int,
    offset: int,
) -> tuple[list[DuplicateGroupResponse], int, str | None]:
    groups = [
        group for group in repository.list_duplicate_groups(db) if _group_matches_type(group, file_type)
    ]
    total = len(groups)
    paginated = groups[offset : offset + limit]
    data = [
        DuplicateGroupResponse(
            id=item.group.id,
            representative_name=item.group.representative_name,
            members_count=len(item.members),
            total_size_bytes=sum(member.file.size_bytes or 0 for member in item.members),
            match_basis=item.group.match_basis,
            members=[_to_member_response(member) for member in item.members],
        )
        for item in paginated
    ]
    return data, total, _iso(repository.latest_scan_at(db))


def _failure(file_id: str, error_code: str, message: str) -> BatchDeleteFailureItem:
    return BatchDeleteFailureItem(
        id=file_id,
        success=False,
        error_code=error_code,
        message=message,
    )


def batch_delete_files(
    db: Session,
    *,
    ids: list[str],
    settings: Settings | None = None,
) -> BatchDeleteResponse:
    if not ids:
        raise ValidationError("ids tidak boleh kosong", details={"field": "ids"})
    if len(ids) > 100:
        raise ValidationError("Maksimum 100 file per batch", details={"field": "ids", "max": 100})

    app_settings = settings or get_settings()
    deleted: list[BatchDeleteSuccessItem] = []
    failed: list[BatchDeleteFailureItem] = []
    for file_id in ids:
        row = repository.get_file_with_account(db, file_id)
        if row is None:
            failed.append(_failure(file_id, "not_found", "File tidak ditemukan"))
            continue
        file = row.file
        account = row.account
        deletable, reason = _member_deletability(file, account)
        if not deletable:
            error_code = "not_owned" if not file.is_owned else "account_token_invalid"
            failed.append(_failure(file_id, error_code, reason or "File tidak dapat dihapus"))
            continue
        try:
            credentials = _credentials_for_account(db, account, settings=app_settings)
            adapter = get_adapter(account.provider, credentials, app_settings)
            adapter.delete_file(file.file_id)
            db.add(ActionLog(action="delete", file_id=file.id, account_id=account.id))
            repository.delete_file_row(db, file)
            deleted.append(BatchDeleteSuccessItem(id=file_id, success=True))
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
                    getattr(exc, "message", "Provider gagal memproses file"),
                )
            )
        except Exception:
            logger.exception("Batch delete failed for file | file_id=%s", file_id)
            failed.append(_failure(file_id, "internal_error", "File gagal dihapus"))
    if deleted:
        repository.cleanup_duplicate_groups(db)
    return BatchDeleteResponse(deleted=deleted, failed=failed)
