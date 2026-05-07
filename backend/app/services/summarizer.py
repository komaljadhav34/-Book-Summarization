"""
Summarizer powered by Groq API (llama-3.3-70b-versatile).

Pipeline:
  1. Topic extraction (TF-IDF, local)
  2. Chunking
  3a. SHORT docs  (≤12k chars): single Groq call
  3b. LONG docs   (>12k chars): map-reduce
       - Summarize each chunk independently (CONCISE pass)
       - Batch chunk-summaries into groups of MAX_MERGE_BATCH
       - Recursively reduce until one summary remains
       - Final formatting pass with real role + format

Why map-reduce instead of a single long-context call:
  llama-3.3-70b on Groq has a ~128k token context, but a 300-page book
  often exceeds that when combined with the prompt. The recursive reduction
  also produces better quality because each layer focuses on a manageable
  amount of text.
"""
import logging
import nltk
from groq import Groq

nltk.download("punkt",     quiet=True)
nltk.download("punkt_tab", quiet=True)

from app.core.config import settings
from .chunking    import combined_chunking
from .role_prompts import get_role_prompt
from .extractive  import extract_topics

logger = logging.getLogger(__name__)

_client: Groq | None = None

GROQ_MODEL           = "llama-3.3-70b-versatile"
SHORT_TEXT_CHAR_LIMIT = 12_000   # single-call threshold (~3k tokens)
MAX_CHUNKS_TO_PROCESS = 60       # safety cap for very large books
MAX_MERGE_BATCH       = 8        # chunk-summaries per merge pass
CHUNK_SUMMARY_TOKENS  = 400      # max tokens per individual chunk summary
MERGE_SUMMARY_TOKENS  = 600      # max tokens per merge-batch summary
FINAL_SUMMARY_TOKENS  = 2048     # max tokens for the final formatted pass


def _get_client() -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=settings.groq_api_key)
    return _client


# ---------- Prompt building ----------

def _build_prompt(text: str, role: str, fmt: str) -> str:
    role_instruction = get_role_prompt(role)

    if fmt == "BULLETS":
        format_instruction = (
            "Write a bullet point summary of the document.\n\n"
            "STRICT FORMAT RULES:\n"
            "1. Use 5–7 bullet points.\n"
            "2. Each bullet point MUST start with '• '.\n"
            "3. Each bullet MUST be on a NEW LINE.\n"
            "4. Do NOT place multiple bullets on the same line.\n"
            "5. Each bullet should be 1–2 sentences.\n\n"
            "BAD FORMAT EXAMPLE (DO NOT DO THIS):\n"
            "• point 1 • point 2 • point 3\n\n"
            "GOOD FORMAT EXAMPLE:\n"
            "• point 1\n"
            "• point 2\n"
            "• point 3\n\n"
            "Follow the GOOD FORMAT strictly."
        )
    elif fmt == "DETAILED":
        format_instruction = (
            "Generate a structured summary using EXACTLY 5 paragraphs.\n\n"
            "OUTPUT FORMAT:\n"
            "[PARAGRAPH 1]\n<text>\n\n"
            "[PARAGRAPH 2]\n<text>\n\n"
            "[PARAGRAPH 3]\n<text>\n\n"
            "[PARAGRAPH 4]\n<text>\n\n"
            "[PARAGRAPH 5]\n<text>\n\n"
            "Each paragraph must be 4–6 sentences.\n"
            "Do not merge paragraphs.\n"
            "Do not skip labels."
        )
    else:  # CONCISE
        format_instruction = (
            "Write a concise overview of the document in 3–5 sentences.\n"
            "Capture the main purpose, key ideas, and conclusions.\n"
            "Keep it brief but complete so that a reader understands the overall message.\n"
            "Do NOT use bullet points or long explanations."
        )

    role_block = f"\n{role_instruction.strip()}\n" if role_instruction.strip() else ""

    return (
        f"You are an expert document summarizer.{role_block}\n"
        f"{format_instruction}\n\n"
        f"Text to summarize:\n{text}\n\n"
        f"Summary:"
    )


def _groq_call(prompt: str, max_tokens: int = 2048) -> str:
    client = _get_client()
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )
    return response.choices[0].message.content.strip()


# ---------- Format helpers ----------

def _format_bullets(text: str) -> str:
    if not text:
        return text
    if "•" in text or text.lstrip().startswith("-"):
        return text
    sentences = nltk.sent_tokenize(text)
    return "\n".join(f"• {s}" for s in sentences if s.strip())


# ---------- Map-reduce helpers ----------

