# admin-research.html ↔ admin.html 코드 레벨 UI 매핑 리뷰

> **작성 목적**: `admin-research.html`(연구 프로토타입, localhost:4173)을 `admin.html`(운영 서버, localhost:3000)에 병합·적용할 때  
> Codex가 빠르게 참고할 수 있도록 컴포넌트·데이터 모델·CSS 클래스 레벨에서 불일치 항목을 정리한 문서입니다.  
> **작성 기준일**: 2026-04-16  
> **파일 라인 수**: admin.html 4319줄 / admin-research.html 2669줄

---

## 1. 전체 레이아웃 셸 (Shell)

| 항목 | admin.html | admin-research.html | 비고 |
|---|---|---|---|
| 최상위 레이아웃 | `<header>` + `<main class="grid 320px/1fr">` | `<div.app class="grid 328px/1fr">` | 클래스명·태그 모두 다름 |
| 좌측 패널 | `<section class="panel">` | `<aside class="sidebar">` | |
| 우측 패널 | `<section class="panel">` > `#detail` | `<div class="content">` | |
| 상단 헤더 | `<header>` (dark bg, 로그인/세션 메타) | `<div class="topbar">` (frosted glass) | admin-research는 세션 없음 |
| 사이드바 너비 | `320px` | `328px` (CSS var `--sidebar-w`) | 8px 차이 |

**권장 처리**: admin-research의 `sidebar` + `content` 구조를 기준으로 admin.html의 `.panel` 구조를 교체.  
헤더는 admin.html의 세션/로그아웃 영역을 topbar 내부 `.topbar-meta`에 흡수.

---

## 2. 페이지 목록 (Sidebar List)

| 항목 | admin.html | admin-research.html |
|---|---|---|
| 그룹 컨테이너 | `.list-group` | `.group-block` |
| 그룹 라벨 | `.list-group-label` | `.group-label` |
| 아이템 버튼 | `.page-select-item` | `.page-item` |
| 제목 행 | `.page-select-title > strong` | `.page-title-row > strong` |
| 상태 점 컨테이너 | 없음 (inline `.status-dot` 3개) | `.status-dots > .dot` |
| 메타 텍스트 | `.page-select-meta` | `.page-meta` |
| 활성 클래스 | `.active` | `.active` (동일) |
| 검색 | 없음 | `input#searchInput.search` |
| 필터 칩 | 없음 | `#filterChips > .chip` (전체/작업중/기획서있음) |

**권장 처리**:  
- admin.html의 `.page-select-item` → `.page-item` 으로 교체  
- 검색/필터 칩은 admin-research 것을 그대로 삽입  
- 상태 점은 admin.html의 `.status-dot` + admin-research의 `.dot` 클래스명 통일 필요 (둘 다 `background: draft=#2563eb, ready=#16a34a, stale=#d97706` 동일하나 클래스명이 다름)

---

## 3. 상태 요약 카드 (Summary Bar) — **카드 수 불일치**

| 항목 | admin.html | admin-research.html |
|---|---|---|
| 컨테이너 클래스 | `.workspace-summary-bar` (4컬럼) | `.status-summary` (3컬럼) |
| 카드 수 | **4개** | **3개** ← 빠짐 |
| 카드 목록 | 페이지 정체성 / 요구사항 / 기획서 / **디자인 빌더** | 페이지 정체성 / 요구사항 / 기획서 |
| 카드 클래스 | `.workspace-summary-card` | `.summary-card` |
| 라벨 | `.workspace-summary-label` | `.summary-card-label` |
| 값 | `.workspace-summary-value` (renderStatusFlag 렌더) | `<strong>` (stateLabels 텍스트) |
| 메타 | `.workspace-summary-meta` (날짜 포함) | `<p>` (설명 텍스트) |

**누락 항목**: admin-research에 `디자인 빌더` 상태 카드가 없음.  
**권장 처리**: `status-summary`를 4컬럼으로 변경하고 빌더 카드 추가.  
```html
<!-- 추가 필요 -->
<article class="summary-card">
  <span class="summary-card-label">디자인 빌더</span>
  <strong id="builderStatusLabel">…</strong>
  <p id="builderStatusDesc">…</p>
</article>
```

---

## 4. 앵커 내비게이션 바

