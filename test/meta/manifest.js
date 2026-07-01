'use strict';

/**
 * Guards for the docs/tests SKELETON (meta/manifest.js + the generators).
 *
 * The manifest is the single spine: MongoDB's generated set ⋈ micromongo's live registry
 * + hand-authored summaries. These tests keep the projections honest:
 *
 *   1. Every SUPPORTED operation has an authored summary (nothing ships undescribed).
 *   2. The generated tables in the docs are UP TO DATE vs. the current registry/summaries
 *      (the committed doc can't silently drift — same idea as the operator drift guards,
 *      but for the rendered prose tables).
 */

var chai = require('chai');
var expect = chai.expect;

var buildManifest = require('../../meta/manifest').buildManifest;
var genCompat = require('../../scripts/gen-compat-tables');

describe('# Docs/tests skeleton: manifest + generated tables', function () {

  it('# every SUPPORTED operation (all surfaces) has a hand-authored summary', function () {
    var manifest = buildManifest();
    var kinds = ['method', 'stage', 'exprOp', 'queryOp', 'updateOp'];
    var missing = [];
    kinds.forEach(function (kind) {
      manifest[kind].forEach(function (r) {
        if (r.supported && !r.summary) { missing.push(kind + ' ' + r.name); }
      });
    });
    expect(missing).eql([],
      'Supported operation(s) lack a summary in meta/summaries.js: ' +
      JSON.stringify(missing) + '. Add a one-line summary so the compat table has prose.');
  });

  it('# status is computed correctly from the join (spot checks)', function () {
    var byName = {};
    buildManifest().stage.forEach(function (r) { byName[r.name] = r; });
    expect(byName['$group'].status).eql('full');        // in Mongo + supported
    expect(byName['$sort'].status).eql('partial');      // supported, flagged partial
    expect(byName['$facet'].status).eql('unsupported'); // in Mongo, not supported
  });

  it('# the generated compat tables are up to date (run `npm run gen-compat-tables` if this fails)', function () {
    // generate(true) = check mode: returns true iff the committed doc matches a fresh render.
    expect(genCompat.generate(true)).eql(true,
      'planning/compatibility.md generated tables are stale — run `npm run gen-compat-tables`.');
  });

});
