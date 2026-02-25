"""add active season to tenant

Revision ID: 5b7d2b1c9f21
Revises: 4a1c2f0b8d9e
Create Date: 2026-02-24

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "5b7d2b1c9f21"
down_revision: Union[str, None] = "4a1c2f0b8d9e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tenant",
        sa.Column("active_season_name", sa.String(length=50), nullable=True),
        schema="saas",
    )
    op.create_foreign_key(
        "fk_tenant_active_season_name",
        source_table="tenant",
        referent_table="season",
        local_cols=["active_season_name"],
        remote_cols=["name"],
        source_schema="saas",
        referent_schema="reference",
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_tenant_active_season_name",
        "tenant",
        schema="saas",
        type_="foreignkey",
    )
    op.drop_column("tenant", "active_season_name", schema="saas")
