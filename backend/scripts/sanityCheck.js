// Day 1 — Sanity-check the retrieval pipeline.
//
//   node scripts/sanityCheck.js
//
// Loads the built index and runs hybrid retrieval for a few sample queries
// (both real corpus tickets and crafted ones) so you can eyeball that the
// semantic + structural matching returns sensible neighbours.

import { config, paths } from '../src/config.js';
import { store } from '../src/db/store.js';
import { embedOne, idfFromMeta } from '../src/retrieval/embeddings.js';
import { retrieve } from '../src/retrieval/hybridRetrieval.js';
import { normalizeTicket } from '../src/ingestion/normalize.js';

async function query(store, text, meta, extra = {}) {
  const ticket = normalizeTicket({ subject: extra.subject || '', type: extra.type || '', product: extra.product || '', channel: extra.channel || '', description: text });
  const emb = await embedOne(ticket.text, { idf: idfFromMeta(meta.idf), dim: meta.embedDim, mode: meta.embedder });
  ticket.embedding = emb;
  const neighbors = retrieve(ticket, store.getCorpus(), 5);
  console.log(`\n=== QUERY: ${ticket.subject || ticket.text.slice(0, 60)} ===`);
  console.log(`   type=${ticket.type} product=${ticket.product} channel=${ticket.channel}`);
  neighbors.forEach((n, i) =>
    console.log(
      `   ${i + 1}. comb=${n.combined} sem=${n.semantic} struct=${n.structural} | #${n.ticketId} "${n.subject}" [${n.type}/${n.priority}]`
    )
  );
  return neighbors;
}

async function main() {
  store.load();
  const meta = store.state.meta;
  if (!meta.embedder) {
    console.error('No index found. Run `npm run data:build` first.');
    process.exit(1);
  }
  const corpus = store.getCorpus();
  console.log(`[sanity] embedder=${meta.embedder} dim=${meta.embedDim} corpus=${corpus.length}`);

  // 1) A real corpus ticket as the query (should match its near-twins).
  const sample = corpus[Math.floor(corpus.length / 2)];
  await query(store, sample.description, meta, {
    subject: sample.subject,
    type: sample.type,
    product: sample.product,
    channel: sample.channel,
  });

  // 2) Crafted billing/refund query.
  await query(store, 'I was charged twice for my subscription and want a refund.', meta, {
    subject: 'Duplicate charge refund',
    type: 'Refund request',
    product: 'Adobe Creative Cloud',
    channel: 'Email',
  });

  // 3) Crafted technical query.
  await query(store, 'The laptop will not power on after the latest update, it keeps crashing.', meta, {
    subject: 'Device crash after update',
    type: 'Technical issue',
    product: 'Dell XPS',
    channel: 'Chat',
  });

  console.log('\n[sanity] OK — review the matches above.');
}

main().catch((e) => {
  console.error('[sanity] failed:', e);
  process.exit(1);
});
