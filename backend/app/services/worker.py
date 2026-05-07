"""
Background job processor.

With Claude-based summarization, the pipeline is:
  1. Mark job PROCESSING
  2. Run hierarchical_summarize (Claude API, ~5-8 sec)
  3. Store chunks + source map for explainability
  4. Store Summary record
  5. Mark job COMPLETED

No NLI role-filter step needed — Claude handles role natively via prompt.
"""
import logging
from app.core.database import SessionLocal
from app.models.book import Job, JobStatus, Summary
from app.services.summarizer import hierarchical_summarize
from app.services.explainability import build_source_map

logger = logging.getLogger(__name__)


def process_job(job_id: str) -> None:
    """
    Background task: run summarization, update DB.
    Called by FastAPI BackgroundTasks — owns its own DB session.
    """
    db = SessionLocal()
    job = None
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            logger.error(f"Job {job_id} not found in DB")
            return

        # Mark as processing
        job.status = JobStatus.PROCESSING
        db.commit()

        book = job.book
        if not book or not book.raw_text:
            raise ValueError("Associated book has no raw text")

        summary_format = job.summary_format or "CONCISE"
        summary_role = job.summary_role or "GENERAL"
        original_word_count = len(book.raw_text.split())

        logger.info(
            f"Job {job_id}: summarizing book {book.id} "
            f"({original_word_count} words, format={summary_format}, role={summary_role})"
        )

        # Core summarization — Claude API
        summary_text, chunks_used, topics = hierarchical_summarize(
            book.raw_text,
            summary_format=summary_format,
            summary_role=summary_role,
        )

        summary_word_count = len(summary_text.split())

        # Persist chunks for explainability endpoint
        book.chunks_json = chunks_used
        
        # Analyze sentiment & emotion for the timeline chart
        try:
            from app.services.sentiment_service import analyze_chunks
            logger.info(f"Job {job_id}: analyzing sentiment for {len(chunks_used)} chunks...")
            book.sentiment_json = analyze_chunks(chunks_used)
        except Exception as se:
            logger.error(f"Sentiment analysis failed: {se}")

        db.commit()

        # Build sentence → chunk mapping
        source_mapping = build_source_map(summary_text, chunks_used)

        # Persist summary
        summary = Summary(
            book_id=book.id,
            summary_text=summary_text,
            style=job.style,
            summary_format=summary_format,
            summary_role=summary_role,
            source_mapping=source_mapping,
            topics=topics,
            original_word_count=original_word_count,
            summary_word_count=summary_word_count,
        )
        db.add(summary)
        db.commit()

        job.status = JobStatus.COMPLETED
        db.commit()
        logger.info(f"Job {job_id} completed: {original_word_count} → {summary_word_count} words")

    except Exception as e:
        logger.exception(f"Job {job_id} failed: {e}")
        if job is not None:
            try:
                job.status = JobStatus.FAILED
                job.error = str(e)[:500]   # truncate long tracebacks
                db.commit()
            except Exception:
                pass
    finally:
        db.close()
