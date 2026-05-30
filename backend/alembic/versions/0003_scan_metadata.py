from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "scan_metadata",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("scan_type", sa.String(), nullable=False),
        sa.Column("scan_at", sa.DateTime(), nullable=False),
        sa.Column("covered_account_ids", sa.String(), nullable=False),
        sa.Column("eligible_account_count", sa.Integer(), nullable=False),
        sa.UniqueConstraint("scan_type", name="uq_scan_metadata_scan_type"),
    )
    op.create_index("ix_scan_metadata_scan_type", "scan_metadata", ["scan_type"])
    op.create_index("ix_scan_metadata_scan_at", "scan_metadata", ["scan_at"])


def downgrade() -> None:
    op.drop_index("ix_scan_metadata_scan_at", table_name="scan_metadata")
    op.drop_index("ix_scan_metadata_scan_type", table_name="scan_metadata")
    op.drop_table("scan_metadata")
