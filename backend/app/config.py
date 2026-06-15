"""
Central configuration for the Context-to-Cart backend.
All AWS resource identifiers, model IDs, and feature flags live here.
"""

import os
from dotenv import load_dotenv

# Load .env BEFORE reading any env vars
load_dotenv()

# ---------------------------------------------------------------------------
# AWS General
# ---------------------------------------------------------------------------
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

# ---------------------------------------------------------------------------
# Amazon Bedrock
# ---------------------------------------------------------------------------
BEDROCK_MODEL_ID = os.getenv(
    "BEDROCK_MODEL_ID",
    "amazon.nova-pro-v1:0",
)

# ---------------------------------------------------------------------------
# Google Gemini / LLM Provider
# ---------------------------------------------------------------------------
# Active LLM Provider: "gemini" or "bedrock"
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").strip().lower()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL_ID = os.getenv("GEMINI_MODEL_ID", "gemini-2.0-flash")

# ---------------------------------------------------------------------------
# Amazon DynamoDB
# ---------------------------------------------------------------------------
DYNAMODB_TABLE_PRODUCTS = os.getenv("DYNAMODB_TABLE_PRODUCTS", "ProductCatalog")
DYNAMODB_TABLE_SESSIONS = os.getenv("DYNAMODB_TABLE_SESSIONS", "CartSessions")
DYNAMODB_TABLE_USERS = os.getenv("DYNAMODB_TABLE_USERS", "NeedSpeakUsers")
DYNAMODB_TABLE_EMAIL_LOCKS = os.getenv("DYNAMODB_TABLE_EMAIL_LOCKS", "NeedSpeakEmailLocks")
DYNAMODB_TABLE_AUTH_SESSIONS = os.getenv("DYNAMODB_TABLE_AUTH_SESSIONS", "NeedSpeakAuthSessions")
DYNAMODB_TABLE_PREFERENCES = os.getenv("DYNAMODB_TABLE_PREFERENCES", "NeedSpeakUserPreferences")
DYNAMODB_TABLE_EVENTS = os.getenv("DYNAMODB_TABLE_EVENTS", "NeedSpeakUserEvents")
DYNAMODB_TABLE_SHOPPER_PROFILES = os.getenv("DYNAMODB_TABLE_SHOPPER_PROFILES", "NeedSpeakShopperProfiles")

# ---------------------------------------------------------------------------
# Amazon S3
# ---------------------------------------------------------------------------
S3_BUCKET = os.getenv("S3_BUCKET", "pulse-cart-sessions-shivam-2026")

# ---------------------------------------------------------------------------
# Mock flags
# ---------------------------------------------------------------------------
# MOCK_MODE  — bypass the LLM entirely (canned extractions/summaries).
# MOCK_AWS   — bypass all Amazon calls (DynamoDB, S3, Bedrock); auto-on when
#              no AWS credentials are detected. These are independent so you
#              can run a live Gemini key while keeping AWS fully mocked.
MOCK_MODE = os.getenv("MOCK_MODE", "0").strip().lower() in ("1", "true", "yes")

import botocore.session
try:
    _has_aws_creds = botocore.session.get_session().get_credentials() is not None
except Exception:
    _has_aws_creds = False

MOCK_AWS_ENV = os.getenv("MOCK_AWS", "").strip().lower()
if MOCK_AWS_ENV:
    MOCK_AWS = MOCK_AWS_ENV in ("1", "true", "yes")
else:
    MOCK_AWS = MOCK_MODE or not _has_aws_creds


