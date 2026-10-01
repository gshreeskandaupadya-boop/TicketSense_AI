// TicketSense frontend API client.
//
// Deploy notes (this is where "it gets stuck" usually comes from):
//   • In local dev, Vite proxies /api → http://localhost:3001 (see vite.config.js).
//   • When the frontend is deployed separately (e.g. Vercel), you MUST set
//     VITE_API_URL to the deployed backend origin (e.g. https://ticketsense.onrender.com).
//     It is baked in at BUILD time — changing it later requires a rebuild.
//   • When the backend serves the built SPA (single-service Render deploy),
//     leave VITE_API_URL empty — relative URLs are correct.
//
// Every request has a hard timeout and throws a descriptive ApiError so the UI
// shows *what* is wrong instead of spinning forever.

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const TIMEOUT_MS = 15000;

/** Absolute base the client is calling (shown in error messages / status bar). */
export const apiBase = API_URL || '(same origin)';

export class ApiError extends Error {
  constructor(message, { status = 0, cause = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.cause = cause;
  }
}

async function req(path, { method = 'GET', body, timeout = TIMEOUT_MS } = {}) {
  const url = `${API_URL}/api${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch (e) {
    const reason =
      e.name === 'AbortError'
        ? `no response after ${timeout / 1000}s`
        : e.cause?.code || e.message || 'network error';
    throw new ApiError(
      `Cannot reach the API at ${url} (${reason}). ` +
        (API_URL
          ? `Check that the backend is up and VITE_API_URL is correct (currently "${API_URL}").`
          : 'Set VITE_API_URL to the deployed backend URL when hosting the frontend separately.'),
      { cause: e }
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new ApiError(e.error || `HTTP ${res.status} from ${url}`, { status: res.status });
  }
  return res.json();
}

export const api = {
  health: () => req('/health'),
  examples: () => req('/examples'),
  ingest: (ticket) => req('/tickets/ingest', { method: 'POST', body: ticket }),
  ledger: (query = '') => req(`/ledger${query}`),
  decision: (id) => req(`/ledger/${id}`),
  approve: (id, by) => req(`/ledger/${id}/approve`, { method: 'POST', body: { by } }),
  override: (id, payload) => req(`/ledger/${id}/override`, { method: 'POST', body: payload }),
  reviewQueue: () => req('/queue/review'),
  autoQueue: () => req('/queue/auto'),
  stats: () => req('/stats'),
  runEval: () => req('/eval/run', { method: 'POST', timeout: 60000 }),
  eval: () => req('/eval'),
};
