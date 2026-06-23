/**
 * Created by alykoshin on 30.03.16.
 *
 * Projection engine. Converted to TypeScript as a Phase-T1 pilot for the
 * **callable-export-with-attached-statics** shape: the module's value is the
 * callable `project(source, projection, query)`, and aggregate's `$project`
 * stage reaches in for the `_`-prefixed helpers (`_projectionMode`, `_initDoc`,
 * `_validateProjection`, `_projectIncludeExclude`, `_includeField`,
 * `_excludeField`). To preserve `require('./project')` returning the callable
 * **and** exposing those statics, we type the value as a `ProjectFn` interface
 * (callable signature + the static members) and `export = project`; the statics
 * are assigned to the function object at runtime below. Under `module:commonjs`
 * this emits `module.exports = project` with `project._initDoc = …` etc. — the
 * same object surface `require('./project')._initDoc` resolved before the
 * migration.
 *
 * Engine internals stay pragmatically `any` (Mongo documents/projections are
 * dynamic) — T1/T2 type the *boundaries*, not these inner dynamic seams.
 */

'use strict';

//var assert = require('assert');
var _ = require('lodash');
var util = require('util');
var deepAssign = require('mini-deep-assign');

var settings = require('../settings');
var match = require('./match');
var textSearch = require('./text');

/**
 * If true, handle _id similar to Mongodb,
 * i.e. include _id by default in result document,
 * do not validate projection value against exlusion/inclusion modes.
 *
 * Read at use (not cached) so `mm.configure({ idProjectionMongo })` takes effect.
 */
function idProjectionMongo(): boolean { return settings.idProjectionMongo; }


var includeField = function(source: any, target: any, path: string): void {
  var value = _.get(source, path);  // get value at path
  value = deepAssign({}, value);       // make full copy
  _.set(target, path, value);
};


var excludeField = function(source: any, target: any, path: string): void {
  _.unset(target, path);
};


/**
 * A projection value may be an operator document ({ $slice: … }, { $elemMatch: … },
 * { $: … }) instead of a plain 0/1. Such fields are applied separately and do not
 * participate in inclusion/exclusion mode detection.
 * @returns the operator name, or null if `value` is a plain projection
 */
var _projectionOperator = function(value: any): string | null {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (var k in value) { if (value.hasOwnProperty(k)) {
      if (k === '$slice' || k === '$elemMatch' || k === '$' || k === '$meta') { return k; }
    }}
  }
  return null;
};


/**
 * Apply a $slice projection to the array at `path` in `target`.
 * count: positive => first n, negative => last n.
 * [skip, limit]: skip (neg = from end) then take limit.
 */
var _applySlice = function(target: any, path: string, spec: any): void {
  var arr = _.get(target, path);
  if (!Array.isArray(arr)) { return; } // $slice on a non-array field is a no-op
  var result;
  if (typeof spec === 'number') {
    result = spec >= 0 ? arr.slice(0, spec) : arr.slice(spec);
  } else if (Array.isArray(spec) && spec.length === 2) {
    var skip = spec[0], limit = spec[1];
    var start = skip >= 0 ? skip : Math.max(arr.length + skip, 0);
    result = arr.slice(start, start + limit);
  } else {
    throw new Error('Invalid $slice projection value: ' + JSON.stringify(spec));
  }
  _.set(target, path, result);
};


/**
 * Apply an $elemMatch projection: limit the array at `path` to the FIRST element
 * (from `source`) matching `condition`. If no element matches, the field is
 * removed from `target` (Mongo omits it entirely).
 */
var _applyElemMatch = function(source: any, target: any, path: string, condition: any): void {
  var arr = _.get(source, path);
  if (!Array.isArray(arr)) { _.unset(target, path); return; }
  var preparedQuery = match.prepareQuery({ _v: condition });
  for (var i = 0; i < arr.length; ++i) {
    if (match({ _v: arr[i] }, preparedQuery)) {
      _.set(target, path, [ deepAssign({}, arr[i]) ]); // single-element array, deep copy
      return;
    }
  }
  _.unset(target, path); // no match => field omitted
};


/**
 * Apply a positional `$` projection on `field.$`: limit the array at `field` to
 * the first element matching the condition that the *query* applied to that same
 * field. Requires the originating query. The condition on `field` in the query is
 * reused to pick the element.
 */
var _applyPositional = function(source: any, target: any, fieldDollarPath: string, query: any): void {
  // fieldDollarPath is e.g. 'grades.$' — the array field is everything before '.$'.
  var field = fieldDollarPath.replace(/\.\$$/, '');
  var arr = _.get(source, field);
  if (!Array.isArray(arr)) { _.unset(target, field); return; }
  if (!query || typeof query !== 'object' || !(field in query)) {
    throw new Error('Positional $ projection requires the array field (\'' + field + '\') in the query');
  }
  var condition = query[field];
  var preparedQuery = match.prepareQuery({ _v: condition });
  for (var i = 0; i < arr.length; ++i) {
    if (match({ _v: arr[i] }, preparedQuery)) {
      _.set(target, field, [ deepAssign({}, arr[i]) ]);
      return;
    }
  }
  _.unset(target, field);
};


var _validateProjectionValue = function(projectionValue: any): void {
  var allowedProjectionValues = [ false, true, 0, 1 ];
  if (allowedProjectionValues.indexOf(projectionValue) < 0) {
    throw new Error('Values for projection musty be [' + allowedProjectionValues.join(', ') + '], found: '+JSON.stringify(projectionValue));
  }
};


