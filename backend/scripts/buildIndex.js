// Day 1 — Ingestion, normalization, embedding, and index build.
//
//   node scripts/buildIndex.js
//
// Reads the real Kaggle CSV, normalizes every row into the standard shape,
// splits off a deterministic held-out EVAL set (real labels), optionally
// augments the retrieval corpus with the synthetic set, computes embeddings
// (OpenAI if OPENAI_API_KEY set, else local TF-IDF), and writes everything to
// data/store.json. The Evidence Ledger starts empty.

import fs from 'node:fs';
import { config, paths } from '../src/config.js';
import { store } from '../src/db/store.js';
import { connectMongo } from '../src/db/mongo.js';
import { loadDataset, loadCsvRows } from '../src/ingestion/loadDataset.js';
import { normalizeTicket } from '../src/ingestion/normalize.js';
import { embedTexts, buildIdf } from '../src/retrieval/embeddings.js';
import { buildPriorityModel } from '../src/decision/priorityModel.js';

async function main() {
  await connectMongo();
  store.load();
  // A rebuild resets the Evidence Ledger and any prior eval metrics.
  store.state.decisions = [];
  store.state.metrics = null;

  console.log(`[build] loading dataset from ${paths.csv}`);
  const { corpus, eval: evalTickets, all, source } = loadDataset({ csvPath: paths.csv, evalSize: 40 });

  // Optional synthetic augmentation (clearly flagged, never used as ground truth).
  let synthetic = [];
  if (fs.existsSync(paths.generatedCsv)) {
    console.log(`[build] augmenting with synthetic ${paths.generatedCsv}`);
    const rows = loadCsvRows(paths.generatedCsv);
    synthetic = rows.map((r) => {
      const t = normalizeTicket(r);
      t.split = 'synthetic';
      return t;
    });
  }

  const everything = [...all, ...synthetic];
  const mode = config.useOpenAI ? 'openai' : 'local';

  let idf = null;
  const dim = mode === 'local' ? config.embedDim : undefined;
  if (mode === 'local') {
    idf = buildIdf(everything.map((t) => t.text), config.embedDim);
  }

  // Data-driven priority prior learned from the REAL corpus labels.
  const priorityModel = buildPriorityModel(corpus);

  console.log(`[build] embedding ${everything.length} tickets via ${mode} embedder…`);
  const { vectors, mode: actualMode } = await embedTexts(everything.map((t) => t.text), { idf, dim, mode });
  everything.forEach((t, i) => (t.embedding = vectors[i]));
  if (actualMode !== mode) {
    console.warn(`[build] ⚠ requested "${mode}" embedder but "${actualMode}" was used (fallback). Meta records the ACTUAL mode so queries stay in the same vector space.`);
  }

  store.bulkSetTickets(everything);
  store.setMeta({
    embedder: actualMode,
    embedDim: everything[0]?.embedding?.length || config.embedDim,
    builtAt: new Date().toISOString(),
    source,
    idf: actualMode === 'local' ? Object.fromEntries(idf) : null,
    priorityModel,
  });

  console.log('[build] done.');
  console.log(`   corpus (retrieval): ${store.getCorpus().length}`);
  console.log(`   eval (held-out)   : ${store.getEval().length}`);
  console.log(`   synthetic aug     : ${synthetic.length}`);
  console.log(`   embedder / dim    : ${actualMode} / ${store.state.meta.embedDim}`);
}

main().catch((e) => {
  console.error('[build] failed:', e);
  process.exit(1);
});
