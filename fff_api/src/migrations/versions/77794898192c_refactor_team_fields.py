"""refactor team fields

Revision ID: 77794898192c
Revises: bb59b7ce526c
Create Date: 2026-01-23 23:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '77794898192c'
down_revision: Union[str, None] = 'bb59b7ce526c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop old columns
    op.drop_column('team', 'full_name', schema='reference')
    op.drop_column('team', 'logo', schema='reference')

    # Add new column
    op.add_column('team', sa.Column('category', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True), schema='reference')

    # Add unique constraint
    op.create_unique_constraint('uq_team_name_category_code', 'team', ['name', 'category', 'code'], schema='reference')


def downgrade() -> None:
    # Drop unique constraint
    op.drop_constraint('uq_team_name_category_code', 'team', schema='reference', type_='unique')

    # Drop new column
    op.drop_column('team', 'category', schema='reference')

    # Add old columns
    op.add_column('team', sa.Column('logo', sa.VARCHAR(length=255), autoincrement=False, nullable=True), schema='reference')
    op.add_column('team', sa.Column('full_name', sa.VARCHAR(length=255), autoincrement=False, nullable=True), schema='reference')
