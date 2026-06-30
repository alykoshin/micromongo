/**
 * Public-API type tests (tsd). These lock the consumer-facing signatures of
 * `require('micromongo')` so a future refactor can't silently widen them back to
 * `any`. Run with `npm run test-types` (tsd reads `package.json` "types" →
 * dist/index.d.ts). These are TYPE assertions only — never executed.
 *
 * Scope mirrors the T2 typing policy: the high-traffic read/write/aggregate
 * surface is asserted precisely; the dynamic internals (`_crud`, the engine) are
 * intentionally `any` and not asserted here.
 */

import { expectType, expectError, expectAssignable } from 'tsd';
import mm = require('../');
import {
  Doc, UpdateReport, Settings,
  InsertOneReport, InsertManyReport, DeleteReport,
  BulkWriteResult,
} from '../dist/types';

const arr: Doc[] = [{ _id: 1, status: 'A', qty: 5 }];

// --- reads: precise return types (not `any`) ---
expectType<Doc[]>(mm.find(arr, { status: 'A' }));
expectType<Doc[]>(mm.find(arr));                       // query optional
expectType<Doc | null>(mm.findOne(arr, { qty: { $gt: 1 } }));
expectType<number>(mm.count(arr, {}));
expectType<number>(mm.count(arr));                     // query optional
expectType<any[]>(mm.distinct(arr, 'status'));
expectType<Doc[]>(mm.aggregate(arr, [{ $group: { _id: '$status', n: { $sum: 1 } } }]));

// --- writes: the driver-shaped report ---
expectType<UpdateReport>(mm.updateOne(arr, { _id: 1 }, { $set: { status: 'C' } }));
expectType<UpdateReport>(mm.updateMany(arr, {}, { $inc: { qty: 1 } }));
expectType<UpdateReport>(mm.replaceOne(arr, { _id: 1 }, { _id: 1, status: 'Z' }));
const rep = mm.updateOne(arr, { _id: 1 }, { $set: { status: 'C' } });
expectType<number>(rep.matchedCount);
expectType<number>(rep.modifiedCount);
expectType<boolean>(rep.acknowledged);

// --- config: typed Settings, not `any` ---
expectType<Settings>(mm.configure());
expectType<Settings>(mm.configure({ textSearch: 'stemming' }));
// textSearch is a string-literal union, not a free string:
expectError(mm.configure({ textSearch: 'nonsense' }));

// --- registerOperator: kind is the operator-kind union ---
mm.registerOperator('post', '$myop', (doc, query) => true);
expectError(mm.registerOperator('bogus', '$x', () => true)); // 'bogus' not a valid kind

// --- collection() returns something usable (Collection is `any` by design — just assert callable) ---
expectAssignable<(name: string, array?: Doc[]) => any>(mm.collection);

// --- write reports are the precise driver-shaped types (not `any`) ---
expectType<InsertOneReport>(mm.insertOne(arr, { x: 1 }));
expectType<InsertManyReport>(mm.insertMany(arr, [{ x: 1 }]));
expectType<DeleteReport>(mm.deleteOne(arr, { _id: 1 }));
expectType<DeleteReport>(mm.deleteMany(arr, {}));
const del = mm.deleteOne(arr, { _id: 1 });
expectType<number>(del.deletedCount);
const ins = mm.insertOne(arr, { x: 1 });
expectType<number>(ins.insertedCount);

// --- the wrong-arity / wrong-type calls must be errors ---
expectError(mm.find());                                // array is required
expectError(mm.find('not-an-array', {}));              // first arg must be Doc[]


// ===========================================================================
// Generic inference: T is inferred from the array; a TYPED array gets query
// keys' operand/value types checked, returns T[], and reports type-through.
// (Mirrors the MongoDB driver's non-strict default: known-field value types are
// checked; unknown keys / dot-notation paths stay permissive via the open index.)
// ===========================================================================
interface User { _id: number; email: string; age: number; }
const users: User[] = [{ _id: 1, email: 'a@b.c', age: 30 }];

// inference: returns User[], not Doc[]
expectType<User[]>(mm.find(users, { email: 'x' }));
expectType<User | null>(mm.findOne(users, { age: { $gt: 18 } }));

// value-type checking on KNOWN fields:
expectError(mm.find(users, { age: { $gt: 'not-a-number' } })); // $gt wants number
expectError(mm.find(users, { email: 123 }));                   // email wants string

// permissive by default (driver-style): unknown keys & dot-paths compile
mm.find(users, { 'profile.city': 'NYC' });                     // dot-notation: OK
const loose: Doc[] = [];
mm.find(loose, { anything: 1, nested: { $weird: true } });     // untyped → permissive

// update spec maps over T: $set takes Partial<User> (+ open keys)
mm.updateOne(users, { _id: 1 }, { $set: { email: 'new@x.y' } });
mm.updateOne(users, { _id: 1 }, { $inc: { age: 1 } });


// --- generic Collection<T> / Cursor<T> via the public surface ---
const coll = new mm.Collection<User>(users);
expectType<User[]>(coll.toArray());
expectType<User | null>(coll.findOne({ email: 'x' }));
expectType<number>(coll.count({ age: { $gte: 18 } }));
expectType<DeleteReport>(coll.deleteOne({ _id: 1 }));
// find() returns a Cursor<User>; its terminals carry User through:
const cur = coll.find({ email: 'x' });
expectType<User[]>(cur.toArray());
expectType<User | null>(cur.next());
expectType<User[]>(cur.sort({ age: -1 }).limit(2).toArray()); // chain preserves T
// value-type checking on the collection too:
expectError(coll.find({ age: { $gt: 'no' } }));

// mm.collection<T>(name, array) returns a typed Collection<User>
const registered = mm.collection<User>('users', users);
expectType<User[]>(registered.toArray());


// ===========================================================================
// bulkWrite: typed operation array + aggregated BulkWriteResult.
// ===========================================================================
const bw = mm.bulkWrite(users, [
  { insertOne: { document: { _id: 9, email: 'z@z.z', age: 1 } } },
  { updateOne: { filter: { _id: 1 }, update: { $set: { age: 31 } } } },
  { updateMany: { filter: { age: { $gt: 18 } }, update: { $inc: { age: 1 } } } },
  { replaceOne: { filter: { _id: 1 }, replacement: { _id: 1, email: 'a@b.c', age: 40 } } },
  { deleteOne: { filter: { _id: 9 } } },
  { deleteMany: { filter: { age: { $lt: 0 } } } },
]);
expectType<BulkWriteResult>(bw);
expectType<number>(bw.insertedCount);
expectType<number>(bw.matchedCount);
expectType<number>(bw.modifiedCount);
expectType<number>(bw.deletedCount);
expectType<number>(bw.upsertedCount);

// ordered flag is accepted
mm.bulkWrite(users, [{ deleteMany: { filter: {} } }], { ordered: false });

// value-type checking flows through the typed operations:
expectError(mm.bulkWrite(users, [{ updateOne: { filter: { age: 'no' }, update: {} } }]));

// $expr is permissively typed (aggregation-expression bag) on a typed query:
mm.find(users, { $expr: { $gt: ['$age', 18] } });
