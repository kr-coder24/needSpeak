"""
Context-to-Cart — FastAPI Application
======================================
Main entry point. Route definitions, CORS, and pipeline orchestration.

Run locally:
    cd backend
    uvicorn main:app --reload --port 8000

Endpoints:
    POST /api/parse           — Main pipeline: text/URL -> cart
    GET  /api/session/{id}    — Reload previous session
    GET  /api/health          — Dependency health check
"""

from __future__ import annotations

import logging
import os
import sys
import uuid
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from dotenv import load_dotenv

# Load .env before importing config
load_dotenv()

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import config
from models import (
    ParseRequest,
    ParseResponse,
    ErrorResponse,
    HealthResponse,
    InputType,
    ErrorCode,
)
from pipeline.extractor import extract_items
from pipeline.resolver import resolve_cart
from pipeline.summarizer import generate_summary
from ingestion.text_input import process_text_input
from ingestion.url_fetcher import (
    fetch_url_content,
    is_supported_url,
    is_youtube_url,
    get_unsupported_url_message,
)
from ingestion.youtube_fetcher import fetch_youtube_transcript
from db.dynamo import (
    load_all_products,
    save_session,
    get_session,
    check_dynamodb_health,
)
from db.s3 import store_raw_input, store_cart_result, check_s3_health

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("context-to-cart")


# ---------------------------------------------------------------------------
# Startup / Shutdown
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load product catalog into memory at startup."""
    logger.info("=" * 50)
    logger.info("Context-to-Cart starting up...")
    logger.info(f"  Mock Mode: {'ON' if config.MOCK_MODE else 'OFF'}")
    logger.info(f"  Region:    {config.AWS_REGION}")
    logger.info(f"  Model:     {config.BEDROCK_MODEL_ID}")
    logger.info("=" * 50)

    products = load_all_products()
    logger.info(f"Loaded {len(products)} products into memory cache")

    yield  # App runs

    logger.info("Context-to-Cart shutting down...")


# ---------------------------------------------------------------------------
# App Setup
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Context-to-Cart",
    description="Paste text or URL, get a shopping cart. Amazon Hackon 2026.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Mock Mode Middleware — check X-Mock-Mode header
# ---------------------------------------------------------------------------
@app.middleware("http")
async def mock_mode_middleware(request: Request, call_next):
    """Allow per-request mock mode override via X-Mock-Mode header."""
    mock_header = request.headers.get("X-Mock-Mode", "").strip()
    if mock_header in ("1", "true", "yes"):
        config.MOCK_MODE = True
    response = await call_next(request)
    return response


# ---------------------------------------------------------------------------
# POST /api/parse — Main Pipeline
# ---------------------------------------------------------------------------
@app.post("/api/parse", response_model=ParseResponse)
async def parse_content(req: ParseRequest):
    """
    Main pipeline endpoint. Accepts text or URL, returns a resolved cart.

    Flow:
    1. Ingest (text passthrough / URL fetch / YouTube transcript)
    2. Extract (Bedrock Stage 1 -> structured JSON)
    3. Resolve (SKU matching + quantity calc + budget optimization)
    4. Summarize (Bedrock Stage 3 -> plain English)
    5. Store session in DynamoDB + S3
    """
    session_id = str(uuid.uuid4())
    logger.info(f"[{session_id}] New parse request: type={req.input_type.value}, content_len={len(req.content)}")

    # ── Step 1: Ingest ──────────────────────────────────────────────
    try:
        if req.input_type == InputType.TEXT:
            raw_text = process_text_input(req.content)

        elif req.input_type == InputType.URL:
            url = req.content.strip()

            # Check if it's a YouTube URL
            if is_youtube_url(url):
                raw_text = fetch_youtube_transcript(url)
            elif is_supported_url(url):
                raw_text = fetch_url_content(url)
            else:
                error_msg = get_unsupported_url_message(url)
                raise HTTPException(
                    status_code=400,
                    detail={"error_code": ErrorCode.UNSUPPORTED_URL.value, "message": error_msg},
                )
        else:
            raise HTTPException(
                status_code=400,
                detail={"error_code": ErrorCode.NO_CONTENT.value, "message": "Invalid input type."},
            )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={"error_code": ErrorCode.NO_CONTENT.value, "message": str(e)},
        )
    except Exception as e:
        logger.error(f"[{session_id}] Ingestion failed: {e}")
        raise HTTPException(
            status_code=500,
            detail={"error_code": ErrorCode.INTERNAL_ERROR.value, "message": "Failed to process input."},
        )

    # Store raw input to S3
    store_raw_input(session_id, raw_text)

    # ── Step 2: Extract ─────────────────────────────────────────────
    logger.info(f"[{session_id}] Extracting items from text ({len(raw_text)} chars)...")
    extraction = extract_items(raw_text, req.servings_override)

    if extraction.error == "no_shoppable_content":
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": ErrorCode.NO_CONTENT.value,
                "message": "No shoppable items found in the input. Try pasting a recipe, shopping list, or instructions.",
            },
        )

    if extraction.error in ("extraction_failed", "bedrock_timeout"):
        error_code = ErrorCode.BEDROCK_TIMEOUT if extraction.error == "bedrock_timeout" else ErrorCode.EXTRACTION_FAILED
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": error_code.value,
                "message": "AI extraction failed. Please try again.",
            },
        )

    if not extraction.items:
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": ErrorCode.NO_CONTENT.value,
                "message": "Could not extract any items from the input.",
            },
        )

    logger.info(f"[{session_id}] Extracted {len(extraction.items)} items (intent: {extraction.intent_type.value})")

    # ── Step 3: Resolve ─────────────────────────────────────────────
    logger.info(f"[{session_id}] Resolving SKUs...")
    cart_items, unavailable_items, total_price, budget_exceeded = resolve_cart(
        items=extraction.items,
        budget_inr=req.budget_inr,
        session_id=session_id,
    )

    logger.info(f"[{session_id}] Resolved: {len(cart_items)} in cart, {len(unavailable_items)} unavailable")

    # ── Step 4: Summarize ───────────────────────────────────────────
    logger.info(f"[{session_id}] Generating summary...")
    summary = generate_summary(
        cart_items=cart_items,
        unavailable_items=unavailable_items,
        context_summary=extraction.context_summary,
        total_price=total_price,
        budget_inr=req.budget_inr,
        budget_exceeded=budget_exceeded,
    )

    # ── Step 5: Store session ───────────────────────────────────────
    response = ParseResponse(
        session_id=session_id,
        intent_type=extraction.intent_type,
        context_summary=extraction.context_summary,
        cart=[item for item in cart_items],
        unavailable_items=[item for item in unavailable_items],
        total_price_inr=total_price,
        budget_exceeded=budget_exceeded,
        summary=summary,
    )

    # Store to DynamoDB
    session_data = {
        "session_id": session_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "input_type": req.input_type.value,
        "intent_type": extraction.intent_type.value,
        "context_summary": extraction.context_summary,
        "extracted_items": [item.model_dump() for item in extraction.items],
        "cart_items": [item.model_dump() for item in cart_items],
        "unavailable_items": [item.model_dump() for item in unavailable_items],
        "total_price_inr": total_price,
        "budget_inr": req.budget_inr,
        "budget_exceeded": budget_exceeded,
        "summary": summary,
        "status": "completed",
    }
    save_session(session_data)
    store_cart_result(session_id, session_data)

    logger.info(f"[{session_id}] Done! Total: Rs.{total_price:.0f}")
    return response


# ---------------------------------------------------------------------------
# GET /api/session/{session_id} — Reload Session
# ---------------------------------------------------------------------------
@app.get("/api/session/{session_id}")
async def get_session_endpoint(session_id: str):
    """Retrieve a previously processed session."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


