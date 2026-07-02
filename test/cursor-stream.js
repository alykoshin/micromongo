/**
 * Streaming Cursor tests (roadmap §2).
 *
 * The safety net: the streaming path (`[Symbol.iterator]`/`[Symbol.asyncIterator]`/`.stream()`)
 * must produce results IDENTICAL to the array path (`toArray()`) across a randomized
 * query/sort/skip/limit/projection matrix — streaming is a performance path, never a
 * behavior change. Plus the two properties that justify it:
 *   - early termination: a NO-sort limited stream stops pulling once `limit` docs are emitted
 *     (constant memory; the tail is never scanned).
 *   - bounded top-K: `sort` + `limit` never materializes the full sorted array (O(K) memory),
 *     yet returns the SAME (stable) window as the full sort.
 */

'use strict';

/* globals describe, it */

var chai = require('chai');
var expect = chai.expect;
var _ = require('lodash');

var Collection = require('../dist/collection');

// tiny seeded PRNG so the randomized matrix is deterministic (reproducible failures).
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('# Cursor streaming', function () {

  describe('# stream === toArray (randomized equivalence matrix)', function () {
    it('# [...cursor] deep-equals cursor.toArray() across queries/sort/skip/limit/project', function () {
      var rand = mulberry32(12345);
      var ri = function (n) { return Math.floor(rand() * n); };
      var cases = 0;
      for (var t = 0; t < 1500; t++) {
        var n = ri(50);
        var data = [];
        for (var i = 0; i < n; i++) {
          data.push({ _id: i, a: ri(8), b: ri(4), grp: ['x', 'y', 'z'][ri(3)] });
        }
        var c = new Collection(data);
        if (ri(2)) { c.createIndex({ a: 1 }); }     // exercise the index sort-provider path too

        var q = ri(2) ? {} : { a: { $gte: ri(8) } };
        var spec = ri(2) ? { a: ri(2) ? 1 : -1 } : (ri(2) ? { a: 1, b: -1 } : null);
        var sk = ri(6);
        var lim = ri(2) ? ri(10) : null;
        var proj = ri(3) === 0 ? { _id: 0, a: 1 } : null;

        function build() {
          var cur = c.find(q);
          if (spec) { cur.sort(spec); }
          if (sk) { cur.skip(sk); }
          if (lim !== null) { cur.limit(lim); }
          if (proj) { cur.project(proj); }
          return cur;
        }

        var arr = build().toArray();
        var streamed = Array.from(build());       // [Symbol.iterator]
        cases++;
        expect(streamed).eql(arr,
          'mismatch @case ' + t + ' spec=' + JSON.stringify(spec) + ' skip=' + sk + ' limit=' + lim);
      }
      expect(cases).to.be.greaterThan(0);
    });
  });

  describe('# early termination (no sort)', function () {
    it('# a limited stream stops scanning once `limit` docs are emitted', function () {
      // Instrument the source: each doc counts a field-read when the matcher touches `a`.
      var reads = 0;
      var data = [];
      for (var i = 0; i < 1000; i++) {
        data.push(Object.defineProperty({ _id: i }, 'a', {
          enumerable: true, get: function () { reads++; return 1; },
        }));
      }
      var c = new Collection(data);
      var got = 0;
      for (var d of c.find({ a: 1 }).limit(3)) { void d; got++; }
      expect(got).eql(3);
      // If it scanned all 1000, reads would be ~1000; early termination keeps it tiny.
      expect(reads).to.be.lessThan(100);
    });

    it('# limit(0) yields nothing and scans nothing', function () {
      var reads = 0;
      var data = [Object.defineProperty({ _id: 1 }, 'a', { enumerable: true, get: function () { reads++; return 1; } })];
      var c = new Collection(data);
      expect(Array.from(c.find({ a: 1 }).limit(0))).eql([]);
      expect(reads).eql(0);
    });
  });

  describe('# bounded top-K (sort + limit)', function () {
    it('# returns the same stable window as a full sort, over a large collection', function () {
      var big = [];
      for (var i = 0; i < 5000; i++) { big.push({ _id: i, v: (i * 7919) % 101 }); } // many ties
      var c = new Collection(big);
      var streamed = Array.from(c.find({}).sort({ v: 1 }).limit(10));
      var full = c.find({}).sort({ v: 1 }).limit(10).toArray();
      expect(streamed).eql(full);       // identical incl. tie order (stability)
    });

    it('# top-K with skip returns the correct offset window', function () {
      var data = [];
      for (var i = 0; i < 100; i++) { data.push({ _id: i, v: 100 - i }); }
      var c = new Collection(data);
      var streamed = Array.from(c.find({}).sort({ v: 1 }).skip(5).limit(3));
      var full = c.find({}).sort({ v: 1 }).skip(5).limit(3).toArray();
      expect(streamed).eql(full);
    });
  });

  describe('# async iteration', function () {
    it('# for await yields the same docs as toArray()', async function () {
      var c = new Collection([{ _id: 3 }, { _id: 1 }, { _id: 2 }]);
      var out = [];
      for await (var d of c.find({}).sort({ _id: 1 })) { out.push(d); }
      expect(out).eql(c.find({}).sort({ _id: 1 }).toArray());
    });
  });

  describe('# .stream() (Node Readable)', function () {
    it('# emits each result doc then ends', function (done) {
      var c = new Collection([{ _id: 1, a: 1 }, { _id: 2, a: 1 }, { _id: 3, a: 2 }]);
      var seen = [];
      var rs = c.find({ a: 1 }).stream();
      rs.on('data', function (d) { seen.push(d); });
      rs.on('end', function () {
        expect(seen).eql(c.find({ a: 1 }).toArray());
        done();
      });
      rs.on('error', done);
    });
  });

  describe('# deep-immutability of streamed docs', function () {
    it('# mutating a streamed doc does not affect the source', function () {
      var src = [{ _id: 1, nested: { x: 1 } }];
      var c = new Collection(src);
      var first = null;
      for (var d of c.find({})) { first = d; break; }
      first.nested.x = 999;
      expect(src[0].nested.x).eql(1);   // source untouched (streamed docs are projected copies)
    });
  });
});
