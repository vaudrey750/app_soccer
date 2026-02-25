"""add member access block

Revision ID: 4a1c2f0b8d9e
Revises: 3a2c9f1b7d10
Create Date: 2026-02-23

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4a1c2f0b8d9e"
down_revision: Union[str, None] = "3a2c9f1b7d10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "member",
        sa.Column(
            "is_access_blocked",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        schema="core",
    )
    op.alter_column("member", "is_access_blocked", server_default=None, schema="core")


def downgrade() -> None:
    op.drop_column("member", "is_access_blocked", schema="core")
