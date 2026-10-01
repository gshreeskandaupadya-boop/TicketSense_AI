// Loads the Kaggle CSV (suraj520) and produces: a normalized corpus, a
// deterministic held-out EVAL split (real ground-truth labels), and an
// optional synthetic augmentation set.
//
// Honesty note: the eval split uses the REAL dataset labels. The synthetic
// set (when generated) is clearly flagged split:'synthetic' and is NEVER used
// as ground truth.

import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { paths, config } from '../config.js';
import { normalizeTicket } from './normalize.js';

// Seedable PRNG (mulberry32) so the eval split is identical across runs.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function loadCsvRows(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const records = parse(raw, { columns: true, skip_empty_lines: true, relax_quotes: true });
  return records;
}

// Deterministic STRATIFIED eval split: hold out the same fraction of every
// priority class so corpus and eval share the overall class distribution.
// This avoids the small-dataset trap where a random split makes the corpus
// mode differ from the eval mode and unfairly depresses accuracy vs baseline.
export function makeStratifiedEvalSplit(rows, evalFrac = 0.4, seed = 42) {
  const rng = mulberry32(seed);
  const byClass = {};
  rows.forEach((row, i) => {
    const key = row['Ticket Priority'] || 'Unknown';
    (byClass[key] = byClass[key] || []).push(i);
  });
  const evalIdx = new Set();
  for (const key of Object.keys(byClass)) {
    const arr = byClass[key];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const take = Math.round(arr.length * evalFrac);
    arr.slice(0, take).forEach((i) => evalIdx.add(i));
  }
  return evalIdx;
}

// Returns { corpus, eval, all } of normalized tickets (no embeddings yet).
export function loadDataset({ csvPath = paths.csv, evalSize = 40, seed = 42 } = {}) {
  const rows = loadCsvRows(csvPath);
  const evalFrac = Math.min(0.5, Math.max(0.1, evalSize / rows.length));
  const evalSet = makeStratifiedEvalSplit(rows, evalFrac, seed);
  const corpus = [];
  const evalTickets = [];
  rows.forEach((row, i) => {
    const t = normalizeTicket(row);
    if (evalSet.has(i)) {
      t.split = 'eval';
      evalTickets.push(t);
    } else {
      t.split = 'corpus';
      corpus.push(t);
    }
  });
  return { corpus, eval: evalTickets, all: [...corpus, ...evalTickets], source: path.basename(csvPath) };
}
