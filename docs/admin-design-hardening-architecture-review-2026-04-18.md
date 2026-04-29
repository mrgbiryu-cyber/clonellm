# Admin Design Hardening - Architecture Review

Date: 2026-04-18
Owner: Codex / mrgbiryu alignment draft
Status: Analysis document — code review + external technology assessment

Related documents:

- [admin-design-hardening-code-status-2026-04-18.md](/home/mrgbiryu/clonellm/docs/admin-design-hardening-code-status-2026-04-18.md)
- [admin-builder-visual-architecture-2026-04-17.md](/home/mrgbiryu/clonellm/docs/admin-builder-visual-architecture-2026-04-17.md)

---

## 1. Review Purpose

This document answers three questions:

1. 현재 디자인 강화 방향이 맞는가?
2. 실제 코드가 제대로 된 웹 디자인 출력을 만들 수 있는가?
3. 더 나은 외부 기술이 있는가?

---

## 2. Architecture Direction Assessment

### 2.1 방향이 맞는 부분

현재 아키텍처 문서가 정의한 방향은 원칙적으로 올바르다.

- Planner → Composer → Detailer → Renderer → Visual Critic 5단계 분리: 맞다
- 구조 교체 정책 (element patch / component replace / group replace / page replace): 맞다
- screenshot 기반 visual critic: 맞다
- reference screenshot anchor 주입: 맞다
- fix pass 분리: 맞다

방향 자체가 틀린 것이 아니라, **코드 구현이 아직 그 방향에 도달하지 못한 것**이 문제다.

### 2.2 방향이 약한 부분

다음 세 가지는 아키텍처 문서에 명시되어 있으나 근본적으로 더 강한 접근이 필요하다:

1. **CSS 전달 방식**: 현재 class-only 방식은 불안정하다. 아키텍처 문서에 "scoped style execution"이 언급되어 있으나 실제 구현 기준이 없다.
2. **Retry 반복 횟수**: 문서는 "targeted refinement"를 요구하지만 현재 코드는 1회 fix pass만 실행한다.
3. **Cross-slot 스타일 조율**: 문서에는 없는 개념이나, 실제로 섹션 그룹 디자인을 강하게 만들려면 반드시 필요하다.

---

## 3. Code-Level Findings

### 3.1 실제 출력 HTML/CSS 품질

렌더러 함수들(`renderHomeHeroCompositionSection`, `renderHomeQuickmenuCompositionSection` 등)은 다음과 같은 구조를 생성한다:

```html
<section class="codex-home-composition--hero is-editorial">
  <div class="codex-home-composition-shell">
    <div class="codex-home-composition-hero-stage">
      <div class="codex-home-composition-copy">
        <span class="codex-home-composition-badge" style="display:inline-flex;...">제안</span>
        <h2 class="codex-home-composition-title" style="font-size:32px;...">타이틀</h2>
        <p class="codex-home-composition-description">...</p>
        <div class="codex-home-composition-actions">
          <a class="codex-home-composition-primary" href="#">자세히 보기</a>
        </div>
      </div>
    </div>
  </div>
  <style>
    .codex-home-composition { /* 150+ rules */ }
  </style>
</section>
```

이 구조 자체는 괜찮다. 문제는 아래에 정리한다.

### 3.2 Critical Weakness: CSS 전달 신뢰성

**심각도: 높음**

렌더러는 class-only 스타일링에 주로 의존한다:

```html
<h2 class="codex-home-composition-title">타이틀</h2>
```

inline style fallback 없이 `.codex-home-composition-title` CSS 클래스만 존재한다.
렌더링 컨텍스트(iframe, standalone preview)에서 `<style>` 태그가 정상 주입되지 않으면 전체 스타일이 사라진다.

**현재 어떻게 작동하는가:**

- `<style>` 태그를 컴포넌트 HTML 내부에 함께 삽입한다
- 동일 페이지에서는 작동한다
- iframe의 `src=URL` 방식에서는 백엔드가 전체 페이지를 정상 서빙해야만 작동한다

**위험 시나리오:**

- 네트워크 중단 → iframe 빈 화면
- 서버 응답 지연 → 스타일 없는 HTML만 보임
- 독립 컨텍스트에서 컴포넌트 단독 렌더링 → 스타일 유실

### 3.3 Critical Weakness: 구조 변경 불가

**심각도: 매우 높음**

Builder가 실행할 수 있는 operation은 다음으로 제한된다:

