'use strict';

/**
 * Example-driven tests — the DRY payoff of the docs/tests skeleton.
 *
 * Each authored `example: { seed, call, result }` in meta/summaries.js is ONE
 * artifact that serves BOTH the docs (it can render in the HTML ops-table / playground)
 * AND a test here: we run `call` against a fresh clone of `seed` and assert it deep-equals
 * `result`. So an example can't rot — if behavior changes, this test fails; if the doc
 * shows the example, the doc is guaranteed accurate.
 *
 * `seed` and `call` are JS-source strings evaluated with `data`/`c` (a Collection over the
 * seed) and `mm` in scope — the same execution model as the HTML playground, so an example
 * proven here renders identically there.
 */

var chai = require('chai');
var expect = chai.expect;

var mm = require('../../dist/index');
var buildManifest = require('../../meta/manifest').buildManifest;

function runExample(ex) {
  var data = new Function('return (' + ex.seed + ');')();  // fresh clone
  var c = new mm.Collection(data);
  var fn = new Function('data', 'c', 'mm', 'return (' + ex.call + '\n);');
  return fn(data, c, mm);
}

describe('# Skeleton example-driven tests (one example → doc + test)', function () {

  var manifest = buildManifest();
  var kinds = ['method', 'stage', 'exprOp', 'queryOp', 'updateOp'];

  var total = 0;
  kinds.forEach(function (kind) {
    manifest[kind].forEach(function (rec) {
      if (!rec.example) { return; }
      total++;
      it('# ' + kind + ' ' + rec.name + ': `' + rec.example.call + '`', function () {
        var actual = runExample(rec.example);
        expect(actual).eql(rec.example.result,
          rec.name + ' example produced an unexpected result — update the example in ' +
          'meta/summaries.js, or the behavior regressed.');
      });
    });
  });

  it('# at least one example is defined (the mechanism is exercised)', function () {
    expect(total).to.be.greaterThan(0);
  });

});
