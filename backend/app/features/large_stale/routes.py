"""Large/stale file API routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.features.large_stale.schemas import (
    LargeStaleFileResponse,
    LargeStaleSort,
    LargeStaleTypeFilter,
)
from app.features.large_stale.service import (
    LARGE_THRESHOLD_PERCENT_META,
    STALE_MONTHS,
    list_large_stale_files,
)
from app.shared.api_envelope import DataEnvelope, EnvelopeMeta

router = APIRouter(tags=["large stale"])


@router.get("/api/files/large-stale", response_model=DataEnvelope[list[LargeStaleFileResponse]])
async def files_large_stale(
    file_type: LargeStaleTypeFilter = Query(default="all", alias="type"),
    sort: LargeStaleSort = Query(default="size_desc"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> DataEnvelope[list[LargeStaleFileResponse]]:
    data, total, snapshot_at = list_large_stale_files(
        db,
        file_type=file_type,
        sort=sort,
        limit=limit,
        offset=offset,
    )
    return DataEnvelope(
        data=data,
        meta=EnvelopeMeta(
            snapshot_at=snapshot_at,
            thresholds={
                "large_percent_of_quota": LARGE_THRESHOLD_PERCENT_META,
                "stale_months": STALE_MONTHS,
            },
            pagination={"limit": limit, "offset": offset, "total": total},
        ),
    )
