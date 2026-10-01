// Confidence-Gated Routing (Pipeline stage 4).
//
// Rule:
//   • High-risk (priority=Critical OR refund/cancellation/payment type) →
//     ALWAYS hold for human approval, even at high confidence.
//   • Else if confidence >= AUTO_ROUTE_THRESHOLD → auto-route.
//   • Else → hold for human approval.

import { config } from '../config.js';
import { isHighRisk, routeQueue } from './routeMap.js';

export function gate({ priority, queue, confidence_score, type, subject, description }) {
  const highRisk = isHighRisk({ priority, type, subject, description });
  const targetQueue = queue || routeQueue({ type, subject, description });

  if (highRisk) {
    return {
      action: 'hold_for_review',
      targetQueue,
      highRisk: true,
      reason: 'High-risk category (Critical priority / refund / cancellation / payment) requires human approval.',
    };
  }
  if (confidence_score >= config.autoRouteThreshold) {
    return {
      action: 'auto_route',
      targetQueue,
      highRisk: false,
      reason: `Confidence ${confidence_score} ≥ auto-route threshold ${config.autoRouteThreshold}.`,
    };
  }
  return {
    action: 'hold_for_review',
    targetQueue,
    highRisk: false,
    reason: `Confidence ${confidence_score} < auto-route threshold ${config.autoRouteThreshold}.`,
  };
}
