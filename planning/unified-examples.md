# Unified examples — one canonical case, five projections

## Problem

The same fact — _"operator X, given fixture F, produces result R (per MongoDB docs URL)"_ — is
duplicated across **five** hand-maintained formats that can silently disagree:

| #   | Where                              | Format                                                       | Drives                          |
| --- | ---------------------------------- | ------------------------------------------------------------ | ------------------------------- |
| 1   | `test/**/*-mongodoc.js` (26 files) | imperative mocha`it()` (`array`/`query`/`res` + `crud.find`) | micromongo conformance vs. docs |
| 2   | `meta/summaries.js` `example` (62) | `{ seed, call, result }` (call = **mm JS string**)           | `test/meta/examples.js` + docs  |
| 3   | `docs/index.html` ops table        | inline JS`{ seed, func, coll }`                              | HTML playground cards           |
| 4   | `test-mongo/differential.mjs`      | `{ fixture, run, ... }` (5 cases)                            | live-Mongo differential         |
| 5   | `planning/compatibility.md`        | prose                                                        | the matrix                      |

## Insight

Each is a **projection of one canonical object**. The repo _already_ proved this pattern:
`meta/summaries.js` `example` → `test/meta/examples.js` makes one example serve **both** a test and
the docs. Two things stop it from being THE single source:

1. **The operation is an mm-specific string** (`call: 'mm.find(data, {…})'`) — runnable on micromongo,
   but **not portable to the real MongoDB driver** and not cleanly comparable. Fix: operation **as
   data** — `do: { find: { query, projection } }` — from which we synthesize micromongo calls, driver
   calls, AND a display string (proven feasible; see the PoC in this doc's history).
2. **The other four silos still exist separately** — they must be absorbed into the canonical set.

## The canonical record

```js
// meta/mongo-examples.js — the ONE source
{
  op: '$gt',                          // operator/stage/method exemplified (for grouping)
  kind: 'queryOp',                    // method | stage | exprOp | queryOp | updateOp
  title: 'Greater Than a Value',      // human label (doc heading)
  source: 'https://www.mongodb.com/docs/manual/reference/operator/query/gt/',
  fixture: [ { _id: 1, a: 1 }, … ],   // seed docs — real data, not a string
  do: { find: { query: { a: { $gt: 3 } }, projection: { _id: 0 } } },  // operation AS DATA
  expect: [ { a: 5 }, { a: 9 } ],     // documented result
  real: 'exact',                      // vs live Mongo: 'exact' | 'skip:<why>' | 'structural:<kind>'
}
```

`do` is a one-key object naming the operation: `find`/`findOne`/`aggregate`/`updateOne`/`updateMany`/
`replaceOne`/`distinct`/`deleteOne`/`count`. A shared `apply(engine, fixture, do)` runs it on either
micromongo or a driver `Collection`.

## Five projections (each a small renderer over the canonical set)

| Consumer                    | Derivation                                                      | Replaces                                        |
| --------------------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| **micromongo test**         | `applyMM(fixture, do)` deep-equals `expect`                     | `test/meta/examples.js` + the 26 `-mongodoc.js` |
| **live-Mongo differential** | `applyDriver(realColl, do)` deep-equals `expect` (honor `real`) | hand cases in`differential.mjs`                 |
| **compat matrix**           | group by`op`; render `do`→`expect` + status                     | example bodies in`gen-compat-tables.js`         |
| **HTML playground**         | each record → a runnable card                                   | inline cases in`docs/index.html`                |
| **doc provenance**          | `source` + `expect` = the verbatim `-mongodoc` assertion        | the citation comments                           |

## Non-determinism (the `real` field)

Operators that can't deep-equal across engines set `real`:

- `skip:<why>` — `$rand`, `$currentDate`, `$sample` random pick, `$meta:textScore`, `$text` scores.
- `structural:count` / `structural:order` — assert a weaker invariant both must satisfy (e.g. `$sample`
  returns N from the set; `$geoNear` same ORDER not same distance floats).
  Micromongo tests still assert `expect` exactly (deterministic there); only the live-Mongo comparison
  relaxes.

## Migration — ALL 4 STEPS DONE

1. **DONE — Format + `apply()` + runner.** `meta/mongo-examples/` (per-source files aggregated by
   `meta/mongo-examples.js`), `meta/apply-example.js` (`applyMicromongo`/`applyDriver`), and the mocha
   runner `test/meta/mongo-examples.js`.
2. **DONE — Live-Mongo replay.** `test-mongo/differential.mjs` consumes the canonical set via
   `applyDriver`, asserting **documented == real Mongo == micromongo** (honors `real:` exact/skip/
   structural; seeds `$lookup` foreign collections; normalizes auto-`_id`s and unordered arrays).
3. **DONE — Absorbed the 26 `-mongodoc.js` corpus** (via parallel subagents). **178 canonical records**;
   `npm run test:mongo` → **164 checked / 14 skipped / 0 diverged** vs a real MongoDB. **17 mongodoc
   files deleted** (fully absorbed); **8 kept** (non-portable: error-throws, driver reports, `$where`
   fn forms, statistical/`$near`). Caught + fixed a real `replaceOne` `_id` bug.
4. **DONE — Repointed docs.** Retired the `summaries.js` `example` field + `test/meta/examples.js`
   (superseded — those 62 examples are now canonical records; expression operators + core methods
   added in `40-expr-and-methods.js`). `scripts/gen-docs-examples.js` emits `docs/examples.generated.js`
   — a CURATED **20-card showcase** (`SHOWCASE` op list, one `docs:true` record per op — HTML shows
   FEWER than the full test corpus) with synthesized `func`/`coll` call strings; `docs/index.html`'s
   ops-table `buildOps()` reads that global instead of inline cases. Wired into `npm run build:docs`.

Net: **`meta/mongo-examples/` is the single source.** Tests (micromongo + live Mongo), the docs
playground, and (via `summaries.js` prose) the compat matrix all derive from it. Add an operator
example once → tested against micromongo AND real Mongo, and (if `docs:true` + in `SHOWCASE`) shown in
the playground. The compat *matrix* stays manifest-driven (registry ⋈ Mongo set); it never rendered
examples, so nothing to repoint there.
