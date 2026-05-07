"""
Role-based sentence filtering using Zero-Shot NLI classification.
Uses facebook/bart-large-mnli to semantically score sentences against
role-specific hypotheses — no hardcoded keywords needed.
"""
import logging
from transformers import pipeline

from app.core.config import settings
from .role_prompts import get_role_hypotheses

logger = logging.getLogger(__name__)

# Lazy-loaded classifier
_classifier = None


def _get_classifier():
    """Lazy-load the zero-shot NLI classifier."""
    global _classifier
    if _classifier is None:
        logger.info(f"Loading NLI model {settings.nli_model}...")
        _classifier = pipeline(
            "zero-shot-classification",
            model=settings.nli_model,
            device=-1,  # CPU
        )
        logger.info("NLI model loaded.")
    return _classifier


def filter_by_role(
    text: str,
    role: str,
    threshold: float = 0.45,
) -> str:
    """
    Filter sentences by role relevance using zero-shot NLI classification.

    For each sentence, checks if it's semantically relevant to the role's
    hypotheses. Keeps sentences scoring above threshold.

    Args:
        text: Input text (already extractive-filtered)
        role: Role name (e.g., "TECHNICAL", "LEGAL")
        threshold: Minimum confidence score to keep a sentence

    Returns:
        Filtered text with only role-relevant sentences
    """
    import nltk
    hypotheses = get_role_hypotheses(role)

    # If no hypotheses (GENERAL role), return all text
    if not hypotheses:
        return text

    sentences = nltk.sent_tokenize(text)
    if len(sentences) <= 2:
        return text

    classifier = _get_classifier()
    kept = []

    # Batch process for efficiency: classify each sentence
    # against the combined role hypothesis label
    combined_label = " or ".join(hypotheses)

    for sent in sentences:
        if len(sent.split()) < 4:
            # Keep very short sentences (likely headings)
            kept.append(sent)
            continue

        try:
            result = classifier(
                sent,
                candidate_labels=[combined_label, "unrelated content"],
                hypothesis_template="{}",
            )
            # result['scores'][0] corresponds to first label
            relevance_score = result['scores'][0] if result['labels'][0] == combined_label else result['scores'][1]

            if relevance_score >= threshold:
                kept.append(sent)
        except Exception as e:
            logger.debug(f"NLI classification failed for sentence: {e}")
            kept.append(sent)  # keep on failure

    # If filtering removed too much, keep at least 30% of sentences
    if len(kept) < max(2, int(len(sentences) * 0.3)):
        # Fall back to keeping top sentences by score
        return text

    return " ".join(kept)
