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

var registry = {}; // name -> Collection

module.exports = {
  /** Register (or replace) a Collection under `name`. */
  set: function (name, collection) {
    registry[name] = collection;
    return collection;
  },

  /** Get the Collection registered under `name`, or null. */
  get: function (name) {
    return Object.prototype.hasOwnProperty.call(registry, name) ? registry[name] : null;
  },

  /** Does a collection exist under `name`? */
  has: function (name) {
    return Object.prototype.hasOwnProperty.call(registry, name);
  },

  /** Remove a registered collection. */
  drop: function (name) {
    var existed = this.has(name);
    delete registry[name];
    return existed;
  },

  /** All registered names. */
  names: function () {
    return Object.keys(registry);
  },

  /** The live registry object (used for the `mm.db` sugar accessor). */
  _map: registry,

  /** Reset — primarily for tests. */
  reset: function () {
    for (var k in registry) { if (registry.hasOwnProperty(k)) { delete registry[k]; } }
  },
};
