'use strict';

// Ported from find-project, find-projection-operators, distinct -mongodoc.js

module.exports = [

  // ---------------------------------------------------------------------------
  // Plain projection
  // Source: https://docs.mongodb.org/v3.2/tutorial/project-fields-from-query-results/
  // ---------------------------------------------------------------------------

  {
    op: 'projection',
    kind: 'projection',
    title: 'Return All Fields in Matching Documents',
    source: 'https://docs.mongodb.org/v3.2/tutorial/project-fields-from-query-results/',
    fixture: [ { value: 'ab' } ],
    do: { find: { query: {}, projection: {} } },
    expect: [ { value: 'ab' } ],
    real: 'exact',
    docs: true,
  },

  {
    op: 'projection',
    kind: 'projection',
    title: 'Return the Specified Fields and the _id Field Only',
    source: 'https://docs.mongodb.org/v3.2/tutorial/project-fields-from-query-results/',
    fixture: [
      { type: 'food', item: 'item', qty: 1 },
      { type: 'not-a-food', item: 'item', qty: 1 },
    ],
    do: { find: { query: { type: 'food' }, projection: { item: 1, qty: 1 } } },
    expect: [ { item: 'item', qty: 1 } ],
    real: 'exact',
  },

  {
    op: 'projection',
    kind: 'projection',
    title: 'Return Specified Fields Only',
    source: 'https://docs.mongodb.org/v3.2/tutorial/project-fields-from-query-results/',
    fixture: [
      { type: 'food', item: 'item', qty: 1 },
      { type: 'not-a-food', item: 'item', qty: 1 },
    ],
    do: { find: { query: { type: 'food' }, projection: { item: 1, qty: 1, _id: 0 } } },
    expect: [ { item: 'item', qty: 1 } ],
    real: 'exact',
  },

  {
    op: 'projection',
    kind: 'projection',
    title: 'Return All But the Excluded Field',
    source: 'https://docs.mongodb.org/v3.2/tutorial/project-fields-from-query-results/',
    fixture: [
      { type: 'food', item: 'item', qty: 1 },
      { type: 'not-a-food', item: 'item', qty: 1 },
    ],
    do: { find: { query: { type: 'food' }, projection: { type: 0 } } },
    expect: [ { item: 'item', qty: 1 } ],
    real: 'exact',
  },

  {
    op: 'projection',
    kind: 'projection',
    title: 'Return Specific Fields in Embedded Documents',
    source: 'https://docs.mongodb.org/v3.2/tutorial/project-fields-from-query-results/',
    fixture: [
      {
        '_id': 3,
        'type': 'food',
        'item': 'aaa',
        'classification': { dept: 'grocery', category: 'chocolate' },
      },
    ],
    do: {
      find: {
        query: { type: 'food', _id: 3 },
        projection: { 'classification.category': 1, _id: 0 },
      },
    },
    expect: [ { 'classification': { category: 'chocolate' } } ],
    real: 'exact',
  },

  {
    op: 'projection',
    kind: 'projection',
    title: 'Suppress Specific Fields in Embedded Documents',
    source: 'https://docs.mongodb.org/v3.2/tutorial/project-fields-from-query-results/',
    fixture: [
      {
        '_id': 3,
        'type': 'food',
        'item': 'Super Dark Chocolate',
        'classification': { 'dept': 'grocery', 'category': 'chocolate' },
        'vendor': {
          'primary': {
            'name': 'Marsupial Vending Co',
            'address': 'Wallaby Rd',
            'delivery': [ 'M', 'W', 'F' ],
          },
          'secondary': {
            'name': 'Intl. Chocolatiers',
            'address': 'Cocoa Plaza',
            'delivery': [ 'Sa' ],
          },
        },
      },
    ],
    do: {
      find: {
        query: { type: 'food', _id: 3 },
        projection: { 'classification.category': 0 },
      },
    },
    expect: [
      {
        '_id': 3,
        'type': 'food',
        'item': 'Super Dark Chocolate',
        'classification': { 'dept': 'grocery' },
        'vendor': {
          'primary': {
            'name': 'Marsupial Vending Co',
            'address': 'Wallaby Rd',
            'delivery': [ 'M', 'W', 'F' ],
          },
          'secondary': {
            'name': 'Intl. Chocolatiers',
            'address': 'Cocoa Plaza',
            'delivery': [ 'Sa' ],
          },
        },
      },
    ],
    real: 'exact',
  },

  // ---------------------------------------------------------------------------
  // Projection operators: $slice, $elemMatch, $ (positional)
  // ---------------------------------------------------------------------------

  {
    op: '$slice',
    kind: 'projection',
    title: '$slice: 3 returns the first 3 array elements (other fields kept)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/projection/slice/',
    fixture: [
      {
        _id: 2,
        title: 'Coffee please.',
        comments: [
          { comment: '0. fooey' },
          { comment: '1. tea please' },
          { comment: '2. iced coffee' },
          { comment: '3. cappuccino' },
          { comment: '4. whatever' },
        ],
      },
    ],
    do: { find: { query: {}, projection: { comments: { $slice: 3 } } } },
    expect: [
      {
        _id: 2,
        title: 'Coffee please.',
        comments: [
          { comment: '0. fooey' },
          { comment: '1. tea please' },
          { comment: '2. iced coffee' },
        ],
      },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$slice',
    kind: 'projection',
    title: '$slice: [1, 3] skips 1 then returns 3',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/projection/slice/',
    fixture: [
      {
        _id: 2,
        title: 'Coffee please.',
        comments: [
          { comment: '0. fooey' },
          { comment: '1. tea please' },
          { comment: '2. iced coffee' },
          { comment: '3. cappuccino' },
          { comment: '4. whatever' },
        ],
      },
    ],
    do: { find: { query: {}, projection: { comments: { $slice: [ 1, 3 ] } } } },
    // original asserts only res[0].comments
    expect: [
      {
        _id: 2,
        title: 'Coffee please.',
        comments: [
          { comment: '1. tea please' },
          { comment: '2. iced coffee' },
          { comment: '3. cappuccino' },
        ],
      },
    ],
    real: 'exact',
  },

  {
    op: '$elemMatch',
    kind: 'projection',
    title: '$elemMatch returns only the first matching array element; omits field if none match',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/projection/elemMatch/',
    fixture: [
      { _id: 1, zipcode: '63109', students: [
        { name: 'john', school: 102, age: 10 },
        { name: 'jess', school: 102, age: 11 },
        { name: 'jeff', school: 108, age: 15 },
      ] },
      { _id: 3, zipcode: '63109', students: [
        { name: 'ajax', school: 100, age: 7 },
        { name: 'achilles', school: 100, age: 8 },
      ] },
      { _id: 4, zipcode: '63109', students: [
        { name: 'barney', school: 102, age: 7 },
        { name: 'ruth', school: 102, age: 16 },
      ] },
    ],
    do: {
      find: {
        query: { zipcode: '63109' },
        projection: { students: { $elemMatch: { school: 102 } } },
      },
    },
    expect: [
      { _id: 1, students: [ { name: 'john', school: 102, age: 10 } ] },
      { _id: 3 },
      { _id: 4, students: [ { name: 'barney', school: 102, age: 7 } ] },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$ (positional)',
    kind: 'projection',
    title: '$ (positional) projects the first array element matching the query condition',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/projection/positional/',
    fixture: [
      { _id: 1, semester: 1, grades: [ 70, 87, 90 ] },
      { _id: 2, semester: 1, grades: [ 90, 88, 92 ] },
      { _id: 3, semester: 1, grades: [ 85, 100, 90 ] },
      { _id: 4, semester: 2, grades: [ 79, 85, 80 ] },
      { _id: 5, semester: 2, grades: [ 88, 88, 92 ] },
      { _id: 6, semester: 2, grades: [ 95, 90, 96 ] },
    ],
    do: {
      find: {
        query: { semester: 1, grades: { $gte: 85 } },
        projection: { 'grades.$': 1 },
      },
    },
    expect: [
      { _id: 1, grades: [ 87 ] },
      { _id: 2, grades: [ 90 ] },
      { _id: 3, grades: [ 85 ] },
    ],
    real: 'exact',
    docs: true,
  },

  // ---------------------------------------------------------------------------
  // distinct()
  // Source: https://www.mongodb.com/docs/manual/reference/method/db.collection.distinct/
  // ---------------------------------------------------------------------------

  {
    op: 'distinct',
    kind: 'method',
    title: 'distinct values of a simple field',
    source: 'https://www.mongodb.com/docs/manual/reference/method/db.collection.distinct/',
    fixture: [
      { _id: 1, dept: 'A', item: { sku: '111', color: 'red' }, sizes: [ 'S', 'M' ] },
      { _id: 2, dept: 'A', item: { sku: '111', color: 'blue' }, sizes: [ 'M', 'L' ] },
      { _id: 3, dept: 'B', item: { sku: '222', color: 'blue' }, sizes: 'S' },
      { _id: 4, dept: 'A', item: { sku: '333', color: 'black' }, sizes: [ 'S' ] },
    ],
    do: { distinct: { field: 'dept' } },
    expect: [ 'A', 'B' ],
    real: 'exact',
    docs: true,
  },

  {
    op: 'distinct',
    kind: 'method',
    title: 'distinct: array fields are flattened (each element is a distinct value)',
    source: 'https://www.mongodb.com/docs/manual/reference/method/db.collection.distinct/',
    fixture: [
      { _id: 1, dept: 'A', item: { sku: '111', color: 'red' }, sizes: [ 'S', 'M' ] },
      { _id: 2, dept: 'A', item: { sku: '111', color: 'blue' }, sizes: [ 'M', 'L' ] },
      { _id: 3, dept: 'B', item: { sku: '222', color: 'blue' }, sizes: 'S' },
      { _id: 4, dept: 'A', item: { sku: '333', color: 'black' }, sizes: [ 'S' ] },
    ],
    do: { distinct: { field: 'sizes' } },
    expect: [ 'S', 'M', 'L' ],
    real: 'exact',
  },

  {
    op: 'distinct',
    kind: 'method',
    title: 'distinct: nested field with a query filter',
    source: 'https://www.mongodb.com/docs/manual/reference/method/db.collection.distinct/',
    fixture: [
      { _id: 1, dept: 'A', item: { sku: '111', color: 'red' }, sizes: [ 'S', 'M' ] },
      { _id: 2, dept: 'A', item: { sku: '111', color: 'blue' }, sizes: [ 'M', 'L' ] },
      { _id: 3, dept: 'B', item: { sku: '222', color: 'blue' }, sizes: 'S' },
      { _id: 4, dept: 'A', item: { sku: '333', color: 'black' }, sizes: [ 'S' ] },
    ],
    do: { distinct: { field: 'item.sku', query: { dept: 'A' } } },
    expect: [ '111', '333' ],
    real: 'exact',
  },

];
