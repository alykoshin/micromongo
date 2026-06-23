/**
 * $group aggregation stage — ported from the official MongoDB manual example.
 * Source: https://www.mongodb.com/docs/manual/reference/operator/aggregation/group/
 */

'use strict';

/* globals describe, it */

var chai = require('chai');
var expect = chai.expect;

var mm = require('../../dist/');


describe('# $group - mongo docs', function () {

  var movies = [
    { _id: 1, title: 'The Kiss', year: 1896, runtime: 1 },
    { _id: 2, title: 'The Kiss', year: 1896, runtime: 1 },
    { _id: 3, title: 'The Great Train Robbery', year: 1903, runtime: 11 },
    { _id: 4, title: 'A Corner in Wheat', year: 1909, runtime: 14 },
  ];

  it('# group by year with $sum, $avg, count, $push', function () {
    var res = mm.aggregate(movies, [
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
    ]);
    expect(res).eql([
      { _id: 1896, totalRuntime: 2, averageRuntime: 1, count: 2, titles: [ 'The Kiss', 'The Kiss' ] },
      { _id: 1903, totalRuntime: 11, averageRuntime: 11, count: 1, titles: [ 'The Great Train Robbery' ] },
      { _id: 1909, totalRuntime: 14, averageRuntime: 14, count: 1, titles: [ 'A Corner in Wheat' ] },
    ]);
  });

  it('# _id: null aggregates all documents into one group', function () {
    var res = mm.aggregate(movies, [
      { $group: { _id: null, totalRuntime: { $sum: '$runtime' }, count: { $count: {} } } },
    ]);
    expect(res).eql([ { _id: null, totalRuntime: 27, count: 4 } ]);
  });

});
