/**
 * Named-collection registry + $out (Phase 11).
 *
 * mm.collection(name) is micromongo's `db.collection(name)` — it gives $out and
 * $lookup a namespace to resolve names against. $out / $lookup also accept a
 * Collection or array directly (no registration needed).
 */

'use strict';

/* globals describe, beforeEach, it */

var chai = require('chai');
var expect = chai.expect;

var mm = require('../lib/');


describe('# collection registry', function () {

  beforeEach(function () { mm._registry.reset(); });

  it('# mm.collection(name, array) registers and returns a Collection', function () {
    var c = mm.collection('orders', [ { _id: 1 } ]);
    expect(c).instanceof(mm.Collection);
    expect(mm.collection('orders')).equal(c);
  });

  it('# mm.db sugar accessor', function () {
    mm.collection('widgets', [ { a: 1 } ]);
    expect(mm.db.widgets).instanceof(mm.Collection);
    expect(mm.db.widgets.toArray()).eql([ { a: 1 } ]);
  });

  it('# get lazily creates an empty collection (Mongo-style)', function () {
    expect(mm.collection('fresh').toArray()).eql([]);
  });

  it('# registering an existing Collection keeps identity', function () {
    var c = new mm.Collection([ { x: 1 } ]);
    expect(mm.collection('c', c)).equal(c);
  });
});


describe('# $out', function () {

  beforeEach(function () { mm._registry.reset(); });

  it('# writes the pipeline result to a named collection (lazy-created)', function () {
    var src = [ { _id: 1, s: 'a' }, { _id: 2, s: 'b' }, { _id: 3, s: 'a' } ];
    var r = mm.aggregate(src, [ { $match: { s: 'a' } }, { $out: 'archive' } ]);
    expect(r.map(function (d) { return d._id; })).eql([ 1, 3 ]);
    expect(mm.collection('archive').toArray().map(function (d) { return d._id; })).eql([ 1, 3 ]);
  });

  it('# REPLACES the target contents (not append)', function () {
    mm.collection('arch', [ { old: 1 } ]);
    mm.aggregate([ { fresh: 1 } ], [ { $out: 'arch' } ]);
    expect(mm.collection('arch').toArray()).eql([ { fresh: 1 } ]);
  });

  it('# accepts a plain array target directly', function () {
    var target = [];
    mm.aggregate([ { x: 1 }, { x: 2 } ], [ { $out: target } ]);
    expect(target).eql([ { x: 1 }, { x: 2 } ]);
  });

  it('# accepts a Collection target directly', function () {
    var target = new mm.Collection([ { old: 1 } ]);
    mm.aggregate([ { x: 9 } ], [ { $out: target } ]);
    expect(target.toArray()).eql([ { x: 9 } ]);
  });

  it('# must be the final pipeline stage', function () {
    expect(function () { mm.aggregate([ { a: 1 } ], [ { $out: [] }, { $match: {} } ]); })
      .throw(/final stage/);
  });

  it('# requires a target', function () {
    expect(function () { mm.aggregate([ { a: 1 } ], [ { $out: null } ]); }).throw(/requires a target/);
  });
});
