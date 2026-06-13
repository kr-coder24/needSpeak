"""
DynamoDB-based user storage with bcrypt password hashing.

Fields: user_id, email, name, password_hash, provider, avatar_url, created_at
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

import boto3
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key
import bcrypt

from app.config import (
    AWS_REGION,
    DYNAMODB_TABLE_USERS,
    DYNAMODB_TABLE_EMAIL_LOCKS,
    DYNAMODB_TABLE_AUTH_SESSIONS,
    MOCK_AWS,
)
from app.auth.csv_store import (
    find_user_by_email as csv_find_user_by_email,
    find_user_by_id as csv_find_user_by_id,
    create_user as csv_create_user,
    authenticate_user as csv_authenticate_user,
    upsert_google_user as csv_upsert_google_user,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# DynamoDB Resource (singleton)
# ---------------------------------------------------------------------------
_dynamodb = None

def _get_dynamodb():
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    return _dynamodb

def _get_users_table():
    return _get_dynamodb().Table(DYNAMODB_TABLE_USERS)

def _get_email_locks_table():
    return _get_dynamodb().Table(DYNAMODB_TABLE_EMAIL_LOCKS)

def _get_auth_sessions_table():
    return _get_dynamodb().Table(DYNAMODB_TABLE_AUTH_SESSIONS)

# ---------------------------------------------------------------------------
# Password Hashing
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its bcrypt hash."""
    if not password_hash:
        return False
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))

# ---------------------------------------------------------------------------
# DynamoDB CRUD Operations
# ---------------------------------------------------------------------------

def find_user_by_email(email: str) -> Optional[dict]:
    if MOCK_AWS:
        return csv_find_user_by_email(email)

    # Use EmailLocks table to quickly get user_id, or query GSI on Users table
    table = _get_email_locks_table()
    try:
        response = table.get_item(Key={"email_norm": email.lower().strip()})
        if "Item" in response:
            user_id = response["Item"]["user_id"]
            return find_user_by_id(user_id)
    except Exception as e:
        logger.error(f"Error reading email lock: {e}")
        # Fallback to scanning/GSI if email lock isn't reliable
        users_table = _get_users_table()
        try:
            # Assuming an EmailIndex GSI
            resp = users_table.query(
                IndexName="EmailIndex",
                KeyConditionExpression=Key("email").eq(email.lower().strip())
            )
            if resp.get("Items"):
                return resp["Items"][0]
        except Exception as ex:
            logger.error(f"Error querying EmailIndex: {ex}")
            # Final fallback: slow scan
            resp = users_table.scan(
                FilterExpression=Key("email").eq(email.lower().strip())
            )
            if resp.get("Items"):
                return resp["Items"][0]
    return None

def find_user_by_id(user_id: str) -> Optional[dict]:
    if MOCK_AWS:
        return csv_find_user_by_id(user_id)

    table = _get_users_table()
    try:
        response = table.get_item(Key={"user_id": user_id})
        return response.get("Item")
    except Exception as e:
        logger.error(f"Error finding user by id: {e}")
        return None

def create_user(
    email: str,
    name: str,
    password: Optional[str] = None,
    provider: str = "email",
    avatar_url: str = "",
) -> dict:
    if MOCK_AWS:
        return csv_create_user(email, name, password, provider, avatar_url)

    email_norm = email.lower().strip()
    user_id = str(uuid.uuid4())
    password_hash = hash_password(password) if password else ""
    now = datetime.now(timezone.utc).isoformat()

    user = {
        "user_id": user_id,
        "email": email_norm,
        "name": name.strip(),
        "password_hash": password_hash,
        "provider": provider,
        "avatar_url": avatar_url,
        "created_at": now,
        "updated_at": now,
        "status": "active"
    }

    try:
        client = boto3.client("dynamodb", region_name=AWS_REGION)
        # TransactWriteItems to ensure email uniqueness
        client.transact_write_items(
            TransactItems=[
                {
                    "Put": {
                        "TableName": DYNAMODB_TABLE_EMAIL_LOCKS,
                        "Item": {
                            "email_norm": {"S": email_norm},
                            "user_id": {"S": user_id},
                            "created_at": {"S": now}
                        },
                        "ConditionExpression": "attribute_not_exists(email_norm)"
                    }
                },
                {
                    "Put": {
                        "TableName": DYNAMODB_TABLE_USERS,
                        "Item": {
                            "user_id": {"S": user_id},
                            "email": {"S": email_norm},
                            "name": {"S": user["name"]},
                            "password_hash": {"S": password_hash},
                            "provider": {"S": provider},
                            "avatar_url": {"S": avatar_url},
                            "created_at": {"S": now},
                            "updated_at": {"S": now},
                            "status": {"S": "active"}
                        },
                        "ConditionExpression": "attribute_not_exists(user_id)"
                    }
                }
            ]
        )
        logger.info(f"Created user in DynamoDB: {email_norm} (provider={provider})")
        # Return without password hash
        safe = {k: v for k, v in user.items() if k != "password_hash"}
        return safe
    except ClientError as e:
        if e.response.get("Error", {}).get("Code") == "TransactionCanceledException":
            reasons = e.response.get("CancellationReasons", [])
            if any(r.get("Code") == "ConditionalCheckFailed" for r in reasons):
                raise ValueError("An account with this email already exists.")
            logger.error(f"Transaction canceled: {e}")
            raise ValueError("Failed to create account due to internal conflict.")
        logger.error(f"Error creating user: {e}")
        raise ValueError(f"Internal error: {e}")
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        raise ValueError(f"Internal error: {e}")

