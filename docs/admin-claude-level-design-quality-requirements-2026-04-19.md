# Claude-Level 디자인 품질로 끌어올리기: 현재 구조의 한계와 전환 방향 (2026-04-19)

## 이 문서의 목적

현재 클론 빌더는 "LGE 라이브 HTML을 기반으로, 승인된 Plan을 따라 허용된 슬롯/컴포넌트에만 LLM이 패치를 거는" 구조다. 이 방식으로 만들어진 결과물은 Claude가 직접 디자인한(= 자유 HTML/CSS 생성) 수준의 완성도와 비교했을 때 구조적으로 따라갈 수 없는 천장이 존재한다.

아래 내용은 `server.js` / `llm.js`를 코드 레벨로 점검해서 "왜 품질이 낮을 수밖에 없는가"를 증거와 함께 정리하고, 그 천장을 뚫기 위해 **(A) 현재 구조 보강** 과 **(B) 구조 자체 교체** 두 트랙을 제시한다. 사용자가 "아예 바꿔도 된다"고 명시했기 때문에 최종 추천은 B 쪽에 가깝다.

---

## 1. 현 구조의 디자인 자유도 지도

### 1.1 LLM이 **실제로 출력할 수 있는 것**

Builder가 허용된 operation (llm.js:2891):

```
replace_component_template, update_component_patch,
update_slot_text, update_hero_field,
update_slot_image, update_page_title
```

그 중 실제 스타일을 움직이는 건 `update_component_patch` 뿐이고, 그 바디는 다시 `GENERIC_PATCH_ROOT_KEYS` + `GENERIC_PATCH_STYLE_KEYS` (server.js:6881, 6892) 에만 바인딩된다.

#### 현재 스타일 키 27종 (server.js:6892)

```
background, radius, height, minHeight,
borderColor, borderWidth, borderStyle, boxShadow,
padding, opacity,
titleColor, subtitleColor,
titleWeight, subtitleWeight,
titleSize, subtitleSize,
titleLineHeight, subtitleLineHeight,
titleLetterSpacing, subtitleLetterSpacing,
titleFontFamily, subtitleFontFamily,
titleTextTransform, subtitleTextTransform,
titleFontStyle, subtitleFontStyle,
textAlign
```

이 키 집합이 현재 "LLM이 디자인으로 말할 수 있는 전체 어휘"다. 즉 LLM은:

| 가능 | 불가능 |
| --- | --- |
| 섹션 배경색 바꾸기 | 섹션 내부 그리드 재배치 |
| 라운드/보더/그림자 | display/grid/flex 제어 |
| 패딩 조절 | gap / column / row 제어 |
| 제목/부제 타이포 (폰트/크기/행간/자간/굵기/대소문자/기울임) | 레이아웃 재설계 |
| 텍스트 정렬 | 요소 순서/DOM 구조 변경 |
| 이미지 URL 교체 | 새 컴포넌트 삽입 |
| 텍스트 copy 변경 | z-index / position 컨트롤 |
|  | 가상 요소(::before/::after) |
|  | 미디어 쿼리 / 반응형 |
|  | 모션/트랜지션/호버 |
|  | 색조 팔레트 / 테마 |
|  | 타입 스케일 / 리듬 |

`buildSectionPatchStyleText()` (server.js:12816) 와 `buildTextPatchStyleText()` (server.js:12846)도 위 27키를 CSS로 풀어주는 어댑터일 뿐이고, 생성된 값은 전부 **인라인 style 문자열**로 섹션 바깥 태그 하나에만 붙는다.

**결론**: LLM 입장에서 '디자인한다'는 행위는 사실상 "카드/섹션 하나의 껍데기 색·라운드·여백과 제목/부제 타이포를 바꾸는 것"에 수렴한다. 클로드가 직접 생성하는 디자인이 "**레이아웃 + 리듬 + 모션 + 반응형 + 색체계 + 타입 시스템**" 전체를 다루는 것과 비교하면, 어휘 자체가 한 자리수 %에 불과하다.

