from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import datetime

import pytest
from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.adapters import google_drive
from app.adapters.base import TokenBundle
from app.config import Settings
from app.features.accounts import repository as accounts_repo
from app.features.accounts import service as accounts_service
from app.features.accounts.models import Account
from app.features.accounts.service import list_accounts, trigger_refresh, trigger_refresh_all
from app.features.async_operations.models import Operation
from app.features.async_operations.repository import load_context
from app.features.duplicates import repository as duplicates_repo
from app.features.duplicates.models import DuplicateGroup, DuplicateGroupMember
from app.features.files_visibility.models import File
from app.features.large_stale.models import LargeStaleResult
from app.features.security.models import ScanResult
from app.shared.encryption import encrypt_token
from app.shared.exceptions import (
    AdapterError,
    OperationInProgressError,
    ScopeInsufficientError,
    ValidationError,
)


def _token_bundle() -> TokenBundle:
    return TokenBundle(
        access_token="access-token",
        refresh_token="refresh-token",
        expires_at=datetime(2026, 1, 1, 0, 0, 0),
        scopes=["scope-a"],
    )


def _service_session_factory(db_session: Session) -> Callable[[], Session]:
    bind = db_session.get_bind()

    def _factory() -> Session:
        return Session(bind=bind, autoflush=False, expire_on_commit=False)

    return _factory


def _account(
    *,
    provider: str = "google",
    provider_account_id: str = "provider-1",
    email: str = "kai@example.com",
    status: str = "active",
    data_state: str = "Lengkap",
) -> Account:
    return Account(
        provider=provider,
        provider_account_id=provider_account_id,
        email=email,
        encrypted_access_token=encrypt_token("access-token"),
        encrypted_refresh_token=encrypt_token("refresh-token"),
        scopes='["scope-a"]',
        status=status,
        data_state=data_state,
        quota_used_bytes=10,
        quota_total_bytes=100,
        last_good_sync_at=datetime(2026, 1, 1, 0, 0, 0) if data_state == "Lengkap" else None,
    )


def _file(
    *,
    account: Account,
    file_id: str,
    file_name: str,
    size_bytes: int = 100,
    hash_value: str | None = None,
    sharing_status: str = "private",
) -> File:
    return File(
        account_id=account.id,
        file_id=file_id,
        file_name=file_name,
        path="/Work",
        size_bytes=size_bytes,
        mime_type="application/pdf",
        modified_time=datetime(2026, 1, 1, 0, 0, 0),
        hash=hash_value,
        owner_account=account.id,
        provider=account.provider,
        sharing_status=sharing_status,
        location_type=None,
        open_url="https://example.com/file",
        open_url_type="google_web_view",
        has_public_shared_link=False,
        shared_link_url=None,
        shared_link_visibility=None,
        trashed=False,
        is_folder=False,
        is_owned=True,
    )


def _normalized_file(
    *,
    file_id: str,
    file_name: str,
    size_bytes: int = 100,
    hash_value: str | None = None,
    sharing_status: str = "private",
    provider: str = "google",
) -> dict:
    return {
        "file_id": file_id,
        "file_name": file_name,
        "path": "/Updated",
        "size_bytes": size_bytes,
        "mime_type": "application/pdf",
        "modified_time": datetime(2026, 2, 1, 0, 0, 0),
        "hash": hash_value,
        "owner_account": "owner",
        "provider": provider,
        "sharing_status": sharing_status,
        "location_type": "MY_DRIVE" if provider == "google" else None,
        "open_url": "https://example.com/updated",
        "open_url_type": "google_web_view" if provider == "google" else "dropbox_private_quickview",
        "has_public_shared_link": False,
        "shared_link_url": None,
        "shared_link_visibility": None,
        "trashed": False,
        "is_folder": False,
        "is_owned": True,
    }


def test_oauth_state_is_single_use(db_session: Session) -> None:
    raw_state = accounts_repo.create_oauth_state(
        db_session,
        provider="google",
        mode="connect",
        account_id=None,
    )

    consumed = accounts_repo.consume_oauth_state(db_session, raw_state)

    assert consumed.provider == "google"
    assert consumed.mode == "connect"
    with pytest.raises(ValidationError):
        accounts_repo.consume_oauth_state(db_session, raw_state)


