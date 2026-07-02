'use strict';

// Ported from aggregate-geonear, aggregate-redact, aggregate-lookup -mongodoc.js

module.exports = [

  // =========================================================================
  // $geoNear
  // Source: https://www.mongodb.com/docs/manual/reference/operator/aggregation/geoNear/
  // Computes a distance float per doc; distances won't be bit-identical across
  // engines, so real: 'structural:order' (compare result _id ORDER, not distance).
  // =========================================================================

  {
    op: '$geoNear',
    kind: 'stage',
    title: '$geoNear filters by query, sorts by distance, adds distanceField',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/geoNear/',
    fixture: [
      { _id: 7, name: 'Central Park',
        location: { type: 'Point', coordinates: [ -73.97, 40.77 ] }, category: 'Parks' },
      { _id: 8, name: 'Sara D. Roosevelt Park',
        location: { type: 'Point', coordinates: [ -73.9928, 40.7193 ] }, category: 'Parks' },
      { _id: 9, name: 'Polo Grounds',
        location: { type: 'Point', coordinates: [ -73.9375, 40.8303 ] }, category: 'Stadiums' },
    ],
    do: { aggregate: { pipeline: [ { $geoNear: {
      near: { type: 'Point', coordinates: [ -73.99279, 40.719296 ] },
      distanceField: 'dist.calculated',
      spherical: true,
      query: { category: 'Parks' },
    } } ] } },
    // Only Parks, nearest first (Sara D. Roosevelt is closest to the near point).
    // dist.calculated is a computed haversine-radians float; order is what matters.
    expect: [
      { _id: 8, name: 'Sara D. Roosevelt Park',
        location: { type: 'Point', coordinates: [ -73.9928, 40.7193 ] }, category: 'Parks',
        dist: { calculated: 0.0001080957519940837 } },
      { _id: 7, name: 'Central Park',
        location: { type: 'Point', coordinates: [ -73.97, 40.77 ] }, category: 'Parks',
        dist: { calculated: 0.000899422225752607 } },
    ],
    real: 'skip:$geoNear needs a 2d/2dsphere index on a live server; micromongo scans (no spatial index)',
    docs: true,
  },

  {
    op: '$geoNear',
    kind: 'stage',
    title: '$geoNear legacy coordinates use planar distance',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/geoNear/',
    fixture: [
      { _id: 1, loc: [ 0, 0 ] },
      { _id: 2, loc: [ 3, 4 ] },
      { _id: 3, loc: [ 10, 10 ] },
    ],
    do: { aggregate: { pipeline: [ { $geoNear: { near: [ 0, 0 ], distanceField: 'd', key: 'loc' } } ] } },
    // Planar distances: _id 1 => 0, _id 2 => 5 ([3,4] from origin), _id 3 => ~14.142.
    // d is a computed float; compare _id order, not exact distance.
    expect: [
      { _id: 1, loc: [ 0, 0 ], d: 0 },
      { _id: 2, loc: [ 3, 4 ], d: 5 },
      { _id: 3, loc: [ 10, 10 ], d: 14.142135623730951 },
    ],
    real: 'skip:$geoNear needs a 2d/2dsphere index on a live server; micromongo scans (no spatial index)',
    docs: false,
  },

  // =========================================================================
  // $redact
  // Source: https://www.mongodb.com/docs/manual/reference/operator/aggregation/redact/
  // =========================================================================

  {
    op: '$redact',
    kind: 'stage',
    title: '$redact prunes the cc subtree (level 5) and keeps the rest',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/redact/',
    fixture: [
      {
        _id: 1,
        level: 1,
        acct_id: 'xyz123',
        cc: {
          level: 5,
          type: 'yy',
          num: 0,
          billing_addr: { level: 5, addr1: '123 ABC Street', city: 'Some City' },
          shipping_addr: [
            { level: 3, addr1: '987 XYZ Ave', city: 'Some City' },
            { level: 3, addr1: 'PO Box 0123', city: 'Some City' },
          ],
        },
        status: 'A',
      },
    ],
    do: { aggregate: { pipeline: [
      { $match: { status: 'A' } },
      { $redact: { $cond: { if: { $eq: [ '$level', 5 ] }, then: '$$PRUNE', else: '$$DESCEND' } } },
    ] } },
    expect: [ { _id: 1, level: 1, acct_id: 'xyz123', status: 'A' } ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$redact',
    kind: 'stage',
    title: '$redact $$DESCEND prunes only the matching array elements',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/redact/',
    fixture: [
      { _id: 1, level: 1, items: [
        { level: 1, v: 'keep' }, { level: 5, v: 'drop' }, { level: 1, v: 'keep2' },
      ] },
    ],
    do: { aggregate: { pipeline: [
      { $redact: { $cond: { if: { $eq: [ '$level', 5 ] }, then: '$$PRUNE', else: '$$DESCEND' } } },
    ] } },
    expect: [ { _id: 1, level: 1, items: [ { level: 1, v: 'keep' }, { level: 1, v: 'keep2' } ] } ],
    real: 'exact',
    docs: false,
  },

  // =========================================================================
  // $lookup
  // Source: https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/
  // NOTE: $lookup with a named `from` needs a SECOND collection seeded in the
  // registry (mm.collection(from, [...])). The canonical live-Mongo harness
  // seeds only the primary collection, so these are real: 'skip:...'.
  // For micromongo, the two `from`-as-inline-array records are self-contained.
  // =========================================================================

  {
    op: '$lookup',
    kind: 'stage',
    title: '$lookup joins orders to inventory by array localField (doc example)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/',
    // Foreign collection(s) the pipeline's $lookup `from` resolves. Both projections seed these
    // before aggregating (micromongo: mm.collection(name, docs); real Mongo: a sibling collection),
    // so $lookup CAN be checked vs a live server too (real: 'exact').
    collections: {
      inventory: [
        { _id: 101, name: 'Widget', price: 10 },
        { _id: 102, name: 'Gadget', price: 20 },
        { _id: 103, name: 'Doohickey', price: 15 },
      ],
    },
    fixture: [
      { _id: 1, item_ids: [ 101, 102 ], customer: 'Alice' },
      { _id: 2, item_ids: [ 102, 103 ], customer: 'Bob' },
    ],
    do: { aggregate: { pipeline: [
      { $lookup: { from: 'inventory', localField: 'item_ids', foreignField: '_id', as: 'items' } },
    ] } },
    expect: [
      { _id: 1, item_ids: [ 101, 102 ], customer: 'Alice', items: [
        { _id: 101, name: 'Widget', price: 10 },
        { _id: 102, name: 'Gadget', price: 20 },
      ] },
      { _id: 2, item_ids: [ 102, 103 ], customer: 'Bob', items: [
        { _id: 102, name: 'Gadget', price: 20 },
        { _id: 103, name: 'Doohickey', price: 15 },
      ] },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$lookup',
    kind: 'stage',
    title: '$lookup scalar localField',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/',
    collections: { cats: [ { _id: 'x', label: 'X' }, { _id: 'y', label: 'Y' } ] },
    fixture: [ { _id: 1, cat: 'x' } ],
    do: { aggregate: { pipeline: [
      { $lookup: { from: 'cats', localField: 'cat', foreignField: '_id', as: 'c' } },
    ] } },
    expect: [ { _id: 1, cat: 'x', c: [ { _id: 'x', label: 'X' } ] } ],
    real: 'exact',
    docs: false,
  },

  {
    op: '$lookup',
    kind: 'stage',
    title: '$lookup `from` may be passed directly as an array',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/',
    fixture: [ { k: 1 } ],
    do: { aggregate: { pipeline: [ { $lookup: {
      from: [ { fk: 1, v: 'hit' }, { fk: 2 } ], localField: 'k', foreignField: 'fk', as: 'j',
    } } ] } },
    expect: [ { k: 1, j: [ { fk: 1, v: 'hit' } ] } ],
    real: 'skip:$lookup needs a second seeded collection; live-Mongo harness seeds only the primary',
    docs: false,
  },

  {
    op: '$lookup',
    kind: 'stage',
    title: '$lookup left outer join: no match yields an empty `as` array',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/',
    fixture: [ { k: 99 } ],
    do: { aggregate: { pipeline: [ { $lookup: {
      from: [ { fk: 1 } ], localField: 'k', foreignField: 'fk', as: 'j',
    } } ] } },
    expect: [ { k: 99, j: [] } ],
    real: 'skip:$lookup needs a second seeded collection; live-Mongo harness seeds only the primary',
    docs: false,
  },

];
