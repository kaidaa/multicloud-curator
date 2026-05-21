from __future__ import annotations

from datetime import datetime

import pytest
from sqlalchemy.orm import Session

from app.features.keywords.models import SensitiveKeyword
from app.features.keywords.service import add_keyword, delete_keyword, list_keywords, toggle_keyword
from app.shared.exceptions import ValidationError


def _keyword(
    *,
    word: str,
    category: str,
    active: bool = True,
) -> SensitiveKeyword:
    return SensitiveKeyword(
        word=word,
        category=category,
        active=active,
        created_at=datetime(2026, 1, 1, 0, 0, 0),
    )


def test_list_keywords_returns_default_and_custom(db_session: Session) -> None:
    db_session.add_all(
        [
            _keyword(word="KTP", category="default"),
            _keyword(word="NPWP", category="default"),
            _keyword(word="rahasia", category="custom"),
        ]
    )
    db_session.commit()

    result = list_keywords(db_session)

    assert [(item.word, item.category, item.active) for item in result] == [
        ("KTP", "default", True),
        ("NPWP", "default", True),
        ("rahasia", "custom", True),
    ]


def test_add_custom_keyword_validates_trim_length_and_duplicate(
    db_session: Session,
) -> None:
    db_session.add(_keyword(word="KTP", category="default"))
    db_session.commit()

    created = add_keyword(db_session, word=" rahasia ")

    assert created.word == "rahasia"
    assert created.category == "custom"
    assert created.active is True
    with pytest.raises(ValidationError):
        add_keyword(db_session, word="R")
    with pytest.raises(ValidationError):
        add_keyword(db_session, word="x" * 101)
    with pytest.raises(ValidationError):
        add_keyword(db_session, word="ktp")


def test_toggle_default_and_custom(db_session: Session) -> None:
    default = _keyword(word="KTP", category="default", active=True)
    custom = _keyword(word="rahasia", category="custom", active=False)
    db_session.add_all([default, custom])
    db_session.commit()
    db_session.refresh(default)
    db_session.refresh(custom)

    toggled_default = toggle_keyword(db_session, keyword_id=default.id)
    toggled_custom = toggle_keyword(db_session, keyword_id=custom.id)

    assert toggled_default.active is False
    assert toggled_custom.active is True


def test_delete_custom_and_reject_default(db_session: Session) -> None:
    default = _keyword(word="KTP", category="default")
    custom = _keyword(word="rahasia", category="custom")
    db_session.add_all([default, custom])
    db_session.commit()
    db_session.refresh(default)
    db_session.refresh(custom)

    delete_keyword(db_session, keyword_id=custom.id)

    assert db_session.get(SensitiveKeyword, custom.id) is None
    with pytest.raises(ValidationError):
        delete_keyword(db_session, keyword_id=default.id)
