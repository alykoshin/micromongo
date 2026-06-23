/**
 * Shared developer trace toggle for the match engine.
 *
 * `DEBUG` is intentionally a module-level dev switch (NOT runtime config — see
 * lib/settings.js note). Flip the literal below to `true` locally to trace match
 * recursion; don't commit it true. This is the SINGLE place to flip — every match
 * module reads `DEBUG` from here, so one edit enables tracing across the whole
 * engine.
 *
 * Caveat: each module snapshots the value with `var DEBUG = dbg.DEBUG` AT LOAD,
 * so flip it here BEFORE requiring micromongo. Reassigning it at runtime (after
 * the modules have loaded) will NOT propagate — by design (this mirrors the
 * original single-file `var DEBUG = false` toggle).
 */

'use strict';

var DEBUG: boolean = false;

function debug(this: any /*arguments*/): void {
  console.log.apply(this, arguments as any);
}

export = {
  DEBUG: DEBUG,
  debug: debug,
};
