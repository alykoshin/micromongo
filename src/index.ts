'use strict';

import type {
  Doc, Query, Projection, UpdateSpec, WriteOptions, UpdateReport,
  Settings, OperatorKind,
} from './types';

var crud = require('./crud/');
var aggregate = require('./aggregate/');
var settings = require('./settings');
var Collection = require('./collection');
var Cursor = require('./cursor');
var registry = require('./registry');
var match = require('./crud/match');


/**
 * The public surface of `require('micromongo')`. The high-traffic read/write/
 * aggregate methods are typed against the boundary interfaces in `./types`; the
 * internal/extension members (`_crud`, `_registry`, `db`, the engine seams) stay
 * `any` — they're dynamic by nature and reached by advanced/test code. This is
 * the "real types at the boundaries, pragmatic `any` at the dynamic seams"
 * split the migration plan calls for.
 */
interface Micromongo {
  configure(options?: Partial<Settings>): Settings;
  Collection: any;
  Cursor: any;
  collection: typeof collection;
  db: any;
  _registry: any;

  /** Register a custom query operator (the blessed extension point). */
  registerOperator(kind: OperatorKind, name: string, fn: (doc: any, query: any) => any): any;

  count(array: Doc[], query?: Query, options?: any): number;
  copyTo(array: Doc[], target: Doc[]): number;

  find(array: Doc[], query?: Query, projection?: Projection, options?: any): Doc[];
  findOne(array: Doc[], query?: Query, projection?: Projection, options?: any): Doc | null;
  distinct(array: Doc[], field: string, query?: Query): any[];

  deleteOne(array: Doc[], query?: Query): any;
  deleteMany(array: Doc[], query?: Query): any;
  remove(array: Doc[], query?: Query, options?: any): any;

  insertOne(array: Doc[], doc: Doc): any;
  insertMany(array: Doc[], docs: Doc[]): any;
  insert(array: Doc[], docOrDocs: Doc | Doc[]): any;

  updateOne(array: Doc[], query: Query, update: UpdateSpec, options?: WriteOptions): UpdateReport;
  updateMany(array: Doc[], query: Query, update: UpdateSpec, options?: WriteOptions): UpdateReport;
  replaceOne(array: Doc[], query: Query, replacement: Doc, options?: WriteOptions): UpdateReport;

  findOneAndUpdate(array: Doc[], query: Query, update: UpdateSpec, options?: WriteOptions): any;
  findOneAndReplace(array: Doc[], query: Query, replacement: Doc, options?: WriteOptions): any;
  findOneAndDelete(array: Doc[], query: Query, options?: any): any;

  _crud: any;
  aggregate(array: Doc[], stages: any[]): Doc[];
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
function collection(name: any, array?: any): any {
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

  _crud: crud,
  aggregate: aggregate,
};

export = mm;
