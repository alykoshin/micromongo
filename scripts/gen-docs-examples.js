#!/usr/bin/env node
'use strict';

// gen-docs-examples.js — the DOCS projection of the canonical example set (meta/mongo-examples/).
//
// The HTML playground shows a CURATED subset (far fewer than the full test corpus — a doc page
// shouldn't render ~100 cards). This picks the first `docs:true` record for each op in SHOWCASE
// (order preserved), synthesizes the display call strings (functional `mm.*` and Collection `c.*`),
// and writes docs/examples.generated.json. docs/index.html reads that instead of inlining cases,
// so the playground can't drift from the verified canonical set.
//
// Run via `npm run build:docs` (chained) or directly: node scripts/gen-docs-examples.js

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var examples = require(path.join(ROOT, 'meta', 'mongo-examples')).examples;
var buildManifest = require(path.join(ROOT, 'meta', 'manifest')).buildManifest;
// Emitted as a committed .js that assigns a global (CSP-safe `<script src>` — the page can't
// `fetch` a sibling JSON under a strict CSP / file://). GitHub Pages serves it verbatim.
var OUT = path.join(ROOT, 'docs', 'examples.generated.js');

// Per-op status + note from the manifest (registry ⋈ Mongo set ⋈ summaries.js prose), so each
// card carries the SAME distinct compat note as the compat matrix — not a generic boilerplate.
// Keyed by (kind, op): the SAME name can live on multiple surfaces (e.g. `$eq` is both a query
// operator and an expression operator; `$push` is an update op AND an unsupported accumulator), so
// the card's `kind` selects the right record.
var MANIFEST = buildManifest();
// The example `kind` maps to the manifest surface key. (`projection` records have no manifest
// surface — projection ops live in project.ts, outside the registries — so fall back to queryOp.)
var KIND_TO_SURFACE = { method: 'method', stage: 'stage', exprOp: 'exprOp', queryOp: 'queryOp', updateOp: 'updateOp', projection: 'queryOp' };
// Minimal markdown→HTML for the compat notes (which are authored in markdown in summaries.js) —
// the HTML ops-table inserts them via innerHTML, so `code`/**bold**/[link](url) must be real tags.
function mdToHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')  // escape first
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}
function compatFor(op, kind) {
  var surface = KIND_TO_SURFACE[kind] || kind;
  var list = MANIFEST[surface] || [];
  var r = null;
  for (var i = 0; i < list.length; i++) { if (list[i].name === op) { r = list[i]; break; } }
  return {
    status: r ? r.status : 'full',           // full | partial | unsupported | micromongo-only
    note: r ? mdToHtml(r.notes || r.summary || '') : '',
  };
}

// The curated op list (order = display order in the playground). One card per op — the first
// `docs:true` record for that op. Grouped roughly by family for a sensible page flow.
var SHOWCASE = [
  // reads
  'find', 'distinct', 'aggregate',
  // comparison / logical / element / eval
  '$eq', '$gt', '$in', '$or', '$exists', '$regex',
  // array
  '$elemMatch', '$size',
  // updates
  '$set', '$inc', '$push', '$pull',
  // aggregation
  '$match', '$group', '$unwind', '$project', '$lookup',
];

