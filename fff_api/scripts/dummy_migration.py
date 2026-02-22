from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_timer_fields_to_game'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # We are using raw SQL or SQLModel directly, usually alembic would generate this.
    # Since we don't have full alembic setup visible or we are manually managing it via scripts...
    # Let's perform a raw SQL execution via a helper script instead of full migration file if alembic is not configured perfectly.
    pass

def downgrade():
    pass
