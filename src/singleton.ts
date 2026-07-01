/**
 * Cross-realm singleton helper — defends against the **dual-package hazard**.
 *
 * When a dependency graph loads BOTH the CJS build (`dist/index.js` + its required
 * modules) AND the ESM build (`dist/index.mjs`, a self-contained esbuild bundle),
 * each copy instantiates its own module-level state. For micromongo's three shared
 * singletons — the collection registry, the operator tables, and the text-score
 * WeakMap — that split is a correctness bug: an operator registered through one copy
 * is invisible to the other, and `mm.db` diverges. (Verified empirically: loading
 * both builds in one process showed `registerOperator`/`mm.db` not shared.)
 *
 * `singleton(key, make)` pins the instance on `globalThis` under a namespaced key, so
 * the FIRST copy to load creates it and every later copy (CJS or ESM, any number)
 * reuses the same object. This is the build-tool-agnostic "belt" fix from the
 * multi-target plan — it holds regardless of how many physical copies exist.
 */

'use strict';

var NS = '__micromongo_singletons__';

function singleton<T>(key: string, make: () => T): T {
  var g: any = (typeof globalThis !== 'undefined') ? globalThis : (typeof global !== 'undefined' ? global : {});
  var store: Record<string, any> = g[NS] || (g[NS] = {});
  if (!(key in store)) { store[key] = make(); }
  return store[key] as T;
}

export = singleton;
