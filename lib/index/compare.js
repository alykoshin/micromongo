/**
 * Value ordering for ordered indexes.
 *
 * A total order over the value types micromongo stores, so the index can keep
 * entries sorted and answer range queries by binary search. This mirrors the
 * *intent* of MongoDB's BSON type-bracketed ordering (different types sort by a
 * fixed type rank, same-type values compare naturally) closely enough for the
 * in-memory case — it is NOT byte-for-byte BSON comparison (no Decimal128,
 * ObjectId, BinData, etc.; those degrade to a stable-but-arbitrary order).
 *
 * IMPORTANT: this order must agree with how the match engine and the Cursor sort
 * compare values, so that an index-served range/sort returns the same docs in the
 * same order as a linear scan would. The match engine uses JS `<`/`>`; the Cursor
 * sort uses `<`/`>` too. We therefore use JS relational comparison for same-type
 * scalars and only add a type-rank tiebreak for cross-type ordering (which a
 * well-formed query never relies on for correctness).
 */

'use strict';

// Type rank — lower sorts first. Roughly MongoDB's bracket order for the types we
// support: null < numbers < strings < objects < arrays < booleans < dates.
function typeRank(v) {
  if (v === null || typeof v === 'undefined') { return 0; }
  if (typeof v === 'number') { return 1; }
  if (typeof v === 'string') { return 2; }
  if (typeof v === 'boolean') { return 4; }
  if (v instanceof Date) { return 5; }
  if (Array.isArray(v)) { return 6; }
  if (typeof v === 'object') { return 3; }
  return 7;
}

/**
 * Compare two scalar/Date values. Returns <0, 0, >0.
 * For same-type comparable values uses JS relational operators (so it matches the
 * scan); for different types falls back to the type rank.
 */
function compareValues(a, b) {
  var ra = typeRank(a), rb = typeRank(b);
  if (ra !== rb) { return ra < rb ? -1 : 1; }

  // same type
  if (ra === 0) { return 0; } // null == null
  if (a instanceof Date && b instanceof Date) {
    var ta = a.getTime(), tb = b.getTime();
    return ta < tb ? -1 : (ta > tb ? 1 : 0);
  }
  if (a < b) { return -1; }
  if (a > b) { return 1; }
  // equal under <, > (covers numbers, strings, booleans); objects/arrays we treat
  // as equal-keyed (rare as an indexed key) — a stable tiebreak isn't needed since
  // the planner still validates membership against the actual query.
  return 0;
}

/**
 * Compare two index KEYS. A key is either a scalar (single-field index) or an
 * array of scalars (compound index), compared lexicographically.
 */
function compareKeys(a, b) {
  var aArr = Array.isArray(a), bArr = Array.isArray(b);
  if (aArr || bArr) {
    var ka = aArr ? a : [ a ];
    var kb = bArr ? b : [ b ];
    var n = Math.min(ka.length, kb.length);
    for (var i = 0; i < n; ++i) {
      var c = compareValues(ka[i], kb[i]);
      if (c !== 0) { return c; }
    }
    return ka.length - kb.length;
  }
  return compareValues(a, b);
}

module.exports = {
  typeRank: typeRank,
  compareValues: compareValues,
  compareKeys: compareKeys,
};
