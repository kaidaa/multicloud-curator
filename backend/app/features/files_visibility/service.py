"""Business logic for Files Visibility endpoints."""

from __future__ import annotations

import mimetypes
import re
from datetime import datetime, timezone
from pathlib import PurePosixPath

from sqlalchemy.orm import Session

from app.features.accounts.models import Account
from app.features.files_visibility import repository
from app.features.files_visibility.models import File
from app.features.files_visibility.schemas import (
    FileActivityItemResponse,
    QuotaAccountResponse,
    QuotaSummaryResponse,
    SearchSort,
    SearchTypeFilter,
)
from app.shared.exceptions import ValidationError

_TYPE_BY_MIME = {
    "application/pdf": "pdf",
    "application/json": "json",
    "application/msword": "doc",
    "application/vnd.ms-excel": "xls",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/vnd.google-apps.document": "document",
    "application/vnd.google-apps.spreadsheet": "spreadsheet",
    "application/vnd.google-apps.presentation": "presentation",
    "application/vnd.google-apps.drawing": "drawing",
    "application/vnd.google-apps.form": "form",
    "text/csv": "csv",
    "text/plain": "txt",
}

_EXTENSION_ALIASES = {
    "jpe": "jpg",
    "jpeg": "jpg",
    "htm": "html",
}

_MIME_CATEGORY_EXTENSIONS = {
    "photo": {"bmp", "gif", "heic", "jpeg", "jpg", "png", "svg", "tif", "tiff", "webp"},
    "video": {"avi", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "webm", "wmv"},
    "audio": {"aac", "flac", "m4a", "mp3", "ogg", "wav", "weba", "wma"},
    "document": {
        "csv",
        "doc",
        "docx",
        "html",
        "json",
        "md",
        "odp",
        "ods",
        "odt",
        "pdf",
        "ppt",
        "pptx",
        "rtf",
        "txt",
        "xls",
        "xlsx",
        "xml",
    },
}

_OPAQUE_GOOGLE_PATH_RE = re.compile(r"^[A-Za-z0-9_-]{16,}$")


def _iso(value: datetime | None) -> str:
    if value is None:
        value = datetime.now(timezone.utc)
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat().replace("+00:00", "Z")


def _extension_from_name(name: str) -> str | None:
    suffix = PurePosixPath(name).suffix.lower().lstrip(".")
    return suffix or None


def _extension_from_mime(mime_type: str | None) -> str | None:
    if not mime_type:
        return None
    normalized = mime_type.strip().lower()
    if not normalized:
        return None
    if normalized in _TYPE_BY_MIME:
        return _TYPE_BY_MIME[normalized]
    guessed = mimetypes.guess_extension(normalized, strict=False)
    if not guessed:
        return None
    extension = guessed.lower().lstrip(".")
    return _EXTENSION_ALIASES.get(extension, extension)


def derive_file_type(*, mime_type: str | None, name: str) -> str:
    return _extension_from_mime(mime_type) or _extension_from_name(name) or "unknown"


def is_opaque_provider_path(*, provider: str, path: str | None) -> bool:
    if provider != "google" or path is None:
        return False
    stripped = path.strip()
    return bool(
        stripped
        and "/" not in stripped
        and not any(character.isspace() for character in stripped)
        and _OPAQUE_GOOGLE_PATH_RE.fullmatch(stripped)
    )


def sanitize_display_path(*, provider: str, path: str | None) -> str | None:
    if path is None:
        return None
    if not path.strip():
        return None
    if is_opaque_provider_path(provider=provider, path=path):
        return None
    return path


def categorize_file_for_search(*, mime_type: str | None, name: str) -> str:
    normalized_mime = (mime_type or "").strip().lower()
    if normalized_mime.startswith("image/"):
        return "photo"
    if normalized_mime.startswith("video/"):
        return "video"
    if normalized_mime.startswith("audio/"):
        return "audio"
    if (
        normalized_mime == "application/pdf"
        or normalized_mime == "application/msword"
        or normalized_mime.startswith("application/vnd.openxmlformats-officedocument.")
        or normalized_mime.startswith("application/vnd.google-apps.")
        or normalized_mime.startswith("text/")
    ):
        return "document"

    extension = _extension_from_name(name)
    if extension is None:
        return "other"
    for category, extensions in _MIME_CATEGORY_EXTENSIONS.items():
        if extension in extensions:
            return category
    return "other"


