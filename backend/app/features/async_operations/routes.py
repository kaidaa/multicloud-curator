from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.features.async_operations.schemas import OperationResponse
from app.features.async_operations.service import get_status
from app.shared.api_envelope import DataEnvelope

router = APIRouter(prefix="/api/operations", tags=["async operations"])


@router.get("/{operation_id}", response_model=DataEnvelope[OperationResponse])
async def get_operation_status(
    operation_id: str,
    db: Session = Depends(get_db),
) -> DataEnvelope[OperationResponse]:
    return DataEnvelope(data=get_status(db, operation_id))
