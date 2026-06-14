"""Community and bulk-buy API routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.collab.bulk_buy import accept_bulk_deal, find_bulk_matches
from app.collab.collab_store import get_session
from app.collab.community_store import join_community, list_communities, normalize_community_code

router = APIRouter(prefix="/api/community", tags=["community"])


class JoinCommunityRequest(BaseModel):
    session_id: str
    community_code: str = Field(..., min_length=1, max_length=60)
    community_name: str = Field(default="", max_length=80)


class AcceptDealRequest(BaseModel):
    session_id: str
    community_code: str = Field(..., min_length=1, max_length=60)
    deal_category: str = Field(..., min_length=1, max_length=80)


@router.post("/join")
async def join_community_endpoint(req: JoinCommunityRequest):
    session = get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    group = join_community(req.session_id, req.community_code, req.community_name)
    if not group:
        raise HTTPException(status_code=400, detail="Community code is required")

    session.community_code = group.code
    session.community_name = group.name
    return {"community": group.model_dump(), "session": session.model_dump()}


@router.get("/list")
async def list_community_endpoint():
    return {"communities": [group.model_dump() for group in list_communities()]}


@router.get("/{code}/deals")
async def community_deals(code: str, session_id: str = ""):
    normalized = normalize_community_code(code)
    deals = find_bulk_matches(session_id, normalized)
    return {"community_code": normalized, "deals": [deal.model_dump() for deal in deals]}


@router.post("/accept-deal")
async def accept_deal(req: AcceptDealRequest):
    session = get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    code = normalize_community_code(req.community_code)
    accept_bulk_deal(req.session_id, code, req.deal_category)
    return {
        "success": True,
        "deals": [deal.model_dump() for deal in find_bulk_matches(req.session_id, code)],
    }
