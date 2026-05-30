from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.features.accounts import service as accounts_service
from app.features.accounts.models import Account
from app.features.duplicates import service as duplicates_service
from app.features.duplicates.service import batch_delete_files
from app.features.files_visibility.models import File
from app.features.large_stale import repository as large_stale_repo
from app.features.large_stale.service import (
    _sort_rows,
    _to_response,
    evaluate_file,
    list_large_stale_files,
    run_large_stale_scan,
)
from app.features.scan_metadata.models import ScanMetadata
from app.shared.encryption import encrypt_token

NOW = datetime(2026, 5, 17, 0, 0, 0, tzinfo=timezone.utc)
RECENT = datetime(2026, 5, 1, 0, 0, 0)
OLD = datetime(2024, 1, 1, 0, 0, 0)


def _account(
    *,
    provider: str = "google",
    email: str = "user@example.com",
    provider_account_id: str = "provider-account",
    status: str = "active",
    quota_total_bytes: int | None = 10_000,
    last_good_sync_at: datetime | None = datetime(2026, 1, 1, 0, 0, 0),
) -> Account:
    return Account(
        provider=provider,
        provider_account_id=provider_account_id,
        email=email,
        encrypted_access_token=encrypt_token("access-token"),
        encrypted_refresh_token=encrypt_token("refresh-token"),
        scopes="[]",
        status=status,
        data_state="Lengkap",
        quota_used_bytes=0,
        quota_total_bytes=quota_total_bytes,
        last_good_sync_at=last_good_sync_at,
    )


def _file(
    *,
    account: Account,
    file_id: str,
    file_name: str,
    size_bytes: int | None,
    modified_time: datetime | None,
    mime_type: str = "application/pdf",
    is_owned: bool = True,
    trashed: bool = False,
    is_folder: bool = False,
) -> File:
    return File(
        account_id=account.id,
        file_id=file_id,
        file_name=file_name,
        path="/Work",
        size_bytes=size_bytes,
        mime_type=mime_type,
        modified_time=modified_time,
        hash=None,
        owner_account=account.id,
        provider=account.provider,
        sharing_status="private",
        location_type="MY_DRIVE" if account.provider == "google" else None,
        open_url="https://example.com/file",
        open_url_type="google_web_view"
        if account.provider == "google"
        else "dropbox_private_quickview",
        has_public_shared_link=False,
        shared_link_url=None,
        shared_link_visibility=None,
        trashed=trashed,
        is_folder=is_folder,
        is_owned=is_owned,
        created_at=datetime(2026, 1, 1, 0, 0, 0),
        updated_at=datetime(2026, 1, 1, 0, 0, 0),
    )


def _persist_account(db_session: Session, account: Account) -> Account:
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    return account


def test_large_stale_filters_owned_large_stale_and_normal_files(db_session: Session) -> None:
    account = _persist_account(db_session, _account())
    large_only = _file(
        account=account,
        file_id="large",
        file_name="Large.pdf",
        size_bytes=100,
        modified_time=RECENT,
    )
    stale_only = _file(
        account=account,
        file_id="stale",
        file_name="Stale.pdf",
        size_bytes=10,
        modified_time=OLD,
    )
    both = _file(
        account=account,
        file_id="both",
        file_name="Both.pdf",
        size_bytes=100,
        modified_time=OLD,
    )
    normal = _file(
        account=account,
        file_id="normal",
        file_name="Normal.pdf",
        size_bytes=10,
        modified_time=RECENT,
    )
    shared = _file(
        account=account,
        file_id="shared",
        file_name="Shared.pdf",
        size_bytes=100,
        modified_time=OLD,
        is_owned=False,
    )
    db_session.add_all([large_only, stale_only, both, normal, shared])
    db_session.commit()
    run_large_stale_scan(
        db_session,
        scanned_at=datetime(2026, 1, 2, 0, 0, 0),
        now=NOW,
    )

    data, total, _snapshot_at, coverage = list_large_stale_files(
        db_session,
        file_type="all",
        sort="size_desc",
        limit=50,
        offset=0,
        now=NOW,
    )

    reasons = {item.file_id: item.trigger_reason for item in data}
    assert total == 3
    assert _snapshot_at == "2026-01-02T00:00:00Z"
    assert coverage is not None
    assert coverage.covered_account_ids == [account.id]
    assert coverage.covered_account_count == 1
    assert coverage.eligible_account_count == 1
    assert reasons == {"large": "large", "stale": "stale", "both": "both"}
    assert "normal" not in reasons
    assert "shared" not in reasons
    assert all(item.is_owned for item in data)
    assert all(item.deletable for item in data)


