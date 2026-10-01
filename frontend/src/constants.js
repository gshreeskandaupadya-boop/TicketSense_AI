// Shared UI constants (kept in sync with the backend route map).

export const TYPES = [
  'Technical issue',
  'Billing inquiry',
  'Cancellation request',
  'Payment issue',
  'Account access',
  'Refund request',
  'Product inquiry',
];

export const CHANNELS = ['Email', 'Chat', 'Phone', 'Social media'];

export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

export const QUEUES = ['Tech Support', 'Billing', 'Retention', 'Account', 'General'];

export function pct(x) {
  return `${Math.round(x * 100)}%`;
}
