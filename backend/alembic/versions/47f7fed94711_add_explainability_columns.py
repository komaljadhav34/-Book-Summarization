"""add_explainability_columns

Revision ID: 47f7fed94711
Revises: 12db7745be9e
Create Date: 2026-02-24 23:15:54.012647

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '47f7fed94711'
down_revision: Union[str, Sequence[str], None] = '12db7745be9e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('books', sa.Column('chunks_json', sa.JSON(), nullable=True))
    op.add_column('summaries', sa.Column('source_mapping', sa.JSON(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('summaries', 'source_mapping')
    op.drop_column('books', 'chunks_json')

