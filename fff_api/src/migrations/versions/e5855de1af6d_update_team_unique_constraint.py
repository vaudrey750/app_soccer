"""update_team_unique_constraint

Revision ID: e5855de1af6d
Revises: d6633f801d07
Create Date: 2026-01-24 03:24:18.707262

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5855de1af6d'
down_revision: Union[str, None] = 'd6633f801d07'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop old uniqueness constraint
    op.drop_constraint('uq_team_name_category_code', 'team', schema='reference', type_='unique')
    # Add new uniqueness constraint including number
    op.create_unique_constraint('uq_team_name_category_code_number', 'team', ['name', 'category', 'code', 'number'], schema='reference')


def downgrade() -> None:
    # Remove new constraint
    op.drop_constraint('uq_team_name_category_code_number', 'team', schema='reference', type_='unique')
    # Restore old constraint
    op.create_unique_constraint('uq_team_name_category_code', 'team', ['name', 'category', 'code'], schema='reference')
