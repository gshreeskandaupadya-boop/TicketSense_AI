import React from 'react';

const P_MAP = { Low: 'p-low', Medium: 'p-med', High: 'p-high', Critical: 'p-crit' };

export function PriorityBadge({ p }) {
  return <span className={`badge ${P_MAP[p] || 'p-med'}`}>{p}</span>;
}

export function ConfidenceBar({ v }) {
  const pct = Math.round(v * 100);
  const color = v >= 0.75 ? '#22c55e' : v >= 0.5 ? '#eab308' : '#ef4444';
  return (
    <div className="conf">
      <div className="conf-track">
        <div className="conf-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="conf-label" style={{ color }}>{pct}%</span>
    </div>
  );
}

export function ActionBadge({ action }) {
  return action === 'auto_route'
    ? <span className="badge action-auto">✓ Auto-routed</span>
    : <span className="badge action-review">⏸ Held for review</span>;
}
