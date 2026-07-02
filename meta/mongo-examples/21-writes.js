'use strict';

// Ported from update-positional-dollar, update-upsert, write-result, bulkwrite -mongodoc.js

module.exports = [

  // ---------------------------------------------------------------------------
  // Positional `$` update operator
  //   https://www.mongodb.com/docs/manual/reference/operator/update/positional/
  // ---------------------------------------------------------------------------

  {
    op: '$',
    kind: 'updateOp',
    title: 'positional $ updates the first array element matched by the query',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/positional/',
    fixture: [
      { _id: 1, grades: [ 85, 80, 80 ] },
      { _id: 2, grades: [ 88, 90, 92 ] },
      { _id: 3, grades: [ 85, 100, 90 ] },
    ],
    do: { updateOne: { query: { _id: 1, grades: 80 }, update: { $set: { 'grades.$': 82 } } } },
    // first 80 (index 1) -> 82; the second 80 (index 2) is untouched.
    expect: [
      { _id: 1, grades: [ 85, 82, 80 ] },
      { _id: 2, grades: [ 88, 90, 92 ] },
      { _id: 3, grades: [ 85, 100, 90 ] },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$',
    kind: 'updateOp',
    title: 'positional $ uses the FIRST matched element only (not all matches)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/positional/',
    fixture: [
      { _id: 1, grades: [ 80, 80, 80 ] },
    ],
    do: { updateOne: { query: { grades: 80 }, update: { $inc: { 'grades.$': 1 } } } },
    // only index 0 is incremented.
    expect: [
      { _id: 1, grades: [ 81, 80, 80 ] },
    ],
    real: 'exact',
    docs: false,
  },

  {
    op: '$',
    kind: 'updateOp',
    title: 'positional $ with a range condition ($gte) — first matching element per doc, updateMany',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/positional/',
    fixture: [
      { _id: 1, grades: [ 85, 80, 80 ] },
      { _id: 2, grades: [ 88, 90, 92 ] },
      { _id: 3, grades: [ 85, 100, 90 ] },
    ],
    do: { updateMany: { query: { grades: { $gte: 85 } }, update: { $set: { 'grades.$': 100 } } } },
    // each doc: first element with grade >= 85 set to 100.
    expect: [
      { _id: 1, grades: [ 100, 80, 80 ] },
      { _id: 2, grades: [ 100, 90, 92 ] },
      { _id: 3, grades: [ 100, 100, 90 ] },
    ],
    real: 'exact',
    docs: false,
  },

  {
    op: '$',
    kind: 'updateOp',
    title: 'positional $.field — positional into an array of subdocuments (via $elemMatch)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/positional/',
    fixture: [
      {
        _id: 4,
        grades: [
          { grade: 80, mean: 75, std: 8 },
          { grade: 85, mean: 90, std: 5 },
          { grade: 90, mean: 85, std: 3 },
        ],
      },
    ],
    do: { updateOne: { query: { _id: 4, grades: { $elemMatch: { grade: 85 } } }, update: { $set: { 'grades.$.std': 6 } } } },
    // the matched subdocument (grade:85) gets std:6; others untouched.
    expect: [
      {
        _id: 4,
        grades: [
          { grade: 80, mean: 75, std: 8 },
          { grade: 85, mean: 90, std: 6 },
          { grade: 90, mean: 85, std: 3 },
        ],
      },
    ],
    real: 'exact',
    docs: false,
  },

  // ---------------------------------------------------------------------------
  // Upsert + $setOnInsert
  //   https://www.mongodb.com/docs/manual/reference/method/db.collection.updateOne/
  //   https://www.mongodb.com/docs/manual/reference/operator/update/setOnInsert/
  // ---------------------------------------------------------------------------

  {
    op: 'upsert',
    kind: 'updateOp',
    title: 'updateOne upsert fills the new doc from filter equality + update operators',
    source: 'https://www.mongodb.com/docs/manual/reference/method/db.collection.updateOne/',
    fixture: [],
    do: {
      updateOne: {
        query: { name: "Pizza Rat's Pizzaria" },
        update: { $set: { _id: 4, violations: 7, borough: 'Manhattan' } },
        options: { upsert: true },
      },
    },
    // `name` comes from the filter; the rest from the update operators. _id:4 supplied by $set.
    expect: [
      { _id: 4, name: "Pizza Rat's Pizzaria", violations: 7, borough: 'Manhattan' },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$setOnInsert',
    kind: 'updateOp',
    title: '$setOnInsert applies its fields on insert (upsert with no match)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/setOnInsert/',
    fixture: [],
    do: {
      updateOne: {
        query: { _id: 1 },
        update: { $set: { item: 'apple' }, $setOnInsert: { defaultQty: 100 } },
        options: { upsert: true },
      },
    },
    expect: [
      { _id: 1, item: 'apple', defaultQty: 100 },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: '$setOnInsert',
    kind: 'updateOp',
    title: '$setOnInsert is a no-op when the upsert matches (update, not insert)',
    source: 'https://www.mongodb.com/docs/manual/reference/operator/update/setOnInsert/',
    fixture: [
      { _id: 1, item: 'apple', defaultQty: 100 },
    ],
    do: {
      updateOne: {
        query: { _id: 1 },
        update: { $set: { item: 'pear' }, $setOnInsert: { defaultQty: 999 } },
        options: { upsert: true },
      },
    },
    // matched => normal update; $setOnInsert contributed nothing (defaultQty stays 100).
    expect: [
      { _id: 1, item: 'pear', defaultQty: 100 },
    ],
    real: 'exact',
    docs: false,
  },

  {
    op: 'upsert',
    kind: 'updateOp',
    title: 'upsert that matches behaves as a normal update (no insert)',
    source: 'https://www.mongodb.com/docs/manual/reference/method/db.collection.updateOne/',
    fixture: [
      { _id: 7, item: 'apple' },
    ],
    do: {
      updateOne: {
        query: { _id: 7 },
        update: { $set: { item: 'fig' } },
        options: { upsert: true },
      },
    },
    expect: [
      { _id: 7, item: 'fig' },
    ],
    real: 'exact',
    docs: false,
  },

  {
    op: 'upsert',
    kind: 'updateOp',
    title: 'without upsert, no match is a no-op (nothing inserted)',
    source: 'https://www.mongodb.com/docs/manual/reference/method/db.collection.updateOne/',
    fixture: [],
    do: {
      updateOne: {
        query: { _id: 1 },
        update: { $set: { x: 1 } },
      },
    },
    expect: [],
    real: 'exact',
    docs: false,
  },

  {
    op: 'upsert',
    kind: 'updateOp',
    title: 'replaceOne upsert inserts the replacement seeded with the filter equality (explicit _id)',
    source: 'https://www.mongodb.com/docs/manual/reference/method/db.collection.replaceOne/',
    fixture: [],
    do: {
      replaceOne: {
        query: { _id: 5 },
        replacement: { name: 'new' },
        options: { upsert: true },
      },
    },
    expect: [
      { _id: 5, name: 'new' },
    ],
    real: 'exact',
    docs: false,
  },

  // ---------------------------------------------------------------------------
  // Write-result methods — canonicalized to resulting DOCUMENTS (not the report)
  //   https://www.mongodb.com/docs/manual/reference/method/db.collection.insertOne/
  //   https://www.mongodb.com/docs/manual/reference/method/db.collection.insertMany/
  //   https://www.mongodb.com/docs/manual/reference/method/db.collection.deleteOne/
  //   https://www.mongodb.com/docs/manual/reference/method/db.collection.deleteMany/
  // ---------------------------------------------------------------------------

  {
    op: 'insertOne',
    kind: 'method',
    title: 'insertOne adds the document (with its supplied _id)',
    source: 'https://www.mongodb.com/docs/manual/reference/method/db.collection.insertOne/',
    fixture: [],
    do: { insertOne: { document: { _id: 10, item: 'box', qty: 20 } } },
    expect: [
      { _id: 10, item: 'box', qty: 20 },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: 'insertMany',
    kind: 'method',
    title: 'insertMany adds all documents',
    source: 'https://www.mongodb.com/docs/manual/reference/method/db.collection.insertMany/',
    fixture: [],
    do: { insertMany: { documents: [
      { _id: 11, item: 'pencil', qty: 50 },
      { _id: 12, item: 'pen', qty: 20 },
    ] } },
    expect: [
      { _id: 11, item: 'pencil', qty: 50 },
      { _id: 12, item: 'pen', qty: 20 },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: 'deleteOne',
    kind: 'method',
    title: 'deleteOne removes the first matching document',
    source: 'https://www.mongodb.com/docs/manual/reference/method/db.collection.deleteOne/',
    fixture: [
      { _id: 1, status: 'D' },
      { _id: 2, status: 'D' },
    ],
    do: { deleteOne: { query: { status: 'D' } } },
    // only the first match (_id:1) is removed.
    expect: [
      { _id: 2, status: 'D' },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: 'deleteMany',
    kind: 'method',
    title: 'deleteMany removes all matching documents',
    source: 'https://www.mongodb.com/docs/manual/reference/method/db.collection.deleteMany/',
    fixture: [
      { _id: 1, status: 'D' },
      { _id: 2, status: 'A' },
      { _id: 3, status: 'D' },
    ],
    do: { deleteMany: { query: { status: 'D' } } },
    expect: [
      { _id: 2, status: 'A' },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: 'deleteOne',
    kind: 'method',
    title: 'deleteOne with no match leaves the collection unchanged',
    source: 'https://www.mongodb.com/docs/manual/reference/method/db.collection.deleteOne/',
    fixture: [
      { _id: 1, status: 'A' },
    ],
    do: { deleteOne: { query: { status: 'Z' } } },
    expect: [
      { _id: 1, status: 'A' },
    ],
    real: 'exact',
    docs: false,
  },

  // ---------------------------------------------------------------------------
  // bulkWrite — batch of heterogeneous writes in one call
  //   https://www.mongodb.com/docs/manual/reference/method/db.collection.bulkWrite/
  //
  // NOTE: represented as `do: { bulkWrite: { operations, options? } }` — bulkWrite
  // is not in the standard `do` op list, so apply-example.js needs a bulkWrite case.
  // ---------------------------------------------------------------------------

  {
    op: 'bulkWrite',
    kind: 'method',
    title: 'the canonical pizzas batch applies every write (insert/update/delete/replace)',
    source: 'https://www.mongodb.com/docs/manual/reference/method/db.collection.bulkWrite/',
    fixture: [
      { _id: 0, type: 'pepperoni', size: 'small',  price: 4 },
      { _id: 1, type: 'cheese',    size: 'medium', price: 7 },
      { _id: 2, type: 'vegan',     size: 'large',  price: 8 },
    ],
    do: {
      bulkWrite: {
        operations: [
          { insertOne: { document: { _id: 3, type: 'beef',    size: 'medium', price: 6 } } },
          { insertOne: { document: { _id: 4, type: 'sausage', size: 'large',  price: 10 } } },
          { updateOne: { filter: { type: 'cheese' }, update: { $set: { price: 8 } } } },
          { deleteOne: { filter: { type: 'pepperoni' } } },
          { replaceOne: { filter: { type: 'vegan' }, replacement: { type: 'tofu', size: 'small', price: 4 } } },
        ],
      },
    },
    // pepperoni deleted; cheese price 7->8; vegan replaced with tofu (retains _id:2 per Mongo);
    // beef and sausage inserted. Sorted by _id.
    expect: [
      { _id: 1, type: 'cheese',  size: 'medium', price: 8 },
      { _id: 2, type: 'tofu',    size: 'small',  price: 4 },
      { _id: 3, type: 'beef',    size: 'medium', price: 6 },
      { _id: 4, type: 'sausage', size: 'large',  price: 10 },
    ],
    real: 'exact',
    docs: true,
  },

  {
    op: 'bulkWrite',
    kind: 'method',
    title: 'bulkWrite updateMany + upsert apply across the batch',
    source: 'https://www.mongodb.com/docs/manual/reference/method/db.collection.bulkWrite/',
    fixture: [
      { _id: 0, type: 'pepperoni', size: 'small',  price: 4 },
      { _id: 1, type: 'cheese',    size: 'medium', price: 7 },
      { _id: 2, type: 'vegan',     size: 'large',  price: 8 },
    ],
    do: {
      bulkWrite: {
        operations: [
          { updateMany: { filter: { size: 'large' }, update: { $inc: { price: 1 } } } },
          { updateOne: { filter: { _id: 99, type: 'hawaiian' }, update: { $set: { price: 5 } }, upsert: true } },
        ],
      },
    },
    // the one 'large' (vegan) gets price 8->9; the _id:99 filter upserts a new doc
    // seeded from filter equality (_id:99, type:'hawaiian') + $set price:5.
    expect: [
      { _id: 0, type: 'pepperoni', size: 'small',  price: 4 },
      { _id: 1, type: 'cheese',    size: 'medium', price: 7 },
      { _id: 2, type: 'vegan',     size: 'large',  price: 9 },
      { _id: 99, type: 'hawaiian', price: 5 },
    ],
    real: 'exact',
    docs: false,
  },

];
