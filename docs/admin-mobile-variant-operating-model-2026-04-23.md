# Mobile Variant Operating Model (2026-04-23)

## 목적

이 문서는 앞으로 모바일 기준 작업을 열 때

- PC와 모바일을 같은 정본으로 볼지
- 별도 build variant로 볼지
- admin UI에서는 어떻게 전환할지
- 저장/조회 schema를 어떤 단위로 고정할지

를 먼저 결정하기 위해 작성한다.

핵심 판단은 하나다.

`정본은 viewport variant별로 분리하고, admin UI만 빠르게 전환 가능하게 만든다. 자동 device 감지는 preview 편의 기능으로만 제한한다.`

상위 기준 문서:

- [Runtime Checkpoint (2026-04-22)](./admin-runtime-checkpoint-2026-04-22.md)
- [Design Runtime Guardrails (2026-04-22)](./admin-design-runtime-guardrails-2026-04-22.md)
- [Markdown-First Authoring Flow](./admin-markdown-first-authoring-flow-2026-04-22.md)
- [Runtime Renderer Contract](./admin-runtime-renderer-contract-2026-04-21.md)

---

## 1. 결론

모바일은 아래처럼 운영한다.

1. 정본 단위는 `pageId + viewportProfile`이다
2. `pc`, `mo`, 필요하면 `ta`는 각각 독립된 requirement plan / draft build / saved version / pinned view를 가진다
3. admin 화면에서는 같은 페이지 detail 안에서 `PC | Mobile` 전환은 가능하다
4. 하지만 전환은 `현재 선택된 variant context 변경`일 뿐, 같은 정본을 responsive로 재해석하는 동작이 아니다
5. 자동 device 감지는 preview frame과 clone shell 편의 기능에서만 허용한다
6. 자동 device 감지가 plan/draft/version의 저장 정본을 바꾸면 안 된다

즉:

```text
운영 UX: 한 화면에서 빠르게 PC/MO 전환 가능
저장 정본: 완전히 분리
```

---

## 2. 왜 이렇게 가야 하는가

### 2.1 현재 runtime은 viewport별 정본 구조에 더 가깝다

현재 새 본선 draft 경로는 `viewportProfile`을 payload로 받고,

- editable component catalog
- reference shell
- current section html map
- author input
- authored html package
- runtime renderer

를 모두 viewport 기준으로 다시 만든다.

관련 코드:

- [server.js](/home/mrgbiryu/clonellm/server.js:998)
- [server.js](/home/mrgbiryu/clonellm/server.js:28804)
- [server.js](/home/mrgbiryu/clonellm/server.js:28827)

즉 현재 구조는
`하나의 responsive authored result를 runtime이 자동으로 나눠 주는 구조`가 아니라
`viewport별 authored result를 따로 렌더하는 구조`에 가깝다.

### 2.2 preview 편의용 auto device와 저장 정본을 섞으면 다시 같은 문제가 난다

현재 clone shell에는 home 기준 auto viewport detection이 일부 있다.

관련 코드:

- [server.js](/home/mrgbiryu/clonellm/server.js:26600)
- [server.js](/home/mrgbiryu/clonellm/server.js:27201)

이건 preview frame에서 어떤 clone URL을 볼지 정하는 편의 기능이다.

이 기능을 plan/draft/version의 저장 기준으로 올리면 아래 문제가 생긴다.

- 사용자가 같은 page detail 안에서 무엇을 저장 중인지 불명확해짐
- same-session 검증 시 PC draft와 MO draft가 섞임
- compare / pin / replay check가 같은 키를 보지 않게 됨
- 과거의 “렌더는 되는데 저장 정본이 다른 path를 본다” 문제가 다시 생김

### 2.3 현재 코드도 이미 저장물은 viewport를 가진다

workspace 저장 계층은 이미 plan / draft / version 모두 `viewportProfile` 필드를 가진다.

관련 코드:

- [auth.js](/home/mrgbiryu/clonellm/auth.js:725)
- [auth.js](/home/mrgbiryu/clonellm/auth.js:774)
- [auth.js](/home/mrgbiryu/clonellm/auth.js:849)
- [auth.js](/home/mrgbiryu/clonellm/auth.js:891)

따라서 지금 필요한 것은
`responsive 하나로 합치기`가 아니라
`viewport별 정본 모델을 전 페이지로 일관되게 확장하기`다.

---

## 3. 현재 코드의 충돌 지점

모바일 운영을 열기 전에 아래 충돌을 먼저 인정해야 한다.

### 3.1 admin-research는 아직 home 외 페이지를 무조건 `pc`로 본다

관련 코드:

- [admin-research.html](/home/mrgbiryu/clonellm/web/admin-research.html:2730)
- [admin-research.html](/home/mrgbiryu/clonellm/web/admin-research.html:2947)
- [admin-research.html](/home/mrgbiryu/clonellm/web/admin-research.html:6076)
- [admin-research.html](/home/mrgbiryu/clonellm/web/admin-research.html:6116)

현재 상태:

- 타깃 카탈로그에 `home-pc`, `home-ta`만 있다
- `getViewportProfile(page)`는 home 외에는 무조건 `pc`다
- 따라서 service / PLP / PDP는 mobile 원천이 있어도 plan/build 저장이 전부 `pc`로 들어간다

판정:

- `운영 UI가 아직 viewport-variant 정본 모델을 전 페이지에 반영하지 못함`

### 3.2 workspace pin key가 home만 viewport-aware다

관련 코드:

- [auth.js](/home/mrgbiryu/clonellm/auth.js:43)
- [auth.js](/home/mrgbiryu/clonellm/auth.js:918)
- [auth.js](/home/mrgbiryu/clonellm/auth.js:945)

현재 상태:

- `resolveWorkspaceViewportKey()`는 home만 `home@pc`, `home@mo`처럼 분기한다
- 다른 페이지는 viewport가 달라도 key가 그냥 `support`, `category-tvs` 등으로 합쳐진다

문제:

- non-home 페이지에서 `pc`와 `mo`를 둘 다 운영하면 pin state 충돌이 발생한다

판정:

- `모바일 운영 전 가장 먼저 고쳐야 할 1순위`

### 3.3 admin work summary도 home만 viewport-aware다

관련 코드:

- [server.js](/home/mrgbiryu/clonellm/server.js:1439)

현재 상태:

- work summary key는 home만 `home:pc`처럼 분기한다
- 나머지 페이지는 viewport가 달라도 하나로 합친다

문제:

- sidebar readiness, latest work, builder ready 표시가 viewport별로 분리되지 않는다

판정:

- `UI summary 계층도 variant-aware로 재작성 필요`

### 3.4 local planning scenario가 page family fallback에 의존한다

관련 코드:

- [provider-local.js](/home/mrgbiryu/clonellm/design-pipeline/provider-local.js:220)
- [server.js](/home/mrgbiryu/clonellm/server.js:28738)

현재 상태:

- page별 local planning scenario는 `home`, `support 계열`, `pdp` 정도만 구분한다
- PLP나 새로운 mobile variant는 별도 scenario 없이 fallback 시나리오로 들어갈 수 있다

문제:

- viewport를 분리하더라도 concept 구조가 다른 page family 문맥을 섞어 받을 수 있다

판정:

- `모바일 운영 모델과 함께 scenario selection도 정리해야 함`

---

## 4. 운영 모델

### 4.1 기본 단위

모든 운영 정본은 `pageVariant` 단위로 본다.

```json
{
  "pageId": "support",
  "viewportProfile": "mo",
  "pageVariantKey": "support:mo"
}
```

규칙:

- `pageId`는 페이지 identity
- `viewportProfile`은 `pc | mo | ta`
- `pageVariantKey`는 운영 정본 키

주의:

- home만 특수취급하지 않는다
- 모든 page family가 같은 규칙을 쓴다

### 4.2 연결 단위

PC와 모바일을 같은 경험 단위로 묶고 싶으면,
정본이 아니라 상위 연결 필드로 묶는다.

예:

```json
{
  "experienceId": "home-mainline",
  "variants": ["home:pc", "home:mo", "home:ta"]
}
```

역할:

- 같은 페이지군이라는 관리상 연결
- 같은 컨셉서 뿌리에서 파생됐는지 추적

하지 않는 일:

- variant 정본을 공유하지 않음
- pin / draft / compare를 대신하지 않음

### 4.3 UI 모델

admin detail은 아래처럼 본다.

```text
Page: support
Variant Tabs: PC | Mobile
Current Context: support:mo
```

전환 시 바뀌는 것:

- requirement plan list
- latest plan
- latest draft build
- saved versions
- pinned view
- preview URL
- compare URL
- builder audit / sidecar / design-reference query

전환 시 바뀌지 않는 것:

- page identity의 상위 성격
- 페이지 자체의 소속 그룹
- admin 화면의 현재 page detail shell

### 4.4 auto device detection 허용 범위

허용:

- clone shell preview frame
- compare shell
- reference shell quick preview

금지:

- requirement plan save 대상 자동 결정
- draft build 저장 variant 자동 결정
- version pin 대상 자동 결정

한 줄로:

`device detection은 viewer 기능일 뿐, authoring 정본 선택 기능이 아니다.`

---

## 5. 스키마 초안

### 5.1 공통 키

```json
{
  "pageId": "category-tvs",
  "viewportProfile": "mo",
  "pageVariantKey": "category-tvs:mo",
  "experienceId": "category-tvs-mainline"
}
```

필수 원칙:

- 모든 workspace entity는 `pageId`, `viewportProfile`를 가진다
- query/filter/pin key는 `pageVariantKey` 기준으로 동작한다
- `experienceId`는 선택 필드다

### 5.2 Requirement Plan

```json
{
  "id": "plan-123",
  "pageId": "support",
  "viewportProfile": "mo",
  "pageVariantKey": "support:mo",
  "experienceId": "support-mainline",
  "derivedFromPlanId": "plan-support-pc-001",
  "originType": "local-provider-saved",
  "input": {
    "userInput": {
      "targetScope": "components",
      "targetComponents": ["support.hero", "support.mainService"]
    }
  },
  "output": {
    "requirementPlan": {}
  }
}
```

설명:

- `derivedFromPlanId`는 mobile이 pc 기획을 출발점으로 삼았는지 추적용
- 정본 공유가 아니라 lineage 기록이다

### 5.3 Draft Build

```json
{
  "id": "draft-123",
  "pageId": "support",
  "viewportProfile": "mo",
  "pageVariantKey": "support:mo",
  "experienceId": "support-mainline",
  "planId": "plan-123",
  "builderVersion": "design-runtime-v1",
  "snapshotData": {
    "referencePageShell": {
      "pageId": "support",
      "viewportProfile": "mo"
    }
  }
}
```

설명:

- replay / compare / pin은 항상 draft의 own viewport를 본다
- 다른 viewport fallback을 draft 정본에 숨기지 않는다

### 5.4 Saved Version

```json
{
  "id": "version-123",
  "pageId": "support",
  "viewportProfile": "mo",
  "pageVariantKey": "support:mo",
  "experienceId": "support-mainline",
  "planId": "plan-123",
  "buildId": "draft-123",
  "versionLabel": "support-mo-v1"
}
```

### 5.5 Pinned View

```json
{
  "pageVariantKey": "support:mo",
  "versionId": "version-123",
  "viewportProfile": "mo",
  "pinnedAt": "2026-04-23T00:00:00.000Z"
}
```

핵심:

- `support`와 `support:mo`를 같은 key로 취급하면 안 된다
- pin key는 모든 페이지에서 viewport-aware여야 한다