---

### 1.2 렌더러가 **받아서 만들 수 있는 것**

Composer/Builder가 `composition.templateId`를 고르면 `resolveHeroTemplateVariant()` (server.js:10598) 등이 이를 5가지 하드코딩 분기로 매핑한다:

- hero: `carousel / editorial / premium-stage / centered / stacked` (server.js:11195)
- quickmenu: `grid / panel / editorial-strip` (server.js:14047-14053)
- 나머지 슬롯(md-choice, timedeal, best-ranking, recommend, ad-banner, promotion, …): 단일 변형

`renderHomeHeroCompositionSection()` (server.js:11180~11360) 내부를 보면 분기가 아예 **JS 템플릿 리터럴로 HTML을 직접 concat**한다:

```js
${usePremiumStageVariant ? `
  <div class="codex-home-composition-hero-premium-stage">
    <article class="codex-home-composition-hero-premium-main">...</article>
    <div class="codex-home-composition-hero-premium-stack">...</div>
  </div>
` : useCenteredVariant ? `...`
  : useStackedVariant ? `...`
  : useEditorialVariant ? `...`
  : `기본 carousel ...`}
```

즉 "새로운 히어로 구성"이 필요해도 LLM은 **기존 5개 중 하나를 고르는 것**밖에 못 한다. 진짜 새로운 배치를 하려면 `server.js`에 새 variant 브랜치를 사람이 추가해야 한다.

---

### 1.3 CSS가 **실제로 나가는 채널**

`buildHomeCompositionSelfContainedStyleTag()` (server.js:11083)

```js
function buildHomeCompositionSelfContainedStyleTag() {
  return `<style data-codex-composition-style="home">${buildHomeHeroRuntimeCss()}</style>`;
}
```

이 `buildHomeHeroRuntimeCss()` 리턴 값은 **완전히 고정된 문자열**이다. 빌드마다 다르게 생성되는 부분은 없다. 즉:

- **디자인 토큰이 주입되지 않는다** — `:root { --codex-home-lower-width: ... }` (server.js:18149) 정도로 3개 변수만 있고, 이것도 라이브 HTML 호환용 위치 값이지 색/폰트/스페이싱/타입스케일 토큰이 아니다.
- **타이포가 완전히 하드코딩** — composition CSS 내부에 `font: 700 16px/1.4 Arial, sans-serif`, `font: 700 11px/1 Arial, sans-serif` 같은 라인이 반복 (server.js:14073, 14094, 14106 등). 전체 `server.js`에 `Arial` 문자열이 88회 등장, `Arial, sans-serif` 만 74회. LLM이 `titleFontFamily`로 다른 폰트를 지정해도 그건 section top 의 `.codex-home-composition-title` 한 군데 인라인 style일 뿐, 카드/배지/소제목/CTA/쿼이크메뉴 레이블은 전부 Arial 로 남는다.
- **웹폰트 파이프라인이 없다** — `@font-face`, Inter, Pretendard, Noto Sans, `font-display`가 전부 0회. Claude 디자인에서 당연한 "디스플레이 폰트 + 본문 폰트 이중 구성, 서브셋 로딩" 이 아예 없음.

---

### 1.4 모션/인터랙션 시스템

composition CSS 전체에서:

- `transition:` 1회 — `.codex-home-composition-quickmenu-card` (server.js:14065)
  ```
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
  ```
- `:hover` 규칙 1회 — 같은 카드 (server.js:14067)
- `@keyframes` 0회, `animation:` 0회, `will-change` 0회
- `prefers-reduced-motion` 0회
- `prefers-color-scheme` 0회 (다크모드 없음)
- `@supports` 0회, `container-type` / container query 0회

