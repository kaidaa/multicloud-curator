from __future__ import annotations

from datetime import datetime

import pytest
from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.features.accounts import service as accounts_service
from app.features.accounts.models import Account
from app.features.async_operations import repository as ops_repo
from app.features.duplicates import repository as duplicates_repo
from app.features.duplicates import service as duplicates_service
from app.features.duplicates.models import DuplicateGroup, DuplicateGroupMember
from app.features.duplicates.service import (
    batch_delete_files,
    build_duplicate_groups,
    list_duplicate_groups,
    run_duplicates_scan,
)
from app.features.files_visibility.models import File
from app.shared.encryption import encrypt_token
from app.shared.exceptions import OperationInProgressError, ValidationError


def _account(
    *,
    provider: str,
    email: str,
    provider_account_id: str,
    status: str = "active",
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
        quota_total_bytes=100,
        last_good_sync_at=datetime(2026, 1, 1, 0, 0, 0),
    )


def _file(
    *,
    account: Account,
    file_id: str,
    file_name: str,
    size_bytes: int | None,
    hash_value: str | None,
    mime_type: str = "application/pdf",
    is_owned: bool = True,
    provider: str | None = None,
    modified_time: datetime | None = None,
) -> File:
    return File(
        account_id=account.id,
        file_id=file_id,
        file_name=file_name,
        path="/Work",
        size_bytes=size_bytes,
        mime_type=mime_type,
        modified_time=modified_time or datetime(2026, 1, 1, 0, 0, 0),
        hash=hash_value,
        owner_account=account.id,
        provider=provider or account.provider,
        sharing_status="private",
        location_type="MY_DRIVE" if (provider or account.provider) == "google" else None,
        open_url="https://example.com/file",
        open_url_type="google_web_view"
        if (provider or account.provider) == "google"
        else "dropbox_private_quickview",
        has_public_shared_link=False,
        shared_link_url=None,
        shared_link_visibility=None,
        trashed=False,
        is_folder=False,
        is_owned=is_owned,
        created_at=datetime(2026, 1, 1, 0, 0, 0),
        updated_at=datetime(2026, 1, 1, 0, 0, 0),
    )


def _persist_accounts(db_session: Session) -> tuple[Account, Account]:
    google = _account(
        provider="google",
        provider_account_id="google-1",
        email="google@example.com",
    )
    dropbox = _account(
        provider="dropbox",
        provider_account_id="dropbox-1",
        email="dropbox@example.com",
    )
    db_session.add_all([google, dropbox])
    db_session.commit()
    db_session.refresh(google)
    db_session.refresh(dropbox)
    return google, dropbox


def test_duplicate_algorithm_hash_per_provider_and_name_size_cross_provider(
    db_session: Session,
) -> None:
    google, dropbox = _persist_accounts(db_session)
    same_provider_hash_a = _file(
        account=google,
        file_id="g-hash-a",
        file_name="Alpha.pdf",
        size_bytes=10,
        hash_value="same-google-hash",
    )
    same_provider_hash_b = _file(
        account=google,
        file_id="g-hash-b",
        file_name="Beta.pdf",
        size_bytes=11,
        hash_value="same-google-hash",
    )
    cross_provider_same_hash = _file(
        account=dropbox,
        file_id="d-same-hash",
        file_name="Gamma.pdf",
        size_bytes=12,
        hash_value="same-google-hash",
    )
    name_size_google = _file(
        account=google,
        file_id="g-name-size",
        file_name="Laporan (1).pdf",
        size_bytes=500,
        hash_value=None,
    )
    name_size_dropbox = _file(
        account=dropbox,
        file_id="d-name-size",
        file_name="laporan - Copy.pdf",
        size_bytes=500,
        hash_value=None,
    )
    all_shared_a = _file(
        account=google,
        file_id="shared-a",
        file_name="Shared.pdf",
        size_bytes=700,
        hash_value="shared-hash",
        is_owned=False,
    )
    all_shared_b = _file(
        account=google,
        file_id="shared-b",
        file_name="Shared 2.pdf",
        size_bytes=701,
        hash_value="shared-hash",
        is_owned=False,
    )

    groups = build_duplicate_groups(
        [
            same_provider_hash_a,
            same_provider_hash_b,
            cross_provider_same_hash,
            name_size_google,
            name_size_dropbox,
            all_shared_a,
            all_shared_b,
        ]
    )

    grouped_ids = [{file.file_id for file in members} for basis, members in groups]
    assert {"g-hash-a", "g-hash-b"} in grouped_ids
    assert {"g-name-size", "d-name-size"} in grouped_ids
    assert all("d-same-hash" not in group for group in grouped_ids)
    assert all("shared-a" not in group and "shared-b" not in group for group in grouped_ids)
    assert [basis for basis, _members in groups].count("hash") == 1
    assert [basis for basis, _members in groups].count("name_size") == 1


