/**
 * $type query operator — test ported from the official MongoDB manual example.
 * Source: https://www.mongodb.com/docs/manual/reference/operator/query/type/
 *
 * micromongo's $type uses JavaScript typeof-style names ('string', 'number',
 * 'object', 'array', …). The doc's string-alias example maps directly; the
 * BSON-numeric-code and multi-type ('number' alias for double/int/long/decimal)
 * forms are intentionally NOT covered — they have no micromongo equivalent
 * (see docs/compatibility.md → $type).
 */

'use strict';

/* globals describe, it */

var chai = require('chai');
var expect = chai.expect;

var crud = require('../../lib/crud/');


describe('# $type query operator - mongo docs', function () {

  var movies = [
    { _id: 1, title: 'Centennial', runtime: 1256, imdb: { rating: 8.5 } },
    { _id: 2, title: 'Baseball', runtime: 1140, imdb: { rating: 9.1 } },
    { _id: 3, title: 'Coming to Terms', year: 2013, imdb: { rating: '' } },
    { _id: 4, title: 'Absent Minded', year: 2013, imdb: { rating: '' } },
  ];

  it('# Querying by Data Type (string alias)', function () {
    var query = { 'imdb.rating': { $type: 'string' } };
    var projection = { _id: 1, title: 1, 'imdb.rating': 1 };
    expect(crud.find(movies, query, projection)).eql([
      { _id: 3, title: 'Coming to Terms', imdb: { rating: '' } },
      { _id: 4, title: 'Absent Minded', imdb: { rating: '' } },
    ]);
  });

});
