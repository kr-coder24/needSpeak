"""
CSV-based user storage with bcrypt password hashing.

Stores user data in a CSV file at `backend/data/users.csv`.
Fields: id, email, name, password_hash, provider, avatar_url, created_at

Member 3 owns this file.
"""

from __future__ import annotations

import csv
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import bcrypt

logger = logging.getLogger(__name__)

# CSV file path — stored in backend/data/
DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
USERS_CSV = DATA_DIR / "users.csv"

FIELDS = ["id", "email", "name", "password_hash", "provider", "avatar_url", "created_at"]


def _ensure_csv():
    """Create the CSV file with headers if it doesn't exist."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not USERS_CSV.exists():
        with open(USERS_CSV, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=FIELDS)
            writer.writeheader()
        logger.info(f"Created users CSV at {USERS_CSV}")


def _read_all() -> list[dict]:
    """Read all users from the CSV."""
    _ensure_csv()
    with open(USERS_CSV, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader)


def _write_all(users: list[dict]):
    """Write all users to the CSV (full rewrite)."""
    _ensure_csv()
    with open(USERS_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(users)


def _append_user(user: dict):
    """Append a single user row to the CSV."""
    _ensure_csv()
    with open(USERS_CSV, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writerow(user)


# ---------------------------------------------------------------------------
# Password Hashing
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its bcrypt hash."""
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


# ---------------------------------------------------------------------------
# CRUD Operations
# ---------------------------------------------------------------------------
def find_user_by_email(email: str) -> Optional[dict]:
    """Find a user by email (case-insensitive)."""
    users = _read_all()
    email_lower = email.lower().strip()
    for user in users:
        if user["email"].lower().strip() == email_lower:
            return user
    return None


def find_user_by_id(user_id: str) -> Optional[dict]:
    """Find a user by ID."""
    users = _read_all()
    for user in users:
        if user["id"] == user_id:
            return user
    return None


def create_user(
    email: str,
    name: str,
    password: Optional[str] = None,
    provider: str = "email",
    avatar_url: str = "",
) -> dict:
    """
    Create a new user and append to CSV.
    
    Args:
        email: User's email address.
        name: User's display name.
        password: Plain text password (hashed before storage). None for OAuth users.
        provider: Auth provider ('email', 'google').
        avatar_url: URL to user's avatar image.
    
    Returns:
        The created user dict (without password_hash).
    
    Raises:
        ValueError: If email already exists.
    """
    if find_user_by_email(email):
        raise ValueError("An account with this email already exists.")

    user_id = str(uuid.uuid4())
    password_hash = hash_password(password) if password else ""

    user = {
        "id": user_id,
        "email": email.lower().strip(),
        "name": name.strip(),
        "password_hash": password_hash,
        "provider": provider,
        "avatar_url": avatar_url,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    _append_user(user)
    logger.info(f"Created user: {email} (provider={provider})")

    # Return without password hash
    safe = {k: v for k, v in user.items() if k != "password_hash"}
    return safe


def authenticate_user(email: str, password: str) -> Optional[dict]:
    """
    Authenticate a user with email and password.
    
    Returns:
        User dict (without password_hash) if credentials are valid, None otherwise.
    """
    user = find_user_by_email(email)
    if not user:
        return None

    if user["provider"] != "email":
        return None  # Can't password-login for OAuth accounts

    if not user["password_hash"]:
        return None

    if not verify_password(password, user["password_hash"]):
        return None

    safe = {k: v for k, v in user.items() if k != "password_hash"}
    return safe


def upsert_google_user(email: str, name: str, avatar_url: str = "") -> dict:
    """
    Create or update a Google OAuth user.
    If the user already exists with provider='google', return them.
    If they exist with provider='email', link the Google account.
    """
    existing = find_user_by_email(email)

    if existing:
        # Update avatar if needed
        if avatar_url and existing.get("avatar_url") != avatar_url:
            users = _read_all()
            for u in users:
                if u["id"] == existing["id"]:
                    u["avatar_url"] = avatar_url
                    if u["provider"] == "email":
                        u["provider"] = "email,google"
                    break
            _write_all(users)
            existing["avatar_url"] = avatar_url

        safe = {k: v for k, v in existing.items() if k != "password_hash"}
        return safe

    # New Google user
    return create_user(
        email=email,
        name=name,
        password=None,
        provider="google",
        avatar_url=avatar_url,
    )
