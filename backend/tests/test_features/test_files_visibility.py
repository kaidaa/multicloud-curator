from __future__ import annotations

import asyncio
from datetime import datetime

import pytest
from sqlalchemy.orm import Session

from app.adapters.base import ProviderCredentials
from app.adapters.google_drive import GoogleDriveAdapter
from app.config import Settings
from app.features.accounts.models import Account
from app.features.files_visibility.models import File
from app.features.files_visibility.routes import files_search as files_search_route
from app.features.files_visibility.service import (
    derive_file_type,
    get_quota_summary,
    is_opaque_provider_path,
    list_activity,
    sanitize_display_path,
    search_files,
)
from app.shared.exceptions import ValidationError


def _account(
    *,
    provider: str,
    email: str,
    provider_account_id: str,
    last_good_sync_at: datetime | None,
    quota_used_bytes: int = 0,
    quota_total_bytes: int = 0,
) -> Account:
    return Account(
        provider=provider,
        provider_account_id=provider_account_id,
        email=email,
        encrypted_access_token="encrypted-access",
        encrypted_refresh_token="encrypted-refresh",
        scopes="[]",
        status="active" if last_good_sync_at else "never_synced",
        data_state="Lengkap" if last_good_sync_at else "Parsial",
        quota_used_bytes=quota_used_bytes,
        quota_total_bytes=quota_total_bytes,
        last_good_sync_at=last_good_sync_at,
    )


def _file(
    *,
    account: Account,
    file_id: str,
    file_name: str,
    mime_type: str | None,
    modified_time: datetime,
    path: str | None = "/Work",
    web_view_link: str | None = "https://example.com/file",
    trashed: bool = False,
    is_folder: bool = False,
    is_owned: bool = True,
) -> File:
    return File(
        account_id=account.id,
        file_id=file_id,
        file_name=file_name,
        path=path,
        size_bytes=123,
        mime_type=mime_type,
        modified_time=modified_time,
        hash=None,
        owner_account=account.id,
        provider=account.provider,
        sharing_status="private",
        web_view_link=web_view_link,
        trashed=trashed,
        is_folder=is_folder,
        is_owned=is_owned,
        created_at=datetime(2026, 1, 1, 0, 0, 0),
        updated_at=datetime(2026, 1, 1, 0, 0, 0),
    )


def test_derive_file_type_prefers_mime_then_filename_then_unknown() -> None:
    assert (
        derive_file_type(
            mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            name="ambiguous.bin",
        )
        == "xlsx"
    )
    assert derive_file_type(mime_type=None, name="notes.md") == "md"
    assert derive_file_type(mime_type=None, name="README") == "unknown"


def test_google_adapter_does_not_normalize_parent_id_as_path() -> None:
    adapter = GoogleDriveAdapter(
        ProviderCredentials(
            account_id="account-1",
            access_token="access-token",
            refresh_token="refresh-token",
            access_token_expires_at=None,
            scopes=[],
        ),
        Settings(google_client_id="client-id", google_client_secret="client-secret"),
    )

    normalized = adapter._normalize_file(
        {
            "id": "google-file-1",
            "name": "Laporan.pdf",
            "mimeType": "application/pdf",
            "size": "123",
            "modifiedTime": "2026-01-01T00:00:00Z",
            "parents": ["153NlVneYpudNtXfGahWeAGNAoxp24unR"],
            "ownedByMe": True,
            "trashed": False,
            "webViewLink": "https://drive.google.com/file/d/google-file-1/view",
            "permissions": [],
        }
    )

    assert normalized["path"] is None


def test_display_path_sanitizes_legacy_google_opaque_id_only() -> None:
    opaque_path = "153NlVneYpudNtXfGahWeAGNAoxp24unR"

    assert is_opaque_provider_path(provider="google", path=opaque_path) is True
    assert sanitize_display_path(provider="google", path=opaque_path) is None
    assert sanitize_display_path(provider="google", path="Laporan") == "Laporan"
    assert sanitize_display_path(provider="google", path="/Finance/Laporan") == "/Finance/Laporan"
    assert sanitize_display_path(provider="dropbox", path=opaque_path) == opaque_path


def test_visibility_handles_empty_database(db_session: Session) -> None:
    activity, activity_snapshot = list_activity(db_session, limit=10)
    quota, quota_snapshot = get_quota_summary(db_session)

    assert activity == []
    assert activity_snapshot.endswith("Z")
    assert quota.total_used_bytes == 0
    assert quota.total_capacity_bytes == 0
    assert quota.per_account == []
    assert quota_snapshot.endswith("Z")


