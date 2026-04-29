# Design Runtime Guardrails (2026-04-22)

## 목적

이 문서는 앞으로 `clonellm`의 디자인 런타임, 컨셉서, Design Author, `/admin` UI, preview/compare, asset policy를 수정할 때
반드시 먼저 확인해야 하는 구조 문제와 방지 규칙을 고정한다.

이 문서는 `한 번 있었던 버그 모음`이 아니라,
다음 구현에서 다시 같은 실수를 반복하지 않기 위한 필수 가드레일 문서다.

현재 체크포인트:

- [Runtime Checkpoint (2026-04-22)](./admin-runtime-checkpoint-2026-04-22.md)

## 가장 컸던 문제 축

### 1. Tailwind 환경 미주입

문제:

- LLM이 Tailwind utility class로 HTML을 썼는데, runtime preview/full/compare에 Tailwind가 로드되지 않았다.

결과:

- hero overlay가 풀리고
- quickmenu 그리드가 무너지고
- 브라우저가 authored HTML을 “텍스트가 흘러내리는 화면”처럼 렌더했다.

가드레일:

- `after` / section preview / compare는 모두 같은 Tailwind runtime 환경에서 렌더해야 한다.
- authored HTML은 Tailwind 없는 shell에 직접 주입하지 않는다.

### 2. 중간 레이어의 과도한 개입

문제:

- local fallback
- preset / family / template vocabulary
- composition summary
- packet 재요약

같은 중간 레이어가 LLM의 자유도를 줄이고, 결과를 안전하지만 평범하게 만들었다.

가드레일:

- 상위 입력은 Markdown 원문 우선
- 코드는 `runtime delivery projection`만 한다
- 중간 레이어가 새 의미를 만들거나 과도하게 축약하지 않는다

### 3. preview와 full after의 이중 진실

문제:

- section preview와 full after가 서로 다른 렌더 경로를 탔다.

결과:

- 같은 draft인데도
  - full after는 이미지가 있고
  - section preview는 placeholder/회색 화면이 되는 등
  서로 다른 결과를 보여줬다.

가드레일:

- 모든 preview는 하나의 canonical final render에서 파생된다.
- section preview는 authored HTML을 다시 조합하지 않고, final `afterHtml`에서 추출해야 한다.

### 4. preservation failure

문제:

- page scope에서 `targetComponents=[]`
- plan 저장 중 `sectionBlueprints` 손실
- build 시점에 shape가 비는 문제

결과:

- 모델 이전에 `sequence plan empty`
- author input section count 0

가드레일:

- `request -> saved plan -> concept package -> author input`에서
  section identifier와 target group이 그대로 살아 있는지 먼저 본다.
- shape 복구용 fallback은 root cause를 가리는 수단으로 쓰지 않는다.

### 5. 잘못된 자산 역할 재사용

문제:

- `promo-complete` 배너를 hero 배경처럼 쓰거나
- quickmenu 아이콘 자리에 promo 썸네일을 축소 재사용했다.

결과:

- 텍스트 충돌
- 엑박처럼 보이는 배경
- 아이콘 체계 붕괴

가드레일:

- 자산은 `role` 기준으로 쓴다.
- `promo-complete`는 재오버레이 금지
- quickmenu는 `icon-only family`
- full-bleed stage는 `background-only`

### 6. legacy UI / URL / vocabulary 혼입

문제:

- `/clone?...draftBuildId=...`
- old composition cards
- `patch`, `familyId`, `iconSetIds`
- legacy 버튼과 설명 문구

결과:

- 사용자는 본선이 아닌 레거시 화면을 보고 있다고 착각했다.

가드레일:

- `/admin` 기본 버튼은 `runtime-draft/runtime-compare`만 연다.
- old vocabulary는 UI 기본 경로에 남기지 않는다.
- 레거시 결과는 숨기거나 `Legacy`로만 격리한다.

## 앞으로 구현 전에 반드시 확인할 체크리스트

### A. 렌더 정합성

- Tailwind authored HTML이 Tailwind runtime에서 렌더되는가
- full after / section preview / compare가 같은 rendered truth를 보는가
- before clone은 Tailwind side effect 없이 유지되는가

### B. 원문 보존 / 비개입

- Requirement / Concept Markdown이 중간에서 다시 번역되지 않는가
- target section identifier가 저장과 handoff를 통과하며 유지되는가
- runtime이 카피/레이아웃을 재결정하지 않는가

### C. asset role

- hero/stage에서 `background-only`만 full-bleed로 쓰는가
- quickmenu가 `icon-only family`를 쓰는가
- `promo-complete` 자산 재오버레이가 없는가

### D. UI / 운영

- `/admin`이 실제 최신 same-session draft를 여는가
- 레거시 preview URL이 기본 버튼에 남아 있지 않은가
- 화면 설명 문구가 실제 authored 결과와 어긋나지 않는가

### E. 모델 운영

- 구조 검증은 `local / flash`
- 상위 모델은 구조가 안정화된 뒤 품질 실험에서만 사용
- `designChangeLevel`이 실제 author output freedom에 반영되는가

## 현재 기준 문서

- [Design Authoring Architecture](./admin-design-authoring-architecture-2026-04-21.md)
- [Markdown-First Authoring Flow](./admin-markdown-first-authoring-flow-2026-04-22.md)
- [Preservation / Interference Debug Method](./admin-preservation-interference-debug-method-2026-04-22.md)
- [Asset Role Policy Rollout](./admin-asset-role-policy-rollout-2026-04-22.md)
- [Runtime Checkpoint (2026-04-22)](./admin-runtime-checkpoint-2026-04-22.md)

## 한 줄 원칙

`새 코드를 만들기 전에, 이 변경이 Tailwind 렌더 정합성, 원문 보존, asset role, legacy 격리, same-session UI 일치를 깨지 않는지 먼저 본다.`
