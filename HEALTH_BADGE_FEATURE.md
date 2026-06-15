# Health & Product Badge Feature

## Overview
Added intelligent badge system that displays health indicators for food items and relevant quality/safety badges for non-food items when adding products to cart in the chat interface.

## Key Features

### 1. Health Badges for Food Items
Shows health ratings based on nutritional data:

#### Health Score Calculation (0-100)
- **Sugar content**: Most critical factor (especially for beverages)
- **Calories**: Moderate range is optimal
- **Protein**: Higher is better
- **Fiber**: Higher is better
- **Saturated fat**: Lower is better
- **Sodium**: Lower is better

#### Badge Levels
- ✓ **Excellent Choice** (80-100): Zero/low sugar, healthy profile
- ✓ **Good Choice** (60-79): Decent nutritional balance
- ⚠ **Moderate** (40-59): Acceptable with trade-offs
- ! **Less Healthy** (0-39): High sugar/calories/sodium

#### Examples
| Product | Health Score | Badge | Key Reason |
|---------|-------------|-------|------------|
| Diet Coke | 85/100 | ✓ Excellent | Zero sugar, near-zero calories |
| Coca-Cola Regular | 45/100 | ⚠ Moderate | 10.6g sugar per 100ml |
| Pepsi Zero | 85/100 | ✓ Excellent | Zero sugar |
| Pepsi Regular | 45/100 | ⚠ Moderate | 10.9g sugar per 100ml |
| Bisleri Water | 100/100 | ✓ Excellent | Pure water |
| Sprite | 55/100 | ⚠ Moderate | 9g sugar per 100ml |

### 2. Product Badges for Non-Food Items
Shows relevant quality/safety indicators:

#### Cleaning Products
- 🌱 **Eco-Friendly**: Biodegradable, plant-based, natural
- 🛡 **Antibacterial**: Kills germs, disinfectant properties

#### Personal Care & Hygiene
- ✓ **Derma Tested**: Dermatologist tested, clinically proven
- 🌿 **Natural**: Herbal, organic, ayurvedic
- 🚫 **No Parabens**: Paraben-free, sulfate-free

#### Fashion & Clothing
- ♻️ **Sustainable**: Organic cotton, recycled materials
- ⭐ **Premium**: Luxury, designer, handcrafted
- ☁️ **Comfortable**: Breathable, soft, lightweight

#### Baby Products
- 👶 **Baby Safe**: Pediatrician approved, gentle
- 🌱 **Chemical-Free**: Natural, organic ingredients

#### Electronics & Accessories
- ⚡ **Energy Saver**: Energy efficient, 5-star rated
- 🛡 **Warranty**: Product warranty/guarantee

#### All Categories
- 💎 **Best Value**: High rating + reasonable price
- ⭐ **Top Rated**: Rating ≥ 4.5 stars

## Implementation

### Backend Changes

#### 1. Database Schema Updates
**`app/catalog/models.py`**
- Added nutritional fields to `Product` model:
  - `calories_per_100`, `protein_per_100`, `carbs_per_100`
  - `sugar_per_100`, `fat_per_100`, `saturated_fat_per_100`
  - `fiber_per_100`, `sodium_per_100`
  - `health_score` (calculated)

**`app/models.py`**
- Added to `CartItem` model:
  - `health_score`, `health_badge` (for food)
  - `product_badge` (for non-food)
  - Basic nutritional info for display

#### 2. Health Score Calculator
**`app/catalog/health_scorer.py`**
- Calculates 0-100 health score based on nutritional data
- Returns badge label (excellent/good/moderate/poor)
- Special handling for water (perfect score)
- Weighted scoring:
  - Sugar: Most critical (-15 to +15)
  - Calories: Moderate range preferred (+5 to -10)
  - Protein/Fiber: Higher is better (+2 to +10)
  - Saturated fat/Sodium: Lower is better (+5 to -10)

#### 3. Product Badge System
**`app/catalog/product_badges.py`**
- Category-specific badge logic
- Keyword-based detection
- Priority-based badge selection
- Returns badge with label, color, icon, type

