/**
 * Global default settings (the "client-level" config layer).
 *
 * Mirrors how the MongoDB driver attaches configuration to the client and lets
 * more specific scopes (collection, operation) override it. This module is the
 * top of that chain: the process-wide defaults. A future Collection layer can
 * carry its own options that fall back to these.
 *
 * `mm.configure({ ... })` merges into these defaults; `mm.configure()` returns
 * the current settings (a copy).
 *
 *   idProjectionMongo - include `_id` by default in projections, Mongo-style
 *   whereTimeout      - hard timeout (ms) for `$where` execution. NOTE: this only
 *                       caps *synchronous* runaway loops — it is NOT a security
 *                       boundary. `$where` runs arbitrary JS via Node `vm`, which
 *                       is not a sandbox (see the $where operator's security note);
 *                       treat `$where` as trusted-input-only.
 *   autoId            - when true, insert* generate an `_id` for a document that
 *                       has none (MongoDB-style). Default false: micromongo leaves
 *                       documents untouched, so a doc without `_id` stays that way.
 *
 * Note: `DEBUG` in match.js is intentionally NOT here — it is a developer trace
 * toggle, not per-deployment configuration.
 */

'use strict';

import type { Settings } from './types';

/**
 * The module value: the live settings object plus the `configure`/`reset`/
 * `DEFAULTS` statics attached below. Typing both the data fields and the statics
 * in one interface (then casting the object) preserves `require('./settings')`
 * exposing `.idProjectionMongo`, `.configure`, `.reset`, `.DEFAULTS` identically.
 */
interface SettingsModule {
  idProjectionMongo: boolean;
  whereTimeout: number;
  textSearch: Settings['textSearch'];
  autoId: boolean;
  configure: (options?: Partial<Settings>) => Settings;
  reset: () => Settings;
  DEFAULTS: Settings;
}

var DEFAULTS: Settings = {
  idProjectionMongo: true,
  whereTimeout: 1000,
  textSearch: 'lightweight', // 'lightweight' | 'stemming' | 'exact' — $text fidelity
  autoId: false,             // off = micromongo's non-mutating default; on = Mongo-style _id generation
};

// Live settings object, seeded from defaults.
var settings = {
  idProjectionMongo: DEFAULTS.idProjectionMongo,
  whereTimeout: DEFAULTS.whereTimeout,
  textSearch: DEFAULTS.textSearch,
  autoId: DEFAULTS.autoId,
} as SettingsModule;

/**
 * Get or set global default settings.
 *
 * @param [options] - keys to merge into the global settings. Unknown
 *                             keys are ignored. Omit to read current settings.
 * @returns a shallow copy of the current settings
 */
var configure = function (options?: Partial<Settings>): Settings {
  if (options && typeof options === 'object') {
    if (typeof options.idProjectionMongo !== 'undefined') {
      settings.idProjectionMongo = !!options.idProjectionMongo;
    }
    if (typeof options.whereTimeout !== 'undefined') {
      settings.whereTimeout = options.whereTimeout;
    }
    if (typeof options.textSearch !== 'undefined') {
      var allowed = [ 'lightweight', 'stemming', 'exact' ];
      if (allowed.indexOf(options.textSearch) < 0) {
        throw new Error('configure: textSearch must be one of ' + allowed.join(', '));
      }
      settings.textSearch = options.textSearch;
    }
    if (typeof options.autoId !== 'undefined') {
      settings.autoId = !!options.autoId;
    }
  }
  return {
    idProjectionMongo: settings.idProjectionMongo,
    whereTimeout: settings.whereTimeout,
    textSearch: settings.textSearch,
    autoId: settings.autoId,
  };
};

/**
 * Reset settings to built-in defaults. Primarily for tests.
 * @returns the settings after reset
 */
var reset = function (): Settings {
  settings.idProjectionMongo = DEFAULTS.idProjectionMongo;
  settings.whereTimeout = DEFAULTS.whereTimeout;
  settings.textSearch = DEFAULTS.textSearch;
  settings.autoId = DEFAULTS.autoId;
  return configure();
};

settings.configure = configure;       // live object — read-at-use sees latest values
settings.reset = reset;
settings.DEFAULTS = DEFAULTS;

export = settings;
