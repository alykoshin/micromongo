/**
 * Created by alykoshin on 30.03.16.
 */

'use strict';

var assert = require('assert');
var util = require('util');
var vm = require('vm');
var _ = require('lodash');
//var deepAssign = require('mini-deep-assign');

var settings = require('../settings');
var geo = require('./geo');
var textSearch = require('./text');

var DEBUG = false;

if (DEBUG) {
  var debug = function (/*arguments*/) {
    console.log.apply(this, arguments);
  };
}


//var _Query = function(query) {
//  //this.value = query;
//  deepAssign(this, query);
//};
//
//_Query.prototype._prepared = true;


//var whereCache = {};


var xor = function(a, b) {
  return ( a || b ) && !( a && b );
};


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

  //// special case for Buffer class objects
  //// not required as their comparison is correct
  ////
  //if (target instanceof Buffer && source instanceof Buffer) {
  //  var res = Buffer.compare(target, source) === 0;
  ////  var res = target.includes(source,0);
  //  console.log('BUFFER!!!', target, source, res);
  //  return res;
  //}

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
 *
 * @param {Object} target
 * @param {Object} source
 * @param {Object} options
 * @returns {boolean}
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
 *
 * @param {Object} target
 * @param {Object} source
 * @param {Object} options
 * @returns {boolean}
 * @private
 */
function _containsAnyDeep(target, source, options) {
  options = options || {};
  options.any  = true;
  if (DEBUG) debug('_containsAnyDeep: target: '+JSON.stringify(target)+', source: '+JSON.stringify(source));
  return _contains(target, source, options);
}

/**
 * Deep compare
 *
 * @param {Object} target
 * @param {Object} source
 * @param {Object} options
 * @param {boolean} options.sameOrder
 * @returns {boolean}
 */
var _eql = function(target, source, options) {
  options = options || {};
  if (DEBUG) debug('_eql: target: '+JSON.stringify(target)+', source: '+JSON.stringify(source));
  return _containsAllDeep(target, source, { sameOrder: options.sameOrder }) && _containsAllDeep(source, target, { sameOrder: options.sameOrder });
};


var _arrayEql = function(target, source, options) {
  options = options || {};
  if (DEBUG) debug('_arrayEql: target: '+JSON.stringify(target)+', source: '+JSON.stringify(source)+', options: '+JSON.stringify(options));

  if (!Array.isArray(target) || !Array.isArray(source)) { return false; }

  return _eql(target, source, options); // arrays are equal
};

var _arrayElementEql = function(target, source, options) {
  options = options || {};
  if (DEBUG) debug('_arrayEqlOrElementEql: target: '+JSON.stringify(target)+', source: '+JSON.stringify(source)+', options: '+JSON.stringify(options));

  if (!Array.isArray(target) || !Array.isArray(source)) { return false; }

  // Check if one of elements inside `doc`[] array is exactly equal to `query` array
  for (var len=target.length, i=0; i<len; ++i) {
    if (Array.isArray(target[i]) && _eql(target[i], source, options)) { return true; }
  }
  return false;
};

var _arrayEqlOrElementEql = function(target, source, options) {
  options = options || {};
  if (DEBUG) debug('_arrayEqlOrElementEql: target: '+JSON.stringify(target)+', source: '+JSON.stringify(source)+', options: '+JSON.stringify(options));

  return _arrayEql(target, source, options) || _arrayElementEql(target, source, options);
};


var _arrayContainsAll = function(target, source, options) {
  options = options || {};
  if (DEBUG) debug('_arrayEql: target: '+JSON.stringify(target)+', source: '+JSON.stringify(source)+', options: '+JSON.stringify(options));

  if (!Array.isArray(target) || !Array.isArray(source)) { return false; }

  return _containsAllDeep(target, source, options); // arrays are equal
};

var _arrayElementContainsAll = function(target, source, options) {
  options = options || {};
  if (DEBUG) debug('_arrayEqlOrElementEql: target: '+JSON.stringify(target)+', source: '+JSON.stringify(source)+', options: '+JSON.stringify(options));

  if (!Array.isArray(target) || !Array.isArray(source)) { return false; }

  // Check if one of elements inside `doc`[] array contains all elements from `query` array
  for (var len=target.length, i=0; i<len; ++i) {
    if (Array.isArray(target[i]) && _containsAllDeep(target[i], source, options)) { return true; }
  }
  return false;
};

var _arrayOrElementContainsAll = function(target, source, options) {
  options = options || {};
  if (DEBUG) debug('_arrayEqlOrElementEql: target: '+JSON.stringify(target)+', source: '+JSON.stringify(source)+', options: '+JSON.stringify(options));

  return _arrayContainsAll(target, source, options) || _arrayElementContainsAll(target, source, options);
};


