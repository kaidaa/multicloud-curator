from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.features.duplicates.schemas import (
    BatchDeleteRequest,
    BatchDeleteResponse,
    DuplicateGroupResponse,
    DuplicateProviderFilter,
    DuplicatesScanResponse,
    DuplicateTypeFilter,
)
from app.features.duplicates.service import (
    batch_delete_files,
    list_duplicate_groups,
    trigger_duplicates_scan,
)
from app.shared.api_envelope import DataEnvelope, EnvelopeMeta

router = APIRouter(tags=["duplicates"])


@router.post("/api/scan/duplicates", response_model=DataEnvelope[DuplicatesScanResponse], status_code=202)
async def scan_duplicates(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> DataEnvelope[DuplicatesScanResponse]:
    return DataEnvelope(data=trigger_duplicates_scan(db, background_tasks=background_tasks))


@router.get("/api/duplicates", response_model=DataEnvelope[list[DuplicateGroupResponse]])
async def duplicates_list(
    file_type: DuplicateTypeFilter = Query(default="all", alias="type"),
    provider: DuplicateProviderFilter = Query(default="all"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> DataEnvelope[list[DuplicateGroupResponse]]:
    data, total, scan_at, coverage = list_duplicate_groups(
        db,
        file_type=file_type,
        provider=provider,
        limit=limit,
        offset=offset,
    )
    return DataEnvelope(
        data=data,
        meta=EnvelopeMeta(
            snapshot_at=None,
            scan_at=scan_at,
            coverage=coverage.model_dump() if coverage is not None else None,
            pagination={"limit": limit, "offset": offset, "total": total},
        ),
    )


@router.post("/api/files/batch-delete", response_model=DataEnvelope[BatchDeleteResponse])
async def files_batch_delete(
    payload: BatchDeleteRequest,
    db: Session = Depends(get_db),
) -> DataEnvelope[BatchDeleteResponse]:
    return DataEnvelope(data=batch_delete_files(db, ids=payload.ids))