def test_duplicate_scan_canonicalizes_same_provider_file_id(
    db_session: Session,
) -> None:
    google_owner = _account(
        provider="google",
        provider_account_id="google-owner",
        email="owner@example.com",
    )
    google_shared = _account(
        provider="google",
        provider_account_id="google-shared",
        email="shared@example.com",
    )
    db_session.add_all([google_owner, google_shared])
    db_session.commit()
    db_session.refresh(google_owner)
    db_session.refresh(google_shared)
    owned_row = _file(
        account=google_owner,
        file_id="same-provider-file",
        file_name="Shared Physical File.pdf",
        size_bytes=100,
        hash_value="same-hash",
        is_owned=True,
    )
    shared_row = _file(
        account=google_shared,
        file_id="same-provider-file",
        file_name="Shared Physical File.pdf",
        size_bytes=100,
        hash_value="same-hash",
        is_owned=False,
    )
    db_session.add_all([owned_row, shared_row])
    db_session.commit()
    db_session.refresh(owned_row)
    db_session.refresh(shared_row)

    groups = build_duplicate_groups(
        [shared_row, owned_row],
        account_status_by_file_id={
            shared_row.id: google_shared.status,
            owned_row.id: google_owner.status,
        },
    )

    assert groups == []


def test_duplicate_scan_groups_distinct_physical_members_only(
    db_session: Session,
) -> None:
    google_owner = _account(
        provider="google",
        provider_account_id="google-owner",
        email="owner@example.com",
    )
    google_shared = _account(
        provider="google",
        provider_account_id="google-shared",
        email="shared@example.com",
    )
    db_session.add_all([google_owner, google_shared])
    db_session.commit()
    db_session.refresh(google_owner)
    db_session.refresh(google_shared)
    owned_row = _file(
        account=google_owner,
        file_id="same-provider-file",
        file_name="Shared Physical File.pdf",
        size_bytes=100,
        hash_value="same-hash",
        is_owned=True,
    )
    shared_row = _file(
        account=google_shared,
        file_id="same-provider-file",
        file_name="Shared Physical File.pdf",
        size_bytes=100,
        hash_value="same-hash",
        is_owned=False,
    )
    true_duplicate = _file(
        account=google_owner,
        file_id="different-provider-file",
        file_name="Actual Duplicate.pdf",
        size_bytes=100,
        hash_value="same-hash",
        is_owned=True,
    )
    db_session.add_all([owned_row, shared_row, true_duplicate])
    db_session.commit()
    db_session.refresh(owned_row)
    db_session.refresh(shared_row)
    db_session.refresh(true_duplicate)

    groups = build_duplicate_groups(
        [shared_row, owned_row, true_duplicate],
        account_status_by_file_id={
            shared_row.id: google_shared.status,
            owned_row.id: google_owner.status,
            true_duplicate.id: google_owner.status,
        },
    )

    assert len(groups) == 1
    assert groups[0][0] == "hash"
    assert {file.id for file in groups[0][1]} == {owned_row.id, true_duplicate.id}
    assert shared_row.id not in {file.id for file in groups[0][1]}


