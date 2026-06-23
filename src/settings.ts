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
 *   whereTimeout      - hard timeout (ms) for `$where` sandbox execution
 *
 * Note: `DEBUG` in match.js is intentionally NOT here — it is a developer trace
 * toggle, not per-deployment configuration.
 */

'use strict';

/**
 * The module value: the live settings object plus the `configure`/`reset`/
 * `DEFAULTS` statics attached below. Typing both the data fields and the statics
 * in one interface (then casting the object) preserves `require('./settings')`
 * exposing `.idProjectionMongo`, `.configure`, `.reset`, `.DEFAULTS` identically.
 */
interface SettingsModule {
  idProjectionMongo: boolean;
  whereTimeout: number;
  textSearch: string;
  configure: (options?: any) => any;
  reset: () => any;
  DEFAULTS: any;
}

var DEFAULTS = {
  idProjectionMongo: true,
  whereTimeout: 1000,
  textSearch: 'lightweight', // 'lightweight' | 'stemming' | 'exact' — $text fidelity
};

// Live settings object, seeded from defaults.
var settings = {
  idProjectionMongo: DEFAULTS.idProjectionMongo,
  whereTimeout: DEFAULTS.whereTimeout,
  textSearch: DEFAULTS.textSearch,
} as SettingsModule;

/**
 * Get or set global default settings.
 *
 * @param [options] - keys to merge into the global settings. Unknown
 *                             keys are ignored. Omit to read current settings.
 * @returns a shallow copy of the current settings
 */
var configure = function (options?: any): any {
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
  }
  return {
    idProjectionMongo: settings.idProjectionMongo,
    whereTimeout: settings.whereTimeout,
    textSearch: settings.textSearch,
  };
};

/**
 * Reset settings to built-in defaults. Primarily for tests.
 * @returns the settings after reset
 */
var reset = function (): any {
  settings.idProjectionMongo = DEFAULTS.idProjectionMongo;
  settings.whereTimeout = DEFAULTS.whereTimeout;
  settings.textSearch = DEFAULTS.textSearch;
  return configure();
};

settings.configure = configure;       // live object — read-at-use sees latest values
settings.reset = reset;
settings.DEFAULTS = DEFAULTS;

export = settings;
