# Codex 2차 수정 코드 검증 리포트

Date: 2026-04-18
Owner: 코드 단위 직접 확인
Status: 검증 완료

변경 규모 (1차 대비 추가분):

- `llm.js` +379줄
- `server.js` +635줄

---

## 1. 핵심 수정 내용 요약

이번 수정에서 코덱스가 변경한 주요 항목:

1. `replace_component_template` — 이제 실제 데이터에 저장됨 (1차 CRITICAL 수정)
2. `resolveHomeCompositionTheme` — regex 매칭으로 개선 (1차 HIGH 수정)
3. Hero renderer — `usePremiumStageVariant` 3번째 template variant 추가
4. Quickmenu renderer — `useEditorialStripVariant` 3번째 template variant 추가
5. `buildBuilderPromptPayload` — Builder용 payload 구조 함수 신설
6. `mergeRuntimeCompositionAssetPlan` — page/family/component 레이어 병합 추가

---

## 2. 올바르게 수정된 부분

### 2.1 replace_component_template — 연결 완성 (이전 CRITICAL 해소)

**1차 검증 문제:** `applyOperations`에서 `continue`로 버려짐

**현재 코드 (`llm.js:5046-5071`):**

```javascript
if (op.action === "replace_component_template") {
  const pageId = String(op.pageId || "").trim();
  const slotId = String(op.slotId || "").trim();
  const familyId = String(op.familyId || "").trim();
  if (!pageId || !slotId || !familyId) continue;
  const existing = Array.isArray(next.runtimeComponentTemplates) ? next.runtimeComponentTemplates : [];
  const signature = { pageId, viewportProfile, slotId, componentId, familyId, templateId, summary, layoutStrategy };
  next.runtimeComponentTemplates = [...filtered, signature];
  continue;
}
```

**연결 흐름 확인:**

```
LLM: replace_component_template { templateId: "hero-editorial-v1" }
  ↓
applyOperations: next.runtimeComponentTemplates 에 저장 [llm.js:5069]
  ↓
normalizeBuilderResult: componentComposition가 비어있으면
  synthesizeComponentCompositionFromTemplateOperations() 호출 [llm.js:4127]
  → componentComposition entry 생성 (templateId 포함)
  ↓
draftBuild.report.componentComposition = [{ slotId: "hero", templateId: "hero-editorial-v1", ... }]
  ↓
findEffectiveDraftComponentCompositionEntry() [server.js:10184]
  → heroComposition = { templateId: "hero-editorial-v1", ... }
  ↓
renderHomeHeroCompositionSection(..., heroComposition) [server.js:10333]
  const templateId = String(composition?.templateId || "").trim();
  const useEditorialVariant = /editorial/.test("hero-editorial-v1") → true
  ↓
editorial 레이아웃 HTML 렌더링
```

판정: **연결 완성**. LLM 의도 → 렌더러 실행 경로가 이어졌다.

단, 중요한 조건이 있다 (2.2항 참조).

---

### 2.2 resolveHomeCompositionTheme — regex 매칭 개선 (1차 HIGH 해소)

**1차 문제:** asset ID string 정확 일치에만 의존

**현재 코드 (`server.js:9986-9987`):**

```javascript
const hasAlias = (values = [], patterns = []) =>
  values.some((value) => patterns.some((pattern) => pattern.test(String(value || "").trim())));
```

예전: `visualSetIds.includes("home-hero-editorial")` → 정확 일치만
현재: `hasAlias(visualSetIds, [/editorial/i, /story/i])` → 부분 패턴 매칭

LLM이 `"home-hero-editorial-v2"`나 `"editorial-hero"`처럼 변형을 생성해도 `is-editorial` 클래스가 올바르게 붙는다.

판정: **개선됨**. ID string 정확 일치 문제 해소.

---

### 2.3 Hero renderer — premium-stage 3번째 variant 추가

**`server.js:10334, 10397-10422`:**

