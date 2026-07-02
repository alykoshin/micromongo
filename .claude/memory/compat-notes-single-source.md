---
name: compat-notes-single-source
description: compatibility.md per-op notes live only in meta/summaries.js; prose tables were deduped
metadata: 
  node_type: memory
  type: project
  originSessionId: 4cc83f4f-b915-403e-9503-6d6a9889ade9
---

The compat data pipeline has ONE hand-authored source of per-operation prose: `meta/summaries.js`.
Each entry may carry `summary` (one-liner, used where space is tight — the HTML ops table), `notes`
(rich multi-sentence/markdown, rendered in the generated compat-table Notes column via
`notes || summary`), `returns` (methods table Returns column), plus `partial`/`extra`/`example`.

`planning/compatibility.md` used to ALSO carry hand-written prose tables (Implemented/Absent methods,
per-query-operator, per-update-operator, projection, aggregation stages/exprOps) that DUPLICATED the
generated tables — ~64% of the 924-line file was hand prose. As of 2026-07-02 those duplicate prose
tables were collapsed into short pointers to the [generated tables](#compatibility-matrix--auto-generated);
the rich notes moved into `summaries.js` as `notes`/`returns`. Genuinely-narrative sections (mutation
contract, security/$where, indexes design, text-search limitations, known bugs) stay hand-written.

The manifest's method surface reads BOTH the functional `mm.*` API AND the `Collection` class
(`meta/manifest.js` `liveRuntime()`), so a method implemented on either counts as supported;
Collection-only methods (the index family) carry `record.collectionOnly` and a "**Collection-only**"
note. The separate `test/meta/drift.js` UNSUPPORTED_METHODS_BASELINE reads only `mm.*` (a different
concern) — bump it when adding a functional method, not a Collection one.

**Why:** the two representations could silently disagree; the generated table is computed from the live
registry ⋈ MongoDB's set and can't drift. **How to apply:** to change an op's compat note, edit
`meta/summaries.js` and run `npm run gen-compat-tables` (a test fails if the committed doc is stale).
Every supported op (all surfaces) MUST have a summary or a meta test fails. Never re-add a per-op prose
table to compatibility.md. See [[docs-site-pipeline]] and [[mongodb-mock-adapter]].
