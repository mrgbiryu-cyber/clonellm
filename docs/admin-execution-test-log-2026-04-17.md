# 관리자 실행 테스트 로그

작성일: 2026-04-17

## 대상

- 페이지: `홈 - PC`
- 사용자: `mrgbiryu`

## 현재 관찰

### 1. 요구사항 저장 및 기획서 재생성은 실제로 실행됨

- `2026-04-17T01:23:18Z` `llm_plan_created`
- `2026-04-17T01:23:19Z` `llm_plan_created`

즉 `기획서 다시 생성` 버튼이 안 눌리는 문제가 아니라, 기존에는 서버 timeout 때문에 완료 체감이 없었던 상태였다.

### 2. 최신 기획서와 최신 빌더 결과가 현재는 pair 되어 있지 않음

최신 plan:

- `fcac042a-f2d6-46ff-b7e6-47012a274ca3`
- `b8c17392-4a56-4d9d-9ac3-4b1647c16c11`

최신 draft:

- `4cce6e19-0704-478f-8b70-bb86eb1e271c`
- `planId = aac6b472-6144-4970-bef8-05d9af2fef88`

최신 saved version:

- `b95057b9-3208-42b1-aa82-a698e8472231`
- `planId = aac6b472-6144-4970-bef8-05d9af2fef88`

판정:

- 최신 PRD는 새로 생겼다
- 메인 builder 결과와 saved version 은 이전 plan 기준이다
- 따라서 현재 화면에서 builder 를 그대로 `완료`처럼 보여주면 안 된다

## 확정할 UX 규칙

### 규칙 A. 기획서 재생성 중 표시

- `기획서 패널만` dim 처리한다
- 기존 PRD 내용은 배경으로 유지한다
- overlay 문구는 `기획서 생성 중입니다` 계열로 짧게 둔다

### 규칙 B. 최신 plan 과 builder 의 페어링

- 메인 builder 영역은 `latestDraftBuild.planId === latestPlan.id` 일 때만 결과를 보여준다
- 일치하지 않으면 `실행 대기` 상태로 본다

### 규칙 C. 예전 결과의 위치

- 예전 draft/version 은 삭제하지 않는다
- 다만 메인 builder 결과 영역에서는 숨기고, `버전 확인` 이력에서만 다시 볼 수 있게 둔다

## 이번 로그 기준 상태

- `docs-ready`: 준비 완료
- `latest plan`: 생성 성공
- `paired draft`: 없음
- `paired version`: 없음
- `legacy draft/version`: 있음

실행 리포트:

```text
Execution Chain Report
targets: 1/15
docs-ready: 1/1
draft-built: 1/1
paired-draft-built: 0/1
versioned: 1/1
paired-versioned: 0/1
pinned: 0/1
legacy-only: 1/1
```

## 추가 검증

### 1. LLM 호출 경로

`/api/llm/status` 기준:

- `model = openai/gpt-4.1-mini`
- `plannerModel = anthropic/claude-sonnet-4.6`
- `builderModel = google/gemini-3.1-pro-preview`

최근 실행 로그:

- `2026-04-17T01:46:06Z` `llm_plan_created`
- `planId = 54027666-4b87-40cf-b3da-729370623c5f`

판정:

- `기획서 생성`은 실제로 planner 경로를 타고 있다
- 현재 문제는 호출 미실행이 아니라, 생성 후 UI가 최신 plan 과 이전 draft/version 을 분리하지 못하는 상태다

### 2. 현재 home-pc 데이터 페어링 상태

최신 plan:

- `54027666-4b87-40cf-b3da-729370623c5f`

현재 최신 draft:

- `4cce6e19-0704-478f-8b70-bb86eb1e271c`
- `planId = aac6b472-6144-4970-bef8-05d9af2fef88`

현재 최신 version:

- `b95057b9-3208-42b1-aa82-a698e8472231`
- `planId = aac6b472-6144-4970-bef8-05d9af2fef88`

판정:

- 최신 plan 기준 `paired draft = 0`
- 최신 plan 기준 `paired version = 0`
- 따라서 메인 builder 는 떠 있으면 안 되고, `이전 버전`은 이력으로만 보여야 한다

## 다음 테스트 항목

1. PRD 재생성 시 PRD 패널만 dim 되는지
2. PRD 생성 완료 후 메인 builder 가 `실행 대기` 로 돌아가는지
3. builder 실행 후 새 draft 의 `planId` 가 최신 plan 과 일치하는지
4. version 저장 후 saved version 의 `planId`, `buildId` 가 새 draft 와 일치하는지
