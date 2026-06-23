/**
 * Created by alykoshin on 30.03.16.
 */

'use strict';

//var assert = require('assert');
var _ = require('lodash');
var util = require('util');
var deepAssign = require('mini-deep-assign');

var settings = require('../settings');

/**
 * If true, handle _id similar to Mongodb,
 * i.e. include _id by default in result document,
 * do not validate projection value against exlusion/inclusion modes.
 *
 * Read at use (not cached) so `mm.configure({ idProjectionMongo })` takes effect.
 * @returns {boolean}
 */
function idProjectionMongo() { return settings.idProjectionMongo; }


var includeField = function(source, target, path) {
  var value = _.get(source, path);  // get value at path
  value = deepAssign({}, value);       // make full copy
  _.set(target, path, value);
};


var excludeField = function(source, target, path) {
  _.unset(target, path);
};


var _validateProjectionValue = function(projectionValue) {
  var allowedProjectionValues = [ false, true, 0, 1 ];
  if (allowedProjectionValues.indexOf(projectionValue) < 0) {
    throw new Error('Values for projection musty be [' + allowedProjectionValues.join(', ') + '], found: '+JSON.stringify(projectionValue));
  }
};


var _projectionModeByValue = function(value) {
  return value ? 'inclusion' : 'exclusion';
};

/**
 * Determine projection mode basing on values in projection
 *
 * _id has special handling in mongodb projections
 * we have no _id, so we'll ignore settings for _id field name
 *
 * @param {Object} projection - object with set of field names with values:
 *                              0 || false - to exclude the field specified (exclusion mode)
 *                              1 || true  - to include the field specified (inclusion mode)
 * @returns {'exclusion'|'inclusion'}  - returns exclusion mode (return all the fields except listed) ,
 *                                     - or inclusive (return only listed fields)
 */
var projectionMode = function(projection) {

  for (var path in projection) { if (projection.hasOwnProperty(path)) {

    _validateProjectionValue(projection[path]);
    // Handle _id similar to Mongo
    if (idProjectionMongo() && path === '_id') { continue; } // ignore value _id when determining projectionMode

    return _projectionModeByValue(projection[path]);
  }}

  return 'exclusion'; // if projection is empty, set mode to 'exclusion', i.e. include all doc fields
};


var initDoc = function(source, target, mode) {
  target = target || {};
  //var target;
  if (mode === 'exclusion') {        // exclusion mode
    //target = deepAssign({}, source); // make full deep copy
    //deepAssign(target, source); // make full deep copy
    deepAssign(target, source); // make full deep copy

  } else {
    //target = {};
    if (idProjectionMongo() && typeof source._id !== 'undefined') { // Handle _id similar to Mongo
      includeField(source, target, '_id');                          // include _id by default
    }
  }
  return target;
};


var validateProjection = function(mode, path, projectionValue) {
  _validateProjectionValue(projectionValue);
  // check projection mode
  if (idProjectionMongo() && path === '_id') {
    return mode;
  }


  if (
    (!idProjectionMongo() || path !== '_id') &&
    ( mode !== null ) &&
    (
      (mode === 'exclusion' && projectionValue) ||
      (mode !== 'exclusion' && !projectionValue)
    )
  ) {
    throw new Error('Unable to mix inclusion and exclusion modes');
  }
  return _projectionModeByValue(projectionValue);
  //return mode;
};


/**
 * Inclusion or suppression of the field
 * Prerequisites:
 * - in exclusion mode target must be deep copy of source
 * - in inclusion mode target must initially be empty
 *
 * @param {Object} source
 * @param {Object} target
 * @param {string} path
 * @param {boolean||number} projection
 */
var projectIncludeExclude = function(source, target, path, projection) {
  if (!projection) {
    excludeField(source, target, path);

  } else if ( path !== '_id' || (path === '_id' && !idProjectionMongo()) ) {
    includeField(source, target, path);
  }
};



var project = function(source, projection) {
  var mode = projectionMode(projection);
  //var mode = null;
  var target = {};
  //var target = initDoc(source, target, mode);
  initDoc(source, target, mode);

  // iterate through projection properties
  for (var path in projection) { if (projection.hasOwnProperty(path)) {

    mode = validateProjection(mode, path, projection[ path ]);
    //mode = projectionCheckInit(source, target, mode, path, projection[ path ]);
    projectIncludeExclude(source, target, path, projection[ path ]);

  }}

  return target;
};


module.exports = project;

module.exports._includeField = includeField;
module.exports._excludeField = excludeField;

module.exports._projectionMode = projectionMode;
module.exports._initDoc = initDoc;

module.exports._validateProjection = validateProjection;

module.exports._projectIncludeExclude = projectIncludeExclude;
