"""add tracked subreddits and mappings

Revision ID: add_tracked_subreddits
Revises: 67081baba4ef
Create Date: 2025-10-18

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_tracked_subreddits'
down_revision = '67081baba4ef'
branch_labels = None
depends_on = None


def upgrade():
    # Create tracked_subreddits table
    op.create_table(
        'tracked_subreddits',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('subreddit_name', sa.String(length=255), nullable=False),
        sa.Column('subscriber_count', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('last_scraped_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('subreddit_name')
    )

    # Create stock_subreddit_mappings table
    op.create_table(
        'stock_subreddit_mappings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('stock_symbol', sa.String(length=10), nullable=False),
        sa.Column('subreddit_id', sa.Integer(), nullable=False),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('relevance_score', sa.Float(), nullable=True),
        sa.Column('discovered_by', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['subreddit_id'], ['tracked_subreddits.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('stock_symbol', 'subreddit_id', name='unique_stock_subreddit')
    )

    # Create indexes
    op.create_index('ix_tracked_subreddits_is_active', 'tracked_subreddits', ['is_active'])
    op.create_index('ix_stock_subreddit_mappings_stock_symbol', 'stock_subreddit_mappings', ['stock_symbol'])
    op.create_index('ix_stock_subreddit_mappings_subreddit_id', 'stock_subreddit_mappings', ['subreddit_id'])

    # Insert default investing subreddits (existing ones from scraper)
    op.execute("""
        INSERT INTO tracked_subreddits (subreddit_name, is_active) VALUES
        ('wallstreetbets', true),
        ('stocks', true),
        ('investing', true),
        ('StockMarket', true),
        ('options', true),
        ('pennystocks', true),
        ('smallstreetbets', true),
        ('Daytrading', true),
        ('SecurityAnalysis', true),
        ('ValueInvesting', true)
    """)


def downgrade():
    op.drop_index('ix_stock_subreddit_mappings_subreddit_id', table_name='stock_subreddit_mappings')
    op.drop_index('ix_stock_subreddit_mappings_stock_symbol', table_name='stock_subreddit_mappings')
    op.drop_index('ix_tracked_subreddits_is_active', table_name='tracked_subreddits')
    op.drop_table('stock_subreddit_mappings')
    op.drop_table('tracked_subreddits')
