'use strict';

// Ported from aggregate-group, aggregate-stages, aggregate-reshape -mongodoc.js

module.exports = [

  // ===== $group (aggregate-group-mongodoc.js) =====

  {
    op: '$group',
    kind: 'stage',
    title: 'group by year with $sum, $avg, count, $push',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/group/',
    fixture: [
      { _id: 1, title: 'The Kiss', year: 1896, runtime: 1 },
      { _id: 2, title: 'The Kiss', year: 1896, runtime: 1 },
      { _id: 3, title: 'The Great Train Robbery', year: 1903, runtime: 11 },
      { _id: 4, title: 'A Corner in Wheat', year: 1909, runtime: 14 },
    ],
    do: {
      aggregate: {
        pipeline: [
          {
            $group: {
              _id: '$year',
              totalRuntime: { $sum: '$runtime' },
              averageRuntime: { $avg: '$runtime' },
              count: { $sum: 1 },
              titles: { $push: '$title' },
            },
          },
          { $sort: { _id: 1 } },
        ],
      },
    },
    expect: [
      { _id: 1896, totalRuntime: 2, averageRuntime: 1, count: 2, titles: [ 'The Kiss', 'The Kiss' ] },
      { _id: 1903, totalRuntime: 11, averageRuntime: 11, count: 1, titles: [ 'The Great Train Robbery' ] },
      { _id: 1909, totalRuntime: 14, averageRuntime: 14, count: 1, titles: [ 'A Corner in Wheat' ] },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$group',
    kind: 'stage',
    title: '_id: null aggregates all documents into one group',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/group/',
    fixture: [
      { _id: 1, title: 'The Kiss', year: 1896, runtime: 1 },
      { _id: 2, title: 'The Kiss', year: 1896, runtime: 1 },
      { _id: 3, title: 'The Great Train Robbery', year: 1903, runtime: 11 },
      { _id: 4, title: 'A Corner in Wheat', year: 1909, runtime: 14 },
    ],
    do: {
      aggregate: {
        pipeline: [
          { $group: { _id: null, totalRuntime: { $sum: '$runtime' }, count: { $count: {} } } },
        ],
      },
    },
    expect: [ { _id: null, totalRuntime: 27, count: 4 } ],
    real: 'exact',
    docs: false,
  },

  // ===== $sort (aggregate-stages-mongodoc.js) =====

  {
    op: '$sort',
    kind: 'stage',
    title: 'Ascending/Descending Sort (borough, _id)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/sort/',
    fixture: [
      { _id: 1, name: 'Central Park Cafe', borough: 'Manhattan' },
      { _id: 2, name: 'Rock A Feller Bar and Grill', borough: 'Queens' },
      { _id: 3, name: 'Empire State Pub', borough: 'Brooklyn' },
      { _id: 4, name: "Stan's Pizzaria", borough: 'Manhattan' },
      { _id: 5, name: "Jane's Deli", borough: 'Brooklyn' },
    ],
    do: {
      aggregate: {
        pipeline: [ { $sort: { borough: 1, _id: 1 } } ],
      },
    },
    expect: [
      { _id: 3, name: 'Empire State Pub', borough: 'Brooklyn' },
      { _id: 5, name: "Jane's Deli", borough: 'Brooklyn' },
      { _id: 1, name: 'Central Park Cafe', borough: 'Manhattan' },
      { _id: 4, name: "Stan's Pizzaria", borough: 'Manhattan' },
      { _id: 2, name: 'Rock A Feller Bar and Grill', borough: 'Queens' },
    ],
    real: 'exact',
    docs: true,
  },

  // ===== $limit (aggregate-stages-mongodoc.js) =====

  {
    op: '$limit',
    kind: 'stage',
    title: 'passes the first n documents',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/limit/',
    fixture: [
      { _id: 1, name: 'Central Park Cafe', borough: 'Manhattan' },
      { _id: 2, name: 'Rock A Feller Bar and Grill', borough: 'Queens' },
      { _id: 3, name: 'Empire State Pub', borough: 'Brooklyn' },
      { _id: 4, name: "Stan's Pizzaria", borough: 'Manhattan' },
      { _id: 5, name: "Jane's Deli", borough: 'Brooklyn' },
    ],
    do: {
      aggregate: {
        pipeline: [ { $sort: { _id: 1 } }, { $limit: 2 } ],
      },
    },
    expect: [
      { _id: 1, name: 'Central Park Cafe', borough: 'Manhattan' },
      { _id: 2, name: 'Rock A Feller Bar and Grill', borough: 'Queens' },
    ],
    real: 'exact',
    docs: true,
  },

  // ===== $skip (aggregate-stages-mongodoc.js) =====

  {
    op: '$skip',
    kind: 'stage',
    title: 'skips the first n documents',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/skip/',
    fixture: [
      { _id: 1, name: 'Central Park Cafe', borough: 'Manhattan' },
      { _id: 2, name: 'Rock A Feller Bar and Grill', borough: 'Queens' },
      { _id: 3, name: 'Empire State Pub', borough: 'Brooklyn' },
      { _id: 4, name: "Stan's Pizzaria", borough: 'Manhattan' },
      { _id: 5, name: "Jane's Deli", borough: 'Brooklyn' },
    ],
    do: {
      aggregate: {
        pipeline: [ { $sort: { _id: 1 } }, { $skip: 3 } ],
      },
    },
    expect: [
      { _id: 4, name: "Stan's Pizzaria", borough: 'Manhattan' },
      { _id: 5, name: "Jane's Deli", borough: 'Brooklyn' },
    ],
    real: 'exact',
    docs: true,
  },

  // ===== $unwind (aggregate-stages-mongodoc.js) =====

  {
    op: '$unwind',
    kind: 'stage',
    title: 'Unwind Array (top-level array of scalars)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/unwind/',
    fixture: [ { _id: 1, item: 'ABC1', sizes: [ 'S', 'M', 'L' ] } ],
    do: {
      aggregate: {
        pipeline: [ { $unwind: '$sizes' } ],
      },
    },
    expect: [
      { _id: 1, item: 'ABC1', sizes: 'S' },
      { _id: 1, item: 'ABC1', sizes: 'M' },
      { _id: 1, item: 'ABC1', sizes: 'L' },
    ],
    real: 'exact',
    docs: true,
  },

  // ===== $project (aggregate-stages-mongodoc.js) =====

  {
    op: '$project',
    kind: 'stage',
    title: 'Include Specific Fields',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/project/',
    fixture: [
      {
        _id: 'X',
        title: 'The Great Train Robbery',
        rated: 'TV-G',
        plot: 'A group of bandits stage a brazen train hold-up...',
        genres: [ 'Short', 'Western' ],
        runtime: 11,
      },
    ],
    do: {
      aggregate: {
        pipeline: [ { $project: { title: 1, rated: 1 } } ],
      },
    },
    expect: [ { _id: 'X', title: 'The Great Train Robbery', rated: 'TV-G' } ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$project',
    kind: 'stage',
    title: 'Exclude the _id Field',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/project/',
    fixture: [
      {
        _id: 'X',
        title: 'The Great Train Robbery',
        rated: 'TV-G',
        plot: 'A group of bandits stage a brazen train hold-up...',
        genres: [ 'Short', 'Western' ],
        runtime: 11,
      },
    ],
    do: {
      aggregate: {
        pipeline: [ { $project: { _id: 0, title: 1, rated: 1 } } ],
      },
    },
    expect: [ { title: 'The Great Train Robbery', rated: 'TV-G' } ],
    real: 'exact',
    docs: false,
  },

  // ===== $match (aggregate-stages-mongodoc.js) =====

  {
    op: '$match',
    kind: 'stage',
    title: 'Equality + comparison match',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/match/',
    fixture: [
      { _id: 1, rated: 'TV-PG', runtime: 1256 },
      { _id: 2, rated: 'TV-PG', runtime: 500 },
      { _id: 3, rated: 'TV-G', runtime: 2000 },
    ],
    do: {
      aggregate: {
        pipeline: [ { $match: { rated: 'TV-PG', runtime: { $gt: 1000 } } } ],
      },
    },
    expect: [ { _id: 1, rated: 'TV-PG', runtime: 1256 } ],
    real: 'exact',
    docs: true,
  },

  // ===== $unset (aggregate-reshape-mongodoc.js) =====

  {
    op: '$unset',
    kind: 'stage',
    title: 'removes a single field',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/unset/',
    fixture: [ { _id: 1, a: 1, b: 2 } ],
    do: {
      aggregate: {
        pipeline: [ { $unset: 'b' } ],
      },
    },
    expect: [ { _id: 1, a: 1 } ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$unset',
    kind: 'stage',
    title: 'removes a list of fields',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/unset/',
    fixture: [ { _id: 1, a: 1, b: 2, c: 3 } ],
    do: {
      aggregate: {
        pipeline: [ { $unset: [ 'b', 'c' ] } ],
      },
    },
    expect: [ { _id: 1, a: 1 } ],
    real: 'exact',
    docs: false,
  },

  // ===== $count (aggregate-reshape-mongodoc.js) =====

  {
    op: '$count',
    kind: 'stage',
    title: 'outputs a single document with the count',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/count/',
    fixture: [ { a: 1 }, { a: 2 }, { a: 3 } ],
    do: {
      aggregate: {
        pipeline: [ { $count: 'total' } ],
      },
    },
    expect: [ { total: 3 } ],
    real: 'exact',
    docs: true,
  },

  // ===== $replaceRoot / $replaceWith (aggregate-reshape-mongodoc.js) =====

  {
    op: '$replaceRoot',
    kind: 'stage',
    title: 'promotes a merged document to the root',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/replaceRoot/',
    fixture: [
      { _id: 1, name: 'Arlene', age: 34, pets: { dogs: 2, cats: 1 } },
      { _id: 2, name: 'Sam', age: 41, pets: { cats: 1, fish: 3 } },
      { _id: 3, name: 'Maria', age: 25 },
    ],
    do: {
      aggregate: {
        pipeline: [
          { $replaceRoot: { newRoot: {
            $mergeObjects: [ { dogs: 0, cats: 0, birds: 0, fish: 0 }, '$pets' ],
          } } },
        ],
      },
    },
    expect: [
      { dogs: 2, cats: 1, birds: 0, fish: 0 },
      { dogs: 0, cats: 1, birds: 0, fish: 3 },
      { dogs: 0, cats: 0, birds: 0, fish: 0 },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$replaceWith',
    kind: 'stage',
    title: '$replaceWith promotes a sub-document (alias)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/replaceWith/',
    fixture: [ { _id: 1, sub: { x: 1, y: 2 } } ],
    do: {
      aggregate: {
        pipeline: [ { $replaceWith: '$sub' } ],
      },
    },
    expect: [ { x: 1, y: 2 } ],
    real: 'exact',
    docs: true,
  },

  // ===== $sortByCount (aggregate-reshape-mongodoc.js) =====

  {
    op: '$sortByCount',
    kind: 'stage',
    title: 'groups by value and sorts by count descending',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/aggregation/sortByCount/',
    fixture: [
      { _id: 1, tags: [ 'painting', 'satire', 'Expressionism' ] },
      { _id: 2, tags: [ 'woodcut', 'Expressionism' ] },
      { _id: 3, tags: [ 'oil', 'Surrealism', 'painting' ] },
      { _id: 5, tags: [ 'Surrealism', 'painting', 'oil' ] },
      { _id: 6, tags: [ 'oil', 'painting', 'abstract' ] },
      { _id: 7, tags: [ 'Expressionism', 'painting', 'oil' ] },
      { _id: 8, tags: [ 'abstract', 'painting' ] },
    ],
    do: {
      aggregate: {
        pipeline: [
          { $unwind: '$tags' },
          { $sortByCount: '$tags' },
          { $sort: { count: -1, _id: 1 } }, // added $sort for stable order (ties among count 2 / count 1)
        ],
      },
    },
    expect: [
      { _id: 'painting', count: 6 },
      { _id: 'oil', count: 4 },
      { _id: 'Expressionism', count: 3 },
      { _id: 'Surrealism', count: 2 },
      { _id: 'abstract', count: 2 },
      { _id: 'satire', count: 1 },
      { _id: 'woodcut', count: 1 },
    ],
    real: 'exact',
    docs: true,
  },

];
