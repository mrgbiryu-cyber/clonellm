# Admin Repo Cleanup Inventory (2026-04-23)

## 목적

모바일 variant 작업 전에 현재 레포의 운영 본선, 레거시 유지선, 즉시 정리 가능 대상을 섞지 않기 위한 정리 기준 문서다.

이번 문서는 `문서 전체 청소`가 아니라 `실행 경로와 실제 코드` 기준 분류를 우선한다.

## 기준 근거

- route trace: `data/runtime/route-trace.jsonl`
- 집계 스크립트: `scripts/report_route_trace.mjs`
- same-session 검증 계정: `mrgbiryu`

실제 trace 기준으로 확인된 운영 경로:

- `/admin` -> `admin-research.html`
- `/api/workspace/*`
- `/clone/*`
- `/runtime-draft/*`
- `/runtime-compare/*`

실제 trace 기준으로 확인된 레거시 경로:

- `/admin-legacy` -> `admin.html`
- `/api/llm/plan` -> `410 retired`
- `/api/llm/build` -> `410 retired`

## 분류

### 1. 운영 본선

- `web/admin-research.html`
- `/api/workspace/plan-local-preview`
- `/api/workspace/plan`
- `/api/workspace/build-local-draft`
- `/api/workspace/version-save`
- `/api/workspace/view-pin`
- `/clone/:pageId`
- `/runtime-draft/:draftBuildId`
- `/runtime-compare/:draftBuildId`

원칙:

- 모바일 작업은 이 축 위에서만 확장한다.
- 새 기능을 `admin.html`이나 `/api/llm/*`에 추가하지 않는다.

### 2. 레거시 유지선

- `web/admin.html`
- `/admin-legacy`

판정:

- 아직 실제 hit가 있으므로 즉시 삭제하지 않는다.
- 단, 본선 기능 추가나 모바일 지원은 넣지 않는다.
- 운영 문서에서는 `legacy`로 명시적으로 구분한다.

### 3. 즉시 정리 가능 대상

- `scripts/run_track_b_validation.js`

사유:

- retired 된 `/api/llm/plan`, `/api/llm/build`를 직접 호출하고 있었다.
- 실제 운영 본선 검증과 맞지 않아 결과가 왜곡된다.

조치:

- `plan-local-preview -> plan save -> build-local-draft` 체인으로 변경

### 4. 보류 대상

- 문서 전체의 `admin.html`, `/api/llm/*` 과거 기록
- 스냅샷 / 체크포인트에 포함된 과거 흔적

사유:

- 기록 보존 가치가 있다.
- 실제 코드 정리와 같이 지우면 복원 경로와 이력 해석이 어려워진다.

## 현재 정리 원칙

1. 코드와 실행 경로를 먼저 정리한다.
2. 문서는 삭제보다 `legacy/mainline` 라벨링을 우선한다.
3. trace에서 실제 hit가 있는 경로는 삭제 전에 대체 경로와 redirect 정책을 먼저 정한다.
4. 모바일 variant 작업은 정리된 mainline key 기준에서만 시작한다.

## 다음 순서

1. retired API를 호출하는 남은 실코드가 더 있는지 재확인
2. `admin.html`을 실제 사용자 없이도 유지해야 하는지 trace 기간을 조금 더 보고 판정
3. 본선 helper를 `pageId + viewportProfile` 기준으로 정규화
4. 그 다음 `admin-research`에 모바일 variant UI를 붙인다
