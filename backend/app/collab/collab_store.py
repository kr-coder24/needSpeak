import uuid
import string
import random
from typing import Optional

from app.collab.models import (
    CollabSession,
    Contributor,
    CollabRole,
    ContributorStatus,
    CollabCartItem,
    CollabItemInput,
    BudgetSplit
)

# In-memory store for collab sessions
_sessions: dict[str, CollabSession] = {}
_share_codes: dict[str, str] = {}


def generate_share_code(length: int = 6) -> str:
    """Generate a random alphanumeric share code."""
    chars = string.ascii_uppercase + string.digits
    while True:
        code = "".join(random.choice(chars) for _ in range(length))
        if code not in _share_codes:
            return code


def create_session(name: str, host_name: str, total_budget_inr: float) -> CollabSession:
    """Create a new collab session and return it."""
    session_id = str(uuid.uuid4())
    share_code = generate_share_code()
    host_id = str(uuid.uuid4())
    
    host = Contributor(
        id=host_id,
        name=host_name,
        role=CollabRole.HOST,
        status=ContributorStatus.ACTIVE
    )
    
    session = CollabSession(
        session_id=session_id,
        name=name,
        host_id=host_id,
        host_name=host_name,
        total_budget_inr=total_budget_inr,
        share_code=share_code,
        contributors=[host],
        items=[]
    )
    
    _sessions[session_id] = session
    _share_codes[share_code] = session_id
    
    return session, host


def get_session(session_id: str) -> Optional[CollabSession]:
    """Get a collab session by ID."""
    return _sessions.get(session_id)


def resolve_share_code(share_code: str) -> Optional[str]:
    """Get session_id for a share code."""
    return _share_codes.get(share_code.upper())


def join_session(session_id: str, contributor_name: str) -> Optional[Contributor]:
    """Add a contributor to a session and return the Contributor."""
    session = _sessions.get(session_id)
    if not session:
        return None
        
    contributor = Contributor(
        id=str(uuid.uuid4()),
        name=contributor_name,
        role=CollabRole.CONTRIBUTOR,
        status=ContributorStatus.ACTIVE
    )
    
    session.contributors.append(contributor)
    return contributor


def add_items(session_id: str, contributor_id: str, items_input: list[CollabItemInput]) -> Optional[list[CollabCartItem]]:
    """Add items to a session from a specific contributor."""
    session = _sessions.get(session_id)
    if not session:
        return None
        
    contributor = next((c for c in session.contributors if c.id == contributor_id), None)
    if not contributor:
        return None
        
    new_items = []
    for item_input in items_input:
        new_item = CollabCartItem(
            id=str(uuid.uuid4()),
            name=item_input.name,
            quantity=item_input.quantity,
            unit=item_input.unit,
            category=item_input.category,
            estimated_price_inr=item_input.estimated_price_inr,
            added_by=contributor_id,
            added_by_name=contributor.name,
            notes=item_input.notes
        )
        new_items.append(new_item)
        session.items.append(new_item)
        contributor.items_added += 1
        contributor.budget_contribution_inr += (new_item.estimated_price_inr * new_item.quantity)
        
    return new_items


def remove_item(session_id: str, item_id: str, contributor_id: str) -> bool:
    """Remove an item from a session."""
    session = _sessions.get(session_id)
    if not session:
        return False
        
    # Check if host or item owner
    is_host = session.host_id == contributor_id
    
    item_to_remove = next((item for item in session.items if item.id == item_id), None)
    if not item_to_remove:
        return False
        
    if not is_host and item_to_remove.added_by != contributor_id:
        return False # Unauthorized
        
    session.items.remove(item_to_remove)
    
    # Update contributor stats
    owner = next((c for c in session.contributors if c.id == item_to_remove.added_by), None)
    if owner:
        owner.items_added = max(0, owner.items_added - 1)
        owner.budget_contribution_inr = max(0.0, owner.budget_contribution_inr - (item_to_remove.estimated_price_inr * item_to_remove.quantity))
        
    return True


def update_budget(session_id: str, new_budget: float, contributor_id: str) -> bool:
    """Update total budget (host only)."""
    session = _sessions.get(session_id)
    if not session:
        return False
        
    if session.host_id != contributor_id:
        return False
        
    session.total_budget_inr = new_budget
    return True


def leave_session(session_id: str, contributor_id: str) -> bool:
    """Mark a contributor as left."""
    session = _sessions.get(session_id)
    if not session:
        return False
        
    contributor = next((c for c in session.contributors if c.id == contributor_id), None)
    if not contributor:
        return False
        
    contributor.status = ContributorStatus.LEFT
    return True


def get_budget_split(session_id: str) -> Optional[list[BudgetSplit]]:
    """Calculate the per-contributor budget split."""
    session = _sessions.get(session_id)
    if not session:
        return None
        
    active_contributors = [c for c in session.contributors if c.status == ContributorStatus.ACTIVE]
    num_contributors = len(active_contributors)
    
    if num_contributors == 0:
        return []
        
    total_spent = sum(item.estimated_price_inr * item.quantity for item in session.items)
    fair_share = total_spent / num_contributors
    
    splits = []
    for c in active_contributors:
        # Calculate exactly how much this contributor's items cost
        amount_spent = sum(item.estimated_price_inr * item.quantity for item in session.items if item.added_by == c.id)
        
        # If they bought less than fair share, they owe positive amount to the pool
        # If they bought more than fair share, they owe negative amount (meaning they get paid back)
        owes = fair_share - amount_spent
        
        splits.append(BudgetSplit(
            contributor_id=c.id,
            name=c.name,
            items_added=c.items_added,
            amount_spent=amount_spent,
            fair_share=fair_share,
            owes=owes
        ))
        
    return splits
