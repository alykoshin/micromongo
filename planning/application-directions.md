# Application directions

A wide-angle brainstorm of **what micromongo can be used for and where it could go next** — usages,
adjacent products, new audiences, and speculative bets. This is deliberately idea-dense and
exploratory: many entries are mutually exclusive, and inclusion here is *not* a commitment.

> This is the **outward** ("what to build it into / sell it as") companion to the **inward**
> ("how to grow the engine") roadmap. For what engine work is left see [roadmap.md](roadmap.md);
> for exactly what's supported today vs. MongoDB, see [compatibility.md](compatibility.md). The
> **multi-target build (Phase T3) has largely shipped** — CJS + ESM + a browser IIFE + a lean
> `micromongo/core` subpath — so the browser/edge/bundler audiences referenced below as "T3-unlocked"
> are now unblocked; what remains is the v1.0 SemVer cut (`node >= 14`) plus packaging/recipes/JSR
> publishing. Read T3-references below as "shipped — remaining work is packaging," not "blocked."

**Framing.** The value isn't "it does MongoDB queries." It's: *you already have an array in memory and
a need that normally forces a heavier tool* (a database, a server, a bespoke DSL, a callback soup).
micromongo is the in-process, dependency-light, MongoDB-shaped answer to that need — and, less
obviously, it bundles **three independently useful engines**: a boolean **match** engine
(`match(doc, query) → bool`), a value-computing **expression** engine, and an **ordered-index +
query planner**. Several directions below come from *unbundling* those.

**Contents**

