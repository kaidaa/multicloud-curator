from __future__ import annotations

from pydantic import BaseModel


class ScanCoverageResponse(BaseModel):
    covered_account_ids: list[str]
    covered_account_count: int
    eligible_account_count: int