LLM 쪽에서도 motion/animation/transition을 생성할 수 있는 키가 아예 없다(§1.1 표). Claude가 생성하는 디자인이 hover/focus/scroll-linked/reduced-motion-aware를 기본 포함하는 것과 대비되어, 현 출력은 "정지된 포스터"에 가깝다.

---

### 1.5 반응형

composition CSS의 미디어 쿼리:

- `@media (max-width: 1180px)` 1군데 (server.js:14352)
- `@media (max-width: 900px)` 2군데 (server.js:11170, 14369)
- `@media (max-width: 640px)` 1군데 (server.js:14397)

그리고 이 쿼리들이 담당하는 건 주로 쿼이크메뉴 grid column 감소, hero stack 재정렬 정도로 **단일-단편적**이다. LLM이 뷰포트 프로파일(pc/ta/mo)을 바꿔서 각각 별도로 생성하는 식인데, 이는 "한 결과물이 모든 너비에 반응"하는 fluid design 과는 다른 접근이다. 그 결과:

- 768-900 사이 브레이크포인트에서 어색한 구간이 남음
- 컨테이너 기반 반응형 불가(container query 0회)
- 정적 `min-height` 기반 스케일 (e.g. `.codex-home-composition-quickmenu-card { min-height: 188px }`) — 콘텐츠 길이에 따라 카드가 밀리거나 리듬이 깨짐

---

### 1.6 Classic (라이브 HTML) 패치 경로

`applyHomeHeroPatch()` 계열은 실제 LGE 라이브 HTML 문자열에 **정규식**으로 style/text를 끼워 넣는다 (server.js:12897 `styleFirstPattern`, 12914 `replaceFirstTextMatch`). 즉:

- 라이브 HTML의 DOM 트리를 재구성하거나 (span/div 추가, 순서 교환) 하지 못함
- 새로운 class / data attribute 삽입 불가
- 결국 "있는 자리에 색·여백·문구를 바꿔치기"만 가능

composition 경로도 결국은 위의 한정된 27키 + 고정 템플릿 variant 안에서만 "재구성"되므로, classic/composition 어느 쪽이든 "진짜 재디자인"은 아니다.

---

### 1.7 Critic 차원

`normalizeVisualCriticResult()` (llm.js:5490) 이 판정하는 5축:

```
hierarchy, alignment, referenceAlignment, brandFit, changeStrength
```

빠진 차원:

- **typographicHarmony** (폰트 페어링, 타입 스케일 일관성)
- **colorHarmony** (팔레트 모듈, 대비, 접근성)
- **spacingRhythm** (8pt grid 일치, 리듬 일관성)
- **motionDesign** (트랜지션 유무/일관성)
- **responsiveness** (여러 뷰포트에서의 동일 평가)
- **accessibility** (대비비, 텍스트 크기, 키보드/포커스)
- **density / negativeSpace** (정보 밀도, 공백 배분)
- **visualRhythm / focusPath** (시선 유도, 리드라인)
- **assetFidelity** (이미지 크롭·품질)

→ 즉 **높은 Critic 점수** ≠ **Claude-level 품질**. 현 Critic은 "이전보다 강해졌는가 + 레퍼런스에서 너무 안 벗어났는가"에 편향되어 있다.

---

## 2. Claude-level 디자인이 '기본값으로 깔고 있는 것'과의 격차

다음은 Claude가 웹페이지를 즉시 프로덕션에 올릴 만큼으로 생성할 때 기본적으로 가지고 있는 요소다. 옆에 우리 현 구조에서의 상태를 표시한다.

