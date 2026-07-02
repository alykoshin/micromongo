/**
 * Created by alykoshin on 26.05.16. Modernized 2026.
 *
 * http://stackoverflow.com/questions/33100418/find-in-array-of-objects-as-in-a-separate-collection
 *
 * Two ways to get "the most recent trade" out of an array of log entries:
 *   1. run micromongo's aggregate directly over the plain array (no server), and
 *   2. pull the array out of a Mongo-shaped source first, then aggregate it.
 *
 * The second half uses `micromongo/mock` — the drop-in `mongodb`-driver-shaped adapter
 * (see README → "MongoDB driver mock") — so this file runs standalone with NO live server.
 * To run against a REAL MongoDB instead, swap the require to `require('mongodb')` and point
 * the URL at your server; the driver-shaped calls below are identical.
 */

'use strict';

var mm = require('../');
// require('micromongo/mock') from another project; in-repo we require the built dist:
var MongoClient = require('../dist/mock').MongoClient;

function ISODate(s) { return new Date(s); }

var log = [
  { operation: 'trade', date: ISODate('2010-11-12T17:59:04.332+03:00') },
  { operation: 'sell',  date: ISODate('2011-11-14T08:53:22.937+03:00') },
  { operation: 'buy',   date: ISODate('2014-11-14T12:44:37.202+03:00') },
  { operation: 'sell',  date: ISODate('2012-11-15T12:32:40.910+03:00') },
  { operation: 'buy',   date: ISODate('2013-11-17T17:43:15.705+03:00') },
  { operation: 'trade', date: ISODate('2018-11-18T08:51:42.518+03:00') },
];

// 1. Aggregate the plain array directly — no server involved.
var mostRecent = mm.aggregate(log, [
  { $sort: { date: -1 } },
  { $limit: 1 },
]);
console.log('Most recent (direct over array):', mostRecent);

// 2. Same, but sourcing the array from a Mongo-shaped store first (mock == driver shape).
async function fromMongo() {
  var client = await MongoClient.connect('mongodb://localhost:27017/test');
  try {
    var coll = client.db().collection('logger');
    await coll.insertOne({ log: log });          // stash the array in a document, Mongo-style

    var doc = await coll.findOne({});
    var sorted = mm.aggregate(doc.log, [{ $sort: { date: -1 } }]);
    console.log('Sorted (via Mongo-shaped source):', sorted);
  } finally {
    await client.close();
  }
}

fromMongo().catch(function (err) { console.error(err); process.exitCode = 1; });