| 항목 | admin.html | admin-research.html |
|---|---|---|
| 컨테이너 | `.workspace-anchor` (gradient fade bg) | `.anchor-bar` (backdrop-filter) |
| 아이템 | `.workspace-anchor-item` | `.anchor-link` |
| 점 크기 | 8×8px `.status-dot` | 10×10px `.dot` |
| sticky top | `top: 0` | `top: 86px` |
| 항목 4개 | 정체성/요구사항/기획서/빌더 | 정체성/요구사항/기획서/빌더 (구조 동일) |
| 빌더 탭 조건 노출 | 항상 표시 | `hidden` attr로 조건부 |

**권장 처리**:  
- admin-research의 anchor-bar sticky 방식 (top: 86px, backdrop-filter)이 더 적합  
- admin.html 앵커 아이템 클래스명 `.workspace-anchor-item` → `.anchor-link`로 통일  
- 빌더 탭도 `hidden` 조건부 처리 적용

---

## 5. 페이지 정체성 섹션 — **필드 불일치**

### 5-1. 데이터 모델 (서버 API 기준 vs 프로토타입 하드코딩)

| 필드 키 | admin.html (서버) | admin-research.html (샘플) | 매핑 |
|---|---|---|---|
| `role` | `effectivePageIdentity.role` | `page.identity.role` | ✅ 동일 |
| `designIntent` | `effectivePageIdentity.designIntent` | `page.identity.designIntent` | ✅ 동일 |
| `purpose` | `effectivePageIdentity.purpose` | `page.identity.purpose` | ✅ 동일 |
| `mustPreserve[]` | `effectivePageIdentity.mustPreserve` (배열) | `page.identity.mustKeep` (문자열) | ⚠️ 키명 다름, 타입 다름 |
| `shouldAvoid[]` | `effectivePageIdentity.shouldAvoid` (배열) | `page.identity.avoid` (문자열) | ⚠️ 키명 다름, 타입 다름 |
| `visualGuardrails[]` | `effectivePageIdentity.visualGuardrails` (배열) | **없음** | ❌ **누락** |

### 5-2. 렌더링 DOM 구조

| 항목 | admin.html | admin-research.html |
|---|---|---|
| 그리드 클래스 | `.page-identity-grid` | `.kv-grid` |
| 아이템 클래스 | `.page-identity-item` (+ `.wide`) | `.kv-card` |
| 라벨 | `<label>` | `<span class="label">` |
| 값 | `.value` | `.value` (동일) |
| 목적 위치 | grid 3번째 (wide) | 별도 `.kv-card` 하단 분리 |
| 시각 가드레일 | grid 6번째 (wide) | **없음** ❌ |

**권장 처리**:  
1. admin-research 샘플 데이터의 `mustKeep`(string) → `mustPreserve[]`(array)로 변경  
2. `avoid`(string) → `shouldAvoid[]`(array)로 변경  
3. `visualGuardrails[]` 필드 및 렌더링 행 추가  
4. 클래스명은 admin-research의 `kv-grid/kv-card` 유지하되 admin.html 측에서 동일 클래스 사용하도록 통일

---

## 6. 요구사항 섹션 — **데이터 모델 완전히 다름 (가장 큰 불일치)**

### admin.html `requirementPlan` 스키마
```javascript
{
  title: string,
  designChangeLevel: "low" | "medium" | "high",
  requestSummary: string[],       // 변경 배경 (멀티라인 배열)
  planningDirection: string[],    // 기획 방향 (배열)
  designDirection: string[],      // 디자인 방향 (배열)
  priority: [{ rank, target, reason }],  // 우선순위 슬롯 테이블
  guardrails: string[],           // 가드레일 (배열)
  builderBrief: {
    objective: string,            // Builder 목표
    mustKeep: string[],           // 유지 항목
    mustChange: string[],         // 변경 항목
    suggestedFocusSlots: string[] // 집중 slot ID 목록
  }
}
```

### admin-research.html `requirements` 스키마
```javascript
{
  mode: "hybrid" | "direct" | "reference",
  changeLevel: "low" | "medium" | "high",
  title: string,
  message: string,          // 핵심 메시지 (단일 필드)
  background: string,       // 요청 배경 (단일 textarea)
  direction: string,        // 원하는 방향 (줄바꿈 포함 string)
  tone: string,             // 톤앤매너
  avoid: string,            // 피해야 할 방향
  refs: string,             // 레퍼런스 URL
}
```

