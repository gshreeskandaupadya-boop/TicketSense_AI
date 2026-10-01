// TicketSense backend — process bootstrap.
// Confidence-Gated AI Decision Engine for Business Data (PS-04).
//
//   npm start            (from repo root or backend/)
//
// Wiring only: the Express app lives in app.js, config in config.js.

import { config } from './config.js';
import { store } from './db/store.js';
import { connectMongo } from './db/mongo.js';
import { createApp } from './app.js';

async function start() {
  await connectMongo(); // optional; falls back to JSON store
  store.load();

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`TicketSense API listening on http://localhost:${config.port}`);
    console.log(`  docs    : http://localhost:${config.port}/api/docs`);
    console.log(`  embedder=${store.state.meta.embedder || '(not built yet)'} corpus=${store.getCorpus().length}`);
    if (!store.state.meta.embedder) {
      console.warn('  ⚠ No index found. Run `npm run data:build` (repo root) before using the API.');
    }
  });
}

start().catch((e) => {
  console.error('Failed to start server:', e);
  process.exit(1);
});