def _summarize_chunk(chunk: str, role: str) -> str:
    """Summarize a single chunk in CONCISE mode (intermediate pass)."""
    prompt = _build_prompt(chunk, role, "CONCISE")
    return _groq_call(prompt, max_tokens=CHUNK_SUMMARY_TOKENS)


def _merge_batch(summaries: list[str], role: str) -> str:
    """Merge a batch of chunk-summaries into one intermediate summary."""
    combined = "\n\n".join(summaries)
    prompt   = _build_prompt(combined, role, "CONCISE")
    return _groq_call(prompt, max_tokens=MERGE_SUMMARY_TOKENS)


def _reduce(summaries: list[str], role: str) -> str:
    """
    Recursively reduce a list of summaries to a single string.
    Each recursion batches MAX_MERGE_BATCH items and calls Groq once per batch.
    """
    if len(summaries) == 1:
        return summaries[0]

    batches = [
        summaries[i: i + MAX_MERGE_BATCH]
        for i in range(0, len(summaries), MAX_MERGE_BATCH)
    ]
    reduced = []
    for batch in batches:
        try:
            reduced.append(_merge_batch(batch, role))
        except Exception as e:
            logger.warning("Merge batch failed, using first item: %s", e)
            reduced.append(batch[0])

    return _reduce(reduced, role)


# ---------- Main entry point ----------

def hierarchical_summarize(
    text: str,
    summary_format: str = "CONCISE",
    summary_role:   str = "GENERAL",
) -> tuple[str, list[str], list[str]]:
    """
    Summarize text using Groq (llama-3.3-70b-versatile).

    Returns:
        (summary_text, chunks_used, topics)
    """
    if not text or not text.strip():
        return "No content to summarize.", [], []

    fmt  = (summary_format or "CONCISE").upper()
    role = (summary_role   or "GENERAL").upper()

    # ── Topic extraction (fast, local, TF-IDF) ────────────────────────────
    try:
        topics = extract_topics(text, top_n=8)
    except Exception:
        topics = []

    # ── Chunking (stored for explainability + Ask AI) ─────────────────────
    try:
        chunks = [c for c in combined_chunking(text) if c.strip()]
    except Exception as e:
        logger.error("Chunking error: %s", e)
        chunks = [text]

    # ── SHORT TEXT: single Groq call ──────────────────────────────────────
    if len(text) <= SHORT_TEXT_CHAR_LIMIT:
        try:
            prompt  = _build_prompt(text, role, fmt)
            summary = _groq_call(prompt, max_tokens=FINAL_SUMMARY_TOKENS)
            logger.info("Single-pass summary: %d chars → %d chars", len(text), len(summary))
            return summary, chunks, topics
        except Exception as e:
            logger.error("Groq summarization failed: %s", e)
            return "Summarization failed. Please try again.", chunks, topics

    # ── LONG TEXT: map → reduce → format ─────────────────────────────────
    work_chunks = chunks[:MAX_CHUNKS_TO_PROCESS]
    logger.info(
        "Long text (%d chars) — map-reduce over %d chunks (role=%s, fmt=%s)",
        len(text), len(work_chunks), role, fmt,
    )

    # Map: summarize every chunk individually
    chunk_summaries: list[str] = []
    for i, chunk in enumerate(work_chunks):
        if not chunk.strip():
            continue
        try:
            result = _summarize_chunk(chunk, role)
            if result:
                chunk_summaries.append(result)
                logger.debug("Chunk %d/%d: %d → %d chars", i + 1, len(work_chunks), len(chunk), len(result))
        except Exception as e:
            logger.warning("Chunk %d summarization failed: %s", i, e)

    if not chunk_summaries:
        return "Summarization produced no output.", chunks, topics

    # Reduce: recursively merge until one summary
    try:
        merged = _reduce(chunk_summaries, role)
    except Exception as e:
        logger.error("Reduce phase failed: %s", e)
        merged = chunk_summaries[0]

    # Format: apply the real format + role to the merged intermediate summary
    try:
        final_prompt = _build_prompt(merged, role, fmt)
        final = _groq_call(final_prompt, max_tokens=FINAL_SUMMARY_TOKENS)
    except Exception as e:
        logger.warning("Final format pass failed, using merged: %s", e)
        final = merged

    # Ensure bullet formatting if requested and model missed it
    if fmt == "BULLETS" and "•" not in final:
        final = _format_bullets(final)

    logger.info(
        "Map-reduce summary complete: %d chars, %d topics, %d chunk-summaries reduced",
        len(final), len(topics), len(chunk_summaries),
    )
    return final, chunks, topics