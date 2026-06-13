"""
Occasion Routes — FastAPI router for OccasionCart template endpoints.

Provides:
  GET  /api/occasions          → List all occasion templates
  GET  /api/occasions/{id}     → Get a specific template
  POST /api/occasions/generate → Generate a prompt from a template

Person C owns this file. Person A includes it via app.include_router().
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.intelligence.occasion_templates import (
    get_all_templates,
    get_template_by_id,
    render_prompt,
)

router = APIRouter(prefix="/api/occasions", tags=["occasions"])


# ---------------------------------------------------------------------------
# Request/Response models
# ---------------------------------------------------------------------------
class GeneratePromptRequest(BaseModel):
    """Request to generate a prompt from an occasion template."""
    template_id: str
    attendees: Optional[int] = Field(None, ge=1, le=100)
    budget_inr: Optional[int] = Field(None, ge=50)


class GeneratePromptResponse(BaseModel):
    """Generated prompt ready to be sent to /api/parse."""
    template_id: str
    template_name: str
    prompt: str
    attendees: int
    budget_inr: int


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@router.get("")
async def list_occasions():
    """Return all available occasion templates."""
    return {"occasions": get_all_templates()}


@router.get("/{template_id}")
async def get_occasion(template_id: str):
    """Return a specific occasion template by ID."""
    template = get_template_by_id(template_id)
    if not template:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")
    return template.model_dump()


@router.post("/generate", response_model=GeneratePromptResponse)
async def generate_occasion_prompt(req: GeneratePromptRequest):
    """
    Generate a natural language prompt from an occasion template.
    The frontend can then send this prompt directly to POST /api/parse.
    """
    template = get_template_by_id(req.template_id)
    if not template:
        raise HTTPException(status_code=404, detail=f"Template '{req.template_id}' not found")

    attendees = req.attendees or template.default_attendees
    budget = req.budget_inr or template.default_budget_inr
    prompt = render_prompt(req.template_id, attendees, budget)

    return GeneratePromptResponse(
        template_id=template.id,
        template_name=template.name,
        prompt=prompt,
        attendees=attendees,
        budget_inr=budget,
    )
