# Admin Design Quality Root Cause Analysis

Date: 2026-04-19
Owner: Claude / mrgbiryu alignment draft
Status: Code-evidence-based quality analysis

---

## 1. 분석 목적

"웹디자인을 이걸로만으로도 할 수 있을 만큼의 품질"이 되려면 무엇이 막고 있는지를 코드 근거로 분류.

품질 저하의 원인은 5개 카테고리로 분류된다:

1. **레이아웃 구조의 고정성** — 바꿀 수 있는 레이아웃 종류 자체가 적음
2. **CSS/타이포그래피의 정적 한계** — LLM이 스타일 값을 생성해도 렌더러가 대부분 무시
3. **이미지/에셋의 실제 미존재** — 모든 이미지 슬롯이 회색 플레이스홀더로 출력
4. **파이프라인 로직의 보수성** — temperature, patchDepth 자동 결정 로직이 너무 약함
5. **피드백 루프의 불완전성** — 크리틱이 실패해도 Fix pass가 실질적 변경을 못 만듦

---

## 2. 카테고리 1 — 레이아웃 구조의 고정성

### 2.1 섹션별 템플릿 변형 수

| 섹션 | 템플릿 변형 수 | 비고 |
|------|--------------|------|
| hero | 3 (carousel / editorial / premium-stage) | 모두 2칼럼 copy-left + visual-right |
| quickmenu | 3 (grid / panel / editorial-strip) | |
| best-ranking | **1** | 단일 레이아웃 |
| md-choice | **1** | 단일 레이아웃 |
| timedeal | **1** | 단일 레이아웃 |
| subscription | **1** | 단일 레이아웃 |
| summary-banner-2 | **1** | 단일 레이아웃 |

코드 근거: server.js:15693, 15724, 15762, 15787 — composition 렌더러 분기가 hero와 quickmenu에만 존재. ranking, commerce, banner는 familyId 지정 여부와 무관하게 단일 함수 출력.

### 2.2 Hero 3개 변형이 사실상 동일 구조

server.js:11487-11499:

```
grid-template-columns: minmax(0, 1.05fr) minmax(360px, 0.95fr)   // carousel
grid-template-columns: minmax(0, 0.92fr) minmax(420px, 1.08fr)   // editorial
grid-template-columns: minmax(0, 0.82fr) minmax(460px, 1.18fr)   // premium-stage
```

3개 변형 모두 "copy 왼쪽 + visual 오른쪽" 2칼럼이다. full-bleed 이미지, centered copy, stacked 레이아웃, 이미지-퍼스트 레이아웃은 없다. 외관상 차이는 칼럼 비율 + 배경 그라디언트 색상뿐.

### 2.3 클래식 패치 경로 — live HTML regex 패치

composition이 활성화되지 않을 때 (familyId 미지정):

server.js:12455 (`applyHomeHeroPatch()`):

```js
function applyHomeHeroPatch(sectionHtml, activeSourceId = "", componentPatch = {}) {
  let next = String(sectionHtml);
  // lge.co.kr에서 캡처된 HTML에 regex 문자열 치환만 수행
  next = next.replace(/<section([^>]*)>/, ...)
  nextSlide = nextSlide.replace(badgePattern, ...)
  nextSlide = nextSlide.replace(headlinePattern, ...)
```

이 경로에서는 구조 변경 불가. 텍스트 치환 + section 태그 인라인 스타일 삽입만 가능. LGE 원본 HTML의 레이아웃이 그대로 유지된다.

---

## 3. 카테고리 2 — CSS/타이포그래피의 정적 한계

### 3.1 composition CSS가 완전히 고정

server.js:11069-11071:

```js
function buildHomeCompositionSelfContainedStyleTag() {
  return `<style data-codex-composition-style="home">${buildHomeHeroRuntimeCss()}</style>`;
}
```

매번 **동일한 CSS 블록**을 반환한다. 빌드마다, 슬롯마다, patchDepth마다 동일. 14KB의 하드코딩된 CSS가 고정으로 삽입된다.

server.js:13543-13548 (고정 타이포그래피):

```css
.codex-home-composition-title {
  font: 700 46px/1.08 Arial, sans-serif;
  letter-spacing: -0.04em;
}
.codex-home-composition-description {
  font: 500 17px/1.65 Arial, sans-serif;
  letter-spacing: -0.02em;
}
```

