// Day 3 — Run the evaluation harness and report.
//
//   node scripts/runEval.js
//
// Scores priority predictions against the real held-out labels and prints the
// calibration table (accuracy by confidence bucket) that proves the gate works.

import { store } from '../src/db/store.js';
import { connectMongo } from '../src/db/mongo.js';
import { runEval } from '../src/eval/evalHarness.js';

async function main() {
  await connectMongo();
  store.load();
  console.log('[eval] running harness on held-out set…');
  const m = await runEval(store);
  store.setMetrics(m);

  console.log('\n==================== EVALUATION REPORT ====================');
  console.log(`Embedder            : ${m.embedder}`);
  console.log(`Held-out tickets    : ${m.n}`);
  console.log(`Priority exact acc  : ${pct(m.priorityExactAccuracy)}  (majority baseline ${pct(m.majorityBaseline)})`);
  console.log(`Priority ±1 acc     : ${pct(m.priorityWithin1Accuracy)}`);
  console.log(`Routing (queue) acc : ${pct(m.routingAccuracy)}`);
  console.log(`Auto-route rate     : ${pct(m.autoRouteRate)}`);
  console.log(`Review rate         : ${pct(m.reviewRate)}`);
  console.log(`High-risk rate      : ${pct(m.highRiskRate)}`);
  console.log(`Would-be misses     : ${m.wouldBeMisses} (${pct(m.wouldBeMissRateAmongAutoRouted)} of auto-routed)`);

  console.log('\n--- Calibration (accuracy by confidence bucket) ---');
  console.log('bucket        n    accuracy   autoRoute%');
  for (const b of m.calibration) {
    console.log(
      `${b.bucket.padEnd(13)} ${String(b.n).padStart(3)}   ${b.accuracy == null ? '  -  ' : pct(b.accuracy).padStart(7)}   ${b.autoRouteRate == null ? '  -  ' : pct(b.autoRouteRate).padStart(7)}`
    );
  }

  console.log('\n--- Confusion matrix (actual rows → predicted cols) ---');
  const P = ['Low', 'Medium', 'High', 'Critical'];
  console.log('actual\\pred    ' + P.map((p) => p.padStart(9)).join(''));
  for (const a of P) {
    console.log(a.padEnd(13) + ' ' + P.map((p) => String(m.confusion[a][p]).padStart(9)).join(''));
  }
  console.log('\n(estimated manual-triage time saved is a PLANNING ESTIMATE — see metrics.note)');
  console.log('===========================================================');
}

function pct(x) {
  return `${Math.round(x * 100)}%`;
}

main().catch((e) => {
  console.error('[eval] failed:', e);
  process.exit(1);
});