def test_search_route_returns_envelope_and_pagination(db_session: Session) -> None:
    account = _account(
        provider="google",
        provider_account_id="google-search-1",
        email="kai@example.com",
        last_good_sync_at=datetime(2026, 1, 1, 0, 0, 0),
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    db_session.add(
        _file(
            account=account,
            file_id="laporan-q1",
            file_name="Laporan Q1.pdf",
            mime_type="application/pdf",
            modified_time=datetime(2026, 1, 1, 0, 0, 0),
        )
    )
    db_session.commit()

    response = asyncio.run(
        files_search_route(
            q="laporan",
            owned_only=False,
            provider="all",
            file_type="all",
            sort="modified_desc",
            limit=10,
            offset=0,
            db=db_session,
        )
    )

    assert response.data[0].file_id == "laporan-q1"
    assert response.meta is not None
    assert response.meta.pagination == {"limit": 10, "offset": 0, "total": 1}


def test_search_matches_filename_and_path_case_insensitive(db_session: Session) -> None:
    account = _account(
        provider="google",
        provider_account_id="google-search-2",
        email="kai@example.com",
        last_good_sync_at=datetime(2026, 1, 1, 0, 0, 0),
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    db_session.add_all(
        [
            _file(
                account=account,
                file_id="filename-match",
                file_name="Budget Final.xlsx",
                mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                modified_time=datetime(2026, 1, 1, 0, 0, 0),
                path=None,
            ),
            _file(
                account=account,
                file_id="path-match",
                file_name="notes.txt",
                mime_type="text/plain",
                modified_time=datetime(2026, 1, 2, 0, 0, 0),
                path="/Finance/Budget",
            ),
        ]
    )
    db_session.commit()

    data, total, _snapshot_at = search_files(
        db_session,
        query=" BUDGET ",
        owned_only=False,
        provider="all",
        file_type="all",
        sort="name_asc",
        limit=10,
        offset=0,
    )

    assert total == 2
    assert [item.file_id for item in data] == ["filename-match", "path-match"]


def test_search_ignores_opaque_provider_id_paths_but_keeps_readable_paths(
    db_session: Session,
) -> None:
    account = _account(
        provider="google",
        provider_account_id="google-search-path",
        email="kai@example.com",
        last_good_sync_at=datetime(2026, 1, 1, 0, 0, 0),
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    db_session.add_all(
        [
            _file(
                account=account,
                file_id="opaque-path",
                file_name="Minutes.txt",
                mime_type="text/plain",
                modified_time=datetime(2026, 1, 1, 0, 0, 0),
                path="153NlVneYpudNtXfGahWeAGNAoxp24unR",
            ),
            _file(
                account=account,
                file_id="readable-path",
                file_name="Notes.txt",
                mime_type="text/plain",
                modified_time=datetime(2026, 1, 2, 0, 0, 0),
                path="/Personal/June",
            ),
        ]
    )
    db_session.commit()

    data, total, _snapshot_at = search_files(
        db_session,
        query="un",
        owned_only=False,
        provider="all",
        file_type="all",
        sort="modified_desc",
        limit=10,
        offset=0,
    )

    assert total == 1
    assert [item.file_id for item in data] == ["readable-path"]


def test_search_filename_match_hides_legacy_google_opaque_path(
    db_session: Session,
) -> None:
    account = _account(
        provider="google",
        provider_account_id="google-search-legacy-path",
        email="kai@example.com",
        last_good_sync_at=datetime(2026, 1, 1, 0, 0, 0),
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    db_session.add(
        _file(
            account=account,
            file_id="legacy-google-path",
            file_name="Laporan Lama.pdf",
            mime_type="application/pdf",
            modified_time=datetime(2026, 1, 1, 0, 0, 0),
            path="153NlVneYpudNtXfGahWeAGNAoxp24unR",
        )
    )
    db_session.commit()

    data, total, _snapshot_at = search_files(
        db_session,
        query="laporan",
        owned_only=False,
        provider="all",
        file_type="all",
        sort="modified_desc",
        limit=10,
        offset=0,
    )

    assert total == 1
    assert data[0].file_id == "legacy-google-path"
    assert data[0].path is None


def test_search_filters_provider_ownership_type_and_excludes_ineligible_rows(
    db_session: Session,
) -> None:
    google = _account(
        provider="google",
        provider_account_id="google-search-3",
        email="google@example.com",
        last_good_sync_at=datetime(2026, 1, 1, 0, 0, 0),
    )
    dropbox = _account(
        provider="dropbox",
        provider_account_id="dropbox-search-3",
        email="dropbox@example.com",
        last_good_sync_at=datetime(2026, 1, 1, 0, 0, 0),
    )
    never_synced = _account(
        provider="google",
        provider_account_id="google-search-partial",
        email="partial@example.com",
        last_good_sync_at=None,
    )
    db_session.add_all([google, dropbox, never_synced])
    db_session.commit()
    db_session.refresh(google)
    db_session.refresh(dropbox)
    db_session.refresh(never_synced)
    db_session.add_all(
        [
            _file(
                account=google,
                file_id="google-doc",
                file_name="Project Plan.pdf",
                mime_type="application/pdf",
                modified_time=datetime(2026, 1, 1, 0, 0, 0),
            ),
            _file(
                account=dropbox,
                file_id="dropbox-photo",
                file_name="Project Photo.raw",
                mime_type="image/jpeg",
                modified_time=datetime(2026, 1, 2, 0, 0, 0),
                is_owned=False,
            ),
            _file(
                account=dropbox,
                file_id="dropbox-other",
                file_name="Project Archive.custom",
                mime_type=None,
                modified_time=datetime(2026, 1, 3, 0, 0, 0),
            ),
            _file(
                account=google,
                file_id="trashed-project",
                file_name="Project Trashed.pdf",
                mime_type="application/pdf",
                modified_time=datetime(2026, 1, 4, 0, 0, 0),
                trashed=True,
            ),
            _file(
                account=google,
                file_id="folder-project",
                file_name="Project Folder",
                mime_type=None,
                modified_time=datetime(2026, 1, 5, 0, 0, 0),
                is_folder=True,
            ),
            _file(
                account=never_synced,
                file_id="partial-project",
                file_name="Project Partial.pdf",
                mime_type="application/pdf",
                modified_time=datetime(2026, 1, 6, 0, 0, 0),
            ),
        ]
    )
    db_session.commit()

    google_data, google_total, _ = search_files(
        db_session,
        query="project",
        owned_only=False,
        provider="google",
        file_type="all",
        sort="modified_desc",
        limit=10,
        offset=0,
    )
    owned_data, owned_total, _ = search_files(
        db_session,
        query="project",
        owned_only=True,
        provider="all",
        file_type="all",
        sort="modified_desc",
        limit=10,
        offset=0,
    )
    photo_data, photo_total, _ = search_files(
        db_session,
        query="project",
        owned_only=False,
        provider="all",
        file_type="photo",
        sort="modified_desc",
        limit=10,
        offset=0,
    )
    other_data, other_total, _ = search_files(
        db_session,
        query="project",
        owned_only=False,
        provider="all",
        file_type="other",
        sort="modified_desc",
        limit=10,
        offset=0,
    )

    assert google_total == 1
    assert [item.file_id for item in google_data] == ["google-doc"]
    assert owned_total == 2
    assert {item.file_id for item in owned_data} == {"google-doc", "dropbox-other"}
    assert photo_total == 1
    assert [item.file_id for item in photo_data] == ["dropbox-photo"]
    assert other_total == 1
    assert [item.file_id for item in other_data] == ["dropbox-other"]


def test_search_sort_and_pagination(db_session: Session) -> None:
    account = _account(
        provider="google",
        provider_account_id="google-search-4",
        email="kai@example.com",
        last_good_sync_at=datetime(2026, 1, 1, 0, 0, 0),
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    db_session.add_all(
        [
            _file(
                account=account,
                file_id="b-file",
                file_name="Beta Report.pdf",
                mime_type="application/pdf",
                modified_time=datetime(2026, 1, 3, 0, 0, 0),
            ),
            _file(
                account=account,
                file_id="a-file",
                file_name="Alpha Report.pdf",
                mime_type="application/pdf",
                modified_time=datetime(2026, 1, 1, 0, 0, 0),
            ),
            _file(
                account=account,
                file_id="c-file",
                file_name="Charlie Report.pdf",
                mime_type="application/pdf",
                modified_time=datetime(2026, 1, 2, 0, 0, 0),
            ),
        ]
    )
    db_session.commit()

    by_name, total, _ = search_files(
        db_session,
        query="report",
        owned_only=False,
        provider="all",
        file_type="all",
        sort="name_asc",
        limit=1,
        offset=1,
    )
    modified_asc, _total, _ = search_files(
        db_session,
        query="report",
        owned_only=False,
        provider="all",
        file_type="all",
        sort="modified_asc",
        limit=10,
        offset=0,
    )
    modified_desc, _total, _ = search_files(
        db_session,
        query="report",
        owned_only=False,
        provider="all",
        file_type="all",
        sort="modified_desc",
        limit=10,
        offset=0,
    )

    assert total == 3
    assert [item.file_id for item in by_name] == ["b-file"]
    assert [item.file_id for item in modified_asc] == ["a-file", "c-file", "b-file"]
    assert [item.file_id for item in modified_desc] == ["b-file", "c-file", "a-file"]


def test_search_rejects_trimmed_query_shorter_than_two_characters(
    db_session: Session,
) -> None:
    with pytest.raises(ValidationError):
        search_files(
            db_session,
            query=" a ",
            owned_only=False,
            provider="all",
            file_type="all",
            sort="modified_desc",
            limit=10,
            offset=0,
        )


def test_activity_reads_refreshed_files_from_db_and_maps_contract_fields(
    db_session: Session,
) -> None:
    active = _account(
        provider="google",
        provider_account_id="google-1",
        email="kai@example.com",
        last_good_sync_at=datetime(2026, 1, 1, 0, 0, 0),
    )
    never_synced = _account(
        provider="dropbox",
        provider_account_id="dropbox-1",
        email="partial@example.com",
        last_good_sync_at=None,
    )
    db_session.add_all([active, never_synced])
    db_session.commit()
    db_session.refresh(active)
    db_session.refresh(never_synced)
    db_session.add_all(
        [
            _file(
                account=active,
                file_id="old-file",
                file_name="Old.pdf",
                mime_type="application/pdf",
                modified_time=datetime(2026, 1, 1, 0, 0, 0),
            ),
            _file(
                account=active,
                file_id="new-file",
                file_name="New.bin",
                mime_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                modified_time=datetime(2026, 1, 2, 0, 0, 0),
                web_view_link=None,
            ),
            _file(
                account=active,
                file_id="trashed-file",
                file_name="Trashed.pdf",
                mime_type="application/pdf",
                modified_time=datetime(2026, 1, 3, 0, 0, 0),
                trashed=True,
            ),
            _file(
                account=active,
                file_id="folder",
                file_name="Folder",
                mime_type=None,
                modified_time=datetime(2026, 1, 4, 0, 0, 0),
                is_folder=True,
            ),
            _file(
                account=never_synced,
                file_id="partial-file",
                file_name="Partial.pdf",
                mime_type="application/pdf",
                modified_time=datetime(2026, 1, 5, 0, 0, 0),
            ),
        ]
    )
    db_session.commit()

    data, snapshot_at = list_activity(db_session, limit=10)

    assert [item.file_id for item in data] == ["new-file", "old-file"]
    assert data[0].id
    assert data[0].name == "New.bin"
    assert data[0].type == "xlsx"
    assert data[0].account_id == active.id
    assert data[0].account_email == "kai@example.com"
    assert data[0].web_view_link is None
    assert "encrypted_access_token" not in data[0].model_dump()
    assert snapshot_at.endswith("Z")


def test_quota_summary_aggregates_connected_accounts(db_session: Session) -> None:
    db_session.add_all(
        [
            _account(
                provider="google",
                provider_account_id="google-1",
                email="kai@example.com",
                last_good_sync_at=datetime(2026, 1, 1, 0, 0, 0),
                quota_used_bytes=10,
                quota_total_bytes=100,
            ),
            _account(
                provider="dropbox",
                provider_account_id="dropbox-1",
                email="kai@example.com",
                last_good_sync_at=datetime(2026, 1, 1, 0, 0, 0),
                quota_used_bytes=20,
                quota_total_bytes=200,
            ),
        ]
    )
    db_session.commit()

    data, snapshot_at = get_quota_summary(db_session)

    assert data.total_used_bytes == 30
    assert data.total_capacity_bytes == 300
    assert [account.provider for account in data.per_account] == ["dropbox", "google"]
    assert snapshot_at.endswith("Z")