- [The core primitive, re-conceived](#the-core-primitive-re-conceived)
- [Application clusters](#application-clusters) (the main content)
- [New runtime targets](#new-runtime-targets)
- [Adjacent products built on the engine](#adjacent-products-built-on-the-engine)
- [Audiences](#audiences)
- [Trust & differentiation moats](#trust--differentiation-moats)
- [Keystone enablers (what unlocks the most)](#keystone-enablers)
- [Ranking & strategic lanes](#ranking--strategic-lanes)
- [Open questions to pick a direction](#open-questions-to-pick-a-direction)

---

## The core primitive, re-conceived

Strip away "in-memory MongoDB" and three reusable engines remain, each valuable alone:

1. **`match(doc, query) → bool` as a standalone, serializable predicate.** A JSON-expressible, safe
   (no `eval` outside `$where`) filter *format*. Anywhere you'd write a JS callback filter but need the
   filter to be **data** — stored, sent over the wire, edited in a UI — this replaces it.
2. **The query object as a portable filter standard.** MongoDB query syntax is a de-facto standard for
   serializable filters (GraphQL filter args, CMS/admin filters, JSON:API). Position micromongo as a
   **reference evaluator** for that format.
3. **The expression engine as a sandboxed formula language.** `$add`/`$cond`/`$concat`/field-refs is a
   spreadsheet-grade formula evaluator that's JSON, not code → low-code / computed-column use cases.
4. **The planner/`explain()` as a teaching artifact.** A planner that can *explain its choice* is a
   uniquely good way to teach how database indexes work.

The meta-move: **publish these as separable entry points** (the T3 subpaths make this real) so people
adopt one engine without the whole Mongo surface.

---

## Application clusters

Grouped by the *situation* that makes micromongo the right tool. For each: concrete apps, why
micromongo specifically fits, and what (if anything) it needs.

### 1. Browser / frontend data layer — the biggest unexploited domain

**Situation:** the data is already in JS memory on the client; you want server-grade query power with
no round-trip.

- **Client-side data grids / tables** — sortable, filterable, paginated tables are exactly
  `find().sort().skip().limit()`; filter chips → `$and`/`$in`/`$regex`; column sort → index-backed
  `sort`; pagination → `skip`/`limit`; `explain()` to debug slow filters.
- **Faceted search / filter sidebars** — `$group` + per-facet counts, recomputed as filters change
  (`$facet`, if added, does the whole sidebar in one pipeline).
- **Local-first / offline apps** — sync a slice down once, then every interaction queries locally
  (instant, offline, no API chatter) — the "everything feels instant" pattern.
- **Optimistic UI + derived views** — deep-immutable reads + explicit writes make a local collection a
  clean source-of-truth for a view, re-derived on each write.
- **Browser extensions** — filtering bookmarks/history/tabs/DOM-scraped records with no backend.
- **Embedded analytics widgets** — "top 10 by revenue this week" over a client-held array.

**Needs:** the **T3 ESM/browser build** (bundlers + `<script>`) + React/Vue/Svelte binding recipes. The
inferred-generics typing (the object literal IS the schema) is the differentiator vs. `sift`/`mingo`
and is currently invisible — show it off here.

### 2. Testing & development infrastructure

**Situation:** you need MongoDB *semantics* in a test, but not a MongoDB.

- **Drop-in test double for the real driver** — with an async, driver-shaped facade, code written
  against `mongodb` runs against micromongo in unit tests; no `mongodb-memory-server` (which downloads +
  spawns a real `mongod` — slow/flaky in CI). In-process, synchronous, works in the browser too.
- **Seed / fixture engine** — load fixtures as an array, assert state with the same query language the
  app uses.
- **Contract / snapshot tests for query logic** — pin a fixture set; a refactor of query *construction*
  is caught.
- **Storybook / component-dev data** — components that expect "a collection" get a real queryable one.
- **A custom test matcher** — `expect(result).toMatchQuery({ status: 'A', qty: { $gt: 5 } })`.

**Needs:** the **driver-shaped async adapter** (the keystone); the rest are recipes on top.

### 3. Configuration, rules, and policy as data

**Situation:** rules are expressed as data; you need to decide "does this thing match." The *match
engine as a serializable predicate* shines — the rule is JSON (stored, versioned, sent over the wire,
edited in a UI), not code.

- **Feature flags / experiment targeting** — roll out where `{ country: { $in: […] }, plan: 'pro',
  signupDate: { $lt: … } }`; evaluating it for a user is `match(user, rule)`; add "why did/didn't this
  user match" for a debuggable targeting system.
- **Authorization / ABAC policies** — "allow if `{ 'resource.ownerId': '$user.id', action: { $in: […] } }`".
- **Routing / dispatch rules** — webhook/alert/notification routers ("send to X when event matches Q").
- **Content-moderation / filter rules** — match incoming records against stored filter queries.
- **Pricing / discount / promotion rules** — `$expr` + the expression engine can even *compute* the
  discount, not just gate it.
- **Declarative form / business-logic validation.**

**Why micromongo:** the format is a recognized standard, safe to evaluate (non-`$where` path), and
serializable end-to-end — vs. a bespoke DSL nobody else understands or a pile of `if`s. **Needs:**
mostly positioning + a "rules engine" recipe; maybe a small "explain why matched" helper.

### 4. Data wrangling / CLI / pipeline tooling

**Situation:** JSON/JSONL on disk or stdin; you want to query it without a database. (The CLI already
does `--load file.json:name` + `db.x.find(…)`.)

- **A `jq` alternative for Mongo-literate people** — `cat data.json | micromongo --eval 'db.x.aggregate([…])'`.
- **Log analysis** — load JSONL, `$regex`/`$gte` on timestamps, `$group` by error code, `$sortByCount`;
  ad-hoc triage without Elasticsearch.
- **CSV/JSON ETL-lite** — load two files, `$lookup` to join, `$project` to reshape, `$out` to a result.
- **Build-time / CI data checks** — "fail the build if any record matches `{ deprecated: true }`"
  (a linter for data files).
- **A single static binary** (`bun build --compile`) — a zero-dep CLI competing with `q`/`textql`/`dsq`.

**Needs:** positioning + maybe a static-binary build target. The CLI exists.

### 5. AI / LLM / agent applications

**Situation:** an LLM/agent needs to query structured data, and you want it safe, local, and in a
format the model produces well. Mongo query JSON is unusually LLM-friendly (fixed vocabulary, nested
JSON, abundant training data).

- **NL → query, run locally** — model emits a query/pipeline; micromongo executes it over in-context
  data (no DB, no network, no `eval`). The operator vocabulary is enumerable (via the codegen in
  `scripts/gen-mongo-operators.js`), so model output can be *constrained* to valid queries.
- **A query tool for agents** — hand an agent `find`/`aggregate`/`distinct` over a loaded array as a
  bounded, synchronous tool: the **server-less analog of the MongoDB MCP**.
- **RAG pre-filtering** — filter retrieved chunks with a structured query before they reach the model.
- **Structured-output validation** — validate/reject LLM JSON against a query/shape, then retry.
- **Eval harnesses** — generate synthetic data, run queries, assert results (deterministic substrate).
- **"Explain this query" tutor** — query ↔ plain-English, grounded in real evaluation.

**Why micromongo:** safety (no server/network to inject into outside `$where`), determinism (seedable
`$sample`/`$rand`), LLM-friendly format. **Needs:** a small `tool`-shaped wrapper + a JSON grammar
export — both modest.

### 6. Notebooks, dashboards, analyst tooling

**Situation:** someone wants pandas-groupby ergonomics in JavaScript.

- **In-notebook analysis** (Observable, JS Jupyter kernels) — `$group`/`$avg`/`$sortByCount` → chart.
- **Pivot tables / cross-tabs** — `$group` + `$facet`.
- **Lightweight BI widgets** computing their numbers client-side from a fetched array.
- **Spreadsheet-style computed columns** via the expression engine.

**Needs:** the **date/type/set expression operators** (the current expression-engine gap — see
[compatibility.md → Expression operators](compatibility.md)) make real analytics pipelines work.

### 7. Embedded / constrained / edge runtimes

**Situation:** a JS runtime where a real DB (or a heavy dependency) is impractical.

- **Edge functions** (Cloudflare Workers, Deno Deploy) — query a config blob / cached dataset with no
  DB connection (no cold-start pool, no egress).
- **IoT / embedded JS / kiosks** — query local sensor/event buffers in low-memory environments.
- **Mobile (React Native)** — offline cache query layer.
- **WASM-sandboxed plugins** — give a plugin a queryable view of host data without host APIs.

**Why micromongo:** synchronous, tiny dependency footprint (lodash + minimist), no I/O. **Needs:** the
lean `./core` subpath (T3) so only the functional matcher is imported.

### 8. Education

**Situation:** teaching MongoDB / DB concepts with zero setup.

- **Zero-install Mongo sandbox** — the REPL in a browser playground, embedded in tutorials.
- **Teaching indexes/planners** — `explain()` + a narrating planner is genuinely good pedagogy.
- **Interview prep / exercises** against fixed datasets.
- **Course/bootcamp fixtures** queried offline.

---

## New runtime targets

Where the code *runs* (mostly unlocked by T3):

- Browser-native zero-dep build (UMD `<script>` + CDN, no bundler required).
- WASM/browser **playground** (REPL in the page; embed in docs and in *other people's* docs).
- Edge / serverless functions.
- Deno / Bun first-class (publish to JSR, not just npm).
- React Native / mobile.
- A **single static binary** CLI (`bun build --compile` / `pkg` / `nexe`).
- (Speculative) a SQL UDF / Postgres-SQLite extension evaluating a Mongo filter over a JSONB column.

---

## Adjacent products built on the engine

Whole products, not features:

- **In-memory reactive store** (lokijs / lowdb / RxDB class) — persistence adapters + `watch()` +
  offline-first.
- **A mock MongoDB *server*** speaking the **wire protocol** on a socket, backed by the in-memory engine
  → `mongosh`, Compass, and *any real driver in any language* connect to it. The killer, language-agnostic
  test double with no binary download. (Big — the wire protocol is real work.)
- **Auto-API over an array** (GraphQL/REST) where filter args *are* Mongo queries — "json-server with
  real query power."
- **A rules / targeting / feature-flag engine** with an editor UI + audit + "explain why matched."
- **A CDC/streaming filter** — Mongo-style filters over an event stream (`watch()` generalized).
- **Spreadsheet / notebook plugins** — aggregation as a computed-column / pivot engine.
- **A data-validation / contract-testing tool** (the Jest/Vitest `toMatchQuery` matcher, productized).

---

## Audiences

Sell the same engine to different people:

| Audience | Hook | Clusters |
|---|---|---|
| Frontend devs | "Type-safe local data layer" (inferred generics) | 1 |
| QA / test engineers | Driver test double + mock server | 2 |
| Backend devs | Faithful, verified in-memory Mongo | 2, 3 |
| Data / CLI users | "pandas-groupby / jq, in Mongo syntax" | 4, 6 |
| No-code / low-code builders | Query-as-UI-filter; expression-as-formulas | 3, the primitive |
| AI / agent builders | Safe, local, LLM-friendly query tool | 5 |
| Educators / bootcamps | Zero-install Mongo sandbox; `explain()` as teaching | 8 |
| Embedded / IoT JS | Synchronous, dependency-light, no-DB | 7 |

---

## Trust & differentiation moats

What makes the "compatible engine" claim defensible (turns a claim into a *verified property* — a moat
vs. `sift`/`mingo`):

- **Differential testing against real MongoDB** — run the same query against micromongo *and* a real
  `mongod` (a `mongodb` devDep / MCP is already available in dev), assert identical results over a
  fuzzed corpus.
- **Property-based testing** (fast-check) — random docs+queries; assert scan-vs-index equivalence
  (already done for one case — generalize) and "no query ever throws."
- **A published, versioned compatibility matrix** auto-generated from the operator codegen + tests.
- **Deterministic mode** — seedable `$sample`/`$rand` for reproducible tests.
- **A cross-language conformance suite** — the `-mongodoc.js` corpus + generated operator set as a
  language-agnostic spec other in-memory matchers (Python/Go/Rust) can validate against.

---

## Keystone enablers

Most directions above are unlocked by a small number of investments:

| Keystone enabler | Unlocks |
|---|---|
| **T3 ESM/browser build + lean subpaths** ✅ *shipped* | 1 (frontend), 7 (edge/embedded), 8 (playground), most new runtime targets |
| **Driver-shaped async adapter** | 2 (testing); makes 1 a drop-in for driver-using code |
| **`watch()` / reactivity** | 1 (local-first reactive UIs), parts of 3 (live rule re-eval), 6 (live dashboards) |
| **Small tool/grammar wrapper + safe-eval story** | 5 (AI/agents), parts of 3 (rules-as-data) |
| **Date/type/set expression operators** | 6 (analytics), richer 4 (ETL) |

Two clusters are **pure positioning** (no real code — just README/recipes/examples), so they're the
cheapest wins: **3 (rules engine)** and **4 (CLI / jq-for-Mongo-people)**, plus **8 (education)**. The
engine already does these; nobody knows.

---

## Ranking & strategic lanes

By (impact × reachability):

1. **Frontend data layer / data grids (cluster 1)** — largest audience; inferred-generics typing is a
   real edge; mostly needs packaging (T3) + recipes.
2. **Test double for the Mongo driver (cluster 2)** — sharp, well-defined pain
   (`mongodb-memory-server` is heavy); one keystone (the adapter) unlocks it.
3. **Rules / targeting / policy as data (cluster 3)** — broad, under-served, near-zero new code, strong
   "query-as-serializable-predicate" story.
4. **AI / agent query tool (cluster 5)** — on-trend, well-suited (safe + LLM-friendly format), modest
   wrapper work.
5. **CLI / jq-for-Mongo-people (cluster 4)** — cheap (CLI exists), good awareness driver.

Three coherent **lanes** (pick one rather than chasing everything); they share a spine so early
investment isn't wasted:

| Lane | Thesis | Anchor bets | For |
|---|---|---|---|
| **The compatible engine** | "Most faithful, best-typed in-memory Mongo, verified" | Driver adapter · differential testing · T3/subpaths · expression tail | Test/backend devs |
| **The reactive embedded store** | "Tiny offline-first reactive DB" | `watch()` · persistence · React/Vue bindings · browser build | Frontend / offline / mobile |
| **The portable filter primitive** | "Mongo query syntax as a serializable, safe, everywhere predicate" | Standalone match/expression engines · query-builder UI · LLM/agent tooling · format-as-standard | Low-code · AI · platform builders |

**Shared spine** (serves any lane): separable engines (the primitive) + the **T3 multi-target build** +
**differential-testing trust**.

---

## Open questions to pick a direction

1. **Who to reach first** — frontend devs, backend/test engineers, data/CLI users, or AI builders?
   That choice picks the lane.
2. **Library to grow, or product to spin out?** "Better library" → clusters 1–4 as recipes + the
   driver adapter. "New product" → the reactive store, the mock wire-protocol server, or the rules
   engine as its own thing.

> **Next concrete steps when a direction is chosen:** turn the top pick into a spec (target API, a
> worked end-to-end example, the minimal engine work, the risks), and — cheaply, high-signal — run a
> **differential-test spike** against a real MongoDB to measure how close current micromongo already is
> (validates the "compatible engine" lane before investing).
