/**
 * Named-collection registry — micromongo's analog of a database namespace.
 *
 * Real MongoDB resolves `$out: "name"` and `$lookup: { from: "name" }` against a
 * database. micromongo has no database, so this small registry provides the same
 * thing: a name → Collection map. Both the public `mm.collection(name)` API and the
 * aggregation stages ($out/$lookup) resolve names through here.
 *
 * Kept in its own module so `lib/index.js` and `lib/aggregate/` can share it
 * without a circular require.
 */

'use strict';

/**
 * The exported registry object. Typed via an interface so `this.has(...)` inside
 * `drop` resolves under `strict` (object-literal method `this` would otherwise be
 * inferred loosely). Mirrors the original plain-object `module.exports`.
 */
interface RegistryModule {
  set: (name: string, collection: any) => any;
  get: (name: string) => any;
  has: (name: string) => boolean;
  drop: (name: string) => boolean;
  names: () => string[];
  _map: any;
  reset: () => void;
}

var registry: any = {}; // name -> Collection

var theObj: RegistryModule = {
  /** Register (or replace) a Collection under `name`. */
  set: function (name: string, collection: any): any {
    registry[name] = collection;
    return collection;
  },

  /** Get the Collection registered under `name`, or null. */
  get: function (name: string): any {
    return Object.prototype.hasOwnProperty.call(registry, name) ? registry[name] : null;
  },

  /** Does a collection exist under `name`? */
  has: function (name: string): boolean {
    return Object.prototype.hasOwnProperty.call(registry, name);
  },

  /** Remove a registered collection. */
  drop: function (name: string): boolean {
    var existed = this.has(name);
    delete registry[name];
    return existed;
  },

  /** All registered names. */
  names: function (): string[] {
    return Object.keys(registry);
  },

  /** The live registry object (used for the `mm.db` sugar accessor). */
  _map: registry,

  /** Reset — primarily for tests. */
  reset: function (): void {
    for (var k in registry) { if (registry.hasOwnProperty(k)) { delete registry[k]; } }
  },
};

export = theObj;
