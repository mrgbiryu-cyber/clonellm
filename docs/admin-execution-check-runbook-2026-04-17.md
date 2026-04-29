# 관리자 실행 체크 런북

작성일: 2026-04-17

## 목적

15개 admin target을 하나씩 실제 실행하면서 아래 연결이 실제로 닫히는지 확인한다.

1. 페이지 원본 / 구조 로드
2. 요구사항 저장
3. 기획서 생성
4. 디자인 빌더 draft 생성
5. 저장 버전 생성
6. view pin 적용

## 기준 로그

실행 중 확인할 주요 이벤트:

- `workspace_page_identity_saved`
- `workspace_requirement_plan_saved`
- `llm_plan_created`
- `workspace_draft_build_saved`
- `llm_build_created`
- `workspace_saved_version_saved`
- `workspace_view_pinned`

파일:

- `data/runtime/activity-log.json`
- `data/runtime/workspaces.json`

## 점검 명령

페이지별 실행 체인 요약:

```bash
node scripts/report_execution_chain.mjs --login-id mrgbiryu
```

특정 target만 확인:

```bash
node scripts/report_execution_chain.mjs --login-id mrgbiryu --page home:pc
```

## 판정 기준

`docs-ready`

- `builderMarkdown`
- `layoutMockupMarkdown`
- `designSpecMarkdown`
- `sectionBlueprints`

네 가지가 모두 있으면 `yes`

`draft-built`

- 해당 page/viewport에 draft build 저장 이력이 하나 이상 있으면 통과
- 단, 현재 plan과 연결되지 않은 예전 draft만 있으면 `paired-draft-built` 는 실패로 본다

`versioned`

- 저장 버전이 하나 이상 있으면 통과
- 단, 현재 plan과 연결되지 않은 예전 version만 있으면 `paired-versioned` 는 실패로 본다

`pinned`

- saved version이 현재 view에 pin 되어 있으면 통과
- 단, pin 된 version이 현재 최신 plan과 연결되지 않으면 현재 실행 체인 완료로 보지 않는다

## 실패 해석

`planned` 에서 멈춤

- 기획서까지는 저장됐지만 builder 실행이 안 됨

`draft-built` 가 안 생김

- `/api/llm/build` 실패 또는 결과 저장 실패

`versioned` 가 안 생김

- build는 됐지만 changed component가 없거나 version save에서 막힘

`pinned` 가 안 생김

- version save 이후 view pin 미실행

`legacy-only` 로 보임

- 예전 plan 기준 draft/version은 남아 있지만 현재 최신 plan과 pair 되는 결과가 없음
- 사용자 화면에서는 `빌더 완료`로 보이면 안 되고, `현재 기획서 기준 실행 대기`로 해석해야 함

## 현재 UX 계획

`기획서 다시 생성`

- 전체 상세를 dim 처리하지 않는다
- `기획서 패널 영역만` dim 처리하고, 기존 기획서 내용은 배경으로 남긴 채 `생성 중` overlay 를 올린다
- 사용자는 현재 무엇을 기다리는지 PRD 영역에서 바로 이해할 수 있어야 한다

`기획서 재생성 후 빌더 영역`

- 최신 `draftBuild.planId === latestPlan.id` 인 경우에만 메인 빌더 결과로 본다
- plan 이 새로 생성되면, 이전 plan 기준 builder 결과는 메인 빌더 영역에서 숨긴다
- 이전 결과는 `버전 확인` 이력으로만 남긴다
- 따라서 `기획서 재생성 -> 빌더 미실행` 상태에서는 메인 빌더가 `실행 대기`로 돌아가야 한다

## 테스트 순서

1. 요구사항 저장
2. `기획서 다시 생성` 클릭
3. PRD 패널만 dim 되는지 확인
4. 생성 완료 후 최신 planId 가 바뀌는지 확인
5. 메인 빌더 영역이 이전 결과를 유지하지 않고 `실행 대기` 로 돌아가는지 확인
6. 빌더 실행 후 새 draft 의 `planId` 가 최신 planId 와 같은지 확인
7. 버전 저장 후 saved version 의 `planId`, `buildId` 가 방금 생성한 draft 와 맞는지 확인

## 현재 시작 상태

현재 기준으로는:

- `docs-ready`: 15/15
- `draft-built`: 부분만 존재
- `versioned`: 부분만 존재

즉 이번 실행의 목적은 `문서 준비 여부 확인`이 아니라 `실제 실행 체인 전수 확인`이다.
