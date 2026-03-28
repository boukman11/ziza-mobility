"""driver applications

Revision ID: 0002
Revises: 0001_init
Create Date: 2026-03-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001_init"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "driver_applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("oidc_sub", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("status", sa.Enum("PENDING","APPROVED","REJECTED", name="driverapplicationstatus"), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_driver_applications_user_id", "driver_applications", ["user_id"])
    op.create_index("ix_driver_applications_oidc_sub", "driver_applications", ["oidc_sub"])
    op.create_index("ix_driver_applications_email", "driver_applications", ["email"])

def downgrade():
    op.drop_index("ix_driver_applications_email", table_name="driver_applications")
    op.drop_index("ix_driver_applications_oidc_sub", table_name="driver_applications")
    op.drop_index("ix_driver_applications_user_id", table_name="driver_applications")
    op.drop_table("driver_applications")
    op.execute("DROP TYPE IF EXISTS driverapplicationstatus")
