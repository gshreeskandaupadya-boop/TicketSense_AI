// Optional MongoDB mirror. Only used when MONGODB_URI is set. Everything is
// best-effort: if mongoose is missing or the connection fails, TicketSense
// keeps running on the JSON file store. This satisfies the "Evidence Ledger
// in the database" requirement for deployment while staying runnable offline.

import { config } from '../config.js';

let mongoose = null;
let connected = false;
let TicketModel = null;
let DecisionModel = null;

export async function connectMongo() {
  if (!config.useMongo) return false;
  try {
    mongoose = (await import('mongoose')).default;
    const { Schema } = mongoose;

    const TicketSchema = new Schema(
      {
        ticketId: { type: String, index: true, unique: true, sparse: true },
        customer: Schema.Types.Mixed,
        product: String,
        type: String,
        subject: String,
        description: String,
        status: String,
        priority: String,
        channel: String,
        satisfaction: Number,
        text: String,
        split: { type: String, default: 'corpus' },
        embedding: [Number],
      },
      { timestamps: true }
    );

    const DecisionSchema = new Schema(
      {
        decisionId: { type: String, index: true, unique: true },
        ticketId: String,
        incoming: Schema.Types.Mixed,
        retrieved: [Schema.Types.Mixed],
        decision: Schema.Types.Mixed,
        routing: Schema.Types.Mixed,
        highRisk: Boolean,
        status: String,
        humanOverride: Schema.Types.Mixed,
        model: String,
      },
      { timestamps: true }
    );

    TicketModel = mongoose.models.Ticket || mongoose.model('Ticket', TicketSchema);
    DecisionModel = mongoose.models.DecisionLog || mongoose.model('DecisionLog', DecisionSchema);

    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
    connected = true;
    console.log('[mongo] connected');
    return true;
  } catch (e) {
    console.warn('[mongo] unavailable, using JSON store:', e.message);
    connected = false;
    return false;
  }
}

export function mongoActive() {
  return connected;
}

export async function mirrorTicket(t) {
  if (!connected || !TicketModel) return;
  try {
    await TicketModel.updateOne({ ticketId: t.ticketId }, { $set: t }, { upsert: true });
  } catch (e) {
    /* best-effort */
  }
}

export async function mirrorDecision(d) {
  if (!connected || !DecisionModel) return;
  try {
    await DecisionModel.updateOne({ decisionId: d.decisionId }, { $set: d }, { upsert: true });
  } catch (e) {
    /* best-effort */
  }
}

export async function mirrorOverride(id, patch) {
  if (!connected || !DecisionModel) return;
  try {
    await DecisionModel.updateOne({ decisionId: id }, { $set: patch }, { upsert: false });
  } catch (e) {
    /* best-effort */
  }
}
