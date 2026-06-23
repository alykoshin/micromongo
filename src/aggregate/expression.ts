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


function isExpressionObject(v: any) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) { return false; }
  // an operator object has exactly one key starting with '$'
  var keys = Object.keys(v);
  return keys.length === 1 && keys[0].charAt(0) === '$';
}


/**
 * The module value: the callable `evaluate(expr, doc, vars)` plus the statics the
 * aggregate stages and the test suite reach for. The callable is ALSO exposed as
 * `.evaluate`. Typed as one interface for `export = evaluate`.
 */
interface EvaluateFn {
  (expr: any, doc: any, vars?: any): any;
  evaluate: (expr: any, doc: any, vars?: any) => any;
  expressionOps: any;
  _truthy: (v: any) => boolean;
}

/**
 * @param expr   the expression
 * @param doc the current document (root of "$field" lookups)
 * @param [vars] variables for "$$name" references
 * @returns the computed value
 */
var evaluate = (function (expr: any, doc: any, vars?: any): any {
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
    var out: any = {};
    for (var k in expr) { if (expr.hasOwnProperty(k)) {
      out[k] = evaluate(expr[k], doc, vars);
    }}
    return out;
  }

  // arrays in an expression position: evaluate each element
  if (Array.isArray(expr)) {
    return expr.map(function (e: any) { return evaluate(e, doc, vars); });
  }

  return expr; // literal scalar
}) as EvaluateFn;


/** Evaluate an operand list (array form) to concrete values. */
function args(value: any, doc: any, vars: any) {
  return Array.isArray(value)
    ? value.map(function (v: any) { return evaluate(v, doc, vars); })
    : [ evaluate(value, doc, vars) ];
}

/** MongoDB truthiness: false, null, 0, undefined are falsy; everything else truthy. */
function truthy(v: any): boolean {
  return !(v === false || v === null || v === 0 || typeof v === 'undefined');
}

function cmp(a: any, b: any) {
  if (a < b) { return -1; }
  if (a > b) { return 1; }
  return 0;
}


