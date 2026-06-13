#!/usr/bin/env python3
"""Quick test of the V2 retrieval + ranking pipeline."""

import sys
sys.path.insert(0, ".")

from dotenv import load_dotenv
load_dotenv()

from app.models import ExtractedItem
from app.pipeline.resolver import resolve_cart

# Simulate items extracted by LLM (biryani recipe)
items = [
    ExtractedItem(name="basmati rice", quantity=1000, unit="g", category="grains"),
    ExtractedItem(name="chicken", quantity=500, unit="g", category="meat_poultry"),
    ExtractedItem(name="onion", quantity=500, unit="g", category="vegetables"),
    ExtractedItem(name="curd yogurt", quantity=200, unit="g", category="dairy"),
    ExtractedItem(name="ghee", quantity=100, unit="ml", category="dairy"),
    ExtractedItem(name="biryani masala", quantity=50, unit="g", category="spices"),
]

print("=" * 60)
print("Testing V2 Pipeline: Biryani Recipe (6 items)")
print("=" * 60)

cart_items, unavailable, total_price, budget_exceeded = resolve_cart(
    items=items,
    budget_inr=2000,
    session_id="test-session-001",
    mock_mode=True,
    dietary_pref=None,
    preferred_brands=["Amul"],
    avoided_brands=[],
    budget_mode="balanced",
    occasion="biryani",
)

print(f"\n✅ Cart Items: {len(cart_items)}")
print(f"❌ Unavailable: {len(unavailable)}")
print(f"💰 Total: ₹{total_price:.0f}")
print(f"📊 Budget exceeded: {budget_exceeded}")

print("\n--- Cart Details ---")
for i, item in enumerate(cart_items, 1):
    print(f"{i}. {item.name} ({item.brand})")
    print(f"   SKU: {item.sku} | Qty: {item.quantity_units} x {item.unit}")
    print(f"   Price: ₹{item.price_per_unit_inr} x {item.quantity_units} = ₹{item.total_price_inr}")
    print(f"   Reason: {item.display_reason}")
    print(f"   Codes: {item.reason_codes}")
    if item.alternatives:
        print(f"   Alternatives: {len(item.alternatives)}")
        for alt in item.alternatives[:2]:
            print(f'     → {alt["name"]} ({alt["brand"]}) ₹{alt["total_price_inr"]}')
    print()

if unavailable:
    print("--- Unavailable Items ---")
    for u in unavailable:
        print(f"  ❌ {u.name}: {u.reason.value}")

print("\n✅ V2 Pipeline test complete!")
