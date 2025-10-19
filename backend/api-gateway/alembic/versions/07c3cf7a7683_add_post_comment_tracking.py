"""add_post_comment_tracking

Revision ID: 07c3cf7a7683
Revises: 951633e35e62
Create Date: 2025-10-19 15:18:54.394792

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '07c3cf7a7683'
down_revision: Union[str, None] = '951633e35e62'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add comment tracking fields to reddit_posts
    op.add_column('reddit_posts', sa.Column('track_comments', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('reddit_posts', sa.Column('track_until', sa.DateTime(), nullable=True))
    op.add_column('reddit_posts', sa.Column('last_comment_scrape_at', sa.DateTime(), nullable=True))
    op.add_column('reddit_posts', sa.Column('comment_scrape_count', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    # Remove comment tracking fields
    op.drop_column('reddit_posts', 'comment_scrape_count')
    op.drop_column('reddit_posts', 'last_comment_scrape_at')
    op.drop_column('reddit_posts', 'track_until')
    op.drop_column('reddit_posts', 'track_comments')
