// REST API for TicketSense.
import express from 'express';
import { store } from '../db/store.js';
import { embedOne, idfFromMeta } from '../retrieval/embeddings.js';
import { retrieve } from '../retrieval/hybridRetrieval.js';
import { normalizeTicket } from '../ingestion/normalize.js';
import { decide } from '../decision/decisionCore.js';
import { gate } from '../decision/confidenceGate.js';
import { runEval } from '../eval/evalHarness.js';
import { docs } from './docs.js';

export const api = express.Router();

// API documentation: GET /api/docs + GET /api/openapi.json
api.use(docs);

// cache idf map from meta
function idfMap() {
  return idfFromMeta(store.state.meta.idf);
}

function embedderMode() {
  return store.state.meta.embedder || 'local';
}
function embedDim() {
  return store.state.meta.embedDim;
}

api.get('/health', (_req, res) => {
  res.json({
    ok: true,
    embedder: embedderMode(),
    embedDim: embedDim(),
    corpusSize: store.getCorpus().length,
    evalSize: store.getEval().length,
    decisions: store.state.decisions.length,
  });
});

// Real corpus tickets surfaced as "try an example" seeds for the demo. These
// are guaranteed to have a strong historical twin, so one will auto-route and
// the refund/cancellation one will be held for review (both gate outcomes).
api.get('/examples', (_req, res) => {
  const corpus = store.getCorpus();
  const want = ['Technical issue', 'Refund request', 'Billing inquiry'];
  const picked = want
    .map((ty) => corpus.find((t) => t.type === ty))
    .filter(Boolean)
    .map((t) => ({
      ticketId: t.ticketId,
      type: t.type,
      subject: t.subject,
      product: t.product,
      channel: t.channel,
      description: t.description,
    }));
  res.json(picked);
});

// ---- Ingest + decide (full pipeline) ----
api.post('/tickets/ingest', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.subject && !body.description && !body.type) {
      return res.status(400).json({ error: 'Provide at least type/subject/description.' });
    }
    const ticket = normalizeTicket(body);
    const emb = await embedOne(ticket.text, { idf: idfMap(), dim: embedDim(), mode: embedderMode() });
    ticket.embedding = emb;

    const corpus = store.getCorpus();
    const neighbors = retrieve(ticket, corpus, 6);
    const decision = await decide({ ticket, neighbors, priorityModel: store.state.meta.priorityModel });
    const routing = gate({ ...decision, type: ticket.type, subject: ticket.subject, description: ticket.description });

    const decisionId = `D-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
    const entry = {
      decisionId,
      ticketId: ticket.ticketId,
      createdAt: new Date().toISOString(),
      model: decision.model,
      incoming: {
        type: ticket.type,
        subject: ticket.subject,
        product: ticket.product,
        channel: ticket.channel,
        description: ticket.description,
      },
      retrieved: neighbors,
      decision,
      routing,
      status: routing.action === 'auto_route' ? 'auto_routed' : 'pending_review',
      humanOverride: null,
    };
    store.addDecision(entry);

    res.json(entry);
  } catch (e) {
    console.error('[ingest] error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ---- Evidence Ledger ----
api.get('/ledger', (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.action) filter.action = req.query.action;
  res.json(store.getDecisions(filter));
});

api.get('/ledger/:id', (req, res) => {
  const d = store.getDecision(req.params.id);
  if (!d) return res.status(404).json({ error: 'not found' });
  res.json(d);
});

// Human approves a held ticket (no change to AI decision).
api.post('/ledger/:id/approve', (req, res) => {
  const d = store.updateDecision(req.params.id, { status: 'approved', approvedBy: (req.body || {}).by || 'reviewer' });
  if (!d) return res.status(404).json({ error: 'not found' });
  res.json(d);
});

// Human overrides the AI priority/queue -> flagged as a "miss" case.
api.post('/ledger/:id/override', (req, res) => {
  const body = req.body || {};
  if (!body.priority && !body.queue) return res.status(400).json({ error: 'Provide priority and/or queue.' });
  const d = store.updateDecision(req.params.id, {
    status: 'overridden',
    humanOverride: {
      priority: body.priority || undefined,
      queue: body.queue || undefined,
      by: body.by || 'reviewer',
      at: new Date().toISOString(),
      note: body.note || '',
    },
  });
  if (!d) return res.status(404).json({ error: 'not found' });
  res.json(d);
});

// ---- Queues ----
api.get('/queue/review', (_req, res) => {
  res.json(store.getDecisions({ action: 'hold_for_review' }).filter((d) => d.status === 'pending_review'));
});
api.get('/queue/auto', (_req, res) => {
  res.json(store.getDecisions({ action: 'auto_route' }));
});

// ---- Stats + Eval ----
api.get('/stats', (_req, res) => {
  res.json({ ...store.stats(), metrics: store.getMetrics() });
});

api.post('/eval/run', async (_req, res) => {
  try {
    const m = await runEval(store);
    store.setMetrics(m);
    res.json(m);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

api.get('/eval', (_req, res) => {
  res.json(store.getMetrics() || { error: 'No eval run yet. POST /api/eval/run' });
});
