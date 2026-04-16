# 운영 관리자 화면 필드 매핑

작성일: 2026-04-16

목적:
- `web/admin-research.html`의 구조를 운영 `web/admin.html`에 이식할 때
- mock 스키마가 아니라 현재 운영 데이터 구조를 기준으로 화면 필드를 정리한다.

범위:
- 페이지 정체성
- 요구사항
- 기획서(PRD)
- 디자인 빌더 연결 기준

## 1. 원칙

1. 연구안의 단순 샘플 키를 그대로 쓰지 않는다.
2. 저장과 편집은 운영 `admin.html`의 실제 필드/ID를 기준으로 유지한다.
3. 고객에게 보이는 PRD 화면은 별도 view model로 변환해 렌더한다.
4. `builderBrief`, `priority`, `designDirection` 같은 운영 필드는 버리지 않는다.

## 2. 페이지 정체성 필드

운영 기준 소스:
- `GET /api/workspace/page-identity`
- `effectivePageIdentity`

| 화면 의미 | 운영 키 | 타입 | 비고 |
|---|---|---:|---|
| 페이지 역할 | `role` | string | |
| 페이지 목적 | `purpose` | string | |
| 디자인 의도 | `designIntent` | string | |
| 유지할 것 | `mustPreserve` | string[] | 연구안 `mustKeep`와 의미 유사하지만 운영 키를 사용 |
| 피해야 할 것 | `shouldAvoid` | string[] | 연구안 `avoid` 대체 |
| 시각 가드레일 | `visualGuardrails` | string[] | 연구안에는 없었음, 운영 화면에 포함 필요 |

화면 반영 원칙:
- 연구안의 `mustKeep`, `avoid` 같은 단순 키는 사용하지 않는다.
- 본문 표시와 편집 textarea 모두 운영 키로 맞춘다.

## 3. 요구사항 필드

운영 기준 소스:
- `latestRequirementPlan`
- `collectCurrentRequirementPlan()`

현재 운영 스키마:

```js
{
  title: string,
  designChangeLevel: "low" | "medium" | "high",
  requestSummary: string[],
  planningDirection: string[],
  designDirection: string[],
  priority: [{ rank, target, reason }],
  guardrails: string[],
  builderBrief: {
    objective: string,
    mustKeep: string[],
    mustChange: string[],
    suggestedFocusSlots: string[]
  }
}
```

연구안 UI 반영 규칙:

### 3-1. 기본 노출 필드

| 섹션 | 운영 키 | 화면 방식 |
|---|---|---|
| 요청 제목 | `title` | 단일 input |
| 변화 강도 | `designChangeLevel` | select |
| 변경 배경 | `requestSummary[]` | 줄바꿈 textarea |
| 기획 방향 | `planningDirection[]` | 줄바꿈 textarea |
| 디자인 방향 | `designDirection[]` | 줄바꿈 textarea |
| 가드레일 | `guardrails[]` | 줄바꿈 textarea |

### 3-2. 고급 옵션 접힘

| 섹션 | 운영 키 | 화면 방식 |
|---|---|---|
| Builder 목표 | `builderBrief.objective` | 단일 input |
| 유지 항목 | `builderBrief.mustKeep[]` | 줄바꿈 textarea |
| 변경 항목 | `builderBrief.mustChange[]` | 줄바꿈 textarea |
| 집중 슬롯 | `builderBrief.suggestedFocusSlots[]` | comma-separated input 또는 chips |
| 우선순위 | `priority[]` | 표 또는 접힘 섹션 |

중요:
- 연구안의 `message`, `background`, `direction`, `tone`, `refs` 같은 단순 샘플 키를 운영 저장 키로 직접 쓰지 않는다.
- 필요하면 UI에서는 쉬운 이름으로 보여주되, 내부 값은 위 운영 키에 매핑한다.

## 4. 기획서(PRD) 필드

운영 저장 원본은 `requirementPlan` + 생성 문서들이다.

운영 기준 소스:
- `requirementPlan`
- `builderMarkdown`
- `layoutMockupMarkdown`
- `designSpecMarkdown`
- `sectionBlueprints`

현재 운영 화면의 실제 생성 함수:
- `buildRequirementPlanMarkdownDocsClient(...)`
- `buildRequirementPlanDigest(...)`
- `renderRequirementPlanDigestHtml(...)`
- `renderMarkdownPreview(...)`

결론:
- 운영 저장은 `requirementPlan` 구조를 유지
- 고객용 기획서 렌더는 별도 PRD view model로 변환

## 5. PRD 화면이 가져야 하는 섹션

연구안 기준 PRD 섹션은 유지하되, 운영 데이터에서 채운다.

1. 한 줄 요약
2. 배경 / 문제 정의
3. 목표 범위
4. 핵심 기능
5. 사용자 흐름
6. 단계별 로드맵
7. 미결 사항
8. 와이어/목업
9. 빌더 실행 스펙

주의:
- `빌더 실행 스펙 보기`는 최신 운영 서버 반영을 유지한다.
- `designSpecMarkdown`은 없애지 않는다.

## 6. 디자인 빌더 연결 기준

디자인 빌더 섹션은 아래 운영 데이터를 기준으로 보여준다.

| 목적 | 운영 데이터 |
|---|---|
| 최신 draft 상태 | `latestDraftBuild` |
| 저장 버전 | `savedVersions` |
| 현재 적용 버전 | `currentPinnedView` / `currentView` 계열 |
| 비교 링크 | 기존 `preview/compare` URL 생성 로직 |
| 실행 스펙 | `designSpecMarkdown`, `sectionBlueprints` |

화면 원칙:
- PRD 아래에 디자인 빌더 섹션을 붙인다.
- 실행 기준 문서는 `페이지 정체성 + 요구사항 + 기획서(PRD)`로 설명한다.
- 내부 실행용 디버그 정보는 직접 노출하지 않는다.

## 7. 운영 이식 시 금지

1. 연구안의 mock `page.prd` 객체를 운영 화면에 그대로 이식하지 않는다.
2. 연구안의 단순 요구사항 샘플 키를 저장 키로 쓰지 않는다.
3. `visualGuardrails`, `priority`, `builderBrief`를 누락하지 않는다.
4. 최신 운영에 이미 들어간 `designSpecMarkdown`과 빌더 실행 스펙 UI를 지우지 않는다.

## 8. 구현 우선순위

1. 정체성 필드 키 정합성 고정
2. 요구사항 편집 UI를 운영 스키마 기준으로 정리
3. `requirementPlan -> PRD view model` 어댑터 추가
4. PRD 렌더 함수와 `.doc-*` CSS 운영 이식
5. 디자인 빌더 섹션을 PRD 아래에 운영 데이터 기준으로 연결
