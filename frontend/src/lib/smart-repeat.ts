/**
 * Smart Repeat Engine
 * 
 * Analyzes past cart history to detect items that are likely running low
 * based on purchase frequency and estimated consumption rates.
 * 
 * Strategy:
 * 1. Look at the last N carts from history
 * 2. Identify "staple" items (purchased 2+ times across sessions)
 * 3. Estimate consumption rate from quantity + days since last purchase
 * 4. Surface a restock suggestion if elapsed time > estimated depletion time
 * 
 * This is entirely client-side — no backend calls needed.
 */

import { loadHistory, type CartHistoryEntry } from "./cart-history";

export interface RestockItem {
  name: string;
  brand: string;
  lastPurchasedDaysAgo: number;
  estimatedDepletesDays: number;
  quantity: number;
  unit: string;
  urgency: "high" | "medium" | "low";
  sku: string;
}

export interface SmartRepeatSuggestion {
  /** The history entry this suggestion is based on */
  sourceEntry: CartHistoryEntry;
  /** Items likely running low */
  restockItems: RestockItem[];
  /** Pre-built prompt text for the chat */
  prompt: string;
  /** Human-readable nudge text */
  nudgeText: string;
  /** Days since last relevant purchase */
  daysSinceLastCart: number;
}

/**
 * Estimated shelf life / consumption duration in days for common grocery categories.
 * Based on typical Indian household consumption patterns.
 */
const CONSUMPTION_ESTIMATES: Record<string, number> = {
  // Staples (heavy consumption)
  rice: 14,
  atta: 14,
  wheat: 14,
  flour: 14,
  oil: 21,
  ghee: 30,
  sugar: 21,

  // Dairy (short shelf life)
  milk: 3,
  curd: 5,
  dahi: 5,
  paneer: 5,
  butter: 14,
  cheese: 14,

  // Spices & condiments (long shelf life)
  salt: 60,
  turmeric: 45,
  chilli: 30,
  masala: 30,
  jeera: 45,

  // Snacks & beverages (moderate)
  chips: 7,
  biscuit: 10,
  namkeen: 10,
  tea: 21,
  coffee: 21,
  juice: 7,
  cold: 5,
  soda: 5,

  // Cleaning (long-ish)
  soap: 30,
  detergent: 30,
  shampoo: 30,
  toothpaste: 30,

  // Pulses & lentils
  dal: 14,
  lentil: 14,
  chana: 21,
  rajma: 21,
  moong: 14,

  // Vegetables & fresh (very short)
  onion: 7,
  potato: 10,
  tomato: 5,

  // Default for unknown items
  _default: 14,
};

/**
 * Estimate how many days an item lasts based on its name and quantity.
 */
function estimateConsumptionDays(itemName: string, quantity: number): number {
  const nameLower = itemName.toLowerCase();

  // Find matching consumption category
  for (const [keyword, days] of Object.entries(CONSUMPTION_ESTIMATES)) {
    if (keyword === "_default") continue;
    if (nameLower.includes(keyword)) {
      // Scale by quantity — more units last proportionally longer
      return Math.round(days * Math.max(1, quantity * 0.7));
    }
  }

  // Default: assume ~14 days per unit
  return Math.round(CONSUMPTION_ESTIMATES._default * Math.max(1, quantity * 0.7));
}

/**
 * Compute days elapsed since a given ISO date string.
 */
function daysSince(isoDate: string): number {
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  return Math.max(0, Math.round((now - then) / (1000 * 60 * 60 * 24)));
}

/**
 * Analyze cart history and produce a smart restock suggestion.
 * Returns null if no suggestion is appropriate.
 */
export function getSmartRepeatSuggestion(): SmartRepeatSuggestion | null {
  const history = loadHistory();

  // Need at least 1 cart to suggest restocking
  if (history.length === 0) return null;

  // Find the most recent cart with ≥3 items (skip tiny carts)
  const relevantEntry = history.find((e) => e.item_count >= 3);
  if (!relevantEntry) return null;

  const daysSinceCart = daysSince(relevantEntry.saved_at);

  // Don't suggest if the cart was made less than 2 days ago
  if (daysSinceCart < 2) return null;

  // Analyze items in the cart for depletion
  const cartItems = relevantEntry.cart || [];
  const restockItems: RestockItem[] = [];

  for (const item of cartItems) {
    if (!item.name || !item.sku) continue;

    const qty = item.quantity_units || 1;
    const estimatedDays = estimateConsumptionDays(item.name, qty);

    // Item is likely running low if elapsed time >= 70% of estimated depletion
    const depletionRatio = daysSinceCart / estimatedDays;

    if (depletionRatio >= 0.7) {
      let urgency: "high" | "medium" | "low" = "low";
      if (depletionRatio >= 1.2) urgency = "high";
      else if (depletionRatio >= 0.9) urgency = "medium";

      restockItems.push({
        name: item.name,
        brand: item.brand || "",
        lastPurchasedDaysAgo: daysSinceCart,
        estimatedDepletesDays: estimatedDays,
        quantity: qty,
        unit: item.unit || "unit",
        urgency,
        sku: item.sku,
      });
    }
  }

  // Need at least 2 items running low to show a suggestion
  if (restockItems.length < 2) return null;

  // Sort by urgency (high first)
  restockItems.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.urgency] - order[b.urgency];
  });

  // Take top 6 items max
  const topItems = restockItems.slice(0, 6);

  // Build the pre-fill prompt
  const itemNames = topItems.map((i) => i.name.toLowerCase()).join(", ");
  const prompt = `Restock: ${itemNames}`;

  // Build human-readable nudge
  const highCount = topItems.filter((i) => i.urgency === "high").length;
  const context = relevantEntry.context_summary || relevantEntry.intent_type || "groceries";
  let nudgeText: string;

  if (highCount >= 2) {
    nudgeText = `You bought ${context} ${daysSinceCart} days ago — ${highCount} staples are likely out. Restock?`;
  } else {
    nudgeText = `It's been ${daysSinceCart} days since your last ${context} order. Time to restock?`;
  }

  return {
    sourceEntry: relevantEntry,
    restockItems: topItems,
    prompt,
    nudgeText,
    daysSinceLastCart: daysSinceCart,
  };
}

/**
 * Check if user has dismissed the suggestion recently.
 * Uses sessionStorage so it resets per browser session.
 */
const DISMISS_KEY = "needspeak_smart_repeat_dismissed";

export function isDismissed(): boolean {
  try {
    const dismissed = sessionStorage.getItem(DISMISS_KEY);
    if (!dismissed) return false;
    // Dismiss lasts for 6 hours
    const dismissedAt = parseInt(dismissed, 10);
    return Date.now() - dismissedAt < 6 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function dismissSuggestion(): void {
  try {
    sessionStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Ignore
  }
}
