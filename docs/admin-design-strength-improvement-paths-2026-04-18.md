# Design Strength Improvement Paths

Date: 2026-04-18
Owner: 코드 직접 확인 + 외부 패턴 대조
Status: 분석 문서

관련 문서:

- [admin-external-ai-design-tool-gap-review-2026-04-18.md](/home/mrgbiryu/clonellm/docs/admin-external-ai-design-tool-gap-review-2026-04-18.md)
- [admin-codex-change-verification-2026-04-18.md](/home/mrgbiryu/clonellm/docs/admin-codex-change-verification-2026-04-18.md)
- [admin-design-hardening-architecture-review-2026-04-18.md](/home/mrgbiryu/clonellm/docs/admin-design-hardening-architecture-review-2026-04-18.md)

---

## 핵심 전제

코덱스 외부 리뷰 문서의 핵심 진단:

> "현재 시스템은 약한 리디자인을 진단하는 능력은 많이 올라왔지만,
>  강한 리디자인 결과를 강제하는 실행력은 아직 부족하다"

이 문서는 그 갭을 코드 단위로 근거를 들어 설명하고, 강하게 수정될 수 있는 경로를 구체적으로 제시한다.

---

## 1. 외부 도구 패턴 대조 요약

외부 도구들이 더 강한 결과를 내는 이유는 모델이 더 좋아서가 아니다.

| 패턴 | 외부 도구 | clonellm 현재 |
|------|-----------|--------------|
| 생성 전 시각 컨텍스트 | Figma 컴포넌트 / 실제 디자인 파일 | 텍스트 요약 + reference screenshot |
| 구조 교체 권한 | 섹션 단위 전면 재생성 | patch 중심, template replace 미구현 |
| 스타일 시스템 | 디자인 시스템 / style guide first | 토큰 범위 힌트 (텍스트로 전달) |
| 정제 루프 | 직접 비주얼 편집 가능 | LLM re-run |
| 컴포넌트 변형 수 | 수십 가지 variant | hero: 2가지, quickmenu: 2가지 |

핵심: **외부 도구는 구조 변경을 쉽게 만들고, 스타일을 코드보다 앞에서 결정한다.**

---

## 2. 코드에서 발견한 디자인 강도 제한 지점

### 2.1 Template Variant가 너무 적다

**근거: `server.js:10330-10331`**

```javascript
const templateId = String(composition?.templateId || "").trim();
const useEditorialVariant = /editorial|hero-carousel-composition-v1/i.test(templateId);
```

Hero renderer는 2가지 분기만 있다:
- `useEditorialVariant = true` → editorial 레이아웃 (lead + rail)
- `useEditorialVariant = false` → 기본 carousel 레이아웃

LLM Composer가 아무리 다양한 `templateId`를 생성해도 renderer는 이 2개 중 하나로 수렴한다.

**`server.js:10346`:**
```javascript
`codex-home-composition--hero ${theme.classes} ${useEditorialVariant ? "is-template-editorial-v1" : ""}`.trim()
```

Quickmenu도 동일 구조:

**`server.js:10446`** 함수 구조 확인 시 `usePanelVariant` 하나만 분기.

**결론:** LLM이 "full-width editorial", "side-by-side hero", "immersive full-bleed" 등 다양한 구조를 설계해도 렌더러가 2가지 이상 표현할 수 없다. 시각 결과가 항상 유사한 구조로 수렴하는 근본 원인이다.

---

### 2.2 CSS는 항상 동일하다

**근거: `server.js:10219-10221`**

```javascript
function buildHomeCompositionSelfContainedStyleTag() {
  return `<style data-codex-composition-style="home">${buildHomeHeroRuntimeCss()}</style>`;
}
```

모든 hero renderer 호출은 `buildHomeHeroRuntimeCss()`를 공유한다. template variant나 theme class와 무관하게 동일 CSS base가 주입된다.

**`server.js:10382`:**
```javascript
${buildHomeCompositionSelfContainedStyleTag()}
```

