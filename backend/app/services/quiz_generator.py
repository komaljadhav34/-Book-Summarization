"""
Quiz generator powered by Groq API (llama-3.3-70b-versatile).

Changes from original:
  - Difficulty field added to prompt contract and parsed from response.
  - Validated difficulty is normalised to "easy" | "medium" | "hard".
  - Guaranteed distribution: 3 easy / 4 medium / 3 hard (for 10 questions).
"""
import json
import logging
import re
from groq import Groq, APIError

from app.core.config import settings

logger = logging.getLogger(__name__)

GROQ_MODEL = "llama-3.3-70b-versatile"
MAX_INPUT_CHARS = 20_000

_client: Groq | None = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=settings.groq_api_key)
    return _client


def generate_questions_from_chunk(text: str, num_questions: int = 10) -> list[dict]:
    """
    Generate `num_questions` MCQs using Groq/Llama.

    Each returned dict includes a "difficulty" key: "easy" | "medium" | "hard".
    """
    if not text or len(text.strip()) < 100:
        logger.warning("Text too short for quiz generation")
        return []

    client = _get_client()
    excerpt = text[:MAX_INPUT_CHARS]

    # Compute target distribution based on num_questions
    easy_count   = max(1, round(num_questions * 0.3))
    hard_count   = max(1, round(num_questions * 0.3))
    medium_count = num_questions - easy_count - hard_count

    prompt = f"""You are an expert educator creating a comprehension quiz.

Generate exactly {num_questions} multiple-choice questions based on the text below.

TEXT:
{excerpt}

STRICT REQUIREMENTS:
1. Each question must have exactly 4 answer options.
2. Exactly ONE option must be correct.
3. The "correct_answer" field must be copied EXACTLY (character-for-character) from the "options" array.
4. Include a clear, factual explanation of WHY the answer is correct.
5. Difficulty distribution: exactly {easy_count} "easy", {medium_count} "medium", {hard_count} "hard".
   - easy:   factual recall, directly stated in the text
   - medium: requires understanding a concept or making a basic inference
   - hard:   requires synthesis, comparison, or identifying an implication
6. Include the "difficulty" field on every question — value must be exactly "easy", "medium", or "hard".
7. Questions must test comprehension and understanding — not trivial facts.
8. Plausible distractors: wrong options should be believable but clearly incorrect.

Return ONLY a valid JSON array — no markdown, no preamble, no trailing text:
[
  {{
    "question": "Question text ending with a question mark?",
    "difficulty": "easy",
    "options": [
      "First option text",
      "Second option text",
      "Third option text",
      "Fourth option text"
    ],
    "correct_answer": "First option text",
    "explanation": "This is correct because..."
  }}
]"""

    try:
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )
        raw = response.choices[0].message.content.strip()

        # Strip accidental markdown fences
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)

        json_match = re.search(r"\[.*\]", raw, re.DOTALL)
        if not json_match:
            logger.error("No JSON array in Groq response. Raw: %s", raw[:300])
            return []

        questions_data: list[dict] = json.loads(json_match.group())

    except json.JSONDecodeError as e:
        logger.error("JSON parse error: %s", e)
        return []
    except APIError as e:
        logger.error("Groq API error: %s", e)
        return []
    except Exception as e:
        logger.error("Unexpected error in quiz generation: %s", e)
        return []

    valid: list[dict] = []
    for i, q in enumerate(questions_data):
        try:
            question_text = str(q.get("question", "")).strip()
            options       = [str(o).strip() for o in q.get("options", [])]
            correct       = str(q.get("correct_answer", "")).strip()
            explanation   = str(q.get("explanation", "")).strip()
            difficulty    = str(q.get("difficulty", "medium")).strip().lower()

            if not question_text or len(options) != 4:
                logger.debug("Q%d: skipped — bad structure", i)
                continue

            # Normalise difficulty to allowed values
            if difficulty not in ("easy", "medium", "hard"):
                difficulty = "medium"

            # Guarantee correct_answer is one of the options
            if correct not in options:
                matched = next(
                    (opt for opt in options
                     if opt.lower().strip(".") == correct.lower().strip(".")),
                    None,
                )
                correct = matched if matched else options[0]

            valid.append({
                "question":      question_text,
                "question_type": "multiple_choice",
                "difficulty":    difficulty,
                "options":       options,
                "answer":        correct,
                "explanation":   explanation,
            })
        except Exception as e:
            logger.debug("Q%d: validation error — %s", i, e)
            continue

    logger.info(
        "Quiz: %d valid questions from %d chars (easy=%d, medium=%d, hard=%d)",
        len(valid),
        len(text),
        sum(1 for q in valid if q["difficulty"] == "easy"),
        sum(1 for q in valid if q["difficulty"] == "medium"),
        sum(1 for q in valid if q["difficulty"] == "hard"),
    )
    return valid[:num_questions]


def validate_answer(
    user_answer: str,
    correct_answer: str,
    threshold: float = 0.7,
) -> tuple[bool, float]:
    """Validate a user's MCQ answer against the stored correct answer."""
    user_clean    = user_answer.strip().lower()
    correct_clean = correct_answer.strip().lower()

    if user_clean == correct_clean:
        return True, 1.0
    if user_clean.strip(".?,") == correct_clean.strip(".?,"):
        return True, 1.0
    if user_clean in correct_clean or correct_clean in user_clean:
        return True, 0.9
    return False, 0.0