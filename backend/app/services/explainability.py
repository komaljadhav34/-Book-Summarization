"""
Explainability service: builds a mapping between summary sentences
and the source chunks they were derived from, using sentence-transformers
cosine similarity.
"""
import logging
from typing import Optional

import nltk
nltk.download('punkt', quiet=True)
nltk.download('punkt_tab', quiet=True)

logger = logging.getLogger(__name__)

# Lazy-loaded encoder
_encoder = None


def _get_encoder():
    """Lazy-load the sentence-transformer model."""
    global _encoder
    if _encoder is None:
        from sentence_transformers import SentenceTransformer
        logger.info("Loading sentence-transformers model for explainability...")
        _encoder = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Sentence-transformers model loaded.")
    return _encoder


def build_source_map(
    summary_text: str,
    chunks: list[str],
    top_k: int = 3,
) -> Optional[dict]:
    """
    Build a mapping from each summary sentence index to its most relevant
    source chunk indices.

    Returns: {"0": [2, 5], "1": [0, 3], ...}  (string keys for JSON compat)
    Returns None if the mapping cannot be built.
    """
    if not summary_text or not chunks:
        return None

    try:
        encoder = _get_encoder()

        # Tokenize summary into sentences
        sentences = nltk.sent_tokenize(summary_text)
        if not sentences:
            return None

        # Encode everything
        sent_embeddings = encoder.encode(sentences, show_progress_bar=False)
        chunk_embeddings = encoder.encode(chunks, show_progress_bar=False)

        # Compute cosine similarity for each sentence vs all chunks
        # sentence_transformers.util has a fast implementation
        from sentence_transformers import util
        cos_scores = util.cos_sim(sent_embeddings, chunk_embeddings)

        source_map = {}
        for i, scores in enumerate(cos_scores):
            # Get top-k chunk indices
            k = min(top_k, len(chunks))
            top_indices = scores.topk(k).indices.tolist()
            source_map[str(i)] = top_indices

        return source_map

    except Exception as e:
        logger.error(f"Failed to build source map: {e}")
        return None