```javascript
const usePremiumStageVariant = /premium|stage|contrast/i.test(templateId);
```

→ 3개 분기로 확장:
```
usePremiumStageVariant → premium-stage HTML (lead article + support stack)
useEditorialVariant    → editorial HTML (lead + rail)
default                → carousel HTML
```

premium-stage HTML 구조 확인:
- `<article class="codex-home-composition-hero-premium-main">` (lead)
- `<div class="codex-home-composition-hero-premium-stack">` (support list)
- `<a class="codex-home-composition-hero-premium-support">` (support items)

HTML 닫힘 구조 정상 확인 (`server.js:10419`에 `</a>` 존재).

CSS도 추가됨 (`server.js:12628`: `.codex-home-composition--hero.is-template-premium-v1`).

판정: **구현 정상**.

---

### 2.4 Quickmenu renderer — editorial-strip 3번째 variant 추가

**`server.js:10495`:**

```javascript
const useEditorialStripVariant = /editorial-strip|quickmenu-editorial-strip-v1|curation/i.test(templateId);
```

editorial-strip 구조:
- lead 카드 (featured entry, copy + chip rail)
- 나머지 items (items.slice(3, 8))

panel variant:
- lead 카드 (Primary Entry, large)
- secondary items

판정: **구현 정상**. Quickmenu도 3개 분기로 확장.

---

### 2.5 buildBuilderPromptPayload — Builder payload 구조화

**`llm.js:2912`:** 신설 함수.

이전: `buildBuilderUserPrompt`가 payload를 직접 inline으로 구성
현재: `buildBuilderPromptPayload()`가 전용 structured payload를 반환 → `buildBuilderUserPrompt`에서 사용

추가된 context:

- `artifactSidecarRegistry.sections` (componentId별 regions, editableFields, layoutGovernance)
- `patchBridge` (rootPatchPriority, stylePatchPriority, measuredScale)
- `designSpecMarkdown`, `layoutMockupMarkdown`, `sectionBlueprints` 포함
- targetComponents 기준으로 artifact sections를 필터링 (scope 제한)

판정: **유의미한 개선**. Builder가 더 많은 구조적 컨텍스트를 받는다.

---

## 3. 새로 발견된 문제점

### 3.1 [MEDIUM] Template regex 충돌 — premium이 editorial을 조용히 덮음

**위치:** `server.js:10333-10334, 10397, 10423`

**코드:**

```javascript
const useEditorialVariant = /editorial|hero-carousel-composition-v1/i.test(templateId);
const usePremiumStageVariant = /premium|stage|contrast/i.test(templateId);
```

**ternary 분기 순서 (`server.js:10397, 10423`):**

```javascript
${usePremiumStageVariant ? `
  ...premium layout...
` : useEditorialVariant ? `
  ...editorial layout...
` : `
  ...carousel...
`}
```

**충돌 시나리오:**

```javascript
// LLM이 생성하는 templateId
"hero-editorial-premium-v1"  → editorial: true, premium: true → premium 선택 (editorial 무시)
"hero-premium-editorial-v1"  → editorial: true, premium: true → premium 선택 (editorial 무시)
"hero-contrast-editorial-v1" → editorial: true, premium: true → premium 선택 (editorial 무시)
```

실제 테스트:

```
node -e "
const t = 'hero-editorial-premium-v1';
const editorial = /editorial/.test(t);
const premium = /premium|stage|contrast/.test(t);
// premium is checked first → editorial silently lost
console.log(editorial, premium); // true true
"
```

`editorial`이 `true`여도 `premium`이 `true`면 editorial 레이아웃을 볼 수 없다. LLM이 의도적으로 "editorial + premium" 조합 templateId를 생성하면 premium으로만 수렴한다.

**추가 문제:** class명도 둘 다 붙는다:

```javascript
`... ${useEditorialVariant ? "is-template-editorial-v1" : ""} ${usePremiumStageVariant ? "is-template-premium-v1" : ""}`.trim()
```

