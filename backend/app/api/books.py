import logging
import uuid
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Annotated

from app.models.book import Book, Summary, SummaryStyle, SummaryFormat, SummaryRole, Job, JobStatus, User
from app.services.preprocessing import (
    extract_text_from_pdf_bytes,
    extract_text_from_txt_bytes,
    extract_text_from_docx_bytes,
    clean_text,
    extract_metadata_from_pdf_bytes
)
from app.services.worker import process_job
from app.services.export_service import export_as_txt, export_as_docx, export_as_pdf
from app.services.mindmap_service import generate_mindmap_data
from app.core.config import settings
from .deps import get_db, get_current_active_user, get_current_admin_user

router = APIRouter(prefix="/books", tags=["books"])
logger = logging.getLogger(__name__)

MAX_FILE_BYTES = settings.max_file_size_mb * 1024 * 1024  # 200 MB

ALLOWED_TYPES = [
    "application/pdf",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]

# ── Pydantic models ───────────────────────────────────────────────────────────
class UploadResponse(BaseModel):
    message: str
    book_id: int
    job_id: str

class JobStatusResponse(BaseModel):
    status: str
    book_id: int
    error: str | None = None

class SummaryResponse(BaseModel):
    summary_id: int
    book_id: int
    book_title: str
    summary: str
    style: SummaryStyle
    summary_format: str | None = None
    summary_role: str | None = None
    source_mapping: dict | None = None
    topics: list | None = None
    original_word_count: int | None = None
    summary_word_count: int | None = None
    created_at: str

class BookListItem(BaseModel):
    id: int
    title: str
    author: str
    upload_date: str
    has_summary: bool
    source_type: str | None = None

class YouTubeRequest(BaseModel):
    url: str
    summary_format: str = "CONCISE"
    summary_role: str = "GENERAL"

class AskRequest(BaseModel):
    question: str

class ExplainRequest(BaseModel):
    text: str
    mode: str = "explain"   # explain | simplify | example | eli5 | technical

class EvaluateRequest(BaseModel):
    reference_summary: str

class EvaluateResponse(BaseModel):
    rouge1: float
    rouge2: float
    rougeL: float


# ── Helpers ───────────────────────────────────────────────────────────────────
def _get_user_book(book_id: int, user: User, db: Session) -> Book:
    query = db.query(Book).filter(Book.id == book_id)
    if user.role != "admin":
        query = query.filter(Book.user_id == user.id)
    book = query.first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found or access denied")
    return book

def _map_to_legacy_style(fmt: str, role: str) -> SummaryStyle:
    fmt  = fmt.upper()  if fmt  else "CONCISE"
    role = role.upper() if role else "GENERAL"
    if role in ("EXECUTIVE", "TECHNICAL", "STUDENT"):
        return SummaryStyle(role)
    if fmt in ("CONCISE", "DETAILED", "BULLETS"):
        return SummaryStyle(fmt)
    return SummaryStyle.CONCISE