var expressionOps: any = {

  // arithmetic
  $add:      function (v: any, d: any, vr: any) { return args(v, d, vr).reduce(function (a: any, b: any) { return a + b; }, 0); },
  $multiply: function (v: any, d: any, vr: any) { return args(v, d, vr).reduce(function (a: any, b: any) { return a * b; }, 1); },
  $subtract: function (v: any, d: any, vr: any) { var a = args(v, d, vr); return a[0] - a[1]; },
  $divide:   function (v: any, d: any, vr: any) { var a = args(v, d, vr); return a[0] / a[1]; },
  $mod:      function (v: any, d: any, vr: any) { var a = args(v, d, vr); return a[0] % a[1]; },
  $abs:      function (v: any, d: any, vr: any) { return Math.abs(evaluate(v, d, vr)); },
  $ceil:     function (v: any, d: any, vr: any) { return Math.ceil(evaluate(v, d, vr)); },
  $floor:    function (v: any, d: any, vr: any) { return Math.floor(evaluate(v, d, vr)); },
  $round:    function (v: any, d: any, vr: any) { var a = args(v, d, vr); var p = a.length > 1 ? a[1] : 0; var f = Math.pow(10, p); return Math.round(a[0] * f) / f; },
  $sqrt:     function (v: any, d: any, vr: any) { return Math.sqrt(evaluate(v, d, vr)); },
  $pow:      function (v: any, d: any, vr: any) { var a = args(v, d, vr); return Math.pow(a[0], a[1]); },

  // string
  $concat:   function (v: any, d: any, vr: any) { return args(v, d, vr).join(''); },
  $toUpper:  function (v: any, d: any, vr: any) { var s = evaluate(v, d, vr); return s == null ? '' : String(s).toUpperCase(); },
  $toLower:  function (v: any, d: any, vr: any) { var s = evaluate(v, d, vr); return s == null ? '' : String(s).toLowerCase(); },
  $split:    function (v: any, d: any, vr: any) { var a = args(v, d, vr); return String(a[0]).split(a[1]); },
  $strLenCP: function (v: any, d: any, vr: any) { return String(evaluate(v, d, vr)).length; },
  $substrCP: function (v: any, d: any, vr: any) { var a = args(v, d, vr); return String(a[0]).substr(a[1], a[2]); },
  $substr:   function (v: any, d: any, vr: any) { var a = args(v, d, vr); return String(a[0]).substr(a[1], a[2]); },
  $trim:     function (v: any, d: any, vr: any) { var input = (v && v.input !== undefined) ? evaluate(v.input, d, vr) : evaluate(v, d, vr); return String(input).trim(); },

  // comparison (return boolean, except $cmp)
  $eq:  function (v: any, d: any, vr: any) { var a = args(v, d, vr); return _.isEqual(a[0], a[1]); },
  $ne:  function (v: any, d: any, vr: any) { var a = args(v, d, vr); return !_.isEqual(a[0], a[1]); },
  $gt:  function (v: any, d: any, vr: any) { var a = args(v, d, vr); return a[0] > a[1]; },
  $gte: function (v: any, d: any, vr: any) { var a = args(v, d, vr); return a[0] >= a[1]; },
  $lt:  function (v: any, d: any, vr: any) { var a = args(v, d, vr); return a[0] < a[1]; },
  $lte: function (v: any, d: any, vr: any) { var a = args(v, d, vr); return a[0] <= a[1]; },
  $cmp: function (v: any, d: any, vr: any) { var a = args(v, d, vr); return cmp(a[0], a[1]); },

  // conditional
  $cond: function (v: any, d: any, vr: any) {
    var ifExpr, thenExpr, elseExpr;
    if (Array.isArray(v)) { ifExpr = v[0]; thenExpr = v[1]; elseExpr = v[2]; }
    else { ifExpr = v.if; thenExpr = v.then; elseExpr = v.else; }
    return truthy(evaluate(ifExpr, d, vr)) ? evaluate(thenExpr, d, vr) : evaluate(elseExpr, d, vr);
  },
  $ifNull: function (v: any, d: any, vr: any) {
    var a = args(v, d, vr);
    for (var i = 0; i < a.length - 1; ++i) {
      if (a[i] !== null && typeof a[i] !== 'undefined') { return a[i]; }
    }
    return a[a.length - 1];
  },
  $switch: function (v: any, d: any, vr: any) {
    var branches = v.branches || [];
    for (var i = 0; i < branches.length; ++i) {
      if (truthy(evaluate(branches[i].case, d, vr))) { return evaluate(branches[i].then, d, vr); }
    }
    if ('default' in v) { return evaluate(v.default, d, vr); }
    throw new Error('$switch: no matching branch and no default');
  },

  // boolean
  $and: function (v: any, d: any, vr: any) { return args(v, d, vr).every(truthy); },
  $or:  function (v: any, d: any, vr: any) { return args(v, d, vr).some(truthy); },
  $not: function (v: any, d: any, vr: any) { var a = args(v, d, vr); return !truthy(a[0]); },

  // array
  $size:        function (v: any, d: any, vr: any) { var a = evaluate(v, d, vr); return Array.isArray(a) ? a.length : 0; },
  $arrayElemAt: function (v: any, d: any, vr: any) { var a = args(v, d, vr); var arr = a[0], idx = a[1]; if (!Array.isArray(arr)) { return undefined; } return idx < 0 ? arr[arr.length + idx] : arr[idx]; },
  $in:          function (v: any, d: any, vr: any) { var a = args(v, d, vr); return Array.isArray(a[1]) && a[1].some(function (x: any) { return _.isEqual(x, a[0]); }); },
  $concatArrays:function (v: any, d: any, vr: any) { return args(v, d, vr).reduce(function (acc: any, arr: any) { return acc.concat(arr); }, []); },
  $reverseArray:function (v: any, d: any, vr: any) { var a = evaluate(v, d, vr); return Array.isArray(a) ? a.slice().reverse() : a; },
  $map: function (v: any, d: any, vr: any) {
    var input = evaluate(v.input, d, vr);
    if (!Array.isArray(input)) { return null; }
    var as = v.as || 'this';
    return input.map(function (el: any) {
      var scope = _.assign({}, vr); scope[as] = el;
      return evaluate(v.in, d, scope);
    });
  },
  $filter: function (v: any, d: any, vr: any) {
    var input = evaluate(v.input, d, vr);
    if (!Array.isArray(input)) { return null; }
    var as = v.as || 'this';
    return input.filter(function (el: any) {
      var scope = _.assign({}, vr); scope[as] = el;
      return truthy(evaluate(v.cond, d, scope));
    });
  },

  // object
  $mergeObjects: function (v: any, d: any, vr: any) {
    var parts = args(v, d, vr);
    var out: any = {};
    for (var i = 0; i < parts.length; ++i) {
      var p = parts[i];
      if (p !== null && typeof p === 'object' && !Array.isArray(p)) { _.assign(out, p); }
    }
    return out;
  },

};


evaluate.evaluate = evaluate;
evaluate.expressionOps = expressionOps;
evaluate._truthy = truthy;

export = evaluate;
