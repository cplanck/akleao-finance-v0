"""add_scrape_settings_to_tracked_subreddits

Revision ID: 951633e35e62
Revises: 2e17c0bcd256
Create Date: 2025-10-19 14:16:59.042249

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '951633e35e62'
down_revision: Union[str, None] = '2e17c0bcd256'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add scrape settings columns to tracked_subreddits table
    op.add_column('tracked_subreddits', sa.Column('scrape_sort', sa.String(length=20), nullable=False, server_default='hot'))
    op.add_column('tracked_subreddits', sa.Column('scrape_time_filter', sa.String(length=20), nullable=True))
    op.add_column('tracked_subreddits', sa.Column('scrape_limit', sa.Integer(), nullable=False, server_default='100'))
    op.add_column('tracked_subreddits', sa.Column('scrape_lookback_days', sa.Integer(), nullable=False, server_default='7'))


def downgrade() -> None:
    # Remove scrape settings columns from tracked_subreddits table
    op.drop_column('tracked_subreddits', 'scrape_lookback_days')
    op.drop_column('tracked_subreddits', 'scrape_limit')
    op.drop_column('tracked_subreddits', 'scrape_time_filter')
    op.drop_column('tracked_subreddits', 'scrape_sort')
