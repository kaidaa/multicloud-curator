"""Pydantic schemas for keyword management endpoints."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class KeywordResponse(BaseModel):
    id: str
    word: str
    category: Literal["default", "custom"]
    active: bool
    created_at: str


class KeywordCreateRequest(BaseModel):
    word: str
