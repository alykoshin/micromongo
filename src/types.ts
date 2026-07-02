/**
 * Shared boundary types for micromongo's TypeScript source.
 *
 * Scope: type the **public surface** precisely, and type the engine internals as
 * what they actually are — *objects with open values* (`Document`), `Query`,
 * `UpdateSpec`, etc. This mirrors the official MongoDB Node driver, whose base type
 * is `Document = { [key: string]: any }`. `any` is reserved for genuine value
 * positions where the content can be a scalar, an object, or undefined (array
 * elements, `_.get(doc, path)` results, `$where`/expression-eval outputs).
 *
 * These are plain `export`ed interfaces (a normal ES module); other `src/*.ts`
 * modules `import type { … } from './types'` (or a relative path). Type-only
 * imports erase at compile time, so they add nothing to the emitted CJS.
 */

'use strict';

/**
 * An object with open-typed values — the base "bag of fields" type, analogous to
 * the MongoDB driver's `Document`. The right type for engine params that are
 * documents / sources / targets / option bags.
 */
export interface Document {
  [field: string]: any;
}

/** A document in a collection (a `Document` that may carry an `_id`). */
export interface Doc {
  _id?: any;
  [field: string]: any;
}

/**
 * A genuine value position — what a field can actually hold, or what `_.get`
 * returns, or an array element. A value can be a scalar, an object, an array, or
 * absent — so this is honestly `any` (use it to mark "value, intentionally open"
 * vs. an un-triaged `any`). Kept as `any` rather than `unknown` to avoid forcing
 * guards through the dynamic engine; narrow to `unknown` opportunistically.
 */
export type MongoValue = any;

/** One entry in an OrderedIndex's sorted array: a key paired with its source doc. */
export interface IndexEntry {
  key: any;     // scalar (single-field) or tuple (compound); compared via compare.ts
  doc: Doc;
}

// ---------------------------------------------------------------------------
// Query / filter typing — generic on the document shape `T`, modeled after the
// MongoDB Node driver (`Filter<TSchema>` / `Condition<T>` / `FilterOperators<V>`).
// `Query` (the bare form) defaults `T = Document`, so the ~85 internal engine
// uses stay permissive and unchanged; the PUBLIC API parameterizes it
// (`find<T>(array: T[], query?: Query<T>)`) so — when the caller passes a typed
// array — field names and per-operator operand types are checked. The trailing
// open string index keeps dot-notation paths and extra keys permissive, matching
// the driver's non-strict default (deep path typing would hit TS's recursion
// limit; the driver makes that opt-in too).
// ---------------------------------------------------------------------------

/** The operators micromongo supports as a per-field condition, value-typed against `V`. */
export interface FilterOperators<V> {
  $eq?: V;
  $ne?: V;
  $gt?: V;
  $gte?: V;
  $lt?: V;
  $lte?: V;
  $in?: V[];
  $nin?: V[];
  $exists?: boolean;
  $type?: string | number;
  $regex?: RegExp | string;
  $options?: string;
  $mod?: [number, number];
  $all?: any[];
  $elemMatch?: Query<any>;
  $size?: number;
  $not?: FilterOperators<V> | RegExp;
  $bitsAllSet?: number | number[];
  $bitsAnySet?: number | number[];
  $bitsAllClear?: number | number[];
  $bitsAnyClear?: number | number[];
  $near?: any;
  $nearSphere?: any;
  $geoWithin?: any;
  $geoIntersects?: any;
}

/** A per-field condition: a literal value of the field's type, or an operator doc. */
export type Condition<V> = V | FilterOperators<V>;

/**
 * A query / filter over documents of shape `T`. Each known field of `T` accepts a
 * `Condition` (value or operator doc); the root logical operators take arrays of
 * queries; the open string index admits dot-notation paths and any other key
 * (permissive, like the driver's default). `Query` (no arg) = `Query<Document>`.
 */
export type Query<T = Document> = {
  [K in keyof T]?: Condition<T[K]>;
} & RootFilterOperators<T> & {
  [dotPathOrOp: string]: any;
};

/** Top-level logical / whole-document query operators. */
export interface RootFilterOperators<T> {
  $and?: Query<T>[];
  $or?: Query<T>[];
  $nor?: Query<T>[];
  $where?: string | ((this: T) => boolean);
  $text?: { $search: string; [opt: string]: any };
  $comment?: any;
  $expr?: any;   // an aggregation expression, e.g. { $gt: ['$a', '$b'] }
}

/** A projection spec: field → 0/1/false/true or a projection operator doc. */
export interface Projection {
  [field: string]: 0 | 1 | boolean | { [op: string]: any };
}

/**
 * An update spec over documents of shape `T` — operator-form (`{ $set: … }`).
 * `$set`/`$setOnInsert` map over the schema (`Partial<T>`); the open index keeps
 * other operators and dotted paths permissive. `UpdateSpec` = `UpdateSpec<Document>`.
 */
export type UpdateSpec<T = Document> = {
  $set?: Partial<T> & Record<string, any>;
  $setOnInsert?: Partial<T> & Record<string, any>;
  $unset?: Record<string, any>;
  $inc?: Record<string, number>;
  $mul?: Record<string, number>;
  $min?: Partial<T> & Record<string, any>;
  $max?: Partial<T> & Record<string, any>;
  $rename?: Record<string, string>;
  $currentDate?: Record<string, any>;
  $bit?: Record<string, any>;
  $push?: Record<string, any>;
  $addToSet?: Record<string, any>;
  $pop?: Record<string, 1 | -1>;
  $pull?: Record<string, any>;
  $pullAll?: Record<string, any[]>;
} & {
  [op: string]: any;
};

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
  // Always present, matching the driver's UpdateResult: 0 / null when no upsert occurred.
  upsertedCount: number;
  upsertedId: any;
  [extra: string]: any;
}

