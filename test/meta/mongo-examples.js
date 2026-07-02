'use strict';

/**
 * Canonical example tests (vs micromongo) — one of the five projections of
 * meta/mongo-examples.js (see planning/unified-examples.md). Every record's `do` operation is run
 * against micromongo and asserted deep-equal to `expect`. The SAME records also drive the live-Mongo
 * differential harness (test-mongo/differential.mjs), so a record proven here is the exact case
 * checked against a real server.
 */

/* globals describe, it */

var chai = require('chai');
var expect = chai.expect;

var mm = require('../../dist/index');
var examples = require('../../meta/mongo-examples').examples;
var applyMicromongo = require('../../meta/apply-example').applyMicromongo;
var normalize = require('../../meta/apply-example').normalize;

describe('# Canonical MongoDB examples (vs micromongo)', function () {

  examples.forEach(function (ex) {
    it('# ' + ex.kind + ' ' + ex.op + ' — ' + (ex.title || ''), function () {
      var actual = normalize(applyMicromongo(mm, ex.fixture, ex.do, ex.collections));
      var want = normalize(ex.expect);
      var mode = ex.real || 'exact';

      // A non-deterministic example (`skip:` — $rand, $currentDate, string $where) can't be
      // exact-asserted on EITHER engine; just prove it runs without throwing.
      if (mode.indexOf('skip') === 0) { return; }

      if (mode.indexOf('structural:') === 0) {
        // Weaker invariant (matches the live-Mongo harness): assert COUNT or _id ORDER, not value.
        var kind = mode.slice('structural:'.length);
        if (kind === 'count') {
          var len = function (x) { return Array.isArray(x) ? x.length : x; };
          // $rand samples ~half; assert a sane non-degenerate count against the fixture size.
          expect(len(actual)).to.be.a('number');
          expect(len(actual)).to.be.greaterThan(0);
          expect(len(actual)).to.be.at.most(ex.fixture.length);
        } else if (kind === 'order') {
          expect(actual.map(function (d) { return d && d._id; }))
            .eql(want.map(function (d) { return d && d._id; }));
        } else {
          throw new Error('unknown structural kind: ' + kind + ' (' + ex.op + ')');
        }
        return;
      }

      expect(actual).eql(want,
        ex.op + ' diverged from its documented result. Fix the engine, or update the example in ' +
        'meta/mongo-examples/' + (ex._file || '?') + '. Source: ' + ex.source);
    });
  });

  it('# the example set is non-empty and each record is well-formed', function () {
    expect(examples.length).to.be.greaterThan(0);
    examples.forEach(function (ex) {
      expect(ex, JSON.stringify(ex)).to.have.property('op');
      expect(ex).to.have.property('kind');
      expect(ex).to.have.property('fixture');
      expect(ex).to.have.property('do');
      expect(ex).to.have.property('expect');
      expect(ex).to.have.property('source');           // provenance is mandatory (the -mongodoc rule)
      expect(Object.keys(ex.do)).to.have.length(1);    // `do` is a single-op object
    });
  });
});
