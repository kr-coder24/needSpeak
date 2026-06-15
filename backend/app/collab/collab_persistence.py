"""
Persistence layer for collaborative SplitCart sessions (Option C — production).

Sessions survive backend restarts by writing through to:
  - Amazon DynamoDB  (when MOCK_AWS=0)
  - A local JSON file (when MOCK_AWS=1, for local dev/demo)

The in-memory dict in collab_store.py remains the hot cache; this module is the
durable backing store. On a cache miss, collab_store lazy-loads from here.

DynamoDB table schema (single table, keyed by session_id):
  PK: pk (str)  — "SESSION#<session_id>"  or  "CODE#<share_code>"
  payload (map / str)

Design notes:
  - Share-code -> session-id mapping is stored as its own lightweight item so
    join-by-code works after a restart without scanning all sessions.
  - All writes are best-effort: a persistence failure never breaks the live
    in-memory flow (we log and continue). This keeps the demo resilient.
"""

from __future__ import annotations

import json
import logging
import os
import threading
from typing import Any, Optional

from app.config import AWS_REGION, DYNAMODB_TABLE_COLLAB, MOCK_AWS
from app.collab.models import CollabSession

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Local-file backend (used when MOCK_AWS=1)
# ---------------------------------------------------------------------------
_LOCAL_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),  # backend/
    ".collab_sessions.json",
)
_file_lock = threading.Lock()


def _read_local_store() -> dict[str, Any]:
    try:
        if not os.path.exists(_LOCAL_FILE):
            return {"sessions": {}, "codes": {}}
        with open(_LOCAL_FILE, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[collab-persist] Could not read local store: %s", exc)
        return {"sessions": {}, "codes": {}}


def _write_local_store(store: dict[str, Any]) -> None:
    try:
        with open(_LOCAL_FILE, "w", encoding="utf-8") as fh:
            json.dump(store, fh, default=str)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[collab-persist] Could not write local store: %s", exc)


# ---------------------------------------------------------------------------
# DynamoDB backend (used when MOCK_AWS=0)
# ---------------------------------------------------------------------------
_dynamo_table = None


def _get_table():
    global _dynamo_table
    if _dynamo_table is None:
        import boto3

        _dynamo_table = boto3.resource(
            "dynamodb", region_name=AWS_REGION
        ).Table(DYNAMODB_TABLE_COLLAB)
    return _dynamo_table


# ---------------------------------------------------------------------------
# Public API — used by collab_store.py
# ---------------------------------------------------------------------------

def save_session(session: CollabSession) -> None:
    """Persist a full session (write-through). Best-effort, never raises."""
    payload = session.model_dump()
    try:
        if MOCK_AWS:
            with _file_lock:
                store = _read_local_store()
                store.setdefault("sessions", {})[session.session_id] = payload
                store.setdefault("codes", {})[session.share_code.upper()] = session.session_id
                _write_local_store(store)
        else:
            # DynamoDB stores the payload as a JSON string to avoid Decimal/type churn
            table = _get_table()
            table.put_item(Item={
                "pk": f"SESSION#{session.session_id}",
                "session_id": session.session_id,
                "payload": json.dumps(payload, default=str),
            })
            table.put_item(Item={
                "pk": f"CODE#{session.share_code.upper()}",
                "session_id": session.session_id,
            })
    except Exception as exc:  # noqa: BLE001
        logger.warning("[collab-persist] save_session failed for %s: %s", session.session_id, exc)


def load_session(session_id: str) -> Optional[CollabSession]:
    """Load a session from durable storage. Returns None if absent."""
    try:
        if MOCK_AWS:
            store = _read_local_store()
            raw = store.get("sessions", {}).get(session_id)
            if not raw:
                return None
            return CollabSession.model_validate(raw)
        else:
            table = _get_table()
            resp = table.get_item(Key={"pk": f"SESSION#{session_id}"})
            item = resp.get("Item")
            if not item or "payload" not in item:
                return None
            return CollabSession.model_validate(json.loads(item["payload"]))
    except Exception as exc:  # noqa: BLE001
        logger.warning("[collab-persist] load_session failed for %s: %s", session_id, exc)
        return None


def load_share_code(share_code: str) -> Optional[str]:
    """Resolve a share code to a session_id from durable storage."""
    code = share_code.upper()
    try:
        if MOCK_AWS:
            store = _read_local_store()
            return store.get("codes", {}).get(code)
        else:
            table = _get_table()
            resp = table.get_item(Key={"pk": f"CODE#{code}"})
            item = resp.get("Item")
            return item.get("session_id") if item else None
    except Exception as exc:  # noqa: BLE001
        logger.warning("[collab-persist] load_share_code failed for %s: %s", code, exc)
        return None


def load_all_sessions() -> tuple[dict[str, CollabSession], dict[str, str]]:
    """
    Load every persisted session + share-code map. Called once at startup to
    warm the in-memory cache so live sessions survive a restart.
    Returns (sessions_by_id, session_id_by_code).
    """
    sessions: dict[str, CollabSession] = {}
    codes: dict[str, str] = {}
    try:
        if MOCK_AWS:
            store = _read_local_store()
            for sid, raw in store.get("sessions", {}).items():
                try:
                    sessions[sid] = CollabSession.model_validate(raw)
                except Exception:  # noqa: BLE001
                    continue
            codes = dict(store.get("codes", {}))
        else:
            table = _get_table()
            resp = table.scan()
            for item in resp.get("Items", []):
                pk = item.get("pk", "")
                if pk.startswith("SESSION#") and "payload" in item:
                    try:
                        s = CollabSession.model_validate(json.loads(item["payload"]))
                        sessions[s.session_id] = s
                    except Exception:  # noqa: BLE001
                        continue
                elif pk.startswith("CODE#"):
                    codes[pk[len("CODE#"):]] = item.get("session_id", "")
    except Exception as exc:  # noqa: BLE001
        logger.warning("[collab-persist] load_all_sessions failed: %s", exc)
    logger.info("[collab-persist] Warmed %d sessions from durable store", len(sessions))
    return sessions, codes


def delete_all_for_tests() -> None:
    """Clear durable storage (tests only)."""
    if MOCK_AWS:
        with _file_lock:
            _write_local_store({"sessions": {}, "codes": {}})
