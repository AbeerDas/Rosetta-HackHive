"""Add translated_text column to transcripts

Revision ID: 002
Revises: 001
Create Date: 2026-01-24 22:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('transcripts', sa.Column('translated_text', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('transcripts', 'translated_text')

