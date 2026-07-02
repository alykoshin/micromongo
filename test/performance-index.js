/**
 * Performance: indexed Collection lookup vs. linear scan.
 *
 * Companion to test/performance.js (which times the functional API on plain
 * arrays). This one quantifies what a Collection equality index buys for a
 * single plain-equality query: O(1) hash lookup vs. the O(n) scan that the
 * functional API (and an index-less Collection) always does.
 *
 * Like test/performance.js, these print timings to the console and assert only
 * loosely (timing-based assertions are flaky on shared CI) — they exist to
 * produce the numbers quoted in the README, not to gate the build. Timing uses
 * process.hrtime.bigint() (nanosecond resolution) so the sub-microsecond indexed
 * lookups are measured precisely rather than floored by Date.now()'s ~1 ms tick.
 *
 * The `after()` hooks print copy-paste-ready tables (for the README) AND write the
 * raw measurements to var/performance/index-vs-scan.json (gitignored) so the
 * numbers are available as data, not just console output.
 */

'use strict';

/* globals describe, it, after, process */

var chai = require('chai');
var expect = chai.expect;
var fs = require('fs');
var path = require('path');

var mm = require('../dist/');

// Accumulate every measured table here and write it under var/performance/ (which
// is gitignored — generated benchmark artifacts, not committed source). Written
// once after all perf blocks finish; best-effort (never fails the suite).
var PERF_RESULTS = { generatedNote: 'measured by test/performance-index.js; numbers vary per run/machine', tables: {} };
var PERF_RESULTS_DIR = path.join(__dirname, '..', 'var', 'performance');
after(function () {
  try {
    fs.mkdirSync(PERF_RESULTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(PERF_RESULTS_DIR, 'index-vs-scan.json'), JSON.stringify(PERF_RESULTS, null, 2) + '\n');
  } catch (e) { /* benchmark artifact only */ }
});


describe('#performance - index vs scan', function () {

  this.timeout(60000);

  var SIZES = [1000, 10000, 100000];
  var results = [];             // { n, scanMs, indexedMs } collected for the table

  // Build N docs with a unique `sku` so an equality query matches exactly one.
  function build(n) {
    var arr = [];
    for (var i = 0; i < n; ++i) { arr.push({ _id: i, sku: 'sku-' + i, qty: i % 100 }); }
    return arr;
  }

  // How many timed lookups per measurement. The indexed case is O(1) and cheap, so
  // it always uses INDEXED_ITERS. The scan is O(n): each findOne averages ~n/2
  // element-compares, so we cap total scanned work (~SCAN_BUDGET elements per run)
  // by using fewer lookups for larger arrays — otherwise the 100k scan would run
  // for minutes. Per-lookup µs (what we report) is independent of the count.
  var INDEXED_ITERS = 1000;
  var SCAN_BUDGET = 2000000; // ~elements scanned per timed run (n/2 * iters)
  function scanIters(n) { return Math.max(20, Math.min(1000, Math.round(SCAN_BUDGET / (n / 2)))); }

  // Spread the timed lookups EVENLY across the whole array, so the average scan
  // depth is ~n/2 and grows with n. (Querying only sku-0..sku-(iters-1) would hit
  // the front of the array, findOne would stop early, and the scan would look flat
  // regardless of n — hiding the O(n) cost.)
  function targetSku(i, n, iters) {
    return 'sku-' + Math.floor((i % iters) * n / iters);
  }

  var WARMUP = 200;   // prime JIT/caches before timing
  var REPEATS = 5;    // take the best (min) of several runs to shed GC/scheduler noise

  // Time `iters` lookups once, nanosecond resolution. Returns per-lookup ms.
  function timeOnce(coll, n, iters) {
    var start = process.hrtime.bigint();
    for (var i = 0; i < iters; ++i) { coll.findOne({ sku: targetSku(i, n, iters) }); }
    return (Number(process.hrtime.bigint() - start) / 1e6) / iters; // ns -> ms/lookup
  }

  // Best-of-REPEATS (after a warmup) — the minimum is the run least disturbed by
  // GC/scheduling, the convention for reporting micro-benchmark throughput.
  function timeLookups(coll, n, iters) {
    for (var w = 0; w < Math.min(WARMUP, iters); ++w) { coll.findOne({ sku: targetSku(w, n, iters) }); }
    var best = Infinity;
    for (var r = 0; r < REPEATS; ++r) { best = Math.min(best, timeOnce(coll, n, iters)); }
    return best;
  }

  SIZES.forEach(function (n) {
    it('# ' + n + ' docs: scan vs indexed equality lookup', function () {
      // 1) index-less Collection — every lookup is a linear scan (bounded sample count).
      var scan = new mm.Collection(build(n));
      var scanMs = timeLookups(scan, n, scanIters(n)); // per-lookup ms

      // 2) Collection WITH an equality index on `sku` (cheap — full sample count).
      var indexed = new mm.Collection(build(n));
      indexed.createIndex('sku');
      var indexedMs = timeLookups(indexed, n, INDEXED_ITERS);

      results.push({ n: n, scanMs: scanMs, indexedMs: indexedMs });

      // Sanity: both find the same document (correctness is independent of speed).
      expect(scan.findOne({ sku: 'sku-' + (n - 1) }))
        .eql(indexed.findOne({ sku: 'sku-' + (n - 1) }));
    });
  });

  after(function () {
    // scanMs/indexedMs are already per-lookup ms; show µs for readability.
    function perLookupUs(ms) { return (ms * 1000).toFixed(2); }
    function speedup(r) { return (r.scanMs / r.indexedMs).toFixed(0); }
    function pad(s, w) { s = String(s); return s + ' '.repeat(Math.max(0, w - s.length)); }

    console.log('\n  index-vs-scan: best of ' + REPEATS
      + ' runs of evenly-spread single-equality findOne() lookups (after warmup)\n');
    console.log('  ' + pad('Collection size', 16) + pad('scan (us/lookup)', 18)
      + pad('indexed (us/lookup)', 21) + 'speedup');
    console.log('  ' + '-'.repeat(16 + 18 + 21 + 8));
    results.forEach(function (r) {
      console.log('  ' + pad(r.n.toLocaleString(), 16)
        + pad(perLookupUs(r.scanMs), 18)
        + pad(perLookupUs(r.indexedMs), 21)
        + speedup(r) + 'x');
    });
    console.log('');
    PERF_RESULTS.tables.equality = {
      metric: 'us per single-equality findOne() lookup, best of ' + REPEATS,
      rows: results.map(function (r) {
        return { size: r.n, scanUs: +perLookupUs(r.scanMs), indexedUs: +perLookupUs(r.indexedMs), speedup: +speedup(r) };
      }),
    };
  });
});


