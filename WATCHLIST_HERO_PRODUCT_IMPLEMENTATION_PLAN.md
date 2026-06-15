# Watchlist Hero Product Implementation Plan

## Prime Directive

Price Guardian / Watchlist is the hero product. The demo must feel reliable, full, and seamless from the first click:

- Adding a product to watch must always create or reuse the correct watch.
- Watchlist must always show rich backend-backed data, never an empty or broken state.
- Price history graphs must always have data.
- Notification, email simulation, and alert status must stay consistent.
- Checkout price-status dots must be backed by stable data so green/yellow/red indicators are visible wherever the frontend already renders them.

## Non-Negotiable Boundaries

Do not change or refactor:

- Pillar One / Intent Engine: parsing, extraction, resolver, ranking, preference application, and cart generation logic.
- Collaborative cart sockets: WebSocket routes, socket payload contracts, realtime sync, contributor state, and collaborative cart session mechanics.
- The polished Watchlist frontend UI unless a tiny wiring fix is absolutely required to consume backend fields already expected by the UI.

Allowed work:

- Watchlist backend module.
- Watchlist store/data contracts.
- Price-status metadata endpoints.
- Checkout/reservation/order-summary metadata enrichment, only if it does not alter checkout payment logic.
- Tests, smoke scripts, seed/demo data, and documentation.

## Current Risk To Fix

1. A user can add a watch but not see it if frontend and backend disagree on `user_id`.
2. Added watches can be duplicated if the same SKU is watched repeatedly.
3. Newly added watches must always include 30-day history so graphs render instantly.
4. Demo data must be seeded from backend, not frontend mock overrides.
5. Three checkout dots are visually expected but need a reliable backend/status source.
6. Notification events must be deduped and consistent across toast, bell, and email simulation.

## Target Backend Contract

### Watch Object

Every watch returned by `/api/watchlist/{user_id}` must include:

- `watch_id`
- `sku`
- `name`
- `brand`
- `current_price_inr`
- `target_price_inr`
- `status`
- `price_history`: always at least 30 points
- `competitor_price_inr`
- `competitor_source`
- `neighbor_match`
- `email`
- `email_sent`
- `price_status`

### Price Status Object

Add this shape wherever possible without changing Pillar One:

```json
{
  "status": "best" | "fair" | "high",
  "color_key": "green" | "yellow" | "red",
  "label": "Best in 30 days",
  "explanation": "Current price is near the 30-day low",
  "confidence": 92,
  "thirty_day_low_inr": 1199,
  "thirty_day_high_inr": 1499,
  "current_price_inr": 1199
}
```

This lets the existing frontend render visible green/yellow/red dots without inventing state locally.

## Phase 1: Backend Watch Add Must Be Idempotent

Modify `backend/app/watchlist/watch_store.py`:

- Add `find_watch_by_sku(user_id, sku)`.
- Update `create_watch(...)` so repeated add for same `user_id + sku` returns the existing watch instead of creating duplicates.
- If the existing watch is returned, update optional fields only when the new request adds useful data:
  - `email`
  - `target_price_inr`
  - `competitor_price_inr`
  - `competitor_source`
- Preserve existing `watch_id` and `price_history`.
- Ensure every new watch gets deterministic 30-day history immediately.

Acceptance:

- POST same watch twice returns one logical watch.
- GET list count does not increase on duplicate add.
- Added item appears under the same `user_id` immediately.

## Phase 2: Backend Seeding Must Be Demo-Proof

Modify `backend/app/watchlist/watch_store.py`:

- Keep `seed_demo_data(user_id)` on first fetch for any user.
- Ensure seeded records include:
  - at least 6 watches
  - 30-day `price_history`
  - at least 1 `neighbor_match`
  - at least 2 price drop / already cheaper items
  - at least 3 email-ready alerts
- Ensure seeding never overwrites user-added watches.
- Ensure seeding never duplicates seeded SKUs on repeated fetch.

Acceptance:

- Fresh user always sees at least 6 watches.
- Every watch has graph-ready history.
- User-added watches remain at top or otherwise clearly included.

## Phase 3: Price Status Service For Three Dots

Add backend-only status logic under `backend/app/watchlist/price_status.py`:

- `get_price_status_for_item(sku, current_price_inr, history=None)`
- `get_price_status_batch(items)`
- Deterministic fallback based on SKU and current price when no watch exists.
- Prefer real watch history when SKU is watched.

Rules:

- Green: current price is in bottom 10-15 percent of 30-day range.
- Yellow: current price is in middle range.
- Red: current price is in top 10-15 percent of range.
- Always return stable status for same SKU and price.

Do not call or change the resolver/ranker/Pillar One.