### 5.6 Admin UI State

```json
{
  "selectedPageId": "support",
  "selectedViewportProfile": "mo",
  "selectedPageVariantKey": "support:mo",
  "selectionMode": "variant-tab"
}
```

UI state 규칙:

- `pageId`와 `viewportProfile`를 따로 저장
- URL query도 둘 다 직접 가진다
- `home`만 별도 규칙으로 빼지 않는다

---

## 6. API 모델 초안

### 6.1 모든 workspace API의 최소 입력

```json
{
  "pageId": "support",
  "viewportProfile": "mo"
}
```

적용 대상:

- `/api/workspace/plans`
- `/api/workspace/plan`
- `/api/workspace/build-local-draft`
- `/api/workspace/draft-builds`
- `/api/workspace/version-save`
- `/api/workspace/versions`
- `/api/workspace/view-pin`
- `/api/workspace/component-editability`
- `/api/workspace/builder-audit`
- `/api/workspace/design-reference-library`
- `/api/workspace/artifact-sidecar-registry`

### 6.2 variant-aware key helper 통일

필수 helper:

```text
buildPageVariantKey(pageId, viewportProfile)
```

권장 반환:

```text
home:pc
home:mo
support:pc
support:mo
category-tvs:pc
category-tvs:mo
```

주의:

- home만 `@`를 쓰고 나머지는 pageId만 쓰는 현재 방식은 retire 대상이다

---

## 7. URL 모델

### 7.1 결론

URL은 하나로 끝내지 않는다.

대신 아래 3계층으로 고정한다.

1. workspace canonical URL
2. immutable review URL
3. alias URL

핵심 원칙:

- 운영 진입은 고정 URL에서 본다
- 그 URL은 로그인한 workspace의 현재 pinned 또는 latest approved variant를 해석한다
- 리뷰, 승인, 회귀 확인은 immutable URL로 본다
- 캠페인, QA, 공유 진입점은 alias URL이 target을 가리키게 한다

관련 현재 코드:

- [server.js](/home/mrgbiryu/clonellm/server.js:912)
- [server.js](/home/mrgbiryu/clonellm/server.js:26589)
- [server.js](/home/mrgbiryu/clonellm/server.js:28259)
- [server.js](/home/mrgbiryu/clonellm/server.js:28322)
- [server.js](/home/mrgbiryu/clonellm/server.js:29275)
- [auth.js](/home/mrgbiryu/clonellm/auth.js:891)

### 7.2 Workspace Canonical URL

예:

```text
/clone/support?viewportProfile=mo
/clone/category-tvs?viewportProfile=pc
```

의미:

- 같은 URL은 항상 같은 page variant를 가리킨다
- 실제 렌더 대상은 로그인한 사용자의 workspace 상태가 결정한다

권장 해석 정책:

1. `pageId + viewportProfile`로 variant를 고정한다
2. 해당 variant의 pinned version이 있으면 pinned version snapshot을 렌더한다
3. pinned version이 없으면 latest approved version을 찾는다
4. 그것도 없으면 shared-default 또는 live baseline으로 fallback한다

장점:

- 운영 URL은 바뀌지 않는다
- 로그인 사용자마다 각자 마지막 저장 상태를 볼 수 있다
- variant가 섞이지 않는다

주의:

- canonical URL만으로 리뷰 링크를 대신하면 안 된다
- 같은 URL이 시간이 지나며 다른 결과를 가리킬 수 있기 때문이다

### 7.3 Immutable Review URL

현재 존재:

```text
/runtime-draft/<draftBuildId>
/runtime-compare/<draftBuildId>
```

권장 추가:

```text
/version/<versionId>
/compare/version/<versionId>
```

또는 query 기반으로:

```text
/clone/support?viewportProfile=mo&versionId=version-123
```

역할:

- 승인 기록 고정
- QA 회귀 재현
- 버그 리포트 링크
- “그때 그 화면” 재검증

