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

// Render one surface's manifest records as a markdown table.
function renderTable(records, headers) {
  var rows = records.map(function (r) {
    var name = '`' + r.name + '`';
    var icon = STATUS_ICON[r.status] || '';
    var note = r.summary || (r.status === 'unsupported' ? '—' : '');
    return '| ' + name + ' | ' + icon + ' | ' + note + ' |';
  });
  return [
    '| ' + headers.join(' | ') + ' |',
    '|' + headers.map(function () { return '---'; }).join('|') + '|',
  ].concat(rows).join('\n');
}

// Marker key → { kind, label, header, registry } describing each generated surface.
var SURFACES = {
  methods:   { kind: 'method',   label: 'MongoDB collection methods',        header: 'Method',   registry: 'the live `mm.*` surface' },
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
  return '_' + count + ' of ' + mongoTotal + ' ' + s.label + ' implemented' +
    ' (➕ = micromongo-specific). Generated from ' + s.registry + ' — do not edit by hand._\n\n' +
    renderTable(records, [s.header, 'Status', 'Notes']);
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
