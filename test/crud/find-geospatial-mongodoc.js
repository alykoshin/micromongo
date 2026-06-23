/**
 * Geospatial query operators — tests ported from official MongoDB manual examples.
 *
 * Sources:
 *   $geoWithin: https://www.mongodb.com/docs/manual/reference/operator/query/geoWithin/
 *   $near:      https://www.mongodb.com/docs/manual/reference/operator/query/near/
 *
 * micromongo supports legacy coordinate pairs [x, y] and GeoJSON Points/Polygons,
 * with planar (legacy) and spherical (haversine) distance. BinData / index-backed
 * behavior is not modeled. Coordinate order is [longitude, latitude].
 */

'use strict';

/* globals describe, it */

var chai = require('chai');
var expect = chai.expect;

var crud = require('../../lib/crud/');

function ids(res) { return res.map(function (d) { return d._id; }); }


describe('# Geospatial Query Operators - mongo docs', function () {

  // From the $geoWithin doc page.
  var places = [
    { _id: 1, loc: [ 2, 2 ] },
    { _id: 2, loc: [ 5, 5 ] },
    { _id: 3, loc: [ 8, 8 ] },
    { _id: 4, loc: [ 12, 12 ] },
  ];

  describe('# $geoWithin', function () {

    it('# $box', function () {
      var r = crud.find(places, { loc: { $geoWithin: { $box: [ [ 0, 0 ], [ 10, 10 ] ] } } });
      expect(ids(r)).eql([ 1, 2, 3 ]);
    });

    it('# $center (circle radius 3 at [5,5])', function () {
      var r = crud.find(places, { loc: { $geoWithin: { $center: [ [ 5, 5 ], 3 ] } } });
      expect(ids(r)).eql([ 2 ]);
    });

    it('# $polygon (triangle)', function () {
      var r = crud.find(places, { loc: { $geoWithin: { $polygon: [ [ 0, 0 ], [ 3, 6 ], [ 6, 1 ], [ 0, 0 ] ] } } });
      expect(ids(r)).contains(1);
      expect(ids(r)).not.contains(4);
    });

    it('# $geometry (GeoJSON Polygon)', function () {
      var r = crud.find(places, { loc: { $geoWithin: { $geometry: {
        type: 'Polygon',
        coordinates: [ [ [ 0, 0 ], [ 0, 10 ], [ 10, 10 ], [ 10, 0 ], [ 0, 0 ] ] ],
      } } } });
      expect(ids(r)).eql([ 1, 2, 3 ]);
    });

  });

  describe('# $near (legacy, planar)', function () {

    // From the $near doc page (Café A is the query point; D is beyond $maxDistance).
    var cafes = [
      { _id: 1, name: 'A', location: [ -73.96, 40.78 ] },
      { _id: 2, name: 'B', location: [ -73.965, 40.781 ] },
      { _id: 3, name: 'C', location: [ -73.955, 40.775 ] },
      { _id: 4, name: 'D', location: [ -73.98, 40.79 ] },
    ];

    it('# $maxDistance excludes points beyond the radius', function () {
      var r = crud.find(cafes, { location: { $near: [ -73.96, 40.78 ], $maxDistance: 0.01 } });
      var names = r.map(function (d) { return d.name; });
      expect(names).contains('A');
      expect(names).not.contains('D'); // distance ~0.0141 > 0.01
    });

  });

});
