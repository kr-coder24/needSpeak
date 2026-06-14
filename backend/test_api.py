"""Quick test: hit /api/parse and print results."""
import requests, json, sys
sys.stdout.reconfigure(encoding='utf-8')

r = requests.post("http://127.0.0.1:8000/api/parse", json={
    "content": "IPL finals at my place. 10 people. Budget 1500.",
    "input_type": "text",
    "budget_inr": 1500,
})
print(f"Status: {r.status_code}")
d = r.json()

if r.status_code != 200:
    print(f"Error: {d}")
else:
    print(f"Intents: {len(d.get('intents', []))}")
    for g in d.get("intents", []):
        print(f"  [{g['intent_type']}] {g['context_summary']}")
        for i in g.get("cart", []):
            reason = i.get('display_reason', '').encode('ascii', 'replace').decode()
            print(f"    - {i['name']} x{i['quantity_units']} Rs.{i['total_price_inr']} | {reason}")
            if i.get("alternatives"):
                for alt in i["alternatives"][:2]:
                    print(f"      ALT: {alt.get('name','')} Rs.{alt.get('price_per_unit_inr','')}")
        for u in g.get("unavailable_items", []):
            print(f"    X {u['name']} ({u['reason']})")
    print(f"Total: Rs.{d.get('total_price_inr', 0)}")
    summary = d.get('summary', '').encode('ascii', 'replace').decode()
    print(f"Summary: {summary[:200]}")
    print(f"Confidence: {d.get('confidence', '')}")

# Test health
r2 = requests.get("http://127.0.0.1:8000/api/health")
print(f"\nHealth: {r2.status_code} {r2.json()}")

# Test auth check-email
r3 = requests.get("http://127.0.0.1:8000/api/auth/check-email", params={"email": "test@test.com"})
print(f"Auth check-email: {r3.status_code} {r3.json()}")