def test_account_upsert_encrypts_tokens_and_response_hides_credentials(
    db_session: Session,
) -> None:
    account = accounts_repo.upsert_account_tokens(
        db_session,
        provider="google",
        provider_account_id="provider-1",
        email="kai@example.com",
        token_bundle=_token_bundle(),
        quota_used_bytes=10,
        quota_total_bytes=100,
    )

    response = list_accounts(db_session)[0]

    assert account.encrypted_access_token != "access-token"
    assert account.encrypted_refresh_token != "refresh-token"
    assert response.email == "kai@example.com"
    assert not hasattr(response, "encrypted_access_token")
    assert not hasattr(response, "encrypted_refresh_token")


def test_account_data_timestamp_uses_latest_successful_sync(
    db_session: Session,
) -> None:
    older = _account(provider_account_id="older", email="older@example.com")
    newer = _account(provider_account_id="newer", email="newer@example.com")
    loading = _account(
        provider_account_id="loading",
        email="loading@example.com",
        status="syncing",
        data_state="Parsial",
    )
    db_session.add_all([older, newer, loading])
    db_session.commit()
    older.last_good_sync_at = datetime(2026, 1, 1, 0, 0, 0)
    newer.last_good_sync_at = datetime(2026, 1, 3, 0, 0, 0)
    newer.updated_at = datetime(2026, 1, 10, 0, 0, 0)
    db_session.commit()

    assert accounts_service.latest_account_data_at(db_session) == "2026-01-03T00:00:00Z"


