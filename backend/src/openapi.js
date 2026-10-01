// OpenAPI 3.1 specification for the TicketSense REST API.
// Served at GET /api/openapi.json and rendered at GET /api/docs.

export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'TicketSense API',
    version: '1.0.0',
    description: [
      'Confidence-gated triage pipeline for support tickets (PS-04, BFWAI/HACK 26).',
      '',
      'Pipeline: **ingest + normalize → hybrid retrieval (semantic + structural) →',
      'one-shot decision → confidence/risk gate → evidence ledger → override feedback loop**.',
      '',
      'Runs fully offline (local TF-IDF embedder + deterministic heuristic reasoner).',
      'Set `OPENAI_API_KEY` on the server to upgrade to real embeddings + one LLM call per ticket.',
    ].join('\n'),
    license: { name: 'MIT' },
  },
  servers: [{ url: '/', description: 'This server' }],
  tags: [
    { name: 'Health', description: 'Liveness and service metadata' },
    { name: 'Triage', description: 'Ingest a ticket and get an AI decision' },
    { name: 'Evidence Ledger', description: 'Every decision, its evidence, and human overrides' },
    { name: 'Queues', description: 'Auto-routed and human-review queues' },
    { name: 'Evaluation', description: 'Held-out evaluation metrics and stats' },
    { name: 'Meta', description: 'Demo helpers' },
  ],
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Used by Render (`healthCheckPath`) and the frontend status badge.',
        responses: {
          200: {
            description: 'Service status',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Health' },
              },
            },
          },
        },
      },
    },
    '/api/examples': {
      get: {
        tags: ['Meta'],
        summary: 'Demo example tickets',
        description:
          'Real corpus tickets that showcase both gate outcomes (one auto-routes, one is held for review).',
        responses: {
          200: {
            description: 'Example tickets',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/ExampleTicket' } },
              },
            },
          },
        },
      },
    },
    '/api/tickets/ingest': {
      post: {
        tags: ['Triage'],
        summary: 'Ingest a ticket and run the decision pipeline',
        description:
          'Normalizes the ticket, retrieves similar historical tickets (hybrid semantic + structural), ' +
          'produces a strict decision schema (one LLM call when configured, otherwise heuristic), ' +
          'applies the confidence/risk gate, and writes an Evidence Ledger entry.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TicketInput' },
              examples: {
                technical: {
                  summary: 'Routine technical issue (auto-routes at high confidence)',
                  value: {
                    type: 'Technical issue',
                    subject: 'Device crash after update',
                    product: 'Dell XPS',
                    channel: 'Chat',
                    description: 'The laptop will not power on after the latest update, it keeps crashing.',
                  },
                },
                refund: {
                  summary: 'Refund request (always held for human review)',
                  value: {
                    type: 'Refund request',
                    subject: 'Request refund',
                    product: 'Adobe Creative Cloud',
                    channel: 'Email',
                    description: 'I want a refund for the Adobe Creative Cloud as it did not meet my expectations.',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Decision entry (also written to the Evidence Ledger)',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/DecisionEntry' } },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/ledger': {
      get: {
        tags: ['Evidence Ledger'],
        summary: 'List Evidence Ledger entries',
        parameters: [
          {
            name: 'status',
            in: 'query',
            description: 'Filter by ledger status',
            schema: { type: 'string', enum: ['auto_routed', 'pending_review', 'approved', 'overridden'] },
          },
          {
            name: 'action',
            in: 'query',
            description: 'Filter by gate action',
            schema: { type: 'string', enum: ['auto_route', 'hold_for_review'] },
          },
        ],
        responses: {
          200: {
            description: 'Ledger entries (newest first)',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/DecisionEntry' } },
              },
            },
          },
        },
      },
    },
    '/api/ledger/{id}': {
      get: {
        tags: ['Evidence Ledger'],
        summary: 'Get one ledger entry',
        parameters: [{ $ref: '#/components/parameters/DecisionId' }],
        responses: {
          200: {
            description: 'Decision entry',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/DecisionEntry' } },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/ledger/{id}/approve': {
      post: {
        tags: ['Evidence Ledger'],
        summary: 'Human approves a held ticket',
        description: 'Confirms the AI decision unchanged. Status becomes `approved`.',
        parameters: [{ $ref: '#/components/parameters/DecisionId' }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { by: { type: 'string', description: 'Reviewer name', default: 'reviewer' } },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Updated entry',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/DecisionEntry' } },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/ledger/{id}/override': {
      post: {
        tags: ['Evidence Ledger'],
        summary: 'Human overrides the AI priority/queue',
        description:
          'Corrects the AI decision. The entry is flagged as a "miss" case and feeds the override feedback loop.',
        parameters: [{ $ref: '#/components/parameters/DecisionId' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  priority: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
                  queue: { type: 'string', example: 'Billing' },
                  by: { type: 'string', description: 'Reviewer name', default: 'reviewer' },
                  note: { type: 'string' },
                },
                minProperties: 1,
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Updated entry',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/DecisionEntry' } },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/queue/review': {
      get: {
        tags: ['Queues'],
        summary: 'Human review queue',
        description: 'Held-for-review decisions that are still `pending_review`.',
        responses: {
          200: {
            description: 'Queue items',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/DecisionEntry' } },
              },
            },
          },
        },
      },
    },
    '/api/queue/auto': {
      get: {
        tags: ['Queues'],
        summary: 'Auto-routed tickets',
        responses: {
          200: {
            description: 'Queue items',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/DecisionEntry' } },
              },
            },
          },
        },
      },
    },
    '/api/stats': {
      get: {
        tags: ['Evaluation'],
        summary: 'Counters and last evaluation metrics',
        responses: {
          200: {
            description: 'Stats',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Stats' } },
            },
          },
        },
      },
    },
    '/api/eval/run': {
      post: {
        tags: ['Evaluation'],
        summary: 'Run the held-out evaluation harness',
        description:
          'Scores the pipeline against the held-out real-labelled split and stores the metrics.',
        responses: {
          200: {
            description: 'Evaluation metrics',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/EvalMetrics' } },
            },
          },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/eval': {
      get: {
        tags: ['Evaluation'],
        summary: 'Last evaluation metrics',
        responses: {
          200: {
            description: 'Metrics (or a hint if no eval has been run yet)',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/EvalMetrics' } },
            },
          },
        },
      },
    },
  },
  components: {
    parameters: {
      DecisionId: {
        name: 'id',
        in: 'path',
        required: true,
        description: 'Decision id (`D-…`)',
        schema: { type: 'string' },
        example: 'D-1727000000000-1234',
      },
    },
    responses: {
      BadRequest: {
        description: 'Invalid input',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'Provide at least type/subject/description.' },
          },
        },
      },
      NotFound: {
        description: 'Decision not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'not found' },
          },
        },
      },
      ServerError: {
        description: 'Pipeline failure',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'embedding backend unavailable' },
          },
        },
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } },
        required: ['error'],
      },
      Health: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          embedder: { type: 'string', enum: ['local', 'openai'], description: 'Embedding backend used at index build' },
          embedDim: { type: 'integer' },
          corpusSize: { type: 'integer', description: 'Retrieval corpus tickets' },
          evalSize: { type: 'integer', description: 'Held-out eval tickets' },
          decisions: { type: 'integer', description: 'Evidence Ledger entries' },
        },
        required: ['ok'],
      },
      TicketInput: {
        type: 'object',
        description: 'Free-form ticket. Provide at least one of `type`, `subject`, `description`.',
        properties: {
          type: {
            type: 'string',
            enum: [
              'Technical issue',
              'Billing inquiry',
              'Cancellation request',
              'Payment issue',
              'Account access',
              'Refund request',
              'Product inquiry',
            ],
          },
          subject: { type: 'string' },
          product: { type: 'string' },
          channel: { type: 'string', enum: ['Email', 'Chat', 'Phone', 'Social media'] },
          description: { type: 'string' },
        },
      },
      ExampleTicket: {
        type: 'object',
        properties: {
          ticketId: { type: 'string' },
          type: { type: 'string' },
          subject: { type: 'string' },
          product: { type: 'string' },
          channel: { type: 'string' },
          description: { type: 'string' },
        },
      },
      RetrievedNeighbor: {
        type: 'object',
        description: 'Historical ticket scored by hybrid retrieval.',
        properties: {
          ticketId: { type: 'string' },
          semantic: { type: 'number', description: 'Cosine similarity of embeddings [0,1]' },
          structural: { type: 'number', description: 'Same product/type/channel/status score [0,1]' },
          combined: { type: 'number', description: '0.6·semantic + 0.4·structural' },
          priority: { type: 'string' },
          type: { type: 'string' },
          product: { type: 'string' },
          channel: { type: 'string' },
          subject: { type: 'string' },
          snippet: { type: 'string', description: 'Cited evidence snippet' },
        },
      },
      Decision: {
        type: 'object',
        properties: {
          priority: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
          queue: { type: 'string', example: 'Tech Support' },
          confidence_score: { type: 'number', minimum: 0, maximum: 1 },
          evidence_snippet: { type: 'string', description: 'Cited from retrieved history' },
          rationale: { type: 'string' },
          model: { type: 'string', enum: ['openai', 'heuristic'] },
        },
      },
      Routing: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['auto_route', 'hold_for_review'] },
          targetQueue: { type: 'string' },
          highRisk: { type: 'boolean', description: 'Refund / cancellation / payment / Critical' },
          reason: { type: 'string' },
        },
      },
      HumanOverride: {
        type: ['object', 'null'],
        properties: {
          priority: { type: 'string' },
          queue: { type: 'string' },
          by: { type: 'string' },
          at: { type: 'string', format: 'date-time' },
          note: { type: 'string' },
        },
      },
      DecisionEntry: {
        type: 'object',
        properties: {
          decisionId: { type: 'string' },
          ticketId: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          model: { type: 'string', enum: ['openai', 'heuristic'] },
          incoming: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              subject: { type: 'string' },
              product: { type: 'string' },
              channel: { type: 'string' },
              description: { type: 'string' },
            },
          },
          retrieved: { type: 'array', items: { $ref: '#/components/schemas/RetrievedNeighbor' } },
          decision: { $ref: '#/components/schemas/Decision' },
          routing: { $ref: '#/components/schemas/Routing' },
          status: {
            type: 'string',
            enum: ['auto_routed', 'pending_review', 'approved', 'overridden'],
          },
          humanOverride: { $ref: '#/components/schemas/HumanOverride' },
        },
      },
      Stats: {
        type: 'object',
        properties: {
          corpusSize: { type: 'integer' },
          evalSize: { type: 'integer' },
          totalTickets: { type: 'integer' },
          decisions: { type: 'integer' },
          autoRouted: { type: 'integer' },
          pendingReview: { type: 'integer' },
          approved: { type: 'integer' },
          overridden: { type: 'integer' },
          overrideRate: { type: 'number' },
          metrics: {
            oneOf: [{ $ref: '#/components/schemas/EvalMetrics' }, { type: 'null' }],
          },
        },
      },
      EvalMetrics: {
        type: 'object',
        properties: {
          n: { type: 'integer', description: 'Held-out sample size' },
          embedder: { type: 'string' },
          priorityExactAccuracy: { type: 'number' },
          priorityWithin1Accuracy: { type: 'number' },
          majorityBaseline: { type: 'number' },
          routingAccuracy: { type: 'number' },
          autoRouteRate: { type: 'number' },
          reviewRate: { type: 'number' },
          highRiskRate: { type: 'number' },
          wouldBeMisses: { type: 'integer' },
          calibration: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                bucket: { type: 'string' },
                n: { type: 'integer' },
                accuracy: { type: ['number', 'null'] },
                autoRouteRate: { type: ['number', 'null'] },
              },
            },
          },
          confusion: {
            type: 'object',
            description: 'actual (rows) → predicted (cols) priority counts',
            additionalProperties: {
              type: 'object',
              additionalProperties: { type: 'integer' },
            },
          },
          note: { type: 'string' },
        },
      },
    },
  },
};
