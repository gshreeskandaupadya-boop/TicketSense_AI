// API documentation routes:
//   GET /api/openapi.json — machine-readable OpenAPI 3.1 spec
//   GET /api/docs         — self-contained human-readable docs (no CDN)
import express from 'express';
import { openapi } from '../openapi.js';

export const docs = express.Router();

docs.get('/openapi.json', (_req, res) => {
  res.json(openapi);
});

docs.get('/docs', (_req, res) => {
  res.type('html').send(DOCS_HTML);
});

const DOCS_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>TicketSense API — Documentation</title>
<style>
  :root {
    --bg: #0f172a; --panel: #1e293b; --border: #334155; --text: #e2e8f0;
    --muted: #94a3b8; --accent: #38bdf8; --get: #22c55e; --post: #f59e0b;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; background: var(--bg); color: var(--text); }
  .wrap { max-width: 960px; margin: 0 auto; padding: 32px 20px 80px; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  h1 .v { color: var(--muted); font-size: 15px; font-weight: 400; }
  .lead { color: var(--muted); white-space: pre-line; margin: 8px 0 24px; }
  .tag { margin: 28px 0 12px; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); }
  .op { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; margin: 10px 0; overflow: hidden; }
  .op-head { display: flex; gap: 12px; align-items: center; padding: 12px 16px; cursor: pointer; }
  .op-head:hover { background: #24344b; }
  .method { font: 600 11px/1 ui-monospace, monospace; padding: 5px 9px; border-radius: 5px; color: #0f172a; min-width: 52px; text-align: center; }
  .method.get { background: var(--get); }
  .method.post { background: var(--post); }
  .path { font: 600 14px/1.4 ui-monospace, monospace; }
  .summary { color: var(--muted); font-size: 13px; margin-left: auto; text-align: right; }
  .op-body { display: none; border-top: 1px solid var(--border); padding: 16px; }
  .op.open .op-body { display: block; }
  .op-body h4 { margin: 14px 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
  .op-body p.desc { margin: 6px 0; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { border: 1px solid var(--border); padding: 6px 10px; text-align: left; vertical-align: top; }
  th { background: #24344b; font-weight: 600; }
  code, pre { font: 12.5px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; }
  code { background: #24344b; padding: 1px 5px; border-radius: 4px; }
  pre { background: #0b1220; border: 1px solid var(--border); border-radius: 8px; padding: 12px; overflow: auto; }
  .resp { display: inline-block; min-width: 42px; text-align: center; border-radius: 4px; padding: 1px 7px; font: 600 12px ui-monospace, monospace; }
  .s2 { background: #14532d; color: #bbf7d0; }
  .s4 { background: #7c2d12; color: #fed7aa; }
  .s5 { background: #7f1d1d; color: #fecaca; }
  a { color: var(--accent); }
  footer { margin-top: 40px; color: var(--muted); font-size: 13px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>TicketSense API <span class="v"></span></h1>
  <div class="lead" id="lead"></div>
  <div id="ops"></div>
  <footer>
    Machine-readable spec: <a href="./openapi.json">/api/openapi.json</a> ·
    Confidence-gated triage pipeline · BFWAI/HACK 26 · PS-04
  </footer>
</div>
<script>
(async () => {
  const spec = await (await fetch('./openapi.json')).json();
  document.querySelector('h1 .v').textContent = 'v' + spec.info.version;
  document.getElementById('lead').textContent = spec.info.description.replace(/\\*\\*/g, '');
  const opsEl = document.getElementById('ops');
  let lastTag = null;
  for (const [p, methods] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(methods)) {
      if (op.tags && op.tags[0] !== lastTag) {
        lastTag = op.tags[0];
        const t = document.createElement('div');
        t.className = 'tag';
        t.textContent = lastTag;
        opsEl.appendChild(t);
      }
      const el = document.createElement('div');
      el.className = 'op';
      const params = (op.parameters || []).map(refParam).filter(Boolean);
      const body = op.requestBody?.content?.['application/json'];
      const bodySchema = body?.schema?.$ref ? resolve(body.schema.$ref) : body?.schema;
      const rows = params.map(pm =>
        '<tr><td><code>' + pm.name + '</code></td><td>' + (pm.in||'') + '</td><td>' + (pm.description||'') +
        (pm.schema?.enum ? '<br><i>one of: ' + pm.schema.enum.join(', ') + '</i>' : '') + '</td></tr>').join('');
      el.innerHTML =
        '<div class="op-head"><span class="method ' + method + '">' + method.toUpperCase() + '</span>' +
        '<span class="path">' + p + '</span><span class="summary">' + (op.summary||'') + '</span></div>' +
        '<div class="op-body">' +
        (op.description ? '<p class="desc">' + op.description + '</p>' : '') +
        (rows ? '<h4>Parameters</h4><table><tr><th>name</th><th>in</th><th>description</th></tr>' + rows + '</table>' : '') +
        (bodySchema ? '<h4>Request body</h4>' + renderSchema(bodySchema) + (body?.examples ? renderExamples(body.examples) : '') : '') +
        '<h4>Responses</h4><table><tr><th>code</th><th>description</th></tr>' +
        Object.entries(op.responses).map(([code, r]) => {
          const rr = r.$ref ? resolve(r.$ref) : r;
          const cls = code[0]==='2' ? 's2' : code[0]==='4' ? 's4' : 's5';
          return '<tr><td><span class="resp ' + cls + '">' + code + '</span></td><td>' + (rr.description||'') +
            (rr.content ? renderSchema(rr.content['application/json'].schema?.$ref ? resolve(rr.content['application/json'].schema.$ref) : rr.content['application/json'].schema) : '') +
            '</td></tr>';
        }).join('') + '</table>' +
        '</div>';
      el.querySelector('.op-head').onclick = () => el.classList.toggle('open');
      opsEl.appendChild(el);
    }
  }
  function refParam(p) { return p.$ref ? resolve(p.$ref) : p; }
  function resolve(ref) {
    return ref.replace(/^#\\//, '').split('/').reduce((o, k) => o?.[k], spec);
  }
  function renderSchema(s) {
    if (!s) return '';
    if (s.type === 'array') return '<p class="desc">array of ' + (s.items?.$ref ? ref(s.items.$ref) : 'objects') + '</p>';
    const props = s.properties || {};
    const rows = Object.entries(props).map(([k, v]) => {
      const type = v.type ? (Array.isArray(v.type) ? v.type.join('|') : v.type) : (v.$ref ? ref(v.$ref) : 'object');
      return '<tr><td><code>' + k + '</code></td><td>' + type + '</td><td>' + (v.description||'') +
        (v.enum ? '<br><i>one of: ' + v.enum.join(', ') + '</i>' : '') + '</td></tr>';
    }).join('');
    return rows ? '<table><tr><th>field</th><th>type</th><th>description</th></tr>' + rows + '</table>' : '';
  }
  function ref(r) { return '<code>' + r.split('/').pop() + '</code>'; }
  function renderExamples(ex) {
    return Object.entries(ex).map(([k, e]) =>
      '<h4>Example: ' + (e.summary || k) + '</h4><pre>' + JSON.stringify(e.value, null, 2) + '</pre>').join('');
  }
})();
</script>
</body>
</html>`;
