/**
 * Minimal query planner.
 *
 * Given a query and a Collection's indexes, decide whether an index can supply a
 * candidate set of docs cheaper than a full scan — and return it. The planner is
 * deliberately conservative and SAFE BY CONSTRUCTION:
 *
 *   - It only ever returns a SUPERSET of the true matches (or the exact set). The
 *     caller re-runs the full match() over the candidates unless the plan is marked
 *     `exact`, so a loose plan can never return wrong results — only fewer docs to
 *     scan.
 *   - If nothing fits, it returns null and the caller does a linear scan.
 *
 * Supported plans (in priority order):
 *   1. single-field equality        { f: v } / { f: { $eq: v } }      → exact
 *   2. single-field range           { f: { $gt/$gte/$lt/$lte: … } }   → exact
 *   3. compound prefix equality     { a: v, b: w } on index {a,b}     → exact-ish (re-filtered)
 *   4. $in on an indexed field      { f: { $in: [..] } }              → exact (union of eqRanges)
 *   5. $or where every branch is индекс-served                        → union, re-filtered
 *
 * "exact" means the candidate set equals the match set, so the caller may skip the
 * re-filter. Everything else is returned with exact=false → caller re-filters.
 */

'use strict';

import type { Doc, Query } from '../types';

var RANGE_OPS: Record<string, string> = { $gt: 'gt', $gte: 'gte', $lt: 'lt', $lte: 'lte' };

function isPlainObject(v: any /* value */): boolean {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !(v instanceof RegExp);
}

/** Extract a {gt,gte,lt,lte} bounds object from a field condition, or null. */
function rangeBounds(cond: any /* value */): Record<string, any> | null {
  if (!isPlainObject(cond)) { return null; }
  var keys = Object.keys(cond);
  if (keys.length === 0) { return null; }
  var bounds: Record<string, any> = {}; // values are genuine operand values
  for (var i = 0; i < keys.length; ++i) {
    var op = RANGE_OPS[keys[i]];
    if (!op) { return null; } // a non-range operator present → not a pure range
    bounds[op] = cond[keys[i]];
  }
  return bounds;
}

/** Is this condition a plain equality value (not an operator object / regex)? */
function isEqualityValue(cond: any /* value */): boolean {
  if (isPlainObject(cond)) {
    var keys = Object.keys(cond);
    return keys.length === 1 && keys[0] === '$eq';
  }
  return !(cond instanceof RegExp);
}
function equalityValue(cond: any /* value */): any /* value */ {
  return (isPlainObject(cond) && '$eq' in cond) ? cond.$eq : cond;
}


/**
 * @param query
 * @param indexes  field-name(joined) → OrderedIndex (Collection._indexes)
 * @param getIndexFor  (fieldsArrayOrName) → OrderedIndex | undefined
 * @returns the plan or null when no index fits.
 *
 * The returned `explain` describes the plan (stage, index, fields, multiKey,
 * usedHash) for Collection.find().explain(); it carries no docs.
 */
function indexId(idx: any /* OrderedIndex — not importable here (cycle) */): string { return idx.fields.map(function (f: string) { return f + '_' + idx.spec[f]; }).join('_'); }

