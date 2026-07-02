'use strict';

/* eslint-disable @typescript-eslint/no-explicit-any -- the mongodb-driver adapter is an
   open-shape boundary (arbitrary user docs/queries/options); `any` is honest here per the
   CLAUDE.md typing policy, not laziness. */

/**
 * MockMongoClient — the `mongodb` driver's `MongoClient`, in-memory.
 *
 * `connect()` is a no-op resolve (there's no server). `db(name)` returns an isolated MockDb;
 * repeated calls with the same name return the SAME Db (so all `client.db().collection()`
 * references share data within a client). Databases live for the client's lifetime and are
 * cleared by `close()`.
 *
 * Sessions/transactions: `startSession()`/`withSession()` return a session handle whose
 * `withTransaction(fn)` RUNS the body and commits — but WITHOUT real isolation or rollback
 * (there is a single in-memory array; `abortTransaction()` is a documented no-op). This lets
 * transaction-wrapped test code run; it does not provide transactional semantics.
 * `watch()` (change streams) throws.
 */

var MockDb = require('./db');

function unsupported(name: string): never {
  throw new Error(
    "micromongo/mock: '" + name + "' requires a real MongoDB server and is not supported (in-memory mock)."
  );
}

// A no-op session. withTransaction runs the callback and resolves its result.
function makeSession(): any {
  var inTxn = false;
  var session: any = {
    id: { id: 'micromongo-mock-session' },
    hasEnded: false,
    startTransaction: function () { inTxn = true; },
    commitTransaction: function () { inTxn = false; return Promise.resolve(); },
    // No rollback is possible over a single in-memory array — documented no-op, NOT a throw,
    // so `finally`-style abort paths in application code don't crash the test.
    abortTransaction: function () { inTxn = false; return Promise.resolve(); },
    endSession: function () { session.hasEnded = true; return Promise.resolve(); },
    inTransaction: function () { return inTxn; },
    withTransaction: async function (fn: (s?: any) => any, _opts?: any) {
      inTxn = true;
      try {
        var r = await fn(session);
        inTxn = false;
        return r;
      } catch (e) {
        inTxn = false;
        throw e;
      }
    },
  };
  return session;
}


class MockMongoClient {
  private _dbs: Record<string, any>;
  private _defaultDbName: string;
  public options: any;

  constructor(uri?: string, options?: any) {
    this._dbs = {};
    this.options = options || {};
    // pull a default db name out of a connection string if present (mongodb://host/dbname)
    this._defaultDbName = MockMongoClient._dbNameFromUri(uri) || 'test';
  }

  static _dbNameFromUri(uri?: string): string | null {
    if (!uri || typeof uri !== 'string') { return null; }
    var m = uri.replace(/^[a-z+]+:\/\//i, '').split('/')[1];
    if (!m) { return null; }
    return m.split('?')[0] || null;
  }

  connect(): Promise<this> { return Promise.resolve(this); }

  db(name?: string, _options?: any): any {
    var n = name || this._defaultDbName;
    if (!this._dbs[n]) { this._dbs[n] = new MockDb(n); }
    return this._dbs[n];
  }

  close(_force?: boolean): Promise<void> {
    this._dbs = {};
    return Promise.resolve();
  }

  startSession(_options?: any): any { return makeSession(); }

  async withSession(fnOrOpts: any, maybeFn?: any): Promise<any> {
    // driver signature: withSession(fn) or withSession(options, fn)
    var fn = typeof fnOrOpts === 'function' ? fnOrOpts : maybeFn;
    var session = makeSession();
    try {
      return await fn(session);
    } finally {
      await session.endSession();
    }
  }

  watch(..._args: any[]): never { return unsupported('MongoClient.watch (change streams)'); }

  // Static connect(uri, options) → a connected client (the classic driver entry point).
  static connect(uri?: string, options?: any): Promise<MockMongoClient> {
    return new MockMongoClient(uri, options).connect();
  }
}

export = MockMongoClient;
