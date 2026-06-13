"""
Auth routes — FastAPI router for authentication endpoints.

Endpoints:
    POST /api/auth/signup          — Email/password registration
    POST /api/auth/login           — Email/password login
    POST /api/auth/google          — Google OAuth token verification
    GET  /api/auth/me              — Get current user from session token
    POST /api/auth/logout          — Clear session
    POST /api/auth/check-email     — Check if email is already registered

Member 3 owns this file.
"""

from __future__ import annotations

import logging
import secrets
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr, Field

from app.auth.dynamo_store import (
    create_user,
    authenticate_user,
    upsert_google_user,
    find_user_by_email,
    find_user_by_id,
    store_auth_session,
    get_auth_session_user_id,
    delete_auth_session,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# In-memory session store (token -> user_id mapping)
# For production, use Redis or JWT. For hackathon, this is fine.
_sessions: dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Request/Response Models
# ---------------------------------------------------------------------------
class SignupRequest(BaseModel):
    email: str = Field(..., min_length=3)
    name: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)


class GoogleAuthRequest(BaseModel):
    email: str
    name: str
    avatar_url: str = ""
    google_id: str = ""


class CheckEmailRequest(BaseModel):
    email: str


class AuthResponse(BaseModel):
    success: bool
    user: Optional[dict] = None
    token: Optional[str] = None
    message: str = ""


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@router.post("/signup", response_model=AuthResponse)
async def signup(req: SignupRequest):
    """Register a new user with email and password."""
    try:
        user = create_user(
            email=req.email,
            name=req.name,
            password=req.password,
            provider="email",
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail={"message": str(e)})

    # Create session token
    token = secrets.token_urlsafe(32)
    _sessions[token] = user
    store_auth_session(token, user["user_id"])

    logger.info(f"Signup: {req.email}")
    return AuthResponse(success=True, user=user, token=token, message="Account created successfully!")


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    """Authenticate with email and password."""
    user = authenticate_user(req.email, req.password)
    if not user:
        raise HTTPException(
            status_code=401,
            detail={"message": "Invalid email or password."},
        )

    token = secrets.token_urlsafe(32)
    _sessions[token] = user
    store_auth_session(token, user["user_id"])

    logger.info(f"Login: {req.email}")
    return AuthResponse(success=True, user=user, token=token, message="Welcome back!")


@router.post("/google", response_model=AuthResponse)
async def google_auth(req: GoogleAuthRequest):
    """
    Handle Google OAuth sign-in.
    The frontend sends the user info from Google's response.
    We create or find the user in our CSV store.
    """
    user = upsert_google_user(
        email=req.email,
        name=req.name,
        avatar_url=req.avatar_url,
    )

    token = secrets.token_urlsafe(32)
    _sessions[token] = user
    store_auth_session(token, user["user_id"])

    logger.info(f"Google auth: {req.email}")
    return AuthResponse(success=True, user=user, token=token, message="Signed in with Google!")


@router.post("/check-email")
async def check_email(req: CheckEmailRequest):
    """Check if an email address is already registered."""
    exists = find_user_by_email(req.email) is not None
    return {"exists": exists}


@router.get("/me", response_model=AuthResponse)
async def get_current_user(request: Request):
    """Get the current logged-in user from the Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail={"message": "Not authenticated."})

    token = auth_header.split("Bearer ")[1].strip()
    
    # Try mock session first, then DynamoDB
    user = _sessions.get(token)
    if not user:
        user_id = get_auth_session_user_id(token)
        if user_id:
            user = find_user_by_id(user_id)
            if user:
                # Cache it locally
                _sessions[token] = user
                
    if not user:
        raise HTTPException(status_code=401, detail={"message": "Session expired. Please log in again."})

    return AuthResponse(success=True, user=user, token=token)


@router.post("/logout")
async def logout(request: Request):
    """Invalidate the current session."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split("Bearer ")[1].strip()
        _sessions.pop(token, None)
        delete_auth_session(token)

    return {"success": True, "message": "Logged out."}
