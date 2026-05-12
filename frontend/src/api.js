// API client for CW Pipeline

// In production, API calls go to the same domain via Worker route
// (pipeline.cwprop.com/api/* routes to the Worker, same Access gate)
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8001'
  : '';

async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Deals
  getDeals: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/deals${qs ? '?' + qs : ''}`);
  },
  getDeal: (id) => apiFetch(`/api/deals/${id}`),
  createDeal: (data) => apiFetch('/api/deals', { method: 'POST', body: JSON.stringify(data) }),
  updateDeal: (id, data) => apiFetch(`/api/deals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDeal: (id) => apiFetch(`/api/deals/${id}`, { method: 'DELETE' }),

  // Stats & activity
  getStats: () => apiFetch('/api/stats'),
  getActivity: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiFetch(`/api/activity${qs ? '?' + qs : ''}`);
  },

  // Compare & stress
  compareDeals: (ids) => apiFetch(`/api/deals/compare?ids=${ids.join(',')}`),
  stressTest: (id) => apiFetch(`/api/deals/${id}/stress`),

  // Question answers — interactive Q&A round-trip with the orchestrator
  answerQuestion: (dealId, questionId, body) =>
    apiFetch(`/api/deals/${dealId}/questions/${encodeURIComponent(questionId)}/answer`, {
      method: 'POST', body: JSON.stringify(body),
    }),
  clearAnswer: (dealId, questionId) =>
    apiFetch(`/api/deals/${dealId}/questions/${encodeURIComponent(questionId)}/answer`, {
      method: 'DELETE',
    }),
  listAnswers: (dealId) => apiFetch(`/api/deals/${dealId}/answers`),

  // Auth
  getMe: () => apiFetch('/api/me'),
};

export default api;
