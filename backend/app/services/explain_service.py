"""
explain_service.py — Explain any passage in 4 modes via Groq.

Place at: app/services/explain_service.py
"""
import os
import logging

logger = logging.getLogger(__name__)

MODE_PROMPTS = {
    "explain": (
        "Explain the following passage clearly and accurately. "
        "Cover what it means and why it matters."
    ),
    "simplify": (
        "Rewrite the following passage in much simpler language. "
        "Use short sentences. Avoid jargon."
    ),
    "example": (
        "Give a concrete, real-world example that illustrates "
        "the concept described in the following passage."
    ),
    "eli5": (
        "Explain the following passage as if I am 10 years old. "
        "Use an analogy or story. Keep it fun and simple."
    ),
    "technical": (
        "Provide a technical deep-dive into the following passage. "
        "Use precise terminology and expand on the underlying mechanisms."
    ),
}


def explain_passage(text: str, mode: str = "explain") -> dict:
    """
    Returns:
        { "explanation": str, "mode": str }
    """
    try:
        from groq import Groq
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            from app.core.config import settings
            api_key = getattr(settings, "groq_api_key", None)

        instruction = MODE_PROMPTS.get(mode, MODE_PROMPTS["explain"])
        prompt = (
            f"{instruction}\n\n"
            f"Passage:\n\"{text.strip()}\"\n\n"
            "Response (2-4 sentences, be concise):"
        )

        client = Groq(api_key=api_key)
        resp   = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=400,
            temperature=0.4,
            messages=[{"role": "user", "content": prompt}],
        )
        explanation = resp.choices[0].message.content.strip()
        return {"explanation": explanation, "mode": mode}

    except Exception as exc:
        logger.error("explain_service error: %s", exc)
        return {"explanation": "Could not explain this passage. Please try again.", "mode": mode}
