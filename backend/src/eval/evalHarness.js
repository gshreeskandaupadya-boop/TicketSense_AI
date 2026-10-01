// Evaluation Harness (Day 3).
//
// Scores system-assigned PRIORITY against the REAL held-out dataset labels,
// reports routing distribution, and — to prove the confidence gate is
// functional rather than decorative — buckets accuracy by confidence score.
// If higher-confidence buckets are NOT more accurate, the gating is broken;
// the report surfaces that honestly.

import { embedTexts, idfFromMeta } from '../retrieval/embeddings.js';
import { retrieve } from '../retrieval/hybridRetrieval.js';
import { decide } from '../decision/decisionCore.js';
import { gate } from '../decision/confidenceGate.js';
import { routeQueue, PRIORITIES } from '../decision/routeMap.js';

const SEVERITY = { Low: 0, Medium: 1, High: 2, Critical: 3 };

function emptyConfusion() {
  const m = {};
  for (const a of PRIORITIES) {
    m[a] = {};
    for (const p of PRIORITIES) m[a][p] = 0;
  }
  return m;
}

const BUCKETS = [
  { label: '0.00–0.50', lo: 0.0, hi: 0.5 },
  { label: '0.50–0.70', lo: 0.5, hi: 0.7 },
  { label: '0.70–0.85', lo: 0.7, hi: 0.85 },
  { label: '0.85–1.00', lo: 0.85, hi: 1.01 },
];

export async function runEval(store) {
  const meta = store.state.meta;
  const corpus = store.getCorpus();
  const evalTickets = store.getEval();
  if (!corpus.length) throw new Error('No corpus — run `npm run data:build` first.');
  if (!evalTickets.length) throw new Error('No eval split — run `npm run data:build` first.');

  const mode = meta.embedder || 'local';
  const idf = idfFromMeta(meta.idf);
  const dim = meta.embedDim || undefined;

  // Embed eval tickets (corpus already embedded at build time).
  const texts = evalTickets.map((t) => t.text);
  const { vectors } = await embedTexts(texts, { idf, dim, mode });
  evalTickets.forEach((t, i) => (t.embedding = vectors[i]));

  let exact = 0;
  let within1 = 0;
  let auto = 0;
  let review = 0;
  let highRisk = 0;
  let wouldBeMiss = 0;
  let autoCount = 0;
  let routingCorrect = 0;
  const confusion = emptyConfusion();
  const buckets = BUCKETS.map((b) => ({ ...b, n: 0, exact: 0, auto: 0 }));
  const misses = [];

  // Majority baseline (predict the most common priority in the eval set).
  const prioCounts = {};
  for (const t of evalTickets) prioCounts[t.priority] = (prioCounts[t.priority] || 0) + 1;
  const majorityBaseline = Math.max(...Object.values(prioCounts)) / evalTickets.length;

  for (const t of evalTickets) {
    const neighbors = retrieve(t, corpus, 6);
    const decision = await decide({ ticket: t, neighbors, priorityModel: store.state.meta.priorityModel });
    const g = gate({ ...decision, type: t.type, subject: t.subject, description: t.description });
    const actual = t.priority;
    const pred = decision.priority;

    const correct = pred === actual;
    if (correct) exact++;
    if (Math.abs(SEVERITY[pred] - SEVERITY[actual]) <= 1) within1++;
    confusion[actual][pred]++;

    // Routing (queue) accuracy vs the policy-derived expected queue.
    const expectedQueue = routeQueue({ type: t.type, subject: t.subject, description: t.description });
    if (decision.queue === expectedQueue) routingCorrect++;

    if (g.action === 'auto_route') {
      auto++;
      autoCount++;
      if (!correct) {
        wouldBeMiss++;
        misses.push({ ticketId: t.ticketId, actual, pred, confidence: decision.confidence_score });
      }
    } else {
      review++;
    }
    if (g.highRisk) highRisk++;

    // calibration bucket
    const b = buckets.find((x) => decision.confidence_score >= x.lo && decision.confidence_score < x.hi);
    if (b) {
      b.n++;
      if (correct) b.exact++;
      if (g.action === 'auto_route') b.auto++;
    }
  }

  const n = evalTickets.length;
  const calibration = buckets.map((b) => ({
    bucket: b.label,
    n: b.n,
    accuracy: b.n ? Math.round((b.exact / b.n) * 1000) / 1000 : null,
    autoRouteRate: b.n ? Math.round((b.auto / b.n) * 1000) / 1000 : null,
  }));

  // Honest note: manual-triage-time-saved is a PLANNING ESTIMATE (1.5 min/ticket),
  // not measured from the dataset. Flagged as such.
  const EST_MIN_PER_TICKET = 1.5;
  const metrics = {
    generatedAt: new Date().toISOString(),
    embedder: mode,
    n,
    priorityExactAccuracy: round(exact / n),
    priorityWithin1Accuracy: round(within1 / n),
    majorityBaseline: round(majorityBaseline),
    routingAccuracy: round(routingCorrect / n),
    autoRouteRate: round(auto / n),
    reviewRate: round(review / n),
    highRiskRate: round(highRisk / n),
    wouldBeMisses: wouldBeMiss,
    wouldBeMissRateAmongAutoRouted: autoCount ? round(wouldBeMiss / autoCount) : 0,
    calibration,
    confusion,
    sampleMisses: misses.slice(0, 10),
    estimate: {
      manualTriageMinPerTicket: EST_MIN_PER_TICKET,
      autoRoutedTickets: auto,
      estimatedMinutesSavedPerRun: round(auto * EST_MIN_PER_TICKET),
      note: 'ESTIMATE ONLY — not measured from the dataset. Replace with real numbers before submitting.',
    },
  };
  return metrics;
}

function round(x) {
  return Math.round(x * 1000) / 1000;
}
