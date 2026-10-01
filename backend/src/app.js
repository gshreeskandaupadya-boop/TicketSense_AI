// Express app factory — separated from server bootstrap so the app can be
// imported by tests without binding a port.

import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { api } from './routes/api.js';

export function createApp() {
  const app = express();

  // Permissive CORS: the SPA may be hosted on a different origin (Vercel) or
  // a sandbox preview proxy. Not suitable for authenticated traffic — see
  // README "Known limitations".
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/', (_req, res) => {
    // Single-service deploys: the root serves the built SPA. API-only deploys
    // get a small service descriptor instead.
    if (fs.existsSync(config.frontendDist)) {
      return res.sendFile(path.join(config.frontendDist, 'index.html'));
    }
    res.json({
      name: 'TicketSense API',
      version: '1.0.0',
      health: '/api/health',
      docs: '/api/docs',
      openapi: '/api/openapi.json',
    });
  });

  // REST API + human-readable API documentation.
  app.use('/api', api);

  // Serve the built React SPA when present (single-service deployment:
  // one Render web service hosts both API + frontend).
  const dist = config.frontendDist;
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    // SPA fallback for client-side routes (anything that is not /api).
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  // JSON 404 for unknown API routes when no SPA is built.
  app.use((req, res) => {
    res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
  });

  return app;
}
