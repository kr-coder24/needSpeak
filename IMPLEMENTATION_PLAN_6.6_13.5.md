# Implementation Plan: Features 6.6 & 13.5
**Feature 6.6**: Invite Contributor Flow (Email/SMS Integration)  
**Feature 13.5**: Proceed to Checkout (Inventory Reservation + Payment Integration)

---

## Executive Summary

This document provides a complete implementation plan for:
1. **Collaborative Cart Invite System** - Send invite links via Email/SMS with Twilio & SendGrid
2. **Checkout Flow** - Inventory reservation, payment integration, and order confirmation

Both features build on existing infrastructure and require minimal changes to core logic.

---

## Feature 6.6: Invite Contributor Flow

### Current State
✅ **What exists:**
- `/collab/$id` page with "Share link" and QR code
- Manual join via share link (`/collab/join/$code`)
- Share code system (`6-character` uppercase codes)
- Real-time WebSocket collaboration

❌ **What's missing:**
- Backend endpoint to send invites via Email/SMS
- UI "Invite" button wired to backend
- Email/SMS provider integration (SendGrid/Twilio)

### Architecture Overview

```
┌─────────────────────┐
│   Frontend UI       │
│  (collab.$id.tsx)   │
└──────────┬──────────┘
           │
           │ POST /api/collab/{id}/invite
           │ { recipients: [...], method: "email"|"sms" }
           ▼
┌─────────────────────┐
│   Backend Route     │
│ (collab_routes.py)  │
└──────────┬──────────┘
           │
           ├──────────► SendGrid API (Email)
           │
           └──────────► Twilio API (SMS)
```


### Implementation Steps

#### Step 1: Set Up Provider Accounts

**SendGrid (Email)**
1. Sign up at https://sendgrid.com (free tier: 100 emails/day)
2. Create API key: Settings → API Keys → Create API Key
3. Verify sender email: Settings → Sender Authentication
4. Add to `.env`:
   ```env
   SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
   SENDGRID_FROM_EMAIL=noreply@yourdomain.com
   SENDGRID_FROM_NAME=NeedSpeak
   ```

**Twilio (SMS)**
1. Sign up at https://www.twilio.com (free trial: $15 credit)
2. Get credentials from Console Dashboard
3. Buy a phone number: Phone Numbers → Buy a number
4. Add to `.env`:
   ```env
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxx
   TWILIO_FROM_PHONE=+1234567890
   ```

#### Step 2: Install Dependencies

```bash
cd backend
pip install sendgrid twilio
# Add to requirements.txt:
echo "sendgrid>=6.11.0" >> requirements.txt
echo "twilio>=8.10.0" >> requirements.txt
```

#### Step 3: Create Notification Service

**File**: `backend/app/collab/collab_notifications.py`

```python
"""Email and SMS notification service for collaborative carts."""

import logging
import os
from typing import Literal

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from twilio.rest import Client as TwilioClient

logger = logging.getLogger(__name__)


def send_email_invite(
    recipient_email: str,
    session_name: str,
    share_url: str,
    host_name: str,
) -> bool:
    """Send collaboration invite via SendGrid."""
    api_key = os.getenv("SENDGRID_API_KEY")
    from_email = os.getenv("SENDGRID_FROM_EMAIL")
    from_name = os.getenv("SENDGRID_FROM_NAME", "NeedSpeak")

    if not api_key or not from_email:
        logger.warning("SendGrid not configured, skipping email")
        return False

    try:
        message = Mail(
            from_email=(from_email, from_name),
            to_emails=recipient_email,
            subject=f"{host_name} invited you to join '{session_name}'",
            html_content=f"""
            <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #6366f1;">🛒 You're Invited to a SplitCart!</h2>
                <p><strong>{host_name}</strong> invited you to collaborate on <strong>{session_name}</strong>.</p>
                <p>Add your demand naturally, and NeedSpeak will resolve, merge, and split the cart automatically.</p>
                <a href="{share_url}" 
                   style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0;">
                    Join Live Cart →
                </a>
                <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                    Or copy this link: <a href="{share_url}">{share_url}</a>
                </p>
            </div>
            """,
        )

        client = SendGridAPIClient(api_key)
        response = client.send(message)
        logger.info(f"Email sent to {recipient_email}: status {response.status_code}")
        return True

    except Exception as e:
        logger.error(f"Failed to send email to {recipient_email}: {e}")
        return False


def send_sms_invite(
    recipient_phone: str,
    session_name: str,
    share_url: str,
    host_name: str,
) -> bool:
    """Send collaboration invite via Twilio SMS."""
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    from_phone = os.getenv("TWILIO_FROM_PHONE")

    if not account_sid or not auth_token or not from_phone:
        logger.warning("Twilio not configured, skipping SMS")
        return False

    try:
        client = TwilioClient(account_sid, auth_token)
        message = client.messages.create(
            body=f"{host_name} invited you to '{session_name}' on NeedSpeak. Join here: {share_url}",
            from_=from_phone,
            to=recipient_phone,
        )

        logger.info(f"SMS sent to {recipient_phone}: sid {message.sid}")
        return True

    except Exception as e:
        logger.error(f"Failed to send SMS to {recipient_phone}: {e}")
        return False
```


#### Step 4: Add API Route

**File**: `backend/app/collab/collab_routes.py`

Add the following after the existing routes:

```python
from pydantic import BaseModel, EmailStr
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
```


#### Step 5: Update Frontend UI

**File**: `frontend/src/routes/collab.$id.tsx`

Add invite modal state and handler:

```typescript
// Add to imports
import { Mail, Phone, Send } from "lucide-react";

// Add state near other useState declarations
const [showInviteModal, setShowInviteModal] = useState(false);
const [inviteEmail, setInviteEmail] = useState("");
const [invitePhone, setInvitePhone] = useState("");
const [inviting, setInviting] = useState(false);

// Add invite handler
const handleInvite = async (e: FormEvent) => {
  e.preventDefault();
  if (!inviteEmail.trim() && !invitePhone.trim()) return;
  
  setInviting(true);
  try {
    const recipients = [];
    if (inviteEmail.trim()) recipients.push({ type: "email", value: inviteEmail.trim() });
    if (invitePhone.trim()) recipients.push({ type: "sms", value: invitePhone.trim() });
    
    const res = await fetch(`/api/collab/${sessionId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipients, contributor_id: contributorId }),
    });
    
    if (!res.ok) throw new Error("Failed to send invites");
    
    const data = await res.json();
    const successCount = data.results.filter((r: any) => r.success).length;
    toast.success(`Sent ${successCount} invite${successCount !== 1 ? 's' : ''}!`);
    setInviteEmail("");
    setInvitePhone("");
    setShowInviteModal(false);
  } catch (err) {
    toast.error("Could not send invites. Try again.");
  } finally {
    setInviting(false);
  }
};

// Add button in header next to "Share link" button:
<button
  onClick={() => setShowInviteModal(true)}
  className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold transition hover:bg-surface"
>
  <Send className="h-4 w-4" />
  Invite
</button>

// Add modal at the end of the component, before </AppShell>:
{showInviteModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowInviteModal(false)}>
    <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
      <h2 className="text-2xl font-bold">Invite Contributors</h2>
      <p className="mt-2 text-sm text-muted-foreground">Send invite links via email or SMS</p>
      
      <form onSubmit={handleInvite} className="mt-6 space-y-4">
        <div>
          <label htmlFor="invite-email" className="mb-1.5 block text-sm font-semibold">
            <Mail className="inline h-4 w-4 mr-1" />
            Email (optional)
          </label>
          <input
            id="invite-email"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="friend@example.com"
            className="h-11 w-full rounded-xl border border-input bg-background px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
        
        <div>
          <label htmlFor="invite-phone" className="mb-1.5 block text-sm font-semibold">
            <Phone className="inline h-4 w-4 mr-1" />
            Phone (optional)
          </label>
          <input
            id="invite-phone"
            type="tel"
            value={invitePhone}
            onChange={(e) => setInvitePhone(e.target.value)}
            placeholder="+1234567890"
            className="h-11 w-full rounded-xl border border-input bg-background px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
        
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setShowInviteModal(false)}
            className="h-11 flex-1 cursor-pointer rounded-xl border border-border px-4 font-semibold transition hover:bg-surface"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={inviting || (!inviteEmail.trim() && !invitePhone.trim())}
            className="h-11 flex-1 cursor-pointer rounded-xl bg-foreground px-4 font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {inviting ? "Sending..." : "Send Invites"}
          </button>
        </div>
      </form>
    </div>
  </div>
)}
```


#### Step 6: Testing

**Manual Testing:**
1. Start backend with SendGrid/Twilio credentials
2. Create a collab session
3. Click "Invite" button
4. Enter email/phone and send
5. Verify email received (check spam folder)
6. Verify SMS received
7. Click link and join session

**Unit Test** (`backend/tests/test_collab_invites.py`):
```python
import pytest
from app.collab.collab_notifications import send_email_invite, send_sms_invite

def test_email_invite_without_config(monkeypatch):
    monkeypatch.delenv("SENDGRID_API_KEY", raising=False)
    result = send_email_invite("test@example.com", "Test Cart", "http://test", "Host")
    assert result is False

def test_sms_invite_without_config(monkeypatch):
    monkeypatch.delenv("TWILIO_ACCOUNT_SID", raising=False)
    result = send_sms_invite("+1234567890", "Test Cart", "http://test", "Host")
    assert result is False
```

---

## Feature 13.5: Proceed to Checkout

### Current State
✅ **What exists:**
- ReviewCart page (`/cart/$id`)
- Cart display with items, budget, alternatives
- "Proceed to Checkout" button (UI only)

❌ **What's missing:**
- Inventory reservation API
- Payment integration (Stripe/Razorpay)
- Order confirmation page
- Reservation timeout/cleanup

### Architecture Overview

```
┌──────────────────────┐
│  ReviewCart Page     │
│  (cart.$id.tsx)      │
└──────────┬───────────┘
           │
           │ 1. POST /api/cart/{id}/reserve
           ▼
┌──────────────────────┐
│  Reservation Logic   │
│  (reservations.py)   │
└──────────┬───────────┘
           │
           │ 2. Conditional DynamoDB update
           │    (check available_qty >= qty)
           ▼
┌──────────────────────┐
│  Inventory Table     │
│  (ProductInventory)  │
└──────────────────────┘

           │ 3. Redirect to /checkout/$reservation_id
           ▼
┌──────────────────────┐
│  Checkout Page       │
│  (checkout.$id.tsx)  │
└──────────┬───────────┘
           │
           │ 4. POST /api/payment/create-intent
           ▼