원칙:

- immutable URL은 특정 draft 또는 version을 직접 가리킨다
- latest, pinned, workspace fallback을 섞지 않는다

### 7.4 Alias URL

예:

```text
/view/home-main
/campaign/summer-support-mo
/preview/category-tvs-latest
```

의미:

- 사람이 기억하기 쉬운 별칭 URL
- 내부적으로 canonical 또는 immutable target을 resolve한다

이 계층이 필요한 이유:

- 고도화 시 새로운 진입 URL이 추가될 수 있다
- path를 다시 설계하지 않고 alias target만 바꾸면 된다
- 캠페인/운영/QA 용도를 분리하기 쉽다

원칙:

- alias는 정본이 아니다
- alias는 target pointer다
- 같은 alias가 workspace-scoped인지 shared인지 visibility로 명시한다

### 7.5 Route Schema 초안

```json
{
  "routeId": "route-support-mo-main",
  "routeKind": "canonical",
  "slug": "/clone/support?viewportProfile=mo",
  "pageId": "support",
  "viewportProfile": "mo",
  "pageVariantKey": "support:mo",
  "targetType": "pinned-view",
  "targetRef": {
    "resolutionPolicy": "workspace-pinned-or-latest-approved"
  },
  "visibility": "workspace"
}
```

```json
{
  "routeId": "route-version-123",
  "routeKind": "immutable",
  "slug": "/version/version-123",
  "pageId": "support",
  "viewportProfile": "mo",
  "pageVariantKey": "support:mo",
  "targetType": "saved-version",
  "targetRef": {
    "versionId": "version-123"
  },
  "visibility": "workspace"
}
```

```json
{
  "routeId": "route-campaign-support-mo",
  "routeKind": "alias",
  "slug": "/campaign/summer-support-mo",
  "pageId": "support",
  "viewportProfile": "mo",
  "pageVariantKey": "support:mo",
  "targetType": "saved-version",
  "targetRef": {
    "versionId": "version-123"
  },
  "visibility": "workspace"
}
```

필수 필드:

- `routeKind`: `canonical | immutable | alias`
- `pageId`
- `viewportProfile`
- `pageVariantKey`
- `targetType`
- `targetRef`
- `visibility`

### 7.6 Path 규칙

권장 규칙:

1. path는 page identity를 나타낸다
2. viewport는 query 또는 명시적 segment 하나로만 표현한다
3. version/draft 같은 고정 개체는 별도 immutable path를 쓴다
4. loginId를 path에 넣지 않는다
5. workspace 해석은 session 기반으로 한다

권장 예시:

```text
/clone/<pageId>?viewportProfile=<pc|mo|ta>
/runtime-draft/<draftBuildId>
/runtime-compare/<draftBuildId>
/version/<versionId>
/view/<aliasSlug>
```

피해야 할 것:

- home만 별도 path 규칙을 갖는 것
- viewport를 path와 query에 중복 저장하는 것
- legacy path를 새 canonical path처럼 다시 쓰는 것
- loginId 기반 URL을 public path에 노출하는 것

---

## 8. 레거시 분리와 정리 원칙

모바일 variant를 여는 과정에서 코드가 더러워지지 않으려면
`새 경로를 만든다`와 `기존 레거시를 남겨 둔다`를 동시에 하지 말아야 한다.

원칙은 아래와 같다.

### 8.1 운영 본선은 하나로 고정한다

현재 본선은 `admin-research.html`과 `/api/workspace/*`다.

따라서:

- `admin.html`의 retired LLM route는 확장하지 않는다
- `/api/llm/plan`, `/api/llm/build` 계열에는 mobile 지원을 추가하지 않는다
- 새 variant 기능은 `/api/workspace/*`에만 넣는다

### 8.2 variant-aware helper는 공용으로 올리고, home 특수 로직은 줄인다

필수 정리 대상:

- `resolveWorkspaceViewportKey()`
- admin work summary key helper
- full completion / execution chain key helper
- clone shell link builder의 home-only 분기

