/**
 * Aggregation expression evaluator.
 *
 * The value-computing counterpart to the boolean match engine (`crud/match.js`).
 * `evaluate(expr, doc, vars)` resolves an aggregation expression against a
 * document to a VALUE (number/string/array/object/boolean), recursing through
 * nested operators. Used by $group accumulators and computed $project/$addFields.
 *
 * Expression forms:
 *   "$field.path"         -> field reference (resolves to the doc's value)
 *   "$$var"               -> variable reference (from `vars`, e.g. $map's `as`)
 *   { $op: <args> }       -> operator (recursively evaluated)
 *   { $literal: <v> }     -> literal escape (v returned as-is, no interpretation)
 *   { a: <expr>, ... }    -> object literal whose values are expressions
 *   anything else         -> literal (number, plain string, boolean, null)
 *
 * Coverage is a pragmatic core: arithmetic, string, comparison, conditional,
 * boolean, and the common array operators. Date / type-conversion / set
 * operators are intentionally out of scope for now.
 */

'use strict';

var _ = require('lodash');


function isExpressionObject(v) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) { return false; }
  // an operator object has exactly one key starting with '$'
  var keys = Object.keys(v);
  return keys.length === 1 && keys[0].charAt(0) === '$';
}


/**
 * @param {*} expr   the expression
 * @param {Object} doc the current document (root of "$field" lookups)
 * @param {Object} [vars] variables for "$$name" references
 * @returns {*} the computed value
 */
function evaluate(expr, doc, vars) {
  vars = vars || {};

  // field path / variable reference
  if (typeof expr === 'string' && expr.charAt(0) === '$') {
    if (expr.charAt(1) === '$') {
      // variable: $$name or $$name.path
      var varPath = expr.slice(2);
      var dot = varPath.indexOf('.');
      var name = dot < 0 ? varPath : varPath.slice(0, dot);
      var rest = dot < 0 ? null : varPath.slice(dot + 1);
      var base = vars[name];
      return rest ? _.get(base, rest) : base;
    }
    return _.get(doc, expr.slice(1)); // field reference
  }

  // operator object
  if (isExpressionObject(expr)) {
    var op = Object.keys(expr)[0];
    if (op === '$literal') { return expr.$literal; }
    var fn = expressionOps[op];
    if (typeof fn !== 'function') {
      throw new Error('Unsupported aggregation expression operator: ' + op);
    }
    return fn(expr[op], doc, vars);
  }

  // plain object literal -> evaluate each value
  if (expr !== null && typeof expr === 'object' && !Array.isArray(expr)) {
    var out = {};
    for (var k in expr) { if (expr.hasOwnProperty(k)) {
      out[k] = evaluate(expr[k], doc, vars);
    }}
    return out;
  }

  // arrays in an expression position: evaluate each element
  if (Array.isArray(expr)) {
    return expr.map(function (e) { return evaluate(e, doc, vars); });
  }

  return expr; // literal scalar
}


/** Evaluate an operand list (array form) to concrete values. */
function args(value, doc, vars) {
  return Array.isArray(value)
    ? value.map(function (v) { return evaluate(v, doc, vars); })
    : [ evaluate(value, doc, vars) ];
}

/** MongoDB truthiness: false, null, 0, undefined are falsy; everything else truthy. */
function truthy(v) {
  return !(v === false || v === null || v === 0 || typeof v === 'undefined');
}

function cmp(a, b) {
  if (a < b) { return -1; }
  if (a > b) { return 1; }
  return 0;
}


