"""add initial comment count tracking

Revision ID: 99f10a6317e1
Revises: 07c3cf7a7683
Create Date: 2025-10-19 15:43:39.612859

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '99f10a6317e1'
down_revision: Union[str, None] = '07c3cf7a7683'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add initial_num_comments to track the comment count when post was first scraped
    op.add_column('reddit_posts', sa.Column('initial_num_comments', sa.Integer(), nullable=False, server_default='0'))

    # Backfill: set initial_num_comments to current num_comments for existing posts
    op.execute('UPDATE reddit_posts SET initial_num_comments = num_comments WHERE initial_num_comments = 0')


def downgrade() -> None:
    op.drop_column('reddit_posts', 'initial_num_comments')