- `update_component_patch`
- `update_slot_text`
- `update_hero_field`
- `update_slot_image`
- `update_page_title`

그리드 컬럼 수 변경, flex 방향 변경, 요소 순서 변경, 요소 추가/제거 같은 **구조 변경 operation이 없다**.

**결과:**

Composer가 "multi-slot coordination"이나 "section-group redesign"을 설계해도,
Builder가 실행할 수 없으면 `report.compositionPlan` JSON 문서로만 기록되고 실제 렌더링에는 반영되지 않는다.

코드 내부 주석 수준의 동작:

```
Composer: "Hero + Quickmenu 전체를 재구성해야 한다"
Detailer: "실행할 operation이 없다. report에 기록만 한다"
Renderer: "기존 DOM에 text/style patch만 적용한다"
Result: 원본과 시각적으로 거의 동일한 출력
```

이것이 "디자인이 약하다"는 핵심 원인이다.

### 3.4 Weakness: Style 병합 fragility

**심각도: 중간**

style 병합은 string concatenation 방식이다:

```javascript
// 현재 코드 패턴
`${existingStyle};${newStyleText}`
```

- `color:red;color:blue` 같은 중복 속성이 발생할 수 있다
- 브라우저는 마지막 값을 적용하지만 코드 레벨 예측이 어렵다
- escape 처리 이후 merge하면 이중 escape 위험이 있다

### 3.5 Weakness: Visual Critic fallback

**심각도: 중간**

Visual Critic이 타임아웃되거나 실패하면:

```javascript
// fallback 동작
scores: { hierarchy: 70, alignment: 70, referenceAlignment: 70,
          brandFit: 70, changeStrength: 70 }
```

모든 점수가 70으로 고정된다. 통과 임계값(대부분 70~75)을 가까스로 통과하거나 통과로 처리된다.
**실제 비주얼 검증 없이 통과**하는 경로가 존재한다.

### 3.6 Weakness: Retry 1회 제한

**심각도: 낮음~중간**

현재 코드:

```javascript
if (retryTrigger?.shouldRetry) {
  const fixResult = await handleLlmFix(...);
  // 완료 - 2차 retry 없음
}
```

fix pass가 1회 실행 후 끝난다. fix 후에도 critic 기준을 통과하지 못하면 수동 개입이 필요하다.

### 3.7 Weakness: Cross-slot 스타일 조율 없음

**심각도: 중간**

각 슬롯은 독립 patch로 처리된다. 예를 들어:

- Hero + Quickmenu + Ranking을 동일한 색상 테마로 통일하려면
- 3개 슬롯에 각각 별도 operation이 필요하다
- CSS variable injection이나 테마 토큰 한 번 적용 → 전체 반영 메커니즘이 없다

### 3.8 Weakness: Responsive 처리 방식

**심각도: 중간**

Mobile / PC 뷰포트는 별도 패치 상태로 처리된다. media query 기반 반응형이 아니다.

- 렌더러 함수: `renderHomeHeroCompositionSection(..., viewportProfile = "pc")`
- 이미지: `<img src=...>` (srcset, sizes 없음)
- Mobile redesign은 PC redesign과 별도 빌드 패스가 필요하다

---

## 4. 현재 코드 vs 아키텍처 문서 Gap

| 항목 | 문서 목표 | 코드 실제 상태 |
|------|-----------|---------------|
| Composer / Detailer / Fix 분리 | 완료 목표 | **구현됨** |
| Visual Critic (multimodal) | 완료 목표 | **구현됨, 단 fallback 취약** |
| Component composition renderer | 완료 목표 | **일부 구현 (Hero, Quickmenu 등)** |
| Group composition renderer | 필요 | **미구현** |
| Page composition renderer | 필요 | **미구현** |
| Scoped style execution | 필요 | **일부 (inline style 일부 적용, class-only 병용)** |
| Structural operation (layout change) | 암묵적으로 필요 | **미구현 — 가장 큰 gap** |
| Cross-slot style coordination | 문서에 없음 | **미구현 — 추가 필요** |
| Responsive (media query) | 문서에 없음 | **미구현** |
| Retry loop (다중) | 문서에 있음 | **1회만 구현** |
| Hard visual delta gate | 미완료 | **미구현** |
| Asset pipeline depth | 부분 | **starter 수준** |

---

## 5. 외부 기술 검토

### 5.1 현재 접근 방식과 비교 대상

현재 시스템은 다음 방식으로 동작한다:

- LLM이 JSON operation 목록을 출력
- 서버가 operation을 DOM에 적용
- 결과를 screenshot으로 critic

