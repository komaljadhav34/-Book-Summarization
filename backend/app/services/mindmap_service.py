"""
mindmap_service.py — Mermaid flowchart generation via Groq (llama-3.3-70b-versatile).

Pipeline:
  1. Call Groq to produce a valid `flowchart LR` diagram from the summary.
  2. Validate & auto-repair common Mermaid syntax errors.
  3. If Groq fails / output is unrepairably broken, fall back to a deterministic
     Markdown-aware parser that works on any BookSumAI summary.

Mermaid rules we enforce everywhere:
  • flowchart LR   (left-right is readable; graph TD tends to be too tall)
  • Node IDs : only [A-Za-z0-9_]   — NO spaces, hyphens, colons
  • Labels   : always double-quoted, max 45 chars, no " < > { } [ ] | & # ;
  • Arrows   : A --> B["label"]  only
  • No style / classDef / click / linkStyle / %% / subgraph directives
  • Total nodes 12–28
"""

import logging
import os
import re

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Sanitisation helpers
# ─────────────────────────────────────────────────────────────────────────────

def _clean_label(text: str, max_len: int = 42) -> str:
    """Return a Mermaid-safe, double-quote-ready label."""
    text = str(text).strip()
    # Kill characters that break Mermaid inside quoted labels
    text = re.sub(r'["\n\r]',       " ", text)
    text = re.sub(r'[<>{}()\[\]|&#;]', "", text)
    text = re.sub(r'\s+',           " ", text).strip()
    if len(text) > max_len:
        text = text[: max_len - 1].rstrip() + "…"
    return text


def _safe_id(*parts: str) -> str:
    """Build a safe Mermaid node ID from arbitrary strings."""
    raw = "_".join(str(p) for p in parts)
    return re.sub(r"[^A-Za-z0-9_]", "_", raw)


# ─────────────────────────────────────────────────────────────────────────────
# Groq-powered generation
# ─────────────────────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """\
You are a precise Mermaid diagramming engine.
Given a document summary you output ONLY valid Mermaid flowchart code — no prose,
no markdown code fences, no explanation, nothing else whatsoever.

STRICT SYNTAX RULES — violations cause parse errors, follow them exactly:
1.  First line MUST be exactly:   flowchart LR
2.  Node IDs: letters, digits, underscore ONLY. No spaces, hyphens, colons.
    Good: ROOT  N1  N2a  TopicOne
    Bad:  root-node  "idea"  N-1
3.  Every label MUST be double-quoted:  N1["Label text here"]
4.  Labels: max 40 characters, NO double-quotes, NO  < > { } [ ] | & # ; inside.
5.  Root node must be:  ROOT["<document title — max 40 chars>"]
6.  Connect root to 5–8 branch nodes:  ROOT --> N1["Branch name"]
7.  Each branch may have 2–4 child nodes:  N1 --> N1a["Child detail"]
8.  Arrow syntax ONLY:  A --> B["label"]
    FORBIDDEN: -->, -.->, ==>, --text-->, click, style, classDef, linkStyle,
               subgraph, end, %%anything
9.  Total nodes (ROOT + all others): between 14 and 26.
10. Output the raw Mermaid text and NOTHING else.

EXAMPLE of perfectly valid output:
flowchart LR
    ROOT["Machine Learning Basics"]
    ROOT --> N1["Supervised Learning"]
    N1 --> N1a["Classification tasks"]
    N1 --> N1b["Regression models"]
    ROOT --> N2["Unsupervised Learning"]
    N2 --> N2a["Clustering methods"]
    N2 --> N2b["Dimensionality reduction"]
    ROOT --> N3["Model Evaluation"]
    N3 --> N3a["Train test split"]
    N3 --> N3b["Cross validation"]
"""

_USER_TMPL = """\
Document title: {title}

Summary:
{summary}

