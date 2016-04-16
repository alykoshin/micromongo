/**
 * Created by alykoshin on 30.03.16.
 */

'use strict';

var assert = require('assert');
var vm = require('vm');
var _ = require('lodash');
var deepAssign = require('mini-deep-assign');

var debug = function(/*arguments*/) {
  //console.log.apply(this, arguments);
};


//var _Query = function(query) {
//  //this.value = query;
//  deepAssign(this, query);
//};
//
//_Query.prototype._prepared = true;



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
  var contains;
  if (!options.sameOrder && Array.isArray(target) ) {
    for (var slen=source.length, si=0; si<slen; ++si) {
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
      contains = _contains(target[p], source[p], options);
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
 * @param {boolean} options.sameOrder
 * @returns {boolean}
 */
var _eql = function(target, source, options) {
  options = options || {};
  debug('_eql: target: '+JSON.stringify(target)+', source: '+JSON.stringify(source));
  return _containsAllDeep(target, source, { sameOrder: options.sameOrder }) && _containsAllDeep(source, target, { sameOrder: options.sameOrder });
};


var _arrayEql = function(target, source, options) {
  options = options || {};
  debug('_arrayEql: target: '+JSON.stringify(target)+', source: '+JSON.stringify(source)+', options: '+JSON.stringify(options));

  if (!Array.isArray(target) || !Array.isArray(source)) { return false; }

  return _eql(target, source, options); // arrays are equal
};

var _arrayElementEql = function(target, source, options) {
  options = options || {};
  debug('_arrayEqlOrElementEql: target: '+JSON.stringify(target)+', source: '+JSON.stringify(source)+', options: '+JSON.stringify(options));

  if (!Array.isArray(target) || !Array.isArray(source)) { return false; }

  // Check if one of elements inside `doc`[] array is exactly equal to `query` array
  for (var len=target.length, i=0; i<len; ++i) {
    if (Array.isArray(target[i]) && _eql(target[i], source, options)) { return true; }
  }
  return false;
};

var _arrayEqlOrElementEql = function(target, source, options) {
  options = options || {};
  debug('_arrayEqlOrElementEql: target: '+JSON.stringify(target)+', source: '+JSON.stringify(source)+', options: '+JSON.stringify(options));

  return _arrayEql(target, source, options) || _arrayElementEql(target, source, options);
};


var _arrayContainsAll = function(target, source, options) {
  options = options || {};
  debug('_arrayEql: target: '+JSON.stringify(target)+', source: '+JSON.stringify(source)+', options: '+JSON.stringify(options));

  if (!Array.isArray(target) || !Array.isArray(source)) { return false; }

  return _containsAllDeep(target, source, options); // arrays are equal
};

var _arrayElementContainsAll = function(target, source, options) {
  options = options || {};
  debug('_arrayEqlOrElementEql: target: '+JSON.stringify(target)+', source: '+JSON.stringify(source)+', options: '+JSON.stringify(options));

  if (!Array.isArray(target) || !Array.isArray(source)) { return false; }

  // Check if one of elements inside `doc`[] array contains all elements from `query` array
  for (var len=target.length, i=0; i<len; ++i) {
    if (Array.isArray(target[i]) && _containsAllDeep(target[i], source, options)) { return true; }
  }
  return false;
};

var _arrayOrElementContainsAll = function(target, source, options) {
  options = options || {};
  debug('_arrayEqlOrElementEql: target: '+JSON.stringify(target)+', source: '+JSON.stringify(source)+', options: '+JSON.stringify(options));

  return _arrayContainsAll(target, source, options) || _arrayElementContainsAll(target, source, options);
};


var preOperators = {

  $and: function(doc, query) {
    debug('$and: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
    assert(Array.isArray(query), 'Invalid syntax near \''+JSON.stringify(query,null,2)+'\': parameter for $and must be array.');
    // iterate the array
    for (var len=query.length, i=0; i<len; ++i) {
      var q1 = query[i];
      var res = _match1.call(this, doc, q1);
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
      var res = _match1.call(this, doc, q1);
      debug('$or: q1:', q1, ', res', res);
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
    assert(Array.isArray(query), 'Invalid syntax near \''+JSON.stringify(query,null,2)+'\': parameter for $nor must be array.');
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
    var fn;
    if (typeof query === 'string') {
      fn =
        'function() { ' +
        '  return ' + query + '' +
        '}';
    } else if (typeof query === 'function') {

      fn = query.toString();

    } else {
      throw new TypeError('Invalid syntax near \''+JSON.stringify(query,null,2)+'\': parameter for $where must be string or function.');
    }

    var script =
          '(' +
            fn +
          ').call(this.this)';

    return vm.runInContext(script, sandbox);
  },

  //$comment: function(doc, query) {
  //  console.log(query);
  //},

};

var postOperators = {

  $not: function(doc, query) {
    //console.log('$not: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
    var res = ! doExpr.call(this, doc, query);
    //console.log('$not: res: '+res);
    return res;
  },

  // Comparison postOperators

  $eq: function(doc, query) {
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
      throw new Error('Invalid syntax near \''+JSON.stringify(query,null,2)+'\': parameter for $type must be one of following types: '+allowedDataTypes.join(', ')+'.');
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

  $text: function(doc, query) {
    throw new Error('Not implemented');
  },

  // $where is in preOperators


  // Geospatial Query postOperators


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


  // Bitwise Query postOperators

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
      throw new Error('Invalid syntax near \''+JSON.stringify(query,null,2)+'\': parameter for $size must be a number.');
    }
    return Array.isArray(doc) ? (doc.length === query) : false;
  },

};


var preprocessOps = {

  $comment: function(doc, query) {
    console.log(query);
    return query;
  },

}

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

function doPreOp(doc, op, subQuery, options) {
  if (typeof preOperators[ op ] === 'undefined') { // execute it
    throw new Error('Invalid operator \''+JSON.stringify(op,null,2));
  }
  return preOperators[ op ].call(this, doc, subQuery, options);
}

function doPostOp(doc, op, subQuery, options) {
  if (typeof postOperators[ op ] === 'undefined') {
    throw new Error('Invalid operator \'' + JSON.stringify(op, null, 2) + '\'.');
  }
  return postOperators[ op ].call(this, doc, subQuery, options); // execute it
}

function doExpr(doc, query, options) {
  debug('doExpr(): doc: '+JSON.stringify(doc)+', query:'+JSON.stringify(query));
  var res;
  // as this is not logical operator, this is a field name
  // check if there is an operator inside
  if (query !== null && typeof query === 'object' && !Array.isArray(query)) {
    //if (query !== null && typeof query === 'object') {

    for (var k2 in query) { if (query.hasOwnProperty(k2)) {
      debug('doExpr(): k2: '+k2);

      if (k2.charAt(0) === '$') {

        if (preprocessOps[k2]) { continue; } // this is preprocess operators to be skipped here

        res = doPostOp.call(this, doc, k2, query[k2], query.$options); if (!res) { debug('doExpr(): false'); return false; }

      } else { // this is a field name, not operator
        //res = doPostOp.call(this,  _.get(doc, k2), '$eq', query[k2], query.$options); if (!res) { debug('doExpr(): false'); return false; }
        res = doExpr.call(this,  _.get(doc, k2), query[k2], query.$options); if (!res) { debug('doExpr(): false'); return false; }
      }
    }}

  } else { // this is a field name, not operator
    res = doPostOp.call(this, doc, '$eq', query); if (!res) { debug('doExpr(): false'); return false; }
  }
  debug('doExpr(): true');
  return true;

}

var _match1 = function(doc, query) {
  debug('* _match1(): doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
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

  // handle implicit $where
  if (typeof query === 'string' || typeof query === 'function') {
    return preOperators.$where.call(this, doc, query);
  }

  return _match1.call(this, doc, query);
};

var match = function(doc, query) {
  //if (!query._prepared) { throw 'Query is not prepared'; }
  return _match0.call(doc, doc, query); // pass original `doc` as `this`
};

var prepareQuery = function(query) {
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
