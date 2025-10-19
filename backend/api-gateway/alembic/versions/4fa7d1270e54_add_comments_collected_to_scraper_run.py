"""add_comments_collected_to_scraper_run

Revision ID: 4fa7d1270e54
Revises: 65415f85fe00
Create Date: 2025-10-19 16:39:45.296456

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4fa7d1270e54'
down_revision: Union[str, None] = '65415f85fe00'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add comments_collected column to scraper_runs
    op.add_column('scraper_runs', sa.Column('comments_collected', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('scraper_runs', 'comments_collected')
