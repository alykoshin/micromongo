/**
 * Match-engine helpers — the array/scalar "contains or equals" family, deep
 * equality, the $bits bitmask helpers, and the geo shape helpers.
 *
 * These implement Mongo's "match if scalar equals OR array contains" rules, with
 * options.all / options.any / options.sameOrder / options.regex flags. This is
 * where most array-query subtleties (and bugs) concentrate. Extracted verbatim
 * from the original single-file match.js; behavior is unchanged.
 *
 * `_eql` and `_arrayEqlOrElementEql` are re-exported on the public match facade
 * (the test suite imports them directly).
 */

'use strict';

var assert = require('assert');
var _ = require('lodash');

var dbg = require('./debug');
var DEBUG = dbg.DEBUG;
var debug = dbg.debug;

var geo = require('../geo');


function xor(a, b) {
  return ( a || b ) && !( a && b );
}


/**
 * Check if object `target` contains any or all properties and values of object `source` (deeply)
 * or equals if scalar
 *
 * @param {Object} target
 * @param {Object} source
 * @param {Object} options
 * @param {boolean} [options.all]
 * @param {boolean} [options.any]
 * @param {boolean} [options.sameOrder] - require arrays elements to have same positions
 * @param {boolean} [options.regex]   - allow regex in query
 * @returns {boolean}
 * @private
 */
function _contains(target, source, options) {
  if (DEBUG) debug('_contains(): target: ' + JSON.stringify(target) + ', source: ' + JSON.stringify(source) + ', options: ' + JSON.stringify(options));
  assert(xor(options.any, options.all), 'options any and all are mutually exclusive');

  if (options.regex && source instanceof RegExp) {
    return typeof target === 'string' && source.test(target);
  }

  // if values has different types, return false
  if (typeof target !== typeof source || Array.isArray(target) !== Array.isArray(source)) { if (DEBUG) debug('_contains(): target and source has different types'); return false; }

  // if scalars
  if (['undefined', 'boolean', 'number', 'string'].indexOf(typeof target)>=0 || target === null ) {
    if (DEBUG) debug('_contains(): ('+JSON.stringify(target)+'==='+JSON.stringify(source)+') = ' + (target === source));
    return target === source; // compare scalars
  }

  // if objects (including arrays)
  // try to find each element of source in target
  // independently of their position inside array
  var contains;
  if (!options.sameOrder && Array.isArray(target) ) {
    for (var slen=source.length, si=0; si<slen; ++si) {
      for (var tlen=target.length, ti=0; ti<tlen; ++ti) {
        // non-existing property is same as undefined
        contains = _contains(target[ti], source[si], options);
        if (options.any && contains) { if (DEBUG) debug('_contains(): array: (options.any && contains): return true'); return true; }
        if (options.all && contains) { break; }
      }
      if (options.all && !contains) { if (DEBUG) debug('_contains(): array: (options.any && !contains): return false'); return false; }
    }

  } else { // if objects
    // iterate all the props of source and check if each of them exists in target
    for (var p in source) { if (source.hasOwnProperty(p)) {
      // non-existing property is same as undefined
      contains = _contains(target[p], source[p], options);
      if (options.any && contains) { if (DEBUG) debug('_contains(): object: (options.any && contains): return true'); return true; }
      else if (options.all && !contains) { if (DEBUG) debug('_contains(): object: (options.any && contains): return true'); return false; }
    }}
  }

  var res = !!options.all;
  if (DEBUG) debug('_contains(): return '+res);
  return res;
}

/**
 * Check if object `target` contains all properties and values of object `source` (deeply)
 * or equals if scalar
 * @private
 */
function _containsAllDeep(target, source, options) {
  options = options || {};
  options.all  = true;
  if (DEBUG) debug('_containsAllDeep: target: '+JSON.stringify(target)+', source: '+JSON.stringify(source));
  return _contains(target, source, options);
}

/**
 * Check if object `target` contains any of properties and values of object `source` (deeply)
 * or equals if scalar
 * @private
 */