이 방식의 한계와 대안을 검토한다.

### 5.2 CSS-in-JS / Style Injection 기술

**현재 문제:** class-only 스타일, CSS 전달 불안정

**더 나은 접근:**

#### Option A: Self-contained HTML (추천)

렌더러가 `<style>` 태그를 항상 컴포넌트 HTML 내부에 포함하고,
모든 critical style을 inline으로도 함께 주입한다.

```html
<section style="...critical fallback styles...">
  <style>
    /* full scoped rules */
  </style>
  ...
</section>
```

- 별도 CSS 파일 의존 없음
- iframe에서도 완전히 작동
- 추가 라이브러리 불필요

#### Option B: CSS Custom Properties (Design Token)

```html
<section style="
  --hero-title-size: 32px;
  --hero-bg: #1a1a2e;
  --hero-accent: #4ecdc4;
">
```

Cross-slot 조율 문제를 해결하는 가장 단순한 방법.
부모 요소에 한 번 주입하면 하위 모든 컴포넌트가 상속한다.

#### Option C: Tailwind CSS (현 프로젝트에 부적합)

utility-first CSS는 클래스 조합이 직관적이지만 LLM이 잘못된 클래스를 생성할 위험이 높다.
현재 시스템의 controlled token 접근과 상충된다. 도입 비추천.

### 5.3 구조 변경 기술

**현재 문제:** operation이 text/style patch에 제한됨, 구조 변경 불가

**더 나은 접근:**

#### Option A: 컴포넌트 교체 (현재 아키텍처 문서 방향과 일치)

LLM이 patch를 생성하는 것이 아니라, **템플릿 ID + 파라미터**를 선택하고
서버가 해당 템플릿을 렌더링한다.

```json
{
  "action": "replace_component_template",
  "slotId": "hero",
  "templateId": "hero-editorial-split",
  "params": {
    "headline": "...",
    "visual": "right",
    "ctaStyle": "outlined"
  }
}
```

- LLM은 "무엇을 만들지"만 결정
- 서버는 검증된 템플릿으로 렌더링
- 구조 변경이 안정적으로 가능

이것이 현재 아키텍처 문서의 "Component Composition Renderer"가 목표하는 방향이고, **올바른 방향**이다.

#### Option B: React Server Components / Next.js App Router

서버에서 React 컴포넌트를 렌더링해 HTML을 스트리밍하는 방식.
현재 Node.js 서버 구조와 다른 스택이 필요해 현 시점에서 도입 비용이 크다.

#### Option C: Web Components

커스텀 요소(`<hero-component>`)를 정의하고 shadow DOM으로 스타일 격리.
CSS 격리 문제는 해결되지만 LLM output을 web component 파라미터로 매핑하는 레이어가 추가로 필요하다.

### 5.4 Visual Critic / Screenshot 기술

**현재:** Playwright screenshot → Claude Vision 비교

**이 방향은 맞다.** 추가로 고려할 기술:

#### pixelmatch (이미 node_modules에 설치됨)

프로젝트에 `pixelmatch` 패키지가 이미 설치되어 있다.

```
clonellm/node_modules/pixelmatch/index.js
```

이것을 활용해 **hard visual delta gate**를 구현할 수 있다:

- before screenshot과 after screenshot을 pixel 단위로 비교
- 변화 면적이 전체 viewport의 N% 미만이면 "시각적 변화 없음"으로 판정
- LLM critic 호출 전에 빠른 사전 필터로 사용 가능
- 이미 설치된 패키지라서 추가 의존성 불필요

#### sharp (이미 node_modules에 설치됨)

```
clonellm/node_modules/@img/sharp-linux-x64/package.json
```

이미지 리사이즈, 크롭, 포맷 변환에 사용 가능.
screenshot 비교 전 동일 크기로 정규화하는 데 활용 가능.

### 5.5 Design Token 관리

**현재 문제:** LLM이 자유롭게 style value를 생성, 일관성 없음

**더 나은 접근:**

#### Style Dictionary 패턴

JSON/YAML로 design token을 정의하고, 빌드 시 CSS variables, inline style value로 변환한다.

```json
{
  "color": {
    "surface-primary": { "value": "#ffffff" },
    "text-primary": { "value": "#1a1a1a" },
    "accent-main": { "value": "#4ecdc4" }
  },
  "typography": {
    "hero-title": { "size": "40px", "weight": "700", "line-height": "1.2" }
  }
}
```

