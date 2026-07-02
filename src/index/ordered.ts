/**
 * OrderedIndex — the single index structure behind every micromongo index TYPE.
 *
 * Like MongoDB (where single-field / multikey / compound are all one B-tree with
 * different metadata), this one structure backs them all:
 *   - single-field : key = the field's value
 *   - multikey     : auto-detected — if a field's value is an array, one entry is
 *                    emitted per element (the index sets `multiKey = true`)
 *   - compound     : spec has >1 field — key = [v1, v2, …], compared lexicographically
 *
 * Entries are kept in a plain array sorted by key (a sorted array, not a tree —
 * build/rebuild is O(n log n), lookups are O(log n) via binary search; for the
 * in-memory target this is the simplest correct structure, and rebuild-after-write
 * keeps it consistent). Lookups return the matching DOCS (deduped — a multikey doc
 * can appear under several keys).
 *
 * The index never decides correctness on its own: the planner validates the
 * returned candidate set against the full query, and a linear scan is always the
 * fallback. So an index that returns a SUPERSET (e.g. a multikey doc matched on one
 * element) is fine — the planner/match engine filters it.
 */

"use strict";

var get = require('lodash/get');
var cmp = require("./compare");

import type { Doc, IndexSpec, IndexEntry, SortDir } from "../types";

class OrderedIndex {
  spec: IndexSpec;
  fields: string[];
  compound: boolean;
  multiKey: boolean;
  entries: IndexEntry[];
  hash: Map<any, Doc[]> | null; // single-field only; key is a genuine value
  hits: number;

  /**
   * @param spec - { field: 1, … } (1 = ascending; we only support ascending
   *                keys — descending sort is served by reversing the slice).
   */
  constructor(spec: IndexSpec | string) {
    if (typeof spec === "string") {
      var s: IndexSpec = {};
      s[spec] = 1;
      spec = s;
    }
    this.spec = spec;
    this.fields = Object.keys(spec);
    this.compound = this.fields.length > 1;
    this.multiKey = false; // set true at build time if any keyed field is an array
    this.entries = []; // sorted [{ key, doc }]
    this.hash = null; // single-field only: Map<value, docs[]> for O(1) equality
    this.hits = 0;
  }

  /** Build the key for a doc given concrete per-field values (already resolved). */
  _keyFromValues(values: any[]): any {
    // returns a scalar (single) or tuple (compound) key — genuine value
    return this.compound ? values.slice() : values[0];
  }

  /**
   * (Re)build from the current docs. Detects multikey. For a single-field index whose
   * value is an array, emits one entry per element (multikey). Compound indexes do not
   * expand arrays (MongoDB forbids >1 array field in a compound key; we simply index
   * the array value as-is for the non-leading fields and treat a leading array like
   * single-field multikey).
   */
  build(docs: Doc[]): void {
    var entries: IndexEntry[] = [];
    this.multiKey = false;
    for (var i = 0; i < docs.length; ++i) {
      var doc = docs[i];
      this._emitEntries(doc, entries);
    }
    entries.sort(function (a: IndexEntry, b: IndexEntry) {
      return cmp.compareKeys(a.key, b.key);
    });
    this.entries = entries;
    this._buildHash(entries);
  }

  /**
   * Equality fast-path: for a SINGLE-FIELD index, also keep a hash Map<value, docs[]>
   * so `eqRange` is O(1) instead of O(log n) binary search. Compound keys are tuples
   * (arrays) — not hashable by value — so compound indexes skip the hash and use the
   * sorted entries (compound point-eq is rare; prefix queries are a range anyway).
   * The hash is a pure accelerator over the SAME entries; it never changes results.
   */
  _buildHash(entries: IndexEntry[]): void {
    if (this.compound) {
      this.hash = null;
      return;
    }
    var hash = new Map();
    for (var i = 0; i < entries.length; ++i) {
      var k = entries[i].key,
        doc = entries[i].doc;
      var bucket = hash.get(k);
      if (bucket) {
        // dedupe: a multikey doc with repeated element values appears once per key
        if (bucket[bucket.length - 1] !== doc && bucket.indexOf(doc) === -1) {
          bucket.push(doc);
        }
      } else {
        hash.set(k, [doc]);
      }
    }
    this.hash = hash;
  }