def test_connect_callback_queues_initial_load_and_marks_account_syncing(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    raw_state = accounts_repo.create_oauth_state(
        db_session,
        provider="google",
        mode="connect",
        account_id=None,
    )

    class FakeOAuthClient:
        def exchange_code(self, code: str) -> TokenBundle:
            assert code == "callback-code"
            return _token_bundle()

    class FakeAdapter:
        def get_account_info(self) -> dict[str, str]:
            return {
                "email": "kai@example.com",
                "provider_account_id": "provider-1",
                "provider": "google",
            }

        def get_quota(self) -> dict[str, int]:
            return {"used_bytes": 10, "total_bytes": 100}

        def fetch_recent(self, limit: int) -> list:
            assert limit == 10
            return []

    monkeypatch.setattr(accounts_service, "get_oauth_client", lambda _provider, _settings: FakeOAuthClient())
    monkeypatch.setattr(accounts_service, "get_adapter", lambda *_args, **_kwargs: FakeAdapter())
    background_tasks = BackgroundTasks()
    settings = Settings(frontend_redirect_base_url="http://frontend.test")

    redirect_url = accounts_service.handle_oauth_callback(
        db_session,
        code="callback-code",
        state=raw_state,
        settings=settings,
        background_tasks=background_tasks,
    )

    account = accounts_repo.list_accounts(db_session)[0]
    operation = db_session.query(Operation).one()
    context = load_context(operation)
    assert "status=connected" in redirect_url
    assert account.status == "syncing"
    assert account.data_state == "Parsial"
    assert operation.operation_type == "refresh"
    assert context["account_id"] == account.id
    assert context["previous_status"] == "never_synced"
    assert context["previous_data_state"] == "Parsial"
    assert context["triggered_by"] == "initial_load"
    assert len(background_tasks.tasks) == 1


def test_trigger_refresh_creates_operation_with_previous_status(
    db_session: Session,
) -> None:
    account = Account(
        provider="google",
        provider_account_id="provider-1",
        email="kai@example.com",
        encrypted_access_token=encrypt_token("access-token"),
        encrypted_refresh_token=encrypt_token("refresh-token"),
        scopes='["scope-a"]',
        status="active",
        data_state="Lengkap",
        quota_used_bytes=10,
        quota_total_bytes=100,
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    background_tasks = BackgroundTasks()

    response = trigger_refresh(
        db_session,
        account_id=account.id,
        background_tasks=background_tasks,
    )

    operation = db_session.get(Operation, response.operation_id)
    assert operation is not None
    context = load_context(operation)
    assert response.operation_type == "refresh"
    assert response.status == "queued"
    assert context["account_id"] == account.id
    assert context["previous_status"] == "active"
    assert context["previous_data_state"] == "Lengkap"

    with pytest.raises(OperationInProgressError):
        trigger_refresh(db_session, account_id=account.id, background_tasks=background_tasks)


def test_initial_load_failure_sets_load_failed(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    account = Account(
        provider="google",
        provider_account_id="provider-initial",
        email="initial@example.com",
        encrypted_access_token=encrypt_token("access-token"),
        encrypted_refresh_token=encrypt_token("refresh-token"),
        scopes='["scope-a"]',
        status="syncing",
        data_state="Parsial",
        quota_used_bytes=10,
        quota_total_bytes=100,
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    account_id = account.id
    operation = Operation(
        operation_type="refresh",
        status="queued",
        context=(
            f'{{"account_id":"{account_id}",'
            '"provider":"google",'
            '"previous_status":"never_synced",'
            '"previous_data_state":"Parsial",'
            '"triggered_by":"initial_load"}'
        ),
    )
    db_session.add(operation)
    db_session.commit()
    db_session.refresh(operation)
    operation_id = operation.id
    db_session.commit()
    db_session.expunge_all()

    class FailingAdapter:
        def get_quota(self) -> dict[str, int]:
            raise AdapterError(
                "Provider gagal",
                provider="google",
                account_id=account_id,
                operation="get_quota",
            )

    monkeypatch.setattr(accounts_service, "SessionLocal", _service_session_factory(db_session))
    monkeypatch.setattr(accounts_service, "get_adapter", lambda *_args, **_kwargs: FailingAdapter())

    accounts_service.execute_refresh_operation(operation_id, account_id)

    updated_account = db_session.get(Account, account_id)
    updated_operation = db_session.get(Operation, operation_id)
    assert updated_account is not None
    assert updated_operation is not None
    assert updated_account.status == "load_failed"
    assert updated_account.data_state == "Parsial"
    assert updated_operation.status == "failed"


def test_manual_refresh_failure_restores_previous_status(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    account = Account(
        provider="google",
        provider_account_id="provider-active",
        email="active@example.com",
        encrypted_access_token=encrypt_token("access-token"),
        encrypted_refresh_token=encrypt_token("refresh-token"),
        scopes='["scope-a"]',
        status="active",
        data_state="Lengkap",
        quota_used_bytes=10,
        quota_total_bytes=100,
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    account_id = account.id
    operation = Operation(
        operation_type="refresh",
        status="queued",
        context=(
            f'{{"account_id":"{account_id}",'
            '"provider":"google",'
            '"previous_status":"active",'
            '"previous_data_state":"Lengkap",'
            '"triggered_by":"single_refresh"}'
        ),
    )
    db_session.add(operation)
    db_session.commit()
    db_session.refresh(operation)
    operation_id = operation.id
    db_session.commit()
    db_session.expunge_all()

    class FailingAdapter:
        def get_quota(self) -> dict[str, int]:
            raise AdapterError(
                "Provider gagal",
                provider="google",
                account_id=account_id,
                operation="get_quota",
            )

    monkeypatch.setattr(accounts_service, "SessionLocal", _service_session_factory(db_session))
    monkeypatch.setattr(accounts_service, "get_adapter", lambda *_args, **_kwargs: FailingAdapter())

    accounts_service.execute_refresh_operation(operation_id, account_id)

    updated_account = db_session.get(Account, account_id)
    updated_operation = db_session.get(Operation, operation_id)
    assert updated_account is not None
    assert updated_operation is not None
    assert updated_account.status == "active"
    assert updated_account.data_state == "Lengkap"
    assert updated_operation.status == "failed"


def test_refresh_preserves_file_ids_and_persisted_scan_results(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    account = _account()
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    retained_a = _file(
        account=account,
        file_id="provider-a",
        file_name="A.pdf",
        hash_value="same-hash",
    )
    retained_b = _file(
        account=account,
        file_id="provider-b",
        file_name="B.pdf",
        hash_value="same-hash",
    )
    removed = _file(
        account=account,
        file_id="provider-removed",
        file_name="Removed.pdf",
        hash_value="removed-hash",
        sharing_status="public",
    )
    db_session.add_all([retained_a, retained_b, removed])
    db_session.commit()
    db_session.refresh(retained_a)
    db_session.refresh(retained_b)
    db_session.refresh(removed)
    retained_a_id = retained_a.id
    retained_b_id = retained_b.id
    removed_id = removed.id
    duplicates_repo.replace_duplicate_groups(
        db_session,
        groups=[("hash", [retained_a, retained_b])],
        scanned_at=datetime(2026, 1, 2, 0, 0, 0),
    )
    member_ids_before = {
        member.id for member in db_session.query(DuplicateGroupMember).all()
    }
    scan_result = ScanResult(
        file_id=retained_a_id,
        scan_type="security_audit",
        is_sensitive=True,
        matched_keywords='["ktp"]',
        scanned_at=datetime(2026, 1, 2, 0, 0, 0),
    )
    removed_scan_result = ScanResult(
        file_id=removed_id,
        scan_type="security_audit",
        is_sensitive=True,
        matched_keywords='["secret"]',
        scanned_at=datetime(2026, 1, 2, 0, 0, 0),
    )
    large_stale_result = LargeStaleResult(
        file_id=retained_b_id,
        scan_at=datetime(2026, 1, 2, 0, 0, 0),
        trigger_reason="large",
        is_large=True,
        is_stale=False,
        modified_age_months=0,
    )
    removed_large_stale_result = LargeStaleResult(
        file_id=removed_id,
        scan_at=datetime(2026, 1, 2, 0, 0, 0),
        trigger_reason="stale",
        is_large=False,
        is_stale=True,
        modified_age_months=8,
    )
    db_session.add_all(
        [
            scan_result,
            removed_scan_result,
            large_stale_result,
            removed_large_stale_result,
        ]
    )
    db_session.commit()
    db_session.refresh(scan_result)
    db_session.refresh(large_stale_result)
    scan_result_id = scan_result.id
    large_stale_result_id = large_stale_result.id
    operation = Operation(
        operation_type="refresh",
        status="queued",
        context=(
            f'{{"account_id":"{account.id}",'
            '"provider":"google",'
            '"previous_status":"active",'
            '"previous_data_state":"Lengkap",'
            '"triggered_by":"single_refresh"}'
        ),
    )
    db_session.add(operation)
    db_session.commit()
    db_session.refresh(operation)
    operation_id = operation.id
    account_id = account.id
    db_session.commit()
    db_session.expunge_all()

    class RefreshAdapter:
        def get_quota(self) -> dict[str, int]:
            return {"used_bytes": 20, "total_bytes": 100}

        def fetch_metadata(self) -> list[dict]:
            return [
                _normalized_file(
                    file_id="provider-a",
                    file_name="A updated.pdf",
                    hash_value="same-hash",
                ),
                _normalized_file(
                    file_id="provider-b",
                    file_name="B updated.pdf",
                    hash_value="same-hash",
                ),
                _normalized_file(
                    file_id="provider-new",
                    file_name="New.pdf",
                    hash_value="new-hash",
                ),
            ]

    monkeypatch.setattr(accounts_service, "SessionLocal", _service_session_factory(db_session))
    monkeypatch.setattr(accounts_service, "get_adapter", lambda *_args, **_kwargs: RefreshAdapter())

    accounts_service.execute_refresh_operation(operation_id, account_id)
    db_session.expire_all()

    updated_a = db_session.query(File).filter_by(account_id=account_id, file_id="provider-a").one()
    updated_b = db_session.query(File).filter_by(account_id=account_id, file_id="provider-b").one()
    new_file = db_session.query(File).filter_by(account_id=account_id, file_id="provider-new").one()
    assert updated_a.id == retained_a_id
    assert updated_b.id == retained_b_id
    assert updated_a.file_name == "A updated.pdf"
    assert updated_b.file_name == "B updated.pdf"
    assert new_file.id not in {retained_a_id, retained_b_id, removed_id}
    assert db_session.query(File).filter_by(id=removed_id).one_or_none() is None

    assert db_session.query(DuplicateGroup).count() == 1
    assert db_session.query(DuplicateGroupMember).count() == 2
    assert {member.id for member in db_session.query(DuplicateGroupMember).all()} == member_ids_before
    assert {
        member.file_id for member in db_session.query(DuplicateGroupMember).all()
    } == {retained_a_id, retained_b_id}
    assert db_session.get(ScanResult, scan_result_id) is not None
    assert db_session.get(LargeStaleResult, large_stale_result_id) is not None
    assert db_session.query(ScanResult).filter_by(file_id=removed_id).one_or_none() is None
    assert db_session.query(LargeStaleResult).filter_by(file_id=removed_id).one_or_none() is None


def test_retry_load_failed_uses_same_in_place_file_sync(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    account = _account(
        provider_account_id="provider-retry-sync",
        email="retry-sync@example.com",
        status="load_failed",
        data_state="Parsial",
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    existing = _file(
        account=account,
        file_id="provider-existing",
        file_name="Existing.pdf",
        hash_value="existing-hash",
    )
    db_session.add(existing)
    db_session.commit()
    db_session.refresh(existing)
    existing_id = existing.id
    background_tasks = BackgroundTasks()

    response = trigger_refresh(
        db_session,
        account_id=account.id,
        background_tasks=background_tasks,
    )
    account_id = account.id
    db_session.expunge_all()

    class RetryAdapter:
        def get_quota(self) -> dict[str, int]:
            return {"used_bytes": 30, "total_bytes": 100}

        def fetch_metadata(self) -> list[dict]:
            return [
                _normalized_file(
                    file_id="provider-existing",
                    file_name="Existing updated.pdf",
                    hash_value="existing-hash",
                )
            ]

    monkeypatch.setattr(accounts_service, "SessionLocal", _service_session_factory(db_session))
    monkeypatch.setattr(accounts_service, "get_adapter", lambda *_args, **_kwargs: RetryAdapter())

    accounts_service.execute_refresh_operation(response.operation_id, account_id)
    db_session.expire_all()

    updated_file = db_session.query(File).filter_by(
        account_id=account_id,
        file_id="provider-existing",
    ).one()
    updated_account = db_session.get(Account, account_id)
    assert updated_file.id == existing_id
    assert updated_file.file_name == "Existing updated.pdf"
    assert updated_account is not None
    assert updated_account.status == "active"
    assert updated_account.data_state == "Lengkap"


def test_trigger_refresh_for_load_failed_account_marks_initial_load_context(
    db_session: Session,
) -> None:
    account = Account(
        provider="google",
        provider_account_id="provider-retry",
        email="retry@example.com",
        encrypted_access_token=encrypt_token("access-token"),
        encrypted_refresh_token=encrypt_token("refresh-token"),
        scopes='["scope-a"]',
        status="load_failed",
        data_state="Parsial",
        quota_used_bytes=10,
        quota_total_bytes=100,
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    background_tasks = BackgroundTasks()

    response = trigger_refresh(
        db_session,
        account_id=account.id,
        background_tasks=background_tasks,
    )

    operation = db_session.get(Operation, response.operation_id)
    assert operation is not None
    context = load_context(operation)
    assert context["previous_status"] == "load_failed"
    assert context["previous_data_state"] == "Parsial"
    assert context["triggered_by"] == "initial_load"


def test_trigger_refresh_all_includes_active_and_never_synced_accounts(
    db_session: Session,
) -> None:
    accounts: list[Account] = []
    for index, status in enumerate(["active", "active", "active", "never_synced"], start=1):
        account = Account(
            provider="google",
            provider_account_id=f"provider-{index}",
            email=f"kai-{index}@example.com",
            encrypted_access_token=encrypt_token("access-token"),
            encrypted_refresh_token=encrypt_token("refresh-token"),
            scopes='["scope-a"]',
            status=status,
            data_state="Lengkap" if status == "active" else "BelumTersedia",
            quota_used_bytes=10,
            quota_total_bytes=100,
        )
        db_session.add(account)
        accounts.append(account)
    db_session.commit()
    for account in accounts:
        db_session.refresh(account)
    background_tasks = BackgroundTasks()

    response = trigger_refresh_all(db_session, background_tasks=background_tasks)

    operation_account_ids = {operation.account_id for operation in response.operations}
    assert len(response.operations) == 4
    assert operation_account_ids == {account.id for account in accounts}


def test_reauthorize_mismatch_returns_controlled_error_without_mutating_account(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    account = Account(
        provider="google",
        provider_account_id="provider-original",
        email="original@example.com",
        encrypted_access_token=encrypt_token("old-access-token"),
        encrypted_refresh_token=encrypt_token("old-refresh-token"),
        scopes='["https://www.googleapis.com/auth/drive"]',
        status="active",
        data_state="Lengkap",
        quota_used_bytes=10,
        quota_total_bytes=100,
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    raw_state = accounts_repo.create_oauth_state(
        db_session,
        provider="google",
        mode="reauthorize",
        account_id=account.id,
    )

    class FakeOAuthClient:
        def exchange_code(self, code: str) -> TokenBundle:
            assert code == "callback-code"
            return TokenBundle(
                access_token="new-access-token",
                refresh_token="new-refresh-token",
                expires_at=datetime(2026, 1, 1, 0, 0, 0),
                scopes=["https://www.googleapis.com/auth/drive"],
            )

    class FakeAdapter:
        def get_account_info(self) -> dict[str, str]:
            return {
                "email": "different@example.com",
                "provider_account_id": "provider-different",
                "provider": "google",
            }

        def get_quota(self) -> dict[str, int]:
            raise AssertionError("quota must not be fetched on account mismatch")

    monkeypatch.setattr(accounts_service, "get_oauth_client", lambda _provider, _settings: FakeOAuthClient())
    monkeypatch.setattr(accounts_service, "get_adapter", lambda *_args, **_kwargs: FakeAdapter())
    settings = Settings(frontend_redirect_base_url="http://frontend.test")

    with caplog.at_level(logging.INFO):
        redirect_url = accounts_service.handle_oauth_callback(
            db_session,
            code="callback-code",
            state=raw_state,
            settings=settings,
        )

    db_session.refresh(account)
    accounts = accounts_repo.list_accounts(db_session)
    assert "status=failed" in redirect_url
    assert "error=account_mismatch" in redirect_url
    assert "provider=google" in redirect_url
    assert len(accounts) == 1
    assert account.provider_account_id == "provider-original"
    assert account.email == "original@example.com"
    assert account.status == "active"
    assert account.data_state == "Lengkap"
    assert "Account OAuth callback success" not in caplog.text


class FakeGoogleTokenResponse:
    def __init__(self, payload: dict, status_code: int = 200) -> None:
        self._payload = payload
        self.status_code = status_code

    def json(self) -> dict:
        return self._payload

    def raise_for_status(self) -> None:
        return None


def test_google_extra_scopes_are_allowed_when_drive_scope_present(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_post(*_args, **_kwargs) -> FakeGoogleTokenResponse:
        return FakeGoogleTokenResponse(
            {
                "access_token": "google-access-token",
                "refresh_token": "google-refresh-token",
                "expires_in": 3600,
                "scope": (
                    "https://www.googleapis.com/auth/drive "
                    "openid https://www.googleapis.com/auth/userinfo.email"
                ),
            }
        )

    monkeypatch.setattr(google_drive.httpx, "post", fake_post)
    client = google_drive.GoogleDriveOAuthClient(
        Settings(google_client_id="client-id", google_client_secret="client-secret")
    )

    token_bundle = client.exchange_code("callback-code")

    assert token_bundle.access_token == "google-access-token"
    assert "https://www.googleapis.com/auth/drive" in token_bundle.scopes


def test_google_missing_drive_scope_is_controlled_scope_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_post(*_args, **_kwargs) -> FakeGoogleTokenResponse:
        return FakeGoogleTokenResponse(
            {
                "access_token": "google-access-token",
                "refresh_token": "google-refresh-token",
                "expires_in": 3600,
                "scope": "openid https://www.googleapis.com/auth/userinfo.email",
            }
        )

    monkeypatch.setattr(google_drive.httpx, "post", fake_post)
    client = google_drive.GoogleDriveOAuthClient(
        Settings(google_client_id="client-id", google_client_secret="client-secret")
    )

    with pytest.raises(ScopeInsufficientError):
        client.exchange_code("callback-code")
