import { createFileRoute } from "@tanstack/react-router";

type Item = {
  name: string;
  brand: string;
  price_inr: number;
  qty: string;
  category: string;
  reason: string;
  quantity?: number;
};

const CATALOG: Record<string, Item[]> = {
  ipl: [
    { name: "Potato Chips Magic Masala", brand: "Lay's", price_inr: 20, qty: "52g", category: "Snacks", reason: "Crowd favourite for match nights" },
    { name: "Salted Peanuts", brand: "Haldiram's", price_inr: 45, qty: "200g", category: "Snacks", reason: "Easy to share, pairs with drinks" },
    { name: "Coca-Cola", brand: "Coca-Cola", price_inr: 90, qty: "1.25L", category: "Beverages", reason: "Classic match-night cooler", quantity: 2 },
    { name: "Tandoori Chicken Wings", brand: "Sumeru", price_inr: 220, qty: "400g", category: "Frozen", reason: "Quick bites for 10 people" },
    { name: "Paneer Tikka Pops", brand: "ITC Master Chef", price_inr: 175, qty: "300g", category: "Frozen", reason: "Vegetarian quick bite" },
    { name: "Nachos with Salsa Dip", brand: "Cornitos", price_inr: 99, qty: "150g", category: "Snacks", reason: "Goes with every drink" },
    { name: "Sprite", brand: "Sprite", price_inr: 90, qty: "1.25L", category: "Beverages", reason: "Lemon-lime alternative" },
    { name: "Paper Plates (50pc)", brand: "Solimo", price_inr: 140, qty: "50 pack", category: "Disposables", reason: "Less cleanup post-match" },
  ],
  birthday: [
    { name: "Chocolate Truffle Cake 1kg", brand: "Cakezone", price_inr: 599, qty: "1kg", category: "Bakery", reason: "Centerpiece for the party" },
    { name: "Real Fruit Juice Mixed Pack", brand: "Real", price_inr: 110, qty: "1L", category: "Beverages", reason: "Kid-friendly drink", quantity: 3 },
    { name: "Birthday Decoration Kit", brand: "Party Propz", price_inr: 349, qty: "55 pcs", category: "Decor", reason: "Balloons, banner, candles in one" },
    { name: "Choco Pie", brand: "Lotte", price_inr: 100, qty: "12 pack", category: "Snacks", reason: "Easy giveaway treat" },
    { name: "Paper Plates & Cups Set", brand: "Solimo", price_inr: 199, qty: "Set of 60", category: "Disposables", reason: "Covers 15 kids" },
  ],
  default: [
    { name: "Basmati Rice", brand: "India Gate", price_inr: 220, qty: "1kg", category: "Staples", reason: "Daily essential" },
    { name: "Toor Dal", brand: "Tata Sampann", price_inr: 175, qty: "1kg", category: "Staples", reason: "Protein staple" },
    { name: "Atta Whole Wheat", brand: "Aashirvaad", price_inr: 320, qty: "5kg", category: "Staples", reason: "Weekly rotis" },
    { name: "Toned Milk", brand: "Amul", price_inr: 32, qty: "500ml", category: "Dairy", reason: "Daily use", quantity: 4 },
    { name: "Fortune Sunflower Oil", brand: "Fortune", price_inr: 165, qty: "1L", category: "Staples", reason: "All-purpose cooking oil" },
  ],
};

function pickCatalog(content: string, occasion?: string) {
  const c = (content || "").toLowerCase();
  if (occasion && CATALOG[occasion]) return { key: occasion, items: CATALOG[occasion] };
  if (/(ipl|match|cricket|watch party)/.test(c)) return { key: "ipl", items: CATALOG.ipl };
  if (/(birthday|cake|kids)/.test(c)) return { key: "birthday", items: CATALOG.birthday };
  return { key: "weekly", items: CATALOG.default };
}

const INTENT_LABEL: Record<string, string> = {
  ipl: "IPL Watch Party",
  birthday: "Birthday Party",
  weekly: "Weekly Grocery",
};

export const Route = createFileRoute("/api/parse")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({} as any));
        const { content = "", occasion } = body || {};
        const { key, items } = pickCatalog(content, occasion);

        const cart = items.map((it) => ({ ...it, quantity: it.quantity ?? 1 }));
        const total = cart.reduce((s, it) => s + it.price_inr * (it.quantity || 1), 0);
        const intentLabel = INTENT_LABEL[key] || "Shopping List";

        const payload = {
          session_id: `demo-${Date.now()}`,
          confidence: "high",
          intent_type: intentLabel,
          context_summary: `Demo cart for ${intentLabel.toLowerCase()}`,
          total_price_inr: total,
          summary: `Built a ${intentLabel.toLowerCase()} cart with ${cart.length} items (~Rs.${total}).`,
          unavailable_items: [],
          intents: [
            {
              intent_type: intentLabel,
              context_summary: `Demo cart for ${intentLabel.toLowerCase()}`,
              cart,
              unavailable_items: [],
            },
          ],
          cart,
        };

        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});