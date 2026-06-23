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

var DEFAULTS = {
  idProjectionMongo: true,
  whereTimeout: 1000,
};

// Live settings object, seeded from defaults.
var settings = {
  idProjectionMongo: DEFAULTS.idProjectionMongo,
  whereTimeout: DEFAULTS.whereTimeout,
};

/**
 * Get or set global default settings.
 *
 * @param {Object} [options] - keys to merge into the global settings. Unknown
 *                             keys are ignored. Omit to read current settings.
 * @returns {Object} a shallow copy of the current settings
 */
var configure = function (options) {
  if (options && typeof options === 'object') {
    if (typeof options.idProjectionMongo !== 'undefined') {
      settings.idProjectionMongo = !!options.idProjectionMongo;
    }
    if (typeof options.whereTimeout !== 'undefined') {
      settings.whereTimeout = options.whereTimeout;
    }
  }
  return { idProjectionMongo: settings.idProjectionMongo, whereTimeout: settings.whereTimeout };
};

/**
 * Reset settings to built-in defaults. Primarily for tests.
 * @returns {Object} the settings after reset
 */
var reset = function () {
  settings.idProjectionMongo = DEFAULTS.idProjectionMongo;
  settings.whereTimeout = DEFAULTS.whereTimeout;
  return configure();
};

module.exports = settings;            // live object — read-at-use sees latest values
module.exports.configure = configure;
module.exports.reset = reset;
module.exports.DEFAULTS = DEFAULTS;
