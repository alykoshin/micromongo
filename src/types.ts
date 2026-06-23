/**
 * Shared boundary types for micromongo's TypeScript source.
 *
 * Scope (per the T2 migration plan): type the **public surface** — the shapes a
 * consumer sees through `require('micromongo')` — precisely, and leave the
 * recursive match/aggregate dispatch pragmatically `any`/`unknown` at its
 * genuinely dynamic seams (operator-table dispatch, `_.get` path access). Mongo
 * documents are open-ended bags of fields, so `Doc`/`Query`/`UpdateSpec` are
 * deliberately permissive index signatures rather than false precision.
 *
 * These are plain `export`ed interfaces (a normal ES module); other `src/*.ts`
 * modules `import type { … } from './types'` (or a relative path). Type-only
 * imports erase at compile time, so they add nothing to the emitted CJS.
 */

'use strict';

/** A document — an arbitrary object in a collection. */
export interface Doc {
  _id?: any;
  [field: string]: any;
}

/** A query / filter expression (Mongo find-style). Permissive by nature. */
export interface Query {
  [field: string]: any;
}

/** A projection spec: field → 0/1/false/true or a projection operator doc. */
export interface Projection {
  [field: string]: 0 | 1 | boolean | { [op: string]: any };
}

/** An update spec — either operator-form (`{ $set: … }`) or a replacement doc. */
export interface UpdateSpec {
  [op: string]: any;
}

/** Options accepted by the write/update family. */
export interface WriteOptions {
  upsert?: boolean;
  multi?: boolean;
  arrayFilters?: Query[];
  [opt: string]: any;
}

/**
 * The driver-shaped report returned by the update family
 * (`updateOne`/`updateMany`/`replaceOne`/`findOneAnd*`). `upsertedId`/
 * `upsertedCount` appear only when `{ upsert: true }` actually inserts.
 */
export interface UpdateReport {
  acknowledged: boolean;
  matchedCount: number;
  modifiedCount: number;
  upsertedId?: any;
  upsertedCount?: number;
  [extra: string]: any;
}

/** A single index field's sort direction. */
export type SortDir = 1 | -1;

/** An index key spec: `{ a: 1, b: -1 }` (compound) or a bare field name. */
export interface IndexSpec {
  [field: string]: SortDir;
}

/**
 * The plan/`explain()` metadata surfaced by `Collection.find(q).explain()`.
 * `stage` is the chosen access path; the rest describe how it was served.
 */
export interface ExplainPlan {
  stage: 'COLLSCAN' | 'IXSCAN' | 'IXSCAN+FILTER' | 'OR' | string;
  index?: string;
  field?: string;
  op?: string;
  exact?: boolean;
  usedHash?: boolean;
  multiKey?: boolean;
  candidates?: number;
  totalDocs?: number;
  sortFromIndex?: boolean;
  [extra: string]: any;
}

/** Settings shape (`mm.configure`). */
export interface Settings {
  idProjectionMongo: boolean;
  whereTimeout: number;
  textSearch: 'lightweight' | 'stemming' | 'exact';
}

/** Operator-registration kinds for `registerOperator(kind, name, fn)`. */
export type OperatorKind = 'pre' | 'post' | 'preprocess';