폰트 패밀리, 라인 높이, 레터 스페이싱이 모두 고정값. LLM이 아무리 다른 typography를 제안해도 이 CSS가 우선 적용된다.

### 3.2 `buildTextPatchStyleText()`가 버리는 타이포그래피 속성

server.js:12794-12806:

```js
function buildTextPatchStyleText(styles = {}, kind = "title") {
  if (nextStyles[colorKey]) styleParts.push(`color:${nextStyles[colorKey]}`);
  if (nextStyles[weightKey]) styleParts.push(`font-weight:${nextStyles[weightKey]}`);
  const size = normalizeCssSizeValue(nextStyles[sizeKey]);
  if (size) styleParts.push(`font-size:${size}`);
  if (nextStyles.textAlign) styleParts.push(`text-align:${nextStyles.textAlign}`);
  return styleParts.filter(Boolean).join(";");
}
```

적용되는 속성: `color`, `font-weight`, `font-size`, `text-align` — 4개뿐.

LLM 패치에 포함되어도 무시되는 속성:
- `line-height`
- `letter-spacing`
- `font-family`
- `text-transform`
- `text-shadow`
- `word-break`
- `word-spacing`

결론: LLM이 line-height: 1.4를 지정해도, 고정 CSS의 `/1.08` line-height가 우선 적용되고, 인라인 스타일 override도 불가.

### 3.3 `buildSectionPatchStyleText()`가 버리는 레이아웃 속성

server.js:12764-12792 — 섹션 레벨에서 적용되는 속성:

```js
background, border-radius, min-height, border-*, box-shadow, padding, opacity, textAlign
```

무시되는 속성:
- `gap` / `column-gap` / `row-gap`
- `display` (flex, grid)
- `grid-template-columns`
- `align-items` / `justify-content`
- `margin`
- CSS custom properties (`--codex-*`)

결론: 섹션의 내부 간격, 그리드, 정렬을 LLM이 바꿀 방법이 없다.

### 3.4 theme 시스템이 CSS에 거의 영향을 주지 않음

`resolveHomeCompositionTheme()`이 반환하는 CSS class 목록:

```
is-soft-pill          → badge background만 약간 변경 (rgba 값 차이)
is-premium-contrast   → 적용 CSS 없음 (선언만 있고 rule 없음)
is-editorial-accent   → 적용 CSS 없음
is-trust              → 적용 CSS 없음
is-commerce-utility   → 적용 CSS 없음
```

코드 근거: server.js:13539-13542 — `is-soft-pill`에 대한 badge 스타일만 정의됨. 나머지 클래스에 대한 CSS rule이 없음. theme system이 사실상 dead code.

---

## 4. 카테고리 3 — 이미지/에셋의 실제 미존재

### 4.1 starter asset에 `assetUrl` 없음

server.js:10709-10713:

```js
function pickResolvedStarterAssetUrl(items = [], index = 0) {
  const pool = Array.isArray(items) ? items.filter((item) => String(item?.assetUrl || "").trim()) : [];
  if (!pool.length) return "";  // ← 항상 ""
```

`asset-pipeline-starter.json`의 모든 항목에 `assetUrl` 필드가 없다 (id, label, usage, style만 존재). 따라서 `pool.length === 0`이 항상 true이고, 이 함수는 항상 `""` 반환.

### 4.2 이미지 없을 때 fallback이 빈 박스

server.js:11217:

```js
${imageSrc ? `<img src="..." />` : `<span class="codex-home-composition-hero-fallback"></span>`}
```

`imageSrc`가 빈 문자열이면 `<span class="codex-home-composition-hero-fallback"></span>`이 렌더된다. 이 클래스에 대한 CSS가 없으면 빈 회색 박스 또는 아무것도 보이지 않는다.

결론: composition renderer로 hero, banner, commerce 섹션을 렌더해도 모든 이미지 영역이 빈 플레이스홀더로 출력된다. 텍스트-온리 레이아웃처럼 보인다.

### 4.3 영향 범위

이미지 없음 → composition 렌더러를 사용하는 모든 섹션:

| 섹션 | 이미지 슬롯 | 실제 출력 |
|------|-----------|---------|
| hero | 메인 이미지, 서포트 슬라이드 이미지 | 빈 박스 |
| summary-banner-2 | 배너 이미지 | 빈 박스 |
| md-choice / timedeal | 카드 썸네일 | 캡처 원본 사용 (composition 미적용) |
| best-ranking | 상품 이미지 | 캡처 원본 사용 (composition 미적용) |