def test_trigger_duplicates_scan_rejects_when_scan_in_progress(db_session: Session) -> None:
    background_tasks = BackgroundTasks()

    response = duplicates_service.trigger_duplicates_scan(
        db_session,
        background_tasks=background_tasks,
    )

    assert response.operation_type == "duplicates_scan"
    assert response.status == "queued"
    with pytest.raises(OperationInProgressError):
        duplicates_service.trigger_duplicates_scan(
            db_session,
            background_tasks=BackgroundTasks(),
        )


def test_list_duplicate_groups_maps_members_and_type_filter(db_session: Session) -> None:
    google, dropbox = _persist_accounts(db_session)
    google_doc = _file(
        account=google,
        file_id="google-doc",
        file_name="KTP.pdf",
        size_bytes=100,
        hash_value="hash-1",
        mime_type="application/pdf",
        modified_time=datetime(2026, 1, 2, 0, 0, 0),
    )
    dropbox_doc = _file(
        account=dropbox,
        file_id="dropbox-doc",
        file_name="KTP - Copy.pdf",
        size_bytes=100,
        hash_value=None,
        mime_type="application/pdf",
        modified_time=datetime(2026, 1, 1, 0, 0, 0),
        is_owned=False,
    )
    db_session.add_all([google_doc, dropbox_doc])
    db_session.commit()
    duplicates_repo.replace_duplicate_groups(
        db_session,
        groups=[("name_size", [google_doc, dropbox_doc])],
        scanned_at=datetime(2026, 1, 3, 0, 0, 0),
    )

    data, total, scan_at, coverage = list_duplicate_groups(
        db_session,
        file_type="document",
        limit=50,
        offset=0,
    )
    empty, empty_total, _, _empty_coverage = list_duplicate_groups(
        db_session,
        file_type="photo",
        limit=50,
        offset=0,
    )

    assert total == 1
    assert scan_at == "2026-01-03T00:00:00Z"
    assert coverage is None
    assert data[0].match_basis == "name_size"
    assert data[0].members_count == 2
    assert {member.id for member in data[0].members} == {google_doc.id, dropbox_doc.id}
    members_by_id = {member.id: member for member in data[0].members}
    assert members_by_id[google_doc.id].deletable is True
    assert members_by_id[dropbox_doc.id].deletable is False
    assert members_by_id[dropbox_doc.id].deletable_reason == "File ini bukan milik Anda"
    assert empty == []
    assert empty_total == 0


def test_list_duplicate_groups_filters_provider_and_type(db_session: Session) -> None:
    google, dropbox = _persist_accounts(db_session)
    google_doc_a = _file(
        account=google,
        file_id="google-doc-a",
        file_name="Google A.pdf",
        size_bytes=100,
        hash_value="google-doc",
        mime_type="application/pdf",
    )
    google_doc_b = _file(
        account=google,
        file_id="google-doc-b",
        file_name="Google B.pdf",
        size_bytes=100,
        hash_value="google-doc",
        mime_type="application/pdf",
    )
    dropbox_doc_a = _file(
        account=dropbox,
        file_id="dropbox-doc-a",
        file_name="Dropbox A.pdf",
        size_bytes=100,
        hash_value="dropbox-doc",
        mime_type="application/pdf",
    )
    dropbox_doc_b = _file(
        account=dropbox,
        file_id="dropbox-doc-b",
        file_name="Dropbox B.pdf",
        size_bytes=100,
        hash_value="dropbox-doc",
        mime_type="application/pdf",
    )
    dropbox_photo_a = _file(
        account=dropbox,
        file_id="dropbox-photo-a",
        file_name="Dropbox A.jpg",
        size_bytes=100,
        hash_value="dropbox-photo",
        mime_type="image/jpeg",
    )
    dropbox_photo_b = _file(
        account=dropbox,
        file_id="dropbox-photo-b",
        file_name="Dropbox B.jpg",
        size_bytes=100,
        hash_value="dropbox-photo",
        mime_type="image/jpeg",
    )
    db_session.add_all(
        [
            google_doc_a,
            google_doc_b,
            dropbox_doc_a,
            dropbox_doc_b,
            dropbox_photo_a,
            dropbox_photo_b,
        ]
    )
    db_session.commit()
    duplicates_repo.replace_duplicate_groups(
        db_session,
        groups=[
            ("hash", [google_doc_a, google_doc_b]),
            ("hash", [dropbox_doc_a, dropbox_doc_b]),
            ("hash", [dropbox_photo_a, dropbox_photo_b]),
        ],
        scanned_at=datetime(2026, 1, 3, 0, 0, 0),
    )

    google_groups, google_total, _scan_at, _coverage = list_duplicate_groups(
        db_session,
        file_type="all",
        provider="google",
        limit=50,
        offset=0,
    )
    dropbox_docs, dropbox_doc_total, _scan_at, _coverage = list_duplicate_groups(
        db_session,
        file_type="document",
        provider="dropbox",
        limit=50,
        offset=0,
    )

    assert google_total == 1
    assert {member.provider for member in google_groups[0].members} == {"google"}
    assert dropbox_doc_total == 1
    assert {member.id for member in dropbox_docs[0].members} == {
        dropbox_doc_a.id,
        dropbox_doc_b.id,
    }