def test_quota_zero_or_null_does_not_classify_large() -> None:
    account_zero = _account(quota_total_bytes=0)
    account_null = _account(provider_account_id="null-quota", quota_total_bytes=None)
    large_file = _file(
        account=account_zero,
        file_id="large",
        file_name="Large.pdf",
        size_bytes=10_000,
        modified_time=RECENT,
    )
    null_quota_file = _file(
        account=account_null,
        file_id="null-quota-large",
        file_name="Null Quota Large.pdf",
        size_bytes=10_000,
        modified_time=RECENT,
    )

    assert evaluate_file(large_file, account_zero, now=NOW).trigger_reason is None
    assert evaluate_file(null_quota_file, account_null, now=NOW).trigger_reason is None


def test_modified_time_null_is_not_stale_and_sorts_behind_when_large() -> None:
    account = _account()
    account.id = "account-id"
    null_modified = _file(
        account=account,
        file_id="null-modified",
        file_name="Null Modified.pdf",
        size_bytes=100,
        modified_time=RECENT,
    )
    null_modified.id = "b-null-modified"
    null_modified.modified_time = None
    old_file = _file(
        account=account,
        file_id="old",
        file_name="Old.pdf",
        size_bytes=100,
        modified_time=OLD,
    )
    old_file.id = "a-old"

    null_evaluation = evaluate_file(null_modified, account, now=NOW)
    old_evaluation = evaluate_file(old_file, account, now=NOW)
    assert null_evaluation.trigger_reason == "large"
    assert null_evaluation.is_stale is False

    rows = [
        (large_stale_repo.LargeStaleCandidateRow(file=null_modified, account=account), null_evaluation),
        (large_stale_repo.LargeStaleCandidateRow(file=old_file, account=account), old_evaluation),
    ]
    asc = _sort_rows(rows, sort="modified_asc")
    desc = _sort_rows(rows, sort="modified_desc")
    response = _to_response(
        large_stale_repo.LargeStaleCandidateRow(file=null_modified, account=account),
        evaluation=null_evaluation,
    )

    assert [item[0].file.file_id for item in asc] == ["old", "null-modified"]
    assert [item[0].file.file_id for item in desc] == ["old", "null-modified"]
    assert response.modified_at is None


def test_type_filter_sort_and_pagination(db_session: Session) -> None:
    account = _persist_account(db_session, _account())
    photo = _file(
        account=account,
        file_id="photo",
        file_name="Photo.jpg",
        size_bytes=120,
        modified_time=RECENT,
        mime_type="image/jpeg",
    )
    document_a = _file(
        account=account,
        file_id="doc-a",
        file_name="A.pdf",
        size_bytes=90,
        modified_time=OLD,
        mime_type="application/pdf",
    )
    document_b = _file(
        account=account,
        file_id="doc-b",
        file_name="B.pdf",
        size_bytes=70,
        modified_time=OLD,
        mime_type="application/pdf",
    )
    db_session.add_all([photo, document_a, document_b])
    db_session.commit()
    run_large_stale_scan(
        db_session,
        scanned_at=datetime(2026, 1, 2, 0, 0, 0),
        now=NOW,
    )

    photos, photo_total, _snapshot_at, _coverage = list_large_stale_files(
        db_session,
        file_type="photo",
        sort="size_desc",
        limit=50,
        offset=0,
        now=NOW,
    )
    size_asc, total, _snapshot_at, _coverage = list_large_stale_files(
        db_session,
        file_type="all",
        sort="size_asc",
        limit=2,
        offset=1,
        now=NOW,
    )

    assert photo_total == 1
    assert photos[0].file_id == "photo"
    assert total == 3
    assert [item.file_id for item in size_asc] == ["doc-a", "photo"]


