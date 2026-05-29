from __future__ import annotations

from typing import Literal

Provider = Literal["google", "dropbox"]

AccountStatus = Literal[
    "never_synced",
    "syncing",
    "active",
    "token_invalid",
    "revoked",
    "load_failed",
]

DataState = Literal["BelumTersedia", "Parsial", "Lengkap"]

OperationType = Literal["refresh", "duplicates_scan", "security_scan"]

OperationStatus = Literal["queued", "running", "completed", "failed"]

SharingStatus = Literal["public", "private"]

KeywordCategory = Literal["default", "custom"]

MatchBasis = Literal["hash", "name_size"]

ActionType = Literal["delete", "change_permission"]
