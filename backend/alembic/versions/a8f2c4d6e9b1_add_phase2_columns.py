"""add_phase2_columns

Revision ID: a8f2c4d6e9b1
Revises: eba1de248d57
Create Date: 2026-03-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a8f2c4d6e9b1'
down_revision: Union[str, Sequence[str], None] = 'eba1de248d57'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add Phase 2 columns: summary_format, summary_role, topics, word counts, source_type."""
    # --- summaries table ---
    op.add_column('summaries', sa.Column('summary_format', sa.String(20), nullable=True))
    op.add_column('summaries', sa.Column('summary_role', sa.String(20), nullable=True))
    op.add_column('summaries', sa.Column('topics', sa.JSON(), nullable=True))
    op.add_column('summaries', sa.Column('original_word_count', sa.Integer(), nullable=True))
    op.add_column('summaries', sa.Column('summary_word_count', sa.Integer(), nullable=True))

    # --- jobs table ---
    op.add_column('jobs', sa.Column('summary_format', sa.String(20), nullable=True))
    op.add_column('jobs', sa.Column('summary_role', sa.String(20), nullable=True))

    # --- books table ---
    op.add_column('books', sa.Column('source_type', sa.String(20), nullable=True))


def downgrade() -> None:
    """Remove Phase 2 columns."""
    op.drop_column('books', 'source_type')
    op.drop_column('jobs', 'summary_role')
    op.drop_column('jobs', 'summary_format')
    op.drop_column('summaries', 'summary_word_count')
    op.drop_column('summaries', 'original_word_count')
    op.drop_column('summaries', 'topics')
    op.drop_column('summaries', 'summary_role')
    op.drop_column('summaries', 'summary_format')