# ── Upload endpoints ──────────────────────────────────────────────────────────
@router.post("/upload", response_model=List[UploadResponse])
async def upload_books(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    style: SummaryStyle = Form(SummaryStyle.CONCISE),
    summary_format: str = Form("CONCISE"),
    summary_role: str = Form("GENERAL"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    responses = []
    for file in files:
        if file.content_type not in ALLOWED_TYPES:
            raise HTTPException(400, detail=f"File {file.filename} has unsupported type")
        try:
            file_bytes = await file.read()
        except Exception as e:
            raise HTTPException(500, detail=f"Could not read file {file.filename}")
        if len(file_bytes) > MAX_FILE_BYTES:
            raise HTTPException(400, detail=f"File {file.filename} exceeds {settings.max_file_size_mb}MB limit")
        try:
            if file.content_type == "application/pdf":
                raw_text = extract_text_from_pdf_bytes(file_bytes)
                meta = extract_metadata_from_pdf_bytes(file_bytes)
                title = meta.get("title") or file.filename
                author = meta.get("author") or "Unknown"
            elif file.content_type == "text/plain":
                raw_text = extract_text_from_txt_bytes(file_bytes)
                title = file.filename
                author = "Unknown"
            else:
                raw_text = extract_text_from_docx_bytes(file_bytes)
                title = file.filename
                author = "Unknown"
        except Exception as e:
            raise HTTPException(500, detail=f"Failed to extract text from {file.filename}")
        if not raw_text:
            raise HTTPException(400, detail=f"No text could be extracted from {file.filename}")
        cleaned_text = clean_text(raw_text)
        legacy_style = _map_to_legacy_style(summary_format, summary_role)
        book = Book(
            title=title, author=author, user_id=current_user.id,
            original_file_name=file.filename, original_file_data=file_bytes,
            raw_text=cleaned_text, source_type="file",
        )
        db.add(book); db.flush()
        job_id = str(uuid.uuid4())
        job = Job(id=job_id, book_id=book.id, status=JobStatus.PENDING,
                  style=legacy_style, summary_format=summary_format.upper(), summary_role=summary_role.upper())
        db.add(job); db.commit()
        background_tasks.add_task(process_job, job_id)
        responses.append(UploadResponse(
            message=f"File {file.filename} uploaded, summarization started.",
            book_id=book.id, job_id=job_id
        ))
    return responses


@router.post("/text", response_model=UploadResponse)
async def upload_text(
    background_tasks: BackgroundTasks,
    text: str = Form(...),
    title: str = Form("Pasted Text"),
    summary_format: str = Form("CONCISE"),
    summary_role: str = Form("GENERAL"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    word_count = len(text.split())
    if word_count > settings.max_paste_words:
        raise HTTPException(400, detail=f"Text exceeds {settings.max_paste_words} word limit (got {word_count} words)")
    if word_count < 10:
        raise HTTPException(400, detail="Text too short for summarization")
    cleaned_text = clean_text(text)
    legacy_style = _map_to_legacy_style(summary_format, summary_role)
    book = Book(title=title, author="User", user_id=current_user.id,
                raw_text=cleaned_text, source_type="text")
    db.add(book); db.flush()
    job_id = str(uuid.uuid4())
    job = Job(id=job_id, book_id=book.id, status=JobStatus.PENDING,
              style=legacy_style, summary_format=summary_format.upper(), summary_role=summary_role.upper())
    db.add(job); db.commit()
    background_tasks.add_task(process_job, job_id)
    return UploadResponse(message="Text uploaded, summarization started.", book_id=book.id, job_id=job_id)


@router.post("/youtube", response_model=UploadResponse)
async def upload_youtube(
    background_tasks: BackgroundTasks,
    body: YouTubeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from app.services.youtube_service import extract_youtube_transcript
    try:
        transcript, title = extract_youtube_transcript(body.url)
    except ValueError as e:
        raise HTTPException(400, detail=str(e))
    cleaned = clean_text(transcript)
    legacy_style = _map_to_legacy_style(body.summary_format, body.summary_role)
    book = Book(title=title, author="YouTube", user_id=current_user.id,
                raw_text=cleaned, source_type="youtube")
    db.add(book); db.flush()
    job_id = str(uuid.uuid4())
    job = Job(id=job_id, book_id=book.id, status=JobStatus.PENDING,
              style=legacy_style, summary_format=body.summary_format.upper(), summary_role=body.summary_role.upper())
    db.add(job); db.commit()
    background_tasks.add_task(process_job, job_id)
    return UploadResponse(message="YouTube transcript extracted, summarization started.",
                          book_id=book.id, job_id=job_id)


# ── Status / Summary / Chunks ─────────────────────────────────────────────────
@router.get("/status/{job_id}", response_model=JobStatusResponse)
def job_status(
    job_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, detail="Job not found")
    book = db.query(Book).filter(Book.id == job.book_id).first()
    if not book:
        raise HTTPException(404, detail="Associated book not found")
    if current_user.role != "admin" and book.user_id != current_user.id:
        raise HTTPException(403, detail="Not authorized")
    return JobStatusResponse(status=job.status.value, book_id=job.book_id, error=job.error)


@router.get("/summary/{book_id}", response_model=SummaryResponse)
def get_summary(
    book_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    book = _get_user_book(book_id, current_user, db)
    summary = db.query(Summary).filter(Summary.book_id == book_id).order_by(Summary.created_at.desc()).first()
    if not summary:
        raise HTTPException(404, detail="No summary found for this book")
    return SummaryResponse(
        summary_id=summary.id, book_id=book_id, book_title=book.title or "Untitled",
        summary=summary.summary_text, style=summary.style,
        summary_format=summary.summary_format, summary_role=summary.summary_role,
        source_mapping=summary.source_mapping, topics=summary.topics,
        original_word_count=summary.original_word_count,
        summary_word_count=summary.summary_word_count,
        created_at=summary.created_at.isoformat()
    )


@router.get("/{book_id}/chunks")
def get_book_chunks(
    book_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    book = _get_user_book(book_id, current_user)
    return {"book_id": book_id, "chunks": book.chunks_json or []}


# ── Export & Mind Map ─────────────────────────────────────────────────────────
@router.get("/export/{book_id}")
def export_summary(
    book_id: int,
    format: str = Query("txt", pattern="^(txt|docx|pdf)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    book = _get_user_book(book_id, current_user, db)
    summary = db.query(Summary).filter(Summary.book_id == book_id).order_by(Summary.created_at.desc()).first()
    if not summary:
        raise HTTPException(404, detail="No summary found for this book")
    title = book.title or "Summary"
    topics = summary.topics or []
    safe_title = "".join(c if c.isalnum() or c in " -_" else "_" for c in title)[:50]
    if format == "docx":
        content = export_as_docx(title, summary.summary_text, topics)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = f"{safe_title}_summary.docx"
    elif format == "pdf":
        content = export_as_pdf(title, summary.summary_text, topics)
        media_type = "application/pdf"
        filename = f"{safe_title}_summary.pdf"
    else:
        content = export_as_txt(title, summary.summary_text, topics)
        media_type = "text/plain"
        filename = f"{safe_title}_summary.txt"
    return Response(content=content, media_type=media_type,
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/mindmap/{book_id}")
def get_mindmap(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    book = _get_user_book(book_id, current_user, db)
    summary = db.query(Summary).filter(Summary.book_id == book_id).order_by(Summary.created_at.desc()).first()
    if not summary:
        raise HTTPException(404, detail="No summary found for this book")
    return generate_mindmap_data(
        summary.summary_text, title=book.title or "Summary",
        topics=summary.topics, original_text=book.raw_text,
    )


# ── Ask AI ────────────────────────────────────────────────────────────────────
@router.post("/{book_id}/ask")
def ask_document(
    book_id: int,
    req: AskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Answer a question about the document using BM25 retrieval + Groq.

    Passes pre-computed chunks from book.chunks_json so we don't
    re-chunk on every Ask AI call. Falls back to re-chunking raw_text
    if chunks haven't been stored yet (e.g. very old records).
    """
    from app.services.ask_service import answer_question
    book = _get_user_book(book_id, current_user, db)
    if not book.raw_text:
        raise HTTPException(400, detail="No text available for this document.")

    summary = (
        db.query(Summary)
        .filter(Summary.book_id == book_id)
        .order_by(Summary.created_at.desc())
        .first()
    )
    summary_text = summary.summary_text if summary else None

    # Use stored chunks — avoids re-chunking a 200-page book on every question
    precomputed_chunks = book.chunks_json or None

    return answer_question(
        book.raw_text,
        req.question,
        book.title or "Document",
        summary_text=summary_text,
        precomputed_chunks=precomputed_chunks,
    )


# ── Explain passage ───────────────────────────────────────────────────────────
@router.post("/{book_id}/explain")
def explain_text(
    book_id: int,
    req: ExplainRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Explain a passage in the chosen mode (explain/simplify/example/eli5)."""
    from app.services.explain_service import explain_passage
    _get_user_book(book_id, current_user, db)   # auth check only
    return explain_passage(req.text, req.mode)


# ── Key Insights ──────────────────────────────────────────────────────────────
@router.get("/{book_id}/insights")
def get_insights(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Extract 3-5 key insights from the summary."""
    from app.services.insights_service import extract_insights
    book = _get_user_book(book_id, current_user, db)
    summary = db.query(Summary).filter(Summary.book_id == book_id).order_by(Summary.created_at.desc()).first()
    if not summary:
        raise HTTPException(404, detail="No summary found.")
    return extract_insights(summary.summary_text, book.title or "Document")


# ── NLP Analytics (Sentiment & Evaluation) ──────────────────────────────────
@router.get("/{book_id}/sentiment")
def get_sentiment(
    book_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get the sentiment timeline data."""
    book = _get_user_book(book_id, current_user, db)
    return {"book_id": book_id, "sentiment_timeline": book.sentiment_json or []}

@router.post("/{book_id}/evaluate", response_model=EvaluateResponse)
def evaluate_summary(
    book_id: int,
    req: EvaluateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Evaluate generated summary against a reference using ROUGE scores."""
    from rouge_score import rouge_scorer
    book = _get_user_book(book_id, current_user, db)
    
    summary = db.query(Summary).filter(Summary.book_id == book_id).order_by(Summary.created_at.desc()).first()
    if not summary:
        raise HTTPException(404, detail="No summary found to evaluate.")
    
    scorer = rouge_scorer.RougeScorer(['rouge1', 'rouge2', 'rougeL'], use_stemmer=True)
    scores = scorer.score(req.reference_summary, summary.summary_text)
    
    return EvaluateResponse(
        rouge1=scores['rouge1'].fmeasure,
        rouge2=scores['rouge2'].fmeasure,
        rougeL=scores['rougeL'].fmeasure
    )


# ── List & Delete ─────────────────────────────────────────────────────────────
@router.get("/", response_model=List[BookListItem])
def list_user_books(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    query = db.query(Book)
    if current_user.role != "admin":
        query = query.filter(Book.user_id == current_user.id)
    books = query.order_by(Book.upload_date.desc()).all()
    return [
        BookListItem(
            id=b.id, title=b.title, author=b.author,
            upload_date=b.upload_date.isoformat(),
            has_summary=len(b.summaries) > 0,
            source_type=b.source_type,
        )
        for b in books
    ]


@router.delete("/{book_id}")
def delete_book(
    book_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    book = _get_user_book(book_id, current_user, db)
    db.delete(book)
    db.commit()
    return {"ok": True}