# ---------------------------------------------------------------------------
# GET /api/health — Health Check
# ---------------------------------------------------------------------------
@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Check connectivity to all AWS dependencies."""
    dynamo_ok = check_dynamodb_health()
    s3_ok = check_s3_health()

    # Bedrock health: try a minimal call (skip in mock mode)
    bedrock_ok = True
    if not config.MOCK_MODE:
        try:
            import boto3
            import json
            client = boto3.client("bedrock-runtime", region_name=config.AWS_REGION)
            test_body = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 10,
                "messages": [{"role": "user", "content": [{"type": "text", "text": "hi"}]}],
            }
            client.invoke_model(
                modelId=config.BEDROCK_MODEL_ID,
                body=json.dumps(test_body),
                contentType="application/json",
            )
        except Exception as e:
            logger.warning(f"Bedrock health check failed: {e}")
            bedrock_ok = False

    status = "ok" if (dynamo_ok and bedrock_ok) else "degraded"
    return HealthResponse(
        status=status,
        bedrock="ok" if bedrock_ok else "error",
        dynamodb="ok" if dynamo_ok else "error",
    )


# ---------------------------------------------------------------------------
# Custom Exception Handler
# ---------------------------------------------------------------------------
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    """Return structured error responses matching ErrorResponse schema."""
    detail = exc.detail
    if isinstance(detail, dict):
        return JSONResponse(
            status_code=exc.status_code,
            content=detail,
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={"error_code": "internal_error", "message": str(detail)},
    )
