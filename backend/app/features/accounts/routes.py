"""Account management API routes."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from fastapi.responses import RedirectResponse, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.features.accounts.schemas import (
    AccountResponse,
    ConnectInitiateRequest,
    OAuthInitiateResponse,
    RefreshAllResponse,
    RefreshOperationResponse,
)
from app.features.accounts.service import (
    disconnect_account,
    handle_oauth_callback,
    initiate_connect,
    initiate_reauthorize,
    list_accounts,
    trigger_refresh,
    trigger_refresh_all,
)
from app.shared.api_envelope import DataEnvelope, EnvelopeMeta

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.post("/connect/initiate", response_model=DataEnvelope[OAuthInitiateResponse])
async def connect_initiate(
    payload: ConnectInitiateRequest,
    db: Session = Depends(get_db),
) -> DataEnvelope[OAuthInitiateResponse]:
    return DataEnvelope(data=initiate_connect(db, provider=payload.provider))


@router.get("/connect/callback", include_in_schema=True)
async def connect_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> RedirectResponse:
    redirect_url = handle_oauth_callback(
        db,
        code=code,
        state=state,
        provider_error=error,
    )
    return RedirectResponse(url=redirect_url, status_code=302)


@router.get("", response_model=DataEnvelope[list[AccountResponse]])
async def accounts_list(db: Session = Depends(get_db)) -> DataEnvelope[list[AccountResponse]]:
    return DataEnvelope(
        data=list_accounts(db),
        meta=EnvelopeMeta(snapshot_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")),
    )


@router.post("/{account_id}/refresh", response_model=DataEnvelope[RefreshOperationResponse], status_code=202)
async def refresh_account(
    account_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> DataEnvelope[RefreshOperationResponse]:
    return DataEnvelope(data=trigger_refresh(db, account_id=account_id, background_tasks=background_tasks))


@router.post("/refresh-all", response_model=DataEnvelope[RefreshAllResponse], status_code=202)
async def refresh_all_accounts(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> DataEnvelope[RefreshAllResponse]:
    return DataEnvelope(data=trigger_refresh_all(db, background_tasks=background_tasks))


@router.post("/{account_id}/reauthorize", response_model=DataEnvelope[OAuthInitiateResponse])
async def reauthorize_account(
    account_id: str,
    db: Session = Depends(get_db),
) -> DataEnvelope[OAuthInitiateResponse]:
    return DataEnvelope(data=initiate_reauthorize(db, account_id=account_id))


@router.delete("/{account_id}", status_code=204)
async def account_disconnect(
    account_id: str,
    db: Session = Depends(get_db),
) -> Response:
    disconnect_account(db, account_id)
    return Response(status_code=204)
