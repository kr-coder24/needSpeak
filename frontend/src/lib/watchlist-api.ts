export type WatchStatus = "watching" | "price_dropped" | "neighbor_match" | "already_cheaper";

export type PricePoint = {
  day: number;
  price: number;
};

export type DealColor = "green" | "yellow" | "red";
export type DealStatus = "best" | "fair" | "high";

export type PriceStatus = {
  status: DealStatus;
  color_key: DealColor;
  label: string;
  explanation: string;
  confidence: number;
  thirty_day_low_inr: number;
  thirty_day_high_inr: number;
  current_price_inr: number;
  deal_status: DealStatus;
  deal_color: DealColor;
  deal_label: string;
};

export type NeighborMatch = {
  product_id: string;
  distance_km: number;
  original_price_inr: number;
  logistics_cost_saved_inr: number;
  neighbor_price_inr: number;
  co2_saved_kg: number;
  day_appeared: number;
};

export type WatchedItem = {
  watch_id: string;
  sku: string;
  name: string;
  brand: string;
  current_price_inr: number;
  target_price_inr: number;
  competitor_price_inr?: number | null;
  competitor_source?: string | null;
  status: WatchStatus;
  created_at: string;
  price_history: PricePoint[];
  neighbor_match?: NeighborMatch | null;
  co2_saved_kg: number;
  logistics_saved_inr: number;
  email?: string | null;
  email_sent: boolean;
  price_status?: PriceStatus | null;
};

export type WatchCreatePayload = {
  sku: string;
  name: string;
  brand?: string;
  current_price_inr: number;
  target_price_inr?: number;
  competitor_text?: string;
  user_id?: string;
  email?: string;
};

export type WatchEvent = {
  id: string;
  type: WatchStatus | "now_watching" | "email_sent";
  watch_id: string;
  sku: string;
  name: string;
  message: string;
  day: number;
  savings_inr: number;
  co2_saved_kg: number;
  email_sent: boolean;
};

export type SimulateResponse = {
  current_day: number;
  events: WatchEvent[];
  watches: WatchedItem[];
};

export type WatchStats = {
  total_saved_inr: number;
  total_co2_saved_kg: number;
  count: number;
  alerts: number;
};

export type PriceStatusBatchItem = {
  sku: string;
  current_price_inr: number;
};

export type PriceStatusBatchResponse = {
  items: { sku: string; price_status: PriceStatus }[];
};

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Watchlist request failed");
  }
  return response.json();
}

export function createWatch(data: WatchCreatePayload) {
  return fetch("/api/watchlist/watch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((res) => readJson<WatchedItem>(res));
}

export function createWatchWithImage(formData: FormData) {
  return fetch("/api/watchlist/watch-image", {
    method: "POST",
    body: formData,
  }).then((res) => readJson<WatchedItem>(res));
}

export function getWatches(userId: string) {
  return fetch(`/api/watchlist/${encodeURIComponent(userId)}`).then((res) => readJson<WatchedItem[]>(res));
}

export function removeWatch(userId: string, watchId: string) {
  return fetch(`/api/watchlist/${encodeURIComponent(userId)}/${encodeURIComponent(watchId)}`, {
    method: "DELETE",
  }).then((res) => readJson<{ status: string }>(res));
}

export function simulateNextDay(userId: string) {
  return fetch(`/api/watchlist/${encodeURIComponent(userId)}/simulate`, {
    method: "POST",
  }).then((res) => readJson<SimulateResponse>(res));
}

export function getWatchStats(userId: string) {
  return fetch(`/api/watchlist/${encodeURIComponent(userId)}/stats`).then((res) => readJson<WatchStats>(res));
}

export function getDemoWatchEvents() {
  return fetch("/api/watchlist/demo-events").then((res) => readJson<WatchEvent[]>(res));
}

export function getPriceStatusBatch(userId: string, items: PriceStatusBatchItem[]) {
  if (items.length === 0) return Promise.resolve({ items: [] } satisfies PriceStatusBatchResponse);
  return fetch("/api/watchlist/price-status/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, items }),
  }).then((res) => readJson<PriceStatusBatchResponse>(res));
}
