from __future__ import annotations

from sqlalchemy.orm import Session

from app.features.accounts.models import Account
from app.features.async_operations import repository as ops_repo
from app.features.async_operations.service import recover_orphan_operations, to_operation_response


def test_operation_response_maps_progress_and_context(db_session: Session) -> None:
    operation = ops_repo.create_operation(
        db_session,
        operation_type="refresh",
        context={"account_id": "acc-1", "previous_status": "active"},
    )
    ops_repo.mark_running(db_session, operation, label="Mengambil metadata")
    ops_repo.update_progress(db_session, operation, current=2, total=5, label="Menyimpan metadata")

    response = to_operation_response(operation)

    assert response.operation_id == operation.id
    assert response.status == "running"
    assert response.context == {"account_id": "acc-1", "previous_status": "active"}
    assert response.progress is not None
    assert response.progress.current == 2
    assert response.progress.total == 5


def test_recover_orphan_refresh_restores_previous_status(db_session: Session) -> None:
    account = Account(
        provider="google",
        provider_account_id="provider-1",
        email="kai@example.com",
        encrypted_access_token="encrypted-access",
        encrypted_refresh_token="encrypted-refresh",
        scopes="[]",
        status="syncing",
        data_state="Lengkap",
        quota_used_bytes=10,
        quota_total_bytes=100,
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    operation = ops_repo.create_operation(
        db_session,
        operation_type="refresh",
        context={
            "account_id": account.id,
            "previous_status": "active",
            "previous_data_state": "Lengkap",
        },
    )
    ops_repo.mark_running(db_session, operation)

    recovered = recover_orphan_operations(db_session)

    db_session.refresh(account)
    db_session.refresh(operation)
    assert recovered == 1
    assert account.status == "active"
    assert operation.status == "failed"
    assert operation.error_message == "Backend restart saat operation berjalan"


def test_recover_orphan_initial_load_sets_load_failed(db_session: Session) -> None:
    account = Account(
        provider="google",
        provider_account_id="provider-initial",
        email="initial@example.com",
        encrypted_access_token="encrypted-access",
        encrypted_refresh_token="encrypted-refresh",
        scopes="[]",
        status="syncing",
        data_state="Parsial",
        quota_used_bytes=10,
        quota_total_bytes=100,
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    operation = ops_repo.create_operation(
        db_session,
        operation_type="refresh",
        context={
            "account_id": account.id,
            "previous_status": "never_synced",
            "previous_data_state": "Parsial",
            "triggered_by": "initial_load",
        },
    )
    ops_repo.mark_running(db_session, operation)

    recovered = recover_orphan_operations(db_session)

    db_session.refresh(account)
    db_session.refresh(operation)
    assert recovered == 1
    assert account.status == "load_failed"
    assert account.data_state == "Parsial"
    assert operation.status == "failed"
    assert operation.error_message == "Backend restart saat operation berjalan"
