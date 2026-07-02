'use strict';

/* eslint-disable @typescript-eslint/no-explicit-any -- the mongodb-driver adapter is an
   open-shape boundary (arbitrary user docs/queries/options); `any` is honest here per the
   CLAUDE.md typing policy, not laziness. */

/**
 * MockDb — the `mongodb` driver's `Db`, over an ISOLATED per-Db registry of micromongo
 * Collections (NOT the process-global `mm.db`, so test files don't share state and each
 * client/db can be reset independently).
 *
 * Collections are lazily created on first access (Mongo's behavior). `command()`/`stats()`
 * return minimal shapes; `watch()` and other server-only bits throw.
 */

var mm = require('../index');
var MockCollection = require('./collection');

function unsupported(name: string): never {
  throw new Error(
    "micromongo/mock: '" + name + "' requires a real MongoDB server and is not supported (in-memory mock)."
  );
}

class MockDb {
  public databaseName: string;
  private _collections: Record<string, any>;  // name → MockCollection

  constructor(name?: string) {
    this.databaseName = name || 'test';
    this._collections = {};
  }

  /** Lazily create/retrieve a collection (driver `db.collection(name)`). Synchronous, like the driver. */
  collection(name: string, _options?: any): any {
    if (!this._collections[name]) {
      // a fresh, ISOLATED micromongo Collection backing each name
      this._collections[name] = new MockCollection(new mm.Collection([]), name);
    }
    return this._collections[name];
  }

  /** Create a collection explicitly (returns it; driver returns a Promise). */
  createCollection(name: string, _options?: any): Promise<any> {
    return Promise.resolve(this.collection(name));
  }

  /** List collection names as the driver's `{ name, type }` docs (via a cursor-ish object). */
  listCollections(_filter?: any, _options?: any): any {
    var names = Object.keys(this._collections);
    var docs = names.map(function (n) { return { name: n, type: 'collection' }; });
    // driver returns a cursor; expose toArray() (Promise) + async iteration.
    return {
      toArray: function () { return Promise.resolve(docs); },
      [Symbol.asyncIterator]: async function* () { for (var i = 0; i < docs.length; i++) { yield docs[i]; } },
    };
  }

  collections(): Promise<any[]> {
    var self = this;
    return Promise.resolve(Object.keys(this._collections).map(function (n) { return self._collections[n]; }));
  }

  dropCollection(name: string, _options?: any): Promise<boolean> {
    if (!this._collections[name]) { return Promise.resolve(false); }
    this._collections[name].drop();
    delete this._collections[name];
    return Promise.resolve(true);
  }

  dropDatabase(_options?: any): Promise<boolean> {
    this._collections = {};
    return Promise.resolve(true);
  }

  renameCollection(from: string, to: string, _options?: any): Promise<any> {
    if (!this._collections[from]) { throw new Error("source collection '" + from + "' does not exist"); }
    this._collections[to] = this._collections[from];
    this._collections[to].collectionName = to;
    delete this._collections[from];
    return Promise.resolve(this._collections[to]);
  }

  /** Minimal `command()` — supports `{ ping: 1 }` and `{ ismaster/hello }`; else throws. */
  command(cmd: any, _options?: any): Promise<any> {
    if (cmd && (cmd.ping === 1 || cmd.ping)) { return Promise.resolve({ ok: 1 }); }
    if (cmd && (cmd.ismaster || cmd.hello || cmd.isMaster)) {
      return Promise.resolve({ ok: 1, ismaster: true, maxWireVersion: 0 });
    }
    return unsupported('db.command(' + JSON.stringify(cmd) + ')');
  }

  stats(_options?: any): Promise<any> {
    var self = this;
    var count = Object.keys(this._collections).reduce(function (n, name) {
      return n + self._collections[name]._c.count({});
    }, 0);
    return Promise.resolve({ db: this.databaseName, collections: Object.keys(this._collections).length, objects: count, ok: 1 });
  }

  admin(): any {
    return {
      ping: function () { return Promise.resolve({ ok: 1 }); },
      command: function (cmd: any) { return Promise.resolve({ ok: 1, cmd: cmd }); },
      buildInfo: function () { return Promise.resolve({ version: '0.0.0-micromongo-mock', ok: 1 }); },
      serverStatus: function () { return Promise.resolve({ ok: 1 }); },
      listDatabases: function () { return Promise.resolve({ databases: [{ name: 'test' }], ok: 1 }); },
    };
  }

  watch(..._args: any[]): never { return unsupported('Db.watch (change streams)'); }
}

export = MockDb;
