/**
 * Upsert + $setOnInsert — ported VERBATIM from the official MongoDB manual.
 *
 * Sources:
 *   https://www.mongodb.com/docs/manual/reference/method/db.collection.updateOne/
 *     (the "Pizza Rat's Pizzaria" upsert example and the $gt-filter upsert example)
 *   https://www.mongodb.com/docs/manual/reference/operator/update/setOnInsert/
 *
 * micromongo specifics that mirror the server semantics:
 *   - the inserted document is built from the query's EQUALITY fields + the update
 *     operators (+ $setOnInsert); query operators ($gt, …) contribute nothing.
 *   - the report carries { matchedCount:0, modifiedCount:0, upsertedId, upsertedCount:1 }.
 *   - if a doc matches, $setOnInsert is a no-op (a normal update happens) and no
 *     upsertedCount is reported.
 *   - when the upsert document has no _id, micromongo generates one (the ObjectId
 *     stub is identity); these tests always supply _id where the doc example does.
 */

'use strict';

/* globals describe, it */

var chai = require('chai');
var expect = chai.expect;

var mm = require('../../dist/');


describe('# upsert - mongo docs', function () {

  it('# updateOne upsert fills the new doc from filter + update operators', function () {
    // https://www.mongodb.com/docs/manual/reference/method/db.collection.updateOne/
    var restaurant = [];
    var res = mm.updateOne(
      restaurant,
      { name: "Pizza Rat's Pizzaria" },
      { $set: { _id: 4, violations: 7, borough: 'Manhattan' } },
      { upsert: true }
    );
    expect(res).eql({
      acknowledged: true,
      matchedCount: 0,
      modifiedCount: 0,
      upsertedId: 4,
      upsertedCount: 1,
    });
    // The `name` field came from the filter; the rest from the update operators.
    expect(restaurant).eql([
      { _id: 4, name: "Pizza Rat's Pizzaria", violations: 7, borough: 'Manhattan' },
    ]);
  });

  it('# upsert with a query operator inserts only the update criteria (+ generated _id)', function () {
    // https://www.mongodb.com/docs/manual/reference/method/db.collection.updateOne/
    var restaurant = [];
    var res = mm.updateOne(
      restaurant,
      { violations: { $gt: 10 } }, // operator filter contributes no fields
      { $set: { Closed: true } },
      { upsert: true }
    );
    expect(res.upsertedCount).eql(1);
    expect(res.matchedCount).eql(0);
    expect(restaurant.length).eql(1);
    expect(restaurant[0].Closed).eql(true);
    expect(restaurant[0]).to.not.have.property('violations'); // $gt did NOT seed a field
    expect(restaurant[0]).to.have.property('_id');            // generated
    expect(res.upsertedId).eql(restaurant[0]._id);
  });

  it('# $setOnInsert applies on insert', function () {
    // https://www.mongodb.com/docs/manual/reference/operator/update/setOnInsert/
    var products = [];
    mm.updateOne(
      products,
      { _id: 1 },
      { $set: { item: 'apple' }, $setOnInsert: { defaultQty: 100 } },
      { upsert: true }
    );
    expect(products).eql([ { _id: 1, item: 'apple', defaultQty: 100 } ]);
  });

  it('# $setOnInsert is a no-op when the upsert matches (update, not insert)', function () {
    var products = [ { _id: 1, item: 'apple', defaultQty: 100 } ];
    var res = mm.updateOne(
      products,
      { _id: 1 },
      { $set: { item: 'pear' }, $setOnInsert: { defaultQty: 999 } },
      { upsert: true }
    );
    // matched => normal update; $setOnInsert did nothing; no upsertedCount.
    expect(res.matchedCount).eql(1);
    expect(res).to.not.have.property('upsertedCount');
    expect(products).eql([ { _id: 1, item: 'pear', defaultQty: 100 } ]);
  });

  it('# upsert that matches behaves as a normal update (no insert)', function () {
    var coll = [ { _id: 7, item: 'apple' } ];
    var res = mm.updateOne(coll, { _id: 7 }, { $set: { item: 'fig' } }, { upsert: true });
    expect(res.matchedCount).eql(1);
    expect(res.modifiedCount).eql(1);
    expect(res).to.not.have.property('upsertedId');
    expect(coll).eql([ { _id: 7, item: 'fig' } ]);
  });

  it('# without upsert, no match is a no-op (matchedCount 0, nothing inserted)', function () {
    var coll = [];
    var res = mm.updateOne(coll, { _id: 1 }, { $set: { x: 1 } }); // no { upsert:true }
    expect(res).eql({ acknowledged: true, matchedCount: 0, modifiedCount: 0 });
    expect(coll).eql([]);
  });

  it('# updateMany upsert inserts one doc when nothing matches', function () {
    var coll = [];
    var res = mm.updateMany(coll, { tag: 'x' }, { $set: { seen: true } }, { upsert: true });
    expect(res.matchedCount).eql(0);
    expect(res.upsertedCount).eql(1);
    expect(coll).eql([ { tag: 'x', seen: true, _id: coll[0]._id } ]);
  });

  it('# replaceOne upsert inserts the replacement seeded with the filter equality', function () {
    var coll = [];
    var res = mm.replaceOne(coll, { _id: 5 }, { name: 'new' }, { upsert: true });
    expect(res.upsertedCount).eql(1);
    expect(res.upsertedId).eql(5);
    expect(coll).eql([ { name: 'new', _id: 5 } ]);
  });
});
