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

from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Form
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
    IntentGroup,
)
from app.pipeline.extractor import extract_items
from app.pipeline.resolver import resolve_cart
from app.pipeline.summarizer import generate_summary
from app.ingestion.text_input import process_text_input
from app.ingestion.url_fetcher import (
    fetch_url_content,
    is_youtube_url,
)
from app.ingestion.youtube_fetcher import fetch_youtube_transcript
from app.db.dynamo import (
    load_all_products,
    save_session,
    get_session,
    check_dynamodb_health,
)
from app.db.s3 import store_raw_input, store_cart_result, check_s3_health
from app.auth.auth_routes import router as auth_router

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
    logger.info(f"  Mock AWS:  {'ON' if config.MOCK_AWS else 'OFF'}")
    logger.info(f"  Region:    {config.AWS_REGION}")
    logger.info(f"  Provider:  {config.LLM_PROVIDER}")
    logger.info(f"  Model:     {config.GEMINI_MODEL_ID if config.LLM_PROVIDER == 'gemini' else config.BEDROCK_MODEL_ID}")
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

# Auth routes
app.include_router(auth_router)


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

            elif req.input_type == InputType.WHATSAPP:
                from app.ingestion.whatsapp_input import parse_whatsapp_forward
                raw_text = parse_whatsapp_forward(process_text_input(req.content))

            elif req.input_type == InputType.URL:
                url = req.content.strip()

                # Check if it's a YouTube URL first, then try any recipe URL
                if is_youtube_url(url):
                    raw_text = fetch_youtube_transcript(url)
                else:
                    # fetch_url_content handles all HTTP(S) URLs via JSON-LD + body fallback
                    # and raises ValueError for known JS-only sites (Instagram, Zomato, Swiggy)
                    raw_text = fetch_url_content(url)
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

        if not extraction.intents and extraction.confidence != "low":
            raise HTTPException(
                status_code=400,
                detail={
                    "error_code": ErrorCode.NO_CONTENT.value,
                    "message": "Could not extract any items from the input.",
                },
            )

        logger.info(f"[{session_id}] Extracted {len(extraction.intents)} intents")

        # ── Step 3: Resolve ─────────────────────────────────────────────
        logger.info(f"[{session_id}] Resolving SKUs per intent...")
        
        resolved_intent_groups = []
        global_total_price = 0.0
        global_budget_exceeded = False
        
        # Apply preferences (Pillar 9)
        from app.intelligence.preference_engine import apply_preferences, UserPreferences
        dietary_list = []
        if req.dietary_pref and req.dietary_pref.lower() not in ("any", "none"):
            val = req.dietary_pref.lower()
            dietary_list.append("vegetarian" if val == "veg" else val)
        
        prefs = UserPreferences(
            dietary=dietary_list,
            preferred_brands=req.preferred_brands or [],
            budget_mode=req.budget_style or "balanced"
        )
        extraction = apply_preferences(extraction, prefs)

        for intent in extraction.intents:
            cart_items, unavailable_items, intent_total_price, intent_budget_exceeded = resolve_cart(
                items=intent.items,
                budget_inr=req.budget_inr,
                session_id=session_id,
                mock_mode=mock_mode,
                dietary_pref=req.dietary_pref,
                preferred_brands=req.preferred_brands,
                budget_style=req.budget_style,
            )
            global_total_price += intent_total_price
            global_budget_exceeded = global_budget_exceeded or intent_budget_exceeded
            
            resolved_intent_groups.append(IntentGroup(
                intent_type=intent.intent_type,
                context_summary=intent.context_summary,
                cart=cart_items,
                unavailable_items=unavailable_items
            ))

        logger.info(f"[{session_id}] Resolved {len(resolved_intent_groups)} intents")

        # ── Step 4: Summarize ───────────────────────────────────────────
        logger.info(f"[{session_id}] Generating summary...")
        if extraction.confidence == "low" and extraction.clarification_question:
            summary = extraction.clarification_question
        else:
            summary = generate_summary(
                intent_groups=resolved_intent_groups,
                total_price=global_total_price,
                budget_inr=req.budget_inr,
                budget_exceeded=global_budget_exceeded,
                mock_mode=mock_mode,
            )

        # ── Step 5: Store session ───────────────────────────────────────
        response_data = ParseResponse(
            session_id=session_id,
            confidence=extraction.confidence,
            clarification_question=extraction.clarification_question,
            intents=resolved_intent_groups,
            total_price_inr=global_total_price,
            budget_exceeded=global_budget_exceeded,
            summary=summary,
        )

        # Store to DynamoDB
        session_data = {
            "session_id": session_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "input_type": req.input_type.value,
            "confidence": extraction.confidence,
            "clarification_question": extraction.clarification_question,
            "extracted_intents": [i.model_dump() for i in extraction.intents],
            "resolved_intents": [g.model_dump() for g in resolved_intent_groups],
            "total_price_inr": global_total_price,
            "budget_inr": req.budget_inr,
            "budget_exceeded": global_budget_exceeded,
            "summary": summary,
            "status": "completed",
        }
        save_session(session_data, mock_mode=mock_mode)
        store_cart_result(session_id, session_data, mock_mode=mock_mode)

        logger.info(f"[{session_id}] Done! Total: Rs.{global_total_price:.0f}")
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
# POST /api/transcribe — Voice-to-Text via Gemini
# ---------------------------------------------------------------------------
@app.post("/api/transcribe")
async def transcribe_audio(request: Request, audio: UploadFile = File(...)):
    """
    Accept an audio file (webm/opus) and return transcribed text using Gemini.
    Used by the frontend voice input feature.
    """
    mock_mode = getattr(request.state, "mock_mode", False) or config.MOCK_MODE

    # Read audio bytes
    audio_bytes = await audio.read()
    if len(audio_bytes) < 1000:
        raise HTTPException(status_code=400, detail={"message": "Audio too short to transcribe."})

    logger.info(f"[transcribe] Received {len(audio_bytes)} bytes, mime={audio.content_type}")

    if mock_mode:
        # In mock mode, return a sample transcription
        return {"text": "I need groceries for a birthday party for 20 people, budget 3000 rupees"}

    try:
        from app.pipeline.gemini_client import get_gemini_client
        import base64

        client = get_gemini_client()

        # Determine MIME type
        mime_type = audio.content_type or "audio/webm"

        # Send audio to Gemini for transcription
        response = client.models.generate_content(
            model=config.GEMINI_MODEL_ID,
            contents=[
                {
                    "role": "user",
                    "parts": [
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": base64.b64encode(audio_bytes).decode("utf-8"),
                            }
                        },
                        {
                            "text": (
                                "Transcribe this audio exactly as spoken. "
                                "Return ONLY the transcribed text, nothing else. "
                                "If the audio contains Hindi or Hinglish, transcribe it in English/Roman script. "
                                "If the audio is unclear or silent, respond with an empty string."
                            )
                        },
                    ],
                }
            ],
        )

        transcribed_text = response.text.strip() if response.text else ""
        logger.info(f"[transcribe] Result: '{transcribed_text[:100]}...'")

        return {"text": transcribed_text}

    except Exception as e:
        error_str = str(e)
        logger.error(f"[transcribe] Failed: {error_str}")

        # Handle rate limiting gracefully
        if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
            raise HTTPException(
                status_code=429,
                detail={"message": "API rate limit reached. Please wait a minute and try again."},
            )

        raise HTTPException(
            status_code=500,
            detail={"message": f"Transcription failed: {error_str}"},
        )


