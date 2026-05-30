from __future__ import annotations

import json
from datetime import datetime

import pytest
from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.features.accounts.models import Account
from app.features.files_visibility.models import File
from app.features.keywords.models import SensitiveKeyword
from app.features.security import repository as security_repo
from app.features.security.models import ScanResult
from app.features.security.service import (
    batch_revoke_files,
    build_security_scan_results,
    list_public_files,
    run_security_scan,
    trigger_security_scan,
)
from app.shared.audit_log_model import ActionLog
from app.shared.encryption import encrypt_token
from app.shared.exceptions import OperationInProgressError


def _account(
    *,
    provider: str = "google",
    provider_account_id: str = "provider-account",
    email: str = "user@example.com",
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
    sharing_status: str | None = "public",
    is_owned: bool = True,
    trashed: bool = False,
    is_folder: bool = False,
) -> File:
    return File(
        account_id=account.id,
        file_id=file_id,
        file_name=file_name,
        path="/Work",
        size_bytes=100,
        mime_type="application/pdf",
        modified_time=datetime(2026, 1, 1, 0, 0, 0),
        hash=None,
        owner_account=account.id,
        provider=account.provider,
        sharing_status=sharing_status,
        location_type="MY_DRIVE" if account.provider == "google" else None,
        open_url="https://example.com/file",
        open_url_type="google_web_view"
        if account.provider == "google"
        else "dropbox_private_quickview",
        has_public_shared_link=sharing_status == "public",
        shared_link_url="https://example.com/shared" if sharing_status == "public" else None,
        shared_link_visibility="public" if sharing_status == "public" else None,
        trashed=trashed,
        is_folder=is_folder,
        is_owned=is_owned,
        created_at=datetime(2026, 1, 1, 0, 0, 0),
        updated_at=datetime(2026, 1, 1, 0, 0, 0),
    )


def _keyword(*, word: str, active: bool = True) -> SensitiveKeyword:
    return SensitiveKeyword(
        word=word,
        category="default",
        active=active,
        created_at=datetime(2026, 1, 1, 0, 0, 0),
    )


def _persist_account(db_session: Session, account: Account) -> Account:
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    return account


def test_trigger_security_scan_rejects_when_scan_in_progress(db_session: Session) -> None:
    response = trigger_security_scan(db_session, background_tasks=BackgroundTasks())

    assert response.operation_type == "security_scan"
    assert response.status == "queued"
    with pytest.raises(OperationInProgressError):
        trigger_security_scan(db_session, background_tasks=BackgroundTasks())


def test_security_scan_candidates_keywords_replace_and_modes(db_session: Session) -> None:
    account = _persist_account(db_session, _account())
    sensitive = _file(account=account, file_id="sensitive", file_name="ktp_npwp_data.pdf")
    public_clean = _file(account=account, file_id="clean", file_name="Catatan.pdf")
    extension_only = _file(account=account, file_id="extension-only", file_name="report.ktp")
    private = _file(
        account=account,
        file_id="private",
        file_name="KTP_private.pdf",
        sharing_status="private",
    )
    not_owned = _file(
        account=account,
        file_id="not-owned",
        file_name="KTP_shared.pdf",
        is_owned=False,
    )
    trashed = _file(
        account=account,
        file_id="trashed",
        file_name="KTP_trashed.pdf",
        trashed=True,
    )
    db_session.add_all(
        [
            sensitive,
            public_clean,
            extension_only,
            private,
            not_owned,
            trashed,
            _keyword(word="KTP", active=True),
            _keyword(word="NPWP", active=True),
            _keyword(word="BPJS", active=False),
        ]
    )
    db_session.commit()
    db_session.add(
        ScanResult(
            file_id=private.id,
            scan_type=security_repo.SECURITY_SCAN_TYPE,
            is_sensitive=True,
            matched_keywords=json.dumps(["KTP"]),
            scanned_at=datetime(2025, 1, 1, 0, 0, 0),
        )
    )
    db_session.commit()

    candidates = security_repo.list_scan_candidates(db_session)
    keywords = [keyword.word for keyword in security_repo.list_active_keywords(db_session)]
    results = build_security_scan_results(candidates, keywords)
    security_repo.replace_security_scan_results(
        db_session,
        results=results,
        scanned_at=datetime(2026, 1, 2, 0, 0, 0),
    )

    all_rows, scan_at, coverage = list_public_files(db_session, mode="public")
    sensitive_rows, _, _ = list_public_files(db_session, mode="sensitive")
    all_by_provider_id = {item.file_id: item for item in all_rows}

    assert scan_at == "2026-01-02T00:00:00Z"
    assert coverage is None
    assert set(all_by_provider_id) == {"sensitive", "clean", "extension-only"}
    assert all_by_provider_id["sensitive"].is_sensitive is True
    assert all_by_provider_id["sensitive"].matched_keywords == ["KTP", "NPWP"]
    assert all_by_provider_id["clean"].is_sensitive is False
    assert all_by_provider_id["extension-only"].is_sensitive is False
    assert [item.file_id for item in sensitive_rows] == ["sensitive"]
    assert all_by_provider_id["sensitive"].id == sensitive.id
    assert all_by_provider_id["sensitive"].account_email == "user@example.com"
    assert all_by_provider_id["sensitive"].deletable is True
    assert not hasattr(all_by_provider_id["sensitive"], "encrypted_access_token")
    assert (
        db_session.query(ScanResult)
        .filter(ScanResult.file_id == private.id, ScanResult.scan_type == security_repo.SECURITY_SCAN_TYPE)
        .count()
        == 0
    )


