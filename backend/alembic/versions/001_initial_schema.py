"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-03-09

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("google_id", sa.String(255), nullable=False),
        sa.Column("week_start_day", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.UniqueConstraint("google_id", name="uq_users_google_id"),
        sa.CheckConstraint("week_start_day >= 0 AND week_start_day <= 6", name="ck_users_week_start_day"),
    )

    op.create_table(
        "budgets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False, server_default="Weekly Budget"),
        sa.Column("weekly_amount", sa.Numeric(precision=12, scale=2), nullable=False, server_default="100.00"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_budgets_user_id", ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", name="uq_budgets_user_id"),
        sa.CheckConstraint("weekly_amount > 0", name="ck_budgets_weekly_amount_positive"),
    )

    op.create_table(
        "entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("budget_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("type", sa.String(10), nullable=False),
        sa.Column("memo", sa.Text(), nullable=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_entries_user_id", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["budget_id"], ["budgets.id"], name="fk_entries_budget_id", ondelete="CASCADE"),
        sa.CheckConstraint("amount > 0", name="ck_entries_amount_positive"),
        sa.CheckConstraint("type IN ('expense', 'credit')", name="ck_entries_type"),
    )

    # Composite indexes for query performance
    op.create_index("ix_entries_budget_id_date", "entries", ["budget_id", "date"])
    op.create_index("ix_entries_user_id_date_created_at", "entries", ["user_id", "date", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_entries_user_id_date_created_at", table_name="entries")
    op.drop_index("ix_entries_budget_id_date", table_name="entries")
    op.drop_table("entries")
    op.drop_table("budgets")
    op.drop_table("users")
