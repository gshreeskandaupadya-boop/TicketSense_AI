import React, { useState } from 'react';
import { api } from '../api/client.js';
import { PriorityBadge, ConfidenceBar, ActionBadge } from './badges.jsx';
import { PRIORITIES, QUEUES } from '../constants.js';

/**
 * DecisionCard — renders one Evidence Ledger entry with:
 *   • decision overview (priority, queue, action, confidence)
 *   • evidence snippet + rationale
 *   • expandable neighbour table
 *   • human approve / override controls (when status = pending_review)
 */
export function DecisionCard({ d, onMutate }) {
  const [showOverride, setShowOverride] = useState(false);
  const [form, setForm] = useState({ priority: d.decision.priority, queue: d.decision.queue, note: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { type: 'ok'|'err', text }

  const run = (fn) => async () => {
    setBusy(true); setMsg(null);
    try { await fn(); onMutate?.(); }
    catch (e) { setMsg({ type: 'err', text: e.message }); }
    finally { setBusy(false); }
  };

  const doApprove = run(() => api.approve(d.decisionId, 'reviewer'));
  const doOverride = run(async () => {
    await api.override(d.decisionId, form);
    setShowOverride(false);
  });

  const isHeld = d.status === 'pending_review';

  return (
    <div className={`card fade-in${isHeld ? ' held' : ''}`}>
      {/* ── Header row ── */}
      <div className="decision-header">
        <div className="decision-badges">
          <PriorityBadge p={d.decision.priority} />
          <span className="queue-arrow">→ {d.decision.queue}</span>
          <ActionBadge action={d.routing.action} />
        </div>
        <span className="decision-id">#{d.decisionId.slice(0, 12)}</span>
      </div>

      {/* ── Confidence bar ── */}
      <div className="conf-row">
        <span className="dim">Confidence</span>
        <ConfidenceBar v={d.decision.confidence_score} />
      </div>

      {/* ── Evidence ── */}
      {d.decision.evidence_snippet && (
        <div className="field-block">
          <div className="field-label">Evidence</div>
          <div className="evidence-box">"{d.decision.evidence_snippet}"</div>
        </div>
      )}

      {/* ── Rationale ── */}
      {d.decision.rationale && (
        <div className="field-block">
          <div className="field-label">Rationale</div>
          <p className="rationale-text">{d.decision.rationale}</p>
        </div>
      )}

      {/* ── High-risk warning ── */}
      {d.routing.highRisk && (
        <div className="msg-warn">⚠ High-risk — {d.routing.reason}</div>
      )}

      {/* ── Neighbours ── */}
      {d.retrieved?.length > 0 && (
        <details>
          <summary>Retrieved neighbours ({d.retrieved.length})</summary>
          <div className="details-body">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Combined</th><th>Semantic</th><th>Structural</th><th>Subject</th><th>Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {d.retrieved.map((n, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{typeof n.combined === 'number' ? n.combined.toFixed(3) : n.combined}</td>
                      <td>{typeof n.semantic === 'number' ? n.semantic.toFixed(3) : n.semantic}</td>
                      <td>{typeof n.structural === 'number' ? n.structural.toFixed(3) : n.structural}</td>
                      <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.subject}</td>
                      <td><PriorityBadge p={n.priority} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      )}

      {/* ── Status messages ── */}
      {d.status === 'auto_routed' && <p className="msg-ok">✓ Auto-routed — no human action needed.</p>}
      {d.status === 'approved'    && <p className="msg-ok">✓ Approved by human reviewer.</p>}
      {d.status === 'overridden' && d.humanOverride && (
        <div className="msg-warn">
          ✎ Overridden → <strong>{d.humanOverride.priority}</strong> / {d.humanOverride.queue}
          {d.humanOverride.note && <span className="dim"> — "{d.humanOverride.note}"</span>}
        </div>
      )}

      {/* ── Action buttons ── */}
      {isHeld && !showOverride && (
        <div className="row gap mt">
          <button className="btn primary" onClick={doApprove} disabled={busy}>
            {busy ? 'Saving…' : '✓ Approve'}
          </button>
          <button className="btn ghost" onClick={() => setShowOverride(true)} disabled={busy}>
            ✎ Override
          </button>
        </div>
      )}

      {/* ── Override form ── */}
      {showOverride && (
        <div className="override-panel slide-up">
          <h4>Override decision</h4>
          <div className="row gap" style={{ marginBottom: 10 }}>
            <select
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              style={{ flex: 1 }}
            >
              {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
            </select>
            <select
              value={form.queue}
              onChange={(e) => setForm((f) => ({ ...f, queue: e.target.value }))}
              style={{ flex: 1 }}
            >
              {QUEUES.map((q) => <option key={q}>{q}</option>)}
            </select>
          </div>
          <input
            placeholder="Note (optional)"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          />
          <div className="row gap mt">
            <button className="btn primary" onClick={doOverride} disabled={busy}>
              {busy ? 'Saving…' : 'Save override'}
            </button>
            <button className="btn ghost" onClick={() => setShowOverride(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {msg && <p className={msg.type === 'ok' ? 'msg-ok' : 'msg-err'}>{msg.text}</p>}
    </div>
  );
}
