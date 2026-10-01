// TicketSense backend — process bootstrap.
// Confidence-Gated AI Decision Engine for Business Data (PS-04).
//
// npm start            (from repo root or backend/)
//
// The Express application itself lives in app.js.
// Configuration lives in config.js.

import { config } from './config.js';
import { store } from './db/store.js';
import { connectMongo } from './db/mongo.js';
import { createApp } from './app.js';

async function start() {
  try {
    // MongoDB is optional.
    // If MongoDB is not configured, the application falls back
    // to the local JSON store.
    await connectMongo();

    // Load existing local data/index information.
    store.load();

    const app = createApp();

    /*
     * Render provides process.env.PORT.
     *
     * config.port already reads:
     *   process.env.PORT || 3001
     *
     * 0.0.0.0 is required so Render can access the application.
     */
    const port = config.port;

    app.listen(port, '0.0.0.0', () => {
      console.log(
        `TicketSense API listening on port ${port}`
      );

      console.log(
        `Docs available at /api/docs`
      );

      console.log(
        `embedder=${store.state.meta.embedder || '(not built yet)'} ` +
        `corpus=${store.getCorpus().length}`
      );

      if (!store.state.meta.embedder) {
        console.warn(
          '⚠ No index found. Run `npm run data:build` ' +
          '(repo root) before using the API.'
        );
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
