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

var match = require('./match');
var project = require('./project');




var count = function(array, query, options) {
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  var res = 0;
  query = match.prepareQuery(query);
  array
    .forEach(function(doc) { if (match(doc, query)) { res++; } })
  ;
  return res;
};


var copyTo = function(array, target) {
  if (!Array.isArray(array) || !Array.isArray(target)) { throw new TypeError('Arrays expected as both parameters'); }

  var copiedCount = 0;
  //target.length = 0; // do not clear the target array
  for (var len=array.length, i=0; i<len; ++i) {
    var s = array[i];
    var t = deepAssign({}, s);
    target.push(t);
    copiedCount++;
  }
  return copiedCount;
};


var findOne = function(array, query, projection) {
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  query = match.prepareQuery(query);
  for (var len=array.length, i=0; i<len; ++i) {
    var doc = array[i];
    if (match(doc, query)) {
      return project(doc, projection);
    }
  }
  return null;
};


var find = function(array, query, projection) {
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  var res = [];
  query = match.prepareQuery(query);
  for (var len=array.length, i=0; i<len; ++i) {
    var doc = array[i];
    if (match(doc, query)) {
      res.push( project(doc, projection) );
    }
  }
  return res;
};


var deleteOne = function(array, query) {
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  var deletedCount = 0;

  query = match.prepareQuery(query);
  for (var len=array.length, i=0; i<len; ++i) { // go in back direction to remove the _first_ element
    var doc = array[i];
    if (match(doc, query)) {
      //return project(doc, projection);
      array.splice(i, 1);
      deletedCount++;
      break;
    }
  }
  return { deletedCount: deletedCount };
};


var deleteMany = function(array, query) {
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  var deletedCount = 0;

  query = match.prepareQuery(query);
  for (var len=array.length, i=len-1; i>=0; --i) { // go in back direction to correctly handle array.split()
    var doc = array[i];
    if (match(doc, query)) {
      //return project(doc, projection);
      array.splice(i, 1);
      deletedCount++;
    }
  }
  return { deletedCount: deletedCount };
};


var remove = function(array, query, options) {
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  if (typeof options === 'boolean') {
    options = { justOne: options };
  }
  options = options || {};

  options.justOne = (typeof options.justOne === 'undefined') ? false : options.justOne;

  var res = options.justOne ? deleteOne(array, query) : deleteMany(array, query);
  return { nRemoved: res.deletedCount };
};


var insertOne = function(array, source, options) {
  if (!Array.isArray(array)) { throw new TypeError('Array expected as first parameter'); }
  options = options || {};
  var nInserted = 0;
  array.push(deepAssign({}, source));
  nInserted++;
  return { nInserted: nInserted };
};


var insertMany = function(array, source, options) {
  if (!Array.isArray(array) || !Array.isArray(source)) { throw new TypeError('Arrays expected as both parameters'); }
  options = options || {};
  options.ordered = typeof options.ordered === 'undefined' ? true : options.ordered;
  var nInserted = 0;
  for (var len=source.length, i=0; i<len; ++i) {
    try {
      //var doc = source[ i ];
      //array.push(deepAssign({}, doc));
      var res = insertOne(array, source[i], options);
      nInserted += res.nInserted;
    } catch(e) {
      //if (options.ordered) {
      throw e;
      //}
    }
  }
  return { nInserted: nInserted };
};


var insert = function(array, source, options) {
  return Array.isArray(source) ? insertMany(array, source, options)
    : insertOne(array, source, options);
};


module.exports = {
  count: count,
  copyTo: copyTo,

  find: find,
  findOne: findOne,

  deleteOne: deleteOne,
  deleteMany: deleteMany,
  remove: remove,

  insertOne: insertOne,
  insertMany: insertMany,
  insert: insert,
};