var expressionOps = {

  // arithmetic
  $add:      function (v, d, vr) { return args(v, d, vr).reduce(function (a, b) { return a + b; }, 0); },
  $multiply: function (v, d, vr) { return args(v, d, vr).reduce(function (a, b) { return a * b; }, 1); },
  $subtract: function (v, d, vr) { var a = args(v, d, vr); return a[0] - a[1]; },
  $divide:   function (v, d, vr) { var a = args(v, d, vr); return a[0] / a[1]; },
  $mod:      function (v, d, vr) { var a = args(v, d, vr); return a[0] % a[1]; },
  $abs:      function (v, d, vr) { return Math.abs(evaluate(v, d, vr)); },
  $ceil:     function (v, d, vr) { return Math.ceil(evaluate(v, d, vr)); },
  $floor:    function (v, d, vr) { return Math.floor(evaluate(v, d, vr)); },
  $round:    function (v, d, vr) { var a = args(v, d, vr); var p = a.length > 1 ? a[1] : 0; var f = Math.pow(10, p); return Math.round(a[0] * f) / f; },
  $sqrt:     function (v, d, vr) { return Math.sqrt(evaluate(v, d, vr)); },
  $pow:      function (v, d, vr) { var a = args(v, d, vr); return Math.pow(a[0], a[1]); },

  // string
  $concat:   function (v, d, vr) { return args(v, d, vr).join(''); },
  $toUpper:  function (v, d, vr) { var s = evaluate(v, d, vr); return s == null ? '' : String(s).toUpperCase(); },
  $toLower:  function (v, d, vr) { var s = evaluate(v, d, vr); return s == null ? '' : String(s).toLowerCase(); },
  $split:    function (v, d, vr) { var a = args(v, d, vr); return String(a[0]).split(a[1]); },
  $strLenCP: function (v, d, vr) { return String(evaluate(v, d, vr)).length; },
  $substrCP: function (v, d, vr) { var a = args(v, d, vr); return String(a[0]).substr(a[1], a[2]); },
  $substr:   function (v, d, vr) { var a = args(v, d, vr); return String(a[0]).substr(a[1], a[2]); },
  $trim:     function (v, d, vr) { var input = (v && v.input !== undefined) ? evaluate(v.input, d, vr) : evaluate(v, d, vr); return String(input).trim(); },

  // comparison (return boolean, except $cmp)
  $eq:  function (v, d, vr) { var a = args(v, d, vr); return _.isEqual(a[0], a[1]); },
  $ne:  function (v, d, vr) { var a = args(v, d, vr); return !_.isEqual(a[0], a[1]); },
  $gt:  function (v, d, vr) { var a = args(v, d, vr); return a[0] > a[1]; },
  $gte: function (v, d, vr) { var a = args(v, d, vr); return a[0] >= a[1]; },
  $lt:  function (v, d, vr) { var a = args(v, d, vr); return a[0] < a[1]; },
  $lte: function (v, d, vr) { var a = args(v, d, vr); return a[0] <= a[1]; },
  $cmp: function (v, d, vr) { var a = args(v, d, vr); return cmp(a[0], a[1]); },

  // conditional
  $cond: function (v, d, vr) {
    var ifExpr, thenExpr, elseExpr;
    if (Array.isArray(v)) { ifExpr = v[0]; thenExpr = v[1]; elseExpr = v[2]; }
    else { ifExpr = v.if; thenExpr = v.then; elseExpr = v.else; }
    return truthy(evaluate(ifExpr, d, vr)) ? evaluate(thenExpr, d, vr) : evaluate(elseExpr, d, vr);
  },
  $ifNull: function (v, d, vr) {
    var a = args(v, d, vr);
    for (var i = 0; i < a.length - 1; ++i) {
      if (a[i] !== null && typeof a[i] !== 'undefined') { return a[i]; }
    }
    return a[a.length - 1];
  },
  $switch: function (v, d, vr) {
    var branches = v.branches || [];
    for (var i = 0; i < branches.length; ++i) {
      if (truthy(evaluate(branches[i].case, d, vr))) { return evaluate(branches[i].then, d, vr); }
    }
    if ('default' in v) { return evaluate(v.default, d, vr); }
    throw new Error('$switch: no matching branch and no default');
  },

  // boolean
  $and: function (v, d, vr) { return args(v, d, vr).every(truthy); },
  $or:  function (v, d, vr) { return args(v, d, vr).some(truthy); },
  $not: function (v, d, vr) { var a = args(v, d, vr); return !truthy(a[0]); },

  // array
  $size:        function (v, d, vr) { var a = evaluate(v, d, vr); return Array.isArray(a) ? a.length : 0; },
  $arrayElemAt: function (v, d, vr) { var a = args(v, d, vr); var arr = a[0], idx = a[1]; if (!Array.isArray(arr)) { return undefined; } return idx < 0 ? arr[arr.length + idx] : arr[idx]; },
  $in:          function (v, d, vr) { var a = args(v, d, vr); return Array.isArray(a[1]) && a[1].some(function (x) { return _.isEqual(x, a[0]); }); },
  $concatArrays:function (v, d, vr) { return args(v, d, vr).reduce(function (acc, arr) { return acc.concat(arr); }, []); },
  $reverseArray:function (v, d, vr) { var a = evaluate(v, d, vr); return Array.isArray(a) ? a.slice().reverse() : a; },
  $map: function (v, d, vr) {
    var input = evaluate(v.input, d, vr);
    if (!Array.isArray(input)) { return null; }
    var as = v.as || 'this';
    return input.map(function (el) {
      var scope = _.assign({}, vr); scope[as] = el;
      return evaluate(v.in, d, scope);
    });
  },
  $filter: function (v, d, vr) {
    var input = evaluate(v.input, d, vr);
    if (!Array.isArray(input)) { return null; }
    var as = v.as || 'this';
    return input.filter(function (el) {
      var scope = _.assign({}, vr); scope[as] = el;
      return truthy(evaluate(v.cond, d, scope));
    });
  },

  // object
  $mergeObjects: function (v, d, vr) {
    var parts = args(v, d, vr);
    var out = {};
    for (var i = 0; i < parts.length; ++i) {
      var p = parts[i];
      if (p !== null && typeof p === 'object' && !Array.isArray(p)) { _.assign(out, p); }
    }
    return out;
  },

};


module.exports = evaluate;
module.exports.evaluate = evaluate;
module.exports.expressionOps = expressionOps;
module.exports._truthy = truthy;
