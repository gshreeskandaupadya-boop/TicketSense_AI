// TicketSense backend — process bootstrap.
// Confidence-Gated AI Decision Engine for Business Data (PS-04).
//
// npm start            (from repo root or backend/)
//
// Wiring only: the Express app lives in app.js, config in config.js.

import { config } from './config.js';
import { store } from './db/store.js';
import { connectMongo } from './db/mongo.js';
import { createApp } from './app.js';

async function start() {
  try {
    await connectMongo();

    store.load();

    const app = createApp();

    const port = config.port;

    app.listen(port, '0.0.0.0', () => {
      console.log(`TicketSense API listening on port ${port}`);
      console.log(`  docs    : http://localhost:${port}/api/docs`);
      console.log(
        `  embedder=${store.state.meta.embedder || '(not built yet)'} ` +
        `corpus=${store.getCorpus().length}`
      );

      if (!store.state.meta.embedder) {
        console.warn(
          '  ⚠ No index found. Run `npm run data:build` (repo root) before using the API.'
        );
      }
    });
  } catch (e) {
    console.error('Failed to start server:', e);
    process.exit(1);
  }
}

start();
