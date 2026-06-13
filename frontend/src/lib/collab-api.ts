const API_BASE = "http://127.0.0.1:8000/api/collab";

export interface Contributor {
  id: string;
  name: string;
  role: "host" | "contributor";
  status: "active" | "left";
  joined_at: string;
  items_added: number;
  budget_contribution_inr: number;
}

export interface CollabCartItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  estimated_price_inr: number;
  added_by: string;
  added_by_name: string;
  notes?: string;
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
}

export async function createCollabSession(
  name: string,
  hostName: string,
  totalBudgetInr: number
): Promise<{ session: CollabSession; contributor: Contributor }> {
  const res = await fetch(`${API_BASE}/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      host_name: hostName,
      total_budget_inr: totalBudgetInr,
    }),
  });
  if (!res.ok) throw new Error("Failed to create session");
  return res.json();
}

export async function joinCollabSession(
  sessionId: string,
  contributorName: string
): Promise<{ session: CollabSession; contributor: Contributor }> {
  const res = await fetch(`${API_BASE}/${sessionId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contributor_name: contributorName }),
  });
  if (!res.ok) throw new Error("Failed to join session");
  return res.json();
}

export async function getCollabSession(sessionId: string): Promise<CollabSession> {
  const res = await fetch(`${API_BASE}/${sessionId}`);
  if (!res.ok) throw new Error("Failed to get session");
  return res.json();
}

export async function getBudgetSplit(sessionId: string): Promise<{ splits: BudgetSplit[] }> {
  const res = await fetch(`${API_BASE}/${sessionId}/split`);
  if (!res.ok) throw new Error("Failed to get split");
  return res.json();
}

export async function resolveShareCode(code: string): Promise<{ session_id: string }> {
  const res = await fetch(`${API_BASE}/join/${code}`);
  if (!res.ok) throw new Error("Failed to resolve share code");
  return res.json();
}
