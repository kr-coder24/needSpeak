"""
S3 client for storing raw input text and final cart JSON per session.
Used for debugging and audit trail.
"""

from __future__ import annotations

import json
import logging
from typing import Optional

import boto3

from config import AWS_REGION, S3_BUCKET, MOCK_MODE

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# S3 Client (singleton)
# ---------------------------------------------------------------------------
_s3_client = None


def _get_s3():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client("s3", region_name=AWS_REGION)
    return _s3_client


# ---------------------------------------------------------------------------
# Store / Retrieve
# ---------------------------------------------------------------------------
def store_raw_input(session_id: str, content: str) -> Optional[str]:
    """
    Store the raw input text to S3.
    Returns the S3 key, or None if in mock mode.
    """
    if MOCK_MODE:
        logger.info(f"[MOCK] Would store raw input for session: {session_id}")
        return f"sessions/{session_id}/raw_input.txt"

    key = f"sessions/{session_id}/raw_input.txt"
    try:
        _get_s3().put_object(
            Bucket=S3_BUCKET,
            Key=key,
            Body=content.encode("utf-8"),
            ContentType="text/plain; charset=utf-8",
        )
        logger.info(f"Stored raw input: s3://{S3_BUCKET}/{key}")
        return key
    except Exception as e:
        logger.error(f"Failed to store raw input to S3: {e}")
        return None


def store_cart_result(session_id: str, cart_json: dict) -> Optional[str]:
    """
    Store the final cart JSON to S3.
    Returns the S3 key, or None if in mock mode.
    """
    if MOCK_MODE:
        logger.info(f"[MOCK] Would store cart result for session: {session_id}")
        return f"sessions/{session_id}/cart_result.json"

    key = f"sessions/{session_id}/cart_result.json"
    try:
        _get_s3().put_object(
            Bucket=S3_BUCKET,
            Key=key,
            Body=json.dumps(cart_json, indent=2, default=str).encode("utf-8"),
            ContentType="application/json",
        )
        logger.info(f"Stored cart result: s3://{S3_BUCKET}/{key}")
        return key
    except Exception as e:
        logger.error(f"Failed to store cart result to S3: {e}")
        return None


def get_raw_input(session_id: str) -> Optional[str]:
    """Retrieve the raw input text from S3."""
    if MOCK_MODE:
        return "Mock raw input content"

    key = f"sessions/{session_id}/raw_input.txt"
    try:
        response = _get_s3().get_object(Bucket=S3_BUCKET, Key=key)
        return response["Body"].read().decode("utf-8")
    except Exception as e:
        logger.error(f"Failed to get raw input from S3: {e}")
        return None


def store_failed_match_log(item_name: str, session_id: str) -> None:
    """
    Log a failed SKU match to S3 for post-run analysis.
    This helps identify missing keywords that should be added to the catalog.
    """
    if MOCK_MODE:
        logger.info(f"[MOCK] Failed match: {item_name}")
        return

    key = f"failed_matches/{session_id}/{item_name}.txt"
    try:
        _get_s3().put_object(
            Bucket=S3_BUCKET,
            Key=key,
            Body=f"Failed to match: {item_name}\nSession: {session_id}".encode("utf-8"),
            ContentType="text/plain",
        )
    except Exception:
        # Non-critical — log and continue
        logger.warning(f"Could not log failed match for: {item_name}")


# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------
def check_s3_health() -> bool:
    """Verify S3 connectivity by checking the bucket exists."""
    if MOCK_MODE:
        return True
    try:
        _get_s3().head_bucket(Bucket=S3_BUCKET)
        return True
    except Exception as e:
        logger.error(f"S3 health check failed: {e}")
        return False
