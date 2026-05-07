"""
ask_service.py — RAG pipeline for document Q&A.

Pipeline:
  1. Query expansion  — Groq rewrites the question into rich search terms
  2. BM25 Retrieval   — scores all chunks, picks top-6
  3. Answer           — Groq answers using retrieved chunks + summary

Change from original:
  - Accepts pre-computed chunks (from book.chunks_json) to avoid
    re-chunking on every request — significant speedup for large docs.
  - Sources now return {label, text} so the frontend can display the
    passage content in a side drawer when a source tag is clicked.
"""

import re
import math
import logging

logger = logging.getLogger(__name__)
GROQ_MODEL = "llama-3.3-70b-versatile"


def _get_client():
    import os
    from groq import Groq
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        try:
            from app.core.config import settings
            api_key = getattr(settings, "groq_api_key", None)
        except Exception:
            pass
    if not api_key:
        raise ValueError("GROQ_API_KEY not set")
    return Groq(api_key=api_key)


# ── 1. Query expansion ────────────────────────────────────────────────────────

def _expand_query(question: str, doc_title: str) -> str:
    """Rewrite the question into diverse keywords via Groq."""
    try:
        client = _get_client()
        resp = client.chat.completions.create(
            model=GROQ_MODEL,
            max_tokens=150,
            temperature=0.2,
            messages=[{"role": "user", "content": (
                f"Document: {doc_title}\n"
                f"User question: {question}\n\n"
                "Generate 12-15 search keywords and phrases that would find relevant passages "
                "in this document. Include synonyms, related terms, abbreviations, and alternative "
                "phrasings. Think about how this topic appears in professional/academic writing.\n"
                "Return ONLY the keywords, comma-separated. No explanation."
            )}],
        )
        expanded = resp.choices[0].message.content.strip()
        return f"{question} {expanded}"
    except Exception as e:
        logger.warning("Query expansion failed: %s", e)
        return question


# ── 2. Chunking (used only when pre-computed chunks are unavailable) ──────────

def _chunk_text(text: str, size: int = 500, overlap: int = 80) -> list[str]:
    words = text.split()
    step = max(1, size - overlap)
    return [
        " ".join(words[i: i + size])
        for i in range(0, len(words), step)
        if words[i: i + size]
    ]


# ── 3. FAISS retrieval ─────────────────────────────────────────────────────────

def _retrieve(expanded_q: str, chunks: list[str], top_k: int = 6) -> list[tuple[int, str]]:
    """Retrieve using FAISS and HuggingFace embeddings."""
    if not chunks:
        return []
    
    try:
        from langchain_community.vectorstores import FAISS
        from langchain_huggingface import HuggingFaceEmbeddings
        
        logger.info("Building FAISS index on the fly...")
        embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        metadatas = [{"chunk_idx": i} for i in range(len(chunks))]
        vectorstore = FAISS.from_texts(chunks, embeddings, metadatas=metadatas)
        
        docs = vectorstore.similarity_search(expanded_q, k=top_k)
        return [(doc.metadata["chunk_idx"], doc.page_content) for doc in docs]
    except Exception as e:
        logger.error(f"FAISS retrieval error: {e}")
        # fallback if faiss fails
        return [(i, chunks[i]) for i in range(min(top_k, len(chunks)))]


# ── 4. Answer generation ──────────────────────────────────────────────────────

_SYS = """\
You are an expert document assistant. The user uploaded a document and is asking questions about it.
- Answer using the provided context passages.
- If the answer is directly stated, quote or paraphrase accurately.
- If multiple passages are needed, synthesize them.
- If the topic appears under different wording, still answer — note the phrasing used.
- Cite passages by number (e.g. "According to Passage 3...").
- Only say "not found" if context is genuinely unrelated.
- Be concise but complete.
"""


def answer_question(
    raw_text: str,
    question: str,
    doc_title: str = "Document",
    summary_text: str | None = None,
    precomputed_chunks: list[str] | None = None,
) -> dict:
    """
    Full RAG pipeline. Returns:
        {
            "answer": str,
            "sources": [{"label": "Passage 3", "text": "...first 500 chars..."}]
        }

    Args:
        raw_text:           Full document text (used to build chunks if
                            precomputed_chunks is None).
        question:           User's question.
        doc_title:          Book title for query expansion context.
        summary_text:       Optional summary injected at the top of context.
        precomputed_chunks: Chunks already stored in book.chunks_json.
                            Pass these to avoid re-chunking on every call.
    """
    if not raw_text or not raw_text.strip():
        return {
            "answer": "No document text available. Please re-upload the document.",
            "sources": [],
        }

    try:
        client = _get_client()

        # Step 1 — expand query
        expanded = _expand_query(question, doc_title)

        # Step 2 — use pre-computed chunks if available, otherwise build them
        if precomputed_chunks and len(precomputed_chunks) > 0:
            chunks = precomputed_chunks
            logger.debug("Using %d pre-computed chunks", len(chunks))
        else:
            chunks = _chunk_text(raw_text)
            logger.debug("Built %d chunks on-the-fly", len(chunks))

        top = _retrieve(expanded, chunks, top_k=6)

        # Step 3 — assemble context
        parts = []
        if summary_text and summary_text.strip():
            parts.append("[Document Summary]\n" + summary_text.strip()[:1500])
        for idx, chunk in top:
            parts.append(f"[Passage {idx + 1}]\n{chunk}")

        context = "\n\n---\n\n".join(parts)

        # Sources now carry the passage text so the frontend can show it
        sources = [
            {
                "label": f"Passage {idx + 1}",
                "text": chunk[:600],   # first 600 chars is enough for a drawer preview
            }
            for idx, chunk in top
        ]

        # Step 4 — answer
        resp = client.chat.completions.create(
            model=GROQ_MODEL,
            max_tokens=900,
            temperature=0.25,
            messages=[
                {"role": "system", "content": _SYS},
                {"role": "user", "content": (
                    f"Document: {doc_title}\n\nContext:\n{context}\n\n"
                    f"Question: {question}\n\nAnswer:"
                )},
            ],
        )
        return {
            "answer": resp.choices[0].message.content.strip(),
            "sources": sources,
        }

    except Exception as exc:
        logger.error("ask_service error: %s", exc)
        return {
            "answer": "Error processing your question. Please try again.",
            "sources": [],
        }