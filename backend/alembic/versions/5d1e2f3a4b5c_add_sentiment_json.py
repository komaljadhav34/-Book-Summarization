"""add sentiment_json

Revision ID: 5d1e2f3a4b5c
Revises: eba1de248d57
Create Date: 2026-05-06 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5d1e2f3a4b5c'
down_revision = 'eba1de248d57'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('books', sa.Column('sentiment_json', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('books', 'sentiment_json')