### 필드 매핑 테이블

| 기능 | admin.html 필드 | admin-research.html 필드 | 처리 방안 |
|---|---|---|---|
| 제목 | `planTitle` | `reqTitle` | 키 통일 필요 |
| 변화 강도 | `planDesignChangeLevel` (select) | `reqChangeLevel` (select) | 동일 옵션값, 키 통일 |
| 배경/요약 | `planRequestSummary` (배열 textarea) | `reqBackground` (단일 textarea) | 렌더 통일 |
| 기획 방향 | `planPlanningDirection` (배열) | `reqDirection` (string) | 통일 필요 |
| 디자인 방향 | `planDesignDirection` (배열) | 없음 | ❌ **admin-research 누락** |
| 톤앤매너 | 없음 (`tone`은 레퍼런스 분석에서) | `reqTone` | research 확장 필드 |
| 피해야 할 것 | `planGuardrails` (배열) | `reqAvoid` (string) | 의미 다름, 별도 유지 |
| 가드레일 | `planGuardrails` (배열) | 없음 (PRD에서 별도) | |
| 우선순위 | `planPriority` (slot | reason 포맷) | 없음 | ❌ **admin-research 누락** |
| Builder 목표 | `planBuilderObjective` | 없음 | ❌ **admin-research 누락** |
| Builder 집중 슬롯 | `planBuilderFocusSlots` | 없음 | ❌ **admin-research 누락** |
| 유지 항목 | `planBuilderMustKeep` (배열) | 없음 (PRD에서 별도) | |
| 변경 항목 | `planBuilderMustChange` (배열) | 없음 (PRD에서 별도) | |
| 레퍼런스 URL | `planMode=reference` 시 textarea | `reqRefs` (항상 표시) | |
| 핵심 메시지 | 없음 | `reqMessage` | research 확장 |
| 입력 모드 | `planMode` (hybrid/direct/reference) | `reqMode` (동일 3가지) | 키 통일 |

**권장 처리**:  
- admin-research의 UX(심플한 form 7개 필드)를 전면에 유지  
- admin.html의 `builderBrief` 관련 필드(objective, mustKeep, mustChange, focusSlots)는 "고급 옵션" 접힘 섹션으로 추가  
- `planPriority` (우선순위 슬롯 테이블)는 별도 `<details>` 섹션으로 추가  
- 최종 저장 시 admin.html의 `requirementPlan` 스키마로 변환하는 어댑터 함수 필요

---

## 7. 기획서(PRD) 섹션 — **렌더링 방식 완전히 다름**

| 항목 | admin.html | admin-research.html |
|---|---|---|
| 데이터 소스 | 서버 API 응답 `requirementPlan` | 하드코딩 `page.prd` 샘플 객체 |
| 렌더링 함수 | `renderRequirementPlanDigestHtml()` + `renderMarkdownPreview()` | `renderPrd(page)` |
| PRD 레이아웃 | 단일 컬럼 스크롤 | **2컬럼 grid (TOC 152px + 본문)** |
| TOC | 없음 | `.doc-toc` sticky 13개 항목 |
| 섹션 수 | 비구조적 (digest cards + markdown fold) | 13개 구조화 섹션 |
| 와이어프레임 | `<details>` fold → `layoutMockupMarkdown` 마크다운 렌더 | `.doc-wireframe` 스타일 카드 (9번 섹션) |
| 기획서 원문 | `<details>` fold → `builderMarkdown` 마크다운 렌더 | 없음 (대신 구조화 섹션으로 대체) |

### admin.html PRD 데이터 스키마 (`requirementPlan`)
```
{ title, requestSummary[], planningDirection[], designDirection[],
  designChangeLevel, guardrails[], priority[{rank,target,reason}],
  builderBrief: { objective, mustKeep[], mustChange[], suggestedFocusSlots[] } }
```

### admin-research.html PRD 데이터 스키마 (`page.prd`)
```
{ summary, problem, objective, changeLevel,
  scope[], mustKeep[], mustChange[], direction[],
  features[], featuresDetail[{name,description,priority}],
  screenProposals[{label,slotId,why,visual,keep,change}],
  flow[], roadmap[], guardrails[], open }
```

