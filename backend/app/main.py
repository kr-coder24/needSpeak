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
import asyncio
from starlette.concurrency import run_in_threadpool

from dotenv import load_dotenv

# Load .env before importing config
load_dotenv()

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import config
from app.models import (
    ParseRequest,
    ParseResponse,
    ErrorResponse,
    HealthResponse,
    InputType,
    ErrorCode,
)
from app.pipeline.extractor import extract_items
from app.pipeline.resolver import resolve_cart
from app.pipeline.summarizer import generate_summary
from app.ingestion.text_input import process_text_input
from app.ingestion.url_fetcher import (
    fetch_url_content,
    is_supported_url,
    is_youtube_url,
    get_unsupported_url_message,
)
from app.ingestion.youtube_fetcher import fetch_youtube_transcript
from app.db.dynamo import (
    load_all_products,
    save_session,
    get_session,
    check_dynamodb_health,
)
from app.db.s3 import store_raw_input, store_cart_result, check_s3_health

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
    logger.info(f"  Provider:  {config.LLM_PROVIDER}")
    if config.LLM_PROVIDER == "gemini":
        logger.info(f"  Model:     {config.GEMINI_MODEL_ID}")
    else:
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
        "http://localhost:8080",
        "http://127.0.0.1:8080",
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
    request.state.mock_mode = mock_header in ("1", "true", "yes")
    response = await call_next(request)
    return response


# ---------------------------------------------------------------------------
# POST /api/parse — Main Pipeline
# ---------------------------------------------------------------------------
@app.post("/api/parse", response_model=ParseResponse)
async def parse_content(req: ParseRequest, request: Request):
    """
    Main pipeline endpoint. Accepts text or URL, returns a resolved cart.
    Runs the pipeline inside a thread pool with a timeout of 30 seconds.
    """
    session_id = str(uuid.uuid4())
    logger.info(f"[{session_id}] New parse request: type={req.input_type.value}, content_len={len(req.content)}")

    mock_mode = getattr(request.state, "mock_mode", False) or config.MOCK_MODE

    def run_pipeline():
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
        store_raw_input(session_id, raw_text, mock_mode=mock_mode)

        # ── Step 2: Extract ─────────────────────────────────────────────
        logger.info(f"[{session_id}] Extracting items from text ({len(raw_text)} chars)...")
        extraction = extract_items(raw_text, req.servings_override, mock_mode=mock_mode)

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
            mock_mode=mock_mode,
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
            mock_mode=mock_mode,
        )

        # ── Step 5: Store session ───────────────────────────────────────
        response_data = ParseResponse(
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
        save_session(session_data, mock_mode=mock_mode)
        store_cart_result(session_id, session_data, mock_mode=mock_mode)

        logger.info(f"[{session_id}] Done! Total: Rs.{total_price:.0f}")
        return response_data

    try:
        return await asyncio.wait_for(run_in_threadpool(run_pipeline), timeout=30.0)
    except asyncio.TimeoutError:
        logger.error(f"[{session_id}] Pipeline timed out after 30 seconds.")
        raise HTTPException(
            status_code=504,
            detail={
                "error_code": ErrorCode.BEDROCK_TIMEOUT.value,
                "message": "The request timed out. Please try again.",
            }
        )


# ---------------------------------------------------------------------------
# GET /api/session/{session_id} — Reload Session
# ---------------------------------------------------------------------------
@app.get("/api/session/{session_id}")
async def get_session_endpoint(session_id: str, request: Request):
    """Retrieve a previously processed session."""
    mock_mode = getattr(request.state, "mock_mode", False) or config.MOCK_MODE
    session = get_session(session_id, mock_mode=mock_mode)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


# ---------------------------------------------------------------------------
# GET /api/health — Health Check
# ---------------------------------------------------------------------------
@app.get("/api/health", response_model=HealthResponse)
async def health_check(request: Request):
    """Check connectivity to all AWS dependencies."""
    mock_mode = getattr(request.state, "mock_mode", False) or config.MOCK_MODE
    dynamo_ok = check_dynamodb_health(mock_mode=mock_mode)
    s3_ok = check_s3_health(mock_mode=mock_mode)

    # LLM health: try a minimal call (skip in mock mode)
    llm_ok = True
    if not mock_mode:
        try:
            if config.LLM_PROVIDER == "gemini":
                from app.pipeline.gemini_client import get_gemini_client
                client = get_gemini_client()
                client.models.generate_content(
                    model=config.GEMINI_MODEL_ID,
                    contents="hi"
                )
            else:
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
            logger.warning(f"LLM ({config.LLM_PROVIDER}) health check failed: {e}")
            llm_ok = False

    status = "ok" if (dynamo_ok and llm_ok and s3_ok) else "degraded"
    return HealthResponse(
        status=status,
        bedrock="ok" if llm_ok else "error",  # Keeping key as bedrock for backwards compatibility
        dynamodb="ok" if dynamo_ok else "error",
        s3="ok" if s3_ok else "error",
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
