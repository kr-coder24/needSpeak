# Enable Health Badge Feature

## Current Status
✅ **Code**: Fully implemented
⚠️ **Data**: Needs catalog reseed

## Quick Enable (2 steps):

### Step 1: Reseed the Catalog
```bash
cd /Users/amankashyap/Documents/NeedSpeak/backend
python3 seed_catalog_v2.py
```

This will:
- Load 562 products
- Calculate health scores for 13 beverage products
- Store nutritional data in the catalog

### Step 2: Restart Backend
```bash
# Stop current backend (Ctrl+C)
# Then restart:
uvicorn app.main:app --reload
```

### Step 3: Test in Chat
Try these queries to see health badges:

1. **"I want coke"**
   - Should show: Coca-Cola Regular ⚠ Moderate (45/100)
   - Alternative: Diet Coke ✓ Excellent (85/100)

2. **"Get me diet coke"**
   - Should show: Diet Coke ✓ Excellent Choice (85/100)
   - Tooltip: "Health Score: 85/100 • Sugar: 0g/100ml"

3. **"Need vim dishwash and himalaya soap"**
   - Vim: 🌱 Eco-Friendly (if keyword matches)
   - Himalaya: 🌿 Natural (herbal/ayurvedic keywords)

## Where Health Badges Appear

### In Cart Items:
```
┌─────────────────────────────────────────┐
│ Diet Coke                               │
│ Coca-Cola · 2000ml                      │
│ ✓ Excellent Choice [85/100]            │ ← HERE
│ ₹95                                     │
└─────────────────────────────────────────┘
```

### In Alternatives:
```
Show 2 alternatives
  ┌─ Coca-Cola Regular
  │  ⚠ [45/100]                          ← HERE
  │  ₹95
  └─ Pepsi Zero Sugar
     ✓ [85/100]                          ← HERE
     ₹90
```

## Products with Health Scores

Currently implemented (13 beverages):
- ✓ Coca-Cola Regular (45/100 - Moderate)
- ✓ Diet Coke (85/100 - Excellent)
- ✓ Pepsi Regular (45/100 - Moderate)
- ✓ Pepsi Zero Sugar (85/100 - Excellent)
- ✓ Sprite (55/100 - Moderate)
- ✓ Thums Up (45/100 - Moderate)
- ✓ Real Juice (45/100 - Moderate)
- ✓ Paper Boat Aamras (45/100 - Moderate)
- ✓ Bisleri Water (100/100 - Excellent)
- ✓ Red Bull (45/100 - Moderate)
- ✓ Frooti (45/100 - Moderate)
- ✓ Tea (N/A)
- ✓ Coffee (N/A)

## Product Badges (Non-Food)

Currently implemented:
- 🌱 Eco-Friendly (cleaning products with eco keywords)
- 🛡 Antibacterial (cleaning with disinfectant keywords)
- 🌿 Natural (hygiene with herbal/ayurvedic keywords)
- ✓ Derma Tested (personal care with clinically tested)
- ⭐ Top Rated (rating ≥ 4.5)

## Troubleshooting

### "I don't see any badges"

**Check 1**: Are you searching for beverages?
- Only beverages have nutritional data right now
- Try: "i want coke" or "diet coke"

**Check 2**: Did you reseed the catalog?
```bash
python3 seed_catalog_v2.py
# Should show: "Health scored products: 13"
```

**Check 3**: Check browser console
- Open DevTools → Console
- Look for cart item data
- Should have `health_score` and `health_badge` fields

### "Badges show for some items but not others"

This is expected! Only products with nutritional data show health badges.

To add more products with health scores:
1. Edit `backend/seed_catalog_v2.py`
2. Find the product in `_snacks()`, `_dairy()`, etc.
3. Add nutrition parameters:
```python
_p("SKU-XXX", "product name", "Brand", ...,
   calories=150, sugar=5, protein=2, 
   fat=8, fiber=1, sodium=200)
```
4. Reseed catalog

## Adding Nutritional Data to More Products

### Snacks Example:
```python
_p("SKU-SNK-001", "lays classic chips", "Lays", "snacks", "chips", 20, "g", 55, 4.4, 5000,
   kw={"chips", "potato", "snack"},
   syn={"chips", "wafers"},
   dietary={"veg"},
   occ={"party", "snack"},
   reviews=["Crispy and tasty.", "Party favorite."],
   # ADD THESE:
   calories=536, protein=6.7, carbs=53, sugar=1.2,
   fat=33, saturated_fat=14, fiber=4.5, sodium=380)
```

### Dairy Example:
```python
_p("SKU-DRY-001", "amul gold milk", "Amul", "dairy", "milk", 72, "ml", 1000, 4.5, 5000,
   kw={"milk", "full cream", "dairy"},
   syn={"doodh", "dudh"},
   dietary={"veg"},
   allergen={"lactose"},
   occ={"everyday", "breakfast"},
   reviews=["Fresh and creamy."],
   # ADD THESE:
   calories=66, protein=3.2, carbs=4.8, sugar=4.8,
   fat=4.1, saturated_fat=2.5, fiber=0, sodium=42)
```

## For Demo/Judging

### Best Demo Queries:
1. **"party for 10 people, chips thanda and sweets"**
   - Shows health comparison between regular vs diet sodas
   - Demonstrates smart alternatives with health scores

2. **"I want coke"**
   - Regular coke shows ⚠ Moderate (45/100)
   - Click alternatives
   - See Diet Coke ✓ Excellent (85/100)
   - One-click swap

3. **"vim dishwash and himalaya soap"**
   - Shows product badges (eco-friendly, natural)
   - Demonstrates non-food badge system

### Talking Points:
- "Our health scoring considers sugar, calories, protein, fiber, sodium"
- "Diet Coke scores 85/100 vs Regular Coke 45/100 - clear difference"
- "Water gets perfect 100/100 score"
- "Non-food items show relevant quality badges"
- "Helps users make informed health choices at the point of adding to cart"

## File Locations

All health badge code:
- Backend scorer: `backend/app/catalog/health_scorer.py`
- Product badges: `backend/app/catalog/product_badges.py`
- Database models: `backend/app/models.py`, `backend/app/catalog/models.py`
- Cart builder: `backend/app/pipeline/resolver.py` (line 206-319)
- Frontend UI: `frontend/src/routes/chat.tsx` (line 152-240)
- Seed data: `backend/seed_catalog_v2.py` (line 240-300 for beverages)
- Test script: `backend/test_health_scores.py`
