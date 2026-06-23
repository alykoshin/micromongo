/**
 * Geospatial query postOperators: $geoWithin, $geoIntersects, $near, $nearSphere,
 * plus the shape / sub-operands ($box / $center / $geometry / $maxDistance / …)
 * which are consumed by their parent operator and inert if dispatched directly.
 *
 * The field value (`doc`) is a point: a legacy [x, y] pair or a GeoJSON Point.
 * Geometry/distance math lives in lib/crud/geo.js and the shared helpers.
 */

'use strict';

var registry = require('../registry');
var geo = require('../../geo');
var h = require('../helpers');


registry.registerOperator('post', '$geoWithin', function (doc: any, query: any) {
  var pt = geo.asPoint(doc);
  if (!pt) { return false; }
  if (query.$box)          { return geo.pointInBox(pt, query.$box); }
  if (query.$center)       { return geo.pointInCircle(pt, query.$center[0], query.$center[1]); }
  if (query.$centerSphere) { return geo.pointInCircleSphere(pt, query.$centerSphere[0], query.$centerSphere[1]); }
  if (query.$polygon)      { return geo.pointInPolygon(pt, query.$polygon); }
  if (query.$geometry)     { return h._geoWithinGeometry(pt, query.$geometry); }
  throw new Error('$geoWithin requires one of $box, $center, $centerSphere, $polygon, $geometry');
});

registry.registerOperator('post', '$geoIntersects', function (doc: any, query: any) {
  // For point-valued fields, "intersects a polygon" == "within that polygon".
  var pt = geo.asPoint(doc);
  if (!pt) { return false; }
  if (query.$geometry) { return h._geoWithinGeometry(pt, query.$geometry); }
  throw new Error('$geoIntersects requires $geometry');
});

registry.registerOperator('post', '$near', function (doc: any, operand: any, options: any, siblings: any) {
  return h._near(doc, operand, siblings, 'planar'); // legacy = planar; GeoJSON form handled inside
});

registry.registerOperator('post', '$nearSphere', function (doc: any, operand: any, options: any, siblings: any) {
  return h._near(doc, operand, siblings, 'spherical');
});

// Shape / sub-operands: consumed by the operators above. Inert if dispatched
// directly (mirrors $options) so they never throw inside an implicit $and.
var inert = function () { return true; };
registry.registerOperator('post', '$geometry',    inert);
registry.registerOperator('post', '$minDistance', inert);
registry.registerOperator('post', '$maxDistance', inert);
registry.registerOperator('post', '$center',      inert);
registry.registerOperator('post', '$centerSphere', inert);
registry.registerOperator('post', '$box',         inert);
registry.registerOperator('post', '$polygon',     inert);
registry.registerOperator('post', '$uniqueDocs',  inert);
