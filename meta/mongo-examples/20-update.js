'use strict';

// Ported from test/crud/update-mongodoc.js, update-positional-mongodoc.js

module.exports = [

  // ===== $set (update-mongodoc.js) =====

  {
    op: '$set',
    kind: 'updateOp',
    title: 'Set Top-Level Fields',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/set/',
    fixture: [
      { _id: 1, title: 'The Dark Knight', year: 2008, genres: [ 'Crime', 'Drama', 'Thriller' ] },
    ],
    do: {
      updateOne: {
        query: { title: 'The Dark Knight' },
        update: { $set: { label: 'Award Winner', status: 'classic' } },
      },
    },
    expect: [
      {
        _id: 1, title: 'The Dark Knight', year: 2008,
        genres: [ 'Crime', 'Drama', 'Thriller' ],
        label: 'Award Winner', status: 'classic',
      },
    ],
    real: 'exact',
    docs: true,
  },

  // ===== $min (update-mongodoc.js) =====

  {
    op: '$min',
    kind: 'updateOp',
    title: 'Updates when the value is less than the current',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/min/',
    fixture: [
      { _id: 1, highScore: 800, lowScore: 200 },
    ],
    do: {
      updateOne: {
        query: { _id: 1 },
        update: { $min: { lowScore: 150 } },
      },
    },
    expect: [
      { _id: 1, highScore: 800, lowScore: 150 },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$min',
    kind: 'updateOp',
    title: 'No change when the value is not less than the current',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/min/',
    fixture: [
      { _id: 1, highScore: 800, lowScore: 150 },
    ],
    do: {
      updateOne: {
        query: { _id: 1 },
        update: { $min: { lowScore: 250 } },
      },
    },
    expect: [
      { _id: 1, highScore: 800, lowScore: 150 },
    ],
    real: 'exact',
    docs: false,
  },

  // ===== $max (update-mongodoc.js) =====

  {
    op: '$max',
    kind: 'updateOp',
    title: 'Updates when the value is greater than the current',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/max/',
    fixture: [
      { _id: 1, highScore: 800, lowScore: 200 },
    ],
    do: {
      updateOne: {
        query: { _id: 1 },
        update: { $max: { highScore: 950 } },
      },
    },
    expect: [
      { _id: 1, highScore: 950, lowScore: 200 },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$max',
    kind: 'updateOp',
    title: 'No change when the value is not greater than the current',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/max/',
    fixture: [
      { _id: 1, highScore: 950, lowScore: 200 },
    ],
    do: {
      updateOne: {
        query: { _id: 1 },
        update: { $max: { highScore: 870 } },
      },
    },
    expect: [
      { _id: 1, highScore: 950, lowScore: 200 },
    ],
    real: 'exact',
    docs: false,
  },

  // ===== $mul (update-mongodoc.js) =====

  {
    op: '$mul',
    kind: 'updateOp',
    title: 'Multiplies an existing field',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/mul/',
    fixture: [
      { _id: 1, item: 'Hats', quantity: 25 },
    ],
    do: {
      updateOne: {
        query: { _id: 1 },
        update: { $mul: { quantity: 2 } },
      },
    },
    expect: [
      { _id: 1, item: 'Hats', quantity: 50 },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$mul',
    kind: 'updateOp',
    title: 'Sets a non-existing field to 0',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/mul/',
    fixture: [
      { _id: 2, item: 'Unknown' },
    ],
    do: {
      updateOne: {
        query: { _id: 2 },
        update: { $mul: { price: 100 } },
      },
    },
    expect: [
      { _id: 2, item: 'Unknown', price: 0 },
    ],
    real: 'exact',
    docs: false,
  },

  // ===== $rename (update-mongodoc.js) =====

  {
    op: '$rename',
    kind: 'updateOp',
    title: 'Rename a Top-Level Field',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/rename/',
    fixture: [
      {
        _id: 1,
        alias: [ 'The American Cincinnatus', 'The American Fabius' ],
        mobile: '555-555-5555',
        nmae: { first: 'george', last: 'washington' },
      },
    ],
    do: {
      updateOne: {
        query: { _id: 1 },
        update: { $rename: { nmae: 'name' } },
      },
    },
    expect: [
      {
        _id: 1,
        alias: [ 'The American Cincinnatus', 'The American Fabius' ],
        mobile: '555-555-5555',
        name: { first: 'george', last: 'washington' },
      },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$rename',
    kind: 'updateOp',
    title: 'Rename a Field in an Embedded Document',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/rename/',
    fixture: [
      {
        _id: 1,
        mobile: '555-555-5555',
        name: { first: 'george', last: 'washington' },
      },
    ],
    do: {
      updateOne: {
        query: { _id: 1 },
        update: { $rename: { 'name.first': 'name.fname' } },
      },
    },
    expect: [
      {
        _id: 1,
        mobile: '555-555-5555',
        name: { last: 'washington', fname: 'george' },
      },
    ],
    real: 'exact',
    docs: false,
  },

  // ===== $inc (update-mongodoc.js) =====

  {
    op: '$inc',
    kind: 'updateOp',
    title: 'Increment Values (quantity & embedded metrics.orders)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/inc/',
    fixture: [
      { _id: 1, sku: 'abc123', quantity: 10, metrics: { orders: 2, ratings: 3.5 } },
    ],
    do: {
      updateOne: {
        query: { sku: 'abc123' },
        update: { $inc: { quantity: -2, 'metrics.orders': 1 } },
      },
    },
    expect: [
      { _id: 1, sku: 'abc123', quantity: 8, metrics: { orders: 3, ratings: 3.5 } },
    ],
    real: 'exact',
    docs: true,
  },

  // ===== $push (update-mongodoc.js) =====

  {
    op: '$push',
    kind: 'updateOp',
    title: 'Append a Value to an Array',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/push/',
    fixture: [
      { _id: 1, title: 'The Dark Knight', genres: [ 'Action', 'Crime', 'Drama' ] },
    ],
    do: {
      updateOne: {
        query: { title: 'The Dark Knight' },
        update: { $push: { genres: 'Classic' } },
      },
    },
    expect: [
      { _id: 1, title: 'The Dark Knight', genres: [ 'Action', 'Crime', 'Drama', 'Classic' ] },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$push',
    kind: 'updateOp',
    title: 'Append Multiple Values to an Array ($each)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/push/',
    fixture: [
      { _id: 1, genres: [ 'Action', 'Crime', 'Drama' ] },
    ],
    do: {
      updateOne: {
        query: { _id: 1 },
        update: { $push: { genres: { $each: [ 'Modern Classic', 'Award-Winning' ] } } },
      },
    },
    expect: [
      { _id: 1, genres: [ 'Action', 'Crime', 'Drama', 'Modern Classic', 'Award-Winning' ] },
    ],
    real: 'exact',
    docs: false,
  },

  {
    op: '$push',
    kind: 'updateOp',
    title: 'Use $push with $each, $sort, and $slice',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/push/',
    fixture: [
      { _id: 5, quizzes: [
        { wk: 1, score: 10 },
        { wk: 2, score: 8 },
        { wk: 3, score: 5 },
        { wk: 4, score: 6 },
      ] },
    ],
    do: {
      updateOne: {
        query: { _id: 5 },
        update: {
          $push: {
            quizzes: {
              $each: [ { wk: 5, score: 8 }, { wk: 6, score: 7 }, { wk: 7, score: 6 } ],
              $sort: { score: -1 },
              $slice: 3,
            },
          },
        },
      },
    },
    expect: [
      { _id: 5, quizzes: [
        { wk: 1, score: 10 },
        { wk: 2, score: 8 },
        { wk: 5, score: 8 },
      ] },
    ],
    real: 'exact',
    docs: false,
  },

  // ===== $addToSet (update-mongodoc.js) =====

  {
    op: '$addToSet',
    kind: 'updateOp',
    title: 'Add a Value to an Array (not present)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/addToSet/',
    fixture: [
      { _id: 1, item: 'polarizing_filter', tags: [ 'electronics', 'camera' ] },
    ],
    do: {
      updateOne: {
        query: { _id: 1 },
        update: { $addToSet: { tags: 'accessories' } },
      },
    },
    expect: [
      { _id: 1, item: 'polarizing_filter', tags: [ 'electronics', 'camera', 'accessories' ] },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$addToSet',
    kind: 'updateOp',
    title: 'Value Already in Array (no-op)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/addToSet/',
    fixture: [
      { _id: 1, item: 'polarizing_filter', tags: [ 'electronics', 'camera' ] },
    ],
    do: {
      updateOne: {
        query: { _id: 1 },
        update: { $addToSet: { tags: 'camera' } },
      },
    },
    expect: [
      { _id: 1, item: 'polarizing_filter', tags: [ 'electronics', 'camera' ] },
    ],
    real: 'exact',
    docs: false,
  },

  {
    op: '$addToSet',
    kind: 'updateOp',
    title: '$addToSet with $each (only new values added)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/addToSet/',
    fixture: [
      { _id: 2, item: 'cable', tags: [ 'electronics', 'supplies' ] },
    ],
    do: {
      updateOne: {
        query: { _id: 2 },
        update: { $addToSet: { tags: { $each: [ 'camera', 'electronics', 'accessories' ] } } },
      },
    },
    expect: [
      { _id: 2, item: 'cable', tags: [ 'electronics', 'supplies', 'camera', 'accessories' ] },
    ],
    real: 'exact',
    docs: false,
  },

  // ===== $pop (update-mongodoc.js) =====

  {
    op: '$pop',
    kind: 'updateOp',
    title: 'Remove the Last Item ($pop: 1)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/pop/',
    fixture: [
      { _id: 10, scores: [ 9, 10 ] },
    ],
    do: {
      updateOne: {
        query: { _id: 10 },
        update: { $pop: { scores: 1 } },
      },
    },
    expect: [
      { _id: 10, scores: [ 9 ] },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$pop',
    kind: 'updateOp',
    title: 'Remove the First Item ($pop: -1)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/pop/',
    fixture: [
      { _id: 1, scores: [ 8, 9, 10 ] },
    ],
    do: {
      updateOne: {
        query: { _id: 1 },
        update: { $pop: { scores: -1 } },
      },
    },
    expect: [
      { _id: 1, scores: [ 9, 10 ] },
    ],
    real: 'exact',
    docs: false,
  },

  // ===== $pull (update-mongodoc.js) =====

  {
    op: '$pull',
    kind: 'updateOp',
    title: 'Remove All Items That Equal a Specified Value',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/pull/',
    fixture: [
      {
        _id: 1,
        fruits: [ 'apples', 'pears', 'oranges', 'grapes', 'bananas' ],
        vegetables: [ 'carrots', 'celery', 'squash', 'carrots' ],
      },
    ],
    do: {
      updateOne: {
        query: { _id: 1 },
        update: { $pull: { fruits: { $in: [ 'apples', 'oranges' ] }, vegetables: 'carrots' } },
      },
    },
    expect: [
      {
        _id: 1,
        fruits: [ 'pears', 'grapes', 'bananas' ],
        vegetables: [ 'celery', 'squash' ],
      },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$pull',
    kind: 'updateOp',
    title: 'Remove All Items That Match a Specified $pull Condition',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/pull/',
    fixture: [
      { _id: 1, votes: [ 3, 5, 6, 7, 7, 8 ] },
    ],
    do: {
      updateOne: {
        query: { _id: 1 },
        update: { $pull: { votes: { $gte: 6 } } },
      },
    },
    expect: [
      { _id: 1, votes: [ 3, 5 ] },
    ],
    real: 'exact',
    docs: false,
  },

  {
    op: '$pull',
    kind: 'updateOp',
    title: 'Remove Items from an Array of Documents',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/pull/',
    fixture: [
      { _id: 1, results: [ { item: 'A', score: 5 }, { item: 'B', score: 8 } ] },
    ],
    do: {
      updateOne: {
        query: { _id: 1 },
        update: { $pull: { results: { score: 8, item: 'B' } } },
      },
    },
    expect: [
      { _id: 1, results: [ { item: 'A', score: 5 } ] },
    ],
    real: 'exact',
    docs: false,
  },

  // ===== $pullAll (update-mongodoc.js) =====

  {
    op: '$pullAll',
    kind: 'updateOp',
    title: 'Removes all instances of the listed values',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/pullAll/',
    fixture: [
      { _id: 1, scores: [ 0, 2, 5, 5, 1, 0 ] },
    ],
    do: {
      updateOne: {
        query: { _id: 1 },
        update: { $pullAll: { scores: [ 0, 5 ] } },
      },
    },
    expect: [
      { _id: 1, scores: [ 2, 1 ] },
    ],
    real: 'exact',
    docs: true,
  },

  // ===== $[] all-positional (update-positional-mongodoc.js) =====

  {
    op: '$[]',
    kind: 'updateOp',
    title: '$inc every element of an array',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/positional-all/',
    fixture: [
      { _id: 1, grades: [ 85, 82, 80 ] },
      { _id: 2, grades: [ 88, 90, 92 ] },
      { _id: 3, grades: [ 85, 100, 90 ] },
    ],
    do: {
      updateMany: {
        query: {},
        update: { $inc: { 'grades.$[]': 10 } },
      },
    },
    expect: [
      { _id: 1, grades: [ 95, 92, 90 ] },
      { _id: 2, grades: [ 98, 100, 102 ] },
      { _id: 3, grades: [ 95, 110, 100 ] },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$[]',
    kind: 'updateOp',
    title: '$inc a field of every embedded document in an array (dot notation)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/positional-all/',
    fixture: [
      { _id: 1, grades: [
        { grade: 80, mean: 75, std: 8 },
        { grade: 85, mean: 90, std: 6 },
        { grade: 85, mean: 85, std: 8 },
      ] },
    ],
    do: {
      updateMany: {
        query: {},
        update: { $inc: { 'grades.$[].std': -2 } },
      },
    },
    expect: [
      { _id: 1, grades: [
        { grade: 80, mean: 75, std: 6 },
        { grade: 85, mean: 90, std: 4 },
        { grade: 85, mean: 85, std: 6 },
      ] },
    ],
    real: 'exact',
    docs: false,
  },

  // ===== $[<identifier>] filtered-positional (update-positional-mongodoc.js) =====

  {
    op: '$[<id>]',
    kind: 'updateOp',
    title: 'Update array elements matching arrayFilters',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/positional-filtered/',
    fixture: [
      { _id: 1, grades: [ 95, 92, 90 ] },
      { _id: 2, grades: [ 98, 100, 102 ] },
      { _id: 3, grades: [ 95, 110, 100 ] },
    ],
    do: {
      updateMany: {
        query: {},
        update: { $set: { 'grades.$[element]': 100 } },
        options: { arrayFilters: [ { element: { $gte: 100 } } ] },
      },
    },
    expect: [
      { _id: 1, grades: [ 95, 92, 90 ] },
      { _id: 2, grades: [ 98, 100, 100 ] },
      { _id: 3, grades: [ 95, 100, 100 ] },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$[<id>]',
    kind: 'updateOp',
    title: 'Update a field of embedded docs matching arrayFilters (dotted identifier)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/positional-filtered/',
    fixture: [
      { _id: 1, grades: [
        { grade: 80, mean: 75, std: 6 },
        { grade: 85, mean: 90, std: 4 },
        { grade: 85, mean: 85, std: 6 },
      ] },
      { _id: 2, grades: [
        { grade: 90, mean: 75, std: 6 },
        { grade: 87, mean: 90, std: 3 },
        { grade: 85, mean: 85, std: 4 },
      ] },
    ],
    do: {
      updateMany: {
        query: {},
        update: { $set: { 'grades.$[elem].mean': 100 } },
        options: { arrayFilters: [ { 'elem.grade': { $gte: 85 } } ] },
      },
    },
    expect: [
      { _id: 1, grades: [
        { grade: 80, mean: 75, std: 6 },
        { grade: 85, mean: 100, std: 4 },
        { grade: 85, mean: 100, std: 6 },
      ] },
      { _id: 2, grades: [
        { grade: 90, mean: 100, std: 6 },
        { grade: 87, mean: 100, std: 3 },
        { grade: 85, mean: 100, std: 4 },
      ] },
    ],
    real: 'exact',
    docs: false,
  },

  // ===== $bit (update-positional-mongodoc.js) =====

  {
    op: '$bit',
    kind: 'updateOp',
    title: 'Bitwise AND (13 & 10 = 8)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/bit/',
    fixture: [
      { _id: 1, expdata: 13 },
    ],
    do: {
      updateOne: {
        query: { _id: 1 },
        update: { $bit: { expdata: { and: 10 } } },
      },
    },
    expect: [
      { _id: 1, expdata: 8 },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$bit',
    kind: 'updateOp',
    title: 'Bitwise OR (3 | 5 = 7)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/bit/',
    fixture: [
      { _id: 2, expdata: 3 },
    ],
    do: {
      updateOne: {
        query: { _id: 2 },
        update: { $bit: { expdata: { or: 5 } } },
      },
    },
    expect: [
      { _id: 2, expdata: 7 },
    ],
    real: 'exact',
    docs: false,
  },

  {
    op: '$bit',
    kind: 'updateOp',
    title: 'Bitwise XOR (1 ^ 5 = 4)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/bit/',
    fixture: [
      { _id: 3, expdata: 1 },
    ],
    do: {
      updateOne: {
        query: { _id: 3 },
        update: { $bit: { expdata: { xor: 5 } } },
      },
    },
    expect: [
      { _id: 3, expdata: 4 },
    ],
    real: 'exact',
    docs: false,
  },

];
