"""Keyword management API routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.features.keywords.schemas import KeywordCreateRequest, KeywordResponse
from app.features.keywords.service import add_keyword, delete_keyword, list_keywords, toggle_keyword
from app.shared.api_envelope import DataEnvelope

router = APIRouter(tags=["keywords"])


@router.get("/api/keywords", response_model=DataEnvelope[list[KeywordResponse]])
async def keywords_list(db: Session = Depends(get_db)) -> DataEnvelope[list[KeywordResponse]]:
    return DataEnvelope(data=list_keywords(db))


@router.post(
    "/api/keywords",
    response_model=DataEnvelope[KeywordResponse],
    status_code=status.HTTP_201_CREATED,
)
async def keywords_create(
    payload: KeywordCreateRequest,
    db: Session = Depends(get_db),
) -> DataEnvelope[KeywordResponse]:
    return DataEnvelope(data=add_keyword(db, word=payload.word))


@router.patch("/api/keywords/{keyword_id}/toggle", response_model=DataEnvelope[KeywordResponse])
async def keywords_toggle(
    keyword_id: str,
    db: Session = Depends(get_db),
) -> DataEnvelope[KeywordResponse]:
    return DataEnvelope(data=toggle_keyword(db, keyword_id=keyword_id))


@router.delete(
    "/api/keywords/{keyword_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def keywords_delete(keyword_id: str, db: Session = Depends(get_db)) -> Response:
    delete_keyword(db, keyword_id=keyword_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
