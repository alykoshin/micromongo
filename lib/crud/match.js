/**
 * Created by alykoshin on 30.03.16.
 */

'use strict';

var assert = require('assert');
var _ = require('lodash');
//var deepAssign = require('mini-deep-assign');

var debug = function(/*arguments*/) {
  //console.log.apply(this, arguments);
};


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
 * @param {boolean} [options.ordered] - require arrays elements to have same positions
 * @param {boolean} [options.regex]   - allow regex in query
 * @returns {boolean}
 * @private
 */
function _contains(target, source, options) {
  debug('_contains(): target: ' + JSON.stringify(target) + ', source: ' + JSON.stringify(source) + ', options: ' + JSON.stringify(options));
  assert(xor(options.any, options.all), 'options any and all are mutually exclusive');

  if (options.regex && source instanceof RegExp) {
    return typeof target === 'string' && source.test(target);
  }

  // if values has different types, return false
  if (typeof target !== typeof source || Array.isArray(target) !== Array.isArray(source)) { debug('_contains(): target and source has different types'); return false; }

  // if scalars
  if (['undefined', 'boolean', 'number', 'string'].indexOf(typeof target)>=0 || target === null ) {
    debug('_contains(): ('+JSON.stringify(target)+'==='+JSON.stringify(source)+') = ' + (target === source));
    return target === source; // compare scalars
  }

  // if objects (including arrays)
  // try to find each element of source in target
  // independently of their position inside array
  if (!options.ordered && Array.isArray(target) ) {
    for (var slen=source.length, si=0; si<slen; ++si) {
      var contains;
      for (var tlen=target.length, ti=0; ti<tlen; ++ti) {
        // non-existing property is same as undefined
        contains = _contains(target[ti], source[si], options);
        if (options.any && contains) { debug('_contains(): array: (options.any && contains): return true'); return true; }
        if (options.all && contains) { break; }
      }
      if (options.all && !contains) { debug('_contains(): array: (options.any && !contains): return false'); return false; }
    }

  } else { // if objects
    // iterate all the props of source and check if each of them exists in target
    for (var p in source) { if (source.hasOwnProperty(p)) {
      // non-existing property is same as undefined
      var contains = _contains(target[p], source[p], options);
      if (options.any && contains) { debug('_contains(): object: (options.any && contains): return true'); return true; }
      else if (options.all && !contains) { debug('_contains(): object: (options.any && contains): return true'); return false; }
    }}
  }

  var res = !!options.all;
  debug('_contains(): return '+res);
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
  debug('_containsAllDeep: target: '+JSON.stringify(target)+', source: '+JSON.stringify(source));
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
  debug('_containsAnyDeep: target: '+JSON.stringify(target)+', source: '+JSON.stringify(source));
  return _contains(target, source, options);
}

/**
 * Deep compare
 *
 * @param {Object} target
 * @param {Object} source
 * @param {Object} options
 * @param {boolean} options.ordered
 * @returns {boolean}
 */
var _eql = function(target, source, options) {
  options = options || {};
  debug('_eql: target: '+JSON.stringify(target)+', source: '+JSON.stringify(source));
  return _containsAllDeep(target, source, options) && _containsAllDeep(source, target, { ordered: options.ordered });
};