// --- ordered-index range + sort (Phases 12+) ---------------------------------
describe('#performance - range & sort: ordered index vs scan', function () {

  this.timeout(60000);
  var SIZES = [1000, 10000, 100000];
  var rangeRows = [];
  var sortRows = [];

  function build(n) {
    var arr = [];
    for (var i = 0; i < n; ++i) { arr.push({ _id: i, n: (i * 2654435761) % n }); } // pseudo-shuffled
    return arr;
  }
  function bestMs(fn) {
    for (var w = 0; w < 3; ++w) { fn(); }            // warmup
    var best = Infinity;
    for (var r = 0; r < 5; ++r) {
      var s = process.hrtime.bigint(); fn();
      best = Math.min(best, Number(process.hrtime.bigint() - s) / 1e6);
    }
    return best; // ms for the whole operation
  }

  SIZES.forEach(function (n) {
    it('# ' + n + ' docs: range $gte (top ~1%) and full sort', function () {
      var threshold = Math.floor(n * 0.99); // select ~top 1% by value -> small result, deep scan
      // RANGE
      var scan = new mm.Collection(build(n));
      var idx = new mm.Collection(build(n)); idx.createIndex('n');
      var rScan = bestMs(function () { scan.find({ n: { $gte: threshold } }).toArray(); });
      var rIdx = bestMs(function () { idx.find({ n: { $gte: threshold } }).toArray(); });
      rangeRows.push({ n: n, scan: rScan, idx: rIdx });
      // SORT (full collection by indexed field)
      var sScan = bestMs(function () { scan.find({}).sort({ n: 1 }).toArray(); });
      var sIdx = bestMs(function () { idx.find({}).sort({ n: 1 }).toArray(); });
      sortRows.push({ n: n, scan: sScan, idx: sIdx });

      // correctness, not just speed
      expect(idx.find({ n: { $gte: threshold } }).toArray().length)
        .eql(scan.find({ n: { $gte: threshold } }).toArray().length);
    });
  });

  after(function () {
    function ms(x) { return x.toFixed(3); }
    function pad(s, w) { s = String(s); return s + ' '.repeat(Math.max(0, w - s.length)); }
    function table(title, rows) {
      console.log('\n  ' + title + ' (ms for the whole op, best of 5):\n');
      console.log('  ' + pad('size', 12) + pad('scan (ms)', 14) + pad('indexed (ms)', 16) + 'speedup');
      console.log('  ' + '-'.repeat(12 + 14 + 16 + 8));
      rows.forEach(function (r) {
        console.log('  ' + pad(r.n.toLocaleString(), 12) + pad(ms(r.scan), 14)
          + pad(ms(r.idx), 16) + (r.scan / Math.max(r.idx, 0.0001)).toFixed(0) + 'x');
      });
    }
    table('range $gte (~top 1%)', rangeRows);
    table('full sort by indexed field', sortRows);
    console.log('');
    function persist(rows) {
      return rows.map(function (r) {
        return { size: r.n, scanMs: +r.scan.toFixed(3), indexedMs: +r.idx.toFixed(3), speedup: +(r.scan / Math.max(r.idx, 0.0001)).toFixed(0) };
      });
    }
    PERF_RESULTS.tables.range = { metric: 'ms for whole range $gte (~top 1%) op, best of 5', rows: persist(rangeRows) };
    PERF_RESULTS.tables.sort = { metric: 'ms for whole full-sort op, best of 5', rows: persist(sortRows) };
  });
});