def test_latest_scan_at_ignores_completed_operation_without_duplicate_groups(
    db_session: Session,
) -> None:
    operation = ops_repo.create_operation(
        db_session,
        operation_type="duplicates_scan",
        context={"triggered_by": "duplicates_scan"},
    )
    ops_repo.mark_completed(db_session, operation)

    data, total, scan_at, coverage = list_duplicate_groups(
        db_session,
        file_type="all",
        limit=50,
        offset=0,
    )

    assert data == []
    assert total == 0
    assert scan_at is None
    assert coverage is None


def test_duplicate_scan_persists_snapshot_coverage(db_session: Session) -> None:
    active = _account(
        provider="google",
        provider_account_id="active",
        email="active@example.com",
    )
    loading = _account(
        provider="dropbox",
        provider_account_id="loading",
        email="loading@example.com",
        status="syncing",
    )
    db_session.add_all([active, loading])
    db_session.commit()
    db_session.refresh(active)
    db_session.refresh(loading)
    active_a = _file(
        account=active,
        file_id="active-a",
        file_name="KTP.pdf",
        size_bytes=100,
        hash_value="same-hash",
    )
    active_b = _file(
        account=active,
        file_id="active-b",
        file_name="KTP Copy.pdf",
        size_bytes=100,
        hash_value="same-hash",
    )
    loading_file = _file(
        account=loading,
        file_id="loading-a",
        file_name="Loading.pdf",
        size_bytes=100,
        hash_value="same-hash",
    )
    db_session.add_all([active_a, active_b, loading_file])
    db_session.commit()

    _files_count, scan_coverage = run_duplicates_scan(
        db_session,
        scanned_at=datetime(2026, 1, 4, 0, 0, 0),
    )
    data, total, scan_at, stored_coverage = list_duplicate_groups(
        db_session,
        file_type="all",
        limit=50,
        offset=0,
    )

    assert total == 1
    assert scan_at == "2026-01-04T00:00:00Z"
    assert {member.account_id for member in data[0].members} == {active.id}
    assert scan_coverage.eligible_account_count == 2
    assert scan_coverage.covered_account_ids == [active.id]
    assert scan_coverage.covered_account_count == 1
    assert stored_coverage == scan_coverage


