"""Add address fields to Member

Revision ID: 1f2f3aebb684
Revises: addccb30aca0
Create Date: 2026-02-10 20:57:23.513641

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '1f2f3aebb684'
down_revision: Union[str, None] = 'addccb30aca0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Manual adjustment: Only add columns to existing table
    op.add_column('member', sa.Column('address', sqlmodel.sql.sqltypes.AutoString(length=255), nullable=True), schema='core')
    op.add_column('member', sa.Column('city', sqlmodel.sql.sqltypes.AutoString(length=100), nullable=True), schema='core')
    op.add_column('member', sa.Column('postal_code', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=True), schema='core')
    op.add_column('member', sa.Column('country', sqlmodel.sql.sqltypes.AutoString(length=100), nullable=True), schema='core')


def downgrade() -> None:
    op.drop_column('member', 'country', schema='core')
    op.drop_column('member', 'postal_code', schema='core')
    op.drop_column('member', 'city', schema='core')
    op.drop_column('member', 'address', schema='core')
