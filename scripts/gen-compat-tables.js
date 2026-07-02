#!/usr/bin/env node
'use strict';

/**
 * gen-compat-tables.js — project the operation manifest into markdown tables and inject
 * them into MARKER REGIONS of planning/compatibility.md.
 *
 * This is the "docs" projection of the skeleton (see meta/manifest.js): the ✅/⚠️/❌
 * status per operation is COMPUTED from the live registry ⋈ MongoDB's generated set, so the
 * table can never silently drift from what the engine actually implements — only the prose
 * `summary` is hand-authored (in meta/summaries.js).
 *
 * Injection is non-destructive: it only replaces content between
 *   <!-- GENERATED:<key> --> … <!-- /GENERATED:<key> -->
 * markers, leaving the surrounding hand-written narrative untouched. Add a marker pair to
 * the doc where you want a generated table; run this to (re)fill it.
 *
 * Run:  npm run gen-compat-tables   (also runs in `--check` mode in the test suite to fail
 *       if the committed doc is stale vs. the current registry/summaries).
 */

var fs = require('fs');
var path = require('path');
var buildManifest = require('../meta/manifest').buildManifest;

var DOC = path.resolve(__dirname, '..', 'planning', 'compatibility.md');

var STATUS_ICON = { full: '✅', partial: '⚠️', unsupported: '❌', 'micromongo-only': '➕' };

// Escape a `|` inside a cell so it doesn't split the markdown column. Authored strings in
// summaries.js use a bare `|` (e.g. `Object|null`); escaping is this renderer's job.
function cell(s) { return String(s == null ? '' : s).replace(/\|/g, '\\|'); }

// The per-op Notes text: the RICH note if authored, else the one-line summary, else '—' for
// a real gap. This is the single place the summaries.js `notes`/`summary` split resolves.
function noteFor(r) {
  return r.notes || r.summary || (r.status === 'unsupported' ? '—' : '');
}

// Render one surface's manifest records as a markdown table. `withReturns` adds a Returns
// column (only the methods table carries meaningful return shapes).
function renderTable(records, headers, withReturns) {
  var rows = records.map(function (r) {
    var name = '`' + r.name + '`';
    var icon = STATUS_ICON[r.status] || '';
    var cols = [name, icon];
    if (withReturns) { cols.push(cell(r.returns || (r.supported ? '' : '—'))); }
    cols.push(cell(noteFor(r)));
    return '| ' + cols.join(' | ') + ' |';
  });
  return [
    '| ' + headers.join(' | ') + ' |',
    '|' + headers.map(function () { return '---'; }).join('|') + '|',
  ].concat(rows).join('\n');
}

// Marker key → { kind, label, header, registry } describing each generated surface.
var SURFACES = {
  methods:   { kind: 'method',   label: 'MongoDB collection methods',        header: 'Method',   registry: 'the live `mm.*` + `Collection` surfaces' },
  stages:    { kind: 'stage',    label: 'MongoDB aggregation stages',        header: 'Stage',    registry: 'the live `_aggregateStageOps` registry' },
  exprOps:   { kind: 'exprOp',   label: 'MongoDB expression operators',      header: 'Operator', registry: 'the live `expressionOps` registry' },
  queryOps:  { kind: 'queryOp',  label: 'MongoDB query operators',           header: 'Operator', registry: 'the live match registries' },
  updateOps: { kind: 'updateOp', label: 'MongoDB update operators',          header: 'Operator', registry: 'the live `updateOperators` registry' },
};

// Build the generated-block content for a given marker key.
function blockFor(key, manifest) {
  var s = SURFACES[key];
  if (!s) { throw new Error('unknown generated-block key: ' + key); }
  var records = manifest[s.kind];
  var count = records.filter(function (r) { return r.supported && r.status !== 'micromongo-only'; }).length;
  var mongoTotal = records.filter(function (r) { return r.mongo; }).length;
  var withReturns = key === 'methods';  // only the methods table has a meaningful Returns column
  var headers = withReturns ? [s.header, 'Status', 'Returns', 'Notes'] : [s.header, 'Status', 'Notes'];
  return '_' + count + ' of ' + mongoTotal + ' ' + s.label + ' implemented' +
    ' (➕ = micromongo-specific). Generated from ' + s.registry + ' — do not edit by hand._\n\n' +
    renderTable(records, headers, withReturns);
}