/**
 * Convert a $bits* operand (numeric bitmask or array of bit positions) into a
 * numeric bitmask.
 * @param {number|Array<number>} operand
 * @returns {number} bitmask
 */
var _bitmaskFromOperand = function(operand) {
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
};

/**
 * Evaluate a $bitsAll/AnySet/Clear query against a numeric field value.
 * @param {*} doc - the field value (must be a number to match)
 * @param {number|Array<number>} operand
 * @param {'allSet'|'anySet'|'allClear'|'anyClear'} mode
 * @returns {boolean}
 */
var _bitsMatch = function(doc, operand, mode) {
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
};


/**
 * Is point `pt` within a GeoJSON Polygon / MultiPolygon `geometry`?
 * Uses the outer ring(s); inner rings (holes) are not modeled.
 */
var _geoWithinGeometry = function(pt, geometry) {
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
};

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
var _near = function(doc, operand, siblings, kind) {
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
};


var preOperators = {

  // $text matches the WHOLE document (all string fields). `query` is the operand,
  // e.g. { $search: "coffee shop" }. The relevance score is stashed (keyed by the
  // document) so a $meta:"textScore" projection can retrieve it.
  $text: function(doc, query) {
    if (!query || typeof query.$search !== 'string') {
      throw new Error('$text requires { $search: <string> }');
    }
    var res = textSearch(doc, query.$search);
    if (res.match) { textSearch.setScore(doc, res.score); }
    return res.match;
  },

  $and: function(doc, query) {
    if (DEBUG) debug('$and: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
    assert(Array.isArray(query), 'Invalid syntax near \''+JSON.stringify(query)+'\': parameter for $and must be array.');
    // iterate the array
    for (var len=query.length, i=0; i<len; ++i) {
      var q1 = query[i];
      var res = _match1.call(this, doc, q1);
      if (DEBUG) debug('$and: q1: ' + JSON.stringify(q1) + ', res: ' +JSON.stringify(res));
      if (!res) {
        return false;
      }
    }
    return true;
  },

  $or: function(doc, query) {
    if (DEBUG) debug('$or: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
    assert(Array.isArray(query), 'Invalid syntax near \''+JSON.stringify(query)+'\': parameter for $or must be array.');
    // iterate the array
    for (var len=query.length, i=0; i<len; ++i) {
      var q1 = query[i];
      //console.log('$or: q1', q1);
      var res = _match1.call(this, doc, q1);
      if (DEBUG) debug('$or: q1:', q1, ', res', res);
      if (res) {
        return true;
      }
    }
    return false;
  },

  //$not: function(doc, query) {
  //  //console.log('$not: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
  //  var res = ! _match.call(this, doc, query);
  //  //console.log('$not: res: '+res);
  //  return res;
  //},
  //
  $nor: function(doc, query) {
    //console.log('$nor: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
    assert(Array.isArray(query), 'Invalid syntax near \''+JSON.stringify(query)+'\': parameter for $nor must be array.');
    // iterate the array
    for (var len=query.length, i=0; i<len; ++i) {
      var q1 = query[i];
      //console.log('$or: q1', q1);
      var res = _match1.call(this, doc, q1);
      //console.log('$or: res', res);
      if (res) {
        return false;
      }
    }
    return true;
  },

  $where: function(doc, query) {

    var sandbox = { this: this, obj: this };
    vm.createContext(sandbox);

    var script;
    //if (!whereCache[query]) {
      var fn;
      if (typeof query === 'string') {
        fn =
          'function() { ' +
          '  return ' + query + '' +
          '}';

      } else if (typeof query === 'function') {
        fn = query.toString();

      } else {
        throw new TypeError('Invalid syntax near \'' + JSON.stringify(query) + '\': parameter for $where must be string or function.');
      }

      var code =
            '(' +
            fn +
            ').call(this.this)';

      // Read at use so `mm.configure({ whereTimeout })` takes effect.
      var WHERE_TIMEOUT = settings.whereTimeout;
      script        = new vm.Script(code, { /*produceCachedData: true,*/ timeout: WHERE_TIMEOUT });
      //whereCache[query] = script;

    //} else {
    //  script = whereCache[query];
    //}

    //return vm.runInContext(code, sandbox);
    return script.runInContext(sandbox);
  },

  //$comment: function(doc, query) {
  //  console.log(query);
  //},

};

var postOperators = {

  $not: function(doc, query) {
    if (DEBUG) debug('$not: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
    var res = ! doExpr.call(this, doc, query);
    //console.log('$not: res: '+res);
    return res;
  },

  // Comparison postOperators

  $eq: function(doc, query) {
    if (DEBUG) debug('$eq: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
    if (Array.isArray(doc)) {
      if (Array.isArray(query))  {
        // check if arrays are the same or one of the elements
        // in `doc`'s array is same as `query` array
        return _arrayEqlOrElementEql(doc, query, { sameOrder: true });
      } else {
        // check if array in `doc` contains element
        return _containsAnyDeep(doc, [query], {});
      }
    } else {
      // todo: why deep _eql was commented out !???
      //return doc === query;
      return _eql(doc,query);
    }
  },

  $ne: function(doc, query) {
    if (DEBUG) debug('$ne: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
    return doc !== query;
  },

  $gt: function(doc, query) {
    if (DEBUG) debug('$gt: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
    // Against an array field, match if ANY element satisfies (Mongo semantics).
    if (Array.isArray(doc)) { return doc.some(function(el) { return el > query; }); }
    return doc > query;
  },

  $gte: function(doc, query) {
    if (DEBUG) debug('$gte: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
    if (Array.isArray(doc)) { return doc.some(function(el) { return el >= query; }); }
    return doc >= query;
  },

  $lt: function(doc, query) {
    if (DEBUG) debug('$lt: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
    if (Array.isArray(doc)) { return doc.some(function(el) { return el < query; }); }
    return doc < query;
  },

  $lte: function(doc, query) {
    if (DEBUG) debug('$lte: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
    if (Array.isArray(doc)) { return doc.some(function(el) { return el <= query; }); }
    return doc <= query;
  },

  $in: function(doc, query) {
    if (DEBUG) debug('$in(): doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
    assert(Array.isArray(query), 'Invalid syntax near \''+JSON.stringify(query)+'\': parameter for $in must be array.');
    var q = query; // calcArr(doc,query);
    if (Array.isArray(doc)) {
      return _containsAnyDeep(doc, q, { regex: true });
    } else {
      return (q.indexOf(doc) >= 0);
    }
  },

  $nin: function(doc, query) {
    assert(Array.isArray(query), 'Invalid syntax near \''+JSON.stringify(query)+'\': parameter for $nin must be array.');
    var q = query; // evaluate(doc, query);
    return (q.indexOf(doc) < 0);
  },

  // Element Query postOperators

  $exists: function(doc, query) {
    assert(typeof query === 'boolean', 'Invalid syntax near \'' + JSON.stringify(query) + '\': parameter for $exists must be boolean.');
    var q = query;
    return (
      (q === true  && typeof doc !== 'undefined') ||
      (q === false && typeof doc === 'undefined')
    );
  },

  $type: function(doc, query) {
    var allowedDataTypes = [
      'boolean', 'null', 'number', 'object', 'string', 'undefined', // standard Javascript types; object includes null and array
      'array'                                                       // non-standard Javascript types
    ];
    if ( typeof query !== 'string' || allowedDataTypes.indexOf(query) < 0) {
      throw new Error('Invalid syntax near \''+JSON.stringify(query)+'\': parameter for $type must be one of following types: '+allowedDataTypes.join(', ')+'.');
    }
    return (
      (query === typeof doc) ||
      (query === 'null'  && doc === null) ||
      (query === 'array' && Array.isArray(doc))
    );
  },

  // Evaluation query postOperators

  $mod: function(doc, query) {
    assert(Array.isArray(query) && query.length === 2, 'Invalid syntax near \''+JSON.stringify(query)+'\': parameter for $in must be array with length = 2');
    var divisor = query[0];
    var remainder = query[1];
    return doc % divisor === remainder;
  },

  $regex: function(doc, query, options) {
    assert(query instanceof RegExp, 'Invalid syntax near \''+JSON.stringify(query)+'\': parameter for $regex must be regex');
    //console.log(JSON.stringify(doc), query.toString(), options)

    if (options) { query = new RegExp(query.source, options); }
    //console.log(JSON.stringify(doc), query.toString(), options)


    var res = typeof doc === 'string' && query.test(doc);
    //console.log(res)
    return res;
  },

  $options: function(doc, query, options) {
    // do nothing as this is not operator
    return true;  // as usually it is inside implicit $and
  },

  // $text moved to preOperators (it matches the whole document, not a field).

  // $where is in preOperators


  // Geospatial Query postOperators
  //
  // The field value (`doc`) is a point: a legacy [x, y] pair or a GeoJSON Point.
  // $geoWithin/$geoIntersects/$near/$nearSphere parse their nested shape/geometry
  // operand directly; the shape sub-operands ($box/$center/$geometry/…) are inert
  // when reached via dispatch since their parent consumes them.

  $geoWithin: function(doc, query) {
    var pt = geo.asPoint(doc);
    if (!pt) { return false; }
    if (query.$box)          { return geo.pointInBox(pt, query.$box); }
    if (query.$center)       { return geo.pointInCircle(pt, query.$center[0], query.$center[1]); }
    if (query.$centerSphere) { return geo.pointInCircleSphere(pt, query.$centerSphere[0], query.$centerSphere[1]); }
    if (query.$polygon)      { return geo.pointInPolygon(pt, query.$polygon); }
    if (query.$geometry)     { return _geoWithinGeometry(pt, query.$geometry); }
    throw new Error('$geoWithin requires one of $box, $center, $centerSphere, $polygon, $geometry');
  },

  $geoIntersects: function(doc, query) {
    // For point-valued fields, "intersects a polygon" == "within that polygon".
    var pt = geo.asPoint(doc);
    if (!pt) { return false; }
    if (query.$geometry) { return _geoWithinGeometry(pt, query.$geometry); }
    throw new Error('$geoIntersects requires $geometry');
  },

  $near: function(doc, operand, options, siblings) {
    return _near(doc, operand, siblings, 'planar'); // legacy = planar; GeoJSON form handled inside
  },

  $nearSphere: function(doc, operand, options, siblings) {
    return _near(doc, operand, siblings, 'spherical');
  },

  // Shape / sub-operands: consumed by the operators above. Inert if dispatched
  // directly (mirrors $options) so they never throw inside an implicit $and.
  $geometry:    function() { return true; },
  $minDistance: function() { return true; },
  $maxDistance: function() { return true; },
  $center:      function() { return true; },
  $centerSphere:function() { return true; },
  $box:         function() { return true; },
  $polygon:     function() { return true; },
  $uniqueDocs:  function() { return true; },


  // Bitwise Query postOperators
  //
  // Operand forms supported: a numeric bitmask, or an array of bit positions
  // (0 = least significant bit). BinData masks are NOT supported (micromongo has
  // no BSON BinData type). The field value must be a number to match.

  $bitsAllSet: function(doc, query) {
    return _bitsMatch(doc, query, 'allSet');
  },

  $bitsAnySet: function(doc, query) {
    return _bitsMatch(doc, query, 'anySet');
  },

  $bitsAllClear: function(doc, query) {
    return _bitsMatch(doc, query, 'allClear');
  },

  $bitsAnyClear: function(doc, query) {
    return _bitsMatch(doc, query, 'anyClear');
  },


  // $comment is in preprocessOps


  // query operator array

  // $

  $all: function (doc, query) {
    assert(Array.isArray(query), 'Invalid syntax near \''+JSON.stringify(query)+'\': parameter for $all must be array.');
    //if (!Array.isArray(doc)) { doc = [doc]; }
    return _arrayOrElementContainsAll(doc, query);
  },

  $elemMatch: function (doc, query) {
    if (!Array.isArray(doc)) return false;
    for (var len=doc.length, i=0; i<len; ++i) {
      var res = doExpr.call(this, doc[i], query);
      if (res) return true;
    }
    return false;
  },

  $size: function (doc, query) {
    if ( typeof query !== 'number') {
      throw new Error('Invalid syntax near \''+JSON.stringify(query)+'\': parameter for $size must be a number.');
    }
    return Array.isArray(doc) ? (doc.length === query) : false;
  },

};


var preprocessOps = {

  $comment: function(doc, query) {
    console.log(query);
    return query;
  },

};

// Projection operators are NOT handled here. The specialized projection
// operators that micromongo supports — $slice, $elemMatch, and positional $ —
// are implemented in lib/crud/project.js (see _applySlice / _applyElemMatch /
// _applyPositional), because projection is applied by project(), not match().
// This table was dead code (never invoked) and has been removed. ($all and $size
// are query operators, not projection operators, in MongoDB.)
var projectionOps = {};

function doPreOp(doc, op, subQuery, options) {
  if (typeof preOperators[ op ] === 'undefined') { // execute it
    throw new Error('Invalid operator \''+JSON.stringify(op));
  }
  return preOperators[ op ].call(this, doc, subQuery, options);
}

function doPostOp(doc, op, subQuery, options, siblings) {
  if (DEBUG) debug('doPostOp(): doc: '+JSON.stringify(doc)+', op:'+JSON.stringify(op)+', subQuery:'+JSON.stringify(subQuery)+', options:'+JSON.stringify(options));
  if (typeof postOperators[ op ] === 'undefined') {
    throw new Error('Invalid operator \'' + JSON.stringify(op) + '\'.');
  }
  // `siblings` is the full operator object (e.g. { $near: …, $maxDistance: … }),
  // so operators that need their sibling keys (geo $near/$nearSphere) can read them.
  return postOperators[ op ].call(this, doc, subQuery, options, siblings); // execute it
}

function doExpr(doc, query, options) {
  if (DEBUG) debug('doExpr(): doc: '+JSON.stringify(doc)+', query:'+JSON.stringify(query));
  var res;
  // as this is not logical operator, this is a field name
  // check if there is an operator inside
  // if (query === null) {
  //   if (DEBUG) debug('doExpr(): true (query is empty)');
  //   return true;

  // } else
if (typeof query === 'object' && query!==null && !Array.isArray(query) && !(query instanceof Buffer) ) {
    //if (query !== null && typeof query === 'object') {

    for (var k2 in query) { if (query.hasOwnProperty(k2)) {
      if (DEBUG) debug('doExpr(): k2: '+k2);

      if (k2.charAt(0) === '$') {

        if (preprocessOps[k2]) { continue; } // this is preprocess operators to be skipped here

        res = doPostOp.call(this, doc, k2, query[k2], query.$options, query);
        if (!res) { if (DEBUG) debug('doExpr(): false'); return false; }

      } else { // this is a field name, not operator
        //res = doPostOp.call(this,  _.get(doc, k2), '$eq', query[k2], query.$options); if (!res) { if (DEBUG) debug('doExpr(): false'); return false; }
        res = doExpr.call(this,  _.get(doc, k2), query[k2], query.$options);
        if (!res) { if (DEBUG) debug('doExpr(): false'); return false; }
      }
    }}

  } else { // this is a field name, not operator
    res = doPostOp.call(this, doc, '$eq', query);
    if (!res) { if (DEBUG) debug('doExpr(): false'); return false; }
  }
  if (DEBUG) debug('doExpr(): true (default)');
  return true;
}

var _match1 = function(doc, query) {
  if (DEBUG) debug('* _match1(): doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
  var res;


  // if scalar (not for top-level query)
  // Array also must end the recursion
  if (['boolean', 'number', 'string' ].indexOf(typeof query) >= 0 || query === null /*|| Array.isArray(query)*/) {
    //if (['boolean', 'number', 'string' ].indexOf(typeof query) >= 0 || query === null ) {
    return query;
  }

  // empty query returns all documents (for top-level query only)
  if (_.isEmpty(query)) { // this includes boolean & numbers
    return true;
  }

  // on top level we have logical preOperators ($and, $or, $not, /*$nor*/) or field list
  for (var k1 in query) { if (query.hasOwnProperty(k1)) {

    if (k1.charAt(0) === '$') { // match if it is logical operator
      if (preprocessOps[k1]) { continue; } // this is preprocess operators to be skipped here

      res = doPreOp.call(this, doc, k1, query[ k1 ], query.$options); if (!res) { return false; }

    } else {
      res = doExpr.call(this,  _.get(doc, k1), query[k1], query.$options); if (!res) { return false; }
    }

  }}
  return true;
};

var _match0 = function(doc, query) {
  if (DEBUG) debug('* _match0(): doc: '+ JSON.stringify(doc)+', query: '+ JSON.stringify(query));

  // handle implicit $where
  if (typeof query === 'string' || typeof query === 'function') {
    return preOperators.$where.call(this, doc, query);
  }

  return _match1.call(this, doc, query);
};

var match = function(doc, query) {
  if (DEBUG) debug('* match(): doc: '+ JSON.stringify(doc)+', query: '+ JSON.stringify(query));
  //if (!query._prepared) { throw 'Query is not prepared'; }
  return _match0.call(doc, doc, query); // pass original `doc` as `this`
};

var prepareQuery = function(query) {
  if (DEBUG) debug('* prepareQuery(): query: '+ JSON.stringify(query));
  //query = new _Query(query);
  for (var op in query) { if (query.hasOwnProperty(op)) {
    if (preprocessOps[op]) {
      //query =
      preprocessOps[op].call(this, null, query[op]);
    }
  } }
  //query.prepare();
  return query;
};

module.exports = match;
module.exports.prepareQuery = prepareQuery;
module.exports.preOperators = preOperators;
module.exports.postOperators = postOperators;
module.exports.projectionOps = projectionOps;
module.exports._eql = _eql;
module.exports._arrayEqlOrElementEql = _arrayEqlOrElementEql;
//module.exports._Query = _Query;
