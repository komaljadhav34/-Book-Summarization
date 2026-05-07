from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    String, Text, LargeBinary, ForeignKey,
    Enum as SQLEnum, JSON, Integer, Boolean, Float,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base


# ---------- Enums ----------

class UserRole(str, enum.Enum):
    USER  = "user"
    ADMIN = "admin"


class SummaryFormat(str, enum.Enum):
    CONCISE  = "CONCISE"
    DETAILED = "DETAILED"
    BULLETS  = "BULLETS"


class SummaryRole(str, enum.Enum):
    GENERAL    = "GENERAL"
    EXECUTIVE  = "EXECUTIVE"
    TECHNICAL  = "TECHNICAL"
    STUDENT    = "STUDENT"
    RESEARCHER = "RESEARCHER"
    LEGAL      = "LEGAL"
    CREATIVE   = "CREATIVE"
    MEDICAL    = "MEDICAL"
    ANALYST    = "ANALYST"
    EDUCATOR   = "EDUCATOR"


# Kept for backward compat during migration
class SummaryStyle(str, enum.Enum):
    CONCISE   = "CONCISE"
    DETAILED  = "DETAILED"
    BULLETS   = "BULLETS"
    EXECUTIVE = "EXECUTIVE"
    TECHNICAL = "TECHNICAL"
    STUDENT   = "STUDENT"


class JobStatus(str, enum.Enum):
    PENDING    = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED  = "COMPLETED"
    FAILED     = "FAILED"


class FeedbackRating(str, enum.Enum):
    UP   = "up"
    DOWN = "down"


# ---------- Models ----------

class User(Base):
    __tablename__ = "users"

    id:            Mapped[int]      = mapped_column(primary_key=True, index=True)
    name:          Mapped[str]      = mapped_column(String(255), nullable=False)
    email:         Mapped[str]      = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str]      = mapped_column(String(255), nullable=False)
    role:          Mapped[UserRole] = mapped_column(SQLEnum(UserRole), default=UserRole.USER)

    books: Mapped[List["Book"]] = relationship(back_populates="owner", cascade="all, delete-orphan")


class Book(Base):
    __tablename__ = "books"

    id:                 Mapped[int]           = mapped_column(primary_key=True, index=True)
    title:              Mapped[Optional[str]] = mapped_column(String(255))
    author:             Mapped[Optional[str]] = mapped_column(String(255))
    user_id:            Mapped[int]           = mapped_column(ForeignKey("users.id"))
    upload_date:        Mapped[datetime]      = mapped_column(server_default=func.now())

    original_file_name: Mapped[Optional[str]]   = mapped_column(String(255))
    original_file_data: Mapped[Optional[bytes]]  = mapped_column(LargeBinary)
    raw_text:           Mapped[str]              = mapped_column(Text, nullable=False)
    chunks_json:        Mapped[Optional[list]]   = mapped_column(JSON, nullable=True)
    sentiment_json:     Mapped[Optional[list]]   = mapped_column(JSON, nullable=True)
    source_type:        Mapped[Optional[str]]    = mapped_column(String(20), nullable=True)

    owner:     Mapped["User"]           = relationship(back_populates="books")
    summaries: Mapped[List["Summary"]]  = relationship(back_populates="book", cascade="all, delete-orphan")
    jobs:      Mapped[List["Job"]]      = relationship(back_populates="book", cascade="all, delete-orphan")
    quizzes:   Mapped[List["Quiz"]]     = relationship(back_populates="book", cascade="all, delete-orphan")


class Summary(Base):
    __tablename__ = "summaries"

    id:                  Mapped[int]            = mapped_column(primary_key=True, index=True)
    book_id:             Mapped[int]            = mapped_column(ForeignKey("books.id", ondelete="CASCADE"))
    summary_text:        Mapped[str]            = mapped_column(Text, nullable=False)
    style:               Mapped[SummaryStyle]   = mapped_column(SQLEnum(SummaryStyle), default=SummaryStyle.CONCISE)
    summary_format:      Mapped[Optional[str]]  = mapped_column(String(20), nullable=True)
    summary_role:        Mapped[Optional[str]]  = mapped_column(String(20), nullable=True)
    source_mapping:      Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    topics:              Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    original_word_count: Mapped[Optional[int]]  = mapped_column(Integer, nullable=True)
    summary_word_count:  Mapped[Optional[int]]  = mapped_column(Integer, nullable=True)
    created_at:          Mapped[datetime]       = mapped_column(server_default=func.now())

    book:      Mapped["Book"]           = relationship(back_populates="summaries")
    feedbacks: Mapped[List["Feedback"]] = relationship(back_populates="summary", cascade="all, delete-orphan")


