import React, { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import { DecisionCard } from '../components/DecisionCard.jsx';
import { TYPES, CHANNELS } from '../constants.js';

const FALLBACK_EXAMPLES = [
  {
    label: 'Routine tech',
    ticket: { type: 'Technical issue', subject: 'Product setup', product: 'GoPro Hero', channel: 'Chat', description: "I'm having an issue with the GoPro Hero. Please assist." },
  },
  {
    label: 'Refund request',
    ticket: { type: 'Refund request', subject: 'Request refund', product: 'Adobe Creative Cloud', channel: 'Email', description: 'I want a refund for Adobe Creative Cloud as it did not meet my expectations.' },
  },
];

const EMPTY = { type: 'Technical issue', subject: '', product: '', channel: 'Email', description: '' };

export function NewTicket() {
  const [form, setForm] = useState(EMPTY);
  const [decision, setDecision] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [examples, setExamples] = useState(FALLBACK_EXAMPLES);

  useEffect(() => { api.examples().then(setExamples).catch(() => {}); }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { setDecision(await api.ingest(form)); }
    catch (x) { setErr(x.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid2">
      {/* ── Form ── */}
      <form className="card" onSubmit={submit}>
        <h3>Submit a ticket</h3>

        <label>
          Type
          <select value={form.type} onChange={set('type')}>
            {TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>

        <label>
          Subject
          <input value={form.subject} onChange={set('subject')} placeholder="e.g. Cannot log in" />
        </label>

        <label>
          Product
          <input value={form.product} onChange={set('product')} placeholder="e.g. Dell XPS 15" />
        </label>

        <label>
          Channel
          <select value={form.channel} onChange={set('channel')}>
            {CHANNELS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>

        <label>
          Description
          <textarea
            rows={4}
            value={form.description}
            onChange={set('description')}
            placeholder="Describe the issue in detail…"
          />
        </label>

        <div className="row gap wrap mt-s">
          <button className="btn primary" disabled={busy}>
            {busy ? '⏳ Deciding…' : '⚡ Decide'}
          </button>
          <span className="muted" style={{ alignSelf: 'center' }}>Quick load:</span>
          {examples.map((ex) => (
            <button
              type="button"
              className="btn ghost"
              key={ex.label}
              onClick={() => setForm(ex.ticket)}
            >
              {ex.label}
            </button>
          ))}
        </div>

        {err && <p className="msg-err">{err}</p>}
      </form>

      {/* ── Result panel ── */}
      <div>
        <h3>Decision</h3>
        {decision
          ? <DecisionCard d={decision} />
          : (
            <div className="empty-state">
              <span className="empty-icon">🎯</span>
              <p>Submit a ticket to see the confidence-gated decision, cited evidence, and routing action.</p>
            </div>
          )
        }
      </div>
    </div>
  );
}
