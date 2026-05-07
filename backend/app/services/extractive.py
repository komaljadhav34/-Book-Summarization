"""
Extractive summarization using TextRank + TF-IDF.
Pre-filters text before abstractive pass for the hybrid pipeline.
Also extracts document topics via top TF-IDF terms.
"""
import logging
import numpy as np
import nltk

nltk.download('punkt', quiet=True)
nltk.download('punkt_tab', quiet=True)
nltk.download('stopwords', quiet=True)

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)


def _textrank_scores(sentences: list[str]) -> np.ndarray:
    """
    Compute TextRank scores for a list of sentences.
    Uses TF-IDF vectors + cosine similarity as the graph edge weights,
    then iterates PageRank until convergence.
    """
    if len(sentences) <= 2:
        return np.ones(len(sentences))

    try:
        vectorizer = TfidfVectorizer(stop_words='english', max_features=5000)
        tfidf_matrix = vectorizer.fit_transform(sentences)
    except ValueError:
        return np.ones(len(sentences))

    sim_matrix = cosine_similarity(tfidf_matrix)
    np.fill_diagonal(sim_matrix, 0)

    # Normalize rows to create transition matrix
    row_sums = sim_matrix.sum(axis=1, keepdims=True)
    row_sums[row_sums == 0] = 1
    transition = sim_matrix / row_sums

    # PageRank iteration
    n = len(sentences)
    damping = 0.85
    scores = np.ones(n) / n

    for _ in range(50):
        new_scores = (1 - damping) / n + damping * transition.T @ scores
        if np.allclose(scores, new_scores, atol=1e-6):
            break
        scores = new_scores

    return scores


def extract_topics(text: str, top_n: int = 8) -> list[str]:
    """Extract top-N topic keywords from text using TF-IDF."""
    try:
        vectorizer = TfidfVectorizer(
            stop_words='english',
            max_features=200,
            ngram_range=(1, 2),
        )
        tfidf_matrix = vectorizer.fit_transform([text])
        feature_names = vectorizer.get_feature_names_out()
        scores = tfidf_matrix.toarray()[0]

        top_indices = scores.argsort()[-top_n:][::-1]
        topics = [feature_names[i] for i in top_indices if scores[i] > 0]
        return topics
    except Exception as e:
        logger.warning(f"Topic extraction failed: {e}")
        return []


def extract_key_sentences(
    text: str,
    ratio: float = 0.4,
) -> tuple[str, list[str]]:
    """
    TextRank-based extractive summarization.

    Args:
        text: Input text
        ratio: Fraction of sentences to keep (0.0-1.0)

    Returns:
        (filtered_text, topics)
    """
    if not text.strip():
        return text, []

    sentences = nltk.sent_tokenize(text)
    if len(sentences) <= 3:
        topics = extract_topics(text)
        return text, topics

    scores = _textrank_scores(sentences)

    # Determine how many sentences to keep
    keep_count = max(3, int(len(sentences) * ratio))
    keep_count = min(keep_count, len(sentences))

    # Get top sentence indices (preserve original order)
    top_indices = set(scores.argsort()[-keep_count:])
    filtered = [s for i, s in enumerate(sentences) if i in top_indices]

    topics = extract_topics(text)

    return " ".join(filtered), topics
