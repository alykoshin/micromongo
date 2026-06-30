'use strict';

import type {
  Doc, Query, Projection, UpdateSpec, WriteOptions, UpdateReport,
  Settings, OperatorKind, AggStage,
  InsertOneReport, InsertManyReport, DeleteReport, RemoveReport,
  BulkWriteOperation, BulkWriteResult,
} from './types';
import type CollectionClass = require('./collection');
import type CursorClass = require('./cursor');

var crud = require('./crud/');
var aggregate = require('./aggregate/');
var settings = require('./settings');
var Collection = require('./collection');
var Cursor = require('./cursor');
var registry = require('./registry');
var match = require('./crud/match');


/**
 * The public surface of `require('micromongo')`. The read/write/aggregate methods
 * are **generic on the document shape `T`** (inferred from the array argument, so
 * the object literal IS the schema), defaulting to `Doc` — an untyped array stays
 * fully permissive, while a typed array gets query keys/operands and update specs
 * checked against `T` (Mongo-driver style). Internal/extension members (`_crud`,
 * `_registry`, `db`, the engine seams) stay `any` — dynamic by nature.
 */
interface Micromongo {
  configure(options?: Partial<Settings>): Settings;
  Collection: typeof CollectionClass;
  Cursor: typeof CursorClass;
  collection: typeof collection;
  db: any;
  _registry: any;

  /** Register a custom query operator (the blessed extension point). */
  registerOperator(kind: OperatorKind, name: string, fn: (doc: any, query: any) => any): any;

  count<T extends Doc = Doc>(array: T[], query?: Query<T>, options?: any): number;
  copyTo<T extends Doc = Doc>(array: T[], target: T[]): number;

  find<T extends Doc = Doc>(array: T[], query?: Query<T>, projection?: Projection, options?: any): T[];
  findOne<T extends Doc = Doc>(array: T[], query?: Query<T>, projection?: Projection, options?: any): T | null;
  distinct<T extends Doc = Doc>(array: T[], field: string, query?: Query<T>): any[];

  deleteOne<T extends Doc = Doc>(array: T[], query?: Query<T>): DeleteReport;
  deleteMany<T extends Doc = Doc>(array: T[], query?: Query<T>): DeleteReport;
  /** @deprecated Use `deleteOne`/`deleteMany`. Returns the legacy `{ nRemoved }` shape. */
  remove<T extends Doc = Doc>(array: T[], query?: Query<T>, options?: any): RemoveReport;

  insertOne<T extends Doc = Doc>(array: T[], doc: T): InsertOneReport;
  insertMany<T extends Doc = Doc>(array: T[], docs: T[]): InsertManyReport;
  insert<T extends Doc = Doc>(array: T[], docOrDocs: T | T[]): InsertOneReport | InsertManyReport;

  updateOne<T extends Doc = Doc>(array: T[], query: Query<T>, update: UpdateSpec<T>, options?: WriteOptions): UpdateReport;
  updateMany<T extends Doc = Doc>(array: T[], query: Query<T>, update: UpdateSpec<T>, options?: WriteOptions): UpdateReport;
  replaceOne<T extends Doc = Doc>(array: T[], query: Query<T>, replacement: T, options?: WriteOptions): UpdateReport;

  findOneAndUpdate<T extends Doc = Doc>(array: T[], query: Query<T>, update: UpdateSpec<T>, options?: WriteOptions): T | null;
  findOneAndReplace<T extends Doc = Doc>(array: T[], query: Query<T>, replacement: T, options?: WriteOptions): T | null;
  findOneAndDelete<T extends Doc = Doc>(array: T[], query: Query<T>, options?: any): T | null;

  bulkWrite<T extends Doc = Doc>(array: T[], operations: BulkWriteOperation<T>[], options?: WriteOptions & { ordered?: boolean }): BulkWriteResult;

  _crud: any;
  aggregate(array: Doc[], stages: AggStage[]): Doc[];
}


/**
 * Register or retrieve a named collection (micromongo's `db.collection(name)`).
 *
 *   mm.collection('orders', ordersArray)  // create/replace from an array → Collection
 *   mm.collection('orders', someColl)     // register an existing Collection
 *   mm.collection('orders')               // retrieve (creates an empty one if absent,
 *                                         //  matching Mongo's lazy-collection behavior)
 *
 * Named collections are resolvable by `$out`/`$lookup` via their string name.
 */
function collection<T extends Doc = Doc>(name: string, array?: T[] | CollectionClass<T>): CollectionClass<T> {
  if (typeof name !== 'string') { throw new TypeError('collection(name): name must be a string'); }
  if (typeof array !== 'undefined') {
    var coll = (array instanceof Collection) ? array : new Collection(array);
    return registry.set(name, coll);
  }
  if (!registry.has(name)) { registry.set(name, new Collection([])); } // lazy-create like Mongo
  return registry.get(name);
}


var mm: Micromongo = {
  configure: settings.configure,
  Collection: Collection,
  Cursor: Cursor,
  collection: collection,
  db: registry._map,        // sugar: mm.db.orders === mm.collection('orders')
  _registry: registry,

  // Extend the query engine with a custom operator (the blessed extension point,
  // replacing direct mutation of mm._crud._match.postOperators).
  //   mm.registerOperator('post', '$myOp', function (doc, query) { … })
  registerOperator: match.registerOperator,

  count: crud.count,
  copyTo: crud.copyTo,

  find: crud.find,
  findOne: crud.findOne,
  distinct: crud.distinct,

  deleteOne: crud.deleteOne,
  deleteMany: crud.deleteMany,
  remove: crud.remove,

  insertOne: crud.insertOne,
  insertMany: crud.insertMany,
  insert: crud.insert,

  updateOne: crud.updateOne,
  updateMany: crud.updateMany,
  replaceOne: crud.replaceOne,

  findOneAndUpdate: crud.findOneAndUpdate,
  findOneAndReplace: crud.findOneAndReplace,
  findOneAndDelete: crud.findOneAndDelete,

  bulkWrite: crud.bulkWrite,

  _crud: crud,
  aggregate: aggregate,
};

export = mm;
