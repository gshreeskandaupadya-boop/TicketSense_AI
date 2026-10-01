// Pushes the built store (corpus + Evidence Ledger) into MongoDB.
// Only needed when MONGODB_URI is set. buildIndex already mirrors best-effort,
// so this is a convenience re-sync.

import { store } from '../src/db/store.js';
import { connectMongo, mirrorTicket, mirrorDecision } from '../src/db/mongo.js';

async function main() {
  const ok = await connectMongo();
  if (!ok) {
    console.error('MongoDB not configured (set MONGODB_URI). Nothing to seed.');
    process.exit(1);
  }
  store.load();
  for (const t of store.state.tickets) await mirrorTicket(t);
  for (const d of store.state.decisions) await mirrorDecision(d);
  console.log(`[seed] mirrored ${store.state.tickets.length} tickets and ${store.state.decisions.length} ledger entries.`);
}

main().catch((e) => {
  console.error('[seed] failed:', e);
  process.exit(1);
});
