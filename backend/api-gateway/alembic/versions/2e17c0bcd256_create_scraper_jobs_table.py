"""create_scraper_jobs_table

Revision ID: 2e17c0bcd256
Revises: add_tracked_subreddits
Create Date: 2025-10-19 13:37:21.730070

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2e17c0bcd256'
down_revision: Union[str, None] = 'add_tracked_subreddits'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create scraper_jobs table for queue-based scraping
    op.create_table(
        'scraper_jobs',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('job_type', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('priority', sa.Integer(), server_default='5'),
        sa.Column('config', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('posts_collected', sa.Integer(), server_default='0'),
        sa.Column('errors_count', sa.Integer(), server_default='0'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('scraper_run_id', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for efficient queue processing
    op.create_index('ix_scraper_jobs_status', 'scraper_jobs', ['status'])
    op.create_index('ix_scraper_jobs_created_at', 'scraper_jobs', ['created_at'])
    op.create_index('ix_scraper_jobs_priority', 'scraper_jobs', ['priority'])


def downgrade() -> None:
    op.drop_index('ix_scraper_jobs_priority', table_name='scraper_jobs')
    op.drop_index('ix_scraper_jobs_created_at', table_name='scraper_jobs')
    op.drop_index('ix_scraper_jobs_status', table_name='scraper_jobs')
    op.drop_table('scraper_jobs')
