// Ingestion & Normalization (Pipeline stage 1).
// Turns a raw Kaggle row OR a free-form API submission into ONE standard shape.

import { normalizePriority } from '../decision/routeMap.js';

function clean(str) {
  if (str == null) return '';
  return String(str).replace(/\s+/g, ' ').trim();
}

// The Kaggle descriptions contain the literal placeholder "{product_purchased}".
// Substitute the real product so the text carries signal.
function fillTemplate(text, product) {
  if (!text) return text;
  return text.replace(/\{product_purchased\}/gi, product || 'product');
}

// Canonical text used for embedding. We deliberately front-load the
// structured fields (subject / type / product / channel) because in this
// dataset the free-text description is templated and thin — semantic
// retrieval leans heavily on these.
export function buildEmbedText({ subject, type, product, channel, description }) {
  return [
    `Subject: ${subject || ''}`,
    `Type: ${type || ''}`,
    `Product: ${product || ''}`,
    `Channel: ${channel || ''}`,
    description || '',
  ]
    .join(' | ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Accepts either:
//   (a) a raw Kaggle CSV row object, or
//   (b) a partial ticket from the ingest API: { type, subject, description,
//        product, channel, customer?, priority? }
// Always returns the normalized standard shape (embedding added later).
export function normalizeTicket(raw = {}, opts = {}) {
  const product = clean(raw['Product Purchased'] ?? raw.product);
  const type = clean(raw['Ticket Type'] ?? raw.type);
  const subject = clean(raw['Ticket Subject'] ?? raw.subject);
  let description = clean(raw['Ticket Description'] ?? raw.description);
  description = fillTemplate(description, product);

  const channel = clean(raw['Ticket Channel'] ?? raw.channel);
  const priorityLabel = raw['Ticket Priority'] ?? raw.priority;

  const normalized = {
    ticketId: clean(raw['Ticket ID'] ?? raw.ticketId ?? opts.ticketId ?? `T-${Date.now()}-${Math.floor(Math.random() * 1e4)}`),
    customer: {
      name: clean(raw['Customer Name'] ?? raw.customer?.name),
      email: clean(raw['Customer Email'] ?? raw.customer?.email),
      age: Number(raw['Customer Age'] ?? raw.customer?.age) || null,
      gender: clean(raw['Customer Gender'] ?? raw.customer?.gender),
    },
    product,
    dateOfPurchase: clean(raw['Date of Purchase'] ?? raw.dateOfPurchase) || null,
    type,
    subject,
    description,
    status: clean(raw['Ticket Status'] ?? raw.status),
    resolution: clean(raw['Resolution'] ?? raw.resolution),
    priority: normalizePriority(priorityLabel), // ground-truth label (may be null for new tickets)
    channel,
    firstResponseTime: clean(raw['First Response Time'] ?? raw.firstResponseTime) || null,
    timeToResolution: clean(raw['Time to Resolution'] ?? raw.timeToResolution) || null,
    satisfaction: Number(raw['Customer Satisfaction Rating'] ?? raw.satisfaction) || null,
    text: buildEmbedText({ subject, type, product, channel, description }),
  };
  return normalized;
}