function plan(query: Query, indexes: Record<string, any> /* name → OrderedIndex */, getIndexFor: (f: any) => any): { docs: Doc[]; exact: boolean; explain: any /* metadata */ } | null {
  if (!query || typeof query !== 'object' || Array.isArray(query)) { return null; }
  var keys = Object.keys(query);

  // --- $or: union of per-branch plans (every branch must be index-served) -------
  if (keys.length === 1 && keys[0] === '$or') {
    var branches = query.$or;
    if (!Array.isArray(branches) || branches.length === 0) { return null; }
    var union: Doc[] = [];
    var seen = new Set();
    var branchPlans: any[] = []; // explain metadata, heterogeneous
    for (var b = 0; b < branches.length; ++b) {
      var sub = plan(branches[b], indexes, getIndexFor);
      if (!sub) { return null; } // a branch can't use an index → scanning the whole array is simpler
      branchPlans.push(sub.explain);
      for (var d = 0; d < sub.docs.length; ++d) {
        if (!seen.has(sub.docs[d])) { seen.add(sub.docs[d]); union.push(sub.docs[d]); }
      }
    }
    // $or candidates need re-filtering (each branch's own predicate must still hold).
    return { docs: union, exact: false, explain: { stage: 'OR', branches: branchPlans } };
  }

  // --- single-field equality / range -------------------------------------------
  if (keys.length === 1) {
    var field = keys[0];
    if (field.charAt(0) === '$') { return null; } // a logical op other than $or
    var cond = query[field];
    var idx = getIndexFor(field);
    if (!idx) { return null; }

    // $in → union of equality ranges
    if (isPlainObject(cond) && Object.keys(cond).length === 1 && '$in' in cond && Array.isArray(cond.$in)) {
      var inUnion: Doc[] = [];
      var inSeen = new Set();
      for (var v = 0; v < cond.$in.length; ++v) {
        var hit = idx.eqRange(cond.$in[v]);
        for (var h = 0; h < hit.length; ++h) {
          if (!inSeen.has(hit[h])) { inSeen.add(hit[h]); inUnion.push(hit[h]); }
        }
      }
      // multikey can over-return; re-filter to be safe.
      return { docs: inUnion, exact: !idx.multiKey,
        explain: { stage: 'IXSCAN', index: indexId(idx), field: field, op: '$in', multiKey: idx.multiKey, usedHash: !!idx.hash } };
    }

    if (isEqualityValue(cond)) {
      var docsEq = idx.eqRange(equalityValue(cond));
      return { docs: docsEq, exact: !idx.multiKey,
        explain: { stage: 'IXSCAN', index: indexId(idx), field: field, op: 'eq', multiKey: idx.multiKey, usedHash: !!idx.hash } };
    }

    var bounds = rangeBounds(cond);
    if (bounds) {
      var docsR = idx.range(bounds);
      return { docs: docsR, exact: !idx.multiKey,
        explain: { stage: 'IXSCAN', index: indexId(idx), field: field, op: 'range', bounds: Object.keys(bounds), multiKey: idx.multiKey } };
    }
    return null; // operator we don't index ($regex, $ne, $exists, …)
  }

  // --- compound prefix: all keys are plain equality AND a compound index covers a prefix
  var allEq = true;
  for (var k = 0; k < keys.length; ++k) {
    if (keys[k].charAt(0) === '$' || !isEqualityValue(query[keys[k]])) { allEq = false; break; }
  }
  if (allEq) {
    var cidx = getIndexFor(keys); // a compound index whose leading fields match these keys
    if (cidx) {
      // Build the prefix key in the index's field order; eqRange on the (partial) tuple
      // works because compareKeys compares lexicographically and a shorter query tuple
      // matches the prefix range.
      var prefix: any[] = []; // tuple of equality operand values
      var usable = true;
      for (var fi = 0; fi < cidx.fields.length; ++fi) {
        var f = cidx.fields[fi];
        if (!(f in query)) { break; } // prefix ends here
        if (!isEqualityValue(query[f])) { usable = false; break; }
        prefix.push(equalityValue(query[f]));
      }
      if (usable && prefix.length > 0) {
        // A partial prefix matches a key range (compareKeys is lexicographic); a full
        // prefix is an exact tuple. Either way re-filter, since extra query fields
        // beyond the index prefix still need checking.
        var cdocs = cidx.eqRange(prefix);
        return { docs: cdocs, exact: false,
          explain: { stage: 'IXSCAN', index: indexId(cidx), op: 'compound-prefix', prefixFields: cidx.fields.slice(0, prefix.length) } };
      }
    }
    // fall back: use a single-field index on any one of the equality fields, re-filter.
    for (var ki = 0; ki < keys.length; ++ki) {
      var sidx = getIndexFor(keys[ki]);
      if (sidx) {
        var sdocs = sidx.eqRange(equalityValue(query[keys[ki]]));
        return { docs: sdocs, exact: false,
          explain: { stage: 'IXSCAN', index: indexId(sidx), field: keys[ki], op: 'eq', note: 'partial — other fields re-filtered', usedHash: !!sidx.hash } };
      }
    }
  }

  return null;
}

var planner = { plan: plan, rangeBounds: rangeBounds, isEqualityValue: isEqualityValue };
export = planner;
