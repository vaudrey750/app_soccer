"""add motm vote table

Revision ID: 0b1f2e3d4c5a
Revises: 2b6a61c7a1a9
Create Date: 2026-02-22

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0b1f2e3d4c5a'
down_revision: Union[str, None] = '2b6a61c7a1a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    motm_vote_exists = bind.execute(
        sa.text("SELECT to_regclass(:tbl)")
        .bindparams(tbl="core.motm_vote")
    ).scalar() is not None

    if not motm_vote_exists:
        op.create_table(
            'motm_vote',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('event_id', sa.UUID(), nullable=False),
            sa.Column('voter_member_id', sa.UUID(), nullable=False),
            sa.Column('voted_member_id', sa.UUID(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['event_id'], ['core.event.id']),
            sa.ForeignKeyConstraint(['voter_member_id'], ['core.member.id']),
            sa.ForeignKeyConstraint(['voted_member_id'], ['core.member.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('event_id', 'voter_member_id', name='uq_motm_vote_event_voter'),
            schema='core',
        )

    ix_event_exists = bind.execute(
        sa.text("SELECT to_regclass(:idx)")
        .bindparams(idx="core.ix_motm_vote_event_id")
    ).scalar() is not None
    if not ix_event_exists:
        op.create_index('ix_motm_vote_event_id', 'motm_vote', ['event_id'], unique=False, schema='core')

    ix_voter_exists = bind.execute(
        sa.text("SELECT to_regclass(:idx)")
        .bindparams(idx="core.ix_motm_vote_voter_member_id")
    ).scalar() is not None
    if not ix_voter_exists:
        op.create_index('ix_motm_vote_voter_member_id', 'motm_vote', ['voter_member_id'], unique=False, schema='core')


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS core.ix_motm_vote_voter_member_id")
    op.execute("DROP INDEX IF EXISTS core.ix_motm_vote_event_id")
    op.execute("DROP TABLE IF EXISTS core.motm_vote CASCADE")
