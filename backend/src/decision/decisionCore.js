// Decision Core (Pipeline stage 3) — single LLM call per ticket.
//
// If OPENAI_API_KEY is set AND reachable, we make exactly ONE chat completion
// that is forced into the strict JSON schema. Otherwise (or on any failure) we
// fall back to the deterministic heuristic reasoner so the pipeline always
// returns a valid decision card.

import { config } from '../config.js';
import { heuristicReason } from './heuristicReasoner.js';
import { routeQueue, isHighRisk, normalizePriority, PRIORITIES } from './routeMap.js';

const SCHEMA_HINT = `Respond with STRICT JSON only, no prose, matching exactly:
{"priority": "Low|Medium|High|Critical", "queue": string, "confidence_score": number between 0 and 1, "evidence_snippet": string, "rationale": string}`;

function validate(out) {
  if (!out || typeof out !== 'object') return null;
  const priority = normalizePriority(out.priority);
  if (!priority) return null;
  const queue = typeof out.queue === 'string' && out.queue.trim() ? out.queue.trim() : null;
  if (!queue) return null;
  let conf = Number(out.confidence_score);
  if (!Number.isFinite(conf)) return null;
  conf = Math.max(0, Math.min(1, conf));
  const evidence_snippet = typeof out.evidence_snippet === 'string' ? out.evidence_snippet : '';
  const rationale = typeof out.rationale === 'string' ? out.rationale : '';
  return { priority, queue, confidence_score: Math.round(conf * 100) / 100, evidence_snippet, rationale };
}

let _openai = null;
async function getOpenAI() {
  if (_openai) return _openai;
  if (!config.openaiKey) return null;
  try {
    const mod = await import('openai');
    _openai = new mod.default({ apiKey: config.openaiKey });
    return _openai;
  } catch {
    return null;
  }
}

async function llmReason({ ticket, neighbors }) {
  const client = await getOpenAI();
  if (!client) return null;
  const ctx = neighbors
    .slice(0, 5)
    .map((n, i) => `  ${i + 1}. ${n.snippet} [priority=${n.priority}, similarity=${n.semantic}]`)
    .join('\n');
  const system = `You are a support-triage decision engine. Use the retrieved historical tickets as evidence. ${SCHEMA_HINT}`;
  const user = `Incoming ticket:
- Type: ${ticket.type || 'n/a'}
- Subject: ${ticket.subject || 'n/a'}
- Product: ${ticket.product || 'n/a'}
- Channel: ${ticket.channel || 'n/a'}
- Description: ${ticket.description || 'n/a'}

Retrieved similar historical tickets (evidence):
${ctx || '  (none)'}

Decide priority, routing queue, and a confidence score. Cite the most relevant evidence in evidence_snippet.`;

  try {
    const resp = await client.chat.completions.create({
      model: config.openaiChatModel,
      response_format: { type: 'json_object' },
      temperature: 0,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    const content = resp.choices?.[0]?.message?.content || '{}';
    const parsed = validate(JSON.parse(content));
    if (parsed) return { ...parsed, model: 'openai' };
    return null;
  } catch (e) {
    console.warn('[decisionCore] LLM failed, using heuristic:', e.message);
    return null;
  }
}

// Main entry. `neighbors` already computed by hybrid retrieval.
export async function decide({ ticket, neighbors = [], priorityModel = null }) {
  if (config.useOpenAI) {
    const llm = await llmReason({ ticket, neighbors });
    if (llm) return llm;
  }
  return heuristicReason({ ticket, neighbors, priorityModel });
}
