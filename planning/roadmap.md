# Roadmap — what's left

micromongo is feature-complete for the MongoDB surface that's feasible in-memory: full CRUD + updates,
aggregation (stages + expression engine), text/geo/bitwise, `Collection`/`Cursor`, ordered/multikey/
compound indexes + planner + `explain()`, a mongosh-flavored CLI, full TypeScript with inferred generics,
and a multi-target build (CJS + ESM + browser IIFE + a lean `micromongo/core` subpath). See
[compatibility.md](compatibility.md) for exact status and [application-directions.md](application-directions.md)
for where it could go as a product.

This file lists the only things **not done**. (Completed-work history lives in git.)

---

## 1. The v1.0 SemVer-major cut

The multi-target build is largely shipped (CJS + ESM + browser IIFE + `micromongo/core`, via `tsup`;
minified; singleton bridge for the dual-package hazard; `$where` works on every target; guarded by
`bundle-tests/`). What remains is the breaking release itself:

- **Bump `engines.node` to `>=14`** (native-ESM floor) and cut **v1.0.0** — currently `0.3.1` / `node >= 8`.
- **README rewrite + migration guide** — the CJS→CJS/ESM/browser story and the `./core` entry.
- *(optional, low value)* additional subpaths `micromongo/match` / `micromongo/aggregate` — only `./core`
  shipped. A truly lean `/match` depends on the deferred `registerBuiltins()` refactor (§2).

**Definition of done** (most gates already pass via `bundle-tests/`): CJS unchanged; ESM loads; `/core`
resolves and excludes the Collection/index layer; browser-clean (runs in a `require`/`Buffer`-free realm);
`$where` works on both targets; dual-package safe (shared singletons); tree-shake safe. The remaining
gates are the version/engines bump and the README/migration guide.

**Decisions worth NOT re-litigating** (from the shipped build):
- ESM must be *bundled*, not tsc-recompiled — `export =` (21 modules) is a hard `TS1203` error under any
  ESM `module` mode; esbuild exposes `module.exports` as the ESM default.
- Browser `$where` uses `new Function` (+ a one-time warn), not a `vm` shim — a faithful `vm` shim is
  impossible in a synchronous browser context (JS can't preempt its own sync execution; the shim's value
  is the `whereTimeout`, which needs a Worker). `new Function` is safe in the browser (no `process`/`fs`
  to escape to). Node keeps real `vm`.
- Don't slim lodash — it's ~31 KB of the ~96 KB minified bundle, but 22 KB is `cloneDeep`+`isEqual` (the
  deep-copy/deep-equal correctness spine, guarded by 240+ tests); dropping the other 8 fns nets ~9 KB for
  a risky rewrite. Minifying (done) saved more (~15 KB gz) than any code-slimming.

---

## 2. Opt-in operator registration (`registerBuiltins()`) — deferred, low value

Built-in operators register by **import side-effect** (each `operators/*.ts` file runs
`registerOperator(...)` on load), which makes them un-tree-shakeable and blocks a lean `micromongo/match`
subpath. **Step 1 already shipped** as no-cost prep: every operator file exports a named `register(reg)`
function *and* self-calls it. The remainder — remove the self-calls, add a `registerBuiltins()` facade
(the default entry still calls it → non-breaking), and add a lean opt-in entry — is what makes operators
tree-shakeable.

**Why deferred:** measured payoff is only **~2–3 KB gzipped** — the shared match+lodash spine (~54 KB)
dominates, and per-domain removable chunks are tiny (text ~6.6 KB, geo ~2.6 KB). It also adds a
"forgot-to-register → silent unknown-`$gt`" failure mode (mitigable with an engine guard using the drift
test's known-builtin set). Only worth doing if a sub-5 KB `micromongo/match` for embedded/edge becomes a
real goal, or "compose your own operator set" becomes a first-class feature.

**Effort (remainder): M.** Touches all 10 operator files + the facade + the extension contract.

---

## Deferred / out of scope

Real MongoDB surface intentionally left out, and things that need a server:

| Item | Why |
|---|---|
| **`$jsonSchema`** (in-query validation) | Large JSON-Schema dialect, out of scope for a matcher. |
| **Specialized index types** — hashed (sharding), TTL (reaper), text/2dsphere/wildcard | Need a server/daemon or a disproportionate structure; those *queries* already work by scanning. |
| **Index properties** — `unique`/`partial`/`sparse` | Additive later; not core to scale. |
| **Collation** (locale-aware compare/sort) | Could wrap `$sort`/comparisons; today uses raw JS `<`/`>`. |
| **Async / Promise API** | Deliberately not built — the work is synchronous and in-memory; `async` would only mirror the driver's signature while obscuring that. Add only if drop-in driver compatibility becomes an explicit goal. |
| **Persistence, replication, sharding, transactions/sessions, change streams, capped/time-series, security, Atlas Search/Vector** | Properties of MongoDB-the-server; no meaning for a plain in-memory array. |
