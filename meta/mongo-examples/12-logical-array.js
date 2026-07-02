'use strict';

// Ported from test/crud/find-logical-mongodoc.js, find-queryArray-mongodoc.js

module.exports = [
  {
    op: '$or',
    kind: 'queryOp',
    title: 'Logical OR',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/or/',
    fixture: [
      { quantity: 10, price: 10 },
      { quantity: 10, price:  0 },
      { quantity: 20, price: 10 },
      { quantity: 20, price:  0 },
      { quantity: 30, price: 10 },
      { quantity: 30, price:  0 }
    ],
    do: { find: { query: { $or: [ { quantity: { $lt: 20 } }, { price: 10 } ] } } },
    expect: [
      { quantity: 10, price: 10 },
      { quantity: 10, price:  0 },
      { quantity: 20, price: 10 },
      { quantity: 30, price: 10 }
    ],
    real: 'exact',
    docs: true
  },
  {
    op: '$and',
    kind: 'queryOp',
    title: 'AND Queries With Multiple Expressions Specifying the Same Field',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/and/',
    fixture: [
      { },
      { price: 0.99 },
      { price: 1.99 }
    ],
    do: { find: { query: { $and: [ { price: { $ne: 1.99 } }, { price: { $exists: true } } ] } } },
    expect: [
      { price: 0.99 }
    ],
    real: 'exact',
    docs: true
  },
  {
    op: '$and',
    kind: 'queryOp',
    title: 'implicit $and',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/and/',
    fixture: [
      { },
      { price: 0.99 },
      { price: 1.99 }
    ],
    do: { find: { query: { price: { $ne: 1.99, $exists: true } } } },
    expect: [
      { price: 0.99 }
    ],
    real: 'exact',
    docs: false
  },
  {
    op: '$and',
    kind: 'queryOp',
    title: 'AND Queries With Multiple Expressions Specifying the Same Operator',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/and/',
    fixture: [
      { qty: 10, sale: true               },
      { qty: 30, sale: true               },
      { qty: 10, sale: true,  price: 0.99 },
      { qty: 30, sale: true,  price: 0.99 },
      { qty: 10, sale: false, price: 0.99 },
      { qty: 30, sale: false, price: 0.99 },
      { qty: 10, sale: true,  price: 1.99 },
      { qty: 30, sale: true,  price: 1.99 },
      { qty: 10, sale: false, price: 1.99 },
      { qty: 30, sale: false, price: 1.99 }
    ],
    do: { find: { query: {
      $and: [
        { $or: [ { price: 0.99 }, { price: 1.99 } ] },
        { $or: [ { sale: true }, { qty: { $lt: 20 } } ] }
      ]
    } } },
    expect: [
      { qty: 10, sale: true,  price: 0.99 },
      { qty: 30, sale: true,  price: 0.99 },
      { qty: 10, sale: false, price: 0.99 },
      { qty: 10, sale: true,  price: 1.99 },
      { qty: 30, sale: true,  price: 1.99 },
      { qty: 10, sale: false, price: 1.99 }
    ],
    real: 'exact',
    docs: false
  },
  {
    op: '$all',
    kind: 'queryOp',
    title: 'Use $all to Match Values',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/all/',
    fixture: [
      {
        _id: "5234cc89687ea597eabee675",
        code: "xyz",
        tags: [ "school", "book", "bag", "headphone", "appliance" ],
        qty: [
          { size: "S", num: 10, color: "blue" },
          { size: "M", num: 45, color: "blue" },
          { size: "L", num: 100, color: "green" }
        ]
      },
      {
        _id: "5234cc8a687ea597eabee676",
        code: "abc",
        tags: [ "appliance", "school", "book" ],
        qty: [
          { size: "6", num: 100, color: "green" },
          { size: "6", num: 50, color: "blue" },
          { size: "8", num: 100, color: "brown" }
        ]
      },
      {
        _id: "5234ccb7687ea597eabee677",
        code: "efg",
        tags: [ "school", "book" ],
        qty: [
          { size: "S", num: 10, color: "blue" },
          { size: "M", num: 100, color: "blue" },
          { size: "L", num: 100, color: "green" }
        ]
      },
      {
        _id: "52350353b2eff1353b349de9",
        code: "ijk",
        tags: [ "electronics", "school" ],
        qty: [
          { size: "M", num: 100, color: "green" }
        ]
      }
    ],
    do: { find: { query: { tags: { $all: [ "appliance", "school", "book" ] } } } },
    expect: [
      {
        _id: "5234cc89687ea597eabee675",
        code: "xyz",
        tags: [ "school", "book", "bag", "headphone", "appliance" ],
        qty: [
          { size: "S", num: 10, color: "blue" },
          { size: "M", num: 45, color: "blue" },
          { size: "L", num: 100, color: "green" }
        ]
      },
      {
        _id: "5234cc8a687ea597eabee676",
        code: "abc",
        tags: [ "appliance", "school", "book" ],
        qty: [
          { size: "6", num: 100, color: "green" },
          { size: "6", num: 50, color: "blue" },
          { size: "8", num: 100, color: "brown" }
        ]
      }
    ],
    real: 'exact',
    docs: true
  },
  {
    op: '$elemMatch',
    kind: 'queryOp',
    title: 'Element Match',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/elemMatch/',
    fixture: [
      { _id: 1, results: [ 82, 85, 88 ] },
      { _id: 2, results: [ 75, 88, 89 ] }
    ],
    do: { find: { query: { results: { $elemMatch: { $gte: 80, $lt: 85 } } } } },
    expect: [
      { _id: 1, results: [ 82, 85, 88 ] }
    ],
    real: 'exact',
    docs: true
  },
  {
    op: '$elemMatch',
    kind: 'queryOp',
    title: 'Array of Embedded Documents',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/elemMatch/',
    fixture: [
      { _id: 1, results: [ { product: "abc", score: 10 }, { product: "xyz", score: 5 } ] },
      { _id: 2, results: [ { product: "abc", score:  8 }, { product: "xyz", score: 7 } ] },
      { _id: 3, results: [ { product: "abc", score:  7 }, { product: "xyz", score: 8 } ] }
    ],
    do: { find: { query: { results: { $elemMatch: { product: "xyz", score: { $gte: 8 } } } } } },
    expect: [
      { _id: 3, results: [ { product: "abc", score:  7 }, { product: "xyz", score: 8 } ] }
    ],
    real: 'exact',
    docs: false
  },
  {
    op: '$size',
    kind: 'queryOp',
    title: '$size:2',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/size/',
    fixture: [
      { field: [ 'red', 'green' ] },
      { field: [ 'apple', 'lime' ] },
      { field: 'fruit' },
      { field: [ 'orange', 'lemon', 'grapefruit' ] }
    ],
    do: { find: { query: { field: { $size: 2 } } } },
    expect: [
      { field: [ 'red', 'green' ] },
      { field: [ 'apple', 'lime' ] }
    ],
    real: 'exact',
    docs: true
  },
  {
    op: '$size',
    kind: 'queryOp',
    title: '$size:1',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/query/size/',
    fixture: [
      { field: [ 'red', 'green' ] },
      { field: [ 'apple', 'lime' ] },
      { field: 'fruit' },
      { field: [ 'orange', 'lemon', 'grapefruit' ] }
    ],
    do: { find: { query: { field: { $size: 1 } } } },
    expect: [],
    real: 'exact',
    docs: false
  }
];