`is-editorial`, `is-premium-stage` 같은 theme class들이 CSS에 정의되어 있어서 modifier로 동작하지만, 구조 자체는 동일하다. 색상, 간격, 레이아웃 방향이 다른 별도 CSS bundle이 존재하지 않는다.

**결론:** 시각적으로 다른 느낌을 내려면 다른 CSS가 필요하다. theme modifier class로는 폰트 크기, 배경색, 패딩 변화만 가능하고 grid 방향 전환, 비율 변경, 레이어 구조 변경은 불가능하다.

---

### 2.3 Style Contract는 설명이지 값이 아니다

**근거: `llm.js:2905`**

```javascript
"composition.styleContract should describe slot-level style intent such as surfaceTone, density, hierarchyEmphasis, interactionTone, and tokenHints.",
```

Composer가 생성하는 styleContract 예시:

```json
{
  "slotId": "hero",
  "surfaceTone": "editorial-bright",
  "density": "spacious",
  "hierarchyEmphasis": "title-first",
  "interactionTone": "quiet"
}
```

이것은 **서술 언어**다. Detailer는 이 서술을 받아서 구체적인 pixel 값으로 번역해야 한다. `editorial-bright`가 `#f8f4ef`인지 `#ffffff`인지 LLM이 해석한다.

**비교: `llm.js:2699-2770`** `buildAllowedTokenSets()`는 구체적인 pixel 값을 생성한다:

```javascript
for (let px = Number(rule.titleSize.min || 0); px <= Number(rule.titleSize.max || 0); px += step) {
  values.push(`${px}px`);
}
```

그런데 이것도 `titleSize`와 `subtitleSize`만 다룬다. **color, line-height, letter-spacing, font-weight, grid gap이 없다.** LLM이 이 값들을 자유롭게 결정한다.

**결론:** 디자인 강도의 핵심인 타이포그래피 계층, 컬러 팔레트, 공간 리듬이 생성 시점에 LLM의 자유 해석에 맡겨져 있다.

---

### 2.4 Theme 해석이 asset set ID에만 의존한다

**근거: `server.js:9986-10004`**

```javascript
return {
  classes: [
    visualSetIds.includes("home-hero-editorial") ? "is-editorial" : "",
    visualSetIds.includes("home-hero-premium-stage") ? "is-premium-stage" : "",
    visualSetIds.includes("home-banner-cinematic") ? "is-cinematic" : "",
    iconSetIds.includes("home-quickmenu-line") ? "is-line-icon" : "",
    iconSetIds.includes("home-quickmenu-solid") ? "is-solid-icon" : "",
    ...
  ].filter(Boolean).join(" "),
};
```

Theme class는 `assetPlan.visualSetIds` / `iconSetIds` / `badgePresetIds`에 특정 string이 있을 때만 추가된다.

이 방식의 문제:

1. LLM이 정확히 `"home-hero-editorial"` 같은 ID string을 생성해야 한다
2. ID가 오타이거나 새 표현이면 아무 theme class도 추가되지 않는다
3. 렌더러는 기본(class 없음) 상태로 fallback하고 시각 변화가 없다

**실제 확인:**

`mergeRuntimeCompositionAssetPlan`이 빈 배열을 반환하면 → `resolveHomeCompositionTheme` 호출 결과 `classes: ""`가 된다 → template도 editorial 아님(기본 carousel) → 가장 약한 출력.

---

### 2.5 Higher Layer Composition CSS는 body class에 의존한다

**근거: `server.js:10262-10278`**