| 영역 | Claude가 기본 생산 | 현 빌더 상태 | 상태 |
| --- | --- | --- | --- |
| **디자인 토큰** | color / spacing / type-scale / radius / shadow / z-index 스케일을 CSS custom property 로 루트 주입 | 위치용 3개 토큰만 존재 (server.js:18149) | ❌ 부재 |
| **타입 시스템** | Display + Text 2-폰트 페어링, 모듈러 스케일 (1.125~1.333), fluid clamp() | Arial 고정, 크기만 px 인라인 | ❌ 부재 |
| **웹폰트 파이프라인** | @font-face + font-display:swap + subset | 전무 | ❌ 부재 |
| **색 시스템** | semantic(surface/on-surface/accent) + tonal scale + 대비 검증 | hex 인라인, #111827/#1f2937 등 하드코딩 | ❌ 부재 |
| **스페이싱 리듬** | 4/8pt grid, token 단위 padding/margin | px 값 산개, 토큰 없음 | ❌ 부재 |
| **레이아웃 프리미티브** | Stack / Cluster / Grid / Center / Frame 등 recipe CSS class | 슬롯별 하드코딩 HTML | ❌ 부재 |
| **모션 기본값** | hover / focus / transition + prefers-reduced-motion | `transition` 1회, hover 1회 | ❌ 거의 부재 |
| **반응형 전략** | fluid clamp + container query + 3~5 breakpoint | 3 breakpoint, 컨테이너 쿼리 0회 | ⚠ 매우 약함 |
| **다크모드** | prefers-color-scheme + 토큰 스왑 | 0회 | ❌ 부재 |
| **접근성** | WCAG AA 대비, focus-visible, aria-* | 표준 대응 없음 | ❌ 부재 |
| **상태 디자인** | empty / loading / hover / focus / disabled / error | hover 1개, 나머지 부재 | ❌ 부재 |
| **일러스트/아이콘 시스템** | SVG sprite + currentColor 토큰화 | PNG URL 치환 위주 | ⚠ 약함 |
| **콘텐츠 보이스** | 에디토리얼 헤드라인 + 마이크로카피 레이어 | 단문 치환 중심 | ⚠ 약함 |
| **레이어/그림자 시스템** | elevation token (0~5) | 한 줄 box-shadow 개별 정의 | ❌ 부재 |
| **미세 디테일** | divider, accent line, kicker, eyebrow, meta row | 카드 내부 1~2 요소만 | ⚠ 약함 |

현재의 보강(Codex 작업으로 추가된 5개 hero variant, 3개 quickmenu variant, 9개 타이포 패치 키 등)은 **Claude가 당연히 가지는 15+ 영역 중 "타이포 중 일부"와 "레이아웃 템플릿 중 일부"에만** 해당된다. 품질 천장이 낮은 근본 이유가 여기에 있다.

---

## 3. 트랙 A — 현 구조를 유지하며 보강한다

허용된 operation 집합을 유지하면서 품질 천장을 1단계 올리는 최소 패키지. 단, 이걸로 Claude-level 까지 가기는 어렵다(천장이 여전히 27키 + 하드코딩 템플릿이다).

### A-1. 디자인 토큰 레이어 주입 (필수)

현재 `buildHomeCompositionSelfContainedStyleTag()` (server.js:11083) 가 반환하는 style 태그 맨 앞에 `:root { --ct-color-*, --ct-space-*, --ct-type-*, --ct-shadow-*, --ct-radius-* ... }` 블록을 주입하고, 모든 하드코딩된 `#111827` / `Arial, sans-serif` / `16px` 값을 `var(--ct-*)` 로 치환한다.

그러고 나면:

- Composer 결과의 `composition.styleContract.tokenHints` 를 실제 `:root` override 로 바꿔 빌드마다 팔레트/폰트를 스왑할 수 있다.
- LLM 스키마에 `tokenOverrides` (object of allowlisted tokens) 를 추가하면 색/폰트 전환이 composition CSS 전체에 번진다.

### A-2. 패치 키 어휘 2배 확장

`GENERIC_PATCH_STYLE_KEYS` (server.js:6892) 에 레이아웃/모션 어휘를 추가:

```
gap, columnGap, rowGap,
gridTemplateColumns (토큰 프리셋 enum),
alignItems, justifyItems, justifyContent,
accentColor, dividerColor,
transitionPreset (none | subtle | standard | bold),
hoverLift (none | sm | md | lg),
shadowElevation (0..5),
surfaceTone (neutral | warm | cool | inverse | accent),
density (comfortable | default | compact)
```

각 키를 `buildSectionPatchStyleText()` / `buildTextPatchStyleText()` 에서 CSS로 풀되, **값은 자유 문자열이 아니라 토큰 enum만 허용**해서 깨진 CSS가 나오지 않게 한다. `normalizeCssInlineValue()` 처럼 sanitizer를 통과한 것만 방출.

### A-3. Critic 차원 확장

`normalizeVisualCriticResult()` (llm.js:5495) 에 다음 4축 추가:

- `typographicHarmony` (threshold 75)
- `motionPresence` (threshold 65)
- `responsiveFit` (threshold 75)
- `spacingRhythm` (threshold 70)

Fix 패스 프롬프트(llm.js:3800)에도 실패 축별 수리 지침을 추가. 현재는 "hierarchy/alignment/change strength" 위주라서 타이포/모션 측면은 평가를 안 받는다.

### A-4. 모션 프리셋

composition CSS 맨 끝에 프리셋 3종을 상수로 넣고 LLM이 `transitionPreset`/`hoverLift` 로 선택:

```
.ct-transition-subtle { transition: ... 120ms ease; }
.ct-transition-standard { transition: ... 200ms cubic-bezier(.2,.8,.2,1); }
.ct-transition-bold { transition: ... 320ms cubic-bezier(.2,.8,.2,1); }
.ct-hover-lift-sm:hover { transform: translateY(-2px); ... }
.ct-hover-lift-md:hover { transform: translateY(-4px); ... }
```

`@media (prefers-reduced-motion: reduce) { .ct-transition-* { transition: none; } }` 도 기본 포함.

### A-5. 반응형 clamp 기본화

히어로/쿼이크메뉴의 `font-size`, `padding`, `gap` 의 하드코딩 px 를 `clamp(min, fluid, max)` 로 교체. 3 breakpoint 에 의존하지 않고도 자연스럽게 스케일.

**트랙 A 한계**: LLM이 여전히 "껍데기 값"을 고르는 역할이다. DOM 구조/컴포넌트 배치 자체를 새로 짜지는 못하므로, 결과물의 전반적 "구성적 참신함"은 제한된다. Claude-level의 70~80% 정도가 현실적 상한.

---

## 4. 트랙 B — 렌더러 구조를 교체한다 (추천)

### 4.1 한 문장 요약

**"하드코딩 템플릿 분기 + 27키 패치"** 를 버리고, **"LLM이 제약된 JSX-DSL(또는 HTML+class) 을 생성하고, 서버가 그걸 토큰/유틸리티 CSS 레이어 안에서 안전 렌더링"** 하는 구조로 간다.

핵심 아이디어는 **자유도는 DOM/레이아웃 수준으로 올리고, 안전성은 "허용된 class/토큰/컴포넌트 primitive" 로 가둔다**는 것. 이것이 Claude가 직접 생성할 때 가지는 자유와 같은 범주다.

### 4.2 구조 청사진

#### (1) Token Core (서버 측 상수)

```js
const TOKEN_CORE = {
  color: { surface: {...}, on: {...}, accent: {...}, border: {...} },
  space: { 0:0, 1:"4px", 2:"8px", ..., 12:"96px" },
  radius: { none:0, sm:"6px", md:"12px", lg:"24px", pill:"9999px" },
  shadow: { 0:"none", 1:"...", 2:"...", 3:"...", 4:"...", 5:"..." },
  type: {
    display: { font:'"Inter Display", Pretendard, ...', scale:[64,56,48,40,32] },
    text:    { font:'"Inter", Pretendard, ...',         scale:[18,16,14,13,12] }
  },
  motion: { subtle:{dur:120,ease:"ease"}, standard:{dur:200,ease:"..."}, bold:{dur:320,ease:"..."} }
};
```

