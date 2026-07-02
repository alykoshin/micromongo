---
name: mongodb-mock-adapter
description: "micromongo/mock is a mongodb-driver-shaped in-memory adapter for other projects' tests"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4cc83f4f-b915-403e-9503-6d6a9889ade9
---

`micromongo/mock` (src/mock/, subpath export) is a drop-in `mongodb`-driver-shaped adapter over the
micromongo engine, for OTHER projects to use in autotests instead of a live MongoDB. Surface:
`MongoClient`/`Db`/`Collection`/`FindCursor`/`AggregationCursor`/`ObjectId`. Consume via
`require('micromongo/mock')` or jest `moduleNameMapper: { '^mongodb$': 'micromongo/mock' }`.

Design decisions (non-obvious):
- **Async wrapping:** micromongo is sync; the mock wraps every result in `Promise.resolve` and cursors
  expose `Symbol.asyncIterator`/`toArray()` Promise/`next`/`hasNext`.
- **Auto-ObjectId** `_id` on insert (driver behavior); prefers the consumer's real `bson.ObjectId` if
  installed (optional peerDep), else a self-contained 24-hex fallback.
- **Per-Db isolated** collection registry (NOT the global `mm.db`) so test files don't share state.
- **Sessions/transactions run the body WITHOUT real isolation** (documented no-op; abort doesn't roll
  back — there's one in-memory array).
- **Server-only features THROW loudly** (`watch`/change streams, Atlas `*SearchIndex*`) so a test
  relying on them fails instead of silently passing.

The real CRUD/index methods this needed (`bulkWrite`/`countDocuments`/`estimatedDocumentCount`/`drop`/
index introspection) were added to micromongo's `Collection` itself (not faked in the adapter);
`countDocuments`/`estimatedDocumentCount`/`drop` also went on functional `mm.*`. Tests:
`test/mock-driver.js`, `test/collection-driver-methods.js`. Mock files carry a file-level
`eslint-disable @typescript-eslint/no-explicit-any` (legit open-shape driver boundary). See
[[compat-notes-single-source]].