Output the Mermaid flowchart now. Remember: raw Mermaid only, no fences, no prose.
"""


def _call_groq(summary: str, title: str) -> str | None:
    """Return raw Mermaid string from Groq, or None on any failure."""
    try:
        from groq import Groq
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            # Try settings object
            try:
                from app.core.config import settings
                api_key = getattr(settings, "groq_api_key", None)
            except Exception:
                pass
        if not api_key:
            logger.warning("GROQ_API_KEY not set — skipping Groq mindmap call")
            return None

        client  = Groq(api_key=api_key)
        # Truncate to keep prompt token-efficient
        trunc   = summary[:3500]
        clean_t = _clean_label(title, 55)

        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            temperature=0.2,          # low temp = more deterministic syntax
            max_tokens=1400,
            messages=[
                {"role": "system",  "content": _SYSTEM_PROMPT},
                {"role": "user",    "content": _USER_TMPL.format(
                    title=clean_t, summary=trunc
                )},
            ],
        )
        raw = resp.choices[0].message.content.strip()

        # Strip any accidental markdown fences
        raw = re.sub(r"^```[a-z]*\n?", "", raw, flags=re.IGNORECASE)
        raw = re.sub(r"\n?```\s*$",    "", raw)
        return raw.strip()

    except Exception as exc:
        logger.warning("Groq mindmap call failed: %s", exc)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Validation & repair
# ─────────────────────────────────────────────────────────────────────────────

# Directives that Mermaid's flowchart parser doesn't understand
_FORBIDDEN = re.compile(
    r'^\s*(classDef\b|class\s+\w|click\s|style\s|linkStyle\b|%%|subgraph\b|end\s*$)',
    re.IGNORECASE,
)

# A valid arrow line: ID --> ID["…"] or ID --> ID
_ARROW = re.compile(r'^\s*\w+\s*-->\s*\w+')

# Node definition: ID["…"] or ID(["…"]) — we'll normalise to ID["…"]
_NODE_DEF = re.compile(r'''(\w+)\s*[\(\[{]+\s*["']?([^"'\]\)}{]*)["']?\s*[\)\]}{]+''')


def _repair_label_line(line: str) -> str:
    """
    Try to fix common LLM mistakes on a single Mermaid line:
      • unquoted labels → add quotes
      • double-escaped quotes → single quotes
      • special chars in labels → strip
    """
    # Already well-formed arrow with quoted label
    if re.search(r'-->\s*\w+\["[^"]*"\]', line):
        return line

    # Arrow with unquoted or single-quoted label
    m = re.match(r'^(\s*)(\w+)\s*-->\s*(\w+)\s*[\[\(]([^\]\)]+)[\]\)]', line)
    if m:
        indent, src, dst, label = m.groups()
        label = _clean_label(label)
        return f'{indent}{src} --> {dst}["{label}"]'

    # Bare node declaration  ID["label"] — keep as-is if already quoted
    m2 = re.match(r'^(\s*)(\w+)\s*\["([^"]*)"\]', line)
    if m2:
        return line  # already fine

    return line


def _validate_and_repair(raw: str) -> str | None:
    """
    Returns a repaired Mermaid string, or None if fundamentally broken.
    """
    if not raw or not raw.strip():
        return None

    lines = raw.splitlines()
    out   = []
    has_arrow = False

    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            continue

        # First line must be flowchart directive
        if i == 0 and not stripped.lower().startswith("flowchart"):
            out.append("flowchart LR")
            # Don't skip this line — it might be a node/arrow

        # Drop forbidden directives
        if _FORBIDDEN.match(stripped):
            continue

        # Repair arrow lines
        if "-->" in stripped:
            line = _repair_label_line(line)
            has_arrow = True

        out.append(line)

    if not has_arrow:
        return None

    # Ensure starts with flowchart
    first_content = next((l for l in out if l.strip()), "")
    if not first_content.strip().lower().startswith("flowchart"):
        out.insert(0, "flowchart LR")

    return "\n".join(out)


# ─────────────────────────────────────────────────────────────────────────────
# Deterministic fallback — works on ANY BookSumAI summary
# ─────────────────────────────────────────────────────────────────────────────

def _build_from_summary(summary: str, title: str) -> str:
    """
    Parse markdown structure (headings, bullets, numbered lists) to build
    a clean flowchart.  Handles the output from every BookSumAI format.
    """
    lines    = summary.splitlines()
    sections: list[dict] = []   # [{heading, items}]
    current:  dict | None = None

    for raw in lines:
        line = raw.strip()
        if not line:
            continue

        # ## / ### heading → new section
        h = re.match(r'^#{1,3}\s+(.+)', line)
        if h:
            if current:
                sections.append(current)
            current = {"heading": h.group(1).strip(), "items": []}
            continue

        # **Bold heading** (with or without colon)
        b = re.match(r'^\*{1,2}(.+?)\*{1,2}:?\s*$', line)
        if b and len(b.group(1)) < 60:
            if current:
                sections.append(current)
            current = {"heading": b.group(1).strip(), "items": []}
            continue

        # Bullet or numbered item
        m = re.match(r'^(?:[•\-\*]|\d+\.)\s+(.+)', line)
        if m:
            item = m.group(1).strip()
            if current is None:
                current = {"heading": item[:50], "items": []}
            else:
                current["items"].append(item)
            continue

        # Plain sentence (≥ 30 chars) — add to current section
        if current and len(line) >= 30:
            current["items"].append(line)

    if current:
        sections.append(current)

    # If still nothing (e.g. plain prose), split into sentence chunks
    if not sections:
        sentences = re.split(r'(?<=[.!?])\s+', summary.strip())
        sentences = [s for s in sentences if len(s) > 20]
        chunk = max(3, len(sentences) // 6)
        for i in range(0, min(len(sentences), 30), chunk):
            grp = sentences[i: i + chunk]
            sections.append({
                "heading": grp[0][:50],
                "items":   grp[1:3],
            })

    # Cap branches + deduplicate
    sections = sections[:8]

    mermaid = ["flowchart LR"]
    mermaid.append(f'    ROOT["{_clean_label(title, 42)}"]')

    for i, sec in enumerate(sections):
        nid   = f"N{i}"
        label = _clean_label(sec["heading"], 42)
        if not label:
            continue
        mermaid.append(f'    ROOT --> {nid}["{label}"]')

        seen = set()
        for j, item in enumerate(sec["items"][:4]):
            cl = _clean_label(item, 40)
            if not cl or cl in seen:
                continue
            seen.add(cl)
            cid = f"N{i}c{j}"
            mermaid.append(f'    {nid} --> {cid}["{cl}"]')

    return "\n".join(mermaid)


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def generate_mindmap_data(
    summary_text:  str,
    title:         str       = "Summary",
    topics:        list | None = None,
    original_text: str | None  = None,
) -> dict:
    """
    Returns:
        {
            "center":   str,
            "branches": [],      # legacy — kept for backwards compat
            "mermaid":  str      # valid Mermaid flowchart LR code
        }
    """
    source = summary_text or original_text or ""
    if not source.strip():
        return {"center": title, "branches": [], "mermaid": ""}

    # ── 1. Groq generation ──────────────────────────────────────────────────
    mermaid = _call_groq(source, title)

    # ── 2. Validate / repair ────────────────────────────────────────────────
    if mermaid:
        mermaid = _validate_and_repair(mermaid)

    # ── 3. Fallback ─────────────────────────────────────────────────────────
    if not mermaid:
        logger.info("Using deterministic fallback flowchart for '%s'", title)
        mermaid = _build_from_summary(source, title)

    return {
        "center":   title,
        "branches": [],
        "mermaid":  mermaid,
    }
