# Codex 3차 수정 코드 검증 리포트

Date: 2026-04-18
Owner: 코드 단위 직접 확인
Status: 검증 완료

변경 규모 (2차 대비 추가분):

- `llm.js` +159줄
- `server.js` +82줄 (CSS 대규모 추가 포함)

---

## 1. 수정 내용 요약

이번 수정에서 코덱스가 변경한 주요 항목:

1. `resolveHeroTemplateVariant()` / `resolveQuickmenuTemplateVariant()` — 전용 resolver 함수 신설 (2차 MEDIUM 수정)
2. `normalizeBuilderResult` — componentComposition merge 전략 추가 (2차 MEDIUM 수정)
3. Composer/Builder temperature scaling — 동적 temperature 구현 (1차부터 지적된 사항)
4. `synthesizeTemplateOperationsFromComposer()` — Composer output에서 template operation 자동 생성
5. `resolvePreferredTemplateId()` — Composer signal로부터 templateId 추론
6. LLM prompt — 지원 templateId 목록 명시
7. CSS — premium-stage, editorial-strip 스타일 대규모 추가

---

## 2. 올바르게 수정된 부분

### 2.1 Template Resolver 함수 — 2차 MEDIUM 충돌 해소

**위치:** `server.js:10009-10035`

**2차 문제:** regex 순서 의존 충돌 ("editorial-premium" → premium 선택, editorial 무시)

**현재 코드:**

```javascript
function resolveHeroTemplateVariant(templateId = "") {
  const normalized = String(templateId || "").trim().toLowerCase();
  if (!normalized) return "carousel";
  const exactMap = new Map([
    ["hero-carousel-composition-v1", "carousel"],
    ["hero-editorial-v1", "editorial"],
    ["hero-premium-stage-v1", "premium-stage"],
  ]);
  if (exactMap.has(normalized)) return exactMap.get(normalized);
  if (/copy-left|visual-right|editorial|story|magazine|wise|brand-story/.test(normalized)) return "editorial";
  if (/premium|stage|contrast|cinematic|ferrari|bold/.test(normalized)) return "premium-stage";
  if (/carousel|slider/.test(normalized)) return "carousel";
  return "carousel";
}
```

실제 동작 확인:

```
"hero-editorial-v1"         → editorial      (exact match)
"hero-premium-stage-v1"     → premium-stage  (exact match)
"hero-editorial-premium-v1" → editorial      (editorial regex 먼저 매칭) ✓ 충돌 해소
"hero-copy-left-visual-right-v1" → editorial ✓ 이전에 carousel로 수렴하던 케이스
"hero-cinematic-editorial-v1"    → editorial ✓
"hero-bold-v1"              → premium-stage
"hero-unknown-v1"           → carousel
```

판정: **해소됨**. 2차에서 지적한 regex 충돌 및 "copy-left" ID가 carousel로 수렴하던 문제 모두 해결.

---

### 2.2 componentComposition Merge — 2차 MEDIUM 우선순위 충돌 해소

**위치:** `llm.js:4161-4190`

**2차 문제:** LLM 직접 생성 componentComposition이 있으면 `replace_component_template`에서 synthesize한 templateId가 무시됨

**현재 코드:**

```javascript
const synthesizedTemplateComposition = synthesizeComponentCompositionFromTemplateOperations(normalized.buildResult.operations, builderInput);
if (normalized.buildResult.report.componentComposition.length) {
  const templateMap = new Map(
    synthesizedTemplateComposition.map((item) => [`${item.componentId}::${item.slotId}`, item])
  );
  normalized.buildResult.report.componentComposition = normalized.buildResult.report.componentComposition.map((item) => {
    const key = `${item.componentId}::${item.slotId}`;
    const templateEntry = templateMap.get(key);
    if (!templateEntry) return item;
    return {
      ...item,
      familyId: item.familyId || templateEntry.familyId,       // 빈 familyId 보완
      templateId: item.templateId || templateEntry.templateId,  // 빈 templateId 보완
      assetPlan: (item.assetPlan?.iconSetIds?.length || ...) ? item.assetPlan : templateEntry.assetPlan,
    };
  });
} else {
  normalized.buildResult.report.componentComposition = synthesizedTemplateComposition;
}
```