HTML 출력: `class="... is-template-editorial-v1 is-template-premium-v1"` — 두 class가 동시에 붙지만 HTML 구조는 premium만 렌더링된다. CSS 상태와 DOM 구조가 불일치한다.

**수정 방향:**

```javascript
// premium을 먼저 체크하되, editorial이 포함되면 명시적으로 editorial-premium 계열로 분기
const template =
  /premium-editorial|editorial-premium/i.test(templateId) ? "editorial-premium" :
  /premium|stage|contrast/i.test(templateId) ? "premium" :
  /editorial|hero-carousel-composition-v1/i.test(templateId) ? "editorial" :
  "carousel";
```

---

### 3.2 [MEDIUM] synthesizeComponentCompositionFromTemplateOperations — LLM report와 우선순위 충돌

**위치:** `llm.js:4126-4127`

**코드:**

```javascript
if (!normalized.buildResult.report.componentComposition.length) {
  normalized.buildResult.report.componentComposition = synthesizeComponentCompositionFromTemplateOperations(
    normalized.buildResult.operations, builderInput
  );
}
```

**문제:**

LLM이 `replace_component_template` 연산과 동시에 `report.componentComposition`을 직접 생성하면 (LLM이 JSON schema대로 생성할 경우), 직접 생성된 `componentComposition`이 우선된다.

LLM이 직접 생성한 `componentComposition` 항목은 `templateId`가 없거나, `replace_component_template` 연산의 `templateId`와 다를 수 있다.

예시:

```json
// replace_component_template operation
{ "templateId": "hero-premium-stage-v1" }

// LLM이 직접 생성한 componentComposition entry
{ "familyId": "hero-carousel-composition", "templateId": "" }  // templateId 없음
```

이 경우 renderer가 받는 `heroComposition.templateId`는 빈 문자열 → 모든 regex false → carousel 레이아웃.

`synthesizeComponentCompositionFromTemplateOperations`의 결과가 더 정확하지만 LLM 직접 생성물에 의해 밀릴 수 있다.

**수정 방향:**

merge 전략으로 변경:

```javascript
// 기존 componentComposition과 synthesized를 merge
const synthesized = synthesizeComponentCompositionFromTemplateOperations(operations, builderInput);
if (synthesized.length) {
  // synthesized로 missing templateId를 보완
  normalized.buildResult.report.componentComposition = 
    normalized.buildResult.report.componentComposition.map(entry => {
      const match = synthesized.find(s => s.slotId === entry.slotId);
      return match && !entry.templateId ? { ...entry, templateId: match.templateId } : entry;
    });
}
```

---

### 3.3 [LOW] editorial-strip quickmenu — items slicing 인덱스 기준 불명확

**위치:** `server.js:10555`

**코드:**

```javascript
${(useEditorialStripVariant ? items.slice(3, 8) : (usePanelVariant ? secondaryItems : items))
```

editorial-strip 모드에서는 items[0-2]가 chip rail로 쓰이고(10539), items[3-7]이 일반 카드로 렌더링된다.

문제: items가 3개 미만이면 chip rail에서 `items.slice(1, 4)`이 비고, 카드 영역 `items.slice(3, 8)`도 비게 된다. 결과적으로 editorial strip 전체가 lead card + 빈 카드 목록으로 렌더링된다.

대부분의 quickmenu는 5-8개 항목을 가지므로 실제 발생 빈도는 낮지만, 항목 수가 적은 경우 레이아웃이 무너진다.

---

## 4. 여전히 미해결인 1차 문제

### 4.1 [HIGH] Admin UI — 409 quality-gate 응답 처리 미구현

**위치:** `web/admin-research.html:5159-5163`

1차 검증에서 지적한 내용 그대로 남아 있다. catch 블록이 `error.message`만 `alert()`으로 표시하고, 409 응답 body의 `criticReport`와 `qualityGate` 데이터는 여전히 버려진다.

---