// Synthesize a JS call string for a `do` operation on a given receiver (`mm.<op>(data, …)` for the
// functional API, `c.<op>(…)` for a Collection). Returns null when the op has no natural form on
// that receiver (e.g. no `c.aggregate` display difference — we still show it).
function j(v) { return JSON.stringify(v); }
// JSON.stringify loses RegExp (→ `{}`). `jq` serializes a query/pipeline to a JS-source string that
// keeps RegExp literals (e.g. `{ s: { $regex: /^a/ } }`), so the generated call is runnable.
function jq(v) {
  if (v instanceof RegExp) { return v.toString(); }
  if (Array.isArray(v)) { return '[' + v.map(jq).join(', ') + ']'; }
  if (v && typeof v === 'object') {
    return '{ ' + Object.keys(v).map(function (k) {
      var key = /^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k);
      return key + ': ' + jq(v[k]);
    }).join(', ') + ' }';
  }
  return JSON.stringify(v);
}
function funcCall(doo) {
  var op = Object.keys(doo)[0], s = doo[op];
  switch (op) {
    case 'find': return 'mm.find(data, ' + jq(s.query || {}) + (s.projection ? ', ' + j(s.projection) : '') + ')';
    case 'findOne': return 'mm.findOne(data, ' + jq(s.query || {}) + ')';
    case 'distinct': return 'mm.distinct(data, ' + j(s.field) + ')';
    case 'count': return 'mm.countDocuments(data, ' + jq(s.query || {}) + ')';
    case 'aggregate': return 'mm.aggregate(data, ' + jq(s.pipeline) + ')';
    case 'updateOne': case 'updateMany':
      return '(mm.' + op + '(data, ' + jq(s.query) + ', ' + jq(s.update) + '), data)';
    default: return null;
  }
}
function collCall(doo) {
  var op = Object.keys(doo)[0], s = doo[op];
  switch (op) {
    // Collection.find takes the projection as the 2nd positional arg, and returns a Cursor
    // (.toArray()). Collection.aggregate returns a plain array (NO .toArray()).
    case 'find': return 'c.find(' + jq(s.query || {}) + (s.projection ? ', ' + j(s.projection) : '') + ').toArray()';
    case 'findOne': return 'c.findOne(' + jq(s.query || {}) + ')';
    case 'distinct': return 'c.distinct(' + j(s.field) + ')';
    case 'count': return 'c.countDocuments(' + jq(s.query || {}) + ')';
    case 'aggregate': return 'c.aggregate(' + jq(s.pipeline) + ')';
    case 'updateOne': case 'updateMany':
      return '(c.' + op + '(' + jq(s.query) + ', ' + jq(s.update) + '), c.toArray())';
    default: return null;
  }
}

function main() {
  var byOp = {};
  examples.forEach(function (e) { if (e.docs && !byOp[e.op]) { byOp[e.op] = e; } });

  // For a $lookup card, the call needs its foreign collection(s) registered first. Prepend a
  // comma-expression that seeds them via mm.collection(name, docs) so the ready-made call string
  // stays a single runnable expression (the playground evaluates `return (<call>)`).
  function withSeeds(call, e) {
    if (!call || !e.collections) { return call; }
    var regs = Object.keys(e.collections).map(function (n) {
      return 'mm.collection(' + j(n) + ', ' + j(e.collections[n]) + ')';
    });
    return '(' + regs.join(', ') + ', ' + call + ')';
  }

  var cards = [];
  var missing = [];
  SHOWCASE.forEach(function (op) {
    var e = byOp[op];
    if (!e) { missing.push(op); return; }
    var c = compatFor(e.op, e.kind);
    cards.push({
      op: e.op,
      kind: e.kind,
      title: e.title || '',
      source: e.source || '',
      status: c.status,                     // drives the ✅/⚠️ icon in the compat column
      note: c.note,                         // the DISTINCT per-op compat note (from summaries.js)
      fixture: e.fixture,
      do: e.do,
      expect: e.expect,
      func: withSeeds(funcCall(e.do), e),   // display + runnable string (functional API)
      coll: withSeeds(collCall(e.do), e),   // display + runnable string (Collection API)
      collections: e.collections || null,   // $lookup foreign seeds (also embedded in the calls)
    });
  });

  if (missing.length) {
    console.warn('gen-docs-examples: no docs:true record for showcase op(s): ' + missing.join(', '));
  }
  var banner = '// GENERATED by scripts/gen-docs-examples.js — do not edit. The curated showcase\n' +
    '// subset of meta/mongo-examples/ (verified vs micromongo AND real MongoDB) for the playground.\n';
  fs.writeFileSync(OUT, banner + 'window.__MM_EXAMPLES__ = ' + JSON.stringify(cards, null, 2) + ';\n');
  console.log('Wrote ' + path.relative(ROOT, OUT) + ' (' + cards.length + ' showcase cards).');
}

main();
