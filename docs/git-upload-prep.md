# Git Upload Prep

## Scope

- repository root: `/mnt/c/users/mrgbi/lge-site-analysis`
- branch: `main`
- tracked candidate baseline:
  - source: `server.js`, `auth.js`, `llm.js`, `web/`
  - docs: `docs/`
  - scripts: `scripts/`
  - source data: `data/raw/`, `data/normalized/`

## Ignore Policy

- `node_modules/`
- `tmp/`
- `*.log`
- `data/runtime/`
- `data/visual/`
- `data/debug/`
- `data/reports/`

## Current Notes

- staged candidate count: `520`
- `data/raw/` and `data/normalized/` are intentionally included
- generated capture/debug/runtime artifacts are intentionally excluded

## Pre-Upload Checks

1. verify staged set is source/doc/script/raw+normalized only
2. keep generated/runtime/visual outputs excluded
3. confirm known operational advisories are documented
4. confirm `care-solutions` header duplication fix is included in `server.js`
5. confirm admin acceptance/review surface changes are included in `web/admin.html`
6. confirm `README.md` exists with runtime scope and command summary

## Before Commit / Push

1. run a final `git diff --cached --name-only`
2. run syntax checks for touched JS files
3. confirm branch is `main`
4. confirm no accidental large generated files entered the index

## Helper Command

- `npm run check:git-upload`
  - branch 확인
  - staged count 확인
  - ignored/generated path 누수 검사
  - `server.js`, `auth.js`, `llm.js` syntax 검사
