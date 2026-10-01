// Central configuration.
// Everything is env-driven with safe defaults so the backend
// can run locally with minimal setup and also deploy cleanly on Render.

import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..');

function bool(v, d = false) {
  if (v === undefined || v === null || v === '') return d;
  return /^(1|true|yes|on)$/i.test(String(v).trim());
}

function num(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

/*
 * IMPORTANT FOR RENDER
 *
 * Render provides the PORT environment variable.
 * Locally, PORT normally does not exist, so we fall back to 3001.
 */
const port = num(process.env.PORT, 3001);

export const config = {
  // Server
  port,

  // Project paths
  repoRoot,
  backendRoot,

  // Built frontend
  frontendDist: path.join(repoRoot, 'frontend', 'dist'),

  // Data
  dataDir: process.env.DATA_DIR
    ? path.resolve(backendRoot, process.env.DATA_DIR)
    : path.join(backendRoot, 'data'),

  storeFile: 'store.json',
  indexMetaFile: 'index_meta.json',
  generatedCsv: 'tickets.generated.csv',

  // OpenAI (optional)
  openaiKey: process.env.OPENAI_API_KEY || '',
  openaiEmbedModel:
    process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small',
  openaiChatModel:
    process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',

  useOpenAI: bool(process.env.OPENAI_API_KEY, false),

  // Gating
  autoRouteThreshold: num(
    process.env.AUTO_ROUTE_THRESHOLD,
    0.75
  ),

  // Local embedder
  embedDim: num(process.env.EMBED_DIM, 1024),

  // MongoDB (optional)
  mongoUri: process.env.MONGODB_URI || '',
  useMongo: bool(process.env.MONGODB_URI, false),

  // Frontend origin
  clientOrigin:
    process.env.CLIENT_ORIGIN || 'http://localhost:5173',
};

export const paths = {
  store: path.join(config.dataDir, config.storeFile),

  indexMeta: path.join(
    config.dataDir,
    config.indexMetaFile
  ),

  csv: path.join(
    config.dataDir,
    'customer_support_tickets.csv'
  ),

  generatedCsv: path.join(
    config.dataDir,
    config.generatedCsv
  ),
};
