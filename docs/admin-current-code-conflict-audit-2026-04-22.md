# Current Code Conflict Audit (2026-04-22)

## 목적

이 문서는 현재 코드가 새 본선 계약과 어디서 충돌하는지 정리한다.

핵심은 하나다.

`이 audit은 현재 코드를 기준으로 계약을 수정하기 위한 문서가 아니라, 무엇을 삭제하고 무엇을 격리하고 무엇을 새로 구현할지 결정하기 위한 문서다.`

상위 기준 문서:

- [Design Quality North Star](./admin-design-quality-north-star-2026-04-21.md)
- [Schema Guardrail](./admin-schema-guardrail-2026-04-21.md)
- [Runtime Renderer Contract](./admin-runtime-renderer-contract-2026-04-21.md)
- [Implementation Readiness](./admin-implementation-readiness-2026-04-22.md)

---

## 1. 총평

현재 코드는 세 군데에서 새 계약과 크게 충돌한다.

1. `design-pipeline` 내부에 남아 있는 legacy bridge
2. `server.js`의 현재 clone 조립 본선
3. 남아 있는 `builder-v2` / old LLM mainline 잔재

즉 지금 상태는:

- 문서는 새 본선을 정의했지만
- 코드 본선은 아직 `patch / template / family / inject / reinject / critic / recovery` 구조에 묶여 있다

---

## 2. 충돌 축 A: design-pipeline 내부 legacy bridge

### 2.1 canonical model에 legacy 필드가 남아 있음

문제 위치:

- [design-pipeline/clone-model.js](/home/mrgbiryu/clonellm/design-pipeline/clone-model.js:95)
- [design-pipeline/clone-model.js](/home/mrgbiryu/clonellm/design-pipeline/clone-model.js:130)

현재 상태:

- `familyId`
- `templateId`
- `primitiveTree`
- `patch`
- `boundary.mode`
- `renderIntent.compositionMode`
- `toolAccess`

가 canonical model normalizer에 직접 들어간다.

문제:

- 새 계약은 authored html/tailwind 직접 작성 구조다
- 그런데 canonical model이 여전히 legacy template/family/patch 어휘를 1급 필드로 유지한다

판정:

- `삭제 또는 하위 호환 브리지로 강등`

### 2.2 local build foundation이 family/template/patch 중심임

문제 위치:

- [design-pipeline/build-local.js](/home/mrgbiryu/clonellm/design-pipeline/build-local.js:123)
- [design-pipeline/build-local.js](/home/mrgbiryu/clonellm/design-pipeline/build-local.js:192)
- [design-pipeline/build-local.js](/home/mrgbiryu/clonellm/design-pipeline/build-local.js:459)
- [design-pipeline/build-local.js](/home/mrgbiryu/clonellm/design-pipeline/build-local.js:481)

현재 상태:

- `resolveSectionProfile()`가 slot별 `familyId/templateId/variant/assetPlan`을 고정한다
- `buildSectionPatch()`가 slot별 카피를 직접 만든다
- `buildOperationsFromSections()`가 `replace_component_template`, `update_component_patch`를 만든다
- draft 저장물도 `operations`, `componentComposition`, `cloneRequest`를 핵심 산출물처럼 가진다

문제:

- 새 본선은 `Authored Section HTML Package`가 중심이어야 한다
- 지금 build-local은 여전히 “section authoring”이 아니라 “legacy composition synthesize”에 가깝다

판정:

- `대폭 축소 후 재작성`

### 2.3 builder/tool access가 legacy 제어판 어휘를 유지함

문제 위치:

- [design-pipeline/tools.js](/home/mrgbiryu/clonellm/design-pipeline/tools.js:1)

현재 상태:

- `primitiveFamilies`
- `allowedOperations`
- `tonePresets`
- `layoutControls`

같은 내부 제어판 어휘가 살아 있다

문제:

- 이건 Design Author의 자유도를 다시 enum형 제어판 안으로 넣는 통로다

판정:

- `삭제`

---

## 3. 충돌 축 B: server.js clone 조립 본선

### 3.1 inject/reinject 기반 조립이 본선임

문제 위치:

- [server.js](/home/mrgbiryu/clonellm/server.js:21618)
- [server.js](/home/mrgbiryu/clonellm/server.js:22868)

현재 상태:

- `injectHomeReplacements()`
- `rewriteCloneHtml()`

가 실제 본선이며,

- raw html 읽기
- live patch merge
- draft patch merge
- family 분기
- selector replace
- 누락 시 fallback 삽입
- 마지막 reinject

를 한 함수 체인 안에서 수행한다

문제:

- 새 계약의 Runtime Renderer는 authored html delivery only여야 한다
- 현재 경로는 runtime이 구조를 다시 고르고 다시 조합한다

판정:

- `본선에서 제거, 새 runtime slice와 분리`

### 3.2 home 경로가 legacy patch/family 소비에 묶여 있음

문제 위치:

