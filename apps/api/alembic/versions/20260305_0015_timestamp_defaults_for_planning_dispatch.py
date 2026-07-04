"""Backfill timestamp defaults for planning and dispatch governance tables.

Revision ID: 20260305_0015
Revises: 20260304_0014
Create Date: 2026-03-05 14:05:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260305_0015"
down_revision: str | None = "20260304_0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _set_timestamp_defaults(server_default) -> None:
    for table_name in (
        "planning_horizons",
        "worker_shift_templates",
        "worker_shift_break_rules",
        "plan_dispatch_queues",
        "plan_dispatch_queue_templates",
    ):
        with op.batch_alter_table(table_name, schema=None) as batch_op:
            batch_op.alter_column(
                "created_at",
                existing_type=sa.DateTime(timezone=True),
                nullable=False,
                server_default=server_default,
            )
            batch_op.alter_column(
                "updated_at",
                existing_type=sa.DateTime(timezone=True),
                nullable=False,
                server_default=server_default,
            )


def upgrade() -> None:
    _set_timestamp_defaults(sa.func.now())


def downgrade() -> None:
    _set_timestamp_defaults(None)
