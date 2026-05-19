"""Files Visibility API routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.features.files_visibility.schemas import (
    FileActivityItemResponse,
    QuotaSummaryResponse,
    SearchProviderFilter,
    SearchSort,
    SearchTypeFilter,
)
from app.features.files_visibility.service import get_quota_summary, list_activity, search_files
from app.shared.api_envelope import DataEnvelope, EnvelopeMeta

router = APIRouter(tags=["files visibility"])


@router.get("/api/files/activity", response_model=DataEnvelope[list[FileActivityItemResponse]])
async def files_activity(
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
) -> DataEnvelope[list[FileActivityItemResponse]]:
    data, snapshot_at = list_activity(db, limit=limit)
    return DataEnvelope(data=data, meta=EnvelopeMeta(snapshot_at=snapshot_at))


@router.get("/api/files/search", response_model=DataEnvelope[list[FileActivityItemResponse]])
async def files_search(
    q: str = Query(...),
    owned_only: bool = Query(default=False),
    provider: SearchProviderFilter = Query(default="all"),
    file_type: SearchTypeFilter = Query(default="all", alias="type"),
    sort: SearchSort = Query(default="modified_desc"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> DataEnvelope[list[FileActivityItemResponse]]:
    data, total, snapshot_at = search_files(
        db,
        query=q,
        owned_only=owned_only,
        provider=provider,
        file_type=file_type,
        sort=sort,
        limit=limit,
        offset=offset,
    )
    return DataEnvelope(
        data=data,
        meta=EnvelopeMeta(
            snapshot_at=snapshot_at,
            pagination={"limit": limit, "offset": offset, "total": total},
        ),
    )


@router.get("/api/quota", response_model=DataEnvelope[QuotaSummaryResponse])
async def quota_summary(db: Session = Depends(get_db)) -> DataEnvelope[QuotaSummaryResponse]:
    data, snapshot_at = get_quota_summary(db)
    return DataEnvelope(data=data, meta=EnvelopeMeta(snapshot_at=snapshot_at))
