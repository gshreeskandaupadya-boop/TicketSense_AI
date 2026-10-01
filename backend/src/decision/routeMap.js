// Maps a ticket's Type / Subject onto a routing queue and flags high-risk
// categories. High-risk => always held for human approval regardless of
// confidence (per PS-04 confidence-gated routing rule).

export const QUEUES = {
  TECH: 'Tech Support',
  BILLING: 'Billing',
  RETENTION: 'Retention',
  ACCOUNT: 'Account',
  GENERAL: 'General',
};

// Ticket Type -> queue
const TYPE_TO_QUEUE = {
  'technical issue': QUEUES.TECH,
  'billing inquiry': QUEUES.BILLING,
  'cancellation request': QUEUES.RETENTION,
  'payment issue': QUEUES.BILLING,
  'refund request': QUEUES.BILLING,
  'account access': QUEUES.ACCOUNT,
  'login issue': QUEUES.ACCOUNT,
  'general inquiry': QUEUES.GENERAL,
};

// Keyword fallbacks used when Type is missing/unknown (scanned in Subject+Desc).
const SUBJECT_KEYWORDS = [
  { re: /(refund|reimburse|chargeback)/i, queue: QUEUES.BILLING },
  { re: /(cancel|cancelation|cancellation)/i, queue: QUEUES.RETENTION },
  { re: /(bill|invoice|payment|charge|subscription|upgrade|downgrade|plan)/i, queue: QUEUES.BILLING },
  { re: /(password|login|sign ?in|account|2fa|verify|access)/i, queue: QUEUES.ACCOUNT },
  { re: /(crash|bug|error|broken|not working|won't|wont|freeze|slow|install|setup|connect|network|hardware|software|driver)/i, queue: QUEUES.TECH },
];

// Categories that MUST be human-approved even at high confidence.
const HIGH_RISK_TYPES = new Set([
  'cancellation request',
  'refund request',
  'payment issue',
]);
const HIGH_RISK_SUBJECT = /(refund|reimburse|cancel|chargeback|lawsuit|legal|complaint|gdpr|data breach)/i;

export function routeQueue({ type, subject = '', description = '' } = {}) {
  const t = (type || '').trim().toLowerCase();
  if (TYPE_TO_QUEUE[t]) return TYPE_TO_QUEUE[t];

  const hay = `${subject} ${description}`;
  for (const k of SUBJECT_KEYWORDS) {
    if (k.re.test(hay)) return k.queue;
  }
  return QUEUES.GENERAL;
}

export function isHighRisk({ priority, type, subject = '', description = '' } = {}) {
  const t = (type || '').trim().toLowerCase();
  if (priority && priority.toLowerCase() === 'critical') return true;
  if (HIGH_RISK_TYPES.has(t)) return true;
  if (HIGH_RISK_SUBJECT.test(`${subject} ${description}`)) return true;
  return false;
}

export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

export function normalizePriority(p) {
  if (!p) return null;
  const s = p.trim().toLowerCase();
  const found = PRIORITIES.find((x) => x.toLowerCase() === s);
  return found || null;
}
