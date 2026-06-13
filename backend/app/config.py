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
    "anthropic.claude-sonnet-4-6",
)

# ---------------------------------------------------------------------------
# Amazon DynamoDB
# ---------------------------------------------------------------------------
DYNAMODB_TABLE_PRODUCTS = os.getenv("DYNAMODB_TABLE_PRODUCTS", "ProductCatalog")
DYNAMODB_TABLE_SESSIONS = os.getenv("DYNAMODB_TABLE_SESSIONS", "CartSessions")

# ---------------------------------------------------------------------------
# Amazon S3
# ---------------------------------------------------------------------------
S3_BUCKET = os.getenv("S3_BUCKET", "pulse-cart-sessions-shivam-2026")

# ---------------------------------------------------------------------------
# Mock Mode
# ---------------------------------------------------------------------------
# Set MOCK_MODE=1 to bypass all AWS calls (Bedrock, DynamoDB, S3).
# Returns perfectly-formatted dummy responses for demo resilience.
# Activate via:
#   - Environment variable:  MOCK_MODE=1
#   - .env file:             MOCK_MODE=1
#   - Frontend hidden toggle (sends X-Mock-Mode: 1 header)
MOCK_MODE = os.getenv("MOCK_MODE", "0").strip().lower() in ("1", "true", "yes")

# ---------------------------------------------------------------------------
# Google Gemini API
# ---------------------------------------------------------------------------
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL_ID = os.getenv("GEMINI_MODEL_ID", "gemini-2.5-flash")

# Active LLM Provider: "gemini" or "bedrock"
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").strip().lower()


