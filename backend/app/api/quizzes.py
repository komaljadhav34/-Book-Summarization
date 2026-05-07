import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from app.api.deps import get_db, get_current_active_user
from app.models.book import User, Book, Quiz, QuizQuestion, QuizAttempt, UserRole

router = APIRouter(prefix="/quizzes", tags=["quizzes"])
logger = logging.getLogger(__name__)


# ---------- Pydantic schemas ----------

class QuestionOut(BaseModel):
    id: int
    question_text: str
    question_type: str | None = None
    difficulty: str | None = None      # "easy" | "medium" | "hard"
    options: list | None = None
    # correct_answer intentionally omitted here — revealed only after attempt


class QuizOut(BaseModel):
    id: int
    book_id: int
    title: str | None = None
    created_at: str
    questions: List[QuestionOut]


class QuizListItem(BaseModel):
    id: int
    book_id: int
    title: str | None = None
    question_count: int
    created_at: str


class QuizGenerateRequest(BaseModel):
    num_questions: int = 10


class QuizGenerateResponse(BaseModel):
    quiz_id: int
    message: str


class AnswerSubmit(BaseModel):
    user_answer: str


class AnswerResult(BaseModel):
    is_correct: bool
    score: float
    correct_answer: str
    explanation: str | None = None


# ---------- Helpers ----------

def _check_book_access(book: Book, user: User):
    if book.user_id != user.id and user.role != UserRole.ADMIN:
        raise HTTPException(403, detail="Not authorized")


# ---------- Endpoints ----------

@router.get("/books/{book_id}", response_model=List[QuizListItem])
def list_quizzes_for_book(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(404, detail="Book not found")
    _check_book_access(book, current_user)

    quizzes = (
        db.query(Quiz)
        .filter(Quiz.book_id == book_id)
        .order_by(Quiz.created_at.desc())
        .all()
    )
    return [
        QuizListItem(
            id=q.id,
            book_id=q.book_id,
            title=q.title,
            question_count=len(q.questions),
            created_at=q.created_at.isoformat(),
        )
        for q in quizzes
    ]


@router.post("/books/{book_id}/generate", response_model=QuizGenerateResponse)
def generate_quiz(
    book_id: int,
    request: QuizGenerateRequest = QuizGenerateRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Generate a quiz with difficulty-labelled MCQs using Groq.
    Each question is stored with an "easy" | "medium" | "hard" difficulty label.
    """
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(404, detail="Book not found")
    _check_book_access(book, current_user)

    if not book.raw_text:
        raise HTTPException(400, detail="Book has no text content for quiz generation")

    quiz = Quiz(book_id=book.id, title=f"Quiz — {book.title}")
    db.add(quiz)
    db.flush()

    from app.services.quiz_generator import generate_questions_from_chunk

    full_text = book.raw_text
    num_q = max(5, min(20, request.num_questions))

    try:
        questions_data = generate_questions_from_chunk(full_text, num_questions=num_q)
    except Exception as e:
        logger.error("Quiz generation error: %s", e)
        db.rollback()
        raise HTTPException(500, detail="Quiz generation failed")

    if not questions_data:
        db.rollback()
        raise HTTPException(500, detail="No questions could be generated from this content")

    for q in questions_data:
        question = QuizQuestion(
            quiz_id=quiz.id,
            question_text=q["question"],
            question_type=q.get("question_type", "multiple_choice"),
            difficulty=q.get("difficulty", "medium"),   # ← store difficulty
            options=q.get("options"),
            correct_answer=q["answer"],
            explanation=q.get("explanation", ""),
            source_chunk_idx=None,
        )
        db.add(question)

    db.commit()
    logger.info(
        "Quiz %d: %d questions for book %d (easy=%d, medium=%d, hard=%d)",
        quiz.id,
        len(questions_data),
        book_id,
        sum(1 for q in questions_data if q.get("difficulty") == "easy"),
        sum(1 for q in questions_data if q.get("difficulty") == "medium"),
        sum(1 for q in questions_data if q.get("difficulty") == "hard"),
    )

    return QuizGenerateResponse(
        quiz_id=quiz.id,
        message=f"Quiz generated with {len(questions_data)} questions.",
    )


@router.get("/{quiz_id}", response_model=QuizOut)
def get_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Retrieve quiz questions — correct_answer hidden until attempt."""
    quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
    if not quiz:
        raise HTTPException(404, detail="Quiz not found")
    _check_book_access(quiz.book, current_user)

    return QuizOut(
        id=quiz.id,
        book_id=quiz.book_id,
        title=quiz.title,
        created_at=quiz.created_at.isoformat(),
        questions=[
            QuestionOut(
                id=q.id,
                question_text=q.question_text,
                question_type=q.question_type,
                difficulty=q.difficulty,    # ← expose to frontend
                options=q.options,
            )
            for q in quiz.questions
        ],
    )


@router.post("/question/{question_id}/attempt", response_model=AnswerResult)
def attempt_question(
    question_id: int,
    answer: AnswerSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Submit an answer; receive result, correct answer, and explanation."""
    question = db.query(QuizQuestion).filter(QuizQuestion.id == question_id).first()
    if not question:
        raise HTTPException(404, detail="Question not found")
    _check_book_access(question.quiz.book, current_user)

    from app.services.quiz_generator import validate_answer

    is_correct, score = validate_answer(answer.user_answer, question.correct_answer)

    attempt = QuizAttempt(
        user_id=current_user.id,
        question_id=question.id,
        user_answer=answer.user_answer,
        is_correct=is_correct,
        score=score,
    )
    db.add(attempt)
    db.commit()

    return AnswerResult(
        is_correct=is_correct,
        score=score,
        correct_answer=question.correct_answer,
        explanation=question.explanation,
    )