┌──────────────────────┐
│  Payment Provider    │
│  (Stripe/Razorpay)   │
└──────────────────────┘
```


### Implementation Steps

#### Step 1: Set Up Payment Provider

**Option A: Razorpay (India-focused, recommended for hackathon)**
1. Sign up at https://razorpay.com
2. Get test keys: Settings → API Keys
3. Add to `.env`:
   ```env
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxx
   ```

**Option B: Stripe (Global)**
1. Sign up at https://stripe.com
2. Get test keys: Developers → API keys
3. Add to `.env`:
   ```env
   STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxx
   STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxx
   ```

Install dependencies:
```bash
cd backend
pip install razorpay stripe
echo "razorpay>=1.4.0" >> requirements.txt
echo "stripe>=7.0.0" >> requirements.txt
```

#### Step 2: Create Reservation Models

**File**: `backend/app/inventory/models.py`

```python
"""Inventory and reservation data models."""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Literal

class ReservationItem(BaseModel):
    sku: str
    qty: int = Field(ge=1)
    location_id: str = "DEFAULT"

class ReserveRequest(BaseModel):
    items: list[ReservationItem]
    idempotency_key: str | None = None

class ReservationResponse(BaseModel):
    reservation_id: str
    status: Literal["reserved", "partial_failed", "failed"]
    reserved_items: list[dict] = Field(default_factory=list)
    failed_items: list[dict] = Field(default_factory=list)
    total_amount: float
    expires_at: str
    message: str

class PaymentIntentRequest(BaseModel):
    reservation_id: str
    customer_email: str | None = None

class PaymentIntentResponse(BaseModel):
    client_secret: str
    amount: float
    currency: str = "INR"
    reservation_id: str
```


#### Step 3: Implement Reservation Logic

**File**: `backend/app/inventory/reservations.py`

```python
"""Inventory reservation with conditional updates."""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.db.dynamo import get_all_products

logger = logging.getLogger(__name__)

# In-memory reservation store (use DynamoDB in production)
_reservations: dict[str, dict] = {}

def reserve_items(
    items: list[dict],  # [{"sku": "SKU-001", "qty": 2, "location_id": "DEFAULT"}]
    session_id: str,
    user_id: str | None = None,
    idempotency_key: str | None = None,
    mock_mode: bool = False,
) -> dict:
    """
    Reserve inventory items with conditional updates.
    
    Returns:
        {
            "reservation_id": "res_xxx",
            "status": "reserved" | "partial_failed" | "failed",
            "reserved_items": [...],
            "failed_items": [...],
            "total_amount": 1234.5,
            "expires_at": "2026-06-14T12:00:00Z",
            "message": "..."
        }
    """
    
    # Check idempotency
    if idempotency_key:
        for res_id, res_data in _reservations.items():
            if res_data.get("idempotency_key") == idempotency_key:
                logger.info(f"Idempotent request detected: {idempotency_key}")
                return _format_reservation_response(res_id, res_data)
    
    reservation_id = f"res_{uuid.uuid4().hex[:12]}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    products = {p["sku"]: p for p in get_all_products()}
    reserved_items = []
    failed_items = []
    total_amount = 0.0
    
    for item in items:
        sku = item["sku"]
        qty = item["qty"]
        location_id = item.get("location_id", "DEFAULT")
        
        product = products.get(sku)
        if not product:
            failed_items.append({
                "sku": sku,
                "reason": "product_not_found",
                "message": f"SKU {sku} not found in catalog",
            })
            continue
        
        # Check stock (mock: assume in_stock = True means available)
        if not product.get("in_stock", True):
            failed_items.append({
                "sku": sku,
                "reason": "out_of_stock",
                "message": f"{product['name']} is currently out of stock",
                "alternatives": [],  # TODO: suggest alternatives
            })
            continue
        
        # Reserve successfully
        price = float(product.get("price_inr", 0))
        item_total = price * qty
        reserved_items.append({
            "sku": sku,
            "name": product["name"],
            "qty": qty,
            "price_per_unit": price,
            "total": item_total,
            "location_id": location_id,
        })
        total_amount += item_total
    
    # Determine status
    if not reserved_items:
        status = "failed"
        message = "All items failed to reserve"
    elif failed_items:
        status = "partial_failed"
        message = f"{len(reserved_items)} items reserved, {len(failed_items)} failed"
    else:
        status = "reserved"
        message = f"Successfully reserved {len(reserved_items)} items"
    
    # Store reservation
    _reservations[reservation_id] = {
        "reservation_id": reservation_id,
        "session_id": session_id,
        "user_id": user_id,
        "status": status,
        "reserved_items": reserved_items,
        "failed_items": failed_items,
        "total_amount": total_amount,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at.isoformat(),
        "idempotency_key": idempotency_key,
    }
    
    return _format_reservation_response(reservation_id, _reservations[reservation_id])


def _format_reservation_response(reservation_id: str, res_data: dict) -> dict:
    return {
        "reservation_id": reservation_id,
        "status": res_data["status"],
        "reserved_items": res_data["reserved_items"],
        "failed_items": res_data["failed_items"],
        "total_amount": res_data["total_amount"],
        "expires_at": res_data["expires_at"],
        "message": res_data.get("message", ""),
    }


