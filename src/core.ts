'use strict';

// micromongo/core — the FUNCTIONAL API only (mm.find/aggregate/update… on arrays),
// deliberately WITHOUT the Collection / Cursor / ordered-index layer. Importing this
// entry pulls in crud + aggregate + match only; the ~30 KB Collection+index code (and
// its planner) never enters the bundle. See planning/roadmap.md (the v1.0 build).
//
// Trade-off vs. the full `micromongo` entry: no `Collection`/`Cursor`/`db`/`collection()`,
// and `$out`/`$lookup` by *unregistered name* throws (pass an array/Collection directly,
// or use the full entry). Everything else — every query/update operator, every aggregation
// stage, configure, registerOperator — is identical.

import type {
  Doc, Query, Projection, UpdateSpec, WriteOptions, UpdateReport,
  Settings, OperatorKind, AggStage,
  InsertOneReport, InsertManyReport, DeleteReport, RemoveReport,
  BulkWriteOperation, BulkWriteResult,
} from './types';

var crud = require('./crud/');
var aggregate = require('./aggregate/');
var settings = require('./settings');
var match = require('./crud/match');


/**
 * The functional-only public surface. Same generic, inferred typing as the full
 * entry's methods (T inferred from the array argument), minus the Collection layer.
 */
interface MicromongoCore {
  configure(options?: Partial<Settings>): Settings;
  registerOperator(kind: OperatorKind, name: string, fn: (doc: any, query: any) => any): any;

  count<T extends Doc = Doc>(array: T[], query?: Query<T>, options?: any): number;
  copyTo<T extends Doc = Doc>(array: T[], target: T[]): number;

  find<T extends Doc = Doc>(array: T[], query?: Query<T>, projection?: Projection, options?: any): T[];
  findOne<T extends Doc = Doc>(array: T[], query?: Query<T>, projection?: Projection, options?: any): T | null;
  distinct<T extends Doc = Doc>(array: T[], field: string, query?: Query<T>): any[];

  deleteOne<T extends Doc = Doc>(array: T[], query?: Query<T>): DeleteReport;
  deleteMany<T extends Doc = Doc>(array: T[], query?: Query<T>): DeleteReport;
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


var mm: MicromongoCore = {
  configure: settings.configure,
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
