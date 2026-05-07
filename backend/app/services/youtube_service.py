"""
YouTube transcript extraction service.
Compatible with youtube-transcript-api v1.2.x (new API).
Supports multi-language transcripts (not just English).
"""
import re
import logging

logger = logging.getLogger(__name__)

# Preferred languages in order (English first, then common ones, then any)
PREFERRED_LANGUAGES = ['en', 'en-US', 'en-GB', 'hi', 'es', 'fr', 'de', 'pt', 'ja', 'ko', 'zh']


def extract_video_id(url: str) -> str | None:
    """Extract YouTube video ID from various URL formats."""
    patterns = [
        r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/|youtube\.com/v/)([a-zA-Z0-9_-]{11})',
        r'(?:youtube\.com/shorts/)([a-zA-Z0-9_-]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def fetch_video_title(video_id: str) -> str:
    """Fetch video title from oEmbed endpoint (no API key needed)."""
    try:
        import requests
        oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        resp = requests.get(oembed_url, timeout=5)
        if resp.status_code == 200:
            return resp.json().get('title', f'YouTube Video ({video_id})')
    except Exception as e:
        logger.warning(f"Could not fetch title: {e}")
    return f'YouTube Video ({video_id})'


def extract_youtube_transcript(url: str) -> tuple[str, str]:
    """
    Extract transcript and title from a YouTube video.
    Uses youtube-transcript-api v1.2.x API.
    Supports any available language (not limited to English).

    Returns:
        (transcript_text, video_title)

    Raises:
        ValueError: If URL is invalid or transcript unavailable
    """
    video_id = extract_video_id(url)
    if not video_id:
        raise ValueError("Invalid YouTube URL. Please provide a valid YouTube video link.")

    title = fetch_video_title(video_id)

    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except ImportError:
        raise ValueError("youtube-transcript-api is not installed. Run: pip install youtube-transcript-api")

    # v1.2.x API: instantiate then call fetch/list
    api = YouTubeTranscriptApi()

    transcript_text = None
    used_language = None

    # Strategy 1: List all available transcripts and pick the best one
    try:
        transcript_list = api.list(video_id)
        available = list(transcript_list)
        logger.info(f"Available transcripts for {video_id}: {[t.language_code for t in available]}")

        # Sort by preference: preferred languages first, then any
        def lang_priority(t):
            code = t.language_code
            if code in PREFERRED_LANGUAGES:
                return PREFERRED_LANGUAGES.index(code)
            return 999

        sorted_transcripts = sorted(available, key=lang_priority)

        for t_info in sorted_transcripts:
            try:
                result = api.fetch(video_id, languages=[t_info.language_code])
                snippets = list(result)
                if snippets:
                    transcript_text = " ".join(s.text for s in snippets)
                    used_language = t_info.language_code
                    logger.info(f"Fetched transcript in '{used_language}': {len(snippets)} snippets, {len(transcript_text)} chars")
                    break
            except Exception as inner_e:
                logger.debug(f"Failed to fetch '{t_info.language_code}': {inner_e}")
                continue
    except Exception as e:
        logger.warning(f"Transcript listing failed: {e}")

    # Strategy 2: Blind fetch (let the API auto-select)
    if not transcript_text:
        try:
            result = api.fetch(video_id)
            snippets = list(result)
            if snippets:
                transcript_text = " ".join(s.text for s in snippets)
                used_language = "auto"
                logger.info(f"Auto-fetched transcript: {len(snippets)} snippets")
        except Exception as e:
            logger.warning(f"Auto fetch also failed: {e}")

    if not transcript_text:
        raise ValueError(
            "Could not extract transcript. The video may not have captions enabled, "
            "or it may be private/unavailable."
        )

    # Clean up transcript
    transcript_text = re.sub(r'\[.*?\]', '', transcript_text)  # Remove [Music], [Applause]
    transcript_text = re.sub(r'\s+', ' ', transcript_text).strip()

    if used_language and used_language != 'en':
        title = f"{title} ({used_language})"

    return transcript_text, title