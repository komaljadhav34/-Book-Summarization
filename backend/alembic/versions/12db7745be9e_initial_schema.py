"""initial_schema

Revision ID: 12db7745be9e
Revises: 
Create Date: 2026-02-24 07:24:05.697544

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '12db7745be9e'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()

    # ── 1. Create enums (skip if they already exist) ────────────────
    conn.execute(sa.text(
        "DO $$ BEGIN "
        "CREATE TYPE jobstatus AS ENUM ('PENDING','PROCESSING','COMPLETED','FAILED'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; END $$;"
    ))
    conn.execute(sa.text(
        "DO $$ BEGIN "
        "CREATE TYPE summarystyle AS ENUM ('CONCISE','DETAILED','BULLETS'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; END $$;"
    ))
    conn.execute(sa.text(
        "DO $$ BEGIN "
        "CREATE TYPE userrole AS ENUM ('USER','ADMIN'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; END $$;"
    ))

    # ── 2. Create jobs table (the missing table) ────────────────────
    op.create_table('jobs',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('book_id', sa.Integer(), nullable=False),
        sa.Column('status', postgresql.ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', name='jobstatus', create_type=False), nullable=False),
        sa.Column('style', postgresql.ENUM('CONCISE', 'DETAILED', 'BULLETS', name='summarystyle', create_type=False), nullable=False),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['book_id'], ['books.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_jobs_id'), 'jobs', ['id'], unique=False)

    # ── 3. Alter books table ────────────────────────────────────────
    # Add new columns (skip if they already exist)
    new_cols = [
        ('user_id', sa.Integer(), {'nullable': True}),
        ('upload_date', sa.DateTime(), {'server_default': sa.text('now()'), 'nullable': False}),
        ('original_file_name', sa.String(length=255), {'nullable': True}),
        ('original_file_data', sa.LargeBinary(), {'nullable': True}),
    ]
    for col_name, col_type, extra_kw in new_cols:
        result = conn.execute(sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name='books' AND column_name=:col"
        ), {'col': col_name})
        if result.fetchone() is None:
            op.add_column('books', sa.Column(col_name, col_type, **extra_kw))

    # Alter title: varchar(200) -> varchar(255), nullable
    op.alter_column('books', 'title',
               existing_type=sa.VARCHAR(length=200),
               type_=sa.String(length=255),
               nullable=True)

    # Alter author: varchar(100) -> varchar(255)
    op.alter_column('books', 'author',
               existing_type=sa.VARCHAR(length=100),
               type_=sa.String(length=255),
               existing_nullable=True)

    # Add FK from books.user_id -> users.id (only if not already there)
    # Note: skipped if there are orphan books with no matching user
    has_orphans = conn.execute(sa.text(
        "SELECT 1 FROM books b WHERE b.user_id IS NULL "
        "OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = b.user_id) LIMIT 1"
    )).fetchone()
    if has_orphans is None:
        result = conn.execute(sa.text(
            "SELECT 1 FROM information_schema.table_constraints "
            "WHERE table_name='books' AND constraint_type='FOREIGN KEY' "
            "AND constraint_name LIKE '%user_id%'"
        ))
        if result.fetchone() is None:
            op.create_foreign_key('fk_books_user_id', 'books', 'users', ['user_id'], ['id'])

    # Drop old columns (only if they still exist)
    for col_name in ('file_path', 'uploaded_at'):
        result = conn.execute(sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name='books' AND column_name=:col"
        ), {'col': col_name})
        if result.fetchone() is not None:
            op.drop_column('books', col_name)

    # ── 4. Alter summaries table ────────────────────────────────────
    op.alter_column('summaries', 'style',
               existing_type=postgresql.ENUM('CONCISE', 'DETAILED', 'BULLETS', name='summarystyle'),
               nullable=False)
    op.alter_column('summaries', 'created_at',
               existing_type=postgresql.TIMESTAMP(timezone=True),
               type_=sa.DateTime(),
               nullable=False,
               existing_server_default=sa.text('now()'))

    # ── 5. Alter users table ───────────────────────────────────────
    # Add password_hash if it doesn't exist
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name='users' AND column_name='password_hash'"
    ))
    if result.fetchone() is None:
        op.add_column('users', sa.Column('password_hash', sa.String(length=255), nullable=False, server_default='changeme'))
        op.alter_column('users', 'password_hash', server_default=None)

    # Alter role column type
    op.alter_column('users', 'role',
               existing_type=sa.VARCHAR(length=50),
               type_=postgresql.ENUM('USER', 'ADMIN', name='userrole', create_type=False),
               existing_nullable=False,
               postgresql_using="role::userrole")

    # Drop old password column if it exists
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name='users' AND column_name='password'"
    ))
    if result.fetchone() is not None:
        op.drop_column('users', 'password')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('users', sa.Column('password', sa.VARCHAR(length=255), autoincrement=False, nullable=False))
    op.alter_column('users', 'role',
               existing_type=sa.Enum('USER', 'ADMIN', name='userrole'),
               type_=sa.VARCHAR(length=50),
               existing_nullable=False)
    op.drop_column('users', 'password_hash')
    op.alter_column('summaries', 'created_at',
               existing_type=sa.DateTime(),
               type_=postgresql.TIMESTAMP(timezone=True),
               nullable=True,
               existing_server_default=sa.text('now()'))
    op.alter_column('summaries', 'style',
               existing_type=postgresql.ENUM('CONCISE', 'DETAILED', 'BULLETS', name='summarystyle'),
               nullable=True)
    op.add_column('books', sa.Column('uploaded_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=True))
    op.add_column('books', sa.Column('file_path', sa.VARCHAR(length=500), autoincrement=False, nullable=True))
    op.drop_constraint('fk_books_user_id', 'books', type_='foreignkey')
    op.alter_column('books', 'author',
               existing_type=sa.String(length=255),
               type_=sa.VARCHAR(length=100),
               existing_nullable=True)
    op.alter_column('books', 'title',
               existing_type=sa.String(length=255),
               type_=sa.VARCHAR(length=200),
               nullable=False)
    op.drop_column('books', 'original_file_data')
    op.drop_column('books', 'original_file_name')
    op.drop_column('books', 'upload_date')
    op.drop_column('books', 'user_id')
    op.drop_index(op.f('ix_jobs_id'), table_name='jobs')
    op.drop_table('jobs')
