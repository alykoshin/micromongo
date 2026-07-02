# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Memory location

**Save project-related memories to the PROJECT directory, not the global `~/.claude` memory dir.**
Persist project facts (ongoing work, non-obvious constraints, design decisions) under
`.claude/memory/` in this repo — with the same one-fact-per-file + `MEMORY.md` index convention — so
they're versioned with the code and shared with the team. Reserve the global memory dir for facts
about the user themselves, not this project.

## What this is

`micromongo` is a zero-database library that runs MongoDB-like queries over plain JavaScript arrays of objects (the array is the "collection", each object a "document"). The default query path is a **linear scan**; for larger data, a `Collection` can carry **opt-in ordered indexes** (`createIndex(field | {a:1,b:1})`) — single-field / multikey / compound — that serve equality, range, sort, `$in`, compound-prefix, and `$or` via a query planner (the scale path — see [`lib/index/`](lib/index/), [`lib/collection.js`](lib/collection.js), and the README "Indexes"/"Performance" sections). The index is **safe by construction**: it only ever supplies a candidate superset that the match engine re-filters, so it never changes results, only speed. The functional `mm.find(array, …)` API stays a scan by design (it can't own the caller's array to keep an index valid). See README.md for the full per-operator compatibility matrix against MongoDB 3.2.

Most methods are **non-mutating** and return deep copies (`find`, `findOne`, `count`, `aggregate`, `distinct`). The mutating ones modify the passed array in place: `deleteOne`, `deleteMany`, `remove`, `insert*`, `copyTo`, the update family (`updateOne`/`updateMany`/`replaceOne`/`findOneAnd*` — these return a driver-shaped report, e.g. `{ acknowledged, matchedCount, modifiedCount }`, plus `upsertedId`/`upsertedCount` when `{ upsert: true }` inserts).

## Source layout & build (TypeScript)

**The library is TypeScript now** (Phase T1+T2). Source is `src/**/*.ts`; `tsc` compiles it to CommonJS
`.js` + `.d.ts` in **`dist/`** (gitignored, generated). Back-compat is preserved through the **main
export**: root `index.js`/`cli.js` are thin shims that `require('./dist/…')`, so `require('micromongo')`
and the `bin` resolve unchanged; `package.json` ships `"types": "./dist/index.d.ts"`.

- **Edit `src/*.ts`, never `dist/`** (dist is build output). `npm run build` (= `tsc`) regenerates it;
  `npm run typecheck` is `tsc --noEmit`. A build runs automatically before tests (`pre_test` hook) and
  on install/publish (`prepare`/`prepublishOnly`).
- **Paths in this doc that say `lib/…` now mean `src/…`** (the dir was renamed `lib/`→`src/` and files
  `.js`→`.ts`; the module *structure* below is otherwise unchanged). E.g. `lib/crud/match/engine.js`
  is `src/crud/match/engine.ts`.
