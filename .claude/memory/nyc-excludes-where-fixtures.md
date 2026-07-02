---
name: nyc-excludes-where-fixtures
description: nyc must exclude test/ and meta/ — $where functions get coverage-instrumented then break in the vm sandbox
metadata:
  type: project
---

The `nyc` config in `package.json` **must exclude both `test/**` and `meta/**`** from coverage
instrumentation. **Why:** nyc rewrites function bodies to inject `cov_<hash>()` counters. A `$where`
query given as a **JS function** (e.g. `{ $where: function () { return obj.credits == obj.debits; } }`)
is stringified by the match engine and run in micromongo's Node `vm` sandbox — where the `cov_<hash>`
global doesn't exist → `ReferenceError: cov_… is not defined`, failing the test **only under `npm run
_test`** (which pipes through nyc), while `node .../_mocha <file>` passes.

These `$where`-function fixtures live in two places, both test-support (not the shipped `src/`→`dist/`
library), so excluding them from coverage is correct anyway:
- `test/crud/find-evaluationQuery-mongodoc.js`
- `meta/mongo-examples/11-evaluation.js` (the canonical example set — see [[unified-mongo-examples]];
  this is the one that's easy to miss, since it's under `meta/`, not `test/`).

**Gotcha:** nyc validates its config schema and **silently ignores the whole `nyc` block if it contains
an unknown key** (e.g. a `"//"` comment key) — no error, it just falls back to instrumenting everything.
Keep the `nyc` block to real nyc options only. **How to apply:** if a `$where`-function test starts
failing with `cov_… is not defined` under coverage, add its directory to `nyc.exclude` (never
instrument code whose function bodies get eval'd in the sandbox).
