# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev server (port 3000)
npm run dev:web

# PM2 managed process
pm2 start ecosystem.config.js

# Data pipeline scripts
npm run build:slots          # rebuild slot snapshots
npm run build:interactions   # rebuild interaction snapshots
npm run capture:visual-batch # visual snapshot batch
npm run capture:home-lower   # home lower section captures
npm run verify:home-links    # home link coverage check
npm run check:git-upload     # preflight before git push

# Acceptance reports
npm run report:acceptance
npm run report:acceptance-pack
```

No test runner is configured. Verification is done via acceptance scripts and visual capture pipelines.

## Architecture

### Entry point

`server.js` is a raw Node `http` server (no framework). It loads `.env` at startup via `loadEnvOverrides()`, imports all modules at the top, and routes everything with a manual `if/else` on `req.url` and `req.method`. All data paths are declared as constants near the top of the file.

### Build pipeline (the core flow)

A design build request travels through four stages:

```
POST /api/build
  → runBuilderV2()          builder-v2/orchestrator.js
    → engine.run()          builder-v2/engine-v2.js
      → runLocalBuilderProvider()  builder-v2/provider-local.js  (if builderProvider=local)
      → LLM via OpenRouter          (fallback or when local returns null)
      → runStructuralCriticFixLoop()  builder-v2/engine-helpers.js
    → finalizeBuilderV2Run()  builder-v2/finalize.js
      → runVisualCriticForDraft()  (visual quality gate)
      → fresh rerun if qualityFailed && attempt < 1
```

`orchestrator.js` is thin — its job is assembling `builderInput`, materializing reference/visual assets, and checking the sufficiency gate before handing off to the engine. All LLM calls go through `llm.js`.

### Key parameter contracts

`builder-v2/contracts.js` normalizes four key dimensions of every build request:

| param | values | env override |
|---|---|---|
| `builderVersion` | `v2` / `legacy` | `BUILDER_DEFAULT_VERSION` |
| `builderMode` | `standard` / `compare` | `BUILDER_DEFAULT_MODE` |
| `rendererSurface` | `tailwind` / `custom` | `BUILDER_DEFAULT_RENDERER_SURFACE` |
| `builderProvider` | `openrouter` / `local` | `BUILDER_DEFAULT_PROVIDER` |

`patchDepth` (`light` / `medium` / `strong` / `full`) controls temperature, asset generation, and which visual critic path runs.

### LLM roles

Five separate LLM roles, each with independent model + fallback env vars:

| role | env key | purpose |
|---|---|---|
| Planner | `PLANNER_MODEL` | generates requirement plan from user input |
| Composer | `COMPOSER_MODEL` | structural composition intent before build |
| Builder | `BUILDER_MODEL` | main design operations generation |
| Fixer | `FIXER_MODEL` | targeted fix pass when structural critic fires |
| Critic | `CRITIC_MODEL` | visual quality evaluation of rendered draft |

All LLM calls go through helpers in `llm.js` (`callOpenRouterJson`, `withLlmTimeout`). Fallback chain is tried in order if primary model fails with a retryable error.

### Renderer surface split

Two renderer surfaces are active:

- **`tailwind`** — `builder-v2/renderer/home-tailwind.js`, `catalog-tailwind.js`, `service-tailwind.js`. Used when `rendererSurface=tailwind`. Hero and quickmenu have full recipe-driven variants.
- **`custom`** (scoped CSS) — `builder-v2/renderer/home.js`. Fallback and legacy sections. CSS variables prefixed `--v2-*` and `--codex-*`.

Section renderers are called directly from `server.js` when serving `/clone/<pageId>` and `/p/<pageId>` routes. The renderer is selected based on `primitiveTree` presence in the stored `componentComposition`.

### Data layers

| path | purpose | git status |
|---|---|---|
| `data/normalized/` | curated JSON: recipes, component schemas, design tokens, blueprints | tracked |
| `data/raw/` | archived page HTML, assets, sitemaps | tracked |
| `data/runtime/` | users, sessions, workspaces, draft builds | **gitignored** |
| `data/visual/` | screenshot/visual captures | **gitignored** |
| `data/debug/` | debug dumps | **gitignored** |

Primary editable state lives in `data/normalized/editable-prototype.json` and is forked per-user into `data/runtime/workspaces.json`.

### Key normalized data files

- `home-recipe-library.json` — hero/quickmenu recipe variants by tone (`premium`, `editorial`, `cinematic`, `neutral`, `service-trust`). Required by `provider-local.js` and renderer files.
- `page-builder-prompt-blueprints.json` — per-page design rules: goals, mustKeep, avoidance patterns, cluster relationships, section roles.
- `design-reference-library.json` — 10+ external design system references (Wise, Ferrari, HashiCorp, etc.) with viewport/page-type mappings.
- `component-rebuild-schema-catalog.json` — 39 component families with patch schemas and slot definitions.
- `section-family-contracts.json` — slot-level contracts per section family.
- `style-runtime-token-presets.json` — runtime style token presets.

### Auth / workspace model

`auth.js` manages users, sessions (cookie `lge_workspace_session`), and workspaces. Each workspace is a viewport-keyed fork of `editable-prototype.json`. For the `home` page, workspace keys are `home@pc`, `home@mo`, `home@ta`; all other pages use `pageId` directly.

Draft builds (`listDraftBuilds` / `saveDraftBuild`) track operations, reports, and snapshots per user+page+viewport. Saved versions are separate from drafts and can be pinned.

### Page identity

`getPageIdentityOverride` / `savePageIdentityOverride` allow per-user override of a page's `designIntent`, tone, and other context fields. This feeds into `inferRequestedTone()` in `provider-local.js` and into builder prompts.

## Current runtime scope

Active page IDs: `home`, `support`, `bestshop`, `care-solutions`, `category-tvs`, `category-refrigerators`, `lg-signature-info`, `objet-collection-story`, plus PDP route `/clone-product`.

## Environment setup

Copy `.env.example` to `.env` and fill in:
- `OPENROUTER_API_KEY` — required for all LLM calls
- Model vars default to `anthropic/claude-sonnet-4.6`; override per role if needed
- `PORT` defaults to 3000
