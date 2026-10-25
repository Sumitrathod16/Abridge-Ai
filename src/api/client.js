async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || 'Backend request failed.');
  }
  return data;
}

/** Fetch stage/domain metadata (single source of truth lives on the backend). */
export async function getMeta() {
  const res = await fetch('/api/meta');
  if (!res.ok) throw new Error('Meta request failed.');
  const data = await res.json();
  if (!data?.stages) throw new Error('Meta response malformed.');
  return data;
}

/** Run the full planning pipeline on the backend. Returns { results }. */
export function runPlan(input) {
  return post('/api/plan', input);
}

/** Ask the backend to render a saved record as a downloadable markdown brief. */
export function exportBrief(record) {
  return post('/api/export', record);
}