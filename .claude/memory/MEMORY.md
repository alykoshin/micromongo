# Memory index

Project memories for micromongo (one fact per file). See CLAUDE.md → "Memory location".

- [Docs site pipeline](docs-site-pipeline.md) — docs/ is the GitHub Pages site; `npm run build:docs` copies the IIFE bundle in; index.html hand-authored
- [Compat notes single source](compat-notes-single-source.md) — per-op compat notes live only in meta/summaries.js; manifest unions mm.* + Collection; prose tables deduped into generated tables
- [MongoDB mock adapter](mongodb-mock-adapter.md) — micromongo/mock is a mongodb-driver-shaped in-memory adapter for other projects' tests
- [Unified mongo examples](unified-mongo-examples.md) — meta/mongo-examples/ is the ONE source for MongoDB behavior examples; drives micromongo tests + live-Mongo differential + docs playground
- [nyc excludes $where fixtures](nyc-excludes-where-fixtures.md) — nyc must exclude test/ and meta/; $where functions get coverage-instrumented then break in the vm sandbox
