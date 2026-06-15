import type { CartHistoryEntry } from "@/lib/cart-history";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function mkItem(sku: string, name: string, brand: string, qty: number, price: number) {
  return {
    sku,
    name,
    brand,
    quantity: qty,
    quantity_units: qty,
    unit: "pack",
    unit_quantity: 1,
    price_inr: price,
    price_per_unit_inr: price,
    total_price_inr: qty * price,
  };
}

export const SEED_HISTORY: CartHistoryEntry[] = [
  {
    session_id: "seed-ipl-001",
    saved_at: daysAgo(0),
    intent_type: "Party",
    context_summary: "IPL final night · snacks & drinks for 6 friends",
    total_price_inr: 1842,
    item_count: 7,
    budget_inr: 2000,
    summary: "Curated game-night spread under budget.",
    unavailable_items: [],
    cart: [
      mkItem("LAYS-CLAS-90", "Lay's Classic Salted", "Lay's", 3, 50),
      mkItem("UNCL-CHIP-60", "Uncle Chips Spicy Treat", "Uncle Chips", 2, 45),
      mkItem("COKE-2L", "Coca-Cola 2L PET", "Coca-Cola", 3, 95),
      mkItem("ACTII-POP-70", "Act II Butter Lover Popcorn", "Act II", 2, 50),
      mkItem("HALDI-BHU-200", "Haldiram Aloo Bhujia", "Haldiram", 2, 65),
      mkItem("AMUL-DARK-90", "Amul Dark Chocolate 55%", "Amul", 2, 110),
      mkItem("BISL-1L-6PK", "Bisleri Water 1L (6 pack)", "Bisleri", 1, 120),
    ],
  },
  {
    session_id: "seed-tikka-002",
    saved_at: daysAgo(0),
    intent_type: "Recipe",
    context_summary: "Chicken Tikka Masala recipe for 4",
    total_price_inr: 1748,
    item_count: 14,
    summary: "All ingredients scaled to 4 servings.",
    unavailable_items: [],
    cart: [
      mkItem("CHIK-BRST-500", "Farm Fresh Chicken Breast", "Farm Fresh", 1, 320),
      mkItem("ONION-1KG", "Fresh Onion", "Local", 1, 45),
      mkItem("TOM-1KG", "Fresh Tomato", "Local", 1, 60),
      mkItem("GING-100", "Fresh Ginger", "Local", 1, 25),
      mkItem("GAR-100", "Fresh Garlic", "Local", 1, 35),
      mkItem("CURD-400", "Amul Dahi 400g", "Amul", 1, 60),
      mkItem("CRM-200", "Amul Fresh Cream 200ml", "Amul", 1, 75),
      mkItem("BUT-100", "Amul Butter 100g", "Amul", 1, 56),
      mkItem("GMASL-100", "Everest Garam Masala", "Everest", 1, 85),
      mkItem("KASURI-25", "MDH Kasuri Methi", "MDH", 1, 45),
      mkItem("BASMA-1KG", "India Gate Basmati Rice", "India Gate", 1, 220),
      mkItem("OIL-1L", "Fortune Sunflower Oil 1L", "Fortune", 1, 165),
      mkItem("CILA-100", "Fresh Coriander", "Local", 1, 12),
      mkItem("LEMON-4", "Fresh Lemon (4)", "Local", 1, 40),
    ],
  },
  {
    session_id: "seed-groc-003",
    saved_at: daysAgo(2),
    intent_type: "Groceries",
    context_summary: "Weekly groceries · staples top-up",
    total_price_inr: 942,
    item_count: 7,
    summary: "Essential refills for the week.",
    unavailable_items: [],
    cart: [
      mkItem("BASMA-5KG", "India Gate Classic Basmati 5kg", "India Gate", 1, 520),
      mkItem("ATTA-5KG", "Aashirvaad Atta 5kg", "Aashirvaad", 1, 285),
      mkItem("ONION-1KG-2", "Fresh Onion 1kg", "Local", 1, 45),
      mkItem("MILK-1L", "Amul Toned Milk 1L", "Amul", 2, 56),
      mkItem("TATA-SALT", "Tata Salt Iodized 1kg", "Tata", 1, 28),
      mkItem("OIL-FOR-1L", "Fortune Sunflower 1L", "Fortune", 1, 165),
      mkItem("DAL-TOOR", "Tata Sampann Toor Dal 1kg", "Tata", 1, 180),
    ],
  },
  {
    session_id: "seed-bday-004",
    saved_at: daysAgo(4),
    intent_type: "Birthday",
    context_summary: "Kid's birthday cake & decorations for 10",
    total_price_inr: 1450,
    item_count: 6,
    summary: "Cake, juice, and party decor.",
    unavailable_items: [],
    cart: [
      mkItem("CAKE-CHOC-1KG", "Chocolate Truffle Cake 1kg", "Bakery Bliss", 1, 650),
      mkItem("JUICE-2L", "Real Mixed Fruit Juice 2L", "Real", 2, 180),
      mkItem("CANDY-MIX", "Assorted Candy Mix Pack", "Cadbury", 1, 220),
      mkItem("BALLOON-50", "Metallic Balloons (50 pack)", "Generic", 1, 150),
      mkItem("CANDLES-BD", "Birthday Number Candles", "Generic", 1, 70),
      mkItem("PLATES-20", "Disposable Plates (20)", "Generic", 1, 80),
    ],
  },
  {
    session_id: "seed-diwali-005",
    saved_at: daysAgo(9),
    intent_type: "Festival",
    context_summary: "Diwali essentials · sweets & diyas",
    total_price_inr: 2310,
    item_count: 5,
    summary: "Mithai, lights, and pooja basics.",
    unavailable_items: [],
    cart: [
      mkItem("MITHAI-1KG", "Haldiram Soan Papdi 500g", "Haldiram", 2, 280),
      mkItem("DRYFRT-500", "Premium Dry Fruit Box 500g", "Happilo", 1, 850),
      mkItem("DIYA-12", "Clay Diyas (set of 12)", "Generic", 2, 180),
      mkItem("RANGOLI-PWD", "Rangoli Colour Powder Kit", "Generic", 1, 250),
      mkItem("AGARBATTI", "Cycle Agarbatti 100g", "Cycle", 1, 110),
    ],
  },
  {
    session_id: "seed-restock-006",
    saved_at: daysAgo(14),
    intent_type: "Restock",
    context_summary: "Monthly pantry & cleaning restock",
    total_price_inr: 249,
    item_count: 3,
    summary: "Quick top-up for low-stock essentials.",
    unavailable_items: [],
    cart: [
      mkItem("BASMA-1KG-3", "India Gate Classic Basmati 1kg", "India Gate", 1, 120),
      mkItem("ONION-500", "Fresh Onion 500g", "Local", 1, 25),
      mkItem("TATA-SALT-2", "Tata Salt Iodized 1kg", "Tata", 1, 28),
    ],
  },
];

export function ensureSeededHistory() {
  if (typeof window === "undefined") return;
  try {
    const KEY = "needspeak-cart-history";
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return;
    }
    localStorage.setItem(KEY, JSON.stringify(SEED_HISTORY));
  } catch {
    // ignore
  }
}