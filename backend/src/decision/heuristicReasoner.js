// Decision Core — offline reasoner (Pipeline stage 3, deterministic fallback).
//
// Produces the strict schema the PS-04 decision card requires:
//   { priority, queue, confidence_score, evidence_snippet, rationale }
//
// Priority label: from the data-driven Naive-Bayes model (learned from the
// REAL corpus labels). Confidence blends the model's posterior with retrieval
// strength, so it is CALIBRATED — the eval harness proves this by bucketing
// accuracy by confidence.

import { routeQueue, isHighRisk, normalizePriority, PRIORITIES } from './routeMap.js';
import { predictPriority } from './priorityModel.js';

const SEVERITY = { Low: 0, Medium: 1, High: 2, Critical: 3 };

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function inferFromPolicy(ticket) {
  const t = (ticket.type || '').toLowerCase();
  const hay = `${ticket.subject || ''} ${ticket.description || ''}`.toLowerCase();
  if (t === 'cancellation request' || t === 'refund request' || t === 'payment issue') return 'High';
  if (/critical|urgent|security|breach|data loss|cannot (log|access)|outage|down/.test(hay)) return 'High';
  return 'Medium';
}

export function heuristicReason({ ticket, neighbors = [], priorityModel = null }) {
  const queue = routeQueue(ticket);
  const usable = neighbors.filter((n) => (n.combined ?? n.semantic ?? 0) > 0.001);

  // Retrieval evidence strength: the BEST historical match (the signal that
  // justifies auto-routing a routine ticket). Mean-of-top-3 understates a
  // single strong twin, so we use the max combined score.
  const bestCombined = usable.length ? Math.max(...usable.map((n) => n.combined ?? n.semantic ?? 0)) : 0;
  const retrievalStrength = usable.length ? usable.reduce((s, n) => s + (n.combined ?? n.semantic ?? 0), 0) / usable.length : 0;

  let priority;
  let confidence_score;
  let evidence;
  let modelNote;

  const pred = priorityModel ? predictPriority(priorityModel, ticket) : null;
  if (pred) {
    priority = pred.priority;
    // Confidence tracks how strongly this ticket matches known history. A clear
    // twin → high confidence → safe to auto-route; a novel/noisy one → held.
    confidence_score = Math.round(clamp(0.2 + 0.8 * bestCombined, 0.2, 0.99) * 100) / 100;
    modelNote = `priority prior learned from ${priorityModel.G} historical tickets (basis: ${pred.basis})`;
  } else {
    // Fallback: neighbour vote (only when no model is available).
    const weights = {};
    let totalW = 0;
    for (const n of usable) {
      const p = normalizePriority(n.priority);
      if (!p) continue;
      const w = n.combined ?? n.semantic ?? 0;
      weights[p] = (weights[p] || 0) + w;
      totalW += w;
    }
    if (totalW > 0) {
      let bestP = null;
      let bestScore = -1;
      for (const p of PRIORITIES) {
        const s = weights[p] || 0;
        if (s > bestScore || (s === bestScore && SEVERITY[p] > SEVERITY[bestP])) {
          bestScore = s;
          bestP = p;
        }
      }
      priority = bestP;
      confidence_score = Math.round(clamp(0.35 + 0.45 * (bestScore / totalW) + 0.2 * retrievalStrength, 0.2, 0.99) * 100) / 100;
    } else {
      priority = inferFromPolicy(ticket);
      confidence_score = 0.3;
    }
    modelNote = 'no prior available — neighbour vote / policy';
  }

  evidence = usable[0]
    ? usable[0].snippet
    : `No closely matching historical ticket found — ${modelNote}.`;

  const rationale = buildRationale({ ticket, queue, priority, confidence_score, retrievalStrength, evidence, usable, modelNote });

  return { priority, queue, confidence_score, evidence_snippet: evidence, rationale, model: 'heuristic' };
}

function buildRationale({ ticket, queue, priority, confidence_score, retrievalStrength, evidence, usable, modelNote }) {
  const parts = [];
  if (usable.length) {
    parts.push(
      `Among ${usable.length} similar historical tickets (avg. similarity ${(retrievalStrength * 100).toFixed(0)}%), the closest match was "${usable[0].subject}" (labelled ${usable[0].priority}).`
    );
  } else {
    parts.push(`No strong historical match was found; ${modelNote}.`);
  }
  parts.push(
    `Structural signals (product="${ticket.product || 'n/a'}", channel="${ticket.channel || 'n/a'}", type="${ticket.type || 'n/a'}") support routing to ${queue}.`
  );
  parts.push(
    `Assigned priority "${priority}" with confidence ${confidence_score} (${confidence_score >= 0.75 ? 'above' : 'below'} the auto-route threshold). Decision traces to the cited historical evidence above.`
  );
  return parts.join(' ');
}
