"""
Unified Bedrock Converse API wrapper.

Provides helper functions for text, vision (image), and document (PDF)
calls via the Bedrock Converse API. Works with Amazon Nova Pro, Claude,
Llama, and any other model available on Bedrock.

Also includes an Amazon Transcribe helper for audio-to-text.
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Optional

import boto3
import requests

from app import config
from app.pipeline.bedrock_client import get_bedrock_client

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Text-only Converse call
# ---------------------------------------------------------------------------
def call_bedrock_text(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 4096,
    temperature: float = 0.1,
) -> str:
    """
    Send a text-only prompt to Bedrock via the Converse API.
    Retries up to 3 times with exponential backoff on throttling.
    """
    client = get_bedrock_client()
    last_error: Optional[Exception] = None

    for attempt in range(3):
        try:
            logger.info(
                f"Bedrock Converse text call (model={config.BEDROCK_MODEL_ID}, attempt {attempt + 1})..."
            )
            response = client.converse(
                modelId=config.BEDROCK_MODEL_ID,
                system=[{"text": system_prompt}],
                messages=[
                    {
                        "role": "user",
                        "content": [{"text": user_prompt}],
                    }
                ],
                inferenceConfig={
                    "maxTokens": max_tokens,
                    "temperature": temperature,
                },
            )
            text = response["output"]["message"]["content"][0]["text"]
            if text:
                logger.info(f"Bedrock Converse text call succeeded (model={config.BEDROCK_MODEL_ID})")
                return text
            raise ValueError("Empty response text from Bedrock Converse")

        except Exception as e:
            last_error = e
            err_str = str(e)
            logger.warning(f"Bedrock Converse attempt {attempt + 1} failed: {err_str}")

            # Retry on throttling / transient errors
            if "Throttling" in err_str or "throttl" in err_str.lower() or "Too many" in err_str:
                wait = (attempt + 1) * 5
                logger.info(f"Throttled — waiting {wait}s before retry...")
                time.sleep(wait)
            else:
                # Non-transient error — don't retry
                break

    raise last_error or RuntimeError("Bedrock Converse text call failed")


# ---------------------------------------------------------------------------
# Vision (image) Converse call
# ---------------------------------------------------------------------------
def guess_image_format(image_bytes: bytes, fallback_mime: str) -> str:
    if image_bytes.startswith(b'\xff\xd8'): return 'jpeg'
    if image_bytes.startswith(b'\x89PNG\r\n\x1a\n'): return 'png'
    if image_bytes.startswith(b'GIF87a') or image_bytes.startswith(b'GIF89a'): return 'gif'
    if image_bytes.startswith(b'RIFF') and image_bytes[8:12] == b'WEBP': return 'webp'
    
    # Fallback to checking the mime type string
    mime = fallback_mime.lower().strip()
    if 'png' in mime: return 'png'
    if 'gif' in mime: return 'gif'
    if 'webp' in mime: return 'webp'
    return 'jpeg'

def call_bedrock_vision(
    image_bytes: bytes,
    mime_type: str,
    prompt: str,
    system_prompt: Optional[str] = None,
    max_tokens: int = 4096,
    temperature: float = 0.2,
) -> str:
    """
    Send an image + text prompt to Bedrock via the Converse API.
    Works with any Bedrock model that supports vision (Nova Pro, Claude 3+, etc.)
    """
    client = get_bedrock_client()
    
    # AWS Bedrock Converse API requires the exact matching format for the bytes.
    # We sniff the magic numbers to be absolutely sure.
    img_format = guess_image_format(image_bytes, mime_type)

    # Build message content
    content_blocks = [
        {
            "image": {
                "format": img_format,
                "source": {"bytes": image_bytes},
            }
        },
        {"text": prompt},
    ]

    # Build kwargs
    kwargs = {
        "modelId": config.BEDROCK_MODEL_ID,
        "messages": [{"role": "user", "content": content_blocks}],
        "inferenceConfig": {
            "maxTokens": max_tokens,
            "temperature": temperature,
        },
    }
    if system_prompt:
        kwargs["system"] = [{"text": system_prompt}]

    last_error: Optional[Exception] = None
    for attempt in range(3):
        try:
            logger.info(
                f"Bedrock Converse vision call (model={config.BEDROCK_MODEL_ID}, attempt {attempt + 1})..."
            )
            response = client.converse(**kwargs)
            text = response["output"]["message"]["content"][0]["text"]
            if text:
                logger.info("Bedrock Converse vision call succeeded")
                return text
            raise ValueError("Empty response from Bedrock Converse vision")
        except Exception as e:
            last_error = e
            err_str = str(e)
            logger.warning(f"Bedrock Converse vision attempt {attempt + 1} failed: {err_str}")
            if "Throttling" in err_str or "throttl" in err_str.lower():
                time.sleep((attempt + 1) * 5)
            else:
                break

    raise last_error or RuntimeError("Bedrock Converse vision call failed")


# ---------------------------------------------------------------------------
# Document (PDF) Converse call
# ---------------------------------------------------------------------------
def call_bedrock_document(
    doc_bytes: bytes,
    prompt: str,
    doc_format: str = "pdf",
    doc_name: str = "uploaded_document",
    system_prompt: Optional[str] = None,
    max_tokens: int = 4096,
    temperature: float = 0.2,
) -> str:
    """
    Send a document (PDF) + text prompt to Bedrock via the Converse API.
    """
    client = get_bedrock_client()

    content_blocks = [
        {
            "document": {
                "format": doc_format,
                "name": doc_name,
                "source": {"bytes": doc_bytes},
            }
        },
        {"text": prompt},
    ]

    kwargs = {
        "modelId": config.BEDROCK_MODEL_ID,
        "messages": [{"role": "user", "content": content_blocks}],
        "inferenceConfig": {
            "maxTokens": max_tokens,
            "temperature": temperature,
        },
    }
    if system_prompt:
        kwargs["system"] = [{"text": system_prompt}]

    last_error: Optional[Exception] = None
    for attempt in range(3):
        try:
            logger.info(
                f"Bedrock Converse document call (model={config.BEDROCK_MODEL_ID}, attempt {attempt + 1})..."
            )
            response = client.converse(**kwargs)
            text = response["output"]["message"]["content"][0]["text"]
            if text:
                logger.info("Bedrock Converse document call succeeded")
                return text
            raise ValueError("Empty response from Bedrock Converse document")
        except Exception as e:
            last_error = e
            err_str = str(e)
            logger.warning(f"Bedrock Converse document attempt {attempt + 1} failed: {err_str}")
            if "Throttling" in err_str or "throttl" in err_str.lower():
                time.sleep((attempt + 1) * 5)
            else:
                break

    raise last_error or RuntimeError("Bedrock Converse document call failed")


# ---------------------------------------------------------------------------
# Audio Transcription via Amazon Transcribe
# ---------------------------------------------------------------------------
MIME_TO_TRANSCRIBE_FORMAT = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "audio/mp3": "mp3",
    "audio/mp4": "mp4",
    "audio/flac": "flac",
    "audio/x-wav": "wav",
    "audio/mpeg": "mp3",
}


def transcribe_audio(
    audio_bytes: bytes,
    mime_type: str = "audio/webm",
    language_code: str = "en-IN",
    timeout_seconds: int = 60,
) -> str:
    """
    Transcribe audio using Amazon Transcribe (batch job via S3).

    Steps:
        1. Upload audio to S3 (temporary key)
        2. Start a Transcribe job
        3. Poll until completed (max timeout_seconds)
        4. Fetch the transcript JSON from the result URI
        5. Clean up S3 object and Transcribe job

    Returns the transcribed text.
    """
    s3_client = boto3.client("s3", region_name=config.AWS_REGION)
    transcribe_client = boto3.client("transcribe", region_name=config.AWS_REGION)

    job_name = f"needspeak-{uuid.uuid4().hex[:12]}"
    media_format = MIME_TO_TRANSCRIBE_FORMAT.get(mime_type.lower().strip(), "webm")
    s3_key = f"transcribe-temp/{job_name}.{media_format}"

    logger.info(
        f"[transcribe] Uploading {len(audio_bytes)} bytes to s3://{config.S3_BUCKET}/{s3_key}"
    )

    # 1. Upload to S3
    s3_client.put_object(Bucket=config.S3_BUCKET, Key=s3_key, Body=audio_bytes)

    try:
        # 2. Start transcription job
        transcribe_client.start_transcription_job(
            TranscriptionJobName=job_name,
            Media={"MediaFileUri": f"s3://{config.S3_BUCKET}/{s3_key}"},
            MediaFormat=media_format,
            LanguageCode=language_code,
        )

        # 3. Poll for completion
        for _ in range(timeout_seconds):
            status = transcribe_client.get_transcription_job(
                TranscriptionJobName=job_name
            )
            job_status = status["TranscriptionJob"]["TranscriptionJobStatus"]

            if job_status == "COMPLETED":
                result_uri = status["TranscriptionJob"]["Transcript"][
                    "TranscriptFileUri"
                ]
                result = requests.get(result_uri, timeout=10).json()
                transcript = result["results"]["transcripts"][0]["transcript"]
                logger.info(f"[transcribe] Result: '{transcript[:100]}...'")
                return transcript

            elif job_status == "FAILED":
                reason = status["TranscriptionJob"].get("FailureReason", "unknown")
                raise RuntimeError(f"Transcription failed: {reason}")

            time.sleep(1)

        raise RuntimeError(f"Transcription timed out after {timeout_seconds}s")

    finally:
        # 4. Cleanup
        try:
            s3_client.delete_object(Bucket=config.S3_BUCKET, Key=s3_key)
        except Exception:
            pass
        try:
            transcribe_client.delete_transcription_job(TranscriptionJobName=job_name)
        except Exception:
            pass
