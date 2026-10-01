import React, { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { PriorityBadge, ActionBadge } from '../components/badges.jsx';

const fmtTime = (iso) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const STATUS_STYLE = {
  auto_routed:    { background: 'rgba(20,83,45,0.4)',  color: '#86efac' },
  pending_review: { background: 'rgba(113,63,18,0.4)', color: '#fde68a' },
  approved:       { background: 'rgba(20,83,45,0.4)',  color: '#86efac' },
  overridden:     { background: 'rgba(49,46,129,0.4)', color: '#c4b5fd' },
};

export function Ledger() {
  const [list, setList] = useState([]);
  const [err, setErr] = useState(null);

  useEffect(() => { api.ledger().then(setList).catch((e) => setErr(e.message)); }, []);

  return (
    <div>
      <div className="row between" style={{ marginBottom: 18 }}>
        <h2>Evidence Ledger</h2>
        {list.length > 0 && (
          <span className="badge embed">{list.length} entries</span>
        )}
      </div>

      {err && <p className="msg-err">{err}</p>}

      {list.length === 0 && !err
        ? (
          <div className="empty-state">
            <span className="empty-icon">📋</span>
            <p>No decisions logged yet. Submit a ticket to see the evidence ledger populate.</p>
          </div>
        )
        : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Priority</th>
                    <th>Queue</th>
                    <th>Conf</th>
                    <th>Action</th>
                    <th>Status</th>
                    <th>Override</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((d) => {
                    const s = STATUS_STYLE[d.status] || {};
                    return (
                      <tr key={d.decisionId}>
                        <td><span className="ledger-id">{d.decisionId.slice(0, 8)}…</span></td>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-mute)', fontSize: 12 }}>
                          {fmtTime(d.createdAt)}
                        </td>
                        <td>{d.incoming.type}</td>
                        <td><PriorityBadge p={d.decision.priority} /></td>
                        <td style={{ color: 'var(--accent)', fontWeight: 500 }}>{d.decision.queue}</td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                          {Math.round(d.decision.confidence_score * 100)}%
                        </td>
                        <td><ActionBadge action={d.routing.action} /></td>
                        <td>
                          <span className="ledger-status" style={s}>{d.status.replace('_', ' ')}</span>
                        </td>
                        <td style={{ color: 'var(--text-mute)' }}>
                          {d.humanOverride
                            ? `${d.humanOverride.priority} / ${d.humanOverride.queue}`
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      }
    </div>
  );
}