LLM 직접 생성 항목에서 `templateId`가 누락된 경우 synthesized 항목으로 보완된다. LLM 생성 값이 있으면 그것이 우선한다.

판정: **해소됨**.

---

### 2.3 Temperature Scaling — Composer와 Builder 모두 구현

**Composer** (`llm.js:3472`):

```javascript
const composerTemperature = patchDepth === "full" ? 0.34 : patchDepth === "strong" ? 0.28 : patchDepth === "light" ? 0.12 : 0.18;
```

**Builder/Detailer** (`llm.js:4727`):

```javascript
const builderTemperature = designChangeLevel === "high" ? 0.28 : designChangeLevel === "low" ? 0.1 : 0.15;
```

이전: 모든 call 0.1 고정
현재: patchDepth/designChangeLevel에 따라 동적 조정

판정: **구현됨**. 단, 아래 3.1항 참조.

---

### 2.4 Composer-First Template Synthesis

**위치:** `llm.js:4691-4814`, `llm.js:4770-4791`

Composer output에 compositionTree가 있고 patchDepth가 strong/full이면, Builder가 `replace_component_template` operation을 생성하지 않더라도 서버가 자동으로 Composer 결과에서 template operations를 합성해서 operations 앞에 prepend한다.

```javascript
if (compositionResult?.composition?.compositionTree?.length &&
    (currentPatchDepth === "strong" || currentPatchDepth === "full" || currentInterventionLayer === "component")) {
  const synthesizedTemplateOperations = synthesizeTemplateOperationsFromComposer(...);
  if (synthesizedTemplateOperations.length) {
    normalizedResult.buildResult.operations = [
      ...synthesizedTemplateOperations,  // template ops 먼저
      ...safeArray(normalizedResult.buildResult.operations, 100),
    ];
  }
}
```

판정: **유의미한 추가**. LLM이 `replace_component_template`을 누락해도 Composer 결과가 있으면 서버가 보완한다.

---

### 2.5 LLM Prompt — 지원 templateId 명시

**`llm.js:3118-3121`:**

```
"For strong/full redesign requests, prefer at least one replace_component_template operation."
"Supported templateId values for hero are exactly: hero-carousel-composition-v1, hero-editorial-v1, hero-premium-stage-v1."
"Supported templateId values for quickmenu are exactly: icon-link-grid-composition-v1, quickmenu-editorial-strip-v1."
"Do not invent free-form template ids like copy-left-visual-right."
```

이전에는 LLM이 `"hero-copy-left-visual-right-v1"` 같은 자유 형식 ID를 생성하면 carousel로 수렴했다. 이제 지원 범위를 명시해서 LLM이 올바른 ID를 선택하도록 유도한다.

판정: **유효한 가이드**. 단, 아래 3.2항 참조.

---

### 2.6 CSS 대규모 추가

- `.codex-home-composition--hero.is-template-premium-v1` 관련 CSS: `server.js:12658+`
- `.codex-home-composition-hero-premium-stage`, `.codex-home-composition-hero-premium-support`: `server.js:12799+`
- `.codex-home-composition-hero-editorial-stage`, `.codex-home-composition-hero-editorial-rail`: `server.js:12778+`
- `.codex-home-composition--quickmenu.is-template-editorial-strip-v1`: `server.js:13045+`

template variant별 전용 CSS가 추가되어 HTML 구조 변화가 시각적으로 반영된다.

판정: **필수 추가. 정상**.

---

## 3. 새로 발견된 문제점

### 3.1 [MEDIUM] Temperature 신호 불일치 — Composer가 bold하게 설계해도 Builder가 conservative하게 실행

**Composer temperature 기준:** `patchDepth`

