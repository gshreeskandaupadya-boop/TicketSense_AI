import React, { useState, useEffect } from 'react';
import { api, apiBase } from './api/client.js';
import { NewTicket }    from './views/NewTicket.jsx';
import { ReviewQueue }  from './views/ReviewQueue.jsx';
import { Ledger }       from './views/Ledger.jsx';
import { EvalStats }    from './views/EvalStats.jsx';

const TABS = [
  { id: 'new',    label: 'New Ticket',     icon: '⚡' },
  { id: 'review', label: 'Review Queue',   icon: '🔍' },
  { id: 'ledger', label: 'Evidence Ledger',icon: '📋' },
  { id: 'eval',   label: 'Eval & Stats',   icon: '📊' },
];

export default function App() {
  const [tab, setTab] = useState('new');
  const [health, setHealth] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    api.health()
      .then((h) => { setHealth(h); setApiError(null); })
      .catch((e) => setApiError(e.message));
  }, []);

  const onMutate = () => setRefreshKey((k) => k + 1);

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-brand">
          <div className="header-logo">🎯</div>
          <div>
            <h1>TicketSense</h1>
            <div className="header-sub">Confidence-gated triage · hybrid retrieval · PS-04</div>
          </div>
        </div>

        <div className="header-meta">
          {health && (
            <>
              <span className="badge embed">{health.embedder} · {health.corpusSize} tickets</span>
              <span className="badge status-ok">API connected</span>
            </>
          )}
          {!health && !apiError && <span className="badge status-wait">Checking API…</span>}
          {apiError && <span className="badge status-err">API unreachable</span>}
        </div>
      </header>

      {/* ── API error banner ── */}
      {apiError && (
        <div className="err-banner">
          <span>⚠</span>
          <div>
            <strong>Backend not reachable</strong> — {apiError}
            <div className="muted" style={{ marginTop: 4 }}>
              API base: {apiBase} · live docs at <code>/api/docs</code>
            </div>
          </div>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav>
        {TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            className={`tab${tab === id ? ' active' : ''}`}
            onClick={() => setTab(id)}
          >
            {icon} {label}
          </button>
        ))}
      </nav>

      {/* ── Views ── */}
      <main>
        {tab === 'new'    && <NewTicket />}
        {tab === 'review' && <ReviewQueue refreshKey={refreshKey} onMutate={onMutate} />}
        {tab === 'ledger' && <Ledger />}
        {tab === 'eval'   && <EvalStats />}
      </main>

      {/* ── Footer ── */}
      <footer>
        <span>Hybrid retrieval · confidence gate · human-in-the-loop · evidence ledger</span>
        <a href={apiBase !== '(same origin)' ? `${apiBase}/api/docs` : '/api/docs'} target="_blank" rel="noreferrer">API docs ↗</a>
      </footer>
    </div>
  );
}