def authenticate_user(email: str, password: str) -> Optional[dict]:
    if MOCK_AWS:
        return csv_authenticate_user(email, password)

    user = find_user_by_email(email)
    if not user:
        return None

    if user.get("provider") != "email":
        return None

    if not user.get("password_hash"):
        return None

    if not verify_password(password, user["password_hash"]):
        return None

    safe = {k: v for k, v in user.items() if k != "password_hash"}
    return safe

def upsert_google_user(email: str, name: str, avatar_url: str = "") -> dict:
    if MOCK_AWS:
        return csv_upsert_google_user(email, name, avatar_url)

    existing = find_user_by_email(email)
    
    if existing:
        # Update avatar if needed
        if avatar_url and existing.get("avatar_url") != avatar_url:
            table = _get_users_table()
            try:
                # Fix provider if needed
                new_provider = existing.get("provider", "email")
                if new_provider == "email":
                    new_provider = "email,google"
                
                table.update_item(
                    Key={"user_id": existing["user_id"]},
                    UpdateExpression="SET avatar_url = :a, provider = :p, updated_at = :u",
                    ExpressionAttributeValues={
                        ":a": avatar_url,
                        ":p": new_provider,
                        ":u": datetime.now(timezone.utc).isoformat()
                    }
                )
                existing["avatar_url"] = avatar_url
                existing["provider"] = new_provider
            except Exception as e:
                logger.error(f"Error updating Google user: {e}")
        
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

# ---------------------------------------------------------------------------
# Session Storage
# ---------------------------------------------------------------------------
def store_auth_session(token: str, user_id: str, ttl_seconds: int = 86400 * 7):
    if MOCK_AWS:
        # The auth_routes.py handles in-memory sessions for Mock AWS.
        return

    table = _get_auth_sessions_table()
    now = datetime.now(timezone.utc)
    expires_at = int(now.timestamp()) + ttl_seconds
    try:
        # Use a hash of the token for security
        import hashlib
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        table.put_item(Item={
            "token_hash": token_hash,
            "user_id": user_id,
            "created_at": now.isoformat(),
            "expires_at": expires_at,
            "ttl": expires_at
        })
    except Exception as e:
        logger.error(f"Error storing auth session: {e}")

def get_auth_session_user_id(token: str) -> Optional[str]:
    if MOCK_AWS:
        return None # In mock mode, auth_routes will use its in-memory _sessions dict

    table = _get_auth_sessions_table()
    try:
        import hashlib
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        response = table.get_item(Key={"token_hash": token_hash})
        if "Item" in response:
            item = response["Item"]
            # Check TTL
            if item.get("expires_at", 0) < int(datetime.now(timezone.utc).timestamp()):
                return None
            return item.get("user_id")
    except Exception as e:
        logger.error(f"Error getting auth session: {e}")
    return None

def delete_auth_session(token: str):
    if MOCK_AWS:
        return

    table = _get_auth_sessions_table()
    try:
        import hashlib
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        table.delete_item(Key={"token_hash": token_hash})
    except Exception as e:
        logger.error(f"Error deleting auth session: {e}")
