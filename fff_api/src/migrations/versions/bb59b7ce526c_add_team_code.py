"""add team code

Revision ID: bb59b7ce526c
Revises: 9458bee1bfec
Create Date: 2026-01-23 23:30:57.063087

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'bb59b7ce526c'
down_revision: Union[str, None] = '9458bee1bfec'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('team', sa.Column('code', sa.Integer(), nullable=True), schema='reference')


def downgrade() -> None:
    op.drop_column('team', 'code', schema='reference')
