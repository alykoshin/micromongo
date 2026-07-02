---
name: unified-mongo-examples
description: meta/mongo-examples/ is the ONE source for MongoDB behavior examples; drives tests + live-Mongo + docs
metadata:
  type: project
---

`meta/mongo-examples/` (per-source `*.js` files, aggregated by `meta/mongo-examples.js`) is the SINGLE
canonical set of MongoDB behavior examples — ~178 records. Each is operation-AS-DATA:
`{ op, kind, title, source, fixture, do:{<op>:{…}}, expect, real, docs, collections? }`. One record →
FIVE projections (see `planning/unified-examples.md`):
- **micromongo test** — `test/meta/mongo-examples.js` runs it via `meta/apply-example.js` `applyMicromongo`.
- **live-Mongo differential** — `test-mongo/differential.mjs` runs it via `applyDriver`, asserting
  **documented == real Mongo == micromongo** (`npm run test:mongo`, needs `TEST_MONGODB_URI` in `.env`).
- **docs playground** — `scripts/gen-docs-examples.js` → `docs/examples.generated.js` (curated
  `SHOWCASE` subset, `docs:true` records only — HTML shows FEWER than tests).

`real` controls the live-Mongo comparison: `exact` | `skip:<why>` | `structural:count|order`. Known
`skip` divergences: JS `undefined` vs BSON `null`, `$geoNear` needs a 2d index, `$where` string (vm),
`$rand`/`$sample` non-determinism, `$lookup` (seeds foreign collections via `collections`).

**This replaced 4 silos:** the 26 `-mongodoc.js` files (17 deleted, 8 KEPT for non-portable coverage —
error-throws, driver reports, `$where` fn forms, statistical asserts), the `summaries.js` `example`
field (removed — `summaries.js` is now PROSE only), and the inline `docs/index.html` ops cases.
**Why:** the same fact was maintained in 5 places that could silently disagree. **How to apply:** add a
MongoDB example ONCE as a record here → it's tested vs micromongo AND real Mongo, and (if `docs:true` +
in `gen-docs-examples.js` SHOWCASE) shown in the playground. The port caught + fixed a real bug
(`replaceOne` dropped the matched `_id`). Don't re-add an `example` field to `summaries.js`. See
[[docs-site-pipeline]] and [[compat-notes-single-source]].
