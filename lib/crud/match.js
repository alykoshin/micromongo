/**
 * Created by alykoshin on 30.03.16.
 */

'use strict';

var assert = require('assert');
var _ = require('lodash');
var deepAssign = require('mini-deep-assign');

var debug = function(/*arguments*/) {
  //console.log.apply(this, arguments);
};


var logicalOps = {

  $and: function(doc, query) {
    debug('$and: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
    if ( !Array.isArray(query) ) {
      throw new Error('Invalid syntax near \''+JSON.stringify(query,null,2)+'\': parameter for $and must be array.');
    }
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
    if ( !Array.isArray(query) ) {
      throw new Error('Invalid syntax near \''+JSON.stringify(query,null,2)+'\': parameter for $or must be array.');
    }
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

  $not: function(doc, query) {
    //console.log('$not: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
    var res = ! match(doc, query);
    //console.log('$not: res: '+res);
    return res;
  },

  $nor: function(doc, query) {
    //console.log('$nor: doc: '+JSON.stringify(doc)+', query: '+JSON.stringify(query));
    if ( !Array.isArray(query) ) {
      throw new Error('Invalid syntax near \''+JSON.stringify(query,null,2)+'\': parameter for $nor must be array.');
    }
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

  // Comparision Operators

  $eq: function(doc, query) {
    return doc === query;
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

};

var queryArrayOps = {

  $all: function (doc, query) {
    throw new Error('Not implemented');
  },

  $elemMatch: function (doc, query) {
    throw new Error('Not implemented');
  },

  $size: function (doc, query) {
    throw new Error('Not implemented');
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


var match = function(doc, query) {
  debug('match(): doc: '+JSON.stringify(doc)+', query:'+JSON.stringify(query));
  var res;

  //console.log('match(): typeof query: ' + typeof query);
  // if scalar (not for top-level query)
  if (
    ['boolean', 'number', 'string' ].indexOf(typeof query) >= 0 ||
    query === null
  ) {
    debug('match(): scalar query:'+ query);
    return query;
  }

  // empty query returns all documents (for top-level query only)
  if (_.isEmpty(query)) { // this includes boolean & numbers
    debug('match(): isEmpty');
    return true;
  }

  // on top level we have logical operators ($and, $or, $not, $nor) or field list
  for (var k1 in query) { if (query.hasOwnProperty(k1)) {
    //console.log('match(): k1:', k1);

    if (k1.charAt(0) === '$') {
      // match if it is logical operator
      if (typeof logicalOps[ k1 ] !== 'undefined') { // execute it
        res = logicalOps[ k1 ](doc, query[ k1 ]);
        debug('match(): logicalOps: res: ' + res);
        if (!res) {
          return false;
        }
        continue;
      } else {
        throw new Error('Invalid operator \''+JSON.stringify(k1,null,2)+'\'.');
      }
    }

    // as this is not logical operator, this is a field name
    // check if there is an operator inside
    var q1 = query[k1];
    if (q1 !== null && typeof q1 === 'object') {

      for (var k2 in q1) { if (q1.hasOwnProperty(k2)) {

        if (k2.charAt(0) === '$') {
          if (typeof operators[ k2 ] !== 'undefined') { // execute it
            var subDoc = _.get(doc, k1);
            res = operators[ k2 ](subDoc, q1[ k2 ]);
            debug('match(): operators: res: ' + res);
            if (!res) {
              return false;
            }
          }
        } else {
          throw new Error('Invalid operator \''+JSON.stringify(k2,null,2)+'\'.');
        }

      }}

    } else {
      // default is $eq
      res = operators['$eq'](doc[k1], q1);
      debug('match(): default $eq: res: '+res);
      if (!res) {
        return false;
      }

    }
  }}
  return true;
};


module.exports = match;
module.exports.logicalOps = logicalOps;
module.exports.operators = operators;
module.exports.queryArrayOps = queryArrayOps;
module.exports.projectionOps = projectionOps;