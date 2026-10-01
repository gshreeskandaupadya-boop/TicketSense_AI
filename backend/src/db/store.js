// Storage layer. JSON file is the always-available source of truth; if MongoDB
// is configured it is mirrored (best-effort) so the Evidence Ledger also lives
// in a real database for deployment.

import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../config.js';
import { mirrorTicket, mirrorDecision, mirrorOverride } from './mongo.js';

const EMPTY = {
  meta: { embedder: null, embedDim: null, builtAt: null, source: null },
  tickets: [], // normalized + embedding (corpus + eval + synthetic)
  decisions: [], // Evidence Ledger entries
  metrics: null, // last eval run
};

class Store {
  constructor() {
    this.state = structuredClone(EMPTY);
    this._loaded = false;
  }

  load() {
    try {
      if (fs.existsSync(paths.store)) {
        this.state = JSON.parse(fs.readFileSync(paths.store, 'utf8'));
      }
    } catch (e) {
      console.warn('[store] could not read store, starting fresh:', e.message);
      this.state = structuredClone(EMPTY);
    }
    this._loaded = true;
    return this.state;
  }

  save() {
    try {
      fs.mkdirSync(path.dirname(paths.store), { recursive: true });
      fs.writeFileSync(paths.store, JSON.stringify(this.state));
    } catch (e) {
      console.warn('[store] save failed:', e.message);
    }
  }

  reset() {
    this.state = structuredClone(EMPTY);
    this.save();
  }

  // ---- meta ----
  setMeta(meta) {
    this.state.meta = { ...this.state.meta, ...meta };
    this.save();
  }

  // ---- tickets ----
  addTicket(t) {
    const i = this.state.tickets.findIndex((x) => x.ticketId === t.ticketId);
    if (i >= 0) this.state.tickets[i] = t;
    else this.state.tickets.push(t);
    mirrorTicket(t);
    this.save();
    return t;
  }

  addTickets(list) {
    for (const t of list) {
      const i = this.state.tickets.findIndex((x) => x.ticketId === t.ticketId);
      if (i >= 0) this.state.tickets[i] = t;
      else this.state.tickets.push(t);
      mirrorTicket(t);
    }
    this.save();
  }

  // Bulk replace (used by buildIndex). Mirrors to Mongo best-effort.
  bulkSetTickets(list) {
    this.state.tickets = list;
    this.save();
    for (const t of list) mirrorTicket(t);
    return list;
  }

  allTickets() {
    return this.state.tickets;
  }

  getCorpus() {
    // Historical examples used for retrieval: real corpus + synthetic augments.
    // The held-out 'eval' split is excluded so retrieval never cheats.
    return this.state.tickets.filter((t) => t.split === 'corpus' || t.split === 'synthetic');
  }

  getEval() {
    return this.state.tickets.filter((t) => t.split === 'eval');
  }

  getTicketById(id) {
    return this.state.tickets.find((t) => t.ticketId === id) || null;
  }

  // ---- decisions (Evidence Ledger) ----
  addDecision(d) {
    this.state.decisions.unshift(d);
    mirrorDecision(d);
    this.save();
    return d;
  }

  getDecisions(filter = {}) {
    let list = this.state.decisions;
    if (filter.status) list = list.filter((d) => d.status === filter.status);
    if (filter.action) list = list.filter((d) => d.routing?.action === filter.action);
    return list;
  }

  getDecision(id) {
    return this.state.decisions.find((d) => d.decisionId === id) || null;
  }

  updateDecision(id, patch) {
    const d = this.getDecision(id);
    if (!d) return null;
    Object.assign(d, patch);
    if (patch.humanOverride) d.humanOverride = { ...d.humanOverride, ...patch.humanOverride };
    mirrorOverride(id, patch);
    this.save();
    return d;
  }

  // ---- metrics ----
  setMetrics(m) {
    this.state.metrics = m;
    this.save();
  }
  getMetrics() {
    return this.state.metrics;
  }

  stats() {
    const dec = this.state.decisions;
    const auto = dec.filter((d) => d.routing?.action === 'auto_route').length;
    const review = dec.filter((d) => d.routing?.action === 'hold_for_review').length;
    const approved = dec.filter((d) => d.status === 'approved').length;
    const overridden = dec.filter((d) => d.status === 'overridden').length;
    return {
      corpusSize: this.getCorpus().length,
      evalSize: this.getEval().length,
      totalTickets: this.state.tickets.length,
      decisions: dec.length,
      autoRouted: auto,
      pendingReview: review,
      approved,
      overridden,
      overrideRate: dec.length ? round(overridden / dec.length) : 0,
    };
  }
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

export const store = new Store();