def test_disconnect_account_cleans_orphan_duplicate_groups(
    db_session: Session,
) -> None:
    google, dropbox = _persist_accounts(db_session)
    google_doc = _file(
        account=google,
        file_id="google-doc",
        file_name="KTP.pdf",
        size_bytes=100,
        hash_value="hash-1",
    )
    dropbox_doc = _file(
        account=dropbox,
        file_id="dropbox-doc",
        file_name="KTP - Copy.pdf",
        size_bytes=100,
        hash_value=None,
        is_owned=False,
    )
    db_session.add_all([google_doc, dropbox_doc])
    db_session.commit()
    db_session.refresh(google_doc)
    db_session.refresh(dropbox_doc)
    google_id = google.id
    google_doc_id = google_doc.id
    dropbox_doc_id = dropbox_doc.id
    duplicates_repo.replace_duplicate_groups(
        db_session,
        groups=[("name_size", [google_doc, dropbox_doc])],
        scanned_at=datetime(2026, 1, 3, 0, 0, 0),
    )

    accounts_service.disconnect_account(db_session, google_id)
    db_session.expire_all()

    assert db_session.query(Account).filter_by(id=google_id).count() == 0
    assert db_session.query(File).filter_by(id=google_doc_id).count() == 0
    assert db_session.query(File).filter_by(id=dropbox_doc_id).count() == 1
    assert db_session.query(DuplicateGroup).count() == 0
    assert db_session.query(DuplicateGroupMember).count() == 0


def test_batch_delete_partial_success_and_group_cleanup(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    google, dropbox = _persist_accounts(db_session)
    owned = _file(
        account=google,
        file_id="provider-owned",
        file_name="Owned.pdf",
        size_bytes=100,
        hash_value="hash-owned",
    )
    not_owned = _file(
        account=dropbox,
        file_id="provider-shared",
        file_name="Shared.pdf",
        size_bytes=100,
        hash_value=None,
        is_owned=False,
    )
    db_session.add_all([owned, not_owned])
    db_session.commit()
    db_session.refresh(owned)
    db_session.refresh(not_owned)
    duplicates_repo.replace_duplicate_groups(
        db_session,
        groups=[("name_size", [owned, not_owned])],
        scanned_at=datetime(2026, 1, 3, 0, 0, 0),
    )
    deleted_provider_ids: list[str] = []

    class FakeAdapter:
        def delete_file(self, file_id: str) -> bool:
            deleted_provider_ids.append(file_id)
            return True

    monkeypatch.setattr(
        duplicates_service,
        "get_adapter",
        lambda _provider, _credentials, _settings: FakeAdapter(),
    )

    result = batch_delete_files(
        db_session,
        ids=[owned.id, not_owned.id, "missing-id"],
    )

    assert [item.id for item in result.deleted] == [owned.id]
    assert deleted_provider_ids == ["provider-owned"]
    assert [(item.id, item.error_code) for item in result.failed] == [
        (not_owned.id, "not_owned"),
        ("missing-id", "not_found"),
    ]
    assert db_session.get(File, owned.id) is None
    assert db_session.query(DuplicateGroup).count() == 0
    assert db_session.query(DuplicateGroupMember).count() == 0


def test_batch_delete_does_not_change_duplicate_scan_timestamp(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    google, _dropbox = _persist_accounts(db_session)
    owned_a = _file(
        account=google,
        file_id="provider-owned-a",
        file_name="Owned A.pdf",
        size_bytes=100,
        hash_value="same-hash",
    )
    owned_b = _file(
        account=google,
        file_id="provider-owned-b",
        file_name="Owned B.pdf",
        size_bytes=100,
        hash_value="same-hash",
    )
    db_session.add_all([owned_a, owned_b])
    db_session.commit()
    db_session.refresh(owned_a)
    db_session.refresh(owned_b)
    run_duplicates_scan(
        db_session,
        scanned_at=datetime(2026, 1, 3, 0, 0, 0),
    )

    class FakeAdapter:
        def delete_file(self, file_id: str) -> bool:
            return True

    monkeypatch.setattr(
        duplicates_service,
        "get_adapter",
        lambda _provider, _credentials, _settings: FakeAdapter(),
    )

    batch_delete_files(db_session, ids=[owned_a.id])
    data, total, scan_at, coverage = list_duplicate_groups(
        db_session,
        file_type="all",
        limit=50,
        offset=0,
    )

    assert data == []
    assert total == 0
    assert scan_at == "2026-01-03T00:00:00Z"
    assert coverage is not None


def test_batch_delete_validates_ids(db_session: Session) -> None:
    with pytest.raises(ValidationError):
        batch_delete_files(db_session, ids=[])
