import re
import logging
import pdfplumber
from io import BytesIO
import docx

logger = logging.getLogger(__name__)

def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    """Extract text from PDF bytes using pdfplumber."""
    text_pages = []
    try:
        with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_pages.append(page_text)
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
    return "\n".join(text_pages)

def extract_metadata_from_pdf_bytes(pdf_bytes: bytes) -> dict:
    """Extract title/author from PDF metadata."""
    meta = {"title": None, "author": None}
    try:
        with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
            if pdf.metadata:
                meta["title"] = pdf.metadata.get("Title")
                meta["author"] = pdf.metadata.get("Author")
    except Exception as e:
        logger.warning(f"PDF metadata extraction failed: {e}")
    return meta

def extract_text_from_txt_bytes(txt_bytes: bytes) -> str:
    """Decode TXT bytes (assumes UTF-8)."""
    try:
        return txt_bytes.decode("utf-8")
    except UnicodeDecodeError:
        # fallback to latin-1
        return txt_bytes.decode("latin-1")

def extract_text_from_docx_bytes(docx_bytes: bytes) -> str:
    """Extract text from DOCX bytes."""
    paragraphs = []
    try:
        doc = docx.Document(BytesIO(docx_bytes))
        for para in doc.paragraphs:
            if para.text:
                paragraphs.append(para.text)
    except Exception as e:
        logger.error(f"DOCX extraction error: {e}")
    return "\n".join(paragraphs)

def clean_text(text: str) -> str:
    """
    Basic cleaning: normalize whitespace, fix hyphenation.
    Preserves paragraph breaks (double newlines) so chunking can detect structure.
    """
    if not text:
        return ""
    # Fix hyphenated line breaks FIRST: "in-\n  terface" -> "interface"
    text = re.sub(r'(\w)-\s+(\w)', r'\1\2', text)
    # Normalize paragraph separators: 2+ newlines → double newline
    text = re.sub(r'\n\s*\n', '\n\n', text)
    # Within each paragraph, collapse runs of spaces/tabs to a single space
    # but preserve single newlines (which may indicate heading structure)
    text = re.sub(r'[^\S\n]+', ' ', text)
    # Remove control characters (keep printable + whitespace)
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    return text.strip()