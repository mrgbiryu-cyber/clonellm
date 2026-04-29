# Builder V2 Isolation Plan (2026-04-19)

## Goal

Track B는 기존 `patch-first` 빌더 위에 계속 기능을 덧대는 방식이 아니라, `Builder V2`를 병렬 경로로 세워 점진적으로 교체하는 방식으로 간다.

핵심 원칙:

- `clone / requirements / planning`은 최대한 재사용한다.
- `builder execution`은 V2 경로를 통해 별도 오케스트레이션한다.
- 레거시 빌더 호출이 당장 필요하더라도 `legacy adapter` 안으로 격리한다.
- 이후 교체 작업은 route 본문이 아니라 `builder-v2/` 내부에서만 진행되도록 만든다.

## Code Boundaries

### New V2 modules

- `builder-v2/contracts.js`
  - `builderVersion` 결정
  - V2 request 정규화
- `builder-v2/orchestrator.js`
  - builder input 준비
  - reference / whole-page / sufficiency gate
  - V2 engine 실행
  - generated asset 부착
- `builder-v2/engine-v2.js`
  - V2 전용 엔진 진입점
  - 현재는 `runBuilderEngineV2()`를 호출해 composer/detailer 경로를 감싼다

### Existing modules still reused

- `server.js`
  - auth / draft save / visual critic / final persistence
- `llm.js`
  - 기존 builder engine

## Current execution split

### Legacy

- `/api/llm/build` 요청에서 `builderVersion=legacy`면 기존 inline preparation/build path를 사용한다.

### V2

- `/api/llm/build` 요청에서 `builderVersion=v2`면
  - `builder-v2/orchestrator.js`
  - `builder-v2/engine-v2.js`
  경로를 먼저 탄다.

## Why this split matters

- 이후 Primitive Composition Builder, Concrete Style Runtime, Replacement-First Renderer migration을 `builder-v2/` 아래에서 계속 바꿀 수 있다.
- 레거시 route 본문 전체를 계속 흔들지 않아도 된다.
- draft snapshot에 `builderVersion`이 저장되므로 검증 결과를 legacy/V2로 분리해 볼 수 있다.

## Next migration targets

1. `builder-v2/engine-v2.js` 내부에서 llm helper 의존을 줄이고, composer/detailer helper를 단계적으로 V2 파일로 이동
2. visual critic / recovery router도 V2 orchestration 쪽으로 이동
3. draft persistence/report shaping을 V2 경로에서 먼저 결정하고 route는 transport만 담당
