# Runtime Slice File Boundary (2026-04-22)

## 목적

이 문서는 첫 runtime slice를 어떤 파일 경계로 구현할지 고정한다.

핵심은 하나다.

`새 본선은 기존 inject/reinject 경로 안에 끼워 넣지 않고, 독립된 파일 경계로 분리해야 한다.`

상위 기준 문서:

- [First Runtime Slice](./admin-first-runtime-slice-2026-04-22.md)
- [Legacy Retirement Plan](./admin-legacy-retirement-plan-2026-04-22.md)

---

## 1. 새 파일 경계 원칙

첫 slice는 `design-pipeline/` 아래에 새 runtime 경로를 만든다.

이유:

- 현재 `server.js`의 giant function 본선과 선을 긋기 쉬움
- 새 계약을 문서 기준으로 모듈화하기 쉬움
- legacy inject/reinject 경로를 직접 재사용하지 않게 만들 수 있음

---

## 2. 신규 파일 제안

### 2.1 `design-pipeline/author-output.js`

역할:

- `Authored Section HTML Package` normalize/load
- authored html 정본 보존

하지 않는 일:

- template/family 환원
- patch 생성

### 2.2 `design-pipeline/runtime-input.js`

역할:

- `Authored Section HTML Package`
- `referencePageShell`
- `runtimeContext`

를 묶어 Runtime Renderer 입력 어댑터 생성

### 2.3 `design-pipeline/shell-loader.js`

역할:

- 현재 페이지 shell html 확보
- section boundary map 확보

주의:

- shell은 삽입 위치 reference일 뿐, 구조 재결정기가 아님

### 2.4 `design-pipeline/html-inserter.js`

역할:

- target group boundary 안에 authored section html 삽입

하지 않는 일:

- 누락 fallback 삽입
- 다른 위치로 재배치
- reinject

### 2.5 `design-pipeline/asset-resolver.js`

역할:

- `data-asset-slot`
- `assetPlaceholders`

를 현재 페이지 asset map과 연결

하지 않는 일:

- 새 임의 asset url 생성

### 2.6 `design-pipeline/runtime-sanitize.js`

역할:

- authored html delivery에 필요한 최소 sanitize

하지 않는 일:

- 디자인 보정
- content 기반 html 재작성

### 2.7 `design-pipeline/runtime-renderer.js`

역할:

- 위 모듈들을 조합해서
  - beforeHtml
  - afterHtml
  - draft payload
  - advisory
  생성

이 파일이 새 본선 runtime entry가 된다.

### 2.8 `design-pipeline/draft-save-adapter.js`

역할:

- 새 runtime 결과를 workspace draft 저장 shape로 옮김

주의:

- adapter는 운반만 한다
- 정본은 계속 `Authored Section HTML Package`다

---

## 3. 기존 파일 처리

### 3.1 유지하되 본선에서 제외

- `server.js`의 `rewriteCloneHtml()`
- `injectHomeReplacements()`
- `injectServiceLikeReplacements()`
- `injectCategoryPdpReplacements()`

역할:

- transitional legacy path

### 3.2 신규 본선 연결 위치

기존 서버 진입점은 유지하되,
새 경로는 아래처럼 분리한다.

- `server.js`
  - route handler에서 새 runtime slice 호출
  - giant composition logic는 호출하지 않음

즉:

```text
server route
  -> design-pipeline/runtime-renderer.js
  -> draft-save-adapter.js
```

---

## 4. 첫 route 연결 원칙

첫 slice에서 route는 단순해야 한다.

### 입력

- pageId
- viewportProfile
- authoredSectionHtmlPackage

### 출력

- beforeHtml reference
- afterHtml reference
- draftBuildId

주의:

- route가 authoring을 다시 하지 않는다
- route가 compare/recovery를 돌리지 않는다

---

## 5. design-pipeline 기존 파일 중 재사용/비재사용

### 재사용 가능

- `contracts.js`
  단, validation 유틸 수준일 때만
- `brief.js`
  concept package 쪽에서 필요 시

### 직접 재사용 금지

- `build-local.js`
- `builder.js`
- `tools.js`
- `clone-model.js`
- `provider-local.js`

이유:

- 현재 shape가 family/template/patch/operations 중심이기 때문

---

## 6. 첫 구현 연결 순서

1. `author-output.js`
2. `runtime-input.js`
3. `shell-loader.js`
4. `html-inserter.js`
5. `asset-resolver.js`
6. `runtime-sanitize.js`
7. `runtime-renderer.js`
8. `draft-save-adapter.js`
9. `server.js` route 연결

---

## 7. 한 줄 기준

`첫 runtime slice는 server.js giant function을 더 키우는 작업이 아니라, design-pipeline 아래에 새 본선 파일 경계를 만드는 작업이다.`
