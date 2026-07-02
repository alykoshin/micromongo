'use strict';

// Aggregation EXPRESSION operators + a few core methods, ported from the former
// meta/summaries.js `example` field (which test/meta/examples.js used to run). Expression
// operators have no dedicated MongoDB "-mongodoc" test file — they're exercised INSIDE a
// $project/$addFields/$group pipeline — so `op` is the expression operator and `do` is the
// pipeline that uses it. All deterministic → real: 'exact' (verified vs a live server).

module.exports = [
  // ---- aggregation expression operators (kind: exprOp) ----
  {
    op: '$add', kind: 'exprOp', title: 'Add numbers', docs: true, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/add/',
    fixture: [{ _id: 1, a: 2, b: 3 }],
    do: { aggregate: { pipeline: [{ $project: { _id: 0, r: { $add: ['$a', '$b'] } } }] } },
    expect: [{ r: 5 }],
  },
  {
    op: '$subtract', kind: 'exprOp', title: 'Subtract numbers', docs: true, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/subtract/',
    fixture: [{ _id: 1, a: 5, b: 3 }],
    do: { aggregate: { pipeline: [{ $project: { _id: 0, r: { $subtract: ['$a', '$b'] } } }] } },
    expect: [{ r: 2 }],
  },
  {
    op: '$multiply', kind: 'exprOp', title: 'Multiply numbers', docs: true, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/multiply/',
    fixture: [{ _id: 1, a: 2, b: 3 }],
    do: { aggregate: { pipeline: [{ $project: { _id: 0, r: { $multiply: ['$a', '$b'] } } }] } },
    expect: [{ r: 6 }],
  },
  {
    op: '$concat', kind: 'exprOp', title: 'Concatenate strings', docs: true, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/concat/',
    fixture: [{ _id: 1, a: 'x', b: 'y' }],
    do: { aggregate: { pipeline: [{ $project: { _id: 0, r: { $concat: ['$a', '$b'] } } }] } },
    expect: [{ r: 'xy' }],
  },
  {
    op: '$toUpper', kind: 'exprOp', title: 'Uppercase a string', docs: true, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/toUpper/',
    fixture: [{ _id: 1, a: 'hi' }],
    do: { aggregate: { pipeline: [{ $project: { _id: 0, r: { $toUpper: '$a' } } }] } },
    expect: [{ r: 'HI' }],
  },
  {
    op: '$cond', kind: 'exprOp', title: 'Conditional (if/then/else)', docs: true, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/cond/',
    fixture: [{ _id: 1, a: 5 }],
    do: { aggregate: { pipeline: [{ $project: { _id: 0, r: { $cond: [{ $gt: ['$a', 3] }, 'big', 'small'] } } }] } },
    expect: [{ r: 'big' }],
  },
  {
    op: '$map', kind: 'exprOp', title: 'Map over an array', docs: true, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/map/',
    fixture: [{ _id: 1, a: [1, 2] }],
    do: { aggregate: { pipeline: [{ $project: { _id: 0, r: { $map: { input: '$a', as: 'x', in: { $multiply: ['$$x', 10] } } } } }] } },
    expect: [{ r: [10, 20] }],
  },
  {
    op: '$filter', kind: 'exprOp', title: 'Filter an array', docs: true, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/filter/',
    fixture: [{ _id: 1, a: [1, 2, 3, 4] }],
    do: { aggregate: { pipeline: [{ $project: { _id: 0, r: { $filter: { input: '$a', as: 'x', cond: { $gt: ['$$x', 2] } } } } }] } },
    expect: [{ r: [3, 4] }],
  },

  // ---- $addFields stage (uses an expression) ----
  {
    op: '$addFields', kind: 'stage', title: 'Add a computed field', docs: true, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/addFields/',
    fixture: [{ _id: 1, a: 2, b: 3 }],
    do: { aggregate: { pipeline: [{ $addFields: { s: { $add: ['$a', '$b'] } } }] } },
    expect: [{ _id: 1, a: 2, b: 3, s: 5 }],
  },

  // ---- core read methods (kind: method) ----
  {
    op: 'find', kind: 'method', title: 'Find matching documents', docs: true, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/method/db.collection.find/',
    fixture: [{ _id: 1, s: 'A' }, { _id: 2, s: 'B' }, { _id: 3, s: 'A' }],
    do: { find: { query: { s: 'A' } } },
    expect: [{ _id: 1, s: 'A' }, { _id: 3, s: 'A' }],
  },
  {
    op: 'findOne', kind: 'method', title: 'Find the first matching document', docs: true, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/method/db.collection.findOne/',
    fixture: [{ _id: 1, s: 'A' }, { _id: 2, s: 'B' }],
    do: { findOne: { query: { s: 'B' } } },
    expect: { _id: 2, s: 'B' },
  },
  {
    op: 'aggregate', kind: 'method', title: 'Run an aggregation pipeline', docs: true, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/method/db.collection.aggregate/',
    fixture: [{ s: 'A' }, { s: 'B' }, { s: 'A' }],
    do: { aggregate: { pipeline: [{ $group: { _id: '$s', n: { $sum: 1 } } }, { $sort: { _id: 1 } }] } },
    expect: [{ _id: 'A', n: 2 }, { _id: 'B', n: 1 }],
  },
  {
    op: 'countDocuments', kind: 'method', title: 'Count matching documents', docs: false, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/method/db.collection.countDocuments/',
    fixture: [{ s: 'A' }, { s: 'B' }, { s: 'A' }],
    do: { count: { query: { s: 'A' } } },
    expect: 2,
  },
  {
    op: 'estimatedDocumentCount', kind: 'method', title: 'Estimated total document count', docs: false, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/method/db.collection.estimatedDocumentCount/',
    fixture: [{ s: 'A' }, { s: 'B' }, { s: 'A' }],
    do: { count: { query: {} } },   // empty query ⇒ total; estimatedDocumentCount = array length
    expect: 3,
  },
  {
    op: 'drop', kind: 'method', title: 'Drop (empty) the collection', docs: false, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/method/db.collection.drop/',
    fixture: [{ _id: 1, a: 1 }, { _id: 2, a: 2 }],
    do: { drop: {} },
    expect: [],
  },
  {
    op: 'updateOne', kind: 'method', title: 'Update the first matching document', docs: false, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/method/db.collection.updateOne/',
    fixture: [{ _id: 1, n: 1 }],
    do: { updateOne: { query: { _id: 1 }, update: { $inc: { n: 5 } } } },
    expect: [{ _id: 1, n: 6 }],   // resulting doc state (portable), not the write report
  },
];
