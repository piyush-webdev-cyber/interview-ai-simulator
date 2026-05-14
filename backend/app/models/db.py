from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class UserProfile(Base):
    __tablename__ = "profiles"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    provider: Mapped[str] = mapped_column(String(32), index=True)
    profile_picture: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    sessions: Mapped[list["InterviewSessionRecord"]] = relationship(back_populates="user")


class InterviewSessionRecord(Base):
    __tablename__ = "interview_sessions"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("profiles.id"), index=True)
    role: Mapped[str] = mapped_column(String(120), index=True)
    difficulty: Mapped[str] = mapped_column(String(40))
    mode: Mapped[str] = mapped_column(String(80))
    current_round: Mapped[str] = mapped_column(String(80))
    current_question: Mapped[str] = mapped_column(Text)
    scores: Mapped[dict] = mapped_column(JSONB, default=dict)
    state: Mapped[str] = mapped_column(String(40), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[UserProfile] = relationship(back_populates="sessions")
    answers: Mapped[list["InterviewAnswerRecord"]] = relationship(back_populates="session", cascade="all, delete-orphan")
    report: Mapped["FeedbackReportRecord | None"] = relationship(back_populates="session", cascade="all, delete-orphan")


class InterviewAnswerRecord(Base):
    __tablename__ = "interview_answers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("interview_sessions.id"), index=True)
    round: Mapped[str] = mapped_column(String(80))
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    score: Mapped[float] = mapped_column(Float)
    strengths: Mapped[list[str]] = mapped_column(JSONB, default=list)
    weaknesses: Mapped[list[str]] = mapped_column(JSONB, default=list)
    follow_up_question: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped[InterviewSessionRecord] = relationship(back_populates="answers")


class FeedbackReportRecord(Base):
    __tablename__ = "feedback_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("interview_sessions.id"), unique=True, index=True)
    overall_score: Mapped[float] = mapped_column(Float)
    category_breakdown: Mapped[dict] = mapped_column(JSONB, default=dict)
    strengths: Mapped[list[str]] = mapped_column(JSONB, default=list)
    weak_topics: Mapped[list[str]] = mapped_column(JSONB, default=list)
    improvement_roadmap: Mapped[list[str]] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped[InterviewSessionRecord] = relationship(back_populates="report")