```
patchDepth=light   → 0.12
patchDepth=medium  → 0.18
patchDepth=strong  → 0.28
patchDepth=full    → 0.34
```

**Builder temperature 기준:** `designChangeLevel`

```
designChangeLevel=low    → 0.10
designChangeLevel=medium → 0.15
designChangeLevel=high   → 0.28
```

**충돌 시나리오:**

```
request: patchDepth=full + designChangeLevel=medium
→ Composer temperature: 0.34  (exploratory)
→ Builder temperature:  0.15  (conservative)
```

Composer가 0.34 temperature로 bold한 compositionTree를 설계했는데, Detailer가 0.15로 그것을 patch-level에서 conservative하게 실행한다. Composer 의도가 Detailer 실행에서 희석될 가능성이 있다.

**근거:** `patchDepth`와 `designChangeLevel`은 서로 다른 경로로 전달되는 독립 파라미터다. UI에서 두 값이 항상 같이 올라가지 않는다.

**수정 방향:**

Builder temperature도 `patchDepth`를 기준으로 맞추거나, 두 값을 통합해서 하나의 intensity 신호로 처리:

```javascript
const builderTemperature =
  patchDepth === "full" ? 0.32 :
  patchDepth === "strong" ? 0.24 :
  patchDepth === "light" ? 0.1 :
  (designChangeLevel === "high" ? 0.22 : designChangeLevel === "low" ? 0.1 : 0.15);
```

---

### 3.2 [LOW] Quickmenu exact map — "icon-link-grid" ID가 "panel" 레이아웃으로 수렴

**위치:** `server.js:10027-10030`

```javascript
const exactMap = new Map([
  ["icon-link-grid-composition-v1", "panel"],
  ["quickmenu-editorial-strip-v1", "editorial-strip"],
]);
```

**문제:**

LLM에게 전달하는 prompt (`llm.js:3120`):

```
"Supported templateId values for quickmenu are exactly: icon-link-grid-composition-v1, quickmenu-editorial-strip-v1."
```

LLM이 기본 grid 레이아웃을 원할 때 `icon-link-grid-composition-v1`을 선택하지만, 실제 renderer는 이것을 "panel" (lead card + secondary list) 레이아웃으로 렌더링한다. 이름(`icon-link-grid`)과 실제 결과(`panel`)가 불일치한다.

동작 확인:

```
"icon-link-grid-composition-v1" → resolveQuickmenuTemplateVariant → "panel"
                                 → usePanelVariant = true
                                 → lead 카드 + secondary items 구조
```

LLM이 "기본 아이콘 그리드를 유지하면서 보완하겠다"는 의도로 `icon-link-grid-composition-v1`을 선택해도 눈에 띄게 다른 panel 레이아웃이 나온다.

**수정 방향:**

기본 grid (변경 없는 경우)는 별도 templateId 없이 처리하거나, prompt에 정확한 레이아웃 설명을 추가:

```
"icon-link-grid-composition-v1: panel layout with featured lead card"
"quickmenu-editorial-strip-v1: editorial curation strip layout"
"(no templateId or default): standard icon grid"
```

---

### 3.3 [LOW] synthesizeTemplateOperationsFromComposer — medium patchDepth에서 미작동

**위치:** `llm.js:4772-4774`

```javascript
if (
  compositionResult?.composition?.compositionTree?.length &&
  (currentPatchDepth === "strong" || currentPatchDepth === "full" || currentInterventionLayer === "component")
) {
```

**문제:**

patchDepth가 `"medium"`인 경우 (기본값) Composer-first template synthesis가 실행되지 않는다. LLM이 `replace_component_template`을 생성하지 않으면 template variant가 변경되지 않는다.

medium 요청도 component redesign을 원할 때가 있다 (e.g., interventionLayer=component + patchDepth=medium). 현재는 `interventionLayer === "component"`도 조건에 포함되어 있어서 이 경우는 처리된다. 하지만 `interventionLayer=page + patchDepth=medium`인 경우 synthesis 없음.

