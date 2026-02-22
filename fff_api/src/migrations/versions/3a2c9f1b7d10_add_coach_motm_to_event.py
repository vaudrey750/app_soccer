"""add coach motm to event

Revision ID: 3a2c9f1b7d10
Revises: 0b1f2e3d4c5a
Create Date: 2026-02-22

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3a2c9f1b7d10'
down_revision: Union[str, None] = '0b1f2e3d4c5a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'event',
        sa.Column('coach_motm_member_id', sa.UUID(), nullable=True),
        schema='core',
    )
    op.create_foreign_key(
        'fk_event_coach_motm_member_id',
        'event',
        'member',
        ['coach_motm_member_id'],
        ['id'],
        source_schema='core',
        referent_schema='core',
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_event_coach_motm_member_id', 'event', schema='core', type_='foreignkey')
    op.drop_column('event', 'coach_motm_member_id', schema='core')
