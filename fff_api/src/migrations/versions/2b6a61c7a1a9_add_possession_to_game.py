"""add possession to game

Revision ID: 2b6a61c7a1a9
Revises: a5359d449f81
Create Date: 2026-02-22

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2b6a61c7a1a9'
down_revision: Union[str, None] = 'a5359d449f81'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('game', sa.Column('possession_home', sa.Integer(), nullable=True), schema='reference')


def downgrade() -> None:
    op.drop_column('game', 'possession_home', schema='reference')
