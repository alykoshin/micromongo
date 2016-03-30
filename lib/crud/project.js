/**
 * Created by alykoshin on 30.03.16.
 */

'use strict';

//var assert = require('assert');
var _ = require('lodash');
var util = require('util');
var deepAssign = require('mini-deep-assign');

var debug = function(/*arguments*/) {
  //console.log.apply(this, arguments);
};


/**
 * Determine projection mode basing on values in projection
 *
 * _id has special handling in mongodb projections
 * we have no _id, so we'll ignore settings for _id field name
 *
 * @param {Object} projection - object with set of field names with values:
 *                              0||false - to exclude the field specified (exclusion mode)
 *                              1||true  - to include the field specified (inclusion mode)
 * @returns {'exclusion'|'inclusion'}  - returns exclusion mode (return all the fields except listed) ,
 *                                     - or inclusive (return only listed fields)
 */
var projectionMode = function(projection) {
  for (var path in projection) { if (projection.hasOwnProperty(path)) {
    //
    // Handle _id similar to Mongo
    //
    if (path === '_id') { continue; } // ignore value _id when determining projectionMode
    //
    if (projection[path] === 1 || projection[path] === true) {
      return 'inclusion';
    } else if (projection[path] === 0 || projection[path] === false) {
      return 'exclusion';
    } else {
      throw new Error('values for the projection may be only: true, false, 1, 0');
    }
  }}
  return 'exclusion'; // if projection is empty, set mode to 'exclusion', i.e. include all doc fields
};


var initDoc = function(doc, mode) {
  var res;
  if (mode === 'exclusion') { // exclusion mode
                              // make full deep copy
    res = deepAssign({}, doc);
  } else {
    res = {};
    //
    // Handle _id similar to Mongo
    // include _id by default
    //
    if (typeof doc._id !== 'undefined') {
      includeField(doc, res, '_id');
    }
    //
  }
  return res;
};



var validateProjection = function(mode, path, projectionValue) {
  var allowedProjectionValues = [ false, true, 0, 1 ];
  if (allowedProjectionValues.indexOf(projectionValue) < 0) {
    throw new Error('Values for projection musty be in ' + JSON.stringify(allowedProjectionValues) + ', found: '+util.inspect(projectionValue));
  }
  // check projection mode
  if ( path !== '_id' && ((mode === 'exclusion' && projectionValue) || (mode !== 'exclusion' &&  !projectionValue)) ) {
    throw new Error('Unable to mix inclusion and exclusion modes');
  }

};

var includeField = function(sourceDoc, targetDoc, path) {
  var value = _.get(sourceDoc, path);  // get value at path
  value = deepAssign({}, value);       // make full copy
  _.set(targetDoc, path, value);
};


var excludeField = function(sourceDoc, targetDoc, path) {
  _.unset(targetDoc, path);
};


var projectId = function(sourceDoc, targetDoc, path, projection) {
  //
  // Handle _id similar to Mongo
  // _id by default is always included
  //
  if (!projection) {
    excludeField(sourceDoc, targetDoc, path);
  }
};


/**
 * Inclusion or suppression of the field
 * Prerequisites:
 * - in exclusion mode targetDoc must be deep copy of sourceDoc
 * - in inclusion mode targetDoc must initially be empty
 *
 * @param {Object} sourceDoc
 * @param {Object} targetDoc
 * @param {string} path
 * @param {boolean||number} projection
 */
var projectBasic = function(sourceDoc, targetDoc, path, projection) {
  if (!projection) {                     // remove property
    excludeField(sourceDoc, targetDoc, path);
  } else {                               // copy property
    includeField(sourceDoc, targetDoc, path);
  }
};


var project = function(doc, projection) {

  var mode = projectionMode(projection);
  var res = initDoc(doc, mode);

  // iterate through projection properties
  for (var path in projection) { if (projection.hasOwnProperty(path)) {

    validateProjection(mode, path, projection[ path ]);

    if (path === '_id') { // _id has priority over other properties
      projectId(doc, res, path, projection[ path ]);
    } else {
      projectBasic(doc, res, path, projection[ path ]);
    }

  }}

  debug('project(): doc: '+JSON.stringify(doc)+', res: '+JSON.stringify(res));
  return res;
};


module.exports = project;

module.exports.projectionMode = projectionMode;
module.exports.initDoc = initDoc;

module.exports.validateProjection = validateProjection;

module.exports.includeField = includeField;
module.exports.excludeField = excludeField;

module.exports.projectId = projectId;
module.exports.projectBasic = projectBasic;
