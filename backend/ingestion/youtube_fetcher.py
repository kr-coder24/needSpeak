"""
YouTube transcript fetcher using youtube-transcript-api.

Only implemented after text and URL inputs are fully working.
Fetches auto-generated captions by video ID.
"""

from __future__ import annotations

import logging
import re
from urllib.parse import urlparse, parse_qs
from typing import Optional

logger = logging.getLogger(__name__)


def extract_video_id(url: str) -> Optional[str]:
    """
    Extract YouTube video ID from various URL formats:
    - youtube.com/watch?v=ID
    - youtu.be/ID
    - youtube.com/shorts/ID
    - youtube.com/embed/ID
    """
    try:
        parsed = urlparse(url)
        hostname = (parsed.hostname or "").lower()

        if hostname in ("youtu.be",):
            # Short URL: youtu.be/VIDEO_ID
            return parsed.path.lstrip("/").split("/")[0] or None

        if hostname in ("youtube.com", "www.youtube.com", "m.youtube.com"):
            # Standard: youtube.com/watch?v=VIDEO_ID
            if parsed.path == "/watch":
                params = parse_qs(parsed.query)
                video_ids = params.get("v", [])
                return video_ids[0] if video_ids else None

            # Shorts: youtube.com/shorts/VIDEO_ID
            if parsed.path.startswith("/shorts/"):
                return parsed.path.split("/shorts/")[1].split("/")[0] or None

            # Embed: youtube.com/embed/VIDEO_ID
            if parsed.path.startswith("/embed/"):
                return parsed.path.split("/embed/")[1].split("/")[0] or None

    except Exception as e:
        logger.warning(f"Failed to parse YouTube URL: {url} — {e}")

    return None


def fetch_youtube_transcript(url: str) -> str:
    """
    Fetch auto-generated transcript from a YouTube video.

    Returns the transcript as plain text for the extractor pipeline.
    Raises ValueError with helpful message if transcript is unavailable.
    """
    video_id = extract_video_id(url)
    if not video_id:
        raise ValueError(
            "Could not extract video ID from this YouTube URL. "
            "Please check the URL format and try again."
        )

    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except ImportError:
        raise ValueError(
            "YouTube transcript support requires the youtube-transcript-api package. "
            "Please install it: pip install youtube-transcript-api"
        )

    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

        # Prefer manually created transcripts, fall back to auto-generated
        transcript = None
        try:
            transcript = transcript_list.find_manually_created_transcript(["en", "hi"])
        except Exception:
            pass

        if transcript is None:
            try:
                transcript = transcript_list.find_generated_transcript(["en", "hi"])
            except Exception:
                raise ValueError(
                    "No English or Hindi transcript available for this video. "
                    "Please paste the relevant content from the video manually."
                )

        # Fetch and concatenate transcript segments
        segments = transcript.fetch()
        text_parts = [seg.text for seg in segments]
        full_text = " ".join(text_parts)

        if len(full_text) < 20:
            raise ValueError(
                "The transcript for this video is too short to extract useful content. "
                "Please paste the content manually."
            )

        # Truncate very long transcripts
        if len(full_text) > 8000:
            full_text = full_text[:8000]

        logger.info(f"Fetched YouTube transcript: {len(full_text)} chars from video {video_id}")
        return full_text

    except ValueError:
        raise  # Re-raise our own ValueErrors
    except Exception as e:
        logger.error(f"YouTube transcript fetch failed: {e}")
        raise ValueError(
            f"Could not fetch transcript for this video. "
            f"The video may not have captions enabled. "
            f"Please paste the relevant content manually."
        )
