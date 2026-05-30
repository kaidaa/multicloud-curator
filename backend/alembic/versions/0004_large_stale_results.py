from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "large_stale_results",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("file_id", sa.String(), nullable=False),
        sa.Column("scan_at", sa.DateTime(), nullable=False),
        sa.Column("trigger_reason", sa.String(), nullable=False),
        sa.Column("is_large", sa.Boolean(), nullable=False),
        sa.Column("is_stale", sa.Boolean(), nullable=False),
        sa.Column("modified_age_months", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["file_id"], ["files.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("file_id", name="uq_large_stale_results_file"),
    )
    op.create_index("ix_large_stale_results_file_id", "large_stale_results", ["file_id"])
    op.create_index("ix_large_stale_results_scan_at", "large_stale_results", ["scan_at"])


def downgrade() -> None:
    op.drop_index("ix_large_stale_results_scan_at", table_name="large_stale_results")
    op.drop_index("ix_large_stale_results_file_id", table_name="large_stale_results")
    op.drop_table("large_stale_results")
