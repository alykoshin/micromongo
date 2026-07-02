# Planning & design docs

micromongo is essentially feature-complete. These docs are the current reference, the outward roadmap,
and the short list of what's left. (Completed-work history lives in git.)

## The docs

| Read | For |
|---|---|
| [compatibility.md](compatibility.md) | **What's supported vs. MongoDB** — per operator/stage/method, with an auto-generated, always-current matrix. |
| [roadmap.md](roadmap.md) | **What's left** — the v1.0 SemVer cut, the opt-in-registration proposal, and out-of-scope items. |
| [application-directions.md](application-directions.md) | **What to use micromongo *for*** — usages, adjacent products, audiences (the outward roadmap). |

## The docs/tests skeleton

Status/coverage in `compatibility.md` is not hand-maintained: a manifest ([`meta/manifest.js`](../meta/manifest.js))
joins MongoDB's operation set ⋈ the live registries ⋈ hand-authored summaries
([`meta/summaries.js`](../meta/summaries.js)), and generators project it into the compat tables
(`scripts/gen-compat-tables.js`) and executable example tests (`test/meta/`). Run `npm run gen-compat-tables`
to refresh; a test fails if the committed tables drift from the code.

## The published docs site

The user-facing docs page lives in [`../docs/`](../docs/) (served by GitHub Pages from `/docs` on
`master` → <https://alykoshin.github.io/micromongo/>). It's a single rich page with a live in-browser
playground and a functional-vs-Collection ops table that computes results against the real engine.
`docs/index.html` is hand-authored; `docs/micromongo.global.js` is the committed IIFE bundle it runs.
Run `npm run build:docs` (build bundles + copy) to refresh the bundle after engine changes; see
[`../scripts/build-docs-site.js`](../scripts/build-docs-site.js). (The former `planning/html/` draft
was evolved into this and removed.)