### 4.2 [HIGH] Visual Critic Fallback — 70점 고정 문제 미해결

**위치:** `llm.js:4669-4678`

```javascript
demoFallback: () => ({
  visualCritic: {
    scores: { hierarchy: 70, alignment: 70, ... },
    retryTrigger: { shouldRetry: false, ... },
  },
}),
```

변경 없음.

---

### 4.3 [MEDIUM] INTERNAL_VISUAL_CRITIC_KEY — 서버 재시작마다 변경

**위치:** `server.js:84`

```javascript
const INTERNAL_VISUAL_CRITIC_KEY = String(process.env.INTERNAL_VISUAL_CRITIC_KEY || crypto.randomUUID()).trim();
```

변경 없음. 환경 변수 미설정 시 재시작마다 preview URL 무효화.

---

### 4.4 Temperature — 0.1 고정 미변경

모든 LLM call temperature가 `0.1`로 고정된 상태다. full/strong redesign에서도 보수적 출력이 나오는 원인 중 하나. 아키텍처 문서 section 6.6.1에 명시되어 있는 요구사항이나 구현되지 않았다.

---

## 5. 전체 상태 업데이트

| 항목 | 1차 상태 | 현재 상태 |
|------|----------|-----------|
| replace_component_template 미구현 | CRITICAL | **해소** (runtimeComponentTemplates 저장 + synthesize 경로 연결) |
| theme regex 개선 | HIGH | **해소** (hasAlias 함수로 유연한 매칭) |
| Hero template variants | 2가지 | **3가지** (carousel / editorial / premium-stage) |
| Quickmenu template variants | 2가지 | **3가지** (grid / panel / editorial-strip) |
| Template regex 충돌 | 없음 | **NEW MEDIUM** (editorial+premium 동시 match 시 premium 우선, class 불일치) |
| componentComposition 우선순위 | 없음 | **NEW MEDIUM** (LLM 직접 생성 시 templateId 유실 가능) |
| Admin UI 409 처리 | HIGH | 미해결 |
| Critic fallback 70점 | HIGH | 미해결 |
| INTERNAL_VISUAL_CRITIC_KEY | MEDIUM | 미해결 |
| Temperature scaling | MEDIUM | 미해결 |

---

## 6. 디자인 강도 관점 평가

### 개선됨

- Template variant 수 증가 (2 → 3): LLM이 "premium stage" 구조를 지정하면 실제로 다른 HTML이 나온다
- replace_component_template 연결 완성: Composer 의도가 Renderer까지 전달되는 경로가 생겼다
- asset plan regex 매칭: 더 유연하게 theme class가 붙는다

### 아직 부족한 부분

- `hero-copy-left-visual-right-v1` 같은 templateId는 3개 regex 중 어느 것도 매칭하지 못해 carousel로 수렴한다

  ```
  hero-copy-left-visual-right-v1 → editorial: false, premium: false → carousel
  ```

  LLM이 "split panel" 레이아웃을 요청해도 carousel로 나온다. template regex에 명시적으로 매핑되지 않은 templateId는 모두 carousel이다.

- CSS design token (surfaceTone → CSS variable) 주입 없음: 문서 [admin-design-strength-improvement-paths-2026-04-18.md]에서 제안한 경로 B가 아직 미구현
- Temperature 고정: 경로 E 미구현
- Placeholder 강화: 경로 F 미구현

### 판단

이번 수정으로 `의도 → 실행` 연결의 가장 큰 gap이 해소됐다. "LLM이 구조를 설계해도 renderer가 실행할 수 없다"는 문제가 hero와 quickmenu에 한해서는 개선됐다.

다음 병목은 "templateId 범위"다. 현재 regex가 커버하지 못하는 templateId들이 여전히 carousel로 수렴한다. Renderer가 표현할 수 있는 template variant를 더 추가하거나, 지원 가능한 templateId 목록을 LLM에게 명시적으로 알려줘야 한다.
