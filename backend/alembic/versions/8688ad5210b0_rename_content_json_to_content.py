"""rename content_json to content

Revision ID: 8688ad5210b0
Revises:
Create Date: 2026-03-24 16:03:35.873630

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '8688ad5210b0'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('notes', 'content_json', new_column_name='content')


def downgrade() -> None:
    op.alter_column('notes', 'content', new_column_name='content_json')
