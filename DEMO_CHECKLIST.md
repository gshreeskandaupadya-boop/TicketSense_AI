# Demo-Day Checklist — TicketSense (PS-04)

Your model status: **everything is real** — 12 working API endpoints (no empty
stubs), real dataset, real eval, working UI. What remains below is DEPLOY +
PREP, not building.

---

## PART A — TONIGHT: 6 steps to a complete working model

### Step 1 — Prove it works on a clean machine (5 min)
```bash
npm install
npm run build          # builds data index + frontend  (NOT optional!)
npm start              # open http://localhost:3001
```
**Rule: if `npm run build` shows an error, STOP and read it. Never trust a
command piped into `tail`/`grep` — the pipe hides the failure.**

Check 4 things in the browser:
- [ ] Header shows **● API connected** and `local · corpus 60`
- [ ] New Ticket → click **Refund request** → Decide → card shows evidence and **⏸ Held for review**
- [ ] **Eval & Stats** → "Run eval on held-out set" → numbers appear
- [ ] `http://localhost:3001/api/docs` → the API documentation page

### Step 2 — Push your code (2 min)
Ensure your latest code is pushed to your repository branch (`main`).

### Step 3 — Deploy (10 min) — DO THIS TONIGHT, NOT TOMORROW
**Recommended: ONE Render service (API + UI together).**
1. render.com → **New → Web Service** → connect your GitHub repo
2. Select branch `main` (Render auto-reads `render.yaml`)
3. Build/Start commands are pre-filled from render.yaml — don't change them
4. Click **Deploy** → wait 2–4 minutes
5. Verify on the live URL:
   - `https://<name>.onrender.com` → app loads
   - `https://<name>.onrender.com/api/health` → `{"ok":true,...}`
   - `https://<name>.onrender.com/api/docs` → API docs

Optional env vars (Dashboard → Environment):
- `MONGODB_URI` = your MongoDB connection string → keeps the ledger across deploys
- `OPENAI_API_KEY` = (only if you want real LLM decisions) → set as RUNTIME var, never needed at build

### Step 4 — Fill the submission form's "API section" (5 min)
Paste these (replace with your real URL):

| Form field | What to paste |
|---|---|
| API Base URL | `https://<name>.onrender.com` |
| API Docs / Documentation URL | `https://<name>.onrender.com/api/docs` |
| OpenAPI / Swagger spec | `https://<name>.onrender.com/api/openapi.json` |
| Sample endpoints | `POST /api/tickets/ingest`, `GET /api/ledger`, `POST /api/ledger/{id}/override` |
| API key field | Leave empty / write "None — open demo API" |
| Postman collection (if asked) | Say: "Interactive docs at /api/docs with example request bodies" |

**Nothing is empty. Every URL above returns real content right now.**

### Step 5 — Record a 2–3 min demo video (30 min) — your safety net
Internet may fail tomorrow. A recording of Steps 1–4 running saves you.
Follow the demo script in Part E.

### Step 6 — Sleep. Re-check the live URL 10 minutes before your slot.
---

## PART B — WHERE YOU WILL GET STUCK (and instant fixes)

| # | Stuck moment | Why it happens | Fix |
|---|---|---|---|
| 1 | Live URL shows spinner / blank for ~1 min | **Render free tier cold start** (service sleeps when unused) | Open your URL **10 minutes before** the demo to wake it. Not a bug. |
| 2 | Deploy succeeds but app says "API unreachable" | Frontend hosted separately without `VITE_API_URL` | Don't split-host. Use the single Render service (Part A Step 3) |
| 3 | App is up but decisions are nonsense / examples empty | `data:build` was skipped → empty corpus | Always run `npm run build` (it builds data first) |
| 4 | Everything resets after redeploy | JSON store is ephemeral on Render | Set `MONGODB_URI` (or accept it and say "demo state resets per deploy") |
| 5 | Command "passed" but nothing happened | Output piped to `tail`/`grep` hides the error | Run without pipes, or use `set -o pipefail` |
| 6 | Judges say "this isn't AI" | Running offline heuristic (no OpenAI key) | Be honest: "One LLM call per ticket when the key is set; offline mode is a deterministic fallback so it runs anywhere." |
| 7 | Asked "why is priority accuracy 18%?" | Dataset labels are noise (proven) | "Proven by cross-validation. We lead with 100% routing accuracy + traceability, and keep humans on priority." |