# ---------------------------------------------------------------------------
# POST /api/parse-image — Image OCR Pipeline (Member 2, Feature 1)
# ---------------------------------------------------------------------------
@app.post("/api/parse-image")
async def parse_image(
    request: Request,
    image: UploadFile = File(...),
    budget_inr: float = Form(None),
    dietary_pref: Optional[str] = Form(None),
    preferred_brands: Optional[str] = Form(None),
    budget_style: Optional[str] = Form(None),
):
    """
    Accept an image, extract text via Gemini Vision, run through pipeline.
    Returns both the extracted text and the full pipeline result.
    """
    session_id = str(uuid.uuid4())
    mock_mode = getattr(request.state, "mock_mode", False) or config.MOCK_MODE

    # Read image bytes
    image_bytes = await image.read()
    mime_type = image.content_type or "image/jpeg"

    logger.info(
        f"[{session_id}] Image upload: {len(image_bytes)} bytes, mime={mime_type}"
    )

    if mock_mode:
        # In mock mode, return a sample extraction
        return {
            "extracted_text": "milk 2L, basmati rice 1kg, onions 500g, tomatoes 6 pieces",
            "session_id": session_id,
            "hint": "Submit this text to /api/parse with input_type=text",
        }

    try:
        from app.ingestion.image_input import extract_text_from_image

        extracted_text = extract_text_from_image(image_bytes, mime_type)

        if not extracted_text:
            raise HTTPException(
                status_code=400,
                detail={
                    "error_code": ErrorCode.NO_CONTENT.value,
                    "message": "No food items or shopping items found in the image. "
                               "Please upload an image of a recipe, shopping list, or food items.",
                },
            )

        logger.info(f"[{session_id}] Extracted from image: '{extracted_text[:200]}'")

        # Run through the full pipeline by creating a parse request
        def run_image_pipeline():
            # Re-use the exact same pipeline as /api/parse with TEXT input
            from app.pipeline.extractor import extract_items
            from app.pipeline.resolver import resolve_cart
            from app.pipeline.summarizer import generate_summary

            extraction = extract_items(extracted_text, None, mock_mode=mock_mode)

            if extraction.error == "no_shoppable_content":
                raise HTTPException(
                    status_code=400,
                    detail={
                        "error_code": ErrorCode.NO_CONTENT.value,
                        "message": "No shoppable items found in the extracted text from the image.",
                    },
                )

            if extraction.error in ("extraction_failed", "bedrock_timeout"):
                error_code = (
                    ErrorCode.BEDROCK_TIMEOUT
                    if extraction.error == "bedrock_timeout"
                    else ErrorCode.EXTRACTION_FAILED
                )
                raise HTTPException(
                    status_code=500,
                    detail={
                        "error_code": error_code.value,
                        "message": "AI extraction failed. Please try again.",
                    },
                )

            resolved_intent_groups = []
            global_total_price = 0.0
            global_budget_exceeded = False

            budget_int = int(budget_inr) if budget_inr else None

            # Apply preferences (Pillar 9)
            from app.intelligence.preference_engine import apply_preferences, UserPreferences
            import json
            brands_list = []
            if preferred_brands:
                try:
                    brands_list = json.loads(preferred_brands)
                    if not isinstance(brands_list, list):
                        brands_list = [brands_list]
                except Exception:
                    brands_list = [preferred_brands]

            dietary_list = []
            if dietary_pref and dietary_pref.lower() not in ("any", "none"):
                val = dietary_pref.lower()
                dietary_list.append("vegetarian" if val == "veg" else val)

            prefs = UserPreferences(
                dietary=dietary_list,
                preferred_brands=brands_list,
                budget_mode=budget_style or "balanced"
            )
            extraction = apply_preferences(extraction, prefs)

            for intent in extraction.intents:
                cart_items, unavailable_items, intent_total_price, intent_budget_exceeded = resolve_cart(
                    items=intent.items,
                    budget_inr=budget_int,
                    session_id=session_id,
                    mock_mode=mock_mode,
                    dietary_pref=dietary_pref,
                    preferred_brands=brands_list,
                    budget_style=budget_style,
                )
                global_total_price += intent_total_price
                global_budget_exceeded = global_budget_exceeded or intent_budget_exceeded

                resolved_intent_groups.append(IntentGroup(
                    intent_type=intent.intent_type,
                    context_summary=intent.context_summary,
                    cart=cart_items,
                    unavailable_items=unavailable_items,
                ))

            summary = generate_summary(
                intent_groups=resolved_intent_groups,
                total_price=global_total_price,
                budget_inr=budget_int,
                budget_exceeded=global_budget_exceeded,
                mock_mode=mock_mode,
            )

            response_data = ParseResponse(
                session_id=session_id,
                confidence=extraction.confidence,
                clarification_question=extraction.clarification_question,
                intents=resolved_intent_groups,
                total_price_inr=global_total_price,
                budget_exceeded=global_budget_exceeded,
                summary=summary,
            )

            # Store session
            session_data = {
                "session_id": session_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "input_type": "image",
                "confidence": extraction.confidence,
                "extracted_text_from_image": extracted_text,
                "resolved_intents": [g.model_dump() for g in resolved_intent_groups],
                "total_price_inr": global_total_price,
                "budget_inr": budget_int,
                "budget_exceeded": global_budget_exceeded,
                "summary": summary,
                "status": "completed",
            }
            save_session(session_data, mock_mode=mock_mode)
            store_cart_result(session_id, session_data, mock_mode=mock_mode)

            return {
                "extracted_text": extracted_text,
                **response_data.model_dump(),
            }

        return await asyncio.wait_for(
            run_in_threadpool(run_image_pipeline), timeout=45.0
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={"error_code": ErrorCode.NO_CONTENT.value, "message": str(e)},
        )
    except asyncio.TimeoutError:
        logger.error(f"[{session_id}] Image pipeline timed out after 45 seconds.")
        raise HTTPException(
            status_code=504,
            detail={
                "error_code": ErrorCode.BEDROCK_TIMEOUT.value,
                "message": "Image processing timed out. Please try again.",
            },
        )
    except Exception as e:
        error_str = str(e)
        logger.error(f"[{session_id}] Image pipeline failed: {error_str}")

        if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
            raise HTTPException(
                status_code=429,
                detail={"message": "API rate limit reached. Please wait a minute and try again."},
            )

        raise HTTPException(
            status_code=500,
            detail={
                "error_code": ErrorCode.INTERNAL_ERROR.value,
                "message": f"Image processing failed: {error_str}",
            },
        )



