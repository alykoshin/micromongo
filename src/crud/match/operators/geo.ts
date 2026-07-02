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

import type { Document, Query } from '../../../types';


// See operators/bitwise.ts for the register(reg) + self-call + `export =` convention.
function register(reg: any): void {
  reg.registerOperator('post', '$geoWithin', function (doc: any /* value (point) */, query: Query) {
    var pt = geo.asPoint(doc);
    if (!pt) { return false; }
    if (query.$box)          { return geo.pointInBox(pt, query.$box); }
    if (query.$center)       { return geo.pointInCircle(pt, query.$center[0], query.$center[1]); }
    if (query.$centerSphere) { return geo.pointInCircleSphere(pt, query.$centerSphere[0], query.$centerSphere[1]); }
    if (query.$polygon)      { return geo.pointInPolygon(pt, query.$polygon); }
    if (query.$geometry)     { return h._geoWithinGeometry(pt, query.$geometry); }
    throw new Error('$geoWithin requires one of $box, $center, $centerSphere, $polygon, $geometry');
  });

  reg.registerOperator('post', '$geoIntersects', function (doc: any /* value (point) */, query: Query) {
    // For point-valued fields, "intersects a polygon" == "within that polygon".
    var pt = geo.asPoint(doc);
    if (!pt) { return false; }
    if (query.$geometry) { return h._geoWithinGeometry(pt, query.$geometry); }
    throw new Error('$geoIntersects requires $geometry');
  });

  reg.registerOperator('post', '$near', function (doc: any /* value (point) */, operand: any /* value */, options: any /* value */, siblings: Document) {
    return h._near(doc, operand, siblings, 'planar'); // legacy = planar; GeoJSON form handled inside
  });

  reg.registerOperator('post', '$nearSphere', function (doc: any /* value (point) */, operand: any /* value */, options: any /* value */, siblings: Document) {
    return h._near(doc, operand, siblings, 'spherical');
  });

  // Shape / sub-operands: consumed by the operators above. Inert if dispatched
  // directly (mirrors $options) so they never throw inside an implicit $and.
  var inert = function () { return true; };
  reg.registerOperator('post', '$geometry',    inert);
  reg.registerOperator('post', '$minDistance', inert);
  reg.registerOperator('post', '$maxDistance', inert);
  reg.registerOperator('post', '$center',      inert);
  reg.registerOperator('post', '$centerSphere', inert);
  reg.registerOperator('post', '$box',         inert);
  reg.registerOperator('post', '$polygon',     inert);
  reg.registerOperator('post', '$uniqueDocs',  inert);
}

register(registry);
export = register;
