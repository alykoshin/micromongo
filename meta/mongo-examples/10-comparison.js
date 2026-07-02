'use strict';

// Ported from test/crud/comparision-mongodoc.js, find-type-mongodoc.js, find-elementQuery-mongodoc.js

module.exports = [

  // ===== $eq (comparision-mongodoc.js) =====

  {
    op: '$eq',
    kind: 'queryOp',
    title: 'Equals a Specified Value',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/eq/',
    fixture: [
      { _id: 1, item: { name: 'ab', code: '123' }, qty: 15, tags: [ 'A', 'B', 'C' ] },
      { _id: 2, item: { name: 'cd', code: '123' }, qty: 20, tags: [ 'B' ] },
      { _id: 3, item: { name: 'ij', code: '456' }, qty: 25, tags: [ 'A', 'B' ] },
      { _id: 4, item: { name: 'xy', code: '456' }, qty: 30, tags: [ 'B', 'A' ] },
      { _id: 5, item: { name: 'mn', code: '000' }, qty: 20, tags: [ [ 'A', 'B' ], 'C' ] },
    ],
    do: { find: { query: { qty: { $eq: 20 } } } },
    expect: [
      { _id: 2, item: { name: 'cd', code: '123' }, qty: 20, tags: [ 'B' ] },
      { _id: 5, item: { name: 'mn', code: '000' }, qty: 20, tags: [ [ 'A', 'B' ], 'C' ] },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$eq',
    kind: 'queryOp',
    title: 'Field in Embedded Document Equals a Value (explicit $eq)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/eq/',
    fixture: [
      { _id: 1, item: { name: 'ab', code: '123' }, qty: 15, tags: [ 'A', 'B', 'C' ] },
      { _id: 2, item: { name: 'cd', code: '123' }, qty: 20, tags: [ 'B' ] },
      { _id: 3, item: { name: 'ij', code: '456' }, qty: 25, tags: [ 'A', 'B' ] },
      { _id: 4, item: { name: 'xy', code: '456' }, qty: 30, tags: [ 'B', 'A' ] },
      { _id: 5, item: { name: 'mn', code: '000' }, qty: 20, tags: [ [ 'A', 'B' ], 'C' ] },
    ],
    do: { find: { query: { 'item.name': { $eq: 'ab' } } } },
    expect: [
      { _id: 1, item: { name: 'ab', code: '123' }, qty: 15, tags: [ 'A', 'B', 'C' ] },
    ],
    real: 'exact',
    docs: false,
  },

  {
    op: '$eq',
    kind: 'queryOp',
    title: 'Field in Embedded Document Equals a Value (implicit $eq)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/eq/',
    fixture: [
      { _id: 1, item: { name: 'ab', code: '123' }, qty: 15, tags: [ 'A', 'B', 'C' ] },
      { _id: 2, item: { name: 'cd', code: '123' }, qty: 20, tags: [ 'B' ] },
      { _id: 3, item: { name: 'ij', code: '456' }, qty: 25, tags: [ 'A', 'B' ] },
      { _id: 4, item: { name: 'xy', code: '456' }, qty: 30, tags: [ 'B', 'A' ] },
      { _id: 5, item: { name: 'mn', code: '000' }, qty: 20, tags: [ [ 'A', 'B' ], 'C' ] },
    ],
    do: { find: { query: { 'item.name': 'ab' } } },
    expect: [
      { _id: 1, item: { name: 'ab', code: '123' }, qty: 15, tags: [ 'A', 'B', 'C' ] },
    ],
    real: 'exact',
    docs: false,
  },

  {
    op: '$eq',
    kind: 'queryOp',
    title: 'Array Element Equals a Value (explicit $eq)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/eq/',
    fixture: [
      { _id: 1, item: { name: 'ab', code: '123' }, qty: 15, tags: [ 'A', 'B', 'C' ] },
      { _id: 2, item: { name: 'cd', code: '123' }, qty: 20, tags: [ 'B' ] },
      { _id: 3, item: { name: 'ij', code: '456' }, qty: 25, tags: [ 'A', 'B' ] },
      { _id: 4, item: { name: 'xy', code: '456' }, qty: 30, tags: [ 'B', 'A' ] },
      { _id: 5, item: { name: 'mn', code: '000' }, qty: 20, tags: [ [ 'A', 'B' ], 'C' ] },
    ],
    do: { find: { query: { tags: { $eq: 'B' } } } },
    expect: [
      { _id: 1, item: { name: 'ab', code: '123' }, qty: 15, tags: [ 'A', 'B', 'C' ] },
      { _id: 2, item: { name: 'cd', code: '123' }, qty: 20, tags: [ 'B' ] },
      { _id: 3, item: { name: 'ij', code: '456' }, qty: 25, tags: [ 'A', 'B' ] },
      { _id: 4, item: { name: 'xy', code: '456' }, qty: 30, tags: [ 'B', 'A' ] },
    ],
    real: 'exact',
    docs: false,
  },

  {
    op: '$eq',
    kind: 'queryOp',
    title: 'Array Element Equals a Value (implicit $eq)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/eq/',
    fixture: [
      { _id: 1, item: { name: 'ab', code: '123' }, qty: 15, tags: [ 'A', 'B', 'C' ] },
      { _id: 2, item: { name: 'cd', code: '123' }, qty: 20, tags: [ 'B' ] },
      { _id: 3, item: { name: 'ij', code: '456' }, qty: 25, tags: [ 'A', 'B' ] },
      { _id: 4, item: { name: 'xy', code: '456' }, qty: 30, tags: [ 'B', 'A' ] },
      { _id: 5, item: { name: 'mn', code: '000' }, qty: 20, tags: [ [ 'A', 'B' ], 'C' ] },
    ],
    do: { find: { query: { tags: 'B' } } },
    expect: [
      { _id: 1, item: { name: 'ab', code: '123' }, qty: 15, tags: [ 'A', 'B', 'C' ] },
      { _id: 2, item: { name: 'cd', code: '123' }, qty: 20, tags: [ 'B' ] },
      { _id: 3, item: { name: 'ij', code: '456' }, qty: 25, tags: [ 'A', 'B' ] },
      { _id: 4, item: { name: 'xy', code: '456' }, qty: 30, tags: [ 'B', 'A' ] },
    ],
    real: 'exact',
    docs: false,
  },

  {
    op: '$eq',
    kind: 'queryOp',
    title: 'Equals an Array Value (explicit $eq)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/eq/',
    fixture: [
      { _id: 1, item: { name: 'ab', code: '123' }, qty: 15, tags: [ 'A', 'B', 'C' ] },
      { _id: 2, item: { name: 'cd', code: '123' }, qty: 20, tags: [ 'B' ] },
      { _id: 3, item: { name: 'ij', code: '456' }, qty: 25, tags: [ 'A', 'B' ] },
      { _id: 4, item: { name: 'xy', code: '456' }, qty: 30, tags: [ 'B', 'A' ] },
      { _id: 5, item: { name: 'mn', code: '000' }, qty: 20, tags: [ [ 'A', 'B' ], 'C' ] },
    ],
    do: { find: { query: { tags: { $eq: [ 'A', 'B' ] } } } },
    expect: [
      { _id: 3, item: { name: 'ij', code: '456' }, qty: 25, tags: [ 'A', 'B' ] },
      { _id: 5, item: { name: 'mn', code: '000' }, qty: 20, tags: [ [ 'A', 'B' ], 'C' ] },
    ],
    real: 'exact',
    docs: false,
  },

  {
    op: '$eq',
    kind: 'queryOp',
    title: 'Equals an Array Value (implicit $eq)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/eq/',
    fixture: [
      { _id: 1, item: { name: 'ab', code: '123' }, qty: 15, tags: [ 'A', 'B', 'C' ] },
      { _id: 2, item: { name: 'cd', code: '123' }, qty: 20, tags: [ 'B' ] },
      { _id: 3, item: { name: 'ij', code: '456' }, qty: 25, tags: [ 'A', 'B' ] },
      { _id: 4, item: { name: 'xy', code: '456' }, qty: 30, tags: [ 'B', 'A' ] },
      { _id: 5, item: { name: 'mn', code: '000' }, qty: 20, tags: [ [ 'A', 'B' ], 'C' ] },
    ],
    do: { find: { query: { tags: [ 'A', 'B' ] } } },
    expect: [
      { _id: 3, item: { name: 'ij', code: '456' }, qty: 25, tags: [ 'A', 'B' ] },
      { _id: 5, item: { name: 'mn', code: '000' }, qty: 20, tags: [ [ 'A', 'B' ], 'C' ] },
    ],
    real: 'exact',
    docs: false,
  },

  // ===== $gt / $gte / $lt / $lte / $ne (comparision-mongodoc.js) =====
  // fixture (inventory):
  //   [0] { qty: 10, carrier: { fee: 3 }, price: 3 }
  //   [1] { qty: 20, carrier: { fee: 2 }, price: 2 }
  //   [2] { qty: 30, carrier: { fee: 1 }, price: 1 }

  {
    op: '$gt',
    kind: 'queryOp',
    title: '{ qty: { $gt: 20 } }',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/gt/',
    fixture: [
      { qty: 10, carrier: { fee: 3 }, price: 3 },
      { qty: 20, carrier: { fee: 2 }, price: 2 },
      { qty: 30, carrier: { fee: 1 }, price: 1 },
    ],
    do: { find: { query: { qty: { $gt: 20 } } } },
    expect: [
      { qty: 30, carrier: { fee: 1 }, price: 1 },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$gte',
    kind: 'queryOp',
    title: '{ qty: { $gte: 20 } }',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/gte/',
    fixture: [
      { qty: 10, carrier: { fee: 3 }, price: 3 },
      { qty: 20, carrier: { fee: 2 }, price: 2 },
      { qty: 30, carrier: { fee: 1 }, price: 1 },
    ],
    do: { find: { query: { qty: { $gte: 20 } } } },
    expect: [
      { qty: 20, carrier: { fee: 2 }, price: 2 },
      { qty: 30, carrier: { fee: 1 }, price: 1 },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$lt',
    kind: 'queryOp',
    title: '{ qty: { $lt: 20 } }',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/lt/',
    fixture: [
      { qty: 10, carrier: { fee: 3 }, price: 3 },
      { qty: 20, carrier: { fee: 2 }, price: 2 },
      { qty: 30, carrier: { fee: 1 }, price: 1 },
    ],
    do: { find: { query: { qty: { $lt: 20 } } } },
    expect: [
      { qty: 10, carrier: { fee: 3 }, price: 3 },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$lte',
    kind: 'queryOp',
    title: '{ qty: { $lte: 20 } }',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/lte/',
    fixture: [
      { qty: 10, carrier: { fee: 3 }, price: 3 },
      { qty: 20, carrier: { fee: 2 }, price: 2 },
      { qty: 30, carrier: { fee: 1 }, price: 1 },
    ],
    do: { find: { query: { qty: { $lte: 20 } } } },
    expect: [
      { qty: 10, carrier: { fee: 3 }, price: 3 },
      { qty: 20, carrier: { fee: 2 }, price: 2 },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$ne',
    kind: 'queryOp',
    title: '{ qty: { $ne: 20 } }',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/ne/',
    fixture: [
      { qty: 10, carrier: { fee: 3 }, price: 3 },
      { qty: 20, carrier: { fee: 2 }, price: 2 },
      { qty: 30, carrier: { fee: 1 }, price: 1 },
    ],
    do: { find: { query: { qty: { $ne: 20 } } } },
    expect: [
      { qty: 10, carrier: { fee: 3 }, price: 3 },
      { qty: 30, carrier: { fee: 1 }, price: 1 },
    ],
    real: 'exact',
    docs: true,
  },

  // ===== $in (comparision-mongodoc.js) =====

  {
    op: '$in',
    kind: 'queryOp',
    title: 'Use the $in Operator to Match Values',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/in/',
    fixture: [
      { qty: 0 },
      { qty: 5 },
      { qty: 10 },
      { qty: 15 },
      { qty: 20 },
    ],
    do: { find: { query: { qty: { $in: [ 5, 15 ] } } } },
    expect: [
      { qty: 5 },
      { qty: 15 },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$in',
    kind: 'queryOp',
    title: 'Use the $in Operator to Match Values in an Array',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/in/',
    fixture: [
      { tags: [ 'test', 'clothing' ] },
      { _id: 1, item: 'abc', qty: 10, tags: [ 'school', 'clothing' ], sale: false },
      { tags: [ 'school', 'appliances' ] },
      { tags: [ 'test', 'appliances' ] },
    ],
    do: { find: { query: { tags: { $in: [ 'appliances', 'school' ] } } } },
    expect: [
      { _id: 1, item: 'abc', qty: 10, tags: [ 'school', 'clothing' ], sale: false },
      { tags: [ 'school', 'appliances' ] },
      { tags: [ 'test', 'appliances' ] },
    ],
    real: 'exact',
    docs: false,
  },

  {
    op: '$in',
    kind: 'queryOp',
    title: 'Use the $in Operator with a Regular Expression',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/in/',
    fixture: [
      { tags: [ 'aaa', 'aaa' ] },
      { _id: 1, item: 'abc', qty: 10, tags: [ 'bee', 'stt' ], sale: false },
      { tags: [ 'bee', 'aaa' ] },
      { tags: [ 'aaa', 'stt' ] },
    ],
    do: { find: { query: { tags: { $in: [ /^be/, /^st/ ] } } } },
    expect: [
      { _id: 1, item: 'abc', qty: 10, tags: [ 'bee', 'stt' ], sale: false },
      { tags: [ 'bee', 'aaa' ] },
      { tags: [ 'aaa', 'stt' ] },
    ],
    real: 'exact',
    docs: false,
  },

  // ===== $nin (comparision-mongodoc.js) =====

  {
    op: '$nin',
    kind: 'queryOp',
    title: '{ qty: { $nin: [ 5, 15 ] } }',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/nin/',
    fixture: [
      { qty: 0 },
      { qty: 5 },
      { qty: 10 },
      { qty: 15 },
      { qty: 20 },
    ],
    do: { find: { query: { qty: { $nin: [ 5, 15 ] } } } },
    expect: [
      { qty: 0 },
      { qty: 10 },
      { qty: 20 },
    ],
    real: 'exact',
    docs: true,
  },

  // ===== $type (find-type-mongodoc.js) =====

  {
    op: '$type',
    kind: 'queryOp',
    title: 'Querying by Data Type (string alias)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/type/',
    fixture: [
      { _id: 1, title: 'Centennial', runtime: 1256, imdb: { rating: 8.5 } },
      { _id: 2, title: 'Baseball', runtime: 1140, imdb: { rating: 9.1 } },
      { _id: 3, title: 'Coming to Terms', year: 2013, imdb: { rating: '' } },
      { _id: 4, title: 'Absent Minded', year: 2013, imdb: { rating: '' } },
    ],
    do: {
      find: {
        query: { 'imdb.rating': { $type: 'string' } },
        projection: { _id: 1, title: 1, 'imdb.rating': 1 },
      },
    },
    expect: [
      { _id: 3, title: 'Coming to Terms', imdb: { rating: '' } },
      { _id: 4, title: 'Absent Minded', imdb: { rating: '' } },
    ],
    real: 'exact',
    docs: true,
  },

  // ===== $exists (find-elementQuery-mongodoc.js) =====

  {
    op: '$exists',
    kind: 'queryOp',
    title: 'Exists and Not Equal To',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/exists/',
    // KNOWN DIVERGENCE (JS undefined vs BSON null): real MongoDB stores `{ qty: undefined }` as
    // `{ qty: null }` (BSON has no `undefined`), so `$exists:true` matches it there (3 results). In
    // micromongo (plain JS) `qty: undefined` reads as absent, so `$exists` excludes it (2 results).
    // Micromongo is self-consistent; the difference is purely the BSON undefined→null coercion.
    // Skip the live-Mongo comparison; micromongo's own result is still asserted below.
    real: 'skip:JS undefined vs BSON null ({ qty: undefined } stored as null by real Mongo)',
    fixture: [
      { qty: null },
      { qty: undefined, value: 'the name is undefined' },
      { qty: 5 },
      { qty: 15 },
      { qty: 20 },
    ],
    do: { find: { query: { qty: { $exists: true, $nin: [ 5, 15 ] } } } },
    expect: [
      { qty: null },
      { qty: 20 },
    ],
    docs: true,
  },

  {
    op: '$exists',
    kind: 'queryOp',
    title: 'Null Values: $exists: true',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/exists/',
    fixture: [
      { a: 5, b: 5, c: null },
      { a: 3, b: null, c: 8 },
      { a: null, b: 3, c: 9 },
      { a: 1, b: 2, c: 3 },
      { a: 2, c: 5 },
      { a: 3, b: 2 },
      { a: 4 },
      { b: 2, c: 4 },
      { b: 2 },
      { c: 6 },
    ],
    do: { find: { query: { a: { $exists: true } } } },
    expect: [
      { a: 5, b: 5, c: null },
      { a: 3, b: null, c: 8 },
      { a: null, b: 3, c: 9 },
      { a: 1, b: 2, c: 3 },
      { a: 2, c: 5 },
      { a: 3, b: 2 },
      { a: 4 },
    ],
    real: 'exact',
    docs: false,
  },

  {
    op: '$exists',
    kind: 'queryOp',
    title: 'Null Values: $exists: false',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/exists/',
    fixture: [
      { a: 5, b: 5, c: null },
      { a: 3, b: null, c: 8 },
      { a: null, b: 3, c: 9 },
      { a: 1, b: 2, c: 3 },
      { a: 2, c: 5 },
      { a: 3, b: 2 },
      { a: 4 },
      { b: 2, c: 4 },
      { b: 2 },
      { c: 6 },
    ],
    do: { find: { query: { b: { $exists: false } } } },
    expect: [
      { a: 2, c: 5 },
      { a: 4 },
      { c: 6 },
    ],
    real: 'exact',
    docs: false,
  },

];
