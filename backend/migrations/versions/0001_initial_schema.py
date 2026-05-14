"""initial interview schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-05-02
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "profiles",
        sa.Column("id", postgresql.UUID(as_uuid=False), sa.ForeignKey("auth.users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("profile_picture", sa.String(length=1024), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_profiles_email", "profiles", ["email"], unique=True)
    op.create_index("ix_profiles_provider", "profiles", ["provider"])

    op.create_table(
        "interview_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("role", sa.String(length=120), nullable=False),
        sa.Column("difficulty", sa.String(length=40), nullable=False),
        sa.Column("mode", sa.String(length=80), nullable=False),
        sa.Column("current_round", sa.String(length=80), nullable=False),
        sa.Column("current_question", sa.Text(), nullable=False),
        sa.Column("scores", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("state", sa.String(length=40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_interview_sessions_user_id", "interview_sessions", ["user_id"])
    op.create_index("ix_interview_sessions_role", "interview_sessions", ["role"])
    op.create_index("ix_interview_sessions_state", "interview_sessions", ["state"])

    op.create_table(
        "interview_answers",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("interview_sessions.id"), nullable=False),
        sa.Column("round", sa.String(length=80), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("strengths", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("weaknesses", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("follow_up_question", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_interview_answers_session_id", "interview_answers", ["session_id"])

    op.create_table(
        "feedback_reports",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("interview_sessions.id"), nullable=False, unique=True),
        sa.Column("overall_score", sa.Float(), nullable=False),
        sa.Column("category_breakdown", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("strengths", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("weak_topics", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("improvement_roadmap", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_feedback_reports_session_id", "feedback_reports", ["session_id"])


def downgrade() -> None:
    op.drop_index("ix_feedback_reports_session_id", table_name="feedback_reports")
    op.drop_table("feedback_reports")
    op.drop_index("ix_interview_answers_session_id", table_name="interview_answers")
    op.drop_table("interview_answers")
    op.drop_index("ix_interview_sessions_state", table_name="interview_sessions")
    op.drop_index("ix_interview_sessions_role", table_name="interview_sessions")
    op.drop_index("ix_interview_sessions_user_id", table_name="interview_sessions")
    op.drop_table("interview_sessions")
    op.drop_index("ix_profiles_provider", table_name="profiles")
    op.drop_index("ix_profiles_email", table_name="profiles")
    op.drop_table("profiles")