이 토큰이 `:root { --ct-* }` 로 직렬화되어 모든 composition CSS의 단일 소스가 된다.

#### (2) Component Primitive Kit (서버 측 허용된 building block)

최대 20~30개의 구조 primitives:

```
Stack, Cluster, Grid, Center, Frame, Cover,
Section, Container, Split, Switcher,
Card, CardMedia, CardBody,
Kicker, Eyebrow, Title, Subtitle, Body, Meta,
Badge, Chip, Pill, Divider,
Button (primary/secondary/ghost),
Media (img + aspect),
IconSlot, MetricStat,
AccentLine, Overlay
```

각 primitive 는 **(a) 허용된 prop enum** (size, tone, density, align…) + **(b) children 허용 규칙** 으로 정의. React 를 서버에서 써도 되고, 그냥 HTML string template 함수로 구현해도 된다.

#### (3) Composition DSL

LLM이 JSON Tree 로 구성을 뱉는다:

```json
{
  "type": "Section",
  "props": { "tone": "accent-soft", "padding": "lg", "align": "start" },
  "children": [
    { "type": "Container", "props": { "width": "wide" }, "children": [
      { "type": "Grid", "props": { "cols": "12", "gap": "6" }, "children": [
        { "type": "Stack", "props": { "span": "7", "gap": "3" }, "children": [
          { "type": "Eyebrow", "props": { "tone": "accent" }, "children": ["LG Living Edit"] },
          { "type": "Title", "props": { "size": "display-1", "weight": "700" }, "children": [...] },
          { "type": "Body", "props": { "size": "lg", "tone": "muted" }, "children": [...] },
          { "type": "Cluster", "props": { "gap": "2" }, "children": [
            { "type": "Button", "props": { "variant": "primary", "href": "..." }, "children": ["자세히 보기"] },
            { "type": "Button", "props": { "variant": "ghost" }, "children": [...] }
          ]}
        ]},
        { "type": "Media", "props": { "span": "5", "assetId": "home__0e54...__005", "aspect": "4/5", "radius": "lg", "shadow": "3" }}
      ]}
    ]}
  ]
}
```

#### (4) Safe Renderer

서버에서 이 트리를 순회:

- `type` allowlist 외엔 탈락
- `props` 는 primitive별 허용 enum 외엔 탈락
- `assetId` 는 `assetPipelineStarter.assetCatalog` 에 실존하는지 확인, 없으면 교체 또는 fallback
- children 깊이/개수 상한 (e.g. depth≤8, children≤24)
- 문자열은 기존 `escapeHtml` 처리

출력은 **토큰 var 참조가 박힌 HTML + 동봉된 `<style>` (토큰 :root + primitive utility class)**. 인라인 style 남용이 사라진다.

#### (5) Utility CSS Layer

primitive들은 `.ct-stack[data-gap="3"]`, `.ct-grid[data-cols="12"][data-gap="6"]`, `.ct-title[data-size="display-1"]` 같은 attribute selector 기반 유틸리티로 구성. LLM이 DOM 배치를 선택하고, CSS는 이미 엄밀히 짜여 있다 → **자유도와 안전성 동시 확보**.

#### (6) Critic 업그레이드

트리 자체도 평가 가능:

- "Grid 12col 안에서 7/5 분할은 hierarchy 77점"
- "Cluster 안 Button primary가 2개라 focusPath 혼잡 -12"
- "Media aspect 4/5 + shadow 3 은 elevation 일관성 +8"

Visual Critic(스크린샷)과 Structural Critic(트리 분석)을 둘 다 돌리고, 실패 축별로 Fix 패스에서 트리 부분 서브트리만 재생성.

### 4.3 단계별 이행 경로

> **중요**: Big-bang 교체는 하지 않는다. 슬롯 단위로 점진 전환한다.

