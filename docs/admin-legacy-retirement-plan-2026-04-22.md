# Legacy Retirement Plan (2026-04-22)

## 목적

이 문서는 audit 결과를 바탕으로

- 무엇을 즉시 삭제할지
- 무엇을 본선 밖으로 격리할지
- 무엇을 참조용으로만 남길지

를 정리한다.

핵심은 하나다.

`레거시는 기본적으로 걷어내며, 남기더라도 새 본선의 구조 주인이 되지 못하게 해야 한다.`

상위 기준 문서:

- [Implementation Readiness](./admin-implementation-readiness-2026-04-22.md)
- [Current Code Conflict Audit](./admin-current-code-conflict-audit-2026-04-22.md)

---

## 1. 분류 원칙

### 1.1 즉시 삭제

아래 조건이면 바로 삭제 대상이다.

- 이미 route level에서 unreachable
- 새 계약과 철학이 정면 충돌
- 이후 구현 중 다시 참조되면 레거시 회귀 위험이 큼

### 1.2 본선 밖 격리

아래 조건이면 격리 대상이다.

- 지금 당장 삭제하면 운영 영향이 큼
- 하지만 새 본선에서 절대 호출되면 안 됨
- transitional reference 또는 fallback 연구용으로만 보관

### 1.3 참조만 유지

아래 조건이면 참조 유지다.

- 원본 자산/원본 shell/현재 페이지 관찰 데이터
- 새 본선에서도 observation input으로 재사용 가능

---

## 2. 즉시 삭제 후보

### 2.1 retired route 뒤 unreachable planner path

대상:

- [server.js](/home/mrgbiryu/clonellm/server.js:28773) 이하 `/api/llm/plan` 뒤 old planner body

이유:

- 이미 `410 legacy_mainline_retired`
- 남아 있을 이유보다 문맥 오염 비용이 큼

조치:

- route body 삭제
- 안내 응답만 남김

### 2.2 retired route 뒤 unreachable builder path

대상:

- [server.js](/home/mrgbiryu/clonellm/server.js:29115) 이하 `/api/llm/build` 뒤 old builder body

이유:

- 이미 `410 legacy_mainline_retired`
- builder-v2/critic/recovery 문맥을 다시 끌어올리는 entry가 됨

조치:

- route body 삭제
- 안내 응답만 남김

### 2.3 design-pipeline tool control board

대상:

- [design-pipeline/tools.js](/home/mrgbiryu/clonellm/design-pipeline/tools.js:1)

이유:

- primitive family
- allowed operations
- preset/tone/layout control

을 다시 본선 authoring 앞단에 넣는 통로다

조치:

- 파일 삭제 또는 export 제거

---

## 3. 본선 밖 격리 대상

### 3.1 builder-v2 전체

대상:

- `/home/mrgbiryu/clonellm/builder-v2/*`

이유:

- critic/recovery/template synthesize 중심 구조
- 새 본선과 철학 충돌

조치:

- 새 본선 import 금지
- UI/API mainline에서 참조 금지
- 단계적으로 삭제

### 3.2 현재 clone assembly 본선

대상:

- [rewriteCloneHtml()](/home/mrgbiryu/clonellm/server.js:22868)
- [injectHomeReplacements()](/home/mrgbiryu/clonellm/server.js:21618)
- `injectServiceLikeReplacements`
- `injectCategoryPdpReplacements`

이유:

- inject/reinject/patch merge/family 분기 중심
- 새 runtime renderer와 충돌

조치:

- 기존 `/clone-content/*` 본선에서 신규 경로와 분리
- 새 runtime slice는 이 함수들을 호출하지 않음

### 3.3 design-pipeline의 legacy synthesis 부분

대상:

- [clone-model.js](/home/mrgbiryu/clonellm/design-pipeline/clone-model.js:95)
- [build-local.js](/home/mrgbiryu/clonellm/design-pipeline/build-local.js:123)
- [build-local.js](/home/mrgbiryu/clonellm/design-pipeline/build-local.js:459)

이유:

- family/template/primitiveTree/patch/operations/componentComposition 중심

조치:

- 새 본선에서 직접 쓰지 않음
- 신규 authoring 경로가 생기면 교체

---

## 4. 참조만 유지할 대상

### 4.1 raw clone source / shell

대상:

- 원본 clone html
- page shell
- current page screenshot/html/text outline

이유:

- 새 본선에서도 observation / reference 입력으로 필요

### 4.2 compare / preview channel

대상:

- before/after 보여주는 채널 자체

이유:

- 구조 결정기가 아니라 확인 채널로는 계속 유효

### 4.3 원본 자산 추출 데이터

대상:

- current asset map
- current section html/text/asset source

이유:

- Design Author input과 runtime asset resolution에 필요

---

## 5. 삭제/격리 순서

### Phase 1

- unreachable `/api/llm/plan` body 삭제
- unreachable `/api/llm/build` body 삭제
- `design-pipeline/tools.js` 제거

### Phase 2

- 새 runtime slice와 기존 `rewriteCloneHtml` 경로 분리
- 새 본선에서 `inject*Replacements()` 호출 금지

### Phase 3

- builder-v2 import/use 완전 차단
- design-pipeline의 legacy bridge 제거 또는 교체

---

## 6. 한 줄 기준

`레거시는 “있어도 되는가”가 아니라 “새 본선에 영향을 주는가”로 판단한다. 영향을 주면 삭제하거나 격리한다.`