---

## 5. 카테고리 4 — 파이프라인 로직의 보수성

### 5.1 patchDepth=full이 자동으로 선택되지 않음

llm.js:5196:

```js
const patchDepth = normalizePatchDepth(
  detailerInput?.generationOptions?.patchDepth,
  designChangeLevel === "low" ? "light" : designChangeLevel === "high" ? "strong" : "medium"
);
```

`designChangeLevel=high` → 자동 결정되는 patchDepth = `"strong"` (최대).

`patchDepth=full`은 클라이언트가 API 파라미터로 명시적으로 보내야만 활성화. full depth에서만 temperature 0.32, delta threshold 0.02가 적용된다.

### 5.2 Temperature 상한선 — 빌드 전체

| pass | temperature 상한 | 조건 |
|------|----------------|------|
| Planner | 0.20 | 고정 |
| Composer | 0.34 | patchDepth=full일 때 |
| Detailer (Builder) | 0.32 | patchDepth=full일 때 |
| Fix | **0.10** | 항상 고정 |
| Visual Critic | 0.10 | 항상 고정 |

Fix pass가 0.1인 이유가 없다. 크리틱이 `changeStrength` 실패를 돌려보내도, fix는 보수적으로 실행된다.

### 5.3 composition 렌더러 활성화 조건

server.js:16499-16500:

```js
quickmenuComposition && String(quickmenuComposition.familyId || "").trim() === "icon-link-grid-composition"
  ? renderHomeQuickmenuCompositionSection(...)
  : applyHomeQuickmenuPatch(...)
```

LLM이 `replace_component_template` operation을 발행해야 `familyId`가 설정되고 composition 렌더러가 활성화된다.

LLM이 이 operation을 발행하지 않으면 — 예를 들어 temperature가 낮아 exploratory output이 제한될 때 — 클래식 패치 경로로 빠지고 구조 변경이 불가능하다.

### 5.4 `update_slot_image`가 여전히 허용됨 (섹션 2의 연장)

llm.js:2682 — builder system prompt:

```js
"Use only replace_component_template, update_component_patch, update_slot_text, update_hero_field, update_slot_image, and update_page_title."
```

`update_slot_image`는 임의의 URL을 수락한다. 실제 이미지 URL이 없으면 LLM이 존재하지 않는 URL을 생성하거나 빈 문자열을 보낸다. 결과적으로 이미지 슬롯이 깨지거나 플레이스홀더가 남는다.

---

## 6. 카테고리 5 — 피드백 루프의 불완전성

### 6.1 visual critic demoFallback이 남아있음 (기존 지적 미해결)

llm.js:5539:

```js
demoFallback: () => buildVisualCriticUnavailableFallback(fallbackMessage),
```

API 키가 없거나 타임아웃 시 `buildVisualCriticUnavailableFallback()`이 호출된다. 이 함수는 scores: {hierarchy: 0, ...} + `shouldRetry: true`를 반환한다. 크리틱 없이 fix pass가 실행된다는 의미다.

이전 세션에서 확인한 demoFallback (scores 70, shouldRetry: false)과 달리, 현재 코드는 scores 0 + shouldRetry: true를 반환한다 — 이는 개선된 부분이지만, 크리틱이 실제로 작동하지 않은 상태에서 fix가 실행되는 점은 동일하다.

### 6.2 크리틱의 retryTrigger dimensions가 asset 실패를 감지하지 못함

llm.js:5399-5408 (visual critic prompt):

```js
"Focus on hierarchy clarity, alignment and rhythm, reference alignment, brand fit, and change strength."
```

크리틱이 평가하는 5개 차원:
- hierarchy
- alignment
- referenceAlignment
- brandFit
- changeStrength

없는 차원:
- `assetMissing` — 이미지 슬롯이 플레이스홀더인지
- `imageQuality` — 이미지가 적절한지
- `colorSystemConsistency` — 섹션 간 색상 일관성
- `typographyConsistency` — 글꼴/크기 일관성

결론: 크리틱이 이미지가 모두 빈 박스인 결과를 받아도 `imageQuality` fail을 발행할 수 없다. `changeStrength` 실패만 감지 가능.

### 6.3 fix pass가 새 이미지를 요청하지 못함

llm.js:3811-3834 (`handleLlmFix()`):