영향 범위는 제한적이지만 기록.

---

## 4. 여전히 미해결인 이전 문제

### 4.1 [HIGH] Admin UI — 409 quality-gate 응답 미처리

`web/admin-research.html:5159-5163` — 3차에서도 변경 없음. catch 블록이 `error.message`만 `alert()`으로 표시한다.

### 4.2 [HIGH] Visual Critic Fallback — 70점 고정

`llm.js:4669-4678` — 변경 없음.

### 4.3 [MEDIUM] INTERNAL_VISUAL_CRITIC_KEY — 서버 재시작마다 변경

`server.js:84` — 변경 없음.

---

## 5. 전체 상태 업데이트

| 항목 | 1차 상태 | 2차 상태 | 3차 현재 |
|------|----------|----------|---------|
| replace_component_template 미구현 | CRITICAL | 해소 | 해소 |
| theme regex 개선 | HIGH | 해소 | 해소 |
| template regex 충돌 | - | MEDIUM | **해소** |
| componentComposition 우선순위 | - | MEDIUM | **해소** |
| temperature 고정 | MEDIUM | MEDIUM | **해소** (단, Composer↔Builder 신호 불일치 신규 LOW) |
| Composer-first template synthesis | - | - | **신규 추가** |
| resolvePreferredTemplateId | - | - | **신규 추가** |
| 지원 templateId LLM 명시 | - | - | **신규 추가** |
| CSS premium/editorial-strip | - | - | **신규 추가** |
| Quickmenu exact map 불일치 | - | - | **신규 LOW** |
| synthesize medium 미작동 | - | - | **신규 LOW** |
| Admin UI 409 처리 | HIGH | HIGH | 미해결 |
| Critic fallback 70점 | HIGH | HIGH | 미해결 |
| INTERNAL_VISUAL_CRITIC_KEY | MEDIUM | MEDIUM | 미해결 |

---

## 6. 디자인 강도 관점 평가

### 3차까지의 누적 개선

`[1차 문서] admin-design-strength-improvement-paths-2026-04-18.md`에서 제안한 경로 대비:

| 제안 경로 | 상태 |
|----------|------|
| E. Temperature scaling | **구현됨** (Composer 0.12~0.34, Builder 0.10~0.28) |
| A. Template Variant 확장 | **Hero 3종, Quickmenu 3종 구현됨** |
| Composer-first synthesis | **신규 구현됨** (strong/full 자동 synthesis) |
| D. Critic→Fix 매핑 | **미구현** |
| B. CSS Custom Property 주입 | **미구현** |
| C. allowedTokenSets fontWeight/lineHeight 확장 | **미구현** |
| F. Placeholder 강화 | **미구현** |

### 남은 병목

3차까지의 수정으로 **"LLM 의도 → Renderer 실행" 경로**는 상당히 강해졌다:

- Composer가 설계한 template이 Detailer를 거쳐 renderer까지 전달되는 경로가 완성됐다
- strong/full patchDepth에서는 Composer output이 자동으로 `replace_component_template` operation으로 변환된다
- LLM이 지원 templateId 목록을 알고 올바른 ID를 선택할 수 있다

**현재 남은 주요 병목:**

1. **스타일 계층 (typography, color, spacing) 변화 약함**: CSS Custom Property 주입이 없어서 surfaceTone/density/hierarchyEmphasis 같은 styleContract 값이 여전히 LLM 자유 해석으로 처리된다. layout variant는 바뀌어도 색상·타이포그래피 리듬은 바뀌지 않을 수 있다.

2. **이미지 없을 때 시각 공백**: fallback span이 여전히 빈 배경이라 visual critic delta가 낮게 나올 수 있다.

3. **fix pass가 visual fail에 연결되지 않음**: visual critic이 실패해도 서버가 409를 반환하고 끝난다. Admin UI에서 실패 원인을 보고 다음 빌드에 활용하는 UX가 없다 (admin 409 처리 미구현과 연결).