```javascript
function buildHomeHigherLayerCompositionStyleTag(state = {}) {
  const classes = [];
  if (state?.isPageComposition) classes.push("codex-home-page-composition-v1");
  if (state?.isTopGroupComposition) classes.push("codex-home-top-composition-v1");
  if (!classes.length) return "";
  return `
    <style data-codex-home-higher-layer="true">
      body.codex-home-page-composition-v1 {
        background: radial-gradient(circle at 14% 10%, rgba(255,255,255,0.96), transparent 24%),
          linear-gradient(180deg, #f4efe8 0%, #f8f5f1 18%, #fff 38%, #f7fafc 100%);
      }
      body.codex-home-page-composition-v1 [data-codex-slot="hero"],
      body.codex-home-top-composition-v1 [data-codex-slot="hero"] {
        position: relative;
        z-index: 2;
      }
```

Page/Group level composition은 `body`에 class를 주입해서 배경 그라디언트와 z-index를 추가하는 방식이다. 이것은 실제 구조 변경이 아니라 **기존 구조 위에 overlay**다.

이 방식으로는:
- 섹션 순서 변경 불가
- 섹션 간 공간 리듬 변경 불가
- 전혀 다른 grid 구조 생성 불가

**결론:** group/page composition이 "구조 교체"가 아니라 "배경색 + z-index overlay"로 구현되어 있다.

---

## 3. 강하게 수정될 수 있는 경로

### 경로 A: Template Variant 확장 (가장 직접적인 효과)

**문제:** hero renderer 2가지, quickmenu renderer 2가지

**해결 방향:**

hero template을 최소 4가지로 확장:

```
variant-1: carousel (현재 기본)
variant-2: editorial-split (현재 editorial)
variant-3: full-bleed-immersive (배경 이미지 full-cover, 텍스트 overlay)
variant-4: split-panel (좌측 카피 50% / 우측 이미지 50%, flex 방향 row)
```

각 variant는 HTML 구조가 다르고, CSS bundle도 다르다.

**구현 방식:**

```javascript
function resolveHeroTemplate(templateId = "") {
  if (/editorial/i.test(templateId)) return "editorial-split";
  if (/full.bleed|immersive|cinematic/i.test(templateId)) return "full-bleed";
  if (/split.panel|side.by.side|copy.left/i.test(templateId)) return "split-panel";
  return "carousel";
}
```

LLM이 `templateId: "hero-split-panel-v1"`이나 `layoutStrategy: "copy-left visual-right"` 같은 표현을 사용하면 renderer가 실제로 다른 HTML을 생성한다.

**기대 효과:** LLM이 원하는 구조가 실제로 화면에 반영된다. 현재 가장 큰 `의도 → 렌더링` 손실 지점을 해소한다.

---

### 경로 B: CSS Custom Property (Design Token) 주입

**문제:** 색상, 타이포그래피, 공간 리듬이 LLM 자유 해석에 맡겨짐

**해결 방향:**

renderer가 HTML을 생성할 때 section 루트에 CSS variable을 인라인으로 주입한다.

```javascript
function buildCompositionTokenVars(styleContract = {}, compositionTheme = {}) {
  const vars = [];
  
  // surfaceTone → 배경 색상 결정
  const bgMap = {
    "editorial-bright": "#f8f4ef",
    "editorial-dark": "#1a1a2e",
    "clean-card": "#ffffff",
    "premium-dark": "#0d0d1a",
    "brand-light": "#e8f4f8",
  };
  const bg = bgMap[styleContract.surfaceTone] || "#ffffff";
  vars.push(`--codex-surface: ${bg}`);
  
  // density → spacing scale
  const spacingMap = {
    "spacious": { section: "80px 40px", gap: "32px" },
    "medium": { section: "48px 24px", gap: "20px" },
    "compact": { section: "28px 16px", gap: "12px" },
  };
  const spacing = spacingMap[styleContract.density] || spacingMap.medium;
  vars.push(`--codex-section-padding: ${spacing.section}`);
  vars.push(`--codex-gap: ${spacing.gap}`);
  
  // hierarchyEmphasis → typography ratio
  const typoMap = {
    "title-first": { title: "2.4rem", sub: "1rem", weight: "800" },
    "balanced": { title: "1.8rem", sub: "1rem", weight: "700" },
    "body-forward": { title: "1.4rem", sub: "1.1rem", weight: "600" },
  };
  const typo = typoMap[styleContract.hierarchyEmphasis] || typoMap.balanced;
  vars.push(`--codex-title-size: ${typo.title}`);
  vars.push(`--codex-subtitle-size: ${typo.sub}`);
  vars.push(`--codex-title-weight: ${typo.weight}`);
  
  return vars.length ? ` style="${vars.join("; ")}"` : "";
}
```

Section HTML에 적용:

```html
<section ... style="--codex-surface: #f8f4ef; --codex-section-padding: 80px 40px; --codex-title-size: 2.4rem; ...">
```

공유 CSS는 이 variable을 사용:

```css
.codex-home-composition {
  background: var(--codex-surface, #fff);
  padding: var(--codex-section-padding, 48px 24px);
}
.codex-home-composition-title {
  font-size: var(--codex-title-size, 1.8rem);
  font-weight: var(--codex-title-weight, 700);
}
```

**기대 효과:**

- LLM이 `density: "spacious"`, `surfaceTone: "editorial-bright"` 같은 서술을 출력하면 renderer가 이를 구체적인 CSS value로 변환한다
- 번역 책임이 LLM에서 서버 코드로 이동한다 → 일관성 보장
- Cross-slot 스타일 조율 문제도 해결: 부모 section에 variable을 주입하면 하위 요소가 모두 상속

---

### 경로 C: allowedTokenSets에 Color와 Typography 추가

**문제:** `buildAllowedTokenSets()`가 titleSize, subtitleSize만 다룸 (`llm.js:2699-2770`)

**현재 커버리지:**
```
titleSize: px range ✓
subtitleSize: px range ✓
padding: string array ✓
radius: ["0px", "24px", "28px"] ✓
background: ["#ffffff", "#f8fafc"] ✓
iconSize: fixed array ✓
```

**누락 항목:**

```
lineHeight: 없음 (타이포그래피 계층의 핵심)
letterSpacing: 없음
fontWeight: 없음 (700 vs 800 차이가 hierarchy 강도를 결정)
color (text): 없음
color (accent): 없음
gridColumns: 없음
columnGap: 없음
aspectRatio: 없음 (이미지 비율 변경에 필요)
```

**해결 방향:**

```javascript
if (styleKeys.has("fontWeight")) {
  componentTokens.fontWeight = ["400", "500", "600", "700", "800", "900"];
}
if (styleKeys.has("lineHeight")) {
  componentTokens.lineHeight = ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6"];
}
if (styleKeys.has("letterSpacing")) {
  componentTokens.letterSpacing = ["-0.04em", "-0.02em", "0em", "0.02em", "0.04em"];
}
if (styleKeys.has("color")) {
  componentTokens.textColors = ["#0d0d0d", "#1a1a2e", "#333344", "#ffffff", "#f8f4ef"];
}
```

그리고 patchSchema에 `fontWeight`, `lineHeight`, `letterSpacing`을 추가해서 Detailer가 생성할 수 있도록 허용한다.

**기대 효과:** LLM이 구체적인 허용값 목록을 보고 선택하므로 "폰트 굵기를 더 강하게"가 `fontWeight: "800"` 같은 실행 가능한 값으로 연결된다.

---

### 경로 D: Critic → Fix 매핑 테이블

**문제:** visual critic failure가 "retry" 신호를 만들지만, fix pass가 구체적으로 무엇을 어떻게 바꿔야 하는지 guidance가 약하다

**근거: `llm.js:4479-4480`**

```javascript
if (retryTrigger?.shouldRetry) {
  const fixResult = await handleLlmFix(detailerInput, normalizedResult.buildResult);
```

fix pass는 `retryTrigger.instructions` 배열을 받지만, 이 instructions가 "increase structural movement, hierarchy contrast"처럼 추상적이다.

**해결 방향:**

critic 실패 dimension별로 concrete fix 지시를 매핑한다:

```javascript
const CRITIC_FIX_MAP = {
  hierarchy: [
    "titleSize를 현재 값보다 최소 8px 키워라",
    "subtitleSize를 titleSize의 55% 이하로 줄여라",
    "fontWeight를 800 이상으로 설정하라",
    "badge를 제거하거나 크기를 대폭 줄여라",
  ],
  alignment: [
    "모든 텍스트 요소를 단일 baseline에 정렬하라",
    "padding 값을 spacingScale의 2단계 위로 올려라",
    "visual 요소와 copy 요소 사이 gap을 명시적으로 설정하라",
  ],
  changeStrength: [
    "background를 현재 #ffffff가 아닌 다른 값으로 변경하라",
    "templateId를 editorial 계열로 전환하라",
    "badge 텍스트를 현재와 완전히 다른 포지셔닝으로 변경하라",
  ],
  deltaGate: [
    "replace_component_template action을 사용하라",
    "hero의 background를 완전히 다른 색상으로 변경하라",
    "이미지 위치를 left에서 right 또는 반대로 전환하라",
  ],
};
```

이 매핑을 `buildFixSystemPrompt()`에 주입하면 fix pass가 실제로 다른 행동을 한다.

---

### 경로 E: LLM Temperature를 Design Change Level에 연결

**현재 상태 확인:**

**`llm.js:4665`, `llm.js:3229`:**
```javascript
temperature: 0.1,
```

모든 LLM call이 `temperature: 0.1`로 고정되어 있다.

**외부 도구 패턴:**

높은 창의성이 필요한 "full redesign" 요청에서 temperature가 낮으면 LLM이 원본에 가까운 보수적인 출력을 생성한다. 이것이 "리디자인이 원본과 너무 유사한" 문제의 간접 원인 중 하나다.

**해결 방향:**

```javascript
function resolveGenerationTemperature(builderInput = {}) {
  const patchDepth = String(builderInput?.generationOptions?.patchDepth || "").trim();
  const interventionLayer = String(builderInput?.generationOptions?.interventionLayer || "").trim();
  if (patchDepth === "full" || interventionLayer === "page") return 0.7;
  if (patchDepth === "strong") return 0.5;
  if (patchDepth === "medium") return 0.3;
  return 0.15;
}
```

Composer pass (구조 결정): temperature 높게 → 더 다양한 구조 제안
Detailer pass (값 확정): temperature 낮게 → 안정적인 token 선택
Fix pass: temperature 중간 → targeted but slightly exploratory

아키텍처 문서 section 6.6.1에 이미 명시되어 있는 내용인데 현재 코드에서 구현되지 않은 상태다.

---

### 경로 F: 이미지 Placeholder를 Visual 강도 신호로 활용

**현재 상태:**

**`server.js:10358`, `server.js:10412`:**
```javascript
${imageSrc ? `<img src="${escapeHtml(imageSrc)}" alt="..." />` : `<span class="codex-home-composition-hero-fallback"></span>`}
```

이미지가 없으면 빈 `<span>`이 들어간다. 결과적으로 화면에 빈 공간이 생기고 시각 강도가 급격히 떨어진다.

**외부 도구 패턴:**

screenshot-to-code 시스템들은 이미지가 없을 때 의도적으로 강한 placeholder (color block, gradient, pattern)를 넣어서 layout density를 유지한다.

**해결 방향:**

```javascript
const THEME_PLACEHOLDER_STYLES = {
  "editorial-bright": "background: linear-gradient(135deg, #f0e8d8 0%, #e8d5b0 100%); min-height: 340px;",
  "premium-dark": "background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); min-height: 340px;",
  "default": "background: linear-gradient(135deg, #f4f4f4 0%, #e8e8e8 100%); min-height: 280px;",
};

const placeholder = `<span class="codex-home-composition-hero-fallback" style="${THEME_PLACEHOLDER_STYLES[surfaceTone] || THEME_PLACEHOLDER_STYLES.default}"></span>`;
```

이것만으로도 visual critic의 `changeStrength` 점수가 올라간다.

---

## 4. 경로별 효과 예측

| 경로 | 구현 난이도 | 디자인 강도 향상 | 비고 |
|------|-----------|----------------|------|
| A. Template Variant 확장 | 높음 | 매우 높음 | 렌더러 HTML 다수 추가 필요 |
| B. CSS Custom Property 주입 | 중간 | 높음 | 서버 코드 + CSS 수정 |
| C. Token Set 확장 | 낮음 | 중간 | `buildAllowedTokenSets` 확장 |
| D. Critic → Fix 매핑 | 낮음 | 중간 | prompt 데이터 추가 |
| E. Temperature 스케일링 | 매우 낮음 | 중간 | 1-2줄 변경 |
| F. 이미지 Placeholder | 매우 낮음 | 낮음~중간 | fallback span 스타일 추가 |

---

## 5. 우선순위 판단

### 즉시 적용 가능 (코드 변경 3줄 이하)

1. **Temperature 스케일링** (`llm.js` resolver 함수 추가 + 3곳 callsite 적용)
   - 아키텍처 문서에 이미 명시, 미구현 상태
   - full/strong redesign에서 LLM이 더 다양한 구조를 제안하게 됨

2. **Placeholder 강화** (`server.js` fallback span에 theme별 gradient 추가)
   - visual critic delta 점수 즉각 향상

### 단기 구현 (1-3일)

3. **allowedTokenSets 확장** (`buildAllowedTokenSets`에 fontWeight, lineHeight, letterSpacing 추가)
   - patchSchema에 해당 styleKey도 추가 필요

4. **Critic → Fix 매핑 테이블** (`buildFixSystemPrompt`에 dimension별 concrete instruction 주입)

### 중기 구현 (1-2주)

5. **CSS Custom Property 주입** (renderer → CSS variable 생성 → CSS 공유 bundle 수정)

6. **Template Variant 확장** (hero 4종, quickmenu 3종 HTML template 설계 및 renderer 구현)

---

## 6. 외부 연구 패턴과의 연결

코덱스 외부 리뷰 문서가 언급한 ArXiv 패턴:

- **divide-and-conquer visual refinement**: 이미 Composer → Detailer 분리로 구현
- **visual self-refinement from rendered output**: visual critic으로 구현
- **segment-level detection before generation**: clonellm에서는 slot 단위가 이 역할을 함

**연구 패턴에서 빠진 것:**

최근 screenshot-to-code 연구 (ScreenCoder, screenshot-to-code 등)에서 공통으로 나타나는 패턴:

> 생성 전에 block structure를 명시적으로 탐지하고 mapping한 후 generation에 들어간다.

clonellm에서 이에 해당하는 역할은 Composer인데, Composer output (compositionTree)이 Renderer에서 실제로 실행되지 않는 부분(replace_component_template)이 핵심 손실 지점이다.

이 연결은:

`외부 연구의 "mapping → generation" = clonellm의 "Composer → Renderer"`

이 연결이 지금 끊겨 있다. Composer가 mapping을 만들었는데 Renderer가 실행하지 못한다.

---

## 7. 최종 판단

현재 시스템이 디자인 강도가 낮은 이유는 3가지 층위에서 동시에 발생한다:

**Layer 1 (LLM 생성 단계):**
- temperature가 항상 낮아서 보수적인 출력
- style contract가 서술 언어라서 번역 오차 발생

**Layer 2 (의도 → 실행 연결 단계):**
- replace_component_template이 미구현 → Composer 의도 손실
- theme class가 asset ID string 정확 일치에 의존 → fallback 빈번

**Layer 3 (Renderer 단계):**
- template variant 2가지로 수렴
- CSS bundle 항상 동일
- 이미지 없으면 빈 공간

이 3개 층위 중 가장 빠르게 효과가 나는 것은 **Layer 1 (temperature) + Layer 3 (placeholder)**이다.

가장 근본적인 해결은 **Layer 2 (replace_component_template 실행)** + **Layer 3 (template variant 확장)**이다.

두 가지를 동시에 해야 의미 있는 변화가 생긴다:
- LLM이 더 강하게 설계해도 (temperature 올림)
- Renderer가 그 설계를 표현할 수 없으면 (template 2가지 고정) 결과는 같다

역방향도 마찬가지다:
- Renderer에 template 10가지를 추가해도
- LLM이 항상 "carousel"을 선택하면 (temperature 낮음) 같은 결과가 나온다

**생성 다양성 + 실행 다양성을 동시에 올려야 한다.**