LLM에게 token name만 선택하게 하고 실제 값은 서버가 주입하면:

- LLM이 임의 값(`font-size: 37px`) 생성 방지
- 디자인 시스템 일관성 자동 보장
- 아키텍처 문서 5.2 "Design System Layer"의 "allowed token sets" 요구사항과 정확히 일치

현재 `asset-pipeline-starter.json` 구조를 이 방향으로 확장 가능.

### 5.6 LLM Structured Output

**현재 문제:** LLM output이 schema를 벗어나는 경우 처리 비용

**기술 옵션:**

- **JSON Schema validation (현재 방식):** 출력 후 normalize. 취약.
- **Structured Outputs (OpenAI / Anthropic tool_use):** LLM이 JSON schema를 보장하며 출력. 현재 Claude API의 tool_use 방식이 이 역할을 하고 있을 가능성 높음.
- **Zod + TypeScript:** 서버 사이드에서 parse + validate. 현재 JS 코드에 추가 가능.

---

## 6. 종합 판단

### 6.1 방향 맞음 / 구현 부족

현재 아키텍처 문서가 정의한 5-layer 구조, 교체 정책, visual critic 루프는 올바르다.
틀린 방향이 아니라 **미완성 구현**이 문제다.

### 6.2 가장 시급한 코드 문제 (우선순위 순)

| 순위 | 문제 | 영향 | 해결 방향 |
|------|------|------|-----------|
| 1 | 구조 변경 operation 부재 | 디자인 강도 제한의 핵심 원인 | replace_component_template operation 추가 |
| 2 | CSS 전달 불안정 | preview 신뢰성 저하 | self-contained HTML (style 내부 포함) |
| 3 | Visual critic fallback 점수 통과 | quality gate 무력화 | fallback 시 hard fail 처리 |
| 4 | Cross-slot 스타일 조율 부재 | 섹션 그룹 통일성 부족 | CSS custom property 부모 주입 |
| 5 | Hard visual delta gate 미구현 | 변화 없는 결과도 통과 | pixelmatch 활용 (이미 설치됨) |
| 6 | Retry 1회 제한 | 반복 개선 불가 | while loop + max retry count |
| 7 | Style string concatenation | 중복 속성 오염 | CSS property map merge로 교체 |

### 6.3 추가로 필요한 개념 (아키텍처 문서에 없음)

- **Cross-slot CSS token coordination**: parent-level CSS variable injection
- **Template-based component replacement**: LLM이 template ID를 선택, 서버가 렌더링
- **pixelmatch hard delta gate**: LLM critic 이전 pixel-level 사전 필터
- **Design token JSON**: allowed token sets를 코드가 아닌 데이터로 관리

### 6.4 도입하지 말아야 할 기술

- **Tailwind CSS**: LLM이 잘못된 class 생성 위험, controlled token 방식과 상충
- **React / Next.js**: 현 스택 교체 비용이 너무 큼, 현재 문제 해결에 필요 없음
- **Web Components**: 추가 매핑 레이어 필요, 현 시점 복잡도 대비 이득 낮음

---

## 7. 추천 다음 단계

아키텍처 문서의 "6. Next Implementation Order"와 이 리뷰를 통합하면:

1. **pixelmatch 기반 hard visual delta gate 구현** (이미 설치됨, 빠른 win)
2. **Visual critic fallback → hard fail 처리** (코드 한 줄 수준)
3. **Retry while loop 구현** (max 2~3회)
4. **CSS custom property parent injection 추가** (cross-slot 스타일 조율)
5. **replace_component_template operation 설계 및 구현** (핵심 구조 변경)
6. **Self-contained HTML 렌더러 (style 내부 포함) 표준화**
7. **Design token JSON 구조 확장** (asset-pipeline-starter.json → token registry)

---

## 8. 결론

현재 방향은 맞다. 더 강한 기술로 바꿀 필요는 없다.

핵심 문제는 두 가지:

1. **LLM이 구조를 바꾸고 싶어도 바꿀 수 있는 operation이 없다** → template replace operation 추가
2. **CSS가 모든 렌더링 컨텍스트에서 안정적으로 전달되지 않는다** → self-contained HTML

이 두 가지를 해결하면 현재 pipeline (Composer → Detailer → Renderer → Visual Critic) 구조 위에서 디자인 강도를 실질적으로 높일 수 있다.

이미 설치된 `pixelmatch`와 `sharp`를 활용하면 hard visual delta gate를 가장 빠르게 추가할 수 있다.