def test_security_scan_persists_snapshot_coverage(db_session: Session) -> None:
    active = _persist_account(
        db_session,
        _account(
            provider_account_id="active",
            email="active@example.com",
        ),
    )
    loading = _persist_account(
        db_session,
        _account(
            provider_account_id="loading",
            email="loading@example.com",
            status="syncing",
        ),
    )
    active_file = _file(
        account=active,
        file_id="active-public",
        file_name="KTP publik.pdf",
    )
    loading_file = _file(
        account=loading,
        file_id="loading-public",
        file_name="KTP loading.pdf",
    )
    db_session.add_all([active_file, loading_file, _keyword(word="KTP")])
    db_session.commit()

    _files_count, scan_coverage = run_security_scan(
        db_session,
        scanned_at=datetime(2026, 1, 4, 0, 0, 0),
    )
    rows, scan_at, stored_coverage = list_public_files(db_session, mode="public")

    assert scan_at == "2026-01-04T00:00:00Z"
    assert [row.account_id for row in rows] == [active.id]
    assert scan_coverage.eligible_account_count == 2
    assert scan_coverage.covered_account_ids == [active.id]
    assert scan_coverage.covered_account_count == 1
    assert stored_coverage == scan_coverage


def test_batch_revoke_success_updates_local_state_and_action_log(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    account = _persist_account(db_session, _account())
    public_file = _file(account=account, file_id="provider-public", file_name="KTP.pdf")
    db_session.add(public_file)
    db_session.commit()
    db_session.refresh(public_file)
    run_security_scan(
        db_session,
        scanned_at=datetime(2026, 1, 2, 0, 0, 0),
    )
    db_session.commit()
    revoked_provider_ids: list[str] = []

    class FakeAdapter:
        def set_sharing_private(self, file_id: str) -> bool:
            revoked_provider_ids.append(file_id)
            return True

    monkeypatch.setattr(
        "app.features.security.service.get_adapter",
        lambda _provider, _credentials, _settings: FakeAdapter(),
    )

    result = batch_revoke_files(db_session, ids=[public_file.id])

    assert [item.id for item in result.revoked] == [public_file.id]
    assert result.failed == []
    assert revoked_provider_ids == ["provider-public"]
    assert db_session.get(File, public_file.id).sharing_status == "private"
    rows, scan_at, coverage = list_public_files(db_session, mode="public")
    assert rows == []
    assert scan_at == "2026-01-02T00:00:00Z"
    assert coverage is not None
    assert db_session.query(ActionLog).filter_by(action="change_permission").count() == 1


def test_batch_revoke_partial_failures(db_session: Session) -> None:
    active = _persist_account(db_session, _account(provider_account_id="active"))
    inactive = _persist_account(
        db_session,
        _account(
            provider_account_id="inactive",
            email="inactive@example.com",
            status="token_invalid",
        ),
    )
    not_owned = _file(
        account=active,
        file_id="not-owned",
        file_name="Shared.pdf",
        is_owned=False,
    )
    not_public = _file(
        account=active,
        file_id="not-public",
        file_name="Private.pdf",
        sharing_status="private",
    )
    token_invalid = _file(
        account=inactive,
        file_id="token-invalid",
        file_name="Expired.pdf",
    )
    db_session.add_all([not_owned, not_public, token_invalid])
    db_session.commit()
    db_session.refresh(not_owned)
    db_session.refresh(not_public)
    db_session.refresh(token_invalid)

    result = batch_revoke_files(
        db_session,
        ids=[not_owned.id, not_public.id, token_invalid.id, "missing"],
    )

    assert result.revoked == []
    assert [(item.id, item.error_code) for item in result.failed] == [
        (not_owned.id, "not_owned"),
        (not_public.id, "not_public"),
        (token_invalid.id, "account_token_invalid"),
        ("missing", "not_found"),
    ]