def test_category_filter_includes_overlapping_large_and_stale_results(
    db_session: Session,
) -> None:
    account = _persist_account(db_session, _account())
    large_only = _file(
        account=account,
        file_id="large-only",
        file_name="Large.pdf",
        size_bytes=100,
        modified_time=RECENT,
    )
    stale_only = _file(
        account=account,
        file_id="stale-only",
        file_name="Stale.pdf",
        size_bytes=10,
        modified_time=OLD,
    )
    both = _file(
        account=account,
        file_id="both",
        file_name="Both.pdf",
        size_bytes=100,
        modified_time=OLD,
    )
    db_session.add_all([large_only, stale_only, both])
    db_session.commit()
    run_large_stale_scan(
        db_session,
        scanned_at=datetime(2026, 1, 2, 0, 0, 0),
        now=NOW,
    )

    large, large_total, _scan_at, _coverage = list_large_stale_files(
        db_session,
        file_type="all",
        category="large",
        sort="size_desc",
        limit=50,
        offset=0,
        now=NOW,
    )
    stale, stale_total, _scan_at, _coverage = list_large_stale_files(
        db_session,
        file_type="all",
        category="stale",
        sort="size_desc",
        limit=50,
        offset=0,
        now=NOW,
    )
    all_files, all_total, _scan_at, _coverage = list_large_stale_files(
        db_session,
        file_type="all",
        category="all",
        sort="size_desc",
        limit=50,
        offset=0,
        now=NOW,
    )

    assert large_total == 2
    assert {item.file_id for item in large} == {"large-only", "both"}
    assert stale_total == 2
    assert {item.file_id for item in stale} == {"stale-only", "both"}
    assert all_total == 3
    assert {item.file_id for item in all_files} == {"large-only", "stale-only", "both"}


def test_large_stale_uses_active_snapshot_and_response_coverage(db_session: Session) -> None:
    active = _persist_account(
        db_session,
        _account(
            provider_account_id="active",
            email="active@example.com",
        ),
    )
    inactive = _persist_account(
        db_session,
        _account(
            provider_account_id="inactive",
            email="inactive@example.com",
            status="token_invalid",
        ),
    )
    unsynced = _persist_account(
        db_session,
        _account(
            provider_account_id="unsynced",
            email="unsynced@example.com",
            status="syncing",
            last_good_sync_at=None,
        ),
    )
    active_file = _file(
        account=active,
        file_id="active-large",
        file_name="Active Large.pdf",
        size_bytes=100,
        modified_time=RECENT,
    )
    inactive_file = _file(
        account=inactive,
        file_id="inactive-large",
        file_name="Inactive Large.pdf",
        size_bytes=100,
        modified_time=RECENT,
    )
    unsynced_file = _file(
        account=unsynced,
        file_id="unsynced-large",
        file_name="Unsynced Large.pdf",
        size_bytes=100,
        modified_time=RECENT,
    )
    db_session.add_all([active_file, inactive_file, unsynced_file])
    db_session.commit()
    run_large_stale_scan(
        db_session,
        scanned_at=datetime(2026, 1, 2, 0, 0, 0),
        now=NOW,
    )

    data, total, snapshot_at, coverage = list_large_stale_files(
        db_session,
        file_type="all",
        sort="size_desc",
        limit=50,
        offset=0,
        now=NOW,
    )

    assert total == 1
    assert snapshot_at == "2026-01-02T00:00:00Z"
    assert coverage is not None
    assert coverage.covered_account_ids == [active.id]
    assert coverage.covered_account_count == 1
    assert coverage.eligible_account_count == 3
    item = data[0]
    assert item.file_id == "active-large"
    assert item.account_email == "active@example.com"
    assert item.deletable is True
    assert item.deletable_reason is None
    assert not hasattr(item, "encrypted_access_token")


def test_large_stale_empty_scan_persists_metadata(db_session: Session) -> None:
    account = _persist_account(db_session, _account())
    normal = _file(
        account=account,
        file_id="normal",
        file_name="Normal.pdf",
        size_bytes=10,
        modified_time=RECENT,
    )
    db_session.add(normal)
    db_session.commit()

    scan = run_large_stale_scan(
        db_session,
        scanned_at=datetime(2026, 1, 2, 0, 0, 0),
        now=NOW,
    )
    data, total, scan_at, coverage = list_large_stale_files(
        db_session,
        file_type="all",
        sort="size_desc",
        limit=50,
        offset=0,
        now=NOW,
    )

    assert scan.total == 0
    assert data == []
    assert total == 0
    assert scan_at == "2026-01-02T00:00:00Z"
    assert coverage is not None
    assert coverage.covered_account_ids == [account.id]


