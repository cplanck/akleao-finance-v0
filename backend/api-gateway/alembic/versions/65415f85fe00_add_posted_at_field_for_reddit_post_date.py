"""add posted_at field for reddit post date

Revision ID: 65415f85fe00
Revises: 99f10a6317e1
Create Date: 2025-10-19 15:54:37.360500

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '65415f85fe00'
down_revision: Union[str, None] = '99f10a6317e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add posted_at field to store the Reddit post creation date
    op.add_column('reddit_posts', sa.Column('posted_at', sa.DateTime(), nullable=True))

    # Backfill: copy created_at to posted_at for existing posts
    # (created_at currently holds the Reddit post date, not when we indexed it)
    op.execute('UPDATE reddit_posts SET posted_at = created_at')

    # Now update created_at to use updated_at as a better proxy for "when we indexed it"
    # This is not perfect but closer to the truth for existing posts
    op.execute('UPDATE reddit_posts SET created_at = updated_at')

    # Make posted_at non-nullable now that it's backfilled
    op.alter_column('reddit_posts', 'posted_at', nullable=False)


def downgrade() -> None:
    op.drop_column('reddit_posts', 'posted_at')