function _containsAnyDeep(target, source, options) {
  options = options || {};
  options.any  = true;
  if (DEBUG) debug('_containsAnyDeep: target: '+JSON.stringify(target)+', source: '+JSON.stringify(source));
  return _contains(target, source, options);
}

/**
 * Deep compare.
 */
function _eql(target, source, options) {
  options = options || {};
  if (DEBUG) debug('_eql: target: '+JSON.stringify(target)+', source: '+JSON.stringify(source));
  return _containsAllDeep(target, source, { sameOrder: options.sameOrder }) && _containsAllDeep(source, target, { sameOrder: options.sameOrder });
}


function _arrayEql(target, source, options) {
  options = options || {};
  if (DEBUG) debug('_arrayEql: target: '+JSON.stringify(target)+', source: '+JSON.stringify(source)+', options: '+JSON.stringify(options));

  if (!Array.isArray(target) || !Array.isArray(source)) { return false; }

  return _eql(target, source, options); // arrays are equal
}

function _arrayElementEql(target, source, options) {
  options = options || {};
  if (DEBUG) debug('_arrayEqlOrElementEql: target: '+JSON.stringify(target)+', source: '+JSON.stringify(source)+', options: '+JSON.stringify(options));

  if (!Array.isArray(target) || !Array.isArray(source)) { return false; }

  // Check if one of elements inside `doc`[] array is exactly equal to `query` array
  for (var len=target.length, i=0; i<len; ++i) {
    if (Array.isArray(target[i]) && _eql(target[i], source, options)) { return true; }
  }
  return false;
}

function _arrayEqlOrElementEql(target, source, options) {
  options = options || {};
  if (DEBUG) debug('_arrayEqlOrElementEql: target: '+JSON.stringify(target)+', source: '+JSON.stringify(source)+', options: '+JSON.stringify(options));

  return _arrayEql(target, source, options) || _arrayElementEql(target, source, options);
}


function _arrayContainsAll(target, source, options) {
  options = options || {};
  if (DEBUG) debug('_arrayEql: target: '+JSON.stringify(target)+', source: '+JSON.stringify(source)+', options: '+JSON.stringify(options));

  if (!Array.isArray(target) || !Array.isArray(source)) { return false; }

  return _containsAllDeep(target, source, options); // arrays are equal
}

function _arrayElementContainsAll(target, source, options) {
  options = options || {};
  if (DEBUG) debug('_arrayEqlOrElementEql: target: '+JSON.stringify(target)+', source: '+JSON.stringify(source)+', options: '+JSON.stringify(options));

  if (!Array.isArray(target) || !Array.isArray(source)) { return false; }

  // Check if one of elements inside `doc`[] array contains all elements from `query` array
  for (var len=target.length, i=0; i<len; ++i) {
    if (Array.isArray(target[i]) && _containsAllDeep(target[i], source, options)) { return true; }
  }
  return false;
}

function _arrayOrElementContainsAll(target, source, options) {
  options = options || {};
  if (DEBUG) debug('_arrayEqlOrElementEql: target: '+JSON.stringify(target)+', source: '+JSON.stringify(source)+', options: '+JSON.stringify(options));

  return _arrayContainsAll(target, source, options) || _arrayElementContainsAll(target, source, options);
}


// --- $bits helpers -----------------------------------------------------------

/**
 * Convert a $bits* operand (numeric bitmask or array of bit positions) into a
 * numeric bitmask.
 * @param {number|Array<number>} operand
 * @returns {number} bitmask
 */
function _bitmaskFromOperand(operand) {
  if (typeof operand === 'number') { return operand; }
  if (Array.isArray(operand)) {
    var mask = 0;
    for (var i = 0; i < operand.length; ++i) {
      if (typeof operand[i] !== 'number' || operand[i] < 0) {
        throw new Error('Invalid bit position in $bits operand: ' + JSON.stringify(operand[i]));
      }
      mask |= (1 << operand[i]);
    }
    return mask;
  }
  throw new Error('Invalid syntax near \'' + JSON.stringify(operand) + '\': $bits operand must be a number or an array of bit positions (BinData not supported).');
}

