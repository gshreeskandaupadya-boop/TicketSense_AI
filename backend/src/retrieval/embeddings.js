// Embeddings (Pipeline stage 2 — semantic half).
//
// Two modes, selected by OPENAI_API_KEY:
//   • OpenAI  : text-embedding-3-small (1536-d). Real semantic vectors.
//   • Offline : deterministic hashed TF-IDF (default 1024-d). No network,
//               no API key. Good enough for a hackathon-sized corpus and
//               makes the whole pipeline demoable anywhere.
//
// The embedder mode is fixed at `buildIndex` time and recorded in
// index_meta.json so corpus + queries always share one space.

import crypto from 'node:crypto';
import { config } from '../config.js';

// ---- deterministic string hash -> [0, dim) ----
function hashToken(token, dim) {
  const h = crypto.createHash('sha1').update(token).digest();
  // fold 20 bytes into a 32-bit int
  let x = (h[0] << 24) | (h[1] << 16) | (h[2] << 8) | h[3];
  x >>>= 0;
  return x % dim;
}

export function tokenize(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const words = lower.split(/[^a-z0-9]+/).filter((w) => w.length >= 2);
  const unigrams = words;
  const bigrams = [];
  for (let i = 0; i < words.length - 1; i++) bigrams.push(words[i] + ' ' + words[i + 1]);
  return unigrams.concat(bigrams);
}

// Build an IDF table from a list of texts.
export function buildIdf(texts, dim) {
  const df = new Map();
  const N = texts.length;
  for (const t of texts) {
    const seen = new Set(tokenize(t));
    for (const tok of seen) {
      const key = hashToken(tok, dim);
      df.set(key, (df.get(key) || 0) + 1);
    }
  }
  const idf = new Map();
  for (const [key, d] of df) idf.set(key, Math.log((N + 1) / (d + 1)) + 1);
  return idf;
}

// Local hashed TF-IDF embedding.
export function localEmbed(text, idf, dim) {
  const tf = new Map();
  for (const tok of tokenize(text)) {
    const key = hashToken(tok, dim);
    tf.set(key, (tf.get(key) || 0) + 1);
  }
  const vec = new Array(dim).fill(0);
  for (const [key, count] of tf) {
    // idf keys may arrive as numbers (built) or strings (reloaded from JSON).
    const idfVal = (idf && (idf.get(String(key)) ?? idf.get(key))) ?? 1.0;
    vec[key] += (1 + Math.log(count)) * idfVal;
  }
  // L2 normalize
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  return vec;
}

// ---- OpenAI path (lazy import so the app runs without the dep installed) ----
let _openai = null;
async function getOpenAI() {
  if (_openai) return _openai;
  if (!config.openaiKey) return null;
  try {
    const mod = await import('openai');
    _openai = new mod.default({ apiKey: config.openaiKey });
    return _openai;
  } catch (e) {
    return null;
  }
}

export async function openaiEmbed(texts) {
  const client = await getOpenAI();
  if (!client) throw new Error('OpenAI client unavailable');
  const resp = await client.embeddings.create({
    model: config.openaiEmbedModel,
    input: texts,
  });
  return resp.data.map((d) => d.embedding);
}

// Unified embedder. Returns { vectors, mode, dim }.
// For local mode, pass the prebuilt `idf` + `dim`. For OpenAI, pass texts.
export async function embedTexts(texts, { idf, dim, mode } = {}) {
  if (mode === 'openai' && config.openaiKey) {
    try {
      const vectors = await openaiEmbed(texts);
      return { vectors, mode: 'openai', dim: vectors[0]?.length || config.embedDim };
    } catch (e) {
      // fall through to local if OpenAI fails
      console.warn('[embeddings] OpenAI failed, falling back to local:', e.message);
    }
  }
  const useIdf = idf || new Map();
  const useDim = dim || config.embedDim;
  const vectors = texts.map((t) => localEmbed(t, useIdf, useDim));
  return { vectors, mode: 'local', dim: useDim };
}

export async function embedOne(text, { idf, dim, mode } = {}) {
  const { vectors } = await embedTexts([text], { idf, dim, mode });
  return vectors[0];
}

// Convert the stored idf (plain object after JSON round-trip) back to a Map.
export function idfFromMeta(metaIdf) {
  if (!metaIdf) return null;
  if (metaIdf instanceof Map) return metaIdf;
  return new Map(Object.entries(metaIdf));
}
