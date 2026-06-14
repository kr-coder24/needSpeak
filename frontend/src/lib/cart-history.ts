/**
 * Cart history stored in localStorage.
 * Each entry is a lightweight snapshot of a completed cart session.
 */

export type CartHistoryEntry = {
  session_id: string;
  saved_at: string; // ISO timestamp
  intent_type: string;
  context_summary: string;
  total_price_inr: number;
  item_count: number;
  cart: any[]; // full flat cart array for re-display
  unavailable_items: any[];
  summary: string;
  budget_inr?: number;
  intents?: any[]; // Save the multi-intent grouped arrays
};

const STORAGE_KEY = "needspeak-cart-history";
const MAX_ENTRIES = 20;

export function loadHistory(): CartHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CartHistoryEntry[];
  } catch {
    return [];
  }
}

export function saveToHistory(entry: CartHistoryEntry): void {
  try {
    const current = loadHistory();
    // Deduplicate by session_id, newest first.
    const filtered = current.filter((e) => e.session_id !== entry.session_id);
    const updated = [entry, ...filtered].slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Storage might be full — silently ignore.
  }
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Find a past cart with a similar intent type for "re-order" suggestions.
 * Skips the most recent entry (which is likely the current cart).
 */
export function findSimilarCart(intentType: string): CartHistoryEntry | null {
  const history = loadHistory();
  if (history.length < 2) return null; // nothing to suggest if only 1 entry

  // Skip the current/latest, search older entries
  const past = history.slice(1);
  return (
    past.find(
      (entry) =>
        entry.intent_type?.toLowerCase().includes(intentType?.toLowerCase()) ||
        intentType?.toLowerCase().includes(entry.intent_type?.toLowerCase()),
    ) ?? null
  );
}