def test_large_stale_disconnect_lifecycle_keeps_until_all_accounts_removed(
    db_session: Session,
) -> None:
    google = _persist_account(
        db_session,
        _account(
            provider="google",
            provider_account_id="google",
            email="google@example.com",
        ),
    )
    dropbox = _persist_account(
        db_session,
        _account(
            provider="dropbox",
            provider_account_id="dropbox",
            email="dropbox@example.com",
        ),
    )
    google_file = _file(
        account=google,
        file_id="google-large",
        file_name="Google Large.pdf",
        size_bytes=100,
        modified_time=RECENT,
    )
    dropbox_file = _file(
        account=dropbox,
        file_id="dropbox-large",
        file_name="Dropbox Large.pdf",
        size_bytes=100,
        modified_time=RECENT,
    )
    db_session.add_all([google_file, dropbox_file])
    db_session.commit()
    run_large_stale_scan(
        db_session,
        scanned_at=datetime(2026, 1, 2, 0, 0, 0),
        now=NOW,
    )

    accounts_service.disconnect_account(db_session, google.id)
    data, total, scan_at, coverage = list_large_stale_files(
        db_session,
        file_type="all",
        sort="size_desc",
        limit=50,
        offset=0,
        now=NOW,
    )

    assert total == 1
    assert [item.file_id for item in data] == ["dropbox-large"]
    assert scan_at == "2026-01-02T00:00:00Z"
    assert coverage is not None
    assert db_session.query(ScanMetadata).count() == 1

    accounts_service.disconnect_account(db_session, dropbox.id)
    data, total, scan_at, coverage = list_large_stale_files(
        db_session,
        file_type="all",
        sort="size_desc",
        limit=50,
        offset=0,
        now=NOW,
    )

    assert data == []
    assert total == 0
    assert scan_at is None
    assert coverage is None
    assert db_session.query(ScanMetadata).count() == 0


def test_large_stale_batch_delete_does_not_change_scan_timestamp(
    db_session: Session,
    monkeypatch,
) -> None:
    account = _persist_account(db_session, _account())
    large_file = _file(
        account=account,
        file_id="large-delete",
        file_name="Large Delete.pdf",
        size_bytes=100,
        modified_time=RECENT,
    )
    db_session.add(large_file)
    db_session.commit()
    db_session.refresh(large_file)
    run_large_stale_scan(
        db_session,
        scanned_at=datetime(2026, 1, 2, 0, 0, 0),
        now=NOW,
    )

    class FakeAdapter:
        def delete_file(self, file_id: str) -> bool:
            return True

    monkeypatch.setattr(
        duplicates_service,
        "get_adapter",
        lambda _provider, _credentials, _settings: FakeAdapter(),
    )

    batch_delete_files(db_session, ids=[large_file.id])
    data, total, scan_at, coverage = list_large_stale_files(
        db_session,
        file_type="all",
        sort="size_desc",
        limit=50,
        offset=0,
        now=NOW,
    )

    assert data == []
    assert total == 0
    assert scan_at == "2026-01-02T00:00:00Z"
    assert coverage is not None


def test_disconnect_last_account_removes_all_scan_metadata_types(
    db_session: Session,
) -> None:
    account = _persist_account(db_session, _account())
    db_session.add_all(
        [
            ScanMetadata(
                scan_type="duplicates_scan",
                scan_at=datetime(2026, 1, 2, 0, 0, 0),
                covered_account_ids="[]",
                eligible_account_count=0,
            ),
            ScanMetadata(
                scan_type="security_scan",
                scan_at=datetime(2026, 1, 2, 0, 0, 0),
                covered_account_ids="[]",
                eligible_account_count=0,
            ),
            ScanMetadata(
                scan_type="large_stale_scan",
                scan_at=datetime(2026, 1, 2, 0, 0, 0),
                covered_account_ids="[]",
                eligible_account_count=0,
            ),
        ]
    )
    db_session.commit()

    accounts_service.disconnect_account(db_session, account.id)

    assert db_session.query(ScanMetadata).count() == 0
