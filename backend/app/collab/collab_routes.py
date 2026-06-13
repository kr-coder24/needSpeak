from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
import logging
from typing import Optional

from app.collab.models import (
    CreateCollabRequest,
    JoinCollabRequest,
    AddCollabItemsRequest,
    RemoveCollabItemRequest,
    UpdateBudgetRequest,
    CollabSession,
    Contributor,
    CollabCartItem,
    BudgetSplit
)
from app.collab.collab_store import (
    create_session,
    get_session,
    join_session,
    add_items,
    remove_item,
    update_budget,
    leave_session,
    get_budget_split,
    resolve_share_code
)
from app.collab.collab_ws import manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/collab", tags=["collab"])

# REST Endpoints

@router.post("/create")
async def create_collab(req: CreateCollabRequest):
    """Host creates a new collaborative session."""
    session, host = create_session(
        name=req.name,
        host_name=req.host_name,
        total_budget_inr=req.total_budget_inr
    )
    logger.info(f"Created collab session {session.session_id} by {host.name}")
    return {
        "session": session.model_dump(),
        "contributor": host.model_dump()
    }

@router.get("/{session_id}")
async def get_collab_session(session_id: str):
    """Get the current state of a session."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session.model_dump()

@router.post("/{session_id}/join")
async def join_collab(session_id: str, req: JoinCollabRequest):
    """Join an existing session."""
    contributor = join_session(session_id, req.contributor_name)
    if not contributor:
        raise HTTPException(status_code=404, detail="Session not found")
        
    session = get_session(session_id)
    
    # Broadcast to others that someone joined
    await manager.broadcast(session_id, {
        "type": "contributor_joined",
        "data": {
            "contributor": contributor.model_dump(),
            "session": session.model_dump()
        }
    })
    
    return {
        "session": session.model_dump(),
        "contributor": contributor.model_dump()
    }

@router.post("/{session_id}/add-items")
async def add_collab_items(session_id: str, req: AddCollabItemsRequest):
    """REST fallback to add items."""
    new_items = add_items(session_id, req.contributor_id, req.items)
    if new_items is None:
        raise HTTPException(status_code=404, detail="Session or contributor not found")
        
    session = get_session(session_id)
    
    # Broadcast updates
    await manager.broadcast(session_id, {
        "type": "items_added",
        "data": {
            "contributor_id": req.contributor_id,
            "new_items": [item.model_dump() for item in new_items],
            "session": session.model_dump()
        }
    })
    
    return {"success": True, "items": [item.model_dump() for item in new_items]}

@router.delete("/{session_id}/items/{item_id}")
async def remove_collab_item(session_id: str, item_id: str, req: RemoveCollabItemRequest):
    """REST fallback to remove item."""
    success = remove_item(session_id, item_id, req.contributor_id)
    if not success:
        raise HTTPException(status_code=403, detail="Not authorized or item not found")
        
    session = get_session(session_id)
    
    await manager.broadcast(session_id, {
        "type": "item_removed",
        "data": {
            "item_id": item_id,
            "session": session.model_dump()
        }
    })
    
    return {"success": True}

@router.put("/{session_id}/budget")
async def update_collab_budget(session_id: str, req: UpdateBudgetRequest):
    """Host updates budget."""
    success = update_budget(session_id, req.new_budget_inr, req.contributor_id)
    if not success:
        raise HTTPException(status_code=403, detail="Not authorized (must be host)")
        
    session = get_session(session_id)
    
    await manager.broadcast(session_id, {
        "type": "budget_updated",
        "data": {
            "new_budget_inr": req.new_budget_inr,
            "session": session.model_dump()
        }
    })
    
    return {"success": True}

@router.get("/{session_id}/split")
async def get_collab_split(session_id: str):
    """Get per-contributor budget split."""
    splits = get_budget_split(session_id)
    if splits is None:
        raise HTTPException(status_code=404, detail="Session not found")
        
    return {"splits": [split.model_dump() for split in splits]}

@router.get("/join/{share_code}")
async def resolve_code(share_code: str):
    """Resolve a short share code to a session_id."""
    session_id = resolve_share_code(share_code)
    if not session_id:
        raise HTTPException(status_code=404, detail="Invalid share code")
        
    return {"session_id": session_id}


# WebSocket Endpoint

@router.websocket("/{session_id}/ws")
async def collab_websocket(websocket: WebSocket, session_id: str, contributor_id: str):
    """WebSocket endpoint for real-time collaboration."""
    session = get_session(session_id)
    if not session:
        await websocket.close(code=4004, reason="Session not found")
        return
        
    await manager.connect(session_id, websocket, contributor_id)
    
    try:
        # Send initial state
        await websocket.send_json({
            "type": "session_state",
            "data": session.model_dump()
        })
        
        while True:
            # Receive message from client
            msg = await websocket.receive_json()
            msg_type = msg.get("type")
            data = msg.get("data", {})
            
            if msg_type == "add_items":
                items_input = [CollabCartItem(**item) for item in data.get("items", [])]
                # Re-use the existing logic by creating input objects
                from app.collab.models import CollabItemInput
                inputs = [CollabItemInput(**item) for item in data.get("items", [])]
                
                new_items = add_items(session_id, contributor_id, inputs)
                if new_items:
                    await manager.broadcast(session_id, {
                        "type": "items_added",
                        "data": {
                            "contributor_id": contributor_id,
                            "new_items": [item.model_dump() for item in new_items],
                            "session": get_session(session_id).model_dump()
                        }
                    })
            
            elif msg_type == "remove_item":
                item_id = data.get("item_id")
                success = remove_item(session_id, item_id, contributor_id)
                if success:
                    await manager.broadcast(session_id, {
                        "type": "item_removed",
                        "data": {
                            "item_id": item_id,
                            "session": get_session(session_id).model_dump()
                        }
                    })
                    
            elif msg_type == "update_budget":
                new_budget = data.get("new_budget_inr")
                if new_budget is not None:
                    success = update_budget(session_id, float(new_budget), contributor_id)
                    if success:
                        await manager.broadcast(session_id, {
                            "type": "budget_updated",
                            "data": {
                                "new_budget_inr": new_budget,
                                "session": get_session(session_id).model_dump()
                            }
                        })
                        
    except WebSocketDisconnect:
        manager.disconnect(session_id, websocket, contributor_id)
        # Note: We don't remove them from the session entirely here because
        # they might just have refreshed the page. If we wanted a strict
        # presence system we'd broadcast `contributor_left`.
        pass
    except Exception as e:
        logger.error(f"[WS] Error in websocket loop: {e}")
        manager.disconnect(session_id, websocket, contributor_id)
