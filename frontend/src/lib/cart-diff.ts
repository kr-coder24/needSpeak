/**
 * Cart diff utility for CompareCart "What If" feature
 * Compares old and new carts to show added/removed/swapped items
 */

export interface CartItem {
  sku: string;
  name: string;
  brand?: string;
  price_per_unit_inr: number;
  total_price_inr: number;
  quantity_units: number;
  unit_quantity?: number;
  unit?: string;
  substituted?: boolean;
  substitution_reason?: string;
  matched_from?: string[];
}

export interface SwappedItem {
  old: CartItem;
  new: CartItem;
  savings: number; // positive = saved money, negative = spent more
}

export interface CartDiff {
  added: CartItem[];       // items in new cart but not in old
  removed: CartItem[];     // items in old cart but not in new
  swapped: SwappedItem[];  // same item name, different SKU/price
  unchanged: CartItem[];   // identical items
  summary: {
    oldTotal: number;
    newTotal: number;
    difference: number;    // positive = saved, negative = spent more
    itemCountChange: number;
  };
}

/**
 * Compare two carts and return a diff
 */
export function diffCarts(oldCart: CartItem[], newCart: CartItem[]): CartDiff {
  // Create maps keyed by normalized item name
  const oldMap = new Map<string, CartItem>();
  const newMap = new Map<string, CartItem>();

  for (const item of oldCart) {
    const key = normalizeItemName(item.name);
    oldMap.set(key, item);
  }

  for (const item of newCart) {
    const key = normalizeItemName(item.name);
    newMap.set(key, item);
  }

  const added: CartItem[] = [];
  const removed: CartItem[] = [];
  const swapped: SwappedItem[] = [];
  const unchanged: CartItem[] = [];

  // Check new items against old
  for (const [name, newItem] of newMap) {
    const oldItem = oldMap.get(name);

    if (!oldItem) {
      // Item exists in new but not old → added
      added.push(newItem);
    } else if (
      oldItem.sku !== newItem.sku ||
      oldItem.price_per_unit_inr !== newItem.price_per_unit_inr
    ) {
      // Same item name but different SKU or price → swapped
      swapped.push({
        old: oldItem,
        new: newItem,
        savings: oldItem.total_price_inr - newItem.total_price_inr,
      });
    } else if (oldItem.quantity_units !== newItem.quantity_units) {
      // Same SKU but different quantity → treat as swap
      swapped.push({
        old: oldItem,
        new: newItem,
        savings: oldItem.total_price_inr - newItem.total_price_inr,
      });
    } else {
      // Identical
      unchanged.push(newItem);
    }
  }

  // Check for removed items (in old but not in new)
  for (const [name, oldItem] of oldMap) {
    if (!newMap.has(name)) {
      removed.push(oldItem);
    }
  }

  // Calculate totals
  const oldTotal = oldCart.reduce((sum, item) => sum + (item.total_price_inr || 0), 0);
  const newTotal = newCart.reduce((sum, item) => sum + (item.total_price_inr || 0), 0);

  return {
    added,
    removed,
    swapped,
    unchanged,
    summary: {
      oldTotal,
      newTotal,
      difference: oldTotal - newTotal, // positive = saved money
      itemCountChange: newCart.length - oldCart.length,
    },
  };
}

/**
 * Normalize item name for comparison
 * Handles case differences, extra whitespace, etc.
 */
function normalizeItemName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    // Remove common suffixes that might differ
    .replace(/\s*(pack|pcs?|pieces?|units?)$/i, "");
}

/**
 * Check if a diff has any meaningful changes
 */
export function hasDiffChanges(diff: CartDiff): boolean {
  return diff.added.length > 0 || diff.removed.length > 0 || diff.swapped.length > 0;
}

/**
 * Get a human-readable summary of the diff
 */
export function getDiffSummary(diff: CartDiff): string {
  const parts: string[] = [];

  if (diff.added.length > 0) {
    parts.push(`${diff.added.length} item${diff.added.length > 1 ? "s" : ""} added`);
  }
  if (diff.removed.length > 0) {
    parts.push(`${diff.removed.length} item${diff.removed.length > 1 ? "s" : ""} removed`);
  }
  if (diff.swapped.length > 0) {
    parts.push(`${diff.swapped.length} item${diff.swapped.length > 1 ? "s" : ""} swapped`);
  }

  if (parts.length === 0) {
    return "No changes";
  }

  const savingsStr =
    diff.summary.difference > 0
      ? `Save ₹${diff.summary.difference}`
      : diff.summary.difference < 0
        ? `Spend ₹${Math.abs(diff.summary.difference)} more`
        : "";

  return parts.join(", ") + (savingsStr ? ` — ${savingsStr}` : "");
}