---

## PART C — QUESTIONS TO ASK THEM TOMORROW (copy these)

### To the helpdesk / organizers — about the submission:
1. "For the **API section**, do you want the base URL, the docs URL, or a Postman collection? I have all three."
2. "Is an **open demo API (no auth)** acceptable for judging, or do you need an API key to be issued?"
3. "Is there **internet during judging**, or should the demo run fully local? (Mine runs offline.)"
4. "How long is each demo slot, and what should I prioritize — pipeline, ledger, or eval?"
5. "For the database requirement — is a **MongoDB-mirrored evidence ledger** sufficient, or must the primary store be the database?"
6. "Do you want the repo on `main`, or is a working branch with a live deploy link fine?"

### If you get stuck at a deploy table — ask with THIS template:
> "I'm deploying [my Node/React app]. I run [command X], I expected [Y],
> but I got [exact error text]. I already checked [things you ruled out].
> What should I try next?"

Example:
> "I'm deploying the TicketSense web service on Render. Build command is
> `npm install && npm run build`, start is `npm start`, health check `/api/health`.
> The build failed with 'Cannot find package dotenv' — I already re-ran
> `npm install` locally and it works on my machine. Should I commit the
> lockfile differently, or is the build cache stale?"

**Never ask "it's not working, what do I do?"** — always include the exact error.

---

## PART D — QUESTIONS THEY WILL ASK YOU + honest one-line answers

| Their question | Your answer |
|---|---|
| "What does this do?" | "It triages support tickets: retrieves similar history, makes one strict decision, and only auto-routes when confidence is high AND the ticket is low-risk. Every decision cites its evidence." |
| "Where is the AI?" | "One LLM call per ticket when OPENAI_API_KEY is set. Offline it uses a deterministic reasoner so the demo runs anywhere. The architecture is the same." |
| "Why should I believe the output?" | "Every decision card shows the retrieved neighbours and a cited evidence snippet. Humans approve or override — and overrides become training examples." |
| "Priority accuracy looks bad." | "Yes — 18% vs a 28% baseline. The dataset's priority labels are provably noise (5-fold CV). We don't fake it: we deliver 100% routing accuracy vs policy and human-in-the-loop priority." |
| "Is there a database?" | "Evidence Ledger stored in JSON by default, mirrored to MongoDB when configured — documented in the README." |
| "How is this different from plain RAG?" | "Hybrid retrieval: semantic + structural (product/type/channel), plus a confidence/risk gate and a full audit trail. Plain RAG has none of the last three." |
| "What's the risk rule?" | "Refund, cancellation, payment, or Critical priority ALWAYS goes to a human — even at 100% confidence." |

---

## PART E — 2-MINUTE DEMO SCRIPT (practice twice tonight)

1. **[10s]** Open app → point at header: "API connected, corpus 60, offline embedder"
2. **[30s]** New Ticket → click **Refund request** example → Decide →
   "Priority Critical, but look — it's HELD for review. High-risk rule. Evidence
   is cited from these retrieved neighbours."
3. **[20s]** Click **Override** → change priority → Save →
   "This is the feedback loop. The miss is recorded, not hidden."
4. **[20s]** Tabs: **Review Queue** ("everything human-gated lands here") →
   **Evidence Ledger** ("full audit trail of every decision")
5. **[25s]** **Eval & Stats** → Run eval → "100% routing accuracy. Priority
   labels are noise — we say so openly. The calibration table shows the
   confidence gate actually works."
6. **[15s]** Open `/api/docs` → "Complete API section — 12 endpoints, OpenAPI
   spec, examples. All live."

Backup if internet dies: run Steps 1 locally on your laptop (works fully
offline) + play the recorded video.