Fix pass는 기존 operations를 보정하는 추가 operations를 발행한다. Fix가 발행 가능한 operation: `update_component_patch`, `update_slot_text`, `replace_component_template` (제한적).

Fix는 `update_slot_image`도 발행할 수 있지만, 실제 이미지 URL을 만들 방법이 없다. Fix pass가 "이미지를 교체하라"는 instruction을 받아도 존재하지 않는 URL을 생성하거나 동일한 빈 값을 유지한다.

### 6.4 admin UI가 409 quality-failed 응답을 버림 (기존 지적 미해결)

`web/admin-research.html` catch block이 409 body를 버리는 문제는 3번의 Codex 패치에서도 수정되지 않았다. 빌드가 delta gate에서 실패해도 사용자는 왜 실패했는지 볼 수 없다.

---

## 7. 핵심 우선순위 요약

### Tier 1 — 이것을 고치지 않으면 다른 개선이 의미없음

| 문제 | 영향 | 위치 |
|------|------|------|
| starter asset에 실제 이미지 URL 없음 | composition 렌더러의 모든 이미지 슬롯이 빈 박스 | `data/normalized/asset-pipeline-starter.json` |
| composition CSS가 완전히 고정 | LLM이 생성하는 스타일이 대부분 무시됨 | server.js:`buildHomeHeroRuntimeCss()` |
| `buildTextPatchStyleText()`에 lineHeight/letterSpacing 없음 | typography 품질 천장이 낮음 | server.js:12794 |

### Tier 2 — 구조적 한계, 수정 시 큰 폭 품질 향상

| 문제 | 영향 | 위치 |
|------|------|------|
| 섹션 5개 (ranking, commerce×3, banner)에 단일 레이아웃만 존재 | 전체 페이지의 하단 절반이 항상 동일하게 보임 | server.js:composition renderers |
| Hero 3변형 모두 동일한 2칼럼 구조 | "새 레이아웃"으로 보이지 않음 | server.js:`renderHomeHeroCompositionSection()` |
| theme class들이 CSS rule 없이 선언만 됨 | asset 기반 시각 분기가 무효 | server.js:`buildHomeHeroRuntimeCss()` |

### Tier 3 — 파이프라인 보수성 개선

| 문제 | 영향 | 위치 |
|------|------|------|
| Fix pass temperature 0.1 고정 | 크리틱 실패 후 fix가 아무것도 바꾸지 못함 | llm.js:3829 |
| patchDepth=full 자동 적용 안 됨 | high designChangeLevel에서도 temperature 0.28이 최대 | llm.js:5196 |
| 크리틱에 `assetMissing` 차원 없음 | 이미지 플레이스홀더 상태를 fix loop이 감지 불가 | llm.js:5399 |

---

## 8. 코드별 구체 수정 제안

### 8.1 CSS 동적 주입 — server.js

`buildHomeCompositionSelfContainedStyleTag()`에 인자를 추가해 per-build CSS variable 주입:

```js
function buildHomeCompositionSelfContainedStyleTag(patch = {}, variant = "") {
  const styles = patch.styles || {};
  const overrides = [
    styles.titleSize ? `--codex-title-size: ${normalizeCssSizeValue(styles.titleSize)};` : "",
    styles.titleColor ? `--codex-title-color: ${styles.titleColor};` : "",
    styles.background ? `--codex-section-bg: ${styles.background};` : "",
    styles.lineHeight ? `--codex-line-height: ${styles.lineHeight};` : "",
    styles.letterSpacing ? `--codex-letter-spacing: ${styles.letterSpacing};` : "",
    styles.fontFamily ? `--codex-font-family: ${styles.fontFamily};` : "",
  ].filter(Boolean).join(" ");
  const rootOverride = overrides ? `:root { ${overrides} }` : "";
  return `<style data-codex-composition-style="home">${rootOverride}${buildHomeHeroRuntimeCss()}</style>`;
}
```

그리고 `buildHomeHeroRuntimeCss()` 내부의 하드코딩 값을 CSS variable 참조로 교체:

```css
.codex-home-composition-title {
  font-size: var(--codex-title-size, 46px);
  line-height: var(--codex-line-height, 1.08);
  letter-spacing: var(--codex-letter-spacing, -0.04em);
  font-family: var(--codex-font-family, Arial, sans-serif);
  color: var(--codex-title-color, #111827);
}
```

### 8.2 `buildTextPatchStyleText()` 확장 — server.js:12794

