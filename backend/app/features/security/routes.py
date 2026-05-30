from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.features.security.schemas import (
    BatchRevokeRequest,
    BatchRevokeResponse,
    SecurityMode,
    SecurityProviderFilter,
    SecurityPublicFileResponse,
    SecurityScanResponse,
)
from app.features.security.service import (
    batch_revoke_files,
    list_public_files,
    trigger_security_scan,
)
from app.shared.api_envelope import DataEnvelope, EnvelopeMeta

router = APIRouter(tags=["security"])


@router.post(
    "/api/scan/security",
    response_model=DataEnvelope[SecurityScanResponse],
    status_code=status.HTTP_202_ACCEPTED,
)
async def scan_security(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> DataEnvelope[SecurityScanResponse]:
    return DataEnvelope(data=trigger_security_scan(db, background_tasks=background_tasks))


@router.get(
    "/api/security/public-files",
    response_model=DataEnvelope[list[SecurityPublicFileResponse]],
)
async def security_public_files(
    mode: SecurityMode = Query(default="sensitive"),
    provider: SecurityProviderFilter = Query(default="all"),
    db: Session = Depends(get_db),
) -> DataEnvelope[list[SecurityPublicFileResponse]]:
    data, scan_at, coverage = list_public_files(db, mode=mode, provider=provider)
    return DataEnvelope(
        data=data,
        meta=EnvelopeMeta(
            scan_at=scan_at,
            coverage=coverage.model_dump() if coverage is not None else None,
        ),
    )


@router.post("/api/files/batch-revoke", response_model=DataEnvelope[BatchRevokeResponse])
async def files_batch_revoke(
    payload: BatchRevokeRequest,
    db: Session = Depends(get_db),
) -> DataEnvelope[BatchRevokeResponse]:
    return DataEnvelope(data=batch_revoke_files(db, ids=payload.ids))
