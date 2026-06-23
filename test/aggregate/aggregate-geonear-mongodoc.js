/**
 * $geoNear aggregation stage — ported from the official MongoDB manual example.
 * Source: https://www.mongodb.com/docs/manual/reference/operator/aggregation/geoNear/
 *
 * Filters by distance (and optional query), sorts nearest-first, and writes the
 * computed distance into `distanceField`. Spherical distance is haversine radians
 * (no index, no meters conversion beyond distanceMultiplier).
 */

'use strict';

/* globals describe, it */

var chai = require('chai');
var expect = chai.expect;

var mm = require('../../lib/');


describe('# $geoNear - mongo docs', function () {

  var places = [
    { _id: 7, name: 'Central Park',
      location: { type: 'Point', coordinates: [ -73.97, 40.77 ] }, category: 'Parks' },
    { _id: 8, name: 'Sara D. Roosevelt Park',
      location: { type: 'Point', coordinates: [ -73.9928, 40.7193 ] }, category: 'Parks' },
    { _id: 9, name: 'Polo Grounds',
      location: { type: 'Point', coordinates: [ -73.9375, 40.8303 ] }, category: 'Stadiums' },
  ];

  it('# filters by query, sorts by distance, adds distanceField', function () {
    var res = mm.aggregate(places, [ { $geoNear: {
      near: { type: 'Point', coordinates: [ -73.99279, 40.719296 ] },
      distanceField: 'dist.calculated',
      spherical: true,
      query: { category: 'Parks' },
    } } ]);

    // Only Parks, nearest first (Sara D. Roosevelt is closest to the near point).
    expect(res.map(function (d) { return d.name; }))
      .eql([ 'Sara D. Roosevelt Park', 'Central Park' ]);
    // distanceField written (dotted path) and ascending.
    expect(res[0].dist.calculated).a('number');
    expect(res[0].dist.calculated).below(res[1].dist.calculated);
  });

  it('# legacy coordinates use planar distance', function () {
    var pts = [ { _id: 1, loc: [ 0, 0 ] }, { _id: 2, loc: [ 3, 4 ] }, { _id: 3, loc: [ 10, 10 ] } ];
    var res = mm.aggregate(pts, [ { $geoNear: { near: [ 0, 0 ], distanceField: 'd', key: 'loc' } } ]);
    expect(res.map(function (d) { return d._id; })).eql([ 1, 2, 3 ]);
    expect(res[1].d).eql(5); // [3,4] from origin
  });

});