**권장 처리**:  
- admin-research의 `renderPrd()` 함수 및 CSS(`.doc-*` 클래스 전체)를 admin.html에 이식  
- admin.html의 `requirementPlan` → `page.prd` 스키마 변환 함수 작성:
  - `requestSummary[]` → `summary` (join)  
  - `planningDirection[]` + `designDirection[]` → `direction[]`  
  - `builderBrief.mustKeep[]` → `mustKeep[]`  
  - `builderBrief.mustChange[]` → `mustChange[]`  
  - `builderBrief.objective` → `objective`  
  - `designChangeLevel` → `changeLevel`  
  - `guardrails[]` → `guardrails[]`  
  - `priority[]` → `screenProposals[]` (slotId 기반 매핑)  
- 기존 `<details>` fold(기획서 원문 보기, 와이어프레임 보기)는 PRD 13번 섹션 아래에 collapse로 유지

---

## 8. 디자인 빌더 섹션

| 항목 | admin.html | admin-research.html |
|---|---|---|
| 실행 버튼 | `#runLlm` (실제 API 호출) | `#launchBuilderBtn` (mock toggle) |
| 상태 표시 | `#builderStatus` + progress bar | `#builderStatusText` (텍스트만) |
| 실행 결과 | component-card 그리드 (실제 슬롯 결과) | `.builder-preview-card` 그리드 (mock) |
| 빌더 카드 데이터 소스 | `latestDraftBuild.sections[]` | `page.prd.screenProposals[]` |
| 섹션 미리보기 | 실제 iframe preview | mock `.wire-bar` 그래픽 |
| 버전 저장 | `#saveVersionBtn` (API 호출) | 없음 |

**권장 처리**:  
- admin-research의 `.builder-preview-card` / `.builder-preview-visual` CSS는 그대로 유지  
- 실제 API 연결은 admin.html의 `runLlm` 이벤트 핸들러 재사용  
- 버전 저장 버튼(`#saveVersionBtn`)을 빌더 섹션 내부에 복원

---

## 9. 사이드 패널 (Aside)

| 섹션 | admin.html | admin-research.html | 차이 |
|---|---|---|---|
| 관련 화면 | `.section` (항상 표시) | `.aside-card` (항상 표시) | CSS 클래스명 다름 |
| 관련 화면 아이템 | `.link-item > .link-main > strong + a.btn` | `.link-item > strong + button.btn` | admin.html은 `<a>` 실링크, research는 `<button>` |
| 버전 확인 | `.section` (항상 표시) + 저장 버튼 | `<details>` (접힘) | 노출 방식 다름 |
| 보조 기능 | `<details>` (접힘) | `<details>` (접힘) | 동일 |
| 운영 도구 | `<details>` (접힘) | `<details>` (접힘) | 동일 |
| 작업 이력 | 보조 기능 내부 버튼 → 모달 | 없음 | ❌ admin-research 누락 |

**권장 처리**:  
- 관련 화면 아이템은 실링크(`<a href>`)로 복원  
- 버전 확인은 admin-research처럼 `<details>` 접힘 유지 (저장 버튼 포함)  
- 작업 이력 버튼 + 모달 로직 admin.html에서 이식

---

## 10. CSS 클래스 충돌·통일 필요 항목

| admin-research 클래스 | admin.html 동등 클래스 | 처리 |
|---|---|---|
| `.sidebar` | `.panel` (left) | 교체 |
| `.content` | `.panel` (right) | 교체 |
| `.page-item` | `.page-select-item` | 교체 |
| `.page-title-row` | `.page-select-title` | 교체 |
| `.dot` | `.status-dot` | 통일 (둘 다 동일 색상 체계) |
| `.status-summary` | `.workspace-summary-bar` | 교체 + 4컬럼으로 확장 |
| `.summary-card` | `.workspace-summary-card` | 교체 |
| `.anchor-bar` | `.workspace-anchor` | 교체 |
| `.anchor-link` | `.workspace-anchor-item` | 교체 |
| `.section-card` | `.section` (workspace-main 내) | 교체 |
| `.kv-grid` | `.page-identity-grid` | 교체 |
| `.kv-card` | `.page-identity-item` | 교체 |
| `.doc-preview` + `.doc-*` | 없음 | admin-research 것 그대로 이식 |
| `.details-card` | `.fold-section` | 교체 |

