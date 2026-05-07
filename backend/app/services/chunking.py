import re
from nltk.tokenize import sent_tokenize

MAX_CHUNK_WORDS = 500  # BART works best with ~400-600 word chunks


def detect_headings(lines):
    """
    Detect possible headings in a list of lines.
    Returns list of (line_index, heading_text).
    """
    headings = []
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
        # Heuristics: all caps, or starts with chapter/section, or short & followed by blank line
        if (line.isupper() and len(line) < 100) or \
           re.match(r'^(chapter|part|section|article|appendix)\s+[\d\w\.]+', line, re.I):
            headings.append((i, line))
        elif i > 0 and lines[i-1].strip() == '' and len(line) < 100 and not line.endswith('.'):
            headings.append((i, line))
    return headings


def split_by_headings(text):
    """Split text into sections based on detected headings."""
    lines = text.split('\n')
    headings = detect_headings(lines)
    if not headings:
        return [text]

    sections = []
    for idx, (line_num, heading) in enumerate(headings):
        start = line_num
        end = headings[idx+1][0] if idx+1 < len(headings) else len(lines)
        section = '\n'.join(lines[start:end]).strip()
        if section:
            sections.append(section)
    return sections


def split_paragraphs(text):
    """Split text by double newlines (paragraphs)."""
    return [p.strip() for p in text.split('\n\n') if p.strip()]


def split_long_chunk(chunk, max_words=MAX_CHUNK_WORDS):
    """
    If a chunk exceeds max_words, split it at sentence boundaries.
    This ensures each chunk is within BART's optimal range without cutting mid-sentence.
    """
    words = chunk.split()
    if len(words) <= max_words:
        return [chunk]

    sentences = sent_tokenize(chunk)
    sub_chunks = []
    current = []
    current_word_count = 0

    for sent in sentences:
        sent_words = len(sent.split())
        if current_word_count + sent_words > max_words and current:
            sub_chunks.append(" ".join(current))
            current = [sent]
            current_word_count = sent_words
        else:
            current.append(sent)
            current_word_count += sent_words

    if current:
        sub_chunks.append(" ".join(current))

    return sub_chunks


def combined_chunking(text):
    """
    Primary chunking pipeline: headings → paragraphs → word-limit splitting.
    Returns list of text chunks, each ≤ MAX_CHUNK_WORDS words.
    """
    sections = split_by_headings(text)
    chunks = []
    for section in sections:
        paragraphs = split_paragraphs(section)
        for para in paragraphs:
            # If paragraph is too long, split at sentence boundaries
            sub_chunks = split_long_chunk(para)
            chunks.extend(sub_chunks)

    # If no chunks found, fallback to splitting the full text
    if not chunks:
        chunks = split_long_chunk(text)

    return chunks