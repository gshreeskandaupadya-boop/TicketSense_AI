// Hybrid Retrieval (Pipeline stage 2).
// Combines semantic similarity (cosine over embeddings) with structural
// similarity (same product / type / channel / status). Structural matching is
// the cheap, real differentiator vs. pure-semantic RAG.

import { cosine } from './cosine.js';

// Structural weights. "Customer tier" does not exist in this dataset, so we
// use the fields that DO exist: Product Purchased, Ticket Type, Ticket Channel.
const STRUCT = {
  product: 1.0,
  type: 0.7,
  channel: 0.5,
  status: 0.3,
};
const STRUCT_MAX = Object.values(STRUCT).reduce((a, b) => a + b, 0);

function structuralScore(a, b) {
  let s = 0;
  if (a.product && b.product && a.product.toLowerCase() === b.product.toLowerCase()) s += STRUCT.product;
  if (a.type && b.type && a.type.toLowerCase() === b.type.toLowerCase()) s += STRUCT.type;
  if (a.channel && b.channel && a.channel.toLowerCase() === b.channel.toLowerCase()) s += STRUCT.channel;
  if (a.status && b.status && a.status.toLowerCase() === b.status.toLowerCase()) s += STRUCT.status;
  return s / STRUCT_MAX; // -> [0,1]
}

export function makeSnippet(t) {
  const desc = (t.description || '').slice(0, 160);
  return `Ticket #${t.ticketId} — "${t.subject || 'no subject'}" (${t.type || 'n/a'}, ${t.priority || 'n/a'}): ${desc}`;
}

// corpus: array of normalized tickets that carry `.embedding`
// ticket: incoming normalized ticket (with `.embedding`)
// returns top-k with score breakdown + evidence snippet.
export function retrieve(ticket, corpus, k = 6) {
  const scored = corpus.map((c) => {
    const semantic = cosine(ticket.embedding, c.embedding);
    const structural = structuralScore(ticket, c);
    const combined = 0.6 * semantic + 0.4 * structural;
    return {
      ticketId: c.ticketId,
      semantic: round(semantic),
      structural: round(structural),
      combined: round(combined),
      priority: c.priority,
      type: c.type,
      product: c.product,
      channel: c.channel,
      subject: c.subject,
      snippet: makeSnippet(c),
    };
  });
  scored.sort((a, b) => b.combined - a.combined);
  return scored.slice(0, k);
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}
