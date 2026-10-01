// Central configuration. Everything is env-driven with safe defaults so the
// backend runs on a clean machine with zero setup (offline mode).
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..'); // .../backend
const repoRoot = path.resolve(backendRoot, '..'); // repo root

function bool(v, d = false) {
  if (v === undefined || v === null || v === '') return d;
  return /^(1|true|yes|on)$/i.test(String(v).trim());
}
function num(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export const config = {
  port: num(process.env.PORT, 3001),
  repoRoot,
  backendRoot,
  // Built SPA served by the backend in single-service deployments.
  frontendDist: path.join(repoRoot, 'frontend', 'dist'),
  dataDir: process.env.DATA_DIR
    ? path.resolve(backendRoot, process.env.DATA_DIR)
    : path.join(backendRoot, 'data'),
  storeFile: 'store.json',
  indexMetaFile: 'index_meta.json',
  generatedCsv: 'tickets.generated.csv',

  // OpenAI (optional)
  openaiKey: process.env.OPENAI_API_KEY || '',
  openaiEmbedModel: process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small',
  openaiChatModel: process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini',
  useOpenAI: bool(process.env.OPENAI_API_KEY, false),

  // Gating
  autoRouteThreshold: num(process.env.AUTO_ROUTE_THRESHOLD, 0.75),

  // Local embedder
  embedDim: num(process.env.EMBED_DIM, 1024),

  // DB (optional)
  mongoUri: process.env.MONGODB_URI || '',
  useMongo: bool(process.env.MONGODB_URI, false),

  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
};

export const paths = {
  store: path.join(config.dataDir, config.storeFile),
  indexMeta: path.join(config.dataDir, config.indexMetaFile),
  csv: path.join(config.dataDir, 'customer_support_tickets.csv'),
  generatedCsv: path.join(config.dataDir, config.generatedCsv),
};