// The "Summary at a glance" roll-up: a status × surface matrix, each cell the backtick-joined
// op names of that (surface, status). Derived from the SAME manifest as the detailed tables, so
// the two can't disagree. NB: projection operators ($slice/$meta/positional $) are NOT in the
// manifest — they live in src/crud/project.ts, outside the match registries — so they're covered
// by a hand note beneath this block, not a column here.
var SUMMARY_COLS = [
  { kind: 'method',   head: 'Collection methods' },
  { kind: 'queryOp',  head: 'Query operators' },
  { kind: 'updateOp', head: 'Update operators' },
  { kind: 'stage',    head: 'Aggregation stages' },
  { kind: 'exprOp',   head: 'Aggregation expr. operators' },
];
// Status buckets (rows). 'full' and 'micromongo-only' both read as "implemented" (➕ ops are
// supported extensions/aliases, not gaps); 'partial' = with limits; 'unsupported' = absent.
var SUMMARY_ROWS = [
  { label: '✅ Implemented',           statuses: ['full', 'micromongo-only'] },
  { label: '⚠️ Implemented w/ limits', statuses: ['partial'] },
  { label: '❌ Absent',                statuses: ['unsupported'] },
];

function summaryMatrix(manifest) {
  // ops of a surface whose status is in the given set, as `a` `b` `c` (or — if none). The
  // 'absent' bucket can be huge (120+ unimplemented expr operators) — that defeats an
  // at-a-glance roll-up, so cap it and point at the full list in the detailed table below.
  // Implemented/partial buckets are never capped (the full list is the useful part there).
  function opsFor(kind, statuses, cap) {
    var set = {}; statuses.forEach(function (s) { set[s] = true; });
    var names = manifest[kind]
      .filter(function (r) { return set[r.status]; })
      .map(function (r) { return r.name; });
    if (!names.length) return '—';
    var shown = names, extra = 0;
    if (cap && names.length > cap) { shown = names.slice(0, cap); extra = names.length - cap; }
    var out = shown.map(function (n) { return '`' + n + '`'; }).join(' ');
    return extra ? out + ' … _(+' + extra + ' more — see table below)_' : out;
  }
  var headers = ['Bucket'].concat(SUMMARY_COLS.map(function (c) { return c.head; }));
  var lines = [
    '| ' + headers.join(' | ') + ' |',
    '|' + headers.map(function () { return '---'; }).join('|') + '|',
  ];
  SUMMARY_ROWS.forEach(function (row) {
    // Cap only the 'Absent' bucket's cells (the long tail); implemented/partial stay full.
    var cap = row.statuses.indexOf('unsupported') >= 0 ? 12 : 0;
    var cells = [row.label].concat(SUMMARY_COLS.map(function (c) {
      return cell(opsFor(c.kind, row.statuses, cap));
    }));
    lines.push('| ' + cells.join(' | ') + ' |');
  });
  return '_Roll-up of the detailed tables below — derived from the same manifest, so it can\'t' +
    ' drift. Projection operators (`$slice`/`$elemMatch`/`$`/`$meta`) live in `src/crud/project.ts`' +
    ' (outside the match registries) and are covered in the [Query & projection](#query--projection-operators)' +
    ' section, not this matrix._\n\n' + lines.join('\n');
}

// Replace content between <!-- GENERATED:key --> and <!-- /GENERATED:key -->.
function inject(src, key, content) {
  var open = '<!-- GENERATED:' + key + ' -->';
  var close = '<!-- /GENERATED:' + key + ' -->';
  var oi = src.indexOf(open), ci = src.indexOf(close);
  if (oi < 0 || ci < 0 || ci < oi) {
    throw new Error('marker region for "' + key + '" not found (need ' + open + ' … ' + close + ')');
  }
  return src.slice(0, oi + open.length) + '\n' + content + '\n' + src.slice(ci);
}

function generate(check) {
  var manifest = buildManifest();
  var src = fs.readFileSync(DOC, 'utf8');
  var out = src;
  // Only inject surfaces whose marker region is actually present in the doc.
  Object.keys(SURFACES).forEach(function (key) {
    if (out.indexOf('<!-- GENERATED:' + key + ' -->') >= 0) {
      out = inject(out, key, blockFor(key, manifest));
    }
  });
  // The summary roll-up is a special (non-per-surface) block.
  if (out.indexOf('<!-- GENERATED:summary -->') >= 0) {
    out = inject(out, 'summary', summaryMatrix(manifest));
  }

  if (check) {
    return out === src;  // true = up to date; caller decides how to react (no process.exit)
  }
  fs.writeFileSync(DOC, out);
  console.log('Updated generated tables in ' + path.relative(process.cwd(), DOC));
  return true;
}

// CLI entry (not when require()d by a test): apply --check exit semantics here.
if (require.main === module) {
  var check = process.argv.indexOf('--check') >= 0;
  var ok = generate(check);
  if (check) {
    if (!ok) {
      console.error('compatibility.md generated tables are STALE. Run `npm run gen-compat-tables`.');
      process.exit(1);
    }
    console.log('compatibility.md generated tables are up to date.');
  }
}

module.exports = { generate: generate };
