"""add team_id and exercises to event

Revision ID: 9c8d1e4a7f0b
Revises: 5b7d2b1c9f21
Create Date: 2026-02-24

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9c8d1e4a7f0b"
down_revision: Union[str, None] = "5b7d2b1c9f21"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "event",
        sa.Column("team_id", sa.Uuid(), nullable=True),
        schema="core",
    )
    op.add_column(
        "event",
        sa.Column("exercises", sa.JSON(), nullable=True),
        schema="core",
    )

    op.create_foreign_key(
        "fk_event_team_id",
        source_table="event",
        referent_table="team",
        local_cols=["team_id"],
        remote_cols=["id"],
        source_schema="core",
        referent_schema="reference",
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_event_team_id",
        "event",
        schema="core",
        type_="foreignkey",
    )
    op.drop_column("event", "exercises", schema="core")
    op.drop_column("event", "team_id", schema="core")