- **Export-shape convention** (so emitted CJS stays back-compatible): callable-with-statics modules use
  `interface FooFn { (…): …; _x: … }` + `var foo = (function(){…}) as FooFn; foo._x = …; export = foo`
  (see [`src/crud/project.ts`](src/crud/project.ts) — the canonical exemplar — and
  [`src/crud/match/index.ts`](src/crud/match/index.ts)). Plain-object modules use `export = { … }`. The
  three real classes — Cursor / Collection / OrderedIndex — are written as ES `class … { }` with
  `export = ClassName` (see [`src/index/ordered.ts`](src/index/ordered.ts) as the exemplar): declare each
  `this.<field>` once in the class body (typed `: any` unless obvious), keep init in the `constructor`
  (no field initializers, to match the original emit), and give **every method an explicit return type**
  (`: this` for chainables; the `explicit-module-boundary-types` lint rule requires it on an exported
  class). **Typing policy:** the
  *dynamic* match/aggregate dispatch (operator-table lookup, `_.get` path access, open Mongo
  doc/query/options bags) is honestly `any`/`unknown` — don't invent false precision there. But where a
  signature has a *concrete* type (a `boolean`/`string`/`number` return, a string-literal union like the
  `registerOperator` `kind`, an array), annotate it precisely — `any` is the exception, not the default.
  Types live in the TS annotation, NOT in JSDoc: JSDoc keeps prose only (`@param name - …`), no `{type}`
  tags (they'd be redundant/contradictory in `.ts`). The public surface is typed via
  [`src/types.ts`](src/types.ts) + [`src/index.ts`](src/index.ts)'s `Micromongo` interface. Match the
  surrounding file's style: keep `var`/`function` and CJS `require` (no ES `import`); use ES `class` only
  for the three real classes above — the rest stay function/object modules.

## Commands

- `npm run build` — compile `src/*.ts` → `dist/` (CommonJS + `.d.ts`). `npm run typecheck` = `tsc --noEmit`.
- `npm run _test` — build (via the `pre_test` hook) then run the test suite (nyc + mocha, `test/` recursive). This is the command to use during development.
- `npm test` — full gate: also runs lint, jsinspect (currently a no-op), `npm audit`, and a dependency-freshness check via `_deps-check`. Heavier and can fail on environmental issues unrelated to your change; prefer `_test` while iterating.
- `npm run lint` — ESLint over `.ts,.js,.jsx`.
- Run a single test file (tests require from `dist/`, so build first): `npm run build && node ./node_modules/mocha/bin/_mocha test/crud/match/_eql.js`
- Run by test name: `npm run build && node ./node_modules/mocha/bin/_mocha --recursive test/ --grep "_eql"`
- CLI smoke test: `bash examples/cli/run.sh` (from `examples/cli/`), or run examples with `node examples/index.js`.
- `npm run build:docs` — build the browser bundle and copy it into `docs/` (the GitHub Pages site).
  `npm run gen-docs` chains the compat-table generator + `build:docs`. See **Docs site** below.

There are no `.mocharc`/`.nycrc` files — mocha flags (`--recursive -R spec ./test/`) live inline in the `_test` npm script.

## Docs site (`docs/`)

The published, user-facing docs are a **single rich page** at `docs/index.html`, served by GitHub
Pages from `/docs` on `master` (→ <https://alykoshin.github.io/micromongo/>). It carries a live
in-browser playground and a functional-vs-Collection ops table that both run the **real engine**
against `docs/micromongo.global.js` — the committed IIFE bundle (Pages serves only committed files, so
the bundle is copied in rather than referenced from gitignored `dist/`). `index.html` is
**hand-authored** (not generated); [`scripts/build-docs-site.js`](scripts/build-docs-site.js) only
copies the freshly-built bundle + writes `.nojekyll`. After any engine change that should reach the
playground, run `npm run build:docs` to refresh the copied bundle. The root `README.md` is deliberately
slim and points here; the exhaustive per-operator reference lives on this page + in
[`planning/compatibility.md`](planning/compatibility.md). Playground expressions are wrapped in
`return (…)`, so multi-statement examples must be a single expression (wrap in an IIFE) — see the
`update`/`collection` presets.

## Architecture

Entry point chain: `index.js` → `lib/index.js` (public surface) → `lib/crud/` and `lib/aggregate/`.

`lib/index.js` is the public API facade. It re-exports CRUD methods at the top level and exposes `_crud` and `aggregate`. The `_`-prefixed exports throughout the codebase (`_crud`, `_match`, `_project`, `_eql`, ...) are intentionally public for testing and advanced use — the test suite imports internals directly (e.g. `require('../../../lib/crud/match')._eql`). Treat them as a semi-public contract; don't rename without checking test imports.

### CRUD (`lib/crud/`)

- `index.js` — implements `count/find/findOne/delete*/remove/insert*/copyTo`. Each iterates the array calling `match()` per document, then `project()` on matches. Every method validates `Array.isArray(array)` and throws `TypeError` if not. `deleteMany` iterates **backwards** so in-place `splice` doesn't skip elements.
- `match/` — **the core query engine** (split out of the former single `match.js` in Phase 9; `require('./match')` resolves to `match/index.js`). A document matches a query through mutual recursion:
  - `match()` → `_match0` (handles implicit `$where` when query is a string/function) → `_match1` (top-level: dispatches logical operators and field names) → `doExpr` (per-field: dispatches `$`-operators vs nested field paths, recurses). These live in [`match/engine.js`](lib/crud/match/engine.js).
  - Module layout: [`registry.js`](lib/crud/match/registry.js) (the operator tables + `registerOperator`), [`engine.js`](lib/crud/match/engine.js) (dispatch + recursion), [`helpers.js`](lib/crud/match/helpers.js) (the `_contains`/`_eql`/`_array*`/`_bits*`/geo helper family), [`operators/`](lib/crud/match/operators/) (built-ins, each self-registering), [`debug.js`](lib/crud/match/debug.js) (the `DEBUG` toggle), [`index.js`](lib/crud/match/index.js) (facade re-assembling the historical export shape: callable `match` + `.prepareQuery`/`.preOperators`/`.postOperators`/`._eql`/`._arrayEqlOrElementEql`, plus `.registerOperator`).
  - Operators are split into three tables by **when** they run, held in `registry.js`: `preOperators` (logical, evaluated against the whole doc: `$and/$or/$nor/$where/$text`), `postOperators` (field-level comparison/element/array/geo/bitwise operators: `$eq/$gt/$in/$type/$regex/$all/$elemMatch/$size/$not/...`), and `preprocessOps` (`$comment`, run once in `prepareQuery` before matching). Built-ins self-register into these via `registerOperator(kind, name, fn)` (`engine.js` reads them at call time, so a registered operator — including a user's — is visible immediately).
  - **Extension point**: add a query operator with `mm.registerOperator(kind, name, fn)` (`kind` ∈ `'pre'`/`'post'`/`'preprocess'`). This **replaced** the old "mutate `mm._crud._match.postOperators` directly" pattern; see [`experiments/extend_runtime_function_example.js`](experiments/extend_runtime_function_example.js).
  - **Mutual-recursion across the split**: `operators/*` require `engine` for `_match1`/`doExpr`; `engine` does *not* require operators (they wire in through the registry), so there's no circular dependency. The facade `index.js` requires every operator module to trigger self-registration.
  - Field paths use lodash `_.get(doc, path)`, so dotted paths (`'a.b.c'`) work for nested access.
  - Array semantics live in the `_contains`/`_eql`/`_array*` helper family in `helpers.js` — these implement Mongo's "match if scalar equals OR array contains" rules, with `options.all`/`options.any`/`options.sameOrder`/`options.regex` flags. This is where most array-query subtleties (and bugs) concentrate.
  - `$where` runs user code in a Node `vm` sandbox with a configurable timeout (`settings.whereTimeout`, default 1000ms, set via `mm.configure`). The matched document is bound as `this` inside the expression.
- `update.js` — **the update-operator engine**, table-driven like the match engine (`updateOperators` map). `applyUpdate(doc, update, options)` mutates one doc in place and returns whether it changed (so callers compute `modifiedCount` the Mongo way — matched-but-unchanged ⇒ 0). Covers field (`$set`/`$unset`/`$inc`/`$mul`/`$min`/`$max`/`$rename`/`$currentDate`/`$setOnInsert`/`$bit`), array (`$push`/`$addToSet`/`$pop`/`$pull`/`$pullAll` + `$each`/`$position`/`$slice`/`$sort`), and positional path operators. Two non-obvious mechanisms: (1) **positional `$[]`/`$[<id>]`** are handled by `expandPositionalPaths`, a path-expansion layer that fans a positional field path out to concrete array indices *before* any field operator runs — so every operator supports them for free; `$[<id>]` reuses the match engine for its `arrayFilters`. (2) **`$pull` by condition** and `arrayFilters` both reuse the match engine by wrapping the element as `{ _v: el }`. `upsert` is driven from `lib/crud/index.js`, but the document it inserts is built here by `buildUpsertDoc(query, update)` (query equality fields + update operators + `$setOnInsert`); `hasOperators()` does the operator-vs-replacement dispatch.
- `project.js` — applies projection (field inclusion/exclusion). Mongo rules enforced: a projection is either **inclusion** or **exclusion** mode (mixing throws "Unable to mix inclusion and exclusion modes"), `_id` is special-cased and included by default (`ID_PROJECTION_MONGO = true`). Aggregate's `$project` stage reuses the exported `_`-helpers (`_projectionMode`, `_initDoc`, `_validateProjection`, `_projectIncludeExclude`) rather than the top-level `project()`.

### Aggregate (`lib/aggregate/`)

`index.js` — `aggregate(array, stages)` deep-copies the input via `copyTo`, then folds each stage's output into the next. Stage implementations live in the `_aggregateStageOps` map; **all the stages micromongo supports are implemented there** (`$project/$match/$limit/$skip/$unwind/$sort/$group/$addFields/$set/$unset/$count/$sortByCount/$replaceRoot/$replaceWith/$sample/$redact/$geoNear/$lookup/$out/$indexStats`) — adding a new one means filling in its function in that map. Computed-field stages (`$project`, `$group`, `$addFields`, `$redact`) use the expression evaluator in [`lib/aggregate/expression.js`](lib/aggregate/expression.js). Field-path stage args (e.g. `$unwind: '$customer.items'`) are parsed by `_parseFieldPath`, which strips the leading `$`.

### Indexes (`lib/index/`)

Opt-in, **Collection-only** ordered indexes (never the functional `mm.*` API, which can't own the caller's array). One structure backs every index TYPE, mirroring MongoDB:
- [`ordered.js`](lib/index/ordered.js) — `OrderedIndex`: sorted `[{key,doc}]` entries with binary-search `eqRange`/`range`/`sorted(dir)`. **Multikey** is a build-time property (an array-valued field emits one entry per element, sets `multiKey`); **compound** keys are tuples compared lexicographically (prefix queries are a key range). Single-field indexes also keep a value `hash` (`Map<value,docs[]>`) so `eqRange` is O(1) for primitive-key equality (compound/object keys use binary search).
- [`compare.js`](lib/index/compare.js) — total value/key ordering (BSON-intent type brackets) that must agree with the scan's `<`/`>` so index-served range/sort match a scan.
- [`planner.js`](lib/index/planner.js) — `plan(query, …) → {docs, exact} | null`. **Safe by construction:** it only ever returns a candidate *superset*; the caller re-filters via `match()` unless `exact`. Handles single-field eq/range, `$in`, compound-prefix eq, and `$or` (union of per-branch plans).
- [`collection.js`](lib/collection.js) — `createIndex(field | {a:1,b:1})`, `_planQuery`/`_getIndexFor`, `_makeSortProvider` (the sort fast-path the Cursor consults). `find`/`findOne`/`count` all route through the planner; maintenance is **rebuild-after-write** (`_reindex` in `_w`). The index is a pure accelerator — strip it and every query returns identical results, just slower (the randomized scan-vs-index equivalence test in [`test/collection-index-ordered.js`](test/collection-index-ordered.js) guards this).
- **`explain()`** — `Collection.find(q).explain()` returns the plan (the planner emits `explain` metadata; the Cursor surfaces it via `_explainPlan`): `COLLSCAN`/`IXSCAN`/`IXSCAN+FILTER`/`OR`, index name, `exact`, `usedHash`, candidate count, `sortFromIndex`. Does not run the query.

## Conventions

- Style is older-Node (ES5-ish): `var`, `function` expressions, manual `for` loops with cached `len`. New code in existing files should match the surrounding style rather than introducing `const`/`let`/arrow functions mid-file (some files like `cli.js` and parts of aggregate already use modern syntax — follow the file you're editing). Target is `node >= 8`.
- Debugging the match engine is gated behind a single `DEBUG = false` flag in [`lib/crud/match/debug.js`](lib/crud/match/debug.js) and `if (DEBUG) debug(...)` calls — flip it there (one place for the whole engine) to trace match recursion; don't commit it `true`. Note: each module snapshots the value at load, so flip it *before* requiring micromongo (not at runtime).
- `lib/utils.js` exports a no-op `ObjectId(id) => id` stub for Mongo-shape compatibility.

## Tests

`test/` mirrors `lib/` (`test/crud/`, `test/aggregate/`). Uses mocha + chai (`chai-things` for array assertions) + sinon. Files named `*-mongodoc.js` are ported directly from MongoDB documentation examples; `test/crud/match/` unit-tests the engine internals (`_eql`, `_arrayContainsOrEquals`, per-operator-category files). `test/performance.js` holds the timing benchmarks referenced in the README. When changing matcher/projection behavior, check the `-mongodoc.js` files — they encode expected Mongo-compatible semantics.

**RULE — every new MongoDB operator/stage needs a `-mongodoc.js` test.** When you implement (or change) any query, update, projection, or aggregation operator/stage that exists in MongoDB, you MUST add a `*-mongodoc.js` test that ports the **official MongoDB doc example(s) verbatim** — the literal initial document, the exact operator spec, and the documented expected result — with a comment citing the source URL. This is how the suite proves real Mongo conformance (and it catches divergences a hand-written minimal test misses — e.g. the `$pull` `{ $in: [...] }` example exercises match-engine reuse). Hand-written semantic/edge-case unit tests are encouraged *in addition*, but never *instead*. Internal/micromongo-specific concepts with no Mongo equivalent (e.g. `mm.configure`, `Collection`, the `matches()` seam, `mm.registerOperator`) are exempt — they get plain unit tests. To find the canonical examples, fetch the operator's page under `https://www.mongodb.com/docs/manual/reference/operator/...` and verify the example passes before committing.

Run a single file via the mocha JS entry (the `.bin/_mocha` shim is a Windows stub Node can't exec directly): `node ./node_modules/mocha/bin/_mocha test/<path>.js`.

## Validating against a real MongoDB

The `-mongodoc.js` rule proves conformance against the **documented** behavior (examples transcribed by
hand). To catch divergences the docs don't reveal, there's a second, **opt-in** layer that runs the same
operations against a **running mongod** and compares. Two ways, in order of strength:

**1. Differential harness (automated).** [`test-mongo/differential.mjs`](test-mongo/differential.mjs)
runs a set of driver-shaped cases against **both** `micromongo/mock` **and** a real MongoDB (via the
`mongodb` driver) and asserts deep-equal results. This leverages the fact that `micromongo/mock` mirrors
the driver — one test body, two backends; any semantic divergence surfaces as a failure. Run:

```sh
npm run test:mongo
```

- **Config via `.env` (gitignored).** The harness reads `TEST_MONGODB_URI` from `.env` (see
  [`.env.example`](.env.example)) or the environment (env wins over `.env`); `MONGODB_URI` is also
  accepted. Point it at a **THROWAWAY/test database** — it creates and DROPS temp `mmdiff_*`
  collections. `TEST_MONGODB_DB` picks the database for those temp collections (defaults to the db in
  the URI path, else `mm_differential`) — set it when the account is scoped to a specific db and can't
  create arbitrary ones (a shared test cluster). Any source works: docker
  (`docker run --rm -d -p 27017:27017 mongo`), a local install, or Atlas.
- **Opt-in + safe.** The harness *skips* (exit 0) when no URI is set, so normal `npm test` never needs
  mongod. `.env` holds credentials and is gitignored — keep it in sync with `.env.example` (matching
  keys; placeholder values there).
- **Lives OUTSIDE `test/`** so mocha's `--recursive ./test/` never auto-runs it (no accidental mongod
  dependency), and it's not in `package.json` `files[]` (never published).
- **Add a case** by appending `{ name, fixture, run(collection) }` to the `CASES` array. Keep
  `run()` results **order-stable** (end with a `.sort(...)`) so the two backends compare without
  ordering noise; the harness JSON-normalizes to flatten `ObjectId`/BSON wrappers.
- **When a case diverges,** decide: fix micromongo (if it's a real bug) *or* record the difference as a
  **known divergence** in [`planning/compatibility.md`](planning/compatibility.md) and adjust/annotate
  the case. (Authoring this harness already surfaced two: micromongo treats a projection with no non-`_id`
  inclusion field — e.g. `{ _id: 1 }` alone — as "include everything", and `$type` uses JS `typeof`
  names not BSON aliases. Both are documented in compatibility.md.)

**2. Manual spot-check (no harness).** For a one-off check, or when no mongod is wired up: run the
operator's official doc example in a real shell and in micromongo, and compare by eye.
- Real Mongo: `mongosh "$TEST_MONGODB_URI"` and paste the doc example, or use the **MongoDB MCP server**
  (if connected) to `find`/`aggregate` against its cluster.
- micromongo: `node examples/index.js`, or the mongosh-flavored CLI (`micromongo --eval "…"`), or the
  in-browser playground at `docs/index.html`.
- If they differ, either fix the engine (+ a `-mongodoc.js` test) or record the divergence in
  `compatibility.md`.

**When to run:** after changing matcher / projection / update / aggregation semantics, and before a
release. It's not part of `npm test` (needs a server) — invoke `test:mongo` (which reads
`TEST_MONGODB_URI` from `.env`).

## CLI (`cli.js` + `lib/repl.js`)

**mongosh-flavored, in-memory.** [`cli.js`](cli.js) is a thin router; the evaluator lives in [`lib/repl.js`](lib/repl.js). Invocation mirrors [mongosh](https://www.mongodb.com/docs/mongodb-shell/reference/options/) minus server-implying parts (there's no connection): bare `micromongo` → interactive shell; `--eval "<expr>"` (repeatable, only the last result prints) → one-shot; `--file`/`-f` → run a script file; `--shell` after `--eval`/`--file` → stay interactive; `--quiet`/`--json`/`--version`/`-h`. **No connection string** — instead `--load file.json:name` registers a local JSON array as a collection (the in-memory analog). A stray positional is rejected (there's no server to connect to).

`lib/repl.js`: `evalLine(ctx, line)` intercepts shell commands (`show collections`/`show dbs`, `use <name>` (cosmetic — single namespace), `help`, `exit`) then evaluates the rest as **JS in a `vm` sandbox** where `db` (= `mm.db`), `mm`, `ObjectId`, and helpers (`load`/`save`/`show`) are bound — so mongosh's relaxed arg syntax (`{status:'A'}`) works because it's valid JS. A bare `Cursor` result is auto-materialized via `.toArray()`; a returned `Collection` (e.g. from `createIndex`, which is chainable) is summarized, not dumped. Tab-completion (`completer`) is derived by **reflection** from `Collection`/`Cursor` prototypes and the `mm` surface (never hardcoded). `runScript` runs a `.js` file in the same sandbox. See `examples/cli/run.sh` + `examples/cli/report.js`.