원칙:

- 새 helper는 `buildPageVariantKey(pageId, viewportProfile)`처럼 공용 함수로 만든다
- 기존 home-only key helper는 호출부를 치환한 뒤 제거한다

### 8.3 새 URL을 추가할 때는 retire 기준도 같이 적는다

새 route를 만들면 아래 중 하나를 같은 턴에 결정한다.

1. 기존 route를 즉시 삭제한다
2. 즉시 삭제가 어렵다면 410 또는 retired 주석으로 막는다
3. 남겨야 한다면 문서에 owner와 removal 조건을 기록한다

권장 기록 항목:

- 왜 남겼는가
- 누가 참조하는가
- 언제 지울 것인가
- 새 경로는 무엇인가

### 8.4 주석보다 삭제를 우선한다

성능과 가독성 기준에서는
“안 쓰는 분기”를 코드에 남겨 두는 편이 더 비싸다.

원칙:

- dead path면 삭제
- 즉시 삭제가 위험하면 짧은 retired 주석과 함께 차단
- 긴 설명은 코드가 아니라 문서에 남긴다

### 8.5 URL 계층을 더 만들더라도 resolver는 하나로 유지한다

canonical, immutable, alias URL이 늘어나도
실제 target 해석기는 가능한 한 하나의 resolver 계층에서 처리한다.

이유:

- 핀 해석 로직 중복 방지
- latest fallback 분기 중복 방지
- page/viewport 파싱 중복 방지
- 추후 alias 추가 시 성능 저하와 경로 드리프트 방지

한 줄 기준:

`새 URL은 늘어날 수 있지만, 해석 로직은 흩어지면 안 된다.`

---

## 9. 구현 순서

### Phase 1. 운영 모델 고정

먼저 아래 판단을 팀 기준으로 고정한다.

1. 정본은 variant별로 분리
2. UI는 통합 전환
3. auto device는 preview only

이 문서가 그 기준이다.

### Phase 2. 키 정규화

먼저 고칠 것:

1. `auth.js`의 `resolveWorkspaceViewportKey()`
2. `server.js`의 `buildAdminPageWorkSummaryMap()`
3. `server.js`의 full completion / execution summary key helpers

목표:

- home special-only key 제거
- 전 페이지 variant key 통일

### Phase 3. admin-research variant UI

해야 할 일:

1. 타깃 카탈로그에 mobile variant 추가
2. `getViewportProfile(page)`를 전 페이지 variant-aware로 변경
3. URL state를 `pageId + viewportProfile` 기준으로 저장
4. detail panel이 variant tab 전환 시 같은 query set을 다시 조회

### Phase 4. plan/build scenario 분리

해야 할 일:

1. service/plp/pdp mobile용 local planning scenario 정리
2. scenario fallback이 다른 page family 구조를 섞지 않게 수정

### Phase 5. audit / report 확장

해야 할 일:

1. readiness audit에 `*:mo` 추가
2. execution chain report에 `*:mo` 추가
3. fullCompletionReport를 variant-aware로 확장

---

## 10. 종료 조건

아래가 모두 성립하면 모바일 운영 모델 1차가 닫힌다.

1. `support:pc`와 `support:mo`가 각각 다른 latest plan / draft / version / pin을 가진다
2. admin 화면에서 `PC | Mobile` 전환 시 같은 detail shell 안에서 각각의 variant state를 본다
3. preview / compare / runtime-draft가 저장된 variant와 같은 viewport를 본다
4. readiness / execution summary / builder audit가 `pageVariantKey` 기준으로 집계된다
5. auto device detection을 꺼도 저장 정본 선택에 영향이 없다

---

## 9. 한 줄 기준

`모바일은 PC의 responsive 표시 모드가 아니라 별도 운영 variant다. 다만 사용자는 admin에서 두 variant를 빠르게 전환해 볼 수 있어야 한다.`