Acceptance:

- Any SKU can receive green/yellow/red.
- Watched SKUs use real 30-day history.
- Non-watched cart SKUs still get deterministic demo status.

## Phase 4: Price Status API For Existing Frontend Dots

Add routes in `backend/app/watchlist/watch_routes.py`:

- `POST /api/watchlist/price-status`
  - body: `{ "sku": "...", "current_price_inr": 1234, "user_id": "..." }`
  - returns one `price_status`.
- `POST /api/watchlist/price-status/batch`
  - body: `{ "user_id": "...", "items": [{ "sku": "...", "current_price_inr": 1234 }] }`
  - returns `{ "items": [{ "sku": "...", "price_status": {...} }] }`

These endpoints are safe for cart, checkout, and payment pages to consume without altering checkout logic.

Acceptance:

- Batch endpoint returns status for every input item.
- Endpoint does not fail when SKU is unknown.
- Endpoint does not mutate cart, checkout, reservations, or sockets.

## Phase 5: Checkout Dot Integration Contract

No visual/frontend redesign.

Backend/support expectation:

- Existing cart/checkout dot UI should consume `price_status.color_key` or equivalent.
- If frontend already has dot rendering but dots are invisible, confirm the dot receives one of:
  - `green`
  - `yellow`
  - `red`
- If the existing frontend expects different keys, add a compatibility adapter in the API response rather than changing UI style.

Compatibility fields to include:

```json
{
  "deal_status": "best" | "fair" | "high",
  "deal_color": "green" | "yellow" | "red",
  "deal_label": "Best in 30 days"
}
```

Acceptance:

- ReviewCart item has a dot status source.
- Checkout summary item has a dot status source.
- Payment/order summary item has a dot status source if the frontend displays those items.
- No payment/reservation behavior changes.

## Phase 6: Seamless Watch Flow

End-to-end expected flow:

1. User opens cart.
2. User clicks Watch on item.
3. Frontend sends current user id, SKU, name, price, target, competitor text/screenshot, and optional email.
4. Backend creates or updates watch idempotently.
5. Backend returns full watch with 30-day history and current status.
6. Watchlist fetch shows the item immediately.
7. Simulate next day appends a history point and emits events.
8. Events feed notification bell and email simulation.

Acceptance:

- No refresh needed after add if frontend store already inserts returned watch.
- Refresh still works because backend source of truth includes the new watch.
- Duplicate add never creates confusing duplicates.

## Phase 7: Notification And Email Demo Reliability

Backend:

- Keep `/api/watchlist/demo-events`.
- Add stable event ids.
- Mark email simulation result in event payload.
- Never fail simulation only because SendGrid credentials are missing.

Frontend/store:

- Dedup notifications by id.
- Demo events should appear once.
- Simulated events should appear each time they are truly new.

Acceptance:

- Bell has 2-3 demo notifications on first watchlist load.
- Simulate next day can add new alerts.
- Missing API keys do not break the demo.

## Phase 8: Backend Tests

Create focused tests under `backend/app/watchlist/tests/`:

- `test_seed_demo_data_for_new_user`
- `test_create_watch_has_30_day_history`
- `test_create_watch_is_idempotent_by_user_and_sku`
- `test_price_status_unknown_sku_returns_status`
- `test_price_status_batch_returns_all_items`
- `test_simulate_appends_history`
- `test_demo_events_are_stable`

Do not test Pillar One internals or collaborative sockets here.

## Phase 9: Manual Demo Script

Before the final demo:

1. Start backend.
2. Start frontend.
3. Login or use demo user.
4. Open Watchlist.
5. Confirm at least 6 watches and graphs.
6. Click Add Demo Watch.
7. Confirm a new watch appears with a graph.
8. Click Simulate Next Day.
9. Confirm histories lengthen and alerts update.
10. Open notification bell.
11. Confirm Price Guardian notifications.
12. Build a cart using normal Pillar One flow.
13. Confirm ReviewCart shows green/yellow/red dot statuses.
14. Proceed checkout.
15. Confirm dot statuses persist in checkout summary.
16. Confirm collaborative cart still works separately.

## Final Definition Of Done

This hero product is demo-ready only when:

- Backend watch add is idempotent.
- Watchlist is backend-backed and never empty.
- Added watches show immediately and after refresh.
- Every watch has a graph.
- Simulation works repeatedly.
- Demo notifications are present and deduped.
- Three-dot price status has a backend contract and batch endpoint.
- Checkout/payment logic is not changed.
- Pillar One remains untouched.
- Collaborative sockets remain untouched.
- Automated watchlist backend tests pass.
- Frontend build passes.

