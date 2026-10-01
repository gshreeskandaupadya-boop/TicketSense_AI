import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client.js';
import { pct } from '../constants.js';

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

function MetricRow({ label, value, sub }) {
  return (
    <li>
      <span className="metric-label">{label}</span>
      <b>{value}</b>
      {sub && <span className="metric-sub">{sub}</span>}
    </li>
  );
}

function Confusion({ m }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>actual \ pred</th>
            {PRIORITIES.map((p) => <th key={p}>{p}</th>)}
          </tr>
        </thead>
        <tbody>
          {PRIORITIES.map((a) => (
            <tr key={a}>
              <td><strong>{a}</strong></td>
              {PRIORITIES.map((p) => (
                <td
                  key={p}
                  style={{
                    textAlign: 'center',
                    background: a === p && m[a]?.[p] > 0 ? 'rgba(34,197,94,0.1)' : undefined,
                    color: a === p && m[a]?.[p] > 0 ? '#86efac' : undefined,
                    fontWeight: a === p ? 600 : 400,
                  }}
                >
                  {m[a]?.[p] ?? 0}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EvalStats() {
  const [stats, setStats] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const load = useCallback(() => {
    api.stats().then(setStats).catch(() => {});
    api.eval().then(setMetrics).catch(() => {});
  }, []);

  useEffect(load, [load]);

  const runEval = async () => {
    setBusy(true); setErr(null);
    try { const r = await api.runEval(); setMetrics(r); load(); }
    catch (x) { setErr(x.message); }
    finally { setBusy(false); }
  };

  const STAT_ITEMS = stats ? [
    ['Corpus', stats.corpusSize],
    ['Eval set', stats.evalSize],
    ['Decisions', stats.decisions],
    ['Auto-routed', stats.autoRouted],
    ['Pending review', stats.pendingReview],
    ['Overridden', stats.overridden],
    [`${Math.round(stats.overrideRate * 100)}%`, 'Override rate'],
  ] : [];

  return (
    <div>
      <div className="row between" style={{ marginBottom: 18 }}>
        <h2>Evaluation & Stats</h2>
        <button className="btn primary" onClick={runEval} disabled={busy}>
          {busy ? '⏳ Running…' : '▶ Run held-out eval'}
        </button>
      </div>

      {err && <p className="msg-err">{err}</p>}

      {/* ── Live counters ── */}
      {stats && (
        <div className="stat-grid">
          {[
            ['Corpus', stats.corpusSize],
            ['Eval set', stats.evalSize],
            ['Decisions', stats.decisions],
            ['Auto-routed', stats.autoRouted],
            ['Pending review', stats.pendingReview],
            ['Overridden', stats.overridden],
            ['Override rate', `${Math.round(stats.overrideRate * 100)}%`],
          ].map(([k, v]) => (
            <div className="stat" key={k}>
              <div className="stat-v">{v}</div>
              <div className="stat-k">{k}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Eval results ── */}
      {metrics && metrics.calibration && (
        <div className="card slide-up">
          <h3>Held-out evaluation — n={metrics.n}</h3>

          <ul className="metrics-list">
            <MetricRow
              label="Priority exact accuracy"
              value={pct(metrics.priorityExactAccuracy)}
              sub={`majority baseline ${pct(metrics.majorityBaseline)}`}
            />
            <MetricRow label="Priority ±1 accuracy" value={pct(metrics.priorityWithin1Accuracy)} />
            <MetricRow label="Routing (queue) accuracy" value={pct(metrics.routingAccuracy)} />
            <MetricRow
              label="Auto-route rate"
              value={pct(metrics.autoRouteRate)}
              sub={`high-risk hold rate ${pct(metrics.highRiskRate)}`}
            />
          </ul>

          <div className="msg-warn" style={{ marginTop: 14 }}>
            The priority labels in this dataset are not content-predictable (5-fold CV ≈ 21% vs 27% baseline).
            TicketSense leads with traceable, correct routing and keeps humans in the loop for priority.
          </div>

          <h4>Calibration — accuracy by confidence bucket</h4>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Confidence</th><th>n</th><th>Accuracy</th><th>Auto-route rate</th></tr>
              </thead>
              <tbody>
                {metrics.calibration.map((b) => (
                  <tr key={b.bucket}>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace" }}>{b.bucket}</td>
                    <td>{b.n}</td>
                    <td>{b.accuracy == null ? '—' : pct(b.accuracy)}</td>
                    <td>{b.autoRouteRate == null ? '—' : pct(b.autoRouteRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4>Confusion matrix (actual → predicted)</h4>
          <Confusion m={metrics.confusion} />
        </div>
      )}

      {metrics && !metrics.calibration && (
        <p className="msg-err">{metrics.error || 'No eval data yet — run the evaluation above.'}</p>
      )}
    </div>
  );
}