#### 4. Seed Data Updates
**`seed_catalog_v2.py`**
- Updated `_p()` function to accept nutritional parameters
- Added nutritional data for beverages (14 products)
- Added badge-triggering keywords for non-food items
- Automatic health score calculation during seeding

#### 5. Cart Resolution Updates
**`app/pipeline/resolver.py`**
- `_build_cart_item()` now calculates health scores
- Applies product badges for non-food items
- Includes badge info in alternatives
- Health score calculated for both main and alternative products

### Frontend Changes

#### Chat Interface Updates
**`frontend/src/routes/chat.tsx`**
- `CartItemRow` component shows badges inline
- Health badge for food items with tooltip showing:
  - Health score (X/100)
  - Sugar content
- Product badge for non-food items
- Badges in alternatives list (compact icons)
- Color-coded badges:
  - Green: Excellent/Eco-friendly/Natural
  - Blue: Good/Quality/Safety
  - Yellow: Moderate/Comfort
  - Orange: Poor/Less healthy
  - Amber: Premium/Value

## User Experience

### In Chat
When items are added to cart, badges appear next to product info:

```
┌─────────────────────────────────────────┐
│ Diet Coke                               │
│ Coca-Cola · 2000ml                      │
│ ✓ Excellent Choice  [Health: 85/100]   │
│ ₹95                                     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Vim Green Eco Dishwash Bar              │
│ Vim · 200g                              │
│ 🌱 Eco-Friendly                         │
│ ₹28                                     │
└─────────────────────────────────────────┘
```

### Alternatives View
When viewing alternatives, compact badge icons show:
- Health score comparison (regular vs diet versions)
- Product quality indicators
- Helps users make informed substitutions

## Testing

Created test script: `backend/test_health_scores.py`

Results show clear differentiation:
- Regular sodas: 45/100 (Moderate)
- Diet/Zero sodas: 85/100 (Excellent)
- Water: 100/100 (Excellent)
- Fruit juices: 45/100 (Moderate - has natural sugar)

## Benefits

1. **Health-Conscious Shopping**: Users can easily compare nutritional quality
2. **Informed Decisions**: Clear indicators for diet vs regular products
3. **Category-Relevant Info**: Non-food items show relevant quality metrics
4. **Visual Clarity**: Color-coded badges with intuitive icons
5. **Hover Details**: Tooltips provide additional context
6. **Alternative Comparison**: Easy to see health differences in alternatives

## Future Enhancements

1. **More Categories**: Expand nutritional data to snacks, dairy, grains
2. **Allergen Warnings**: Prominent badges for common allergens
3. **Dietary Filters**: Filter by health score threshold
4. **Nutrition Details**: Expandable view with full nutrition facts
5. **User Preferences**: Personalized scoring based on dietary goals
6. **Comparative View**: Side-by-side comparison of alternatives with badges
7. **Smart Suggestions**: "Healthier alternative available" prompts

## How to Use

### For Developers

1. **Reseed catalog** with nutritional data:
   ```bash
   cd backend
   python3 seed_catalog_v2.py
   ```

2. **Test health scoring**:
   ```bash
   python3 test_health_scores.py
   ```

3. **Add nutritional data** to new products in `seed_catalog_v2.py`:
   ```python
   _p("SKU-XXX", "product name", ...,
      calories=42, sugar=10.6, protein=0, 
      fat=0, fiber=0, sodium=10)
   ```

4. **Add badge keywords** for non-food items:
   ```python
   kw={"keyword", "eco-friendly", "antibacterial", "natural"}
   ```

### For Users

Simply add items to cart via chat - badges appear automatically based on:
- Nutritional content (food items)
- Product attributes (non-food items)

No configuration needed!

## Technical Notes

- Health scores cached in database for performance
- Badge calculation done server-side
- Frontend receives pre-calculated badges
- Backwards compatible (works without nutritional data)
- Graceful fallback for products without data
