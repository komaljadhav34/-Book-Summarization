"""
insights_service.py — Extract 3-5 key insights from a summary via Groq.

Place at: app/services/insights_service.py
"""
import os
import json
import logging
import re

logger = logging.getLogger(__name__)

_SYSTEM = """\
You are an expert analyst.

From the document summary below, extract exactly FOUR key insights.

A key insight is a high-value idea that reveals:
• the most important concept
• a major implication
• a significant finding
• or a critical conclusion

Rules:
- Each insight must appear on a NEW LINE.
- Start each line with the symbol "•".
- Each insight must contain one clear idea.
- Do NOT repeat sentences from the summary.
- Focus on the most meaningful takeaways, not minor details.

Example output:
["Insight one here.", "Insight two here.", "Insight three here.", "Insight four here."]
"""


def extract_insights(summary_text: str, title: str = "Document") -> dict:
    """
    Returns:
        { "insights": list[str] }
    """
    try:
        from groq import Groq
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            from app.core.config import settings
            api_key = getattr(settings, "groq_api_key", None)

        truncated = summary_text[:3000]
        prompt    = f"Document: {title}\n\nSummary:\n{truncated}\n\nExtract 4 key insights as a JSON array:"

        client = Groq(api_key=api_key)
        resp   = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=400,
            temperature=0.2,
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user",   "content": prompt},
            ],
        )
        raw = resp.choices[0].message.content.strip()

        # Extract JSON array
        raw = re.sub(r"^```[a-z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        if match:
            insights = json.loads(match.group())
            return {"insights": [str(i).strip() for i in insights[:5]]}

        # Fallback: split by newlines
        lines = [l.strip().lstrip("0123456789.-• ") for l in raw.splitlines() if len(l.strip()) > 20]
        return {"insights": lines[:5]}

    except Exception as exc:
        logger.error("insights_service error: %s", exc)
        return {"insights": []}