// ---------------------------------------------------------------------------
// Write-result reports — shaped after the MongoDB Node driver
// (InsertOneResult / InsertManyResult / DeleteResult / UpdateResult), adapted to
// micromongo: there is no ObjectId, so id fields are `any` (the doc's own `_id`),
// and micromongo does NOT auto-generate `_id` on insert (reads/inserts stay
// non-mutating) — so `insertedId` is the doc's `_id` or `undefined`.
// ---------------------------------------------------------------------------

/** Result of `insertOne` (driver `InsertOneResult` + `insertedCount`). */
export interface InsertOneReport {
  acknowledged: boolean;
  insertedId: any;        // the inserted doc's `_id`, or `undefined` if it had none
  insertedCount: number;  // always 1
}

/** Result of `insertMany`/`insert` (driver `InsertManyResult`). */
export interface InsertManyReport {
  acknowledged: boolean;
  insertedCount: number;
  insertedIds: { [index: number]: any }; // map: position → inserted doc's `_id`
}

/** Result of `deleteOne`/`deleteMany` (driver `DeleteResult`). */
export interface DeleteReport {
  acknowledged: boolean;
  deletedCount: number;
}

/**
 * @deprecated Legacy result of `remove()` (no MongoDB-driver equivalent — the
 * driver dropped `remove()` in v4). Use `DeleteReport` from `deleteOne`/`deleteMany`.
 */
export interface RemoveReport {
  nRemoved: number;
}

/**
 * A single `bulkWrite` operation — exactly one of the six write kinds (driver
 * `AnyBulkWriteOperation`). Each delegates to the matching single-write method.
 */
export type BulkWriteOperation<T = Doc> =
  | { insertOne: { document: T } }
  | { updateOne: { filter: Query<T>; update: UpdateSpec<T>; upsert?: boolean; arrayFilters?: Query[] } }
  | { updateMany: { filter: Query<T>; update: UpdateSpec<T>; upsert?: boolean; arrayFilters?: Query[] } }
  | { replaceOne: { filter: Query<T>; replacement: T; upsert?: boolean } }
  | { deleteOne: { filter: Query<T> } }
  | { deleteMany: { filter: Query<T> } };

/** Aggregated result of `bulkWrite` (driver `BulkWriteResult`). */
export interface BulkWriteResult {
  acknowledged: boolean;
  insertedCount: number;
  matchedCount: number;
  modifiedCount: number;
  deletedCount: number;
  upsertedCount: number;
  insertedIds: { [index: number]: any }; // op index → inserted doc's `_id`
  upsertedIds: { [index: number]: any }; // op index → upserted doc's `_id`
  writeErrors?: { index: number; errmsg: string }[]; // only for ordered:false partial failures
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
  autoId: boolean;
}

/** Operator-registration kinds for `registerOperator(kind, name, fn)`. */
export type OperatorKind = 'pre' | 'post' | 'preprocess';

// ---------------------------------------------------------------------------
// Engine operator/stage function signatures. These name the recurring shapes
// that were `Record<string, any>` / inline `(…)=>…` literals — so the dispatch
// tables get real value types (`Record<string, MatchOperatorFn>`, …) and every
// operator shares one signature. The per-operator OPERAND and the doc field
// VALUES stay `any` (genuine value positions); only the structural surround is
// named.
// ---------------------------------------------------------------------------

/**
 * A match operator (`$eq`/`$gt`/`$in`/…). Gets the field value (or whole doc, for
 * pre-operators) and the operand, returns whether it matches. `doc`/`query` are
 * value positions (the operand can be a scalar, array, or sub-query).
 */
export type MatchOperatorFn = (doc: any, query: any, options?: Record<string, any>, siblings?: Document) => boolean;

/**
 * An update operator (`$set`/`$inc`/`$push`/…). Mutates `doc` at `field` per the
 * operand `value`; returns whether the document changed.
 */
export type UpdateOperatorFn = (doc: Document, field: string, value?: any) => boolean;

/** Aggregation-expression variables bag (`$$ROOT`, `$$CURRENT`, user `let` vars). */
export type ExprVars = Record<string, any>;

/**
 * An aggregation-expression operator (`$add`/`$concat`/`$cond`/…). Evaluates the
 * operand `expr` against `doc` (+ `vars`) and returns the computed value.
 */
export type ExprFn = (expr: any, doc: Document, vars: ExprVars) => any;

/** A `$group` accumulator (`$sum`/`$avg`/`$push`/…): fold a group's docs → a value. */
export type AccumulatorFn = (docs: Doc[], expr: any) => any;

/** An aggregation stage spec, e.g. `{ $match: { … } }` or `{ $group: { … } }`. */
export interface AggStage {
  [op: string]: any;
}

/**
 * An aggregation stage implementation. Takes the current pipeline docs + the
 * stage's argument and returns the next docs.
 */
export type StageFn = (array: Doc[], params: any, options?: Record<string, any>) => Doc[];
