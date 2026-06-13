const API_BASE = '/api';

export async function parseContent({ input_type, content, servings_override, budget_inr }, mockMode = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (mockMode) headers['X-Mock-Mode'] = '1';
  
  const body = { input_type, content };
  if (servings_override) body.servings_override = servings_override;
  if (budget_inr) body.budget_inr = budget_inr;

  const res = await fetch(`${API_BASE}/parse`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message || err.detail || 'Unknown error');
  }

  return res.json();
}

export async function getSession(sessionId) {
  const res = await fetch(`${API_BASE}/session/${sessionId}`);
  if (!res.ok) throw new Error('Session not found');
  return res.json();
}

export async function checkHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}
