"""add_role_based_styles_enum

Revision ID: 3c310cd56ea9
Revises: 47f7fed94711
Create Date: 2026-02-24

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '3c310cd56ea9'
down_revision: Union[str, Sequence[str], None] = '47f7fed94711'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add new role-based values to the summarystyle enum."""
    op.execute("ALTER TYPE summarystyle ADD VALUE IF NOT EXISTS 'EXECUTIVE'")
    op.execute("ALTER TYPE summarystyle ADD VALUE IF NOT EXISTS 'TECHNICAL'")
    op.execute("ALTER TYPE summarystyle ADD VALUE IF NOT EXISTS 'STUDENT'")


def downgrade() -> None:
    """PostgreSQL does not support removing values from an enum type directly.
    To downgrade, you would need to recreate the enum. Skipping for safety."""
    pass
