# Builder V2 Hard Switch Plan (2026-04-19)

## 목적

`Track B`는 더 이상 기존 builder를 점진적으로 보강하는 프로젝트가 아니다.

목표는:

- `웹디자인 수준 품질`을 보장하는 builder를 만든다.
- 이를 위해 `Builder V2`를 메인 실행 경로로 올린다.
- legacy builder는 비교/비상 fallback 외에는 더 이상 기능을 추가하지 않는다.

즉 기준은:

- `품질이 invariant`
- `아키텍처는 교체 가능한 수단`

## 현재 코드 기준 진단

### 1. 이미 V2 경계는 생겼다

현재 빌드 라우트는 `builderVersion`을 읽고 `v2`와 `legacy`를 분기한다.

근거:

- [server.js](/home/mrgbiryu/clonellm/server.js:26112)
- [builder-v2/contracts.js](/home/mrgbiryu/clonellm/builder-v2/contracts.js)

현재 기본 동작:

- `payload.builderVersion`
- `plan.input.userInput.builderVersion`
- `process.env.BUILDER_DEFAULT_VERSION`

순서로 버전을 결정하고, 기본값은 `v2`다.

### 2. 엔진 본체는 이제 V2 파일에 올라왔지만, helper는 아직 llm.js 의존이 남아 있다

현재 V2 경로는 `builder-v2/engine-v2.js`를 실제 엔진 본체로 사용하고, 그 안에서 composer → detailer → normalization → synthesis → structural critic → fix까지 수행한다. 다만 세부 helper는 여전히 `llm.js`의 export에 기대고 있다.

근거:

- [builder-v2/orchestrator.js](/home/mrgbiryu/clonellm/builder-v2/orchestrator.js)
- [builder-v2/engine-v2.js](/home/mrgbiryu/clonellm/builder-v2/engine-v2.js)
- [llm.js](/home/mrgbiryu/clonellm/llm.js:5939)

즉 지금 상태는:

- `prepare / sufficiency / asset / entry selection`은 V2
- `compose -> detail -> normalize -> operation synthesis`도 V2 engine에 올라왔다
- 하지만 helper 집합은 아직 `llm.js`에 남아 있다

이다.

### 3. build route 본문에는 아직 transport와 일부 응답 처리만 남고, finalize는 V2 모듈로 이동했다

현재 `/api/llm/build`는:

1. request validate
2. V2/legacy select
3. build result 생성
4. finalize 호출
5. usage/event logging
6. 응답 반환

까지 route 본문에서 직접 처리한다.

근거:

- [server.js](/home/mrgbiryu/clonellm/server.js:26123)
- [builder-v2/finalize.js](/home/mrgbiryu/clonellm/builder-v2/finalize.js)

즉 `draft save / visual critic / visual fix / recovery / final save`는 이미 V2 finalize 모듈로 이동했고, 남은 것은 response shaping과 usage/event 기록 정도다.

### 4. builderVersion은 이미 draft snapshot에 저장된다

이건 중요하다. 이제 검증 결과를 `legacy`와 `v2`로 분리해서 볼 수 있다.

근거:

- [server.js](/home/mrgbiryu/clonellm/server.js:26413)

## 재사용할 것

아래는 계속 재사용한다.

### A. Clone / workspace / page context

- clone 원본
- editable data
- slot registry
- artifact sidecar / section registry
- page identity / workbench

이건 비교 기준, 범위 해석, context injection의 기반이라 유지한다.

### B. Requirements / planner

- 요구사항 입력
- interventionLayer / patchDepth / targetScope / targetComponents
- requirement plan 문서

planner 출력 계약은 강화할 수 있지만, 입력과 기본 역할은 유지한다.

### C. Quality control infra

- whole-page context capture
- reference / asset sufficiency gate
- visual critic
- execution fail vs quality fail separation
- validation harness

이건 V2에서도 그대로 필요하다.

## 완전 교체할 것

### 1. Builder engine

현재 legacy engine:

- [llm.js](/home/mrgbiryu/clonellm/llm.js:5939)

교체 목표:

- primitive composition first
- replacement-first renderer intent
- concrete style runtime contract
- asset runtime contract
- recovery-aware redesign planning

즉 `operations + report` 중심이 아니라:

- `primitiveTree`
- `componentComposition`
- `styleContract`
- `assetBindings`
- `pageShellVariant`

를 본체로 삼는다.

### 2. Renderer execution contract

현재는 아직 patch surface와 mixed renderer가 섞여 있다.

교체 목표:

- 지원 family는 `patch`가 아니라 `replacement-first`
- component 단위 self-contained render
- group/page shell도 dedicated V2 renderer

### 3. Style runtime

현재는 일부 CSS variable/opened token만 있다.

근거:

- [server.js](/home/mrgbiryu/clonellm/server.js:10569)

교체 목표:

- surface tone
- density
- hierarchy emphasis
- spacing scale
- type scale
- contrast preset
- icon/image treatment

이 모두가 `concrete runtime token`으로 내려와야 한다.

### 4. Recovery / critic integration

현재 recovery는 작동하지만 route inline에 강하게 남아 있다.

교체 목표:

- critic 결과를 V2 orchestration 안에서 직접 받아
- 구조 복구 / asset 복구 / generation 복구를 engine 수준에서 다시 짠다

## Hard Switch 원칙

### 원칙 1. 새 기능은 legacy에 추가하지 않는다

지금부터:

- 새로운 composition primitive
- 새로운 style runtime
- 새로운 renderer family
- 새로운 recovery logic

은 `builder-v2/` 또는 V2 전용 runtime으로만 넣는다.

legacy `llm.js handleLlmBuildOnData()`에는 새 기능을 추가하지 않는다.

### 원칙 2. route 기본값은 V2

이미 기본값은 `v2`다.

이 상태를 유지한다.

legacy는:

- explicit opt-in
- 내부 비교용
- 비상 fallback

으로만 둔다.

### 원칙 3. legacy 제거는 adapter 제거 이후, llm helper 의존 제거 시점으로 본다

현재 hard switch의 실질 기준은 두 단계다.

1. `builder-v2/engine-v2.js`가 실제 엔진 본체가 된다
2. 그 다음 `llm.js` 내부 builder helper 의존을 V2 쪽으로 이관한다

즉 migration milestone은:

1. `builder-v2/orchestrator.js` 완성
2. `builder-v2/engine-v2.js` 도입
3. route에서 legacy adapter 제거
4. `llm.js` builder internals 단계적 이관

순서로 본다.

## 구현 단계

### Stage 1. V2 entry hardening

이미 done:

- V2 version selector
- V2 orchestrator
- draft snapshot `builderVersion`

근거:

- [server.js](/home/mrgbiryu/clonellm/server.js:26112)
- [builder-v2/orchestrator.js](/home/mrgbiryu/clonellm/builder-v2/orchestrator.js)

### Stage 2. Engine extraction

해야 할 일:

- `llm.js handleLlmBuildOnData()` 내부에서
  - composer
  - detailer
  - normalization
  - synthesized operations

를 `builder-v2/engine-v2.js`로 옮긴다.

현재는 핵심 흐름도 V2 파일에 있다. 다음 단계는 helper를 실제로 V2 파일/하위 모듈로 옮기는 것이다.

### Stage 3. Persistence/critic extraction

상태:

- 1차 완료
- `builder-v2/finalize.js` 도입

근거:

- [builder-v2/finalize.js](/home/mrgbiryu/clonellm/builder-v2/finalize.js)

남은 일:

- finalize 내부 helper를 더 분리해
  - persistence
  - visual critic
  - recovery router
  를 더 작은 V2 모듈로 나누기

### Stage 4. Renderer hard switch

상태:

- 시작됨

현재 반영:

- `builder-v2/renderer/home.js` 도입
- `home.hero`, `home.quickmenu`, `home.best-ranking`, `home.banner`는 `primitiveTree`가 있을 때 V2 primitive renderer를 우선 사용

근거:

- [builder-v2/renderer/home.js](/home/mrgbiryu/clonellm/builder-v2/renderer/home.js)
- [server.js](/home/mrgbiryu/clonellm/server.js:13452)
- [server.js](/home/mrgbiryu/clonellm/server.js:13670)

남은 일:

- `commerce` 계열까지 동일 방식으로 이동
- `service-like` 페이지도 `primitiveTree -> HTML` 경로로 교체
- 이후 기존 family renderer는 fallback-only로 내림

### Stage 5. Legacy freeze

이 단계부터:

- legacy builder는 bugfix만 허용
- feature work 금지

## 완료 조건

아래를 모두 만족할 때 hard switch가 끝난 것으로 본다.

1. `/api/llm/build` 기본 경로가 V2만 사용한다
2. `builder-v2/engine-v2.js`가 `llm.js` export helper 의존을 줄이고 독립 helper 집합을 갖는다
3. visual critic / recovery / final save까지 V2 모듈 안에서 끝난다
4. 대표 시나리오 검증이 `builderVersion=v2` 결과만으로 통과한다

## 현재 시점 요약

현재는:

- `V2 진입점`: 있음
- `V2 orchestration`: 있음
- `V2 engine`: 있음
- `V2 finalize`: 있음
- `legacy adapter`: 제거됨
- `draft-level version separation`: 있음

즉 지금은 `hard switch 3차 진행 중`, `renderer switch 시작 단계`다.

다음 핵심 작업은 두 개다.

1. `llm.js` 내부의 builder helper 집합을 `builder-v2` 하위 모듈로 더 이관하는 것
2. `commerce / service-like`를 V2 primitive renderer로 확장하는 것