var _arrayContainsOrEquals = function(doc, query, options) {
  options = options || {};
  debug('_arrayContainsOrEquals: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));

  if (!Array.isArray(doc) || !Array.isArray(query)) { return false; }

  // check if `doc`[] array is equal to `query`[] array
  if (_eql(doc, query, options)) { return true; } // arrays are equal

  // Check if one of elements inside `doc`[] array is equal to `query` array
  for (var len=doc.length, i=0; i<len; ++i) {
    if (Array.isArray(doc[i]) && _eql(doc[i], query, options)) { return true; }
  }
  return false;
};


var logicalOps = {

  $and: function(doc, query) {
    debug('$and: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
    assert(Array.isArray(query), 'Invalid syntax near \''+JSON.stringify(query,null,2)+'\': parameter for $and must be array.');
    // iterate the array
    for (var len=query.length, i=0; i<len; ++i) {
      var q1 = query[i];
      var res = match(doc, q1);
      debug('$and: q1: ' + JSON.stringify(q1) + ', res: ' +JSON.stringify(res));
      if (!res) {
        return false;
      }
    }
    return true;
  },

  $or: function(doc, query) {
    debug('$or: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
    assert(Array.isArray(query), 'Invalid syntax near \''+JSON.stringify(query,null,2)+'\': parameter for $or must be array.');
    // iterate the array
    for (var len=query.length, i=0; i<len; ++i) {
      var q1 = query[i];
      //console.log('$or: q1', q1);
      var res = match(doc, q1);
      debug('$or: q1:', q1, ', res', res);
      if (res) {
        return true;
      }
    }
    return false;
  },

  //$not: function(doc, query) {
  //  //console.log('$not: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
  //  var res = ! match(doc, query);
  //  //console.log('$not: res: '+res);
  //  return res;
  //},
  //
  $nor: function(doc, query) {
    //console.log('$nor: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
    assert(Array.isArray(query), 'Invalid syntax near \''+JSON.stringify(query,null,2)+'\': parameter for $nor must be array.');
    // iterate the array
    for (var len=query.length, i=0; i<len; ++i) {
      var q1 = query[i];
      //console.log('$or: q1', q1);
      var res = match(doc, q1);
      //console.log('$or: res', res);
      if (res) {
        return false;
      }
    }
    return true;
  },

};

var operators = {

  $not: function(doc, query) {
    //console.log('$not: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
    var res = ! doExpr(doc, query);
    //console.log('$not: res: '+res);
    return res;
  },

  // Comparison Operators

  $eq: function(doc, query) {
    if (Array.isArray(doc)) {
      if (Array.isArray(query))  {
        // check if arrays are the same or one of the elements in `doc`'s array is same as `query` array
        return _arrayContainsOrEquals(doc, query, { ordered: true });
      } else {
        // check if array in `doc` contains element
        return _containsAnyDeep(doc, [query], {});
      }
    } else {
      return doc === query;
      //return _eql(doc,query);
    }
  },

  $ne: function(doc, query) {
    return doc !== query;
  },

  $gt: function(doc, query) {
    return doc > query;
  },

  $gte: function(doc, query) {
    return doc >= query;
  },

  $lt: function(doc, query) {
    return doc < query;
  },

  $lte: function(doc, query) {
    return doc <= query;
  },

  $in: function(doc, query) {
    debug('$in(): doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
    assert(Array.isArray(query), 'Invalid syntax near \''+JSON.stringify(query)+'\': parameter for $in must be array.');
    var q = query; // calcArr(doc,query);
    if (Array.isArray(doc)) {
      return _containsAnyDeep(doc, query, { regex: true });
    } else {
      return (q.indexOf(doc) >= 0);
    }
  },

  $nin: function(doc, query) {
    assert(Array.isArray(query), 'Invalid syntax near \''+JSON.stringify(query)+'\': parameter for $nin must be array.');
    var q = query; // evaluate(doc, query);
    return (q.indexOf(doc) < 0);
  },

  // Element Query Operators

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
      throw new Error('Invalid syntax near \''+JSON.stringify(query,null,2)+'\': parameter for $type must be one of following types: '+allowedDataTypes.join(', ')+'.');
    }
    return (
      (query === typeof doc) ||
      (query === 'null'  && doc === null) ||
      (query === 'array' && Array.isArray(doc))
    );
  },

  // Evaluation query operators

  $mod: function(doc, query) {
    throw new Error('Not implemented');
  },

  $regex: function(doc, query) {
    throw new Error('Not implemented');
  },

  $text: function(doc, query) {
    throw new Error('Not implemented');
  },

  $where: function(doc, query) {
    throw new Error('Not implemented');
  },


  // Geospatial Query Operators


  $geoWithin: function(doc, query) {
    throw new Error('Not implemented');
  },

  $geoIntersects: function(doc, query) {
    throw new Error('Not implemented');
  },

  $near: function(doc, query) {
    throw new Error('Not implemented');
  },

  $nearSphere: function(doc, query) {
    throw new Error('Not implemented');
  },

  $geometry: function(doc, query) {
    throw new Error('Not implemented');
  },

  $minDistance: function(doc, query) {
    throw new Error('Not implemented');
  },

  $maxDistance: function(doc, query) {
    throw new Error('Not implemented');
  },

  $center: function(doc, query) {
    throw new Error('Not implemented');
  },

  $centerSphere: function(doc, query) {
    throw new Error('Not implemented');
  },

  $box: function(doc, query) {
    throw new Error('Not implemented');
  },

  $polygon: function(doc, query) {
    throw new Error('Not implemented');
  },

  $uniqueDocs: function(doc, query) {
    throw new Error('Not implemented');
  },


  // Bitwise Query Operators

  $bitsAllSet: function(doc, query) {
    throw new Error('Not implemented');
  },

  $bitsAnySet: function(doc, query) {
    throw new Error('Not implemented');
  },

  $bitsAllClear: function(doc, query) {
    throw new Error('Not implemented');
  },

  $bitsAnyClear: function(doc, query) {
    throw new Error('Not implemented');
  },


  // $comment

  $comment: function(doc, query) {
    throw new Error('Not implemented');
  },

  // query operator array

  // $

  $all: function (doc, query) {
    assert(Array.isArray(query), 'Invalid syntax near \''+JSON.stringify(query)+'\': parameter must be array.');
    throw new Error('Not implemented');
  },

  $elemMatch: function (doc, query) {
    throw new Error('Not implemented');
  },

  $size: function (doc, query) {
    if ( typeof query !== 'number') {
      throw new Error('Invalid syntax near \''+JSON.stringify(query,null,2)+'\': parameter for $size must be a number.');
    }
    return Array.isArray(doc) ? (doc.length === query) : false;
  },

};


var projectionOps = {

  $: function(doc, query) {
    throw new Error('Not implemented');
  },

  $all: function(doc, query) {
    throw new Error('Not implemented');
  },

  $elemMatch: function(doc, query) {
    throw new Error('Not implemented');
  },

  $size: function(doc, query) {
    throw new Error('Not implemented');
  },

};

function doPreOp(doc, op, subQuery) {
  if (typeof logicalOps[ op ] === 'undefined') { // execute it
    throw new Error('Invalid operator \''+JSON.stringify(op,null,2));
  }
  return logicalOps[ op ](doc, subQuery);
}

function doPostOp(doc, op, subQuery) {
  if (typeof operators[ op ] === 'undefined') {
    throw new Error('Invalid operator \'' + JSON.stringify(op, null, 2) + '\'.');
  }
  return operators[ op ](doc, subQuery); // execute it
}

function doExpr(doc, query) {
  debug('doExpr(): doc: '+JSON.stringify(doc)+', query:'+JSON.stringify(query));
  var res;
  // as this is not logical operator, this is a field name
  // check if there is an operator inside
  if (query !== null && typeof query === 'object' && !Array.isArray(query)) {
    //if (query !== null && typeof query === 'object') {

    for (var k2 in query) { if (query.hasOwnProperty(k2)) {
      debug('doExpr(): k2: '+k2);
      if (k2.charAt(0) === '$') {
        res = doPostOp(doc, k2, query[k2]); if (!res) { debug('doExpr(): false'); return false; }
      } else { // this is a field name, not operator
        res = doPostOp( _.get(doc, k2), '$eq', query[k2]); if (!res) { debug('doExpr(): false'); return false; }
      }
    }}

  } else { // this is a field name, not operator
    res = doPostOp(doc, '$eq', query); if (!res) { debug('doExpr(): false'); return false; }
  }
  debug('doExpr(): true');
  return true;

}

var match = function(doc, query) {
  debug('* match(): doc: '+JSON.stringify(doc)+', query:'+JSON.stringify(query));
  var res;


  // if scalar (not for top-level query)
  // Array also must end the recursion
  if (['boolean', 'number', 'string' ].indexOf(typeof query) >= 0 || query === null || Array.isArray(query)) {
    //if (['boolean', 'number', 'string' ].indexOf(typeof query) >= 0 || query === null ) {
    return query;
  }

  // empty query returns all documents (for top-level query only)
  if (_.isEmpty(query)) { // this includes boolean & numbers
    return true;
  }

  // on top level we have logical operators ($and, $or, $not, /*$nor*/) or field list
  for (var k1 in query) { if (query.hasOwnProperty(k1)) {

    if (k1.charAt(0) === '$') { // match if it is logical operator

      res = doPreOp(doc, k1, query[ k1 ]); if (!res) { return false; }
    } else {
      res = doExpr( _.get(doc, k1), query[k1]); if (!res) { return false; }
    }
  }}
  return true;
};


module.exports = match;
module.exports.logicalOps = logicalOps;
module.exports.operators = operators;
module.exports.projectionOps = projectionOps;
module.exports._eql = _eql;
module.exports._arrayContainsOrEquals = _arrayContainsOrEquals;
