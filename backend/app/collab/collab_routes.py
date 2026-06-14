"""REST and WebSocket routes for the collaborative SplitCart."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from app.collab.collab_service import resolve_collab_input
from app.collab.collab_store import (
    apply_substitution,
    create_session,
    get_budget_split,
    get_session,
    join_session,
    merge_resolved_item,
    reject_substitution,
    remove_item,
    resolve_share_code,
    update_budget,
    update_demand_quantity,
)
from app.collab.collab_ws import manager
from app.collab.models import (
    AddCollabItemsRequest,
    CollabItemInput,
    CreateCollabRequest,
    JoinCollabRequest,
    RemoveCollabItemRequest,
    UpdateBudgetRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/collab", tags=["collab"])


def _get_contributor(session_id: str, contributor_id: str):
    session = get_session(session_id)
    if not session:
        return None
    return next(
        (
            contributor
            for contributor in session.contributors
            if contributor.id == contributor_id
        ),
        None,
    )


def _state_payload(session_id: str) -> dict:
    session = get_session(session_id)
    splits = get_budget_split(session_id) or []
    return {
        "session": session.model_dump() if session else None,
        "splits": [split.model_dump() for split in splits],
    }


async def _broadcast_state(session_id: str, event_type: str, **extra) -> None:
    data = _state_payload(session_id)
    data.update(extra)
    await manager.broadcast(session_id, {"type": event_type, "data": data})


def _resolve_and_merge(
    session_id: str,
    contributor_id: str,
    items: list[CollabItemInput],
) -> tuple[list, list[dict], list[str]]:
    contributor = _get_contributor(session_id, contributor_id)
    if not contributor:
        raise HTTPException(
            status_code=404, detail="Session or contributor not found"
        )

    merged_items = []
    suggestions = []
    not_found = []
    for item_input in items:
        resolved, close_matches = resolve_collab_input(item_input, contributor)
        if resolved:
            merged = merge_resolved_item(session_id, contributor_id, resolved)
            if merged:
                merged_items.append(merged)
            continue

        if close_matches:
            suggestions.append(
                {
                    "request": item_input.model_dump(),
                    "suggestions": [
                        suggestion.model_dump() for suggestion in close_matches
                    ],
                }
            )
        else:
            not_found.append(item_input.name)

    return merged_items, suggestions, not_found


@router.post("/create")
async def create_collab(req: CreateCollabRequest):
    session, host = create_session(
        name=req.name.strip(),
        host_name=req.host_name.strip(),
        total_budget_inr=req.total_budget_inr,
    )
    logger.info("Created collab session %s by %s", session.session_id, host.name)
    return {"session": session.model_dump(), "contributor": host.model_dump()}


@router.get("/join/{share_code}")
async def resolve_code(share_code: str):
    session_id = resolve_share_code(share_code)
    if not session_id:
        raise HTTPException(status_code=404, detail="Invalid share code")
    return {"session_id": session_id}


@router.get("/{session_id}")
async def get_collab_session(session_id: str):
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session.model_dump()


@router.post("/{session_id}/join")
async def join_collab(session_id: str, req: JoinCollabRequest):
    contributor = join_session(session_id, req.contributor_name.strip())
    if not contributor:
        raise HTTPException(status_code=404, detail="Session not found")
    await _broadcast_state(
        session_id,
        "contributor_joined",
        contributor=contributor.model_dump(),
    )
    return {
        "session": get_session(session_id).model_dump(),
        "contributor": contributor.model_dump(),
    }


@router.post("/{session_id}/add-items")
async def add_collab_items(session_id: str, req: AddCollabItemsRequest):
    merged, suggestions, not_found = _resolve_and_merge(
        session_id, req.contributor_id, req.items
    )
    if merged:
        await _broadcast_state(
            session_id,
            "items_added",
            changed_item_ids=[item.id for item in merged],
        )
    return {
        "success": bool(merged),
        "items": [item.model_dump() for item in merged],
        "suggestions": suggestions,
        "not_found": not_found,
    }


@router.delete("/{session_id}/items/{item_id}")
async def remove_collab_item(
    session_id: str, item_id: str, req: RemoveCollabItemRequest
):
    if not remove_item(session_id, item_id, req.contributor_id):
        raise HTTPException(
            status_code=403, detail="Not authorized or item not found"
        )
    await _broadcast_state(session_id, "item_removed", item_id=item_id)
    return {"success": True}


@router.put("/{session_id}/budget")
async def update_collab_budget(session_id: str, req: UpdateBudgetRequest):
    if not update_budget(session_id, req.new_budget_inr, req.contributor_id):
        raise HTTPException(status_code=403, detail="Only the host can edit budget")
    await _broadcast_state(
        session_id, "budget_updated", new_budget_inr=req.new_budget_inr
    )
    return {"success": True}


@router.get("/{session_id}/split")
async def get_collab_split(session_id: str):
    splits = get_budget_split(session_id)
    if splits is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"splits": [split.model_dump() for split in splits]}


@router.websocket("/{session_id}/ws")
async def collab_websocket(
    websocket: WebSocket, session_id: str, contributor_id: str
):
    session = get_session(session_id)
    contributor = _get_contributor(session_id, contributor_id)
    if not session:
        await websocket.close(code=4004, reason="Session not found")
        return
    if not contributor:
        await websocket.close(code=4003, reason="Contributor not found")
        return

    await manager.connect(session_id, websocket, contributor_id)
    try:
        initial = _state_payload(session_id)
        await websocket.send_json({"type": "session_state", "data": initial})

        while True:
            message = await websocket.receive_json()
            message_type = message.get("type")
            data = message.get("data") or {}

            if message_type == "add_items":
                raw_items = data.get("items") or []
                try:
                    items = [CollabItemInput.model_validate(item) for item in raw_items]
                except Exception:
                    await websocket.send_json(
                        {
                            "type": "error",
                            "data": {
                                "message": (
                                    "Enter a product, a quantity above zero, "
                                    "and a valid unit."
                                )
                            },
                        }
                    )
                    continue

                merged, suggestions, not_found = _resolve_and_merge(
                    session_id, contributor_id, items
                )
                if suggestions:
                    await websocket.send_json(
                        {
                            "type": "item_suggestions",
                            "data": {"requests": suggestions},
                        }
                    )
                if not_found:
                    await websocket.send_json(
                        {
                            "type": "items_not_found",
                            "data": {"items": not_found},
                        }
                    )
                if merged:
                    await _broadcast_state(
                        session_id,
                        "items_added",
                        changed_item_ids=[item.id for item in merged],
                        added_by=contributor.name,
                    )
                    updated = get_session(session_id)
                    if (
                        updated.total_budget_inr > 0
                        and updated.total_estimated_cost
                        > updated.total_budget_inr
                    ):
                        await _broadcast_state(
                            session_id,
                            "budget_warning",
                            overage=(
                                updated.total_estimated_cost
                                - updated.total_budget_inr
                            ),
                        )

            elif message_type == "remove_item":
                item_id = data.get("item_id")
                if item_id and remove_item(session_id, item_id, contributor_id):
                    await _broadcast_state(
                        session_id, "item_removed", item_id=item_id
                    )

            elif message_type == "update_budget":
                new_budget = data.get("new_budget_inr")
                if new_budget is not None and update_budget(
                    session_id, float(new_budget), contributor_id
                ):
                    await _broadcast_state(
                        session_id,
                        "budget_updated",
                        new_budget_inr=float(new_budget),
                    )

            elif message_type == "update_quantity":
                item_id = data.get("item_id")
                new_quantity = data.get("quantity")
                if (
                    item_id
                    and new_quantity is not None
                    and update_demand_quantity(
                        session_id,
                        item_id,
                        contributor_id,
                        float(new_quantity),
                    )
                ):
                    await _broadcast_state(
                        session_id,
                        "quantity_updated",
                        item_id=item_id,
                        contributor_id=contributor_id,
                    )

            elif message_type == "accept_substitution":
                item_id = data.get("item_id")
                if item_id and apply_substitution(
                    session_id, item_id, contributor_id
                ):
                    await _broadcast_state(
                        session_id, "substitution_accepted", item_id=item_id
                    )
                else:
                    await websocket.send_json(
                        {
                            "type": "error",
                            "data": {
                                "message": "Only the host can apply a cart-wide deal."
                            },
                        }
                    )

            elif message_type == "reject_substitution":
                item_id = data.get("item_id")
                if item_id and reject_substitution(
                    session_id, item_id, contributor_id
                ):
                    await _broadcast_state(
                        session_id, "substitution_rejected", item_id=item_id
                    )

    except WebSocketDisconnect:
        manager.disconnect(session_id, websocket, contributor_id)
    except Exception:
        logger.exception("WebSocket failure in collab session %s", session_id)
        manager.disconnect(session_id, websocket, contributor_id)


from pydantic import BaseModel
from app.collab.collab_notifications import send_email_invite, send_sms_invite

class InviteRequest(BaseModel):
    recipients: list[dict]  # [{"type": "email", "value": "user@example.com"}, ...]
    contributor_id: str

@router.post("/{session_id}/invite")
async def send_invites(session_id: str, req: InviteRequest):
    """Send collaboration invites via email or SMS."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    contributor = _get_contributor(session_id, req.contributor_id)
    if not contributor:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Only host or active contributors can invite
    if contributor.status != "active" and session.host_id != req.contributor_id:
        raise HTTPException(status_code=403, detail="Only active contributors can invite")
    
    share_url = f"https://yourdomain.com/collab/join/{session.share_code}"
    # For local dev: share_url = f"http://localhost:5173/collab/join/{session.share_code}"
    
    results = []
    for recipient in req.recipients:
        recipient_type = recipient.get("type")
        recipient_value = recipient.get("value")
        
        if not recipient_type or not recipient_value:
            results.append({"value": recipient_value, "success": False, "error": "Invalid format"})
            continue
        
        if recipient_type == "email":
            success = send_email_invite(
                recipient_email=recipient_value,
                session_name=session.name,
                share_url=share_url,
                host_name=contributor.name,
            )
            results.append({"value": recipient_value, "type": "email", "success": success})
        
        elif recipient_type == "sms":
            success = send_sms_invite(
                recipient_phone=recipient_value,
                session_name=session.name,
                share_url=share_url,
                host_name=contributor.name,
            )
            results.append({"value": recipient_value, "type": "sms", "success": success})
        
        else:
            results.append({"value": recipient_value, "success": False, "error": "Unknown type"})
    
    return {"results": results}
