# Admin Mobile Capture Truth Audit (2026-04-23)

## 목적

모바일 variant 작업 전에, 현재 본선이 실제로 읽는 mobile capture truth가 페이지군별로 준비돼 있는지 확인한다.

이번 감사의 핵심은 아래 두 가지를 구분하는 것이다.

- `clone` URL이 열린다
- `runtime/builder`가 실제 mobile reference truth를 읽는다

둘은 같은 의미가 아니다.

## 최신 본선 기준

현재 최신 본선 방식은 `captured-first + design-runtime-v1 + Tailwind runtime parity`다.

- clone / builder는 먼저 viewport별 reference truth를 읽는다
- builder는 그 위에 authored HTML을 덧입힌다
- `after / section preview / compare`는 같은 Tailwind runtime에서 렌더되어야 한다

근거:

- [Runtime Checkpoint (2026-04-22)](./admin-runtime-checkpoint-2026-04-22.md)
- [Design Runtime Guardrails (2026-04-22)](./admin-design-runtime-guardrails-2026-04-22.md)

## 실제 코드 기준 경로

### 1. clone truth 로딩

- `readCloneSourceHtmlByPageId(pageId, viewportProfile)`  
  위치: `server.js`

규칙:

- `home`
  - `mo` -> `home.mobile.html`
  - `ta` -> `home.tablet.html`
  - `pc` -> `home.desktop.html`
- `category-*`
  - `reference-live mobile/desktop html` 우선
  - 없으면 `data/visual/plp/*/reference.html` fallback
- `pdp-*`
  - `reference-live mobile/desktop html` 우선
- 나머지 service page
  - `reference-live mobile/desktop html` 우선
  - 없으면 archive fallback

### 2. builder reference 생성

- `buildRuntimeReferenceArtifacts(pageId, viewportProfile, slotIds)`

여기서 `rawShellHtml`, `currentSectionHtmlMap`, `sectionBoundaryMap`, `currentPageAssetMap`가 만들어진다.

즉 builder는 별도 수집을 하지 않고, 이 시점의 clone truth를 그대로 기준으로 삼는다.

## 감사 결과

서비스 mobile `reference-live`는 2026-04-23 UTC 11:12~11:15에 실제 recapture 했다.

| Page | Family | `reference-live mobile html` | `visual/mo` reference | `/clone?...viewportProfile=mo` | 판정 |
|---|---|---:|---:|---:|---|
| `home` | home | yes | n/a | 200 | 준비됨 |
| `support` | service | yes | yes | 200 | 준비됨 |
| `bestshop` | service | yes | yes | 200 | 준비됨 |
| `care-solutions` | service | yes | yes | 200 | 준비됨 |
| `care-solutions-pdp` | service-pdp | yes | yes | 200 | 준비됨 |
| `homestyle-home` | service | yes | yes | 200 | 준비됨 |
| `homestyle-pdp` | service-pdp | yes | yes | 200 | 준비됨 |
| `category-tvs` | plp | yes | n/a | 200 | 준비됨 |
| `category-refrigerators` | plp | yes | n/a | n/a | 준비됨 |
| `pdp-tv-general` | pdp | yes | n/a | 200 | 준비됨 |
| `pdp-tv-premium` | pdp | yes | n/a | n/a | 준비됨 |
| `pdp-refrigerator-general` | pdp | yes | n/a | n/a | 준비됨 |
| `pdp-refrigerator-knockon` | pdp | yes | n/a | n/a | 준비됨 |
| `pdp-refrigerator-glass` | pdp | yes | n/a | n/a | 준비됨 |

## 해석

### 1. 홈 / PLP / 대표 PDP 모바일은 본선 truth가 있다

이 그룹은 `data/raw/reference-live/*.mobile.html`이 실제로 존재한다.

따라서:

- clone
- runtime reference
- build-local-draft

모두 같은 mobile truth를 탈 수 있다.

### 2. 서비스 페이지 모바일도 이제 runtime truth가 있다

현재 service page mobile도 아래 둘이 같이 존재한다.

- `data/raw/reference-live/<pageId>.mobile.html`
- `data/visual/service-pages/<pageId>/mo/reference.html`
- `data/visual/service-pages/<pageId>/mo/working.html`

즉 이제 service mobile도:

- acceptance / visual 비교용 artifact가 있고
- runtime 본선이 직접 읽는 mobile reference truth도 있다

따라서 service mobile build도 최신 captured-first 방식으로 검증 가능한 상태가 됐다.

### 3. `clone 200`은 준비 완료 판정이 아니다

이번 확인에서 아래 경로들은 모두 200이었다.

- `/clone/home?viewportProfile=mo`
- `/clone/support?viewportProfile=mo`
- `/clone/bestshop?viewportProfile=mo`
- `/clone/care-solutions?viewportProfile=mo`
- `/clone/category-tvs?viewportProfile=mo`
- `/clone/pdp-tv-general?viewportProfile=mo`

이번 recapture 이후 service page도 `reference-live mobile html`이 생겼으므로,
이제는 clone 200이 단순 fallback이 아니라 본선 mobile truth 위에서 열릴 수 있는 상태다.

## 결론

현재 기준으로 mobile 작업 readiness는 대표 페이지군 전체에서 준비됨 상태다.

### 바로 진행 가능

- `home`
- service pages
- `PLP`
- 대표 `PDP`

이 그룹은 최신 captured-first 방식과 viewport truth가 맞물린 상태다.

## 권장 다음 단계

1. capture 후 clone source를 다시 확인한다

- `readCloneSourceHtmlByPageId()`가 archive fallback이 아니라 새 mobile live html을 읽는지 확인

2. 그 다음에 mobile build 체인을 검증한다

- `plan-local-preview`
- `plan save`
- `build-local-draft`
- `version-save`
- `pin`

## 한 줄 판정

`home / service / PLP / PDP mobile 모두 최신 본선 방식의 captured-first truth를 탈 준비가 되었고, 이제 다음 단계는 actual mobile build chain 검증이다.`
