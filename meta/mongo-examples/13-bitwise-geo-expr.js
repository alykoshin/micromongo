'use strict';

// Ported from find-bitwisequery, find-geospatial, find-expr, rand -mongodoc.js

module.exports = [

  // ==== Bitwise Query Operators ==============================================
  // Doc dataset from the $bitsAllSet page; the BinData document (_id:4) is
  // omitted — micromongo has no BinData type. a:54 = 00110110, a:20 = 00010100.
  // The original tests assert only _id values (via an ids() helper); expanded
  // here to full documents.

  // ---- $bitsAllSet ---------------------------------------------------------
  {
    op: '$bitsAllSet',
    kind: 'queryOp',
    title: '$bitsAllSet with a bit position array [1, 5]',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/bitsAllSet/',
    fixture: [
      { _id: 1, a: 54 },
      { _id: 2, a: 20 },
      { _id: 3, a: 20 },
    ],
    do: { find: { query: { a: { $bitsAllSet: [ 1, 5 ] } } } },
    expect: [
      { _id: 1, a: 54 },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$bitsAllSet',
    kind: 'queryOp',
    title: '$bitsAllSet with an integer bitmask 50',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/bitsAllSet/',
    fixture: [
      { _id: 1, a: 54 },
      { _id: 2, a: 20 },
      { _id: 3, a: 20 },
    ],
    do: { find: { query: { a: { $bitsAllSet: 50 } } } },
    expect: [
      { _id: 1, a: 54 },
    ],
    real: 'exact',
    docs: false,
  },

  // ---- $bitsAnySet ---------------------------------------------------------
  {
    op: '$bitsAnySet',
    kind: 'queryOp',
    title: '$bitsAnySet — any of positions [1, 5] set',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/bitsAnySet/',
    fixture: [
      { _id: 1, a: 54 },
      { _id: 2, a: 20 },
      { _id: 3, a: 20 },
    ],
    do: { find: { query: { a: { $bitsAnySet: [ 1, 5 ] } } } },
    expect: [
      { _id: 1, a: 54 },
    ],
    real: 'exact',
    docs: true,
  },

  // ---- $bitsAllClear -------------------------------------------------------
  {
    op: '$bitsAllClear',
    kind: 'queryOp',
    title: '$bitsAllClear — all of positions [1, 5] clear',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/bitsAllClear/',
    fixture: [
      { _id: 1, a: 54 },
      { _id: 2, a: 20 },
      { _id: 3, a: 20 },
    ],
    do: { find: { query: { a: { $bitsAllClear: [ 1, 5 ] } } } },
    expect: [
      { _id: 2, a: 20 },
      { _id: 3, a: 20 },
    ],
    real: 'exact',
    docs: true,
  },

  // ---- $bitsAnyClear -------------------------------------------------------
  {
    op: '$bitsAnyClear',
    kind: 'queryOp',
    title: '$bitsAnyClear — any of positions [1, 2] clear',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/bitsAnyClear/',
    fixture: [
      { _id: 1, a: 54 },
      { _id: 2, a: 20 },
      { _id: 3, a: 20 },
    ],
    do: { find: { query: { a: { $bitsAnyClear: [ 1, 2 ] } } } },
    expect: [
      { _id: 2, a: 20 },
      { _id: 3, a: 20 },
    ],
    real: 'exact',
    docs: true,
  },

  // ==== Geospatial Query Operators ===========================================
  // Coordinate order is [longitude, latitude]. micromongo supports legacy
  // coordinate pairs [x, y] and GeoJSON, with planar/spherical distance;
  // index-backed behavior is not modeled.

  // ---- $geoWithin ----------------------------------------------------------
  {
    op: '$geoWithin',
    kind: 'queryOp',
    title: '$geoWithin with $box',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/geoWithin/',
    fixture: [
      { _id: 1, loc: [ 2, 2 ] },
      { _id: 2, loc: [ 5, 5 ] },
      { _id: 3, loc: [ 8, 8 ] },
      { _id: 4, loc: [ 12, 12 ] },
    ],
    do: { find: { query: { loc: { $geoWithin: { $box: [ [ 0, 0 ], [ 10, 10 ] ] } } } } },
    expect: [
      { _id: 1, loc: [ 2, 2 ] },
      { _id: 2, loc: [ 5, 5 ] },
      { _id: 3, loc: [ 8, 8 ] },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$geoWithin',
    kind: 'queryOp',
    title: '$geoWithin with $center (circle radius 3 at [5,5])',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/geoWithin/',
    fixture: [
      { _id: 1, loc: [ 2, 2 ] },
      { _id: 2, loc: [ 5, 5 ] },
      { _id: 3, loc: [ 8, 8 ] },
      { _id: 4, loc: [ 12, 12 ] },
    ],
    do: { find: { query: { loc: { $geoWithin: { $center: [ [ 5, 5 ], 3 ] } } } } },
    expect: [
      { _id: 2, loc: [ 5, 5 ] },
    ],
    real: 'exact',
    docs: false,
  },

  {
    op: '$geoWithin',
    kind: 'queryOp',
    title: '$geoWithin with $polygon (triangle)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/geoWithin/',
    fixture: [
      { _id: 1, loc: [ 2, 2 ] },
      { _id: 2, loc: [ 5, 5 ] },
      { _id: 3, loc: [ 8, 8 ] },
      { _id: 4, loc: [ 12, 12 ] },
    ],
    do: { find: { query: { loc: { $geoWithin: { $polygon: [ [ 0, 0 ], [ 3, 6 ], [ 6, 1 ], [ 0, 0 ] ] } } } } },
    // Original asserts only contains(1) && not.contains(4); full deterministic result is [1].
    expect: [
      { _id: 1, loc: [ 2, 2 ] },
    ],
    real: 'exact',
    docs: false,
  },

  {
    op: '$geoWithin',
    kind: 'queryOp',
    title: '$geoWithin with $geometry (GeoJSON Polygon)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/geoWithin/',
    fixture: [
      { _id: 1, loc: [ 2, 2 ] },
      { _id: 2, loc: [ 5, 5 ] },
      { _id: 3, loc: [ 8, 8 ] },
      { _id: 4, loc: [ 12, 12 ] },
    ],
    do: { find: { query: { loc: { $geoWithin: { $geometry: {
      type: 'Polygon',
      coordinates: [ [ [ 0, 0 ], [ 0, 10 ], [ 10, 10 ], [ 10, 0 ], [ 0, 0 ] ] ],
    } } } } } },
    expect: [
      { _id: 1, loc: [ 2, 2 ] },
      { _id: 2, loc: [ 5, 5 ] },
      { _id: 3, loc: [ 8, 8 ] },
    ],
    real: 'exact',
    docs: false,
  },

  // ---- $near (legacy, planar) ----------------------------------------------
  // Café A is the query point; D is beyond $maxDistance (~0.0141 > 0.01).
  // Original asserts only contains('A') && not.contains('D'); full deterministic
  // result is A, B, C. Live Mongo $near requires a 2d/2dsphere index and sorts by
  // distance, so this planar-scan result isn't directly comparable.
  {
    op: '$near',
    kind: 'queryOp',
    title: '$near with $maxDistance excludes points beyond the radius',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/near/',
    fixture: [
      { _id: 1, name: 'A', location: [ -73.96, 40.78 ] },
      { _id: 2, name: 'B', location: [ -73.965, 40.781 ] },
      { _id: 3, name: 'C', location: [ -73.955, 40.775 ] },
      { _id: 4, name: 'D', location: [ -73.98, 40.79 ] },
    ],
    do: { find: { query: { location: { $near: [ -73.96, 40.78 ], $maxDistance: 0.01 } } } },
    expect: [
      { _id: 1, name: 'A', location: [ -73.96, 40.78 ] },
      { _id: 2, name: 'B', location: [ -73.965, 40.781 ] },
      { _id: 3, name: 'C', location: [ -73.955, 40.775 ] },
    ],
    real: 'skip:legacy planar $near needs a 2d index and distance sort in live Mongo; not directly comparable',
    docs: true,
  },

  // ==== $expr ================================================================
  // monthlyBudget example — compare two fields of the same document.
  {
    op: '$expr',
    kind: 'queryOp',
    title: '$expr with $gt returns docs where spent > budget',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/expr/',
    fixture: [
      { _id: 1, category: 'food',    budget: 400, spent: 450 },
      { _id: 2, category: 'drinks',  budget: 100, spent: 150 },
      { _id: 3, category: 'clothes', budget: 100, spent: 50  },
      { _id: 4, category: 'misc',    budget: 500, spent: 300 },
      { _id: 5, category: 'travel',  budget: 200, spent: 650 },
    ],
    do: { find: { query: { $expr: { $gt: [ '$spent', '$budget' ] } } } },
    expect: [
      { _id: 1, category: 'food',   budget: 400, spent: 450 },
      { _id: 2, category: 'drinks', budget: 100, spent: 150 },
      { _id: 5, category: 'travel', budget: 200, spent: 650 },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$expr',
    kind: 'queryOp',
    title: '$expr composes with other expression operators ($lt)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/expr/',
    fixture: [
      { _id: 1, category: 'food',    budget: 400, spent: 450 },
      { _id: 2, category: 'drinks',  budget: 100, spent: 150 },
      { _id: 3, category: 'clothes', budget: 100, spent: 50  },
      { _id: 4, category: 'misc',    budget: 500, spent: 300 },
      { _id: 5, category: 'travel',  budget: 200, spent: 650 },
    ],
    do: { find: { query: { $expr: { $lt: [ '$spent', '$budget' ] } } } },
    expect: [
      { _id: 3, category: 'clothes', budget: 100, spent: 50 },
      { _id: 4, category: 'misc',    budget: 500, spent: 300 },
    ],
    real: 'exact',
    docs: false,
  },

  {
    op: '$expr',
    kind: 'queryOp',
    title: '$expr can combine with normal query clauses',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/expr/',
    fixture: [
      { _id: 1, category: 'food',    budget: 400, spent: 450 },
      { _id: 2, category: 'drinks',  budget: 100, spent: 150 },
      { _id: 3, category: 'clothes', budget: 100, spent: 50  },
      { _id: 4, category: 'misc',    budget: 500, spent: 300 },
      { _id: 5, category: 'travel',  budget: 200, spent: 650 },
    ],
    do: { find: { query: {
      category: { $in: [ 'food', 'travel', 'clothes' ] },
      $expr: { $gt: [ '$spent', '$budget' ] },
    } } },
    expect: [
      { _id: 1, category: 'food',   budget: 400, spent: 450 },
      { _id: 5, category: 'travel', budget: 200, spent: 650 },
    ],
    real: 'exact',
    docs: false,
  },

  // ==== $rand ================================================================
  // NON-DETERMINISTIC. The doc pattern samples ~half the documents via
  // { $expr: { $lt: [ 0.5, { $rand: {} } ] } }. The original test asserts only a
  // count band (within 800..1200 of 2000). Compare result COUNT vs live Mongo,
  // not exact docs.
  {
    op: '$rand',
    kind: 'queryOp',
    title: '$rand used via $expr to sample ~half the documents',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/rand/',
    fixture: (function () {
      var voters = [];
      for (var i = 0; i < 2000; ++i) { voters.push({ _id: i, district: 3 }); }
      return voters;
    })(),
    do: { find: { query: { $expr: { $lt: [ 0.5, { $rand: {} } ] } } } },
    // ~50% expected; the micromongo test asserts count within [800, 1200].
    expect: [],
    real: 'structural:count',
    docs: true,
  },

];