var _projectionModeByValue = function(value: any): 'inclusion' | 'exclusion' {
  return value ? 'inclusion' : 'exclusion';
};

/**
 * Determine projection mode basing on values in projection
 *
 * _id has special handling in mongodb projections
 * we have no _id, so we'll ignore settings for _id field name
 *
 * @param projection - object with set of field names with values:
 *                              0 || false - to exclude the field specified (exclusion mode)
 *                              1 || true  - to include the field specified (inclusion mode)
 * @returns exclusion mode (return all the fields except listed),
 *          or inclusion (return only listed fields)
 */
var projectionMode = function(projection: any): 'inclusion' | 'exclusion' {

  for (var path in projection) { if (projection.hasOwnProperty(path)) {

    var projOp = _projectionOperator(projection[path]);
    if (projOp === '$slice') { continue; }      // $slice does not drive mode
    if (projOp === '$elemMatch' || projOp === '$' || projOp === '$meta') { return 'inclusion'; } // these imply inclusion

    _validateProjectionValue(projection[path]);
    // Handle _id similar to Mongo
    if (idProjectionMongo() && path === '_id') { continue; } // ignore value _id when determining projectionMode

    return _projectionModeByValue(projection[path]);
  }}

  return 'exclusion'; // if projection is empty, set mode to 'exclusion', i.e. include all doc fields
};


var initDoc = function(source: any, target: any, mode: 'inclusion' | 'exclusion'): any {
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


var validateProjection = function(mode: any, path: string, projectionValue: any): any {
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
 */
var projectIncludeExclude = function(source: any, target: any, path: string, projection: any): void {
  if (!projection) {
    excludeField(source, target, path);

  } else if ( path !== '_id' || (path === '_id' && !idProjectionMongo()) ) {
    includeField(source, target, path);
  }
};



/**
 * The module value: the callable projector plus the `_`-prefixed statics that
 * aggregate's $project stage and the test suite reach for. Typing it as one
 * interface (rather than a merged `namespace`, which can't merge with a
 * `var`-bound function expression) gives a precise `.d.ts` for `export =`.
 */
interface ProjectFn {
  (source: any, projection: any, query?: any): any;
  _includeField: (source: any, target: any, path: string) => void;
  _excludeField: (source: any, target: any, path: string) => void;
  _projectionMode: (projection: any) => 'inclusion' | 'exclusion';
  _initDoc: (source: any, target: any, mode: 'inclusion' | 'exclusion') => any;
  _validateProjection: (mode: any, path: string, projectionValue: any) => any;
  _projectIncludeExclude: (source: any, target: any, path: string, projection: any) => void;
}

var project = (function(source: any, projection: any, query?: any): any {
  var mode = projectionMode(projection);
  //var mode = null;
  var target: any = {};
  //var target = initDoc(source, target, mode);
  initDoc(source, target, mode);

  var operatorFields: any[] = []; // applied after inclusion/exclusion
  var positionalFields: any[] = []; // 'field.$' projections, applied with the query

  // iterate through projection properties
  for (var path in projection) { if (projection.hasOwnProperty(path)) {

    // Positional '$' projection uses the KEY form 'field.$': 1
    if (/\.\$$/.test(path)) {
      if (mode !== 'inclusion') { mode = 'inclusion'; }
      positionalFields.push(path);
      continue;
    }

    var op = _projectionOperator(projection[path]);
    if (op) {
      // $slice needs the field present to act on (copy it in inclusion mode; in
      // exclusion mode the full copy already has it). $elemMatch builds its own
      // result from `source`, so don't pre-copy.
      if (op === '$slice' && mode === 'inclusion') { includeField(source, target, path); }
      operatorFields.push({ path: path, op: op, spec: projection[path][op] });
      continue;
    }

    mode = validateProjection(mode, path, projection[ path ]);
    //mode = projectionCheckInit(source, target, mode, path, projection[ path ]);
    projectIncludeExclude(source, target, path, projection[ path ]);

  }}

  // Apply $slice / $elemMatch operator projections.
  for (var i = 0; i < operatorFields.length; ++i) {
    var f = operatorFields[i];
    if (f.op === '$slice') {
      _applySlice(target, f.path, f.spec);
    } else if (f.op === '$elemMatch') {
      _applyElemMatch(source, target, f.path, f.spec);
    } else if (f.op === '$meta') {
      // { field: { $meta: "textScore" } } — write the $text relevance score for
      // this document (NaN/undefined if there was no $text query in the operation).
      if (f.spec === 'textScore') {
        var score = textSearch.getScore(source);
        _.set(target, f.path, typeof score === 'undefined' ? null : score);
      } else {
        throw new Error('$meta: only "textScore" is supported (got ' + JSON.stringify(f.spec) + ')');
      }
    } else {
      throw new Error('Projection operator not implemented: ' + f.op);
    }
  }

  // Apply positional '$' projections (need the originating query).
  for (var j = 0; j < positionalFields.length; ++j) {
    _applyPositional(source, target, positionalFields[j], query);
  }

  return target;
}) as ProjectFn;


// Attach the `_`-prefixed statics that aggregate's $project stage (and the test
// suite) reach for. Assigning to the function object emits, under module:commonjs,
// `project._includeField = …` etc. — identical to the old hand-written CJS tail.
project._includeField = includeField;
project._excludeField = excludeField;

project._projectionMode = projectionMode;
project._initDoc = initDoc;

project._validateProjection = validateProjection;

project._projectIncludeExclude = projectIncludeExclude;


// `export = project` reproduces `module.exports = project` (the callable IS the
// module), with the statics attached above carried on the `ProjectFn` type.
export = project;
