from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.features.keywords import repository
from app.features.keywords.models import SensitiveKeyword
from app.features.keywords.schemas import KeywordResponse
from app.shared.exceptions import NotFoundError, ValidationError


def _iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat().replace("+00:00", "Z")


def _to_response(keyword: SensitiveKeyword) -> KeywordResponse:
    return KeywordResponse(
        id=keyword.id,
        word=keyword.word,
        category=keyword.category,
        active=keyword.active,
        created_at=_iso(keyword.created_at),
    )


def _validate_word(word: str) -> str:
    normalized = word.strip()
    if len(normalized) < 2:
        raise ValidationError("Keyword minimum 2 karakter", details={"field": "word", "min_length": 2})
    if len(normalized) > 100:
        raise ValidationError("Keyword maksimum 100 karakter", details={"field": "word", "max_length": 100})
    return normalized


def list_keywords(db: Session) -> list[KeywordResponse]:
    return [_to_response(keyword) for keyword in repository.list_keywords(db)]


def add_keyword(db: Session, *, word: str) -> KeywordResponse:
    normalized = _validate_word(word)
    existing = repository.get_keyword_by_word_casefold(db, normalized)
    if existing is not None:
        raise ValidationError(
            "Keyword sudah ada",
            details={"field": "word", "existing_keyword_id": existing.id},
        )
    return _to_response(repository.create_keyword(db, word=normalized))


def toggle_keyword(db: Session, *, keyword_id: str) -> KeywordResponse:
    keyword = repository.get_keyword(db, keyword_id)
    if keyword is None:
        raise NotFoundError("Keyword tidak ditemukan", details={"keyword_id": keyword_id})
    return _to_response(repository.toggle_keyword(db, keyword))


def delete_keyword(db: Session, *, keyword_id: str) -> None:
    keyword = repository.get_keyword(db, keyword_id)
    if keyword is None:
        raise NotFoundError("Keyword tidak ditemukan", details={"keyword_id": keyword_id})
    if keyword.category == "default":
        raise ValidationError("Keyword default tidak dapat dihapus, hanya bisa dinonaktifkan")
    repository.delete_keyword(db, keyword)