| 단계 | 범위 | 산출물 |
| --- | --- | --- |
| **B-0. Token Core 도입** | 서버 상수 + `:root` 주입 | 기존 하드코딩 값 점진 교체, 화면 변화 없음 |
| **B-1. Primitive Kit v1** | Stack/Cluster/Grid/Center/Title/Body/Button/Media 등 10~12종 | 단위 테스트: 각 primitive의 허용 prop / 생성 HTML snapshot |
| **B-2. 1개 슬롯 파일럿** | `hero` 만 DSL 렌더러로 교체. 기존 5 variant 하드코딩 삭제 | Composer → DSL tree → Renderer, admin preview에서 기존과 A/B |
| **B-3. Critic 이원화** | Structural Critic 추가 | Fix 루프가 트리 서브 노드만 재생성하게 연결 |
| **B-4. 확장** | quickmenu, md-choice, timedeal, best-ranking 순차 전환 | 각 전환마다 기존 경로와 병렬 유지 |
| **B-5. Classic 정규식 경로 은퇴** | `applyHomeHeroPatch()` 계열 deprecate | 라이브 HTML도 DSL → `sectionRegistry` 기반으로 재렌더링 |
| **B-6. 모션/반응형 시스템화** | primitive 기본에 transition preset + clamp + container query 포함 | 모든 출력이 hover/reduced-motion/fluid 기본 포함 |
| **B-7. 다크모드 토큰 스왑** | `:root[data-theme="dark"]` 브랜치 | 테마 스위치 지원 |

### 4.4 트랙 B의 장점

- **LLM의 디자인 어휘가 "27키 CSS 프로퍼티" → "구조 primitive + 토큰 enum + 콘텐츠"로 점프**. 이게 Claude가 자유 생성할 때 사용하는 어휘와 같은 차원.
- Composer/Builder/Fix 가 같은 트리에 대해 서브트리 수정으로 대화하므로 **복잡한 재구성도 안전하게 반복 가능**.
- 토큰 단일 소스이므로 **브랜드/계절/테마/다크모드 일괄 전환** 가능.
- Critic이 스크린샷 외에 **구조 자체를 평가**하므로 Fix 피드백이 훨씬 정확.
- 유틸리티 CSS를 한 번만 잘 짜두면 **품질 bottom line이 고정적으로 올라간다**. 현 구조처럼 variant별 CSS가 난립하지 않음.
- LGE live HTML 의존에서 **조금씩 독립** 가능 — 원본 HTML 위에 덮어쓰는 게 아니라, sectionRegistry 기반으로 재렌더링하는 길이 열린다.

### 4.5 트랙 B의 리스크 / 완화

- **새 어휘를 LLM이 습득해야 함** → DESIGN.md 수준의 "Primitive Cheat Sheet"를 Builder 시스템 프롬프트(llm.js:2861)에 로드. 각 primitive 예시 3개씩.
- **LLM이 헛소리 tree를 뱉을 수 있음** → Safe Renderer에서 allowlist 검증 후 탈락시키고 fallback primitive로 대체, 그 사실을 `missingCapabilities` 에 기록.
- **초기 Primitive Kit 누락이 품질 저하를 만듦** → B-2 파일럿에서 "이 구성을 하려면 새 primitive가 필요" 로그를 모아 Kit v2 스펙 입력.
- **기존 라이브 HTML 호환 깨짐** → 트랙 B는 composition 경로에서만 돌고, 당분간 classic 경로는 유지. B-5 단계에서만 교체.
- **개발 비용** → B-0 ~ B-2가 대략 첫 2~3 주 분량. 그 다음부터는 슬롯당 2~4일.

---

## 5. 우선순위 권고 (주 단위)

