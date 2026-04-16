# 운영 PRD 어댑터 설계안

작성일: 2026-04-16

목적:
- 운영 `requirementPlan`과 생성 문서들을 고객용 PRD 화면으로 변환한다.
- 연구안의 `renderPrd()` 구조를 운영 데이터에 맞춰 이식하기 위한 중간 view model을 정의한다.

대상 파일:
- `web/admin.html`

## 1. 입력 데이터

어댑터 입력은 아래 4개를 사용한다.

```js
{
  requirementPlan,
  builderMarkdown,
  layoutMockupMarkdown,
  designSpecMarkdown,
  sectionBlueprints,
  pageIdentity,
  pageLabel,
  viewportLabel
}
```

## 2. 출력 view model

```js
{
  title,
  summary,
  problem,
  objective,
  changeLevel,
  scopeIn: string[],
  scopeOut: string[],
  successCriteria: string[],
  direction: string[],
  mustKeep: string[],
  mustChange: string[],
  guardrails: string[],
  features: string[],
  featuresDetail: [{ name, description, priority }],
  screenProposals: [{ label, slotId, why, visual, keep, change }],
  flow: string[],
  roadmap: string[],
  openIssues: string[],
  layoutMockupMarkdown,
  designSpecMarkdown
}
```

## 3. 매핑 규칙

### 3-1. 기본 제목/요약

| 출력 | 입력 |
|---|---|
| `title` | `requirementPlan.title` |
| `summary` | `requestSummary[]`를 문장 1~2개로 join |
| `problem` | `requestSummary[]` 또는 비어 있으면 기본 문장 |
| `objective` | `builderBrief.objective` 우선, 없으면 기본 생성 |
| `changeLevel` | `requirementPlan.designChangeLevel` |

### 3-2. 범위/방향

| 출력 | 입력 |
|---|---|
| `scopeIn` | `planningDirection[]` |
| `scopeOut` | `guardrails[]` 또는 `pageIdentity.shouldAvoid[]` 중 out-of-scope 성격 문장 |
| `successCriteria` | `planningDirection[]`, `designDirection[]`, `priority[]`를 기반으로 2~3개 생성 |
| `direction` | `planningDirection[] + designDirection[]` |

### 3-3. 제약/유지/변경

| 출력 | 입력 |
|---|---|
| `mustKeep` | `builderBrief.mustKeep[]` 우선, 없으면 `pageIdentity.mustPreserve[]` fallback |
| `mustChange` | `builderBrief.mustChange[]` |
| `guardrails` | `requirementPlan.guardrails[] + pageIdentity.visualGuardrails[]` |

### 3-4. 기능 카드

| 출력 | 입력 |
|---|---|
| `features` | `planningDirection[]`, `designDirection[]`에서 핵심 라인 추출 |
| `featuresDetail[]` | `priority[]`를 기반으로 `{ name: target, description: reason, priority: rank }` |

### 3-5. 화면/섹션 제안

`screenProposals[]`는 `sectionBlueprints`를 우선 사용한다.

```js
screenProposals = sectionBlueprints.map((item) => ({
  label: item.label || item.title || item.slotId,
  slotId: item.slotId || "",
  why: item.why || item.intent || "",
  visual: item.visual || item.summary || "",
  keep: Array.isArray(item.keep) ? item.keep.join(", ") : linesToText(builderBrief.mustKeep || []),
  change: Array.isArray(item.change) ? item.change.join(", ") : linesToText(builderBrief.mustChange || []),
}));
```

fallback:
- `sectionBlueprints`가 없으면 `priority[]` 기반으로 최소 카드 생성

### 3-6. 사용자 흐름/로드맵

| 출력 | 입력 |
|---|---|
| `flow` | `planningDirection[]`와 `priority[]`를 조합한 시나리오 문장 |
| `roadmap` | `planningDirection[]` 상위 3개를 단계화 |
| `openIssues` | guardrails, shouldAvoid, 비어 있는 필드 기반 생성 |

## 4. 함수 형태

추천 함수:

```js
function buildRequirementPlanPrdViewModel(input = {}) {
  const requirementPlan = input.requirementPlan || {};
  const pageIdentity = input.pageIdentity || {};
  const builderBrief = requirementPlan.builderBrief && typeof requirementPlan.builderBrief === "object"
    ? requirementPlan.builderBrief
    : {};
  const sectionBlueprints = Array.isArray(input.sectionBlueprints) ? input.sectionBlueprints : [];

  // lines normalization
  // field mapping
  // fallback generation

  return {
    title,
    summary,
    problem,
    objective,
    changeLevel,
    scopeIn,
    scopeOut,
    successCriteria,
    direction,
    mustKeep,
    mustChange,
    guardrails,
    features,
    featuresDetail,
    screenProposals,
    flow,
    roadmap,
    openIssues,
    layoutMockupMarkdown: String(input.layoutMockupMarkdown || "").trim(),
    designSpecMarkdown: String(input.designSpecMarkdown || "").trim(),
  };
}
```

## 5. 렌더 연결 방식

1. `buildRequirementPlanPrdViewModel(...)` 추가
2. 연구안의 `renderPrd()`와 `.doc-*` CSS를 운영 `admin.html`에 이식
3. 기존 `requirementPlanDigestHtml` 대신 또는 병행해서 PRD 레이아웃을 렌더
4. 아래 두 fold는 유지
   - 와이어프레임 보기
   - 빌더 실행 스펙 보기

## 6. 보존해야 할 최신 운영 요소

다음은 어댑터 도입 후에도 유지한다.

- `designSpecMarkdown`
- `buildSectionBlueprintsClient(...)`
- `빌더 실행 스펙 보기`
- `layoutMockupMarkdown`
- 기존 저장/실행 이벤트 핸들러

## 7. 구현 순서

1. 어댑터 함수 추가
2. `.doc-*` CSS 이식
3. `renderPrd()` 이식
4. 기존 기획서 영역에 PRD 렌더 삽입
5. fold 문서(`layoutMockupMarkdown`, `designSpecMarkdown`) 재연결
6. 실제 페이지 2~3개로 smoke 확인
