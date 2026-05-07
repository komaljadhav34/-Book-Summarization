"""
Feedback API — allows users to rate summaries (thumbs up / thumbs down).
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Annotated, Optional

from app.models.book import Feedback, FeedbackRating, Summary, User
from app.api.deps import get_db, get_current_active_user

router = APIRouter(prefix="/feedback", tags=["feedback"])
logger = logging.getLogger(__name__)


class FeedbackCreate(BaseModel):
    summary_id: int
    rating: FeedbackRating  # "up" or "down"
    comment: Optional[str] = None


class FeedbackResponse(BaseModel):
    id: int
    summary_id: int
    rating: FeedbackRating
    comment: Optional[str]


@router.post("/", response_model=FeedbackResponse)
def create_or_update_feedback(
    data: FeedbackCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """Create or update a user's rating for a summary."""
    # Verify summary exists
    summary = db.query(Summary).filter(Summary.id == data.summary_id).first()
    if not summary:
        raise HTTPException(404, detail="Summary not found")

    # Check if user already rated this summary — update instead of duplicate
    existing = db.query(Feedback).filter(
        Feedback.summary_id == data.summary_id,
        Feedback.user_id == current_user.id
    ).first()

    if existing:
        existing.rating = data.rating
        existing.comment = data.comment
        db.commit()
        db.refresh(existing)
        return FeedbackResponse(
            id=existing.id,
            summary_id=existing.summary_id,
            rating=existing.rating,
            comment=existing.comment
        )

    feedback = Feedback(
        summary_id=data.summary_id,
        user_id=current_user.id,
        rating=data.rating,
        comment=data.comment
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return FeedbackResponse(
        id=feedback.id,
        summary_id=feedback.summary_id,
        rating=feedback.rating,
        comment=feedback.comment
    )


@router.get("/{summary_id}", response_model=FeedbackResponse | None)
def get_user_feedback(
    summary_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    """Get the current user's feedback for a summary."""
    feedback = db.query(Feedback).filter(
        Feedback.summary_id == summary_id,
        Feedback.user_id == current_user.id
    ).first()
    if not feedback:
        return None
    return FeedbackResponse(
        id=feedback.id,
        summary_id=feedback.summary_id,
        rating=feedback.rating,
        comment=feedback.comment
    )
