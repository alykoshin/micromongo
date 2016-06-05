/**
 * Created by alykoshin on 26.05.16.
 */

"use strict";

// http://stackoverflow.com/questions/33100418/find-in-array-of-objects-as-in-a-separate-collection

var mm = require('../');
//var mm = require('micromongo');

function ISODate(s) { return new Date(s); }

var log = [{
  "operation": "trade",
  "date": ISODate("2010-11-12T17:59:04.332+03:00")
}, {
  "operation": "sell",
  "date": ISODate("2011-11-14T08:53:22.937+03:00")
}, {
  "operation": "buy",
  "date": ISODate("2014-11-14T12:44:37.202+03:00")
}, {
  "operation": "sell",
  "date": ISODate("2012-11-15T12:32:40.910+03:00")
}, {
  "operation": "buy",
  "date": ISODate("2013-11-17T17:43:15.705+03:00")
}, {
  "operation": "trade",
  "date": ISODate("2018-11-18T08:51:42.518+03:00")
}];


//console.log(log);

var sorted = mm.aggregate(log, [
  { $sort: { date: -1 } },
  { $limit: 1 }
]);


console.log(sorted);


// Using data from mongodb



//var mm = require('micromongo');
var MongoClient = require('mongodb').MongoClient;

var url = 'mongodb://localhost:27017/test';

MongoClient.connect(url, function(err, db) {
  console.log("Connected succesfully to server");

  db.collection('logger').findOne({}, function(err, doc) {
    var log = doc.log;

    var sorted = mm.aggregate(log, [
      { $sort: { date: -1 } }
    ]);

    console.log(sorted);
    db.close()
  });
});

