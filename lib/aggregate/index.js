/**
 * Created by alykoshin on 30.03.16.
 */

'use strict';

var assert = require('assert');
var _ = require('lodash');
var deepAssign = require('mini-deep-assign');


var copyTo = require('../crud/').copyTo;
var project = require('../crud/project');

/**
 * validate path
 *
 * @param {string} fieldPath
 * @returns {string}
 * @private
 */
var _parseFieldPath = function(fieldPath) {
  if (typeof fieldPath !== 'string') { throw new TypeError('Field path must be a string'); }
  if (fieldPath.charAt(0) !== '$') { throw new Error('Field path must starts with $ sign'); }

  return fieldPath.slice(1);
};


var _aggregateStageOps = {

  $project: function(array, projection, options) {

    var target = [];
    for (var len=array.length, i=0; i<len; ++i) {
      var src = array[i];

      // calculate expressions in projection



      var mode = project._projectionMode(projection);
      var tgt = {};
      project._initDoc(src, tgt, mode);

      // iterate through projection properties
      for (var path in projection) { if (projection.hasOwnProperty(path)) {

        mode = project._validateProjection(mode, path, projection[ path ]);
        //mode = projectionCheckInit(source, target, mode, path, projection[ path ]);
        project._projectIncludeExclude(src, tgt, path, projection[ path ]);

      }}
      target.push(tgt);

    }

    return target;
  },


  $match: function(array, params, options) {
    throw new Error('Not implemented');
  },


  $redact: function(array, params, options) {
    throw new Error('Not implemented');
  },


  $limit: function(array, params, options) {
    if (typeof params !== 'number') { throw new TypeError('Number expected'); }
    return array.slice(0, params);
  },


  $skip: function(array, params, options) {
    if (typeof params !== 'number') { throw new TypeError('Number expected'); }
    return array.slice(params);
  },


  $unwind: function(array, params) {

    var _unwindDoc = function(doc, path, includeArrayIndex) {
      var res = [];
      var value = _.get(doc, path);

      for (var len=value.length, i=0; i<len; ++i) {

        var newDoc = deepAssign({}, doc);

        if (includeArrayIndex) {
          var a = path.split('.');
          a = a.splice(0, a.length-1);  // remove last part
          a.push(includeArrayIndex); // add name
          a.join('.');               // convert to string
          _.set(newDoc, a, i);
        }

        _.set(newDoc, p, value[i]);

        res.push(newDoc);
      }

      return res;
    };

    params = (typeof params === 'string') ? { path: params } : params;
    params.preserveNullAndEmptyArrays = typeof params.preserveNullAndEmptyArrays === 'undefined' ? false : params.preserveNullAndEmptyArrays;

    params.includeArrayIndex = typeof params.includeArrayIndex === 'undefined' ? false : params.includeArrayIndex;

    if (params.includeArrayIndex && typeof params.includeArrayIndex !== 'string') { throw new TypeError('includeArrayIndex must be a string'); }

    var p = _parseFieldPath(params.path);
    var res = [];

    for (var len=array.length, i=0; i<len; ++i) {
      var doc = array[i];
      var value = _.get(doc, p);

      if (typeof value === 'undefined' || value === null) { // skip doc
        if (params.preserveNullAndEmptyArrays) { res.push(doc); }

      } else if (!Array.isArray(value)) { // error
        throw new TypeError('$unwind cannot be executed over non-array field');

      } else if (value.length === 0) { // skip doc
        if (params.preserveNullAndEmptyArrays) { res.push(doc); }

      } else {
        var unwinded = _unwindDoc(doc, p, params.includeArrayIndex);
        res = res.concat( unwinded );
      }

    }
    return res;
  },


  $group: function(array, params, options) {
    throw new Error('Not implemented');
  },


  $sample: function(array, params, options) {
    throw new Error('Not implemented');
  },


  $sort: function(array, params, options) {
    return array.sort(function(doc1,doc2) {
      for (var p in params) { if (params.hasOwnProperty(p)) {
        var dir = params[p];
        if ([-1,1 ].indexOf(dir) < 0 ) { throw new Error('Sort direction may be -1 or 1'); }
        var v1 = _.get(doc1, p);
        var v2 = _.get(doc2, p);

        var res = (v1 < v2) ? -1 : ((v1 > v2) ? 1 : 0);
        res = res * dir;

        // if current fields are different, return direction
        // otherwise, we'll go to next parameter
        if (res !== 0) { return res; }
      }}
      // if we went out from cycle, that means, both docs are the same
      return 0;
    });
  },


  $geoNear: function(array, params, options) {
    throw new Error('Not implemented');
  },


  $lookup: function(array, params, options) {
    throw new Error('Not implemented');
  },


  $out: function(array, params, options) {
    throw new Error('Not implemented');
  },


  $indexStats: function(array, params, options) {
    throw new Error('Not implemented');
  },


};


var aggregate = function(array, stages, options) {
  options = options || {};

  if (!Array.isArray(array) || !Array.isArray(stages)) { throw new TypeError('Array expected as both parameters'); }

  var res = [];
  copyTo(array, res);

  for (var len=stages.length, i=0; i<len; ++i) {
    var stage = stages[i];

    var stageNames = _.keys(stage);
    if (stageNames.length !== 1) { throw new Error('Each stage must have exactly one stage operator'); }

    var stageName = stageNames[0];

    var stageFn = _aggregateStageOps[stageName];
    if (!stageFn) { throw new Error('Invalid stage operator'); }

    var stageParams = stage[stageName];

    res = stageFn(res, stageParams, options);
  }

  return res;
};


module.exports = aggregate;
module.exports._parseFieldPath = _parseFieldPath;
module.exports._aggregateStageOps = _aggregateStageOps;