class Feedback(Base):
    __tablename__ = "feedbacks"

    id:         Mapped[int]            = mapped_column(primary_key=True, index=True)
    summary_id: Mapped[int]            = mapped_column(ForeignKey("summaries.id", ondelete="CASCADE"))
    user_id:    Mapped[int]            = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    rating:     Mapped[FeedbackRating] = mapped_column(SQLEnum(FeedbackRating), nullable=False)
    comment:    Mapped[Optional[str]]  = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime]       = mapped_column(server_default=func.now())

    summary: Mapped["Summary"] = relationship(back_populates="feedbacks")


class Job(Base):
    __tablename__ = "jobs"

    id:             Mapped[str]           = mapped_column(String(36), primary_key=True, index=True)
    book_id:        Mapped[int]           = mapped_column(ForeignKey("books.id", ondelete="CASCADE"))
    status:         Mapped[JobStatus]     = mapped_column(SQLEnum(JobStatus), default=JobStatus.PENDING)
    style:          Mapped[SummaryStyle]  = mapped_column(SQLEnum(SummaryStyle), nullable=False)
    summary_format: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    summary_role:   Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    error:          Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at:     Mapped[datetime]      = mapped_column(server_default=func.now())
    updated_at:     Mapped[datetime]      = mapped_column(server_default=func.now(), onupdate=func.now())

    book: Mapped["Book"] = relationship(back_populates="jobs")


class Quiz(Base):
    __tablename__ = "quizzes"

    id:         Mapped[int]           = mapped_column(primary_key=True, index=True)
    book_id:    Mapped[int]           = mapped_column(ForeignKey("books.id", ondelete="CASCADE"))
    title:      Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime]      = mapped_column(server_default=func.now())

    book:      Mapped["Book"]               = relationship(back_populates="quizzes")
    questions: Mapped[List["QuizQuestion"]] = relationship(back_populates="quiz", cascade="all, delete-orphan")


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id:              Mapped[int]           = mapped_column(primary_key=True, index=True)
    quiz_id:         Mapped[int]           = mapped_column(ForeignKey("quizzes.id", ondelete="CASCADE"))
    question_text:   Mapped[str]           = mapped_column(Text, nullable=False)
    question_type:   Mapped[Optional[str]] = mapped_column(String(20))
    # ── NEW: difficulty label ─────────────────────────────────────────────────
    # Values: "easy" | "medium" | "hard"
    # Add to DB via Alembic:
    #   op.add_column('quiz_questions', sa.Column('difficulty', sa.String(10), nullable=True))
    difficulty:      Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    # ─────────────────────────────────────────────────────────────────────────
    options:         Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    correct_answer:  Mapped[str]            = mapped_column(Text, nullable=False)
    explanation:     Mapped[Optional[str]]  = mapped_column(Text, nullable=True)
    source_chunk_idx: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    quiz:     Mapped["Quiz"]             = relationship(back_populates="questions")
    attempts: Mapped[List["QuizAttempt"]] = relationship(back_populates="question", cascade="all, delete-orphan")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id:          Mapped[int]           = mapped_column(primary_key=True, index=True)
    user_id:     Mapped[int]           = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    question_id: Mapped[int]           = mapped_column(ForeignKey("quiz_questions.id", ondelete="CASCADE"))
    user_answer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_correct:  Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    score:       Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    attempted_at: Mapped[datetime]     = mapped_column(server_default=func.now())

    user:     Mapped["User"]         = relationship()
    question: Mapped["QuizQuestion"] = relationship(back_populates="attempts")