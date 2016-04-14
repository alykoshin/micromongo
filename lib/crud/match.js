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

/**
 * Deep compare
 *
 * @param o1
 * @param o2
 */
var _eql = function(o1, o2) {

  function contains(o1, o2) {
    //console.log('o1:', o1, 'o2:', o2);
    if (typeof o1 !== typeof o2) { return false; }
    if (['undefined', 'boolean', 'number', 'string'].indexOf(typeof o1)>=0 || o1 === null ) {
      //console.log('typeof o1:', typeof o1, 'o1:', o1, 'o2:', o2);
      //if (o1 !== o2) { return false; } // compare scalars
      return o1 === o2; // compare scalars
    }

    for (var p in o1) { if (o1.hasOwnProperty(p)) {
      //console.log('o1[p]:', o1[p], 'o2[p]:', o2[p]);
      // we can't consider unexistent o2 property as difference as o1[p] may be undefined
      //if (!o2.hasOwnProperty(p) || typeof o1[p] !== typeof o2[p]) { return false; }
      if (!contains(o1[p], o2[p])) { return false; }
    }}
    return true;
  }
  return contains(o1, o2) && contains(o2, o1);
};


var _arrayContainsOrEquals = function(doc, query) {

  if (!Array.isArray(doc) || !Array.isArray(query)) { return false; }

  // check if doc[] array is equal to query[] array
  if (_eql(doc, query)) { return true; } // arrays are equal

  // Check if one of elements inside doc[] array is equal to query arrays
  for (var len=doc.length, i=0; i<len; ++i) {
    if (Array.isArray(doc[i]) && _eql(doc[i], query)) { return true; }
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
    if (Array.isArray(doc) && Array.isArray(query))  {
    //  // comparing arrays
      return _arrayContainsOrEquals(doc, query);
    }
    return doc === query;
    //return _eql(doc,query);
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
    assert(Array.isArray(query), 'Invalid syntax near \''+JSON.stringify(query)+'\': parameter must be array.');
    //console.log('$in: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
    //console.log('$eq: doc:', doc, ', query:', query);
    var q = query;//calcArr(doc,query);
    return (q.indexOf(doc) >= 0);
  },

  $nin: function(doc, query) {
    //console.log('$in: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
    assert(Array.isArray(query), 'Invalid syntax near \''+JSON.stringify(query)+'\': parameter must be array.');
    //console.log('$eq: doc:', doc, ', query:', query);
    var q = query;//evaluate(doc, query);
    return (q.indexOf(doc) < 0);
  },

  // Element Query Operators

  $exists: function(doc, query) {
    //console.log('$exists: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
    assert(typeof query === 'boolean', 'Invalid syntax near \'' + JSON.stringify(query) + '\': parameter for $exists must be boolean.');
    var q = query;//evaluate(doc, query);
    //console.log('$exists: q: '+JSON.stringify(q)+', doc: '+JSON.stringify(doc) + ', typeof doc: '+typeof doc);
    return (
      (q === true  && typeof doc !== 'undefined') ||
      (q === false && typeof doc === 'undefined')
    );
  },

  $type: function(doc, query) {
    //console.log('$type: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
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
  var res;
  // as this is not logical operator, this is a field name
  // check if there is an operator inside
  if (query !== null && typeof query === 'object') {

    for (var k2 in query) { if (query.hasOwnProperty(k2)) {
      if (k2.charAt(0) === '$') {
        res = doPostOp(doc, k2, query[k2]); if (!res) { return false; }
      } else { // this is a field name, not operator
        res = doPostOp( _.get(doc, k2), '$eq', query[k2]); if (!res) { return false; }
      }
    }}

  } else { // this is a field name, not operator
    res = doPostOp(doc, '$eq', query); if (!res) { return false; }
  }
  return true;

}

var match = function(doc, query) {
  debug('match(): doc: '+JSON.stringify(doc)+', query:'+JSON.stringify(query));
  var res;

  //if (['boolean', 'number', 'string' ].indexOf(typeof query) >= 0 || query === null ) {

  // if scalar (not for top-level query)
  // Array also must end the recursion
  if (['boolean', 'number', 'string' ].indexOf(typeof query) >= 0 || query === null || Array.isArray(query)) {
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