| 주차 | 작업 | 트랙 |
| --- | --- | --- |
| W1 | Token Core 상수 정의 + `:root` 주입 + 기존 `Arial, sans-serif` / hex 상수 절반을 var 치환 | B-0 (A-1 겸용) |
| W1-W2 | Critic 4축 추가 + Fix 지침 업데이트 (llm.js:3800, 5495) | A-3 (저비용 즉시 효과) |
| W2 | Primitive Kit v1 구현 + snapshot test | B-1 |
| W3 | Hero 슬롯을 DSL 렌더러로 교체, admin에서 기존 variant 와 A/B 비교 | B-2 |
| W3-W4 | 모션 프리셋 + prefers-reduced-motion + fluid clamp 기본값 | A-4, B-6 일부 |
| W4 | quickmenu 슬롯 DSL 전환 | B-4 |
| W5+ | 나머지 슬롯 전환, Classic 경로 은퇴 검토 | B-4, B-5 |

**즉시(이번 주) 해야 안 아픈 것**: Token Core + Critic 4축 추가. 이 둘만 해도 Critic 피드백 품질과 색/타이포 일관성이 눈에 띄게 개선된다.

---

## 6. 의사결정 요청

1. **트랙 B(렌더러 교체) 로 가는 것에 동의하는가?** (사용자가 "아예 바꿔도 된다"고 명시했지만 공식 승인 필요)
2. **파일럿 슬롯을 hero로 할지, 더 위험도 낮은 md-choice 로 할지?** (권고: hero — 가장 눈에 띄고, 이미 5 variant 있어서 비교 A/B 가 가능)
3. **Primitive Kit v1 초도 범위를 10종으로 할지 20종으로 할지?** (권고: 12종 — Stack, Cluster, Grid, Center, Section, Container, Title, Body, Eyebrow, Button, Media, Badge)
4. **Critic 차원 threshold 는 기존과 동일 75/70으로 맞출지?** (권고: 동일 시작, 튜닝은 실사용 후)

위 네 가지만 정해지면 W1 작업부터 구체 패치 목록으로 이어서 문서화 가능.

---

## 부록 A — 증거 인덱스

| 주장 | 코드 위치 |
| --- | --- |
| 허용 operation 6종 | llm.js:2891 (`buildBuilderSystemPrompt`) |
| 패치 스타일 키 27종 | server.js:6892 (`GENERIC_PATCH_STYLE_KEYS`) |
| Section 패치 CSS 어댑터 | server.js:12816 (`buildSectionPatchStyleText`) |
| Text 패치 CSS 어댑터 | server.js:12846 (`buildTextPatchStyleText`) |
| Hero variant 5종 하드코딩 분기 | server.js:11180~11360 (`renderHomeHeroCompositionSection`) |
| Composition CSS가 정적 | server.js:11083 (`buildHomeCompositionSelfContainedStyleTag`) |
| Arial 하드코딩 | server.js 전역 74회 `Arial, sans-serif` |
| 토큰 변수 3개뿐 | server.js:18149 (`:root`) |
| 트랜지션 1개 | server.js:14065 |
| hover 1개 | server.js:14067 |
| 미디어 쿼리 4개 | server.js:11170, 14352, 14369, 14397 |
| Critic 5축 | llm.js:5495 (`normalizeVisualCriticResult`) |
| Fix 패스 온도 로직 | llm.js:3838~3862 |
| Classic 정규식 스타일링 | server.js:12897 (`styleFirstPattern`) |
| Classic 텍스트 교체 | server.js:12914 (`replaceFirstTextMatch`) |

## 부록 B — 관련 기존 문서

- `docs/admin-design-quality-root-cause-analysis-2026-04-19.md` — 5 카테고리 × 3 tier 로 품질 근본 원인 분석 (본 문서의 선행)
- `docs/admin-asset-pipeline-architecture-options-2026-04-19.md` — 에셋 파이프라인 옵션 3종
- `docs/admin-asset-pipeline-architecture-supplement-2026-04-19.md` — 위 옵션 문서의 7 gap 보강
