const API_BASE = "/api/collab";

export interface Contributor {
  id: string;
  name: string;
  role: "host" | "contributor";
  status: "active" | "left";
  joined_at: string;
  items_added: number;
  budget_contribution_inr: number;
}

export interface CollabDemand {
  contributor_id: string;
  contributor_name: string;
  requested_name: string;
  requested_quantity: number;
  requested_unit: string;
  requested_base_amount: number;
  requested_base_unit: string;
  standalone_quantity_units: number;
  notes?: string;
}

export interface ProductSuggestion {
  sku: string;
  name: string;
  brand: string;
  price_per_unit_inr: number;
  unit: string;
  unit_quantity: number;
  reason: string;
  confidence: number;
}

export interface SuggestedRequest {
  request: {
    name: string;
    quantity: number;
    unit: string;
    category: string;
    notes?: string;
  };
  suggestions: ProductSuggestion[];
}

export interface PendingSubstitution {
  sku: string;
  name: string;
  brand: string;
  price_per_unit_inr: number;
  unit: string;
  unit_quantity: number;
  reason: string;
  savings_per_unit_inr: number;
}

export interface CollabCartItem {
  id: string;
  sku: string;
  name: string;
  brand: string;
  quantity: number;
  unit: string;
  unit_quantity: number;
  category: string;
  estimated_price_inr: number;
  added_by: string;
  added_by_name: string;
  notes?: string;
  matched_from: string[];
  demands: CollabDemand[];
  pending_substitution?: PendingSubstitution;
  substitution_reason?: string;
  merge_savings_inr: number;
}

export interface CollabSession {
  session_id: string;
  name: string;
  created_at: string;
  host_id: string;
  host_name: string;
  total_budget_inr: number;
  contributors: Contributor[];
  items: CollabCartItem[];
  share_code: string;
  is_active: boolean;
}

export interface BudgetSplit {
  contributor_id: string;
  name: string;
  items_added: number;
  amount_spent: number;
  fair_share: number;
  owes: number;
  amount_owed: number;
  percent_of_total: number;
  merge_savings_inr: number;
}

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || payload?.detail || fallbackMessage);
  }
  return response.json();
}

export async function createCollabSession(
  name: string,
  hostName: string,
  totalBudgetInr: number,
): Promise<{ session: CollabSession; contributor: Contributor }> {
  const response = await fetch(`${API_BASE}/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      host_name: hostName,
      total_budget_inr: totalBudgetInr,
    }),
  });
  return readJson(response, "Failed to create session");
}

export async function joinCollabSession(
  sessionId: string,
  contributorName: string,
): Promise<{ session: CollabSession; contributor: Contributor }> {
  const response = await fetch(`${API_BASE}/${sessionId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contributor_name: contributorName }),
  });
  return readJson(response, "Failed to join session");
}

export async function getCollabSession(sessionId: string): Promise<CollabSession> {
  const response = await fetch(`${API_BASE}/${sessionId}`);
  return readJson(response, "Failed to get session");
}

export async function getBudgetSplit(sessionId: string): Promise<{ splits: BudgetSplit[] }> {
  const response = await fetch(`${API_BASE}/${sessionId}/split`);
  return readJson(response, "Failed to get split");
}

export async function resolveShareCode(code: string): Promise<{ session_id: string }> {
  const response = await fetch(`${API_BASE}/join/${code}`);
  return readJson(response, "Failed to resolve share code");
}
