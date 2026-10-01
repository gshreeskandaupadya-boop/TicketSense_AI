// Optional synthetic dataset generator.
//
//   node scripts/generateDataset.js [count=600]
//
// Produces data/tickets.generated.csv in the EXACT suraj520 schema. These rows
// are used ONLY to enlarge the retrieval corpus (split='synthetic') and are
// NEVER treated as ground truth. The held-out eval set always uses the REAL
// Kaggle labels. Run `npm run data:build` afterwards to fold them in.

import fs from 'node:fs';
import path from 'node:path';
import { paths, config } from '../src/config.js';

const PRODUCTS = [
  'GoPro Hero', 'LG Smart TV', 'Dell XPS', 'Adobe Creative Cloud', 'Norton Antivirus',
  'Sony WH-1000XM4', 'iPhone 13', 'Samsung Galaxy S22', 'Kindle Paperwhite', 'Xbox Series X',
  'PlayStation 5', 'Fitbit Versa', 'Canon EOS', 'Bose QC45', 'Apple Watch',
];
const TYPES = ['Technical issue', 'Billing inquiry', 'Cancellation request', 'Payment issue', 'Account access', 'Refund request'];
const CHANNELS = ['Email', 'Chat', 'Phone', 'Social media'];
const STATUSES = ['Open', 'Closed', 'Pending Customer Response'];
const GENDERS = ['Male', 'Female', 'Other'];
const FIRST = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Sam', 'Jamie', 'Avery', 'Quinn'];
const LAST = ['Smith', 'Patel', 'Nguyen', 'Garcia', 'Kim', 'Okafor', 'Rossi', 'Haddad', 'Silva', 'Cohen'];

const SUBJECTS = {
  'Technical issue': ['Product setup', 'Network problem', 'Software crash', 'Hardware failure', 'Connectivity issue', 'Sync error'],
  'Billing inquiry': ['Invoice question', 'Plan details', 'Billing discrepancy', 'Upgrade query', 'Tax on invoice'],
  'Cancellation request': ['Cancel subscription', 'Close account', 'Stop renewal', 'End contract'],
  'Payment issue': ['Payment failed', 'Card declined', 'Double charge', 'Refund not received'],
  'Account access': ['Password reset', '2FA issue', 'Locked out', 'Login problem'],
  'Refund request': ['Request refund', 'Money back', 'Return product', 'Chargeback'],
};
const DESC = {
  'Technical issue': 'I am having an issue with the {product_purchased}. It is not working as expected and I need help troubleshooting.',
  'Billing inquiry': 'I have a question about my latest invoice for the {product_purchased}. Please clarify the charges.',
  'Cancellation request': 'I would like to cancel my {product_purchased} subscription immediately and stop future billing.',
  'Payment issue': 'My payment for the {product_purchased} failed / was declined. I was possibly charged twice.',
  'Account access': 'I cannot log in to my {product_purchased} account. The password reset is not arriving.',
  'Refund request': 'I want a refund for the {product_purchased} as it did not meet my expectations.',
};

// Priority correlated with type/subject to make retrieval meaningful.
function pickPriority(type, rnd) {
  if (type === 'Cancellation request' || type === 'Refund request') return rnd < 0.6 ? 'High' : 'Medium';
  if (type === 'Payment issue') return rnd < 0.5 ? 'High' : 'Medium';
  if (type === 'Technical issue') return rnd < 0.15 ? 'Critical' : rnd < 0.55 ? 'High' : 'Medium';
  if (type === 'Account access') return rnd < 0.2 ? 'High' : 'Medium';
  return rnd < 0.5 ? 'Medium' : 'Low';
}

function rnd(seed) {
  // simple LCG for reproducibility
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

function csvCell(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function main() {
  const count = Number(process.argv[2] || 600);
  const header = [
    'Ticket ID', 'Customer Name', 'Customer Email', 'Customer Age', 'Customer Gender',
    'Product Purchased', 'Date of Purchase', 'Ticket Type', 'Ticket Subject', 'Ticket Description',
    'Ticket Status', 'Resolution', 'Ticket Priority', 'Ticket Channel', 'First Response Time',
    'Time to Resolution', 'Customer Satisfaction Rating',
  ];
  const rows = [header.join(',')];
  let seed = 99;
  for (let i = 0; i < count; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const r = rnd(seed);
    const type = TYPES[Math.floor(rnd(seed + i) * TYPES.length)];
    const product = PRODUCTS[Math.floor(rnd(seed * 3 + i) * PRODUCTS.length)];
    const subject = SUBJECTS[type][Math.floor(rnd(seed * 7 + i) * SUBJECTS[type].length)];
    const channel = CHANNELS[Math.floor(rnd(seed * 11 + i) * CHANNELS.length)];
    const status = STATUSES[Math.floor(rnd(seed * 13 + i) * STATUSES.length)];
    const priority = pickPriority(type, rnd(seed * 17 + i));
    const first = FIRST[Math.floor(rnd(seed * 19 + i) * FIRST.length)];
    const last = LAST[Math.floor(rnd(seed * 23 + i) * LAST.length)];
    const age = 18 + Math.floor(rnd(seed * 29 + i) * 50);
    const gender = GENDERS[Math.floor(rnd(seed * 31 + i) * GENDERS.length)];
    const email = `${first}.${last}@example.com`.toLowerCase();
    const desc = DESC[type].replace('{product_purchased}', product);
    const satisfaction = status === 'Closed' ? (3 + Math.floor(rnd(seed * 37 + i) * 3)) : '';
    rows.push(
      [
        `S${i + 1}`, `${first} ${last}`, email, age, gender, product, '2022-01-15', type, subject, desc,
        status, status === 'Closed' ? 'Resolved by support agent.' : '', priority, channel,
        '2023-06-01 10:00:00', status === 'Closed' ? '2023-06-01 15:00:00' : '', satisfaction,
      ]
        .map(csvCell)
        .join(',')
    );
  }
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.writeFileSync(paths.generatedCsv, rows.join('\n'));
  console.log(`[generate] wrote ${count} synthetic tickets -> ${paths.generatedCsv}`);
  console.log('[generate] run `npm run data:build` to fold them into the retrieval corpus.');
}

main();
