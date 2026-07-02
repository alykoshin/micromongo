'use strict';

/**
 * bulkWrite — execute a batch of heterogeneous writes in one call.
 * The canonical "pizzas" example is ported verbatim from the official docs:
 *   https://www.mongodb.com/docs/manual/reference/method/db.collection.bulkWrite/
 *
 * micromongo-specific behaviors (no Mongo equivalent: in-memory array, no _id
 * auto-gen) get plain unit tests alongside.
 */

var chai = require('chai');
var expect = chai.expect;

var mm = require('../../dist/');

describe('# bulkWrite (mongodoc)', function () {

  // db.pizzas — the docs' starting collection.
  function pizzas() {
    return [
      { _id: 0, type: 'pepperoni', size: 'small',  price: 4 },
      { _id: 1, type: 'cheese',    size: 'medium', price: 7 },
      { _id: 2, type: 'vegan',     size: 'large',  price: 8 },
    ];
  }

  it('# the canonical pizzas batch returns the documented BulkWriteResult', function () {
    var arr = pizzas();
    // Verbatim operation array from the docs.
    var res = mm.bulkWrite(arr, [
      { insertOne: { document: { _id: 3, type: 'beef',    size: 'medium', price: 6 } } },
      { insertOne: { document: { _id: 4, type: 'sausage', size: 'large',  price: 10 } } },
      { updateOne: { filter: { type: 'cheese' }, update: { $set: { price: 8 } } } },
      { deleteOne: { filter: { type: 'pepperoni' } } },
      { replaceOne: { filter: { type: 'vegan' }, replacement: { type: 'tofu', size: 'small', price: 4 } } },
    ]);

    expect(res.acknowledged).eql(true);
    expect(res.insertedCount).eql(2);
    expect(res.insertedIds).eql({ 0: 3, 1: 4 });
    expect(res.matchedCount).eql(2);   // cheese (update) + vegan (replace)
    expect(res.modifiedCount).eql(2);
    expect(res.deletedCount).eql(1);   // pepperoni
    expect(res.upsertedCount).eql(0);
    expect(res.upsertedIds).eql({});

    // And the array reflects every write.
    expect(arr.map(function (d) { return d.type; }).sort())
      .eql([ 'beef', 'cheese', 'sausage', 'tofu' ]); // pepperoni gone, vegan→tofu
    expect(arr.filter(function (d) { return d.type === 'cheese'; })[0].price).eql(8);
  });

  it('# updateMany + upsert contribute to matched/modified/upserted counts', function () {
    var arr = pizzas();
    var res = mm.bulkWrite(arr, [
      { updateMany: { filter: { size: 'large' }, update: { $inc: { price: 1 } } } },
      { updateOne: { filter: { _id: 99, type: 'hawaiian' }, update: { $set: { price: 5 } }, upsert: true } },
    ]);
    expect(res.matchedCount).eql(1);     // one 'large' (vegan)
    expect(res.modifiedCount).eql(1);
    expect(res.upsertedCount).eql(1);
    expect(res.upsertedIds).to.have.property('1'); // op index 1 upserted
    expect(arr.some(function (d) { return d._id === 99 && d.price === 5; })).eql(true);
  });

  it('# ordered (default): stops at first error, preceding writes persist', function () {
    var arr = [ { _id: 1, type: 'cheese' } ];
    expect(function () {
      mm.bulkWrite(arr, [
        { insertOne: { document: { _id: 5, type: 'beef' } } },
        { updateOne: { filter: { type: 'cheese' }, update: { notAnOperator: 1 } } }, // throws (replacement, not operators)
        { insertOne: { document: { _id: 6, type: 'sausage' } } }, // must NOT run
      ]);
    }).to.throw();
    expect(arr.some(function (d) { return d._id === 5; })).eql(true);  // first insert persisted
    expect(arr.some(function (d) { return d._id === 6; })).eql(false); // third skipped
  });

  it('# ordered:false: every op attempted, errors collected into writeErrors', function () {
    var arr = [ { _id: 1, type: 'cheese' } ];
    var res = mm.bulkWrite(arr, [
      { insertOne: { document: { _id: 5, type: 'beef' } } },
      { updateOne: { filter: { type: 'cheese' }, update: { notAnOperator: 1 } } }, // errors
      { insertOne: { document: { _id: 6, type: 'sausage' } } }, // still runs
    ], { ordered: false });

    expect(res.insertedCount).eql(2); // both inserts ran despite the middle error
    expect(res.writeErrors).to.have.length(1);
    expect(res.writeErrors[0].index).eql(1);
    expect(arr.some(function (d) { return d._id === 6; })).eql(true);
  });

  it('# rejects an operation that is not exactly one known write kind', function () {
    expect(function () {
      mm.bulkWrite([], [ { insertOne: { document: {} }, deleteOne: { filter: {} } } ]);
    }).to.throw(/exactly one/);
    expect(function () {
      mm.bulkWrite([], [ { frobnicate: {} } ]);
    }).to.throw(/exactly one/);
  });

});