def to_activity_item(file: File, *, account_email: str) -> FileActivityItemResponse:
    return FileActivityItemResponse(
        id=file.id,
        file_id=file.file_id,
        name=file.file_name,
        type=derive_file_type(mime_type=file.mime_type, name=file.file_name),
        mime_type=file.mime_type,
        size_bytes=file.size_bytes,
        modified_at=_iso(file.modified_time),
        account_id=file.account_id,
        account_email=account_email,
        provider=file.provider,
        is_owned=file.is_owned,
        path=sanitize_display_path(provider=file.provider, path=file.path),
        web_view_link=file.web_view_link,
    )


def list_activity(db: Session, *, limit: int) -> tuple[list[FileActivityItemResponse], str]:
    rows = repository.list_recent_activity_files(db, limit=limit)
    snapshot_at = repository.latest_file_snapshot_at(db)
    return [to_activity_item(row.file, account_email=row.account_email) for row in rows], _iso(
        snapshot_at
    )


def _sort_search_rows(
    rows: list[repository.ActivityFileRow],
    *,
    sort: SearchSort,
) -> list[repository.ActivityFileRow]:
    if sort == "name_asc":
        return sorted(rows, key=lambda row: (row.file.file_name.casefold(), row.file.id))
    if sort == "modified_asc":
        return sorted(rows, key=lambda row: (row.file.modified_time, row.file.id))
    rows_by_id = sorted(rows, key=lambda row: row.file.id)
    return sorted(rows_by_id, key=lambda row: row.file.modified_time, reverse=True)


def _row_matches_query(row: repository.ActivityFileRow, *, normalized_query: str) -> bool:
    query = normalized_query.casefold()
    if query in row.file.file_name.casefold():
        return True
    sanitized_path = sanitize_display_path(provider=row.file.provider, path=row.file.path)
    return sanitized_path is not None and query in sanitized_path.casefold()


def search_files(
    db: Session,
    *,
    query: str,
    owned_only: bool,
    provider: str,
    file_type: SearchTypeFilter,
    sort: SearchSort,
    limit: int,
    offset: int,
) -> tuple[list[FileActivityItemResponse], int, str]:
    normalized_query = query.strip()
    if len(normalized_query) < 2:
        raise ValidationError(
            "Query minimal 2 karakter",
            details={"field": "q", "min_length": 2},
        )

    rows = repository.list_search_candidate_files(
        db,
        query=normalized_query,
        owned_only=owned_only,
        provider=provider,
    )
    rows = [row for row in rows if _row_matches_query(row, normalized_query=normalized_query)]
    if file_type != "all":
        rows = [
            row
            for row in rows
            if categorize_file_for_search(
                mime_type=row.file.mime_type,
                name=row.file.file_name,
            )
            == file_type
        ]

    rows = _sort_search_rows(rows, sort=sort)
    total = len(rows)
    paginated_rows = rows[offset : offset + limit]
    snapshot_at = repository.latest_file_snapshot_at(db)
    return [
        to_activity_item(row.file, account_email=row.account_email) for row in paginated_rows
    ], total, _iso(snapshot_at)


def _to_quota_account(account: Account) -> QuotaAccountResponse:
    return QuotaAccountResponse(
        account_id=account.id,
        provider=account.provider,
        email=account.email,
        used_bytes=account.quota_used_bytes,
        total_bytes=account.quota_total_bytes,
    )


def get_quota_summary(db: Session) -> tuple[QuotaSummaryResponse, str]:
    accounts = repository.list_accounts_for_quota(db)
    per_account = [_to_quota_account(account) for account in accounts]
    data = QuotaSummaryResponse(
        total_used_bytes=sum(account.used_bytes for account in per_account),
        total_capacity_bytes=sum(account.total_bytes for account in per_account),
        per_account=per_account,
    )
    return data, _iso(repository.latest_account_snapshot_at(db))
