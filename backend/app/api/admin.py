"""
Admin API — full system oversight for admin role users.

Admin can:
  - List & manage all users (view, deactivate, change role, delete)
  - View all books across all users
  - View all jobs and their statuses
  - View system-wide stats
  - Delete any user's content

Regular users have NONE of these endpoints — they only manage their own resources
via the /books/* and /auth/me endpoints.
"""
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from app.api.deps import get_db, get_current_admin_user
from app.models.book import User, Book, Summary, Job, Quiz, UserRole, JobStatus

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)


# ---------- Schemas ----------

class UserAdminView(BaseModel):
    id: int
    name: str
    email: str
    role: UserRole
    book_count: int

    class Config:
        from_attributes = True


class BookAdminView(BaseModel):
    id: int
    title: Optional[str]
    author: Optional[str]
    user_id: int
    user_email: str
    source_type: Optional[str]
    upload_date: str
    has_summary: bool


class JobAdminView(BaseModel):
    id: str
    book_id: int
    status: str
    summary_format: Optional[str]
    summary_role: Optional[str]
    error: Optional[str]
    created_at: str


class SystemStats(BaseModel):
    total_users: int
    total_books: int
    total_summaries: int
    total_jobs: int
    failed_jobs: int
    pending_jobs: int
    completed_jobs: int


class RoleUpdate(BaseModel):
    role: UserRole


# ---------- System stats ----------

@router.get("/stats", response_model=SystemStats)
def get_system_stats(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """High-level system statistics."""
    total_users = db.query(func.count(User.id)).scalar()
    total_books = db.query(func.count(Book.id)).scalar()
    total_summaries = db.query(func.count(Summary.id)).scalar()
    total_jobs = db.query(func.count(Job.id)).scalar()
    failed_jobs = db.query(func.count(Job.id)).filter(Job.status == JobStatus.FAILED).scalar()
    pending_jobs = db.query(func.count(Job.id)).filter(Job.status == JobStatus.PENDING).scalar()
    completed_jobs = db.query(func.count(Job.id)).filter(Job.status == JobStatus.COMPLETED).scalar()

    return SystemStats(
        total_users=total_users,
        total_books=total_books,
        total_summaries=total_summaries,
        total_jobs=total_jobs,
        failed_jobs=failed_jobs,
        pending_jobs=pending_jobs,
        completed_jobs=completed_jobs,
    )


# ---------- User management ----------

@router.get("/users", response_model=List[UserAdminView])
def list_all_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
    role: Optional[str] = Query(None, description="Filter by role: user | admin"),
):
    """List all registered users. Optionally filter by role."""
    query = db.query(User)
    if role:
        try:
            query = query.filter(User.role == UserRole(role.lower()))
        except ValueError:
            raise HTTPException(400, detail="Invalid role. Use 'user' or 'admin'")
    users = query.order_by(User.id).all()
    return [
        UserAdminView(
            id=u.id,
            name=u.name,
            email=u.email,
            role=u.role,
            book_count=len(u.books),
        )
        for u in users
    ]


@router.get("/users/{user_id}", response_model=UserAdminView)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """Get a specific user's details."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, detail="User not found")
    return UserAdminView(id=user.id, name=user.name, email=user.email, role=user.role, book_count=len(user.books))


@router.patch("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    body: RoleUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """Change a user's role (promote to admin or demote to user)."""
    if user_id == admin.id:
        raise HTTPException(400, detail="Cannot change your own role")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, detail="User not found")
    user.role = body.role
    db.commit()
    logger.info(f"Admin {admin.email} changed user {user.email} role → {body.role}")
    return {"ok": True, "user_id": user_id, "new_role": body.role}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """Permanently delete a user and all their content."""
    if user_id == admin.id:
        raise HTTPException(400, detail="Cannot delete your own account via admin panel")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, detail="User not found")
    db.delete(user)
    db.commit()
    logger.info(f"Admin {admin.email} deleted user {user_id}")
    return {"ok": True}


# ---------- Book management (all users) ----------

@router.get("/books", response_model=List[BookAdminView])
def list_all_books(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    source_type: Optional[str] = Query(None, description="file | text | youtube"),
):
    """List all books in the system, with optional filters."""
    query = db.query(Book).join(User, Book.user_id == User.id)
    if user_id:
        query = query.filter(Book.user_id == user_id)
    if source_type:
        query = query.filter(Book.source_type == source_type)
    books = query.order_by(Book.upload_date.desc()).all()
    return [
        BookAdminView(
            id=b.id,
            title=b.title,
            author=b.author,
            user_id=b.user_id,
            user_email=b.owner.email,
            source_type=b.source_type,
            upload_date=b.upload_date.isoformat(),
            has_summary=len(b.summaries) > 0,
        )
        for b in books
    ]


@router.delete("/books/{book_id}")
def admin_delete_book(
    book_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """Delete any user's book (admin override)."""
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(404, detail="Book not found")
    db.delete(book)
    db.commit()
    logger.info(f"Admin {admin.email} deleted book {book_id}")
    return {"ok": True}


# ---------- Job monitoring ----------

@router.get("/jobs", response_model=List[JobAdminView])
def list_all_jobs(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
    status: Optional[str] = Query(None, description="Filter: PENDING|PROCESSING|COMPLETED|FAILED"),
    limit: int = Query(50, ge=1, le=200),
):
    """List all summarization jobs with optional status filter."""
    query = db.query(Job)
    if status:
        try:
            query = query.filter(Job.status == JobStatus(status.upper()))
        except ValueError:
            raise HTTPException(400, detail="Invalid status value")
    jobs = query.order_by(Job.created_at.desc()).limit(limit).all()
    return [
        JobAdminView(
            id=j.id,
            book_id=j.book_id,
            status=j.status.value,
            summary_format=j.summary_format,
            summary_role=j.summary_role,
            error=j.error,
            created_at=j.created_at.isoformat(),
        )
        for j in jobs
    ]
