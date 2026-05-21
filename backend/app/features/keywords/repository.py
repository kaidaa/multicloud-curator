"""Persistence helpers for keyword management."""

from __future__ import annotations

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.features.keywords.models import SensitiveKeyword


def list_keywords(db: Session) -> list[SensitiveKeyword]:
    return list(
        db.execute(
            select(SensitiveKeyword).order_by(
                case((SensitiveKeyword.category == "default", 0), else_=1),
                SensitiveKeyword.word.asc(),
            )
        )
        .scalars()
        .all()
    )


def get_keyword(db: Session, keyword_id: str) -> SensitiveKeyword | None:
    return db.get(SensitiveKeyword, keyword_id)


def get_keyword_by_word_casefold(db: Session, word: str) -> SensitiveKeyword | None:
    return db.execute(
        select(SensitiveKeyword).where(func.lower(SensitiveKeyword.word) == word.lower())
    ).scalar_one_or_none()


def create_keyword(db: Session, *, word: str) -> SensitiveKeyword:
    keyword = SensitiveKeyword(word=word, category="custom", active=True)
    db.add(keyword)
    db.commit()
    db.refresh(keyword)
    return keyword


def toggle_keyword(db: Session, keyword: SensitiveKeyword) -> SensitiveKeyword:
    keyword.active = not keyword.active
    db.commit()
    db.refresh(keyword)
    return keyword


def delete_keyword(db: Session, keyword: SensitiveKeyword) -> None:
    db.delete(keyword)
    db.commit()