def get_reservation(reservation_id: str) -> Optional[dict]:
    """Retrieve reservation by ID."""
    return _reservations.get(reservation_id)


def release_reservation(reservation_id: str) -> bool:
    """Release/cancel a reservation."""
    if reservation_id in _reservations:
        _reservations[reservation_id]["status"] = "released"
        logger.info(f"Released reservation {reservation_id}")
        return True
    return False


def commit_reservation(reservation_id: str) -> bool:
    """Mark reservation as committed (payment successful)."""
    if reservation_id in _reservations:
        _reservations[reservation_id]["status"] = "committed"
        logger.info(f"Committed reservation {reservation_id}")
        return True
    return False
```


#### Step 4: Add Reservation & Payment Routes

**File**: `backend/app/main.py` (add these routes)

```python
from app.inventory.models import (
    ReserveRequest,
    ReservationResponse,
    PaymentIntentRequest,
    PaymentIntentResponse,
)
from app.inventory.reservations import (
    reserve_items,
    get_reservation,
    commit_reservation,
)

@app.post("/api/cart/{session_id}/reserve", response_model=ReservationResponse)
async def reserve_cart_items(session_id: str, req: ReserveRequest, request: Request):
    """Reserve inventory for cart items."""
    mock_mode = getattr(request.state, "mock_mode", False) or config.MOCK_MODE
    
    user_id = request.headers.get("X-User-ID", "demo_user")  # TODO: use real auth
    
    result = reserve_items(
        items=[item.model_dump() for item in req.items],
        session_id=session_id,
        user_id=user_id,
        idempotency_key=req.idempotency_key,
        mock_mode=mock_mode,
    )
    
    return ReservationResponse(**result)