- [server.js](/home/mrgbiryu/clonellm/server.js:21656)
- [server.js](/home/mrgbiryu/clonellm/server.js:21854)
- [server.js](/home/mrgbiryu/clonellm/server.js:21922)

현재 상태:

- `heroLivePatch + heroDraftPatch`
- `findEffectiveDraftComponentCompositionEntry`
- `familyId === "hero-carousel-composition"`

같은 조건으로 렌더 경로를 고른다

문제:

- 새 본선은 `authored html`을 정본으로 써야 한다
- 현재는 patch/composition/family가 authored result보다 우선권을 가진다

판정:

- `삭제`

### 3.3 fallback 삽입과 후처리 정규화가 과도함

문제 위치:

- [server.js](/home/mrgbiryu/clonellm/server.js:22300) 주변 lower section 삽입들
- [server.js](/home/mrgbiryu/clonellm/server.js:22779)

현재 상태:

- selector miss 시 다른 위치에 inject
- mobile/pc 별 regex fallback
- skeleton 제거
- gap/template cleanup

문제:

- 새 본선은 authored html + boundary + shell delivery만 담당해야 한다
- 지금은 runtime이 실제 page composition을 재조립한다

판정:

- `새 runtime slice 밖으로 격리`

### 3.4 local draft 저장도 legacy draft shape를 우회하지 못함

문제 위치:

- [server.js](/home/mrgbiryu/clonellm/server.js:28178)
- [server.js](/home/mrgbiryu/clonellm/server.js:28215)

현재 상태:

- `/api/workspace/build-local-draft`는 `buildLocalBuildFoundation -> buildLocalBuildDraftItem -> saveDraftBuild()` 순서로 저장한다
- 저장 shape 안에 `operations`, `componentComposition`, `cloneRequest`, `snapshotData`가 강하게 남는다

문제:

- authored html package가 직접 저장/서빙되는 구조가 아니다
- 여전히 legacy draft store shape에 번역해서 넣는다

판정:

- `격리 후 신규 draft store adapter 필요`

---

## 4. 충돌 축 C: builder-v2 / old mainline 잔재

### 4.1 retired route 뒤에 대규모 unreachable legacy 코드가 남아 있음

문제 위치:

- [server.js](/home/mrgbiryu/clonellm/server.js:28773)
- [server.js](/home/mrgbiryu/clonellm/server.js:29115)

현재 상태:

- `/api/llm/plan`, `/api/llm/build`는 `410`을 바로 반환한다
- 하지만 그 뒤에 planner/builder 전체 old path가 그대로 남아 있다

문제:

- 실행은 안 되더라도 유지 비용과 문맥 오염 비용이 크다
- 이후 구현 중 다시 참조되어 레거시 회귀의 발판이 된다

판정:

- `삭제 후보 1순위`

### 4.2 builder-v2 자체가 critic/recovery/template synthesize 중심임

문제 위치:

- [builder-v2/engine-helpers.js](/home/mrgbiryu/clonellm/builder-v2/engine-helpers.js:58)
- [builder-v2/orchestrator.js](/home/mrgbiryu/clonellm/builder-v2/orchestrator.js:194)
- [server.js](/home/mrgbiryu/clonellm/server.js:29368)

현재 상태:

- `template_replace`
- critic debug
- sufficiency recovery
- visual critic
- recovery route

가 구조 안에 깊게 박혀 있다

문제:

- 새 계약의 Visual Verifier는 advisory 보조 계층이다
- builder-v2의 critic/recovery 구조는 새 본선과 철학이 다르다

판정:

- `본선 완전 제외, 단계적 삭제`

---

## 5. 분류

### 5.1 바로 삭제 후보

- `/api/llm/plan` 뒤 unreachable old planner path
- `/api/llm/build` 뒤 unreachable old builder path
- `design-pipeline/tools.js`의 family/operation/preset 제어판

### 5.2 본선에서 격리할 대상

- `injectHomeReplacements()`
- `injectServiceLikeReplacements()`
- `injectCategoryPdpReplacements()`
- `rewriteCloneHtml()`
- `builder-v2/*`

### 5.3 신규 구현으로 대체할 대상

- authored html package 저장 어댑터
- 새 runtime renderer 최소 경로
- authored html 기반 before/after 생성
- visual verifier 한 번 재시도 경로

---

## 6. 첫 구현 slice에 필요한 최소 절단

첫 slice 전에 최소한 아래는 선을 그어야 한다.

1. 새 runtime 경로는 `inject/reinject` 본선에 얹지 않는다
2. 새 runtime 경로는 `operations/componentComposition`을 정본으로 보지 않는다
3. 새 runtime 경로는 `authoredSectionHtmlPackage.sections[*].html`을 정본으로 본다
4. legacy draft store shape가 필요하더라도, authored html package를 잃지 않는 별도 adapter로만 연결한다

---

## 7. 한 줄 기준

`현재 코드의 문제는 기능 부족이 아니라, 새 본선이 들어갈 자리를 legacy patch/template/inject 구조가 계속 점유하고 있다는 점이다.`
