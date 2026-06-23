/**
 * Geospatial math helpers for the $geo* query operators.
 *
 * Supports both coordinate conventions MongoDB accepts:
 *   - legacy coordinate pairs:  [x, y]           (planar geometry)
 *   - GeoJSON:                  { type, coordinates }
 *
 * Distances:
 *   - planar (legacy):  Euclidean, in coordinate units (used by $center, legacy $near)
 *   - spherical:        haversine, great-circle, in radians ($centerSphere) or
 *                       meters (GeoJSON $near/$nearSphere)
 *
 * Coordinate order is [longitude, latitude] throughout, per MongoDB.
 */

'use strict';

var EARTH_RADIUS_M = 6378137; // meters (WGS-84 equatorial), for GeoJSON distances
var DEG2RAD = Math.PI / 180;


/**
 * Extract a [x, y] point from a stored location value: a legacy pair [x, y],
 * a {lng,lat}-style object, or a GeoJSON Point. Returns null if not a point.
 */
function asPoint(loc: any): any {
  if (Array.isArray(loc) && loc.length >= 2 &&
      typeof loc[0] === 'number' && typeof loc[1] === 'number') {
    return [ loc[0], loc[1] ];
  }
  if (loc && typeof loc === 'object') {
    if (loc.type === 'Point' && Array.isArray(loc.coordinates)) {
      return [ loc.coordinates[0], loc.coordinates[1] ];
    }
    // {x,y} / {lng,lat} / {lon,lat} object forms
    var keys = Object.keys(loc);
    if (keys.length === 2 &&
        typeof loc[keys[0]] === 'number' && typeof loc[keys[1]] === 'number') {
      return [ loc[keys[0]], loc[keys[1]] ];
    }
  }
  return null;
}


/** Euclidean (planar) distance between two [x,y] points, in coordinate units. */
function planarDistance(a: any, b: any): number {
  var dx = a[0] - b[0];
  var dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}


/**
 * Great-circle distance between two [lng,lat] points (degrees), in RADIANS.
 * Multiply by an earth radius to get a length.
 */
function haversineRadians(a: any, b: any): number {
  var lon1 = a[0] * DEG2RAD, lat1 = a[1] * DEG2RAD;
  var lon2 = b[0] * DEG2RAD, lat2 = b[1] * DEG2RAD;
  var dLat = lat2 - lat1, dLon = lon2 - lon1;
  var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Spherical distance in meters between two [lng,lat] points. */
function sphericalMeters(a: any, b: any): number {
  return haversineRadians(a, b) * EARTH_RADIUS_M;
}


/** Is point [x,y] inside the axis-aligned box [[minX,minY],[maxX,maxY]]? */
function pointInBox(pt: any, box: any): boolean {
  var minX = Math.min(box[0][0], box[1][0]);
  var maxX = Math.max(box[0][0], box[1][0]);
  var minY = Math.min(box[0][1], box[1][1]);
  var maxY = Math.max(box[0][1], box[1][1]);
  return pt[0] >= minX && pt[0] <= maxX && pt[1] >= minY && pt[1] <= maxY;
}


/**
 * Ray-casting point-in-polygon test. `polygon` is an array of [x,y] vertices
 * (the ring; a repeated closing vertex is fine). Boundary points count as inside.
 */
function pointInPolygon(pt: any, polygon: any): boolean {
  var x = pt[0], y = pt[1];
  var inside = false;
  for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    var xi = polygon[i][0], yi = polygon[i][1];
    var xj = polygon[j][0], yj = polygon[j][1];
    var intersect = ((yi > y) !== (yj > y)) &&
                    (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) { inside = !inside; }
  }
  return inside;
}


/** Is point within `radius` (planar units) of `center`? */
function pointInCircle(pt: any, center: any, radius: any): boolean {
  return planarDistance(pt, center) <= radius;
}

/** Is point within `radiusRadians` (great-circle) of `center` [lng,lat]? */
function pointInCircleSphere(pt: any, center: any, radiusRadians: any): boolean {
  return haversineRadians(pt, center) <= radiusRadians;
}


export = {
  EARTH_RADIUS_M: EARTH_RADIUS_M,
  asPoint: asPoint,
  planarDistance: planarDistance,
  haversineRadians: haversineRadians,
  sphericalMeters: sphericalMeters,
  pointInBox: pointInBox,
  pointInPolygon: pointInPolygon,
  pointInCircle: pointInCircle,
  pointInCircleSphere: pointInCircleSphere,
};
