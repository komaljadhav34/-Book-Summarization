import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

# Lazy-loaded pipeline to save memory/startup time
_sentiment_pipeline = None

def get_sentiment_pipeline():
    global _sentiment_pipeline
    if _sentiment_pipeline is None:
        from transformers import pipeline
        logger.info("Loading sentiment analysis pipeline...")
        # roberta-base sentiment returns labels: LABEL_0 (negative), LABEL_1 (neutral), LABEL_2 (positive)
        _sentiment_pipeline = pipeline(
            "sentiment-analysis",
            model="cardiffnlp/twitter-roberta-base-sentiment",
            truncation=True,
            max_length=512
        )
    return _sentiment_pipeline

def map_label_to_emotion(label: str) -> str:
    """Heuristic mapping from roberta sentiment label to a basic emotion."""
    if label == "LABEL_0":
        return "melancholic" # negative
    elif label == "LABEL_1":
        return "calm"        # neutral
    elif label == "LABEL_2":
        return "hopeful"     # positive
    return "neutral"

def map_label_to_sentiment(label: str) -> str:
    if label == "LABEL_0":
        return "negative"
    elif label == "LABEL_1":
        return "neutral"
    elif label == "LABEL_2":
        return "positive"
    return "neutral"

def analyze_chunks(chunks: List[str]) -> List[Dict[str, Any]]:
    """
    Run sentiment analysis on a list of text chunks.
    Returns a list of dicts with chunk index, sentiment score, and emotion.
    """
    if not chunks:
        return []

    try:
        classifier = get_sentiment_pipeline()
        results = []
        for i, chunk in enumerate(chunks):
            # Take first ~400 words to be safe with roberta's 512 token limit
            # The pipeline 'truncation=True' also helps, but we can do a soft trim
            text_to_analyze = " ".join(chunk.split()[:400])
            
            output = classifier(text_to_analyze)[0]
            label = output["label"]
            score = output["score"]
            
            sentiment = map_label_to_sentiment(label)
            emotion = map_label_to_emotion(label)
            
            results.append({
                "chunk_index": i,
                "sentiment": sentiment,
                "confidence": score,
                "emotion": emotion
            })
            
        return results
    except Exception as e:
        logger.error(f"Error in sentiment analysis: {e}")
        return []