```js
function buildTextPatchStyleText(styles = {}, kind = "title") {
  ...
  const lineHeight = String(nextStyles.lineHeight || "").trim();
  if (lineHeight) styleParts.push(`line-height:${lineHeight}`);
  const letterSpacing = String(nextStyles.letterSpacing || "").trim();
  if (letterSpacing) styleParts.push(`letter-spacing:${letterSpacing}`);
  const fontFamily = String(nextStyles.fontFamily || "").trim();
  if (fontFamily) styleParts.push(`font-family:${fontFamily}`);
  const textTransform = String(nextStyles.textTransform || "").trim();
  if (textTransform) styleParts.push(`text-transform:${textTransform}`);
  ...
}
```

`GENERIC_PATCH_STYLE_KEYS`에도 `lineHeight`, `letterSpacing`, `fontFamily`, `textTransform`을 추가해야 함 (server.js:6892).

### 8.3 Fix pass temperature 조정 — llm.js:3829

```js
// 현재
temperature: 0.1,

// 제안
const failedDimensions = toStringArray(retryTrigger?.failedDimensions);
const isStructuralFail = failedDimensions.some(d => ["hierarchy", "changeStrength", "criticUnavailable"].includes(d));
const fixTemperature = isStructuralFail ? 0.22 : 0.1;
temperature: fixTemperature,
```

### 8.4 theme CSS rule 추가 — server.js:`buildHomeHeroRuntimeCss()`

현재 dead code인 theme class들에 실제 CSS rule 추가:

```css
/* is-premium-contrast: 다크 배경 + 강조 컬러 */
.codex-home-composition--hero.is-premium-contrast {
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
}
.codex-home-composition--hero.is-premium-contrast .codex-home-composition-title {
  color: #f8fafc;
}

/* is-editorial-accent: 에디토리얼 강조 */
.codex-home-composition--hero.is-editorial-accent {
  background: linear-gradient(135deg, #fdf4e7 0%, #fff8f0 100%);
}
```

### 8.5 asset-pipeline-starter.json — 실제 URL 추가

지금 당장 가능한 최소한의 조치: 공개 CDN에서 placeholder 이미지를 각 항목에 추가.

```json
"visualSets": [
  {
    "id": "home-hero-lifestyle",
    "label": "홈 히어로 라이프스타일",
    "usage": ["home.hero"],
    "style": "lifestyle-warm",
    "assets": [
      {
        "assetUrl": "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1440&q=80",
        "dimensions": { "width": 1440, "height": 810, "aspectRatio": "16:9" },
        "format": "webp"
      }
    ]
  }
]
```

이것만 해도 composition hero 렌더러에서 실제 이미지가 출력된다.

---

## 9. 작업 순서 제안

### 즉시 (가장 큰 시각 효과)

1. `asset-pipeline-starter.json`에 실제 이미지 URL 추가 (hero, banner 최소 1개씩)
2. `buildTextPatchStyleText()`에 lineHeight, letterSpacing 추가
3. theme CSS class에 실제 rule 추가 (`is-premium-contrast`, `is-editorial-accent`)

### 단기 (구조 개선)

4. CSS variable 기반 동적 주입 (`buildHomeCompositionSelfContainedStyleTag` 개선)
5. Fix pass temperature 조건부 조정
6. commerce/ranking 섹션에 두 번째 레이아웃 변형 추가

### 중기 (파이프라인 개선)

7. 크리틱에 `assetMissing` 차원 추가
8. admin UI 409 핸들링 수정
9. patchDepth=full 자동 적용 조건 정의

---

## 10. 품질 기준선 정의 (목표)

"웹디자인을 이걸로만으로도 할 수 있을 만큼의 품질"이 의미하는 최소 기준:

| 항목 | 현재 상태 | 목표 |
|------|---------|------|
| 이미지 슬롯 | 빈 박스 | 실제 이미지 또는 맥락에 맞는 placeholder |
| typography | Arial 46px/1.08 고정 | 빌드마다 size/weight/spacing 조정 가능 |
| 레이아웃 | hero 2칼럼 + 하단 4개 단일 | 섹션당 최소 2-3개 레이아웃 변형 |
| 섹션 분위기 | 배경 그라디언트만 다름 | theme class 별 실제 시각 차이 |
| 빌드 → 피드백 → 재빌드 | fix가 거의 변경 없음 | fix가 실패 차원에 맞는 조치 실행 |
