/**
 * Created by alykoshin on 30.03.16.
 */

'use strict';

//var assert = require('assert');
var _ = require('lodash');
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
function projectionMode(projection) {
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
}


var project = function(doc, projection) {
  debug('project(): doc: '+JSON.stringify(doc)+', projection:'+JSON.stringify(projection));
  var res, path;
  var allowedProjectionValues = [ false, true, 0, 1 ];

  if (_.isEmpty(projection)) {
    res = deepAssign({}, doc); // return full deep copy
    debug('project(): doc: '+JSON.stringify(doc)+', res: '+JSON.stringify(res));
    return res;
  }

  var mode = projectionMode(projection);

  debug('project(): mode: '+mode);

  if (mode === 'exclusion') { // exclusion mode
    // make full deep copy
    res = deepAssign({}, doc);
  } else {
    res = {};
    //
    // Handle _id similar to Mongo
    //
    // include _id by default
    if (typeof doc._id !== 'undefined') {
      res._id = deepAssign({}, doc._id);
    }
  }


  // remove listed properties
  for (path in projection) { if (projection.hasOwnProperty(path)) {

    if (allowedProjectionValues.indexOf(projection[ path ]) < 0) {
      throw new Error('Values for projection musty be in ' + JSON.stringify(allowedProjectionValues));
    }
    //
    // Handle _id similar to Mongo
    // before anything else
    //
    if (path === '_id') {
      if (!projection[ path ]) { // if
        _.unset(res, path);
      }
      continue;
    }

    // check projection mode
    if ( (mode === 'exclusion' && projection[path]) || (mode !== 'exclusion' &&  !projection[path]) ) {
      throw new Error('Unable to mix inclusion and exclusion modes');
    }

    // project property
    if (mode === 'exclusion') {      // remove property in exclusion mode
      _.unset(res, path);

    } else {                         // copy property in exclusion mode
      var value = _.get(doc, path);  // get value at path
      value = deepAssign({}, value); // make full copy
      _.set(res, path, value);
    }

  }}

  debug('project(): doc: '+JSON.stringify(doc)+', res: '+JSON.stringify(res));
  return res;
};


module.exports = project
module.exports.projectionMode = projectionMode;