/**
 * Evaluate a $bitsAll/AnySet/Clear query against a numeric field value.
 * @param {*} doc - the field value (must be a number to match)
 * @param {number|Array<number>} operand
 * @param {'allSet'|'anySet'|'allClear'|'anyClear'} mode
 * @returns {boolean}
 */
function _bitsMatch(doc, operand, mode) {
  if (typeof doc !== 'number') { return false; } // non-numeric never matches
  var mask = _bitmaskFromOperand(operand);
  var set = doc & mask;
  switch (mode) {
    case 'allSet':   return set === mask;           // every masked bit is 1
    case 'anySet':   return set !== 0;              // at least one masked bit is 1
    case 'allClear': return set === 0;              // every masked bit is 0
    case 'anyClear': return set !== mask;           // at least one masked bit is 0
    default: throw new Error('Unknown $bits mode: ' + mode);
  }
}


// --- geo helpers -------------------------------------------------------------

/**
 * Is point `pt` within a GeoJSON Polygon / MultiPolygon `geometry`?
 * Uses the outer ring(s); inner rings (holes) are not modeled.
 */
function _geoWithinGeometry(pt, geometry) {
  if (!geometry || typeof geometry !== 'object') { return false; }
  if (geometry.type === 'Polygon') {
    return geo.pointInPolygon(pt, geometry.coordinates[0]); // outer ring
  }
  if (geometry.type === 'MultiPolygon') {
    for (var i = 0; i < geometry.coordinates.length; ++i) {
      if (geo.pointInPolygon(pt, geometry.coordinates[i][0])) { return true; }
    }
    return false;
  }
  throw new Error('$geometry for $geoWithin must be a Polygon or MultiPolygon');
}

/**
 * $near / $nearSphere matcher. Returns whether `doc` (a point) lies in the
 * min/max distance band around the query point. This only FILTERS; sorting by
 * distance is applied by the crud find layer when a $near query is present.
 *
 * @param {*} doc        the stored location (legacy pair or GeoJSON Point)
 * @param {Array|Object} operand  the $near value: [x,y] (legacy) or { $geometry, $maxDistance, $minDistance } (GeoJSON)
 * @param {Object} siblings  the full operator object, carrying $maxDistance/$minDistance for the legacy form
 * @param {'planar'|'spherical'} kind  legacy distance metric
 */
function _near(doc, operand, siblings, kind) {
  var pt = geo.asPoint(doc);
  if (!pt) { return false; }
  siblings = siblings || {};

  var center, min, max, distance;

  if (Array.isArray(operand)) {
    // legacy: operand is the coordinate pair; $min/$maxDistance are siblings
    center = operand;
    min = siblings.$minDistance; max = siblings.$maxDistance;
    distance = (kind === 'spherical') ? geo.haversineRadians(pt, center)
                                      : geo.planarDistance(pt, center);
  } else if (operand && operand.$geometry) {
    var g = operand.$geometry;
    if (g.type !== 'Point') { throw new Error('$near $geometry must be a Point'); }
    center = g.coordinates;
    min = operand.$minDistance; max = operand.$maxDistance;
    distance = geo.sphericalMeters(pt, center); // GeoJSON distances are in meters
  } else {
    throw new Error('$near requires a GeoJSON Point or a legacy coordinate pair');
  }

  if (typeof max === 'number' && distance > max) { return false; }
  if (typeof min === 'number' && distance < min) { return false; }
  return true;
}


module.exports = {
  xor: xor,
  _contains: _contains,
  _containsAllDeep: _containsAllDeep,
  _containsAnyDeep: _containsAnyDeep,
  _eql: _eql,
  _arrayEql: _arrayEql,
  _arrayElementEql: _arrayElementEql,
  _arrayEqlOrElementEql: _arrayEqlOrElementEql,
  _arrayContainsAll: _arrayContainsAll,
  _arrayElementContainsAll: _arrayElementContainsAll,
  _arrayOrElementContainsAll: _arrayOrElementContainsAll,
  _bitmaskFromOperand: _bitmaskFromOperand,
  _bitsMatch: _bitsMatch,
  _geoWithinGeometry: _geoWithinGeometry,
  _near: _near,
};
