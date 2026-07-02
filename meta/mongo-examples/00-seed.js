'use strict';

// Seed canonical examples (step-1 exemplars across families). Each file in this directory
// exports an array of canonical example records; meta/mongo-examples.js concatenates them all.
// See planning/unified-examples.md for the record shape and the apply()/test/harness projections.

module.exports = [
  // ---- comparison (queryOp) ----
  {
    op: '$eq', kind: 'queryOp', title: 'Equals a value', docs: true, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/eq/',
    fixture: [{ _id: 1, qty: 20 }, { _id: 2, qty: 15 }, { _id: 3, qty: 20 }],
    do: { find: { query: { qty: { $eq: 20 } } } },
    expect: [{ _id: 1, qty: 20 }, { _id: 3, qty: 20 }],
  },
  {
    op: '$gt', kind: 'queryOp', title: 'Greater than a value', docs: true, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/gt/',
    fixture: [{ _id: 1, a: 1 }, { _id: 2, a: 5 }, { _id: 3, a: 9 }],
    do: { find: { query: { a: { $gt: 3 } }, projection: { _id: 0 } } },
    expect: [{ a: 5 }, { a: 9 }],
  },
  {
    op: '$in', kind: 'queryOp', title: 'Matches any value in an array', docs: true, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/in/',
    fixture: [{ _id: 1, t: 'a' }, { _id: 2, t: 'b' }, { _id: 3, t: 'c' }],
    do: { find: { query: { t: { $in: ['a', 'c'] } } } },
    expect: [{ _id: 1, t: 'a' }, { _id: 3, t: 'c' }],
  },
  {
    op: '$ne', kind: 'queryOp', title: 'Not equal to a value', docs: true, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/ne/',
    fixture: [{ _id: 1, q: 20 }, { _id: 2, q: 10 }],
    do: { find: { query: { q: { $ne: 10 } } } },
    expect: [{ _id: 1, q: 20 }],
  },

  // ---- logical (queryOp) ----
  {
    op: '$or', kind: 'queryOp', title: 'Logical OR', docs: true, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/or/',
    fixture: [{ _id: 1, q: 10, p: 10 }, { _id: 2, q: 20, p: 0 }, { _id: 3, q: 30, p: 10 }],
    do: { find: { query: { $or: [{ q: { $lt: 15 } }, { p: 10 }] } } },
    expect: [{ _id: 1, q: 10, p: 10 }, { _id: 3, q: 30, p: 10 }],
  },
  {
    op: '$and', kind: 'queryOp', title: 'Logical AND', docs: false, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/and/',
    fixture: [{ _id: 1 }, { _id: 2, price: 0.99 }, { _id: 3, price: 1.99 }],
    do: { find: { query: { $and: [{ price: { $ne: 1.99 } }, { price: { $exists: true } }] } } },
    expect: [{ _id: 2, price: 0.99 }],
  },

  // ---- element / evaluation (queryOp) ----
  {
    op: '$exists', kind: 'queryOp', title: 'Field exists', docs: true, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/exists/',
    fixture: [{ _id: 1, a: 1 }, { _id: 2, b: 2 }],
    do: { find: { query: { a: { $exists: true } } } },
    expect: [{ _id: 1, a: 1 }],
  },
  {
    op: '$mod', kind: 'queryOp', title: 'Modulo', docs: true, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/mod/',
    fixture: [{ _id: 1, qty: 0 }, { _id: 2, qty: 5 }, { _id: 3, qty: 8 }],
    do: { find: { query: { qty: { $mod: [4, 0] } } } },
    expect: [{ _id: 1, qty: 0 }, { _id: 3, qty: 8 }],
  },
  {
    op: '$regex', kind: 'queryOp', title: 'Regular expression', docs: true, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/regex/',
    fixture: [{ _id: 1, s: 'abc' }, { _id: 2, s: 'xyz' }],
    // NOTE: micromongo requires a RegExp object; the driver + $regexMatch accept it too.
    do: { find: { query: { s: { $regex: /^a/ } } } },
    expect: [{ _id: 1, s: 'abc' }],
  },

  // ---- array (queryOp) ----
  {
    op: '$all', kind: 'queryOp', title: 'Array contains all values', docs: true, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/all/',
    fixture: [{ _id: 1, t: ['x', 'y', 'z'] }, { _id: 2, t: ['x'] }],
    do: { find: { query: { t: { $all: ['x', 'y'] } } } },
    expect: [{ _id: 1, t: ['x', 'y', 'z'] }],
  },
  {
    op: '$elemMatch', kind: 'queryOp', title: 'Array element matches a sub-query', docs: true, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/elemMatch/',
    fixture: [{ _id: 1, r: [{ p: 5 }, { p: 20 }] }, { _id: 2, r: [{ p: 1 }] }],
    do: { find: { query: { r: { $elemMatch: { p: { $gt: 10 } } } } } },
    expect: [{ _id: 1, r: [{ p: 5 }, { p: 20 }] }],
  },
  {
    op: '$size', kind: 'queryOp', title: 'Array of a given length', docs: true, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/size/',
    fixture: [{ _id: 1, t: [1, 2] }, { _id: 2, t: [1] }],
    do: { find: { query: { t: { $size: 2 } } } },
    expect: [{ _id: 1, t: [1, 2] }],
  },

  // ---- reads (method) ----
  {
    op: 'distinct', kind: 'method', title: 'Distinct field values', docs: true, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/method/db.collection.distinct/',
    fixture: [{ s: 'A' }, { s: 'B' }, { s: 'A' }],
    do: { distinct: { field: 's' } },
    expect: ['A', 'B'],
  },
  {
    op: 'count', kind: 'method', title: 'Count matches', docs: false, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/method/db.collection.countDocuments/',
    fixture: [{ s: 'A' }, { s: 'B' }, { s: 'A' }],
    do: { count: { query: { s: 'A' } } },
    expect: 2,
  },

  // ---- update operators (updateOp) — expect = the mutated documents ----
  {
    op: '$set', kind: 'updateOp', title: 'Set a field', docs: true, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/set/',
    fixture: [{ _id: 1, a: 1 }],
    do: { updateOne: { query: { _id: 1 }, update: { $set: { a: 9, b: 2 } } } },
    expect: [{ _id: 1, a: 9, b: 2 }],
  },
  {
    op: '$inc', kind: 'updateOp', title: 'Increment a field', docs: true, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/inc/',
    fixture: [{ _id: 1, n: 1 }, { _id: 2, n: 5 }],
    do: { updateMany: { query: {}, update: { $inc: { n: 10 } } } },
    expect: [{ _id: 1, n: 11 }, { _id: 2, n: 15 }],
  },
  {
    op: '$push', kind: 'updateOp', title: 'Append to an array', docs: true, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/push/',
    fixture: [{ _id: 1, t: [1] }],
    do: { updateOne: { query: { _id: 1 }, update: { $push: { t: 2 } } } },
    expect: [{ _id: 1, t: [1, 2] }],
  },
  {
    op: '$unset', kind: 'updateOp', title: 'Remove a field', docs: false, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/unset/',
    fixture: [{ _id: 1, a: 1, b: 2 }],
    do: { updateOne: { query: { _id: 1 }, update: { $unset: { b: '' } } } },
    expect: [{ _id: 1, a: 1 }],
  },

  // ---- aggregation stages (stage) ----
  {
    op: '$group', kind: 'stage', title: 'Group + accumulate', docs: true, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/group/',
    fixture: [{ s: 'A', amt: 30 }, { s: 'B', amt: 10 }, { s: 'A', amt: 50 }],
    do: { aggregate: { pipeline: [{ $group: { _id: '$s', total: { $sum: '$amt' } } }, { $sort: { _id: 1 } }] } },
    expect: [{ _id: 'A', total: 80 }, { _id: 'B', total: 10 }],
  },
  {
    op: '$match', kind: 'stage', title: 'Filter a pipeline', docs: false, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/match/',
    fixture: [{ _id: 1, n: 1 }, { _id: 2, n: 2 }, { _id: 3, n: 3 }],
    do: { aggregate: { pipeline: [{ $match: { n: { $gte: 2 } } }, { $sort: { _id: 1 } }] } },
    expect: [{ _id: 2, n: 2 }, { _id: 3, n: 3 }],
  },
  {
    op: '$unwind', kind: 'stage', title: 'Unwind an array field', docs: true, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/unwind/',
    fixture: [{ _id: 1, t: ['a', 'b'] }],
    do: { aggregate: { pipeline: [{ $unwind: '$t' }] } },
    expect: [{ _id: 1, t: 'a' }, { _id: 1, t: 'b' }],
  },
  {
    op: '$project', kind: 'stage', title: 'Reshape documents', docs: false, real: 'exact',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/project/',
    fixture: [{ _id: 1, a: 2, b: 3 }],
    do: { aggregate: { pipeline: [{ $project: { _id: 0, sum: { $add: ['$a', '$b'] } } }] } },
    expect: [{ sum: 5 }],
  },
];
