/**
 * Tests for the matches() iteration seam (Phase 2).
 *
 * matches() is the single lazy generator that every read/match method consumes.
 * These tests pin its shape (yields {doc, i}) and its laziness (it does not
 * materialize the whole array — consumers can stop early).
 */

'use strict';

/* globals describe, it */

var chai = require('chai');
var expect = chai.expect;

var crud = require('../../dist/crud/');
var matches = crud._matches;


describe('# matches()', function () {

  it('# throws TypeError if first arg is not an array', function () {
    expect(function () { matches(null, {}).next(); }).throw(TypeError);
  });

  it('# yields { doc, i } for each match, in forward order', function () {
    var a = [ { a: 1 }, { a: 2 }, { a: 3 } ];
    var out = [];
    for (var m of matches(a, { a: { $gte: 2 } })) { out.push(m); }
    expect(out).eql([
      { doc: { a: 2 }, i: 1 },
      { doc: { a: 3 }, i: 2 },
    ]);
  });

  it('# empty query yields every element', function () {
    var a = [ { a: 1 }, { a: 2 } ];
    var ids = [];
    for (var m of matches(a, {})) { ids.push(m.i); }
    expect(ids).eql([ 0, 1 ]);
  });

  it('# yields the live document reference (not a copy)', function () {
    var a = [ { a: 1 } ];
    var first = matches(a, {}).next().value;
    expect(first.doc).equal(a[0]); // same reference — copying is the caller's job (project)
  });

  it('# is lazy: stops without scanning the rest of the array', function () {
    // A getter on a later element throws if accessed; pulling only the first
    // match must not reach it.
    var a = [ { a: 1 } ];
    Object.defineProperty(a, 1, { enumerable: true, get: function () {
      throw new Error('lazy violation: matches() scanned past the first pull');
    }});

    var gen = matches(a, {});
    var first = gen.next();
    expect(first.value).eql({ doc: { a: 1 }, i: 0 });
    expect(first.done).equal(false);
    // we never pull again, so the throwing getter at index 1 is never touched
  });

});