---

## 11. 누락·추가 필요 항목 체크리스트

### admin-research.html에서 admin.html로 이식해야 할 것
- [ ] `renderPrd()` 함수 전체 + `.doc-*` CSS 전체 (기획서 13섹션 렌더러)
- [ ] `.sidebar` 레이아웃 CSS (현재 `.panel` 구조 교체)
- [ ] `.anchor-bar` CSS + `backdrop-filter` 스타일
- [ ] `.status-summary` 3→4카드 + 빌더 카드 추가
- [ ] 사이드바 검색/필터 칩
- [ ] `.details-card` CSS (현재 `.fold-section` 교체)

### admin.html에서 admin-research.html로 이식해야 할 것
- [ ] `visualGuardrails[]` 필드 — identity 섹션 6번째 항목
- [ ] `planDesignDirection` — requirements의 디자인 방향 텍스트 필드
- [ ] `planPriority` — 우선순위 슬롯 테이블 (접힘 가능)
- [ ] `builderBrief` 필드 4개 — 고급 옵션 섹션으로
- [ ] 실제 API 연결 코드 (fetch /api/pages, /api/planner, /api/builder 등)
- [ ] 작업 이력 모달 (`renderHistoryModal`)
- [ ] 버전 저장 버튼 (`#saveVersionBtn`)
- [ ] 세션 / 로그인 처리

---

## 12. 우선순위 권장 작업 순서

| 우선순위 | 항목 | 예상 범위 |
|---|---|---|
| P0 | `renderPrd()` + `.doc-*` CSS를 admin.html에 이식 | CSS ~100줄 + JS ~250줄 |
| P0 | status-summary 4번째 빌더 카드 추가 | HTML 5줄 + JS 1줄 |
| P1 | sidebar 레이아웃 교체 (`.panel` → `.sidebar/.content`) | CSS 50줄, HTML 구조 변경 |
| P1 | `visualGuardrails` identity 필드 추가 | HTML 5줄 + 데이터 1줄 |
| P1 | requirements → requirementPlan 스키마 어댑터 함수 | JS ~30줄 |
| P2 | `planDesignDirection`, `builderBrief` 고급 옵션 추가 | HTML 20줄 + JS 20줄 |
| P2 | 사이드바 검색/필터 칩 이식 | JS 20줄 |
| P3 | 링크 아이템 `<button>` → `<a href>` 복원 | HTML 5줄 |
| P3 | 작업 이력 모달 이식 | JS 50줄 |

---

## 13. 데이터 어댑터 함수 제안 (requirementPlan → prd)

admin.html의 서버 데이터를 admin-research의 `renderPrd()`에 먹이려면 아래 변환 함수가 필요합니다.

```javascript
function adaptRequirementPlanToPrd(requirementPlan = {}, pageIdentity = {}) {
  const bb = requirementPlan.builderBrief || {};
  return {
    summary: [
      ...(requirementPlan.requestSummary || []),
    ].join(" ") || "요약 없음",
    problem: requirementPlan.requestSummary?.[0] || "",
    objective: bb.objective || "",
    changeLevel: requirementPlan.designChangeLevel || "medium",
    scope: [],
    mustKeep: bb.mustKeep || [],
    mustChange: bb.mustChange || [],
    direction: [
      ...(requirementPlan.planningDirection || []),
      ...(requirementPlan.designDirection || []),
    ],
    features: (requirementPlan.priority || []).map(p => p.target).filter(Boolean),
    featuresDetail: [],
    screenProposals: (requirementPlan.priority || []).map(p => ({
      label: slotLabel(p.target),
      slotId: p.target,
      why: p.reason || "",
      visual: "",
      keep: (bb.mustKeep || []).join(", "),
      change: (bb.mustChange || []).join(", "),
    })),
    flow: [],
    roadmap: [],
    guardrails: requirementPlan.guardrails || [],
    open: "",
  };
}
```

---

*이 문서는 Codex가 admin-research.html → admin.html 병합 작업 시 참조하는 매핑 리뷰입니다.*  
*실제 서버 API 필드는 `/docs/lge-prototype-schema.md` 및 `/docs/llm-planner-builder-schema.md` 참고.*