  _emitEntries(doc: Doc, entries: IndexEntry[]): void {
    var self = this;
    // Resolve each field; if exactly one field is an array, fan out over its elements
    // (multikey). (We support multikey on the single-field case and on the leading
    // field of a compound index — the common shapes.)
    var values = this.fields.map(function (f: string) {
      return get(doc, f);
    });

    // find an array-valued field to expand (first one)
    var arrIdx = -1;
    for (var j = 0; j < values.length; ++j) {
      if (Array.isArray(values[j])) {
        arrIdx = j;
        break;
      }
    }

    if (arrIdx === -1) {
      entries.push({ key: this._keyFromValues(values), doc: doc });
      return;
    }

    self.multiKey = true;
    var arr = values[arrIdx];
    if (arr.length === 0) {
      // empty array: index it under `undefined` for that slot (so $size/equality to []
      // still falls back to scan correctly; the planner validates anyway).
      var v0 = values.slice();
      v0[arrIdx] = undefined;
      entries.push({ key: this._keyFromValues(v0), doc: doc });
      return;
    }
    for (var k = 0; k < arr.length; ++k) {
      var vv = values.slice();
      vv[arrIdx] = arr[k];
      entries.push({ key: this._keyFromValues(vv), doc: doc });
    }
  }

  // --- binary search over the sorted entries -----------------------------------

  /** First index with entries[i].key >= key. */
  _lowerBound(key: any): number {
    var lo = 0,
      hi = this.entries.length;
    while (lo < hi) {
      var mid = (lo + hi) >>> 1;
      if (cmp.compareKeys(this.entries[mid].key, key) < 0) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo;
  }

  /** First index with entries[i].key > key. */
  _upperBound(key: any): number {
    var lo = 0,
      hi = this.entries.length;
    while (lo < hi) {
      var mid = (lo + hi) >>> 1;
      if (cmp.compareKeys(this.entries[mid].key, key) <= 0) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo;
  }

  /** Collect deduped docs from entries[start..end). */
  _collect(start: number, end: number): Doc[] {
    var out: Doc[] = [];
    var seen = typeof Set !== "undefined" ? new Set<Doc>() : null;
    for (var i = start; i < end; ++i) {
      var doc = this.entries[i].doc;
      if (seen) {
        if (seen.has(doc)) {
          continue;
        }
        seen.add(doc);
      }
      out.push(doc);
    }
    return out;
  }

  /**
   * Equality: all docs whose key == `key` (key is a scalar for single-field, or a
   * full/partial tuple for compound — partial tuples match a PREFIX range).
   */
  eqRange(key: any): Doc[] {
    // key: a genuine query value (scalar or tuple)
    this.hits++;
    // O(1) hash fast-path for single-field equality on a primitive key. (Map's
    // SameValueZero equality agrees with compareKeys for primitives; objects/arrays
    // as keys fall through to the binary search, and the planner re-filters anyway.)
    if (this.hash && (key === null || typeof key !== "object")) {
      var bucket = this.hash.get(key);
      return bucket ? bucket.slice() : [];
    }
    var lo = this._lowerBound(key);
    var hi = this._upperBound(key);
    return this._collect(lo, hi);
  }

  /**
   * Range over a single-field (or leading-field) key: { gt, gte, lt, lte } bounds
   * (any subset). Inclusive/exclusive handled via lower/upper bound choice.
   */
  range(bounds: { gt?: any; gte?: any; lt?: any; lte?: any }): Doc[] {
    this.hits++;
    var start = 0,
      end = this.entries.length;
    if ("gte" in bounds) {
      start = this._lowerBound(bounds.gte);
    } else if ("gt" in bounds) {
      start = this._upperBound(bounds.gt);
    }
    if ("lte" in bounds) {
      end = this._upperBound(bounds.lte);
    } else if ("lt" in bounds) {
      end = this._lowerBound(bounds.lt);
    }
    if (end < start) {
      end = start;
    }
    return this._collect(start, end);
  }

  /**
   * All docs in key order (for a sort served by the index). For a single-field
   * ascending index this is the full sorted doc list (deduped); `dir = -1` reverses.
   */
  sorted(dir: SortDir): Doc[] {
    this.hits++;
    var docs = this._collect(0, this.entries.length);
    if (dir === -1) {
      docs.reverse();
    }
    return docs;
  }
}

export = OrderedIndex;