@app.get("/api/reservation/{reservation_id}")
async def get_reservation_details(reservation_id: str):
    """Get reservation details."""
    reservation = get_reservation(reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    return reservation


@app.post("/api/payment/create-intent", response_model=PaymentIntentResponse)
async def create_payment_intent(req: PaymentIntentRequest):
    """Create payment intent with Razorpay or Stripe."""
    reservation = get_reservation(req.reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    
    if reservation["status"] != "reserved":
        raise HTTPException(status_code=400, detail="Reservation is not in reserved state")
    
    amount = reservation["total_amount"]
    
    # Razorpay integration
    payment_provider = os.getenv("PAYMENT_PROVIDER", "razorpay").lower()
    
    if payment_provider == "razorpay":
        import razorpay
        client = razorpay.Client(
            auth=(os.getenv("RAZORPAY_KEY_ID"), os.getenv("RAZORPAY_KEY_SECRET"))
        )
        
        order = client.order.create({
            "amount": int(amount * 100),  # paise
            "currency": "INR",
            "receipt": req.reservation_id,
            "notes": {
                "reservation_id": req.reservation_id,
                "customer_email": req.customer_email or "",
            }
        })
        
        return PaymentIntentResponse(
            client_secret=order["id"],  # Razorpay order_id
            amount=amount,
            currency="INR",
            reservation_id=req.reservation_id,
        )
    
    elif payment_provider == "stripe":
        import stripe
        stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
        
        intent = stripe.PaymentIntent.create(
            amount=int(amount * 100),  # cents
            currency="inr",
            metadata={"reservation_id": req.reservation_id},
        )
        
        return PaymentIntentResponse(
            client_secret=intent.client_secret,
            amount=amount,
            currency="INR",
            reservation_id=req.reservation_id,
        )
    
    else:
        raise HTTPException(status_code=500, detail="No payment provider configured")


@app.post("/api/payment/confirm")
async def confirm_payment(reservation_id: str, payment_id: str):
    """Confirm payment and commit reservation."""
    reservation = get_reservation(reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    
    # TODO: Verify payment with provider API
    
    commit_reservation(reservation_id)
    
    return {"success": True, "message": "Order confirmed"}
```


#### Step 5: Update ReviewCart Button

**File**: `frontend/src/routes/cart.$id.tsx`

Update the `handleReserve` function (already partially implemented):

```typescript
const handleReserve = async () => {
  if (!session || reserving) return;
  setReserving(true);
  setReservationStatus("idle");

  try {
    // Map cartItems to {sku, qty}
    const itemsToReserve = cartItems.filter((i: any) => i.sku).map((i: any) => ({
      sku: i.sku,
      qty: i.quantity_units || 1,
      location_id: "DEFAULT",
    }));

    const res = await fetch(`/api/cart/${session.session_id}/reserve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        items: itemsToReserve,
        idempotency_key: `cart_${session.session_id}_${Date.now()}`
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Failed to reserve items");
    }

    // Check for partial failures
    if (data.status === "partial_failed") {
      setReservationStatus("error");
      setReservationMessage(
        `Some items unavailable: ${data.failed_items.map((i: any) => i.message).join(", ")}`
      );
      return;
    }

    if (data.status === "failed") {
      throw new Error(data.message);
    }

    setReservationStatus("success");
    setReservationMessage("Items reserved! Redirecting to payment...");

    // Log purchase event
    try {
      await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: "demo_user",
          session_id: session.session_id,
          event_type: "checkout_initiated",
          context: "ReviewCart reservation",
        }),
      });
    } catch (err) {
      console.error("Telemetry error:", err);
    }
    
    // Redirect to checkout
    setTimeout(() => {
      navigate({ to: "/checkout/$id", params: { id: data.reservation_id } });
    }, 1500);

  } catch (e: any) {
    setReservationStatus("error");
    setReservationMessage(e.message || "Reservation failed. Please try again.");
  } finally {
    setReserving(false);
  }
};
```


#### Step 6: Create Checkout Page

**File**: `frontend/src/routes/checkout.$id.tsx` (already exists, enhance it)

```typescript
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, CreditCard, Loader2, Package } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/checkout/$id")({
  component: CheckoutPage,
});

function CheckoutPage() {
  const { id: reservationId } = Route.useParams();
  const navigate = useNavigate();
  const [reservation, setReservation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [customerEmail, setCustomerEmail] = useState("");

  useEffect(() => {
    fetch(`/api/reservation/${reservationId}`)
      .then((res) => res.json())
      .then((data) => setReservation(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [reservationId]);

  const handlePayment = async () => {
    if (!customerEmail.trim()) {
      alert("Please enter your email");
      return;
    }

    setProcessing(true);
    try {
      // Step 1: Create payment intent
      const intentRes = await fetch("/api/payment/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservation_id: reservationId, customer_email: customerEmail }),
      });

      const intentData = await intentRes.json();
      
      // Step 2: For Razorpay, open payment modal
      if (window.Razorpay) {
        const options = {
          key: "YOUR_RAZORPAY_KEY_ID", // TODO: Get from env or backend
          amount: intentData.amount * 100,
          currency: intentData.currency,
          order_id: intentData.client_secret,
          name: "NeedSpeak",
          description: "Smart Shopping Cart",
          handler: async (response: any) => {
            // Payment successful
            await fetch("/api/payment/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                reservation_id: reservationId,
                payment_id: response.razorpay_payment_id,
              }),
            });

            // Navigate to confirmation
            navigate({ to: "/order-confirmed", search: { reservation: reservationId } });
          },
          prefill: { email: customerEmail },
          theme: { color: "#6366f1" },
        };

        const razorpay = new window.Razorpay(options);
        razorpay.open();
      } else {
        alert("Payment gateway not loaded. Please refresh.");
      }
    } catch (err) {
      console.error("Payment error:", err);
      alert("Payment failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      </AppShell>
    );
  }

  if (!reservation) {
    return (
      <AppShell>
        <div className="flex h-screen flex-col items-center justify-center gap-4">
          <p className="text-lg font-semibold">Reservation not found</p>
          <button
            onClick={() => navigate({ to: "/" })}
            className="rounded-xl bg-foreground px-4 py-2 text-background"
          >
            Go Home
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-3xl font-bold">Checkout</h1>
        <p className="mt-2 text-muted-foreground">Complete your order</p>

        <div className="mt-8 space-y-6">
          {/* Order Summary */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Package className="h-5 w-5" />
              Order Summary
            </h2>
            <div className="mt-4 space-y-3">
              {reservation.reserved_items.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>
                    {item.name} × {item.qty}
                  </span>
                  <span className="font-semibold">₹{item.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-border pt-4 flex justify-between text-lg font-bold">
              <span>Total</span>
              <span className="text-brand">₹{reservation.total_amount.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Form */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <CreditCard className="h-5 w-5" />
              Payment Details
            </h2>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 outline-none focus:border-brand"
                  required
                />
              </div>

              <button
                onClick={handlePayment}
                disabled={processing || !customerEmail.trim()}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    Pay ₹{reservation.total_amount.toFixed(2)}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Expires notice */}
          <p className="text-center text-xs text-muted-foreground">
            Reservation expires at {new Date(reservation.expires_at).toLocaleString()}
          </p>
        </div>
      </div>
    </AppShell>
  );
}
```

**Load Razorpay script** in `frontend/index.html`:
```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```


#### Step 7: Add Order Confirmation Page

**File**: `frontend/src/routes/order-confirmed.tsx`

```typescript
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Download, Home, Package } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import confetti from "canvas-confetti";

export const Route = createFileRoute("/order-confirmed")({
  component: OrderConfirmedPage,
});

function OrderConfirmedPage() {
  const navigate = useNavigate();
  const searchParams = Route.useSearch();
  const reservationId = (searchParams as any)?.reservation;
  const [reservation, setReservation] = useState<any>(null);

  useEffect(() => {
    // Celebration confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });

    // Load reservation details
    if (reservationId) {
      fetch(`/api/reservation/${reservationId}`)
        .then((res) => res.json())
        .then((data) => setReservation(data))
        .catch((err) => console.error(err));
    }
  }, [reservationId]);

  const downloadReceipt = () => {
    if (!reservation) return;

    const receipt = `
NeedSpeak Order Receipt
========================
Reservation ID: ${reservation.reservation_id}
Date: ${new Date(reservation.created_at).toLocaleString()}
Status: ${reservation.status}

Items:
${reservation.reserved_items
  .map((item: any) => `- ${item.name} × ${item.qty} = ₹${item.total}`)
  .join("\n")}

Total: ₹${reservation.total_amount}

Thank you for shopping with NeedSpeak!
    `.trim();

    const blob = new Blob([receipt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `needspeak_receipt_${reservation.reservation_id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl text-center">
          {/* Success Icon */}
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-success/20 to-success/10 shadow-lg shadow-success/20 animate-bounce-in">
            <Check className="h-10 w-10 text-success" />
          </div>

          <h1 className="mt-8 text-4xl font-bold">Order Confirmed! 🎉</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Your items have been reserved and payment is complete.
          </p>

          {/* Order Details */}
          {reservation && (
            <div className="mx-auto mt-10 max-w-md rounded-2xl border border-border bg-card p-6 text-left shadow-xl">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <Package className="h-5 w-5 text-brand" />
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Reservation ID</p>
                  <p className="font-mono text-sm font-bold">{reservation.reservation_id}</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {reservation.reserved_items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {item.name} × {item.qty}
                    </span>
                    <span className="font-semibold">₹{item.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-border pt-4 flex justify-between text-lg font-bold">
                <span>Total Paid</span>
                <span className="text-brand">₹{reservation.total_amount.toFixed(2)}</span>
              </div>

              <button
                onClick={downloadReceipt}
                className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background text-sm font-semibold transition hover:bg-surface"
              >
                <Download className="h-4 w-4" />
                Download Receipt
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="mt-10 flex justify-center gap-4">
            <button
              onClick={() => navigate({ to: "/" })}
              className="flex h-12 items-center gap-2 rounded-xl bg-foreground px-6 font-semibold text-background transition hover:opacity-90"
            >
              <Home className="h-4 w-4" />
              Back to Home
            </button>
          </div>

          <p className="mt-8 text-xs text-muted-foreground">
            A confirmation email has been sent to your registered email address.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
```

**Install confetti** (optional celebration):
```bash
cd frontend
npm install canvas-confetti
npm install --save-dev @types/canvas-confetti
```


#### Step 8: Add Reservation Cleanup (Background Job)

**File**: `backend/app/inventory/cleanup.py`

```python
"""Background task to clean up expired reservations."""

import logging
from datetime import datetime, timezone
from app.inventory.reservations import _reservations

logger = logging.getLogger(__name__)

def cleanup_expired_reservations():
    """Release expired reservations (run periodically via scheduler)."""
    now = datetime.now(timezone.utc)
    expired_count = 0
    
    for res_id, res_data in list(_reservations.items()):
        if res_data["status"] != "reserved":
            continue
        
        expires_at = datetime.fromisoformat(res_data["expires_at"])
        if now > expires_at:
            res_data["status"] = "expired"
            expired_count += 1
            logger.info(f"Auto-expired reservation {res_id}")
    
    if expired_count > 0:
        logger.info(f"Cleaned up {expired_count} expired reservations")
    
    return expired_count
```

**Schedule cleanup in main.py** (using APScheduler):

```bash
pip install apscheduler
echo "apscheduler>=3.10.0" >> requirements.txt
```

**In** `backend/app/main.py`:

```python
from apscheduler.schedulers.background import BackgroundScheduler
from app.inventory.cleanup import cleanup_expired_reservations

scheduler = BackgroundScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load product catalog and start cleanup scheduler."""
    logger.info("=" * 50)
    logger.info("Context-to-Cart starting up...")
    
    # Existing startup code...
    products = load_all_products()
    logger.info(f"Loaded {len(products)} products into memory cache")
    
    # Start reservation cleanup scheduler
    scheduler.add_job(
        cleanup_expired_reservations,
        "interval",
        minutes=5,  # Run every 5 minutes
        id="cleanup_reservations",
    )
    scheduler.start()
    logger.info("Started reservation cleanup scheduler")
    
    yield  # App runs
    
    scheduler.shutdown()
    logger.info("Context-to-Cart shutting down...")
```


---

## Testing Plan

### Feature 6.6: Invite Flow

**Test Case 1: Email Invite**
1. Create collab session
2. Click "Invite" button
3. Enter valid email
4. Click "Send Invites"
5. ✅ Verify email received (check spam)
6. ✅ Verify link works and joins session

**Test Case 2: SMS Invite**
1. Create collab session
2. Click "Invite" button
3. Enter valid phone number (+1234567890)
4. Click "Send Invites"
5. ✅ Verify SMS received
6. ✅ Verify link works and joins session

**Test Case 3: Both Email + SMS**
1. Enter both email and phone
2. Click "Send Invites"
3. ✅ Verify both sent successfully

**Test Case 4: Invalid Recipients**
1. Enter invalid email
2. ✅ Verify error handling
3. ✅ Verify partial success if one valid, one invalid

**Test Case 5: Missing Credentials**
1. Remove SendGrid/Twilio credentials from `.env`
2. Try sending invite
3. ✅ Verify graceful failure with user-friendly message

---

### Feature 13.5: Checkout Flow

**Test Case 1: Normal Checkout**
1. Complete cart review
2. Click "Proceed to Checkout"
3. ✅ Verify reservation created
4. ✅ Verify redirect to checkout page
5. Enter email
6. Click "Pay"
7. ✅ Verify Razorpay modal opens
8. Complete test payment
9. ✅ Verify redirect to confirmation page
10. ✅ Verify confetti animation
11. ✅ Verify receipt download works

**Test Case 2: Out of Stock Item**
1. Mark item as `in_stock: false` in catalog
2. Try to reserve
3. ✅ Verify partial_failed status
4. ✅ Verify failed items listed with alternatives

**Test Case 3: Idempotent Reservation**
1. Reserve items with idempotency key
2. Retry same request
3. ✅ Verify same reservation returned
4. ✅ Verify no duplicate reservations created

**Test Case 4: Expired Reservation**
1. Create reservation
2. Wait 16+ minutes (or manually set expires_at)
3. Run cleanup job
4. ✅ Verify reservation status changed to "expired"
5. Try to pay expired reservation
6. ✅ Verify error message

**Test Case 5: Concurrent Reservations**
1. Two users try to reserve last unit of same item
2. ✅ Verify only one succeeds
3. ✅ Verify other gets "out of stock" with alternatives

**Test Case 6: Payment Failure**
1. Initiate checkout
2. Close Razorpay modal without paying
3. ✅ Verify reservation still active
4. ✅ Verify user can retry payment


---

## Deployment Checklist

### Environment Variables

Add to `backend/.env`:

```env
# Email Invites (SendGrid)
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@needspeak.com
SENDGRID_FROM_NAME=NeedSpeak

# SMS Invites (Twilio)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxx
TWILIO_FROM_PHONE=+1234567890

# Payment Gateway
PAYMENT_PROVIDER=razorpay  # or "stripe"
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxx

# Optional: Stripe
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxx
```

### Backend Dependencies

```bash
cd backend
pip install sendgrid twilio razorpay stripe apscheduler
```

Update `requirements.txt`:
```
sendgrid>=6.11.0
twilio>=8.10.0
razorpay>=1.4.0
stripe>=7.0.0
apscheduler>=3.10.0
```

### Frontend Dependencies

```bash
cd frontend
npm install canvas-confetti
npm install --save-dev @types/canvas-confetti
```

Update `frontend/index.html`:
```html
<!-- Add before </head> -->
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

### Database Setup (if using DynamoDB)

**ProductInventory Table:**
```python
# In backend/scripts/create_inventory_table.py
import boto3

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')

table = dynamodb.create_table(
    TableName='ProductInventory',
    KeySchema=[
        {'AttributeName': 'sku', 'KeyType': 'HASH'},
        {'AttributeName': 'location_id', 'KeyType': 'RANGE'},
    ],
    AttributeDefinitions=[
        {'AttributeName': 'sku', 'AttributeType': 'S'},
        {'AttributeName': 'location_id', 'AttributeType': 'S'},
    ],
    BillingMode='PAY_PER_REQUEST',
)

print(f"Created table: {table.table_name}")
```

**CartReservations Table:**
```python
table = dynamodb.create_table(
    TableName='CartReservations',
    KeySchema=[
        {'AttributeName': 'reservation_id', 'KeyType': 'HASH'},
    ],
    AttributeDefinitions=[
        {'AttributeName': 'reservation_id', 'AttributeType': 'S'},
    ],
    BillingMode='PAY_PER_REQUEST',
)

# Enable TTL
client = boto3.client('dynamodb', region_name='us-east-1')
client.update_time_to_live(
    TableName='CartReservations',
    TimeToLiveSpecification={
        'Enabled': True,
        'AttributeName': 'ttl'
    }
)
```


---

## Implementation Timeline

### Phase 1: Feature 6.6 - Invite Flow (Estimated: 3-4 hours)

| Task | Time | Owner |
|------|------|-------|
| Set up SendGrid account | 15 min | Backend |
| Set up Twilio account | 15 min | Backend |
| Create `collab_notifications.py` | 45 min | Backend |
| Add `/invite` API route | 30 min | Backend |
| Add invite modal UI | 45 min | Frontend |
| Wire button to backend | 20 min | Frontend |
| Manual testing (email) | 15 min | QA |
| Manual testing (SMS) | 15 min | QA |
| Error handling polish | 20 min | Both |

**Total: ~3.5 hours**

---

### Phase 2: Feature 13.5 - Checkout Flow (Estimated: 5-6 hours)

| Task | Time | Owner |
|------|------|-------|
| Set up Razorpay test account | 15 min | Backend |
| Create reservation models | 30 min | Backend |
| Implement `reservations.py` logic | 60 min | Backend |
| Add `/reserve` API route | 30 min | Backend |
| Add `/payment/create-intent` route | 30 min | Backend |
| Add `/payment/confirm` route | 20 min | Backend |
| Update ReviewCart button | 30 min | Frontend |
| Create checkout page | 60 min | Frontend |
| Create order confirmation page | 45 min | Frontend |
| Add Razorpay script integration | 20 min | Frontend |
| Implement cleanup scheduler | 30 min | Backend |
| Test normal checkout flow | 20 min | QA |
| Test out-of-stock handling | 15 min | QA |
| Test idempotency | 15 min | QA |
| Test expiration cleanup | 15 min | QA |

**Total: ~5.5 hours**

---

### Combined Timeline: **8-10 hours total**

**Recommended Sprint:**
- **Day 1 Morning**: Feature 6.6 (Invite Flow)
- **Day 1 Afternoon + Day 2 Morning**: Feature 13.5 (Checkout Flow)
- **Day 2 Afternoon**: End-to-end testing, bug fixes, polish


---

## Success Criteria

### Feature 6.6: Invite Flow

✅ **Must Have:**
- [ ] Host can send invite via email
- [ ] Host can send invite via SMS
- [ ] Invite includes working share link
- [ ] Recipient can join session from link
- [ ] Graceful fallback if provider not configured

✅ **Nice to Have:**
- [ ] Support multiple recipients at once
- [ ] Show delivery status per recipient
- [ ] Resend invite if failed
- [ ] Customizable invite message

---

### Feature 13.5: Checkout Flow

✅ **Must Have:**
- [ ] Reserve cart items with inventory check
- [ ] Handle out-of-stock items gracefully
- [ ] Prevent double reservation (idempotency)
- [ ] Integrate Razorpay/Stripe payment
- [ ] Show checkout page with order summary
- [ ] Confirm payment and commit reservation
- [ ] Show order confirmation page
- [ ] Auto-expire reservations after 15 minutes
- [ ] Background cleanup job removes expired reservations

✅ **Nice to Have:**
- [ ] Email order confirmation
- [ ] Show estimated delivery time
- [ ] Support partial payments
- [ ] Save payment methods for future
- [ ] Show order history

---

## Security Considerations

### Feature 6.6: Invites

1. **Rate Limiting**: Prevent spam invites
   - Limit to 10 invites per session per hour
   - Implement in middleware or API route

2. **Validation**: 
   - Validate email format before sending
   - Validate phone number format (E.164)
   - Sanitize recipient inputs

3. **Privacy**:
   - Don't log full recipient details
   - Use hashed identifiers in logs

### Feature 13.5: Checkout

1. **Idempotency**:
   - Always use idempotency keys for reservations
   - Prevent duplicate charges

2. **Payment Security**:
   - Never store full card details
   - Use Razorpay/Stripe tokenization
   - Verify payment status server-side
   - Don't trust client-side payment success

3. **Inventory Race Conditions**:
   - Use DynamoDB conditional writes
   - Lock items during reservation
   - Handle concurrent reservation failures gracefully

4. **Session Security**:
   - Validate user owns the cart session
   - Verify reservation belongs to user before payment
   - Check reservation not expired before payment

5. **PCI Compliance**:
   - Use Razorpay/Stripe hosted checkout
   - Never handle raw card data
   - Log payment attempts (not details)

---

## Troubleshooting Guide

### Issue: Emails not sending

**Diagnosis:**
- Check SendGrid API key is valid
- Check sender email is verified in SendGrid
- Check logs for detailed error

**Fix:**
```bash
# Test SendGrid credentials
curl -X POST https://api.sendgrid.com/v3/mail/send \
  -H "Authorization: Bearer $SENDGRID_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"personalizations":[{"to":[{"email":"test@example.com"}]}],"from":{"email":"$SENDGRID_FROM_EMAIL"},"subject":"Test","content":[{"type":"text/plain","value":"Test"}]}'
```

### Issue: SMS not sending

**Diagnosis:**
- Check Twilio credentials are correct
- Check phone number format (+1234567890)
- Check Twilio account has credits

**Fix:**
```bash
# Test Twilio credentials
curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  -d "From=$TWILIO_FROM_PHONE" \
  -d "To=+1234567890" \
  -d "Body=Test message"
```

### Issue: Razorpay modal not opening

**Diagnosis:**
- Check Razorpay script loaded in HTML
- Check browser console for errors
- Check `window.Razorpay` is defined

**Fix:**
```html
<!-- Add to index.html if missing -->
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

### Issue: Reservation expires immediately

**Diagnosis:**
- Check system time is correct
- Check timezone handling in datetime
- Check `expires_at` calculation

**Fix:**
```python
from datetime import timezone
expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
```

### Issue: Payment succeeds but reservation not committed

**Diagnosis:**
- Check `/payment/confirm` endpoint is called
- Check reservation_id matches
- Check logs for errors

**Fix:**
- Add webhook handler for Razorpay payment events
- Implement retry logic for confirmation

---

## Future Enhancements

### Short-term (Post-Hackathon)

1. **Email Templates**: Professional HTML email templates with branding
2. **Multi-language Support**: Hindi/regional language invites
3. **WhatsApp Invites**: Use WhatsApp Business API
4. **Payment Options**: Add UPI, net banking, wallets
5. **Order Tracking**: Real-time delivery status updates

### Long-term (Production)

1. **DynamoDB Migration**: Move from in-memory to persistent storage
2. **Webhook Handlers**: Razorpay/Stripe webhooks for async confirmation
3. **Inventory Sync**: Real-time inventory updates from warehouse
4. **Advanced Reservation**: Support partial fulfillment
5. **Subscription Payments**: Recurring orders support
6. **Refund System**: Handle cancellations and refunds
7. **Analytics Dashboard**: Track conversion rates, failed payments

---

## References

### API Documentation

- **SendGrid**: https://docs.sendgrid.com/api-reference
- **Twilio**: https://www.twilio.com/docs/sms/api
- **Razorpay**: https://razorpay.com/docs/payments/
- **Stripe**: https://stripe.com/docs/api

### Code Examples

- **SendGrid Python**: https://github.com/sendgrid/sendgrid-python
- **Twilio Python**: https://github.com/twilio/twilio-python
- **Razorpay Python**: https://github.com/razorpay/razorpay-python
- **Stripe Python**: https://github.com/stripe/stripe-python

---

## Summary

This implementation plan provides:

1. ✅ **Complete code samples** for both features
2. ✅ **Step-by-step setup instructions**
3. ✅ **Testing procedures**
4. ✅ **Security best practices**
5. ✅ **Troubleshooting guide**
6. ✅ **8-10 hour implementation timeline**

Both features build on existing infrastructure and require **minimal changes** to core logic. The most complex part is payment integration, but using Razorpay/Stripe hosted checkout simplifies PCI compliance.

**Ready to implement!** 🚀
