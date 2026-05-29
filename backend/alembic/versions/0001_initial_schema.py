from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "accounts",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("provider_account_id", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("encrypted_access_token", sa.String(), nullable=False),
        sa.Column("encrypted_refresh_token", sa.String(), nullable=False),
        sa.Column("access_token_expires_at", sa.DateTime(), nullable=True),
        sa.Column("scopes", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="never_synced"),
        sa.Column("quota_used_bytes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("quota_total_bytes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_sync_at", sa.DateTime(), nullable=True),
        sa.Column("last_good_sync_at", sa.DateTime(), nullable=True),
        sa.Column("data_state", sa.String(), nullable=False, server_default="BelumTersedia"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint(
            "provider",
            "provider_account_id",
            name="uq_accounts_provider_account",
        ),
    )
    op.create_index("ix_accounts_provider", "accounts", ["provider"])
    op.create_index("ix_accounts_status", "accounts", ["status"])

    op.create_table(
        "sensitive_keywords",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("word", sa.String(), nullable=False, unique=True),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("length(word) >= 2", name="ck_sensitive_keywords_min_length"),
    )
    op.create_index("ix_sensitive_keywords_active", "sensitive_keywords", ["active"])
    op.create_index("ix_sensitive_keywords_category", "sensitive_keywords", ["category"])

    op.create_table(
        "operations",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("operation_type", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("context", sa.String(), nullable=True),
        sa.Column("progress_current", sa.Integer(), nullable=True),
        sa.Column("progress_total", sa.Integer(), nullable=True),
        sa.Column("progress_label", sa.String(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("error_message", sa.String(), nullable=True),
        sa.CheckConstraint(
            "status IN ('queued', 'running', 'completed', 'failed')",
            name="ck_operations_status_valid",
        ),
    )
    op.create_index(
        "idx_operations_type_status",
        "operations",
        ["operation_type", "status"],
    )
    op.create_index("idx_operations_started", "operations", ["started_at"])

    op.create_table(
        "files",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("account_id", sa.String(), nullable=False),
        sa.Column("file_id", sa.String(), nullable=False),
        sa.Column("file_name", sa.String(), nullable=False),
        sa.Column("path", sa.String(), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("mime_type", sa.String(), nullable=True),
        sa.Column("modified_time", sa.DateTime(), nullable=False),
        sa.Column("hash", sa.String(), nullable=True),
        sa.Column("owner_account", sa.String(), nullable=False),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("sharing_status", sa.String(), nullable=True),
        sa.Column("web_view_link", sa.String(), nullable=True),
        sa.Column("trashed", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_folder", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_owned", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["accounts.id"],
            name="fk_files_account_id",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("account_id", "file_id", name="uq_files_account_file"),
    )
    op.create_index("ix_files_account_id", "files", ["account_id"])
    op.create_index("ix_files_modified_time", "files", ["modified_time"])
    op.create_index("ix_files_provider", "files", ["provider"])
    op.create_index("ix_files_sharing_status", "files", ["sharing_status"])
    op.create_index("ix_files_is_owned", "files", ["is_owned"])

    op.create_table(
        "duplicate_groups",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("representative_name", sa.String(), nullable=False),
        sa.Column("match_basis", sa.String(), nullable=False),
        sa.Column("total_size_bytes", sa.Integer(), nullable=False),
        sa.Column("members_count", sa.Integer(), nullable=False),
        sa.Column("scanned_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("members_count >= 2", name="ck_duplicate_groups_min_members"),
    )
    op.create_index("ix_duplicate_groups_scanned_at", "duplicate_groups", ["scanned_at"])

    op.create_table(
        "duplicate_group_members",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("group_id", sa.String(), nullable=False),
        sa.Column("file_id", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(
            ["group_id"],
            ["duplicate_groups.id"],
            name="fk_dgm_group_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["file_id"],
            ["files.id"],
            name="fk_dgm_file_id",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "group_id",
            "file_id",
            name="uq_duplicate_group_members_group_file",
        ),
    )
    op.create_index(
        "ix_duplicate_group_members_group_id",
        "duplicate_group_members",
        ["group_id"],
    )
    op.create_index(
        "ix_duplicate_group_members_file_id",
        "duplicate_group_members",
        ["file_id"],
    )

    op.create_table(
        "scan_results",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("file_id", sa.String(), nullable=False),
        sa.Column("scan_type", sa.String(), nullable=False),
        sa.Column("is_sensitive", sa.Boolean(), nullable=False),
        sa.Column("matched_keywords", sa.String(), nullable=True),
        sa.Column("scanned_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["file_id"],
            ["files.id"],
            name="fk_scan_results_file_id",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("file_id", "scan_type", name="uq_scan_results_file_type"),
    )
    op.create_index("ix_scan_results_scan_type", "scan_results", ["scan_type"])
    op.create_index("ix_scan_results_is_sensitive", "scan_results", ["is_sensitive"])

    op.create_table(
        "action_log",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("file_id", sa.String(), nullable=True),
        sa.Column("account_id", sa.String(), nullable=False),
        sa.Column("executed_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["file_id"],
            ["files.id"],
            name="fk_action_log_file_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["accounts.id"],
            name="fk_action_log_account_id",
            ondelete="CASCADE",
        ),
    )

    seed_time = datetime.now(timezone.utc)
    op.bulk_insert(
        sa.table(
            "sensitive_keywords",
            sa.column("id", sa.String),
            sa.column("word", sa.String),
            sa.column("category", sa.String),
            sa.column("active", sa.Boolean),
            sa.column("created_at", sa.DateTime),
        ),
        [
            {"id": _KTP_ID, "word": "KTP", "category": "default", "active": True, "created_at": seed_time},
            {"id": _NPWP_ID, "word": "NPWP", "category": "default", "active": True, "created_at": seed_time},
            {"id": _BPJS_ID, "word": "BPJS", "category": "default", "active": True, "created_at": seed_time},
        ],
    )


def downgrade() -> None:
    op.drop_table("action_log")
    op.drop_index("ix_scan_results_is_sensitive", table_name="scan_results")
    op.drop_index("ix_scan_results_scan_type", table_name="scan_results")
    op.drop_table("scan_results")
    op.drop_index("ix_duplicate_group_members_file_id", table_name="duplicate_group_members")
    op.drop_index("ix_duplicate_group_members_group_id", table_name="duplicate_group_members")
    op.drop_table("duplicate_group_members")
    op.drop_index("ix_duplicate_groups_scanned_at", table_name="duplicate_groups")
    op.drop_table("duplicate_groups")
    op.drop_index("ix_files_is_owned", table_name="files")
    op.drop_index("ix_files_sharing_status", table_name="files")
    op.drop_index("ix_files_provider", table_name="files")
    op.drop_index("ix_files_modified_time", table_name="files")
    op.drop_index("ix_files_account_id", table_name="files")
    op.drop_table("files")
    op.drop_index("idx_operations_started", table_name="operations")
    op.drop_index("idx_operations_type_status", table_name="operations")
    op.drop_table("operations")
    op.drop_index("ix_sensitive_keywords_category", table_name="sensitive_keywords")
    op.drop_index("ix_sensitive_keywords_active", table_name="sensitive_keywords")
    op.drop_table("sensitive_keywords")
    op.drop_index("ix_accounts_status", table_name="accounts")
    op.drop_index("ix_accounts_provider", table_name="accounts")
    op.drop_table("accounts")