# ---------------------------------------------------------------------------
# POST /api/parse-pdf — PDF Text Extraction Pipeline (Feature B.13)
# ---------------------------------------------------------------------------
@app.post("/api/parse-pdf")
async def parse_pdf(
    request: Request,
    pdf: UploadFile = File(...),
    budget_inr: float = None,
):
    """
    Accept a PDF file, extract text via pypdf, and run through the pipeline.
    Returns both the extracted text and the full pipeline result.
    """
    session_id = str(uuid.uuid4())
    mock_mode = getattr(request.state, "mock_mode", False) or config.MOCK_MODE

    pdf_bytes = await pdf.read()
    
    if len(pdf_bytes) < 100:
        raise HTTPException(status_code=400, detail={"message": "PDF too small or empty."})

    logger.info(f"[{session_id}] PDF upload: {len(pdf_bytes)} bytes")

    if mock_mode:
        return {
            "extracted_text": "Sample mock text from PDF: milk 2L, bread 1 pack",
            "session_id": session_id,
            "hint": "Submit this text to /api/parse with input_type=text",
        }

    try:
        from app.ingestion.pdf_input import extract_text_from_pdf
        import uuid
        from datetime import datetime, timezone
        from app.models import ParseResponse, IntentGroup, ErrorCode
        import asyncio
        from starlette.concurrency import run_in_threadpool
        from app.db.dynamo import save_session, store_cart_result
        
        extracted_text = extract_text_from_pdf(pdf_bytes)

        if not extracted_text or not extracted_text.strip():
            raise HTTPException(
                status_code=400,
                detail={
                    "error_code": ErrorCode.NO_CONTENT.value,
                    "message": "No readable text found in the PDF. Ensure it is a text-based PDF.",
                },
            )

        logger.info(f"[{session_id}] Extracted from PDF: '{extracted_text[:200]}'")

        def run_pdf_pipeline():
            from app.pipeline.extractor import extract_items
            from app.pipeline.resolver import resolve_cart
            from app.pipeline.summarizer import generate_summary

            extraction = extract_items(extracted_text, None, mock_mode=mock_mode)

            if extraction.error == "no_shoppable_content":
                raise HTTPException(
                    status_code=400,
                    detail={
                        "error_code": ErrorCode.NO_CONTENT.value,
                        "message": "No shoppable items found in the extracted text from the PDF.",
                    },
                )

            if extraction.error in ("extraction_failed", "bedrock_timeout"):
                error_code = (
                    ErrorCode.BEDROCK_TIMEOUT
                    if extraction.error == "bedrock_timeout"
                    else ErrorCode.EXTRACTION_FAILED
                )
                raise HTTPException(
                    status_code=500,
                    detail={
                        "error_code": error_code.value,
                        "message": "AI extraction failed. Please try again.",
                    },
                )

            resolved_intent_groups = []
            global_total_price = 0.0
            global_budget_exceeded = False

            budget_int = int(budget_inr) if budget_inr else None

            # Apply preferences (Pillar 9)
            from app.intelligence.preference_engine import apply_preferences, UserPreferences
            import json
            brands_list = []
            if preferred_brands:
                try:
                    brands_list = json.loads(preferred_brands)
                    if not isinstance(brands_list, list):
                        brands_list = [brands_list]
                except Exception:
                    brands_list = [preferred_brands]

            dietary_list = []
            if dietary_pref and dietary_pref.lower() not in ("any", "none"):
                val = dietary_pref.lower()
                dietary_list.append("vegetarian" if val == "veg" else val)

            prefs = UserPreferences(
                dietary=dietary_list,
                preferred_brands=brands_list,
                budget_mode=budget_style or "balanced"
            )
            extraction = apply_preferences(extraction, prefs)

            for intent in extraction.intents:
                cart_items, unavailable_items, intent_total_price, intent_budget_exceeded = resolve_cart(
                    items=intent.items,
                    budget_inr=budget_int,
                    session_id=session_id,
                    mock_mode=mock_mode,
                    dietary_pref=dietary_pref,
                    preferred_brands=brands_list,
                    budget_style=budget_style,
                )
                global_total_price += intent_total_price
                global_budget_exceeded = global_budget_exceeded or intent_budget_exceeded

                resolved_intent_groups.append(IntentGroup(
                    intent_type=intent.intent_type,
                    context_summary=intent.context_summary,
                    cart=cart_items,
                    unavailable_items=unavailable_items,
                ))

            summary = generate_summary(
                intent_groups=resolved_intent_groups,
                total_price=global_total_price,
                budget_inr=budget_int,
                budget_exceeded=global_budget_exceeded,
                mock_mode=mock_mode,
            )

            response_data = ParseResponse(
                session_id=session_id,
                confidence=extraction.confidence,
                clarification_question=extraction.clarification_question,
                intents=resolved_intent_groups,
                total_price_inr=global_total_price,
                budget_exceeded=global_budget_exceeded,
                summary=summary,
            )

            session_data = {
                "session_id": session_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "input_type": "text",
                "confidence": extraction.confidence,
                "extracted_text_from_pdf": extracted_text,
                "resolved_intents": [g.model_dump() for g in resolved_intent_groups],
                "total_price_inr": global_total_price,
                "budget_inr": budget_int,
                "budget_exceeded": global_budget_exceeded,
                "summary": summary,
                "status": "completed",
            }
            save_session(session_data, mock_mode=mock_mode)
            store_cart_result(session_id, session_data, mock_mode=mock_mode)

            return {
                "extracted_text": extracted_text,
                **response_data.model_dump(),
            }

        return await asyncio.wait_for(
            run_in_threadpool(run_pdf_pipeline), timeout=45.0
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={"error_code": ErrorCode.NO_CONTENT.value, "message": str(e)},
        )
    except asyncio.TimeoutError:
        logger.error(f"[{session_id}] PDF pipeline timed out after 45 seconds.")
        raise HTTPException(
            status_code=504,
            detail={
                "error_code": ErrorCode.BEDROCK_TIMEOUT.value,
                "message": "PDF processing timed out. Please try again.",
            },
        )
    except Exception as e:
        error_str = str(e)
        logger.error(f"[{session_id}] PDF pipeline failed: {error_str}")

        if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
            raise HTTPException(
                status_code=429,
                detail={"message": "API rate limit reached. Please wait a minute and try again."},
            )

        raise HTTPException(
            status_code=500,
            detail={
                "error_code": ErrorCode.INTERNAL_ERROR.value,
                "message": f"PDF processing failed: {error_str}",
            },
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

    # LLM health: probe whichever provider is active. Skip in mock mode,
    # and never probe Bedrock when AWS is mocked (no Amazon contact).
    llm_ok = True
    if not mock_mode and not (config.LLM_PROVIDER == "bedrock" and config.MOCK_AWS):
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
