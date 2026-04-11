# lge-site-analysis

LG전자 클론 분석/재현 작업 저장소다. 목표는 단순 화면 복제가 아니라, 실제 live reference를 기준으로 clone 화면을 맞춘 뒤 각 영역을 `slot/source/patch` 단위로 다룰 수 있게 정리해서 이후 LLM 편집 단계로 연결하는 것이다.

## Current Runtime Scope

- core pages
  - `home`
  - `support`
  - `bestshop`
  - `care-solutions`
  - `category-tvs`
  - `category-refrigerators`
- info pages
  - `lg-signature-info`
  - `objet-collection-story`
- PLP pages
  - `category-tvs`
  - `category-refrigerators`
- PDP route
  - `/clone-product`

## Main Routes

- admin: `/admin`
- preview: `/preview`
- page shell: `/p/<pageId>`
- clone page: `/clone/<pageId>`
- clone content only: `/clone-content/<pageId>`

## Key Commands

- dev server
  - `npm run dev:web`
- home link verification
  - `npm run verify:home-links`
- home lower capture
  - `npm run capture:home-lower`
- visual batch
  - `npm run capture:visual-batch`
- git upload preflight
  - `npm run check:git-upload`

## Data Policy

- included
  - `data/raw/`
  - `data/normalized/`
- excluded from git
  - `node_modules/`
  - `tmp/`
  - `data/runtime/`
  - `data/visual/`
  - `data/debug/`
  - `data/reports/`

## Working References

- purpose reference
  - `docs/project-purpose-reference.md`
- consolidated status
  - `docs/project-consolidated-status.md`
- home progress
  - `docs/home-progress-log.md`
- git upload prep
  - `docs/git-upload-prep.md`
