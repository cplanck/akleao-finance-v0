"""add_positions_table

Revision ID: 302feb954eb2
Revises: 4fa7d1270e54
Create Date: 2025-10-20 00:28:34.159862

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '302feb954eb2'
down_revision: Union[str, None] = '4fa7d1270e54'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'positions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('stock_symbol', sa.String(), nullable=False),
        sa.Column('shares', sa.Float(), nullable=False),
        sa.Column('entry_price', sa.Float(), nullable=False),
        sa.Column('entry_date', sa.DateTime(), nullable=False),
        sa.Column('exit_date', sa.DateTime(), nullable=True),
        sa.Column('exit_price', sa.Float(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('notes', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_positions_user_id'), 'positions', ['user_id'], unique=False)
    op.create_index(op.f('ix_positions_stock_symbol'), 'positions', ['stock_symbol'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_positions_stock_symbol'), table_name='positions')
    op.drop_index(op.f('ix_positions_user_id'), table_name='positions')
    op.drop_table('positions')
