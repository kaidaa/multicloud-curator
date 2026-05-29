from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("files") as batch_op:
        batch_op.add_column(sa.Column("location_type", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("open_url", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("open_url_type", sa.String(), nullable=True))
        batch_op.add_column(
            sa.Column(
                "has_public_shared_link",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )
        batch_op.add_column(sa.Column("shared_link_url", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("shared_link_visibility", sa.String(), nullable=True))
        batch_op.drop_column("web_view_link")


def downgrade() -> None:
    with op.batch_alter_table("files") as batch_op:
        batch_op.add_column(sa.Column("web_view_link", sa.String(), nullable=True))
        batch_op.drop_column("shared_link_visibility")
        batch_op.drop_column("shared_link_url")
        batch_op.drop_column("has_public_shared_link")
        batch_op.drop_column("open_url_type")
        batch_op.drop_column("open_url")
        batch_op.drop_column("location_type")
