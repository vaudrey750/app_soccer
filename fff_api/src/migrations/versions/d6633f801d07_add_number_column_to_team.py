"""Add number column to team

Revision ID: d6633f801d07
Revises: 77794898192c
Create Date: 2026-01-24 02:51:47.995799

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'd6633f801d07'
down_revision: Union[str, None] = '77794898192c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('team', sa.Column('number', sa.Integer(), nullable=True), schema='reference')


def downgrade() -> None:
    op.drop_column('team', 'number', schema='reference')
