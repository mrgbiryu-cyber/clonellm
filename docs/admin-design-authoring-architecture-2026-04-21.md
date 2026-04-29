# Design Authoring Architecture (2026-04-21)

현재 체크포인트:

- [Runtime Checkpoint (2026-04-22)](./admin-runtime-checkpoint-2026-04-22.md)

## 목적

이 문서는 기존의

- `컨셉서 -> Builder -> Canonical Render Model -> Renderer`

구조를 다시 점검한 뒤,

`Claude.ai/design` 수준의 품질에 더 가까운 구조를 기준으로
새 본선 아키텍처를 다시 정의한다.

최상위 기준 문서:

- [Design Quality North Star](./admin-design-quality-north-star-2026-04-21.md)
- [Markdown-First Authoring Flow](./admin-markdown-first-authoring-flow-2026-04-22.md)
- [Schema Guardrail](./admin-schema-guardrail-2026-04-21.md)
- [Concept Package Minimal Schema](./admin-concept-package-minimal-schema-2026-04-21.md)
- [Authored Section HTML Package Minimal Schema](./admin-authored-section-html-package-minimal-schema-2026-04-21.md)

핵심 결론은 아래다.

`최종 시각 판단과 카피 작성은 코드 렌더러가 아니라 LLM authoring layer가 맡아야 한다.`

단, 상위 레이어의 실제 전달 형식은
`JSON strict schema`보다
`Markdown 원문 문서 흐름`
을 우선한다.

즉 우리가 만들어야 하는 것은

- render model 선택 시스템

이 아니라,

- `컨셉서와 레퍼런스를 받아 section HTML/Tailwind를 직접 작성하고`
- `코드 런타임이 그 결과를 안전하게 서빙하는 시스템`

이다.

---

## 1. 왜 이전 구조만으로는 부족한가

이전 구조:

```text
Requirements
  -> Concept Package
  -> Design Builder Model
  -> Canonical Render Model
  -> Renderer
  -> HTML
```

이 구조는 방향 정리에는 유리하지만, 아래 결정이 비어 있다.

- 실제 section HTML 구조를 누가 쓰는가
- 실제 Tailwind class를 누가 정하는가
- 실제 카피를 누가 쓰는가
- 실제 배경/자간/비율을 누가 결정하는가

이 빈칸이 남아 있으면 구현은 자연스럽게 아래로 끌려간다.

- family/template 선택
- preset 선택
- slot별 patch 구성
- 코드 템플릿 출력

그러면 품질의 상한은 템플릿 품질이 된다.

즉 고품질 모델을 붙여도
최종 결과가 코드 템플릿 중심이면
`Claude.ai/design` 같은 직접적인 시각 판단 수준까지는 못 간다.

---

## 2. 새 핵심 판단

새 구조의 핵심 판단은 아래다.

### 2.1 최종 시각 결정 주체는 LLM이어야 한다

아래는 코드 템플릿이 아니라 LLM authoring이 맡아야 한다.

- HTML section 구조
- Tailwind class 조합
- 레이아웃 비율
- 배경 처리
- 타이포 위계
- CTA 문구
- 한국어 카피

### 2.2 코드 Renderer는 runtime 역할로 내려간다

코드 runtime은 아래만 맡는다.

- target group boundary 적용
- shell 유지
- before/after 서빙
- sanitize
- 저장
- clone/compare

즉 `디자인 생성기`가 아니라 `안전한 서빙 계층`이어야 한다.

### 2.3 카피와 시각은 분리하지 않는다

고품질 디자인에서

- 카피
- 위계
- 구조
- 스타일

은 한 번에 결정된다.

따라서 카피를 별도 레이어로 빼거나
placeholder를 두고 나중에 채우는 구조는
품질을 떨어뜨릴 가능성이 높다.

---

## 3. 최종 본선 흐름

```text
User Requirements
  -> Concept Model
  -> Concept Package
  -> Design Author Model (LLM)
  -> Authored Section HTML Package
  -> Runtime Renderer (code)
  -> Draft Result
  -> Visual Verifier
```

여기서 중요한 점:

- `Concept Model`은 방향 문서를 만든다.
- `Design Author Model`은 section 단위 HTML/Tailwind를 직접 쓴다.
- `Runtime Renderer`는 그 결과를 boundary에 맞게 삽입하고 서빙한다.
- `Visual Verifier`는 렌더된 결과를 보고 pass/retry를 판단한다.

---

## 3A. 실행 모드 분기

이 구조는 `항상 전체 section 재작성`을 의미하지 않는다.

사용자 요청은 아래 실행 모드 중 하나로 정규화된다.

- `full`
- `layout-only`
- `copy-only`
- `element`

핵심 원칙:

- 실행 모드는 `Runtime Renderer`가 아니라 상위 입력 계약에서 결정한다.
- UI는 범위와 의도를 전달한다.
- `authoringMode`의 최종 결정은 `Concept Model`이 한다.
- 즉 작은 수정 때문에 구조 전체가 다시 그려지지 않도록, 상위 입력 힌트를 `Concept Model`이 실행 모드로 구체화하고 그에 맞는 authoring path를 탄다.

### 3A.1 full

의미:

- target group 전체를 새로 디자인

경로:

```text
User Requirements
  -> Concept Model
  -> Concept Package
  -> Design Author Model [full]
  -> Authored Section HTML Package
  -> Runtime Renderer
  -> Draft Result
```

### 3A.2 layout-only

의미:

- 카피/에셋은 최대한 유지
- 구조/스타일만 재작성

경로:

```text
User Requirements
  -> Concept Model
  -> Concept Package
  -> Design Author Model [layout-only]
  -> Authored Section HTML Package
  -> Runtime Renderer
  -> Draft Result
```

### 3A.3 copy-only

의미:

- 구조와 스타일은 유지
- 텍스트와 CTA만 재작성

경로:

```text
User Requirements
  -> Concept Package 또는 Existing Context
  -> Design Author Model [copy-only]
  -> Authored Section HTML Package
  -> Runtime Renderer
  -> Draft Result
```

### 3A.4 element

의미:

- 특정 필드 1개 또는 일부 요소만 직접 변경

경로:

```text
User Field Edit
  -> Runtime Renderer
  -> Draft Result
```

중요:

- `element` 모드는 LLM authoring을 거치지 않는다.
- 예: headline 1줄 교체, CTA 문구 교체, 특정 이미지 slot 교체
- 이 경로도 구조를 망가뜨리지 않도록 `targetGroup boundary`와 `authoringScope.targetElements` 계약 아래에서만 허용한다.

---

## 4. 모델별 역할

### 4.1 Concept Model

역할:

- 요구사항을 디자인 실행 가능한 방향 문서로 구조화

책임:

- 왜 바꾸는가
- 무엇을 유지하는가
- 무엇을 바꾸는가
- 이번 범위가 어디까지인가
- 어떤 컨셉 방향으로 갈 것인가

출력:

- `Concept Package`

금지:

- HTML 생성
- Tailwind class 생성
- family/template 결정
- preset id 결정
- 실제 카피 작성

### 4.2 Design Author Model

역할:

- Concept Package와 reference context를 받아
  실제 section HTML/Tailwind를 작성

책임:

- 구조 작성
- 스타일 작성
- 카피 작성
- CTA 작성
- section 단위 시각 완성

필수 입력:

- `Concept Package`
- `referenceContext.currentPageScreenshot`
- `referenceContext.currentPageHtmlExcerpt`
- `referenceContext.currentSectionHtmlMap`

출력:

- `Authored Section HTML Package`

금지:

- shell 전체를 다시 만드는 것
- target group 바깥까지 수정하는 것
- boundary 재정의
- 저장/서빙 판단

### 4.3 Runtime Renderer

역할:

- Authored Section HTML Package를 실제 clone/draft 결과로 조립

책임:

- target group boundary 안에 authored HTML 삽입
- 기존 페이지 shell 유지
- sanitize
- before/after 결과 생성
- draft 저장

금지:

- 컨셉 재해석
- 카피 생성
- HTML 미세 레이아웃 재작성
- authoring 결과를 template 중심으로 다시 변환
- 실행 모드를 스스로 승격 또는 변경하는 것

### 4.4 Visual Verifier

역할:

- 렌더된 결과를 보고 품질 확인

책임:

- hierarchy 확인
- brand alignment 확인
- change delta 확인
- retry instruction 생성

retry 대상:

- `Concept Model`이 아니라 `Design Author Model`

즉 문제 정의를 다시 쓰는 것이 아니라,
작성된 시안을 다시 다듬는 구조여야 한다.

---

## 5. 입력 계약

### 5.1 User Requirements -> Concept Model

입력 필드:

- `pageId`
- `viewportProfile`
- `userRequirements`
- `requestedChangeLevel`
- `targetScopeHint`
- `authoringModeHint`
- `referenceContext`

#### authoringModeHint

- `full`
- `layout-only`
- `copy-only`
- `element`

의미:

- 이번 요청이 어느 깊이까지 바뀌어야 하는지에 대한 사용자 힌트
- UI는 이 값을 직접 확정하지 않는다
- Concept Model은 이 힌트를 `executionBrief.authoringMode`로 구체화한다

### 5.2 referenceContext

이번 구조에서 `referenceContext`는 필수다.

최소 포함 항목:

- `currentPageScreenshot`
- `currentPageHtmlExcerpt`
- `currentPageTextOutline`
- `currentSectionHtmlMap`
- `beforeAfterReference`
- `brandReferenceAssets`

이유:

- 텍스트로 “LG Red”를 아는 것과
- 현재 페이지를 실제로 보고 판단하는 것은 다르기 때문이다.
- section 단위 HTML이 있어야 Author Model이 현재 hero/quickmenu의 구조, 텍스트, 재사용 가능한 asset을 직접 판단할 수 있다.

#### currentSectionHtmlMap

예:

```json
{
  "hero": "<section>...</section>",
  "quickmenu": "<section>...</section>"
}
```

의미:

- target group 안의 현재 section HTML snapshot
- asset 재사용 판단의 기본 입력
- placeholder 생성 방지용 입력

#### beforeAfterReference

예:

```json
{
  "beforeScreenshot": "url-or-blob",
  "currentDiffSummary": "현재 화면과 직전 draft의 차이 요약"
}
```

의미:

- 사용자가 UI에서 보는 이전 화면 비교 정보를 모델 입력으로도 연결
- 단, 이 정보는 `방향/검증` 보조 정보이지 renderer 결정 기준이 아니다

금지:

- Renderer 내부 상태
- legacy patch payload

---

## 6. Concept Package 계약

Concept Package는 방향 문서다.

### 6.1 pageIdentity

- `character`
- `visualLanguage`
- `userGoal`
- `sectionFlow`

### 6.2 designPolicy

- `problemStatement`
- `hierarchyGoals`
- `mustKeep`
- `mustChange`
- `guardrails`
- `exclusions`

### 6.3 selectedConcepts

Concept Model은 기본적으로 복수 컨셉을 출력한다.

- `conceptId`
- `conceptLabel`
- `narrative`
- `layoutSystem`
- `typographySystem`
- `colorSystem`
- `ctaPolicy`
- `promotionTonePolicy`

추가 필드:

- `userPickedConceptId`

의미:

- `selectedConcepts`: Concept Model이 생성한 복수 안
- `userPickedConceptId`: 사용자가 선택한 안

기본 흐름:

```text
Concept Model
  -> selectedConcepts [A, B]
  -> user picks one
  -> Design Author Model은 userPickedConceptId에 해당하는 컨셉만 authoring
```

### 6.4 executionBrief

- `northStar`
- `targetGroup`
- `authoringMode`
- `groupIntent`
- `preserveRules`
- `changeRules`
- `excludedChoices`
- `authorInstructions`
- `authoringConstraints`

#### authoringMode

- `full`
- `layout-only`
- `copy-only`
- `element`

의미:

- 어떤 깊이로 수정할 것인지에 대한 실행 계약
- Builder/Author/Renderer 모두 이 필드를 존중해야 한다

#### targetGroup

`targetGroup`은 수정 범위를 뜻하며 page/component/cluster 단위를 모두 수용한다.

필수 필드:

- `groupId`
- `groupLabel`
- `scopeUnit`
- `componentIds`
- `slotIds`
- `boundary`

#### targetGroup.scopeUnit

- `page`
- `cluster`
- `component`

의미:

- `page`: 페이지 전체 재구성
- `cluster`: 여러 component가 묶인 그룹
- `component`: 개별 component 단위 수정

중요:

- 여기까지가 “방향”
- 아직 HTML은 없음

---

## 7. Authored Section HTML Package 계약

이 문서가 새 구조의 핵심 출력이다.

```json
{
  "pageId": "home",
  "viewportProfile": "pc",
  "targetGroup": {},
  "sections": []
}
```

### 7.1 targetGroup

- `groupId`
- `groupLabel`
- `componentIds`
- `slotIds`
- `boundary`

#### boundary

- `mode`
- `preserveOutsideGroup`
- `entrySlotId`
- `exitSlotId`

#### boundary.mode

허용값:

- `scoped-rewrite`
- `scoped-update`

의미:

- `scoped-rewrite`: 선택된 boundary 안을 새 구조로 다시 작성
- `scoped-update`: 선택된 boundary 안에서 기존 shell을 유지한 채 요소 단위로 수정

금지:

- 이 문서에서 정의되지 않은 mode 문자열 사용
- legacy runtime/orchestrator에서 쓰던 내부 분기 문자열 재사용

### 7.2 sections[*]

각 section은 아래를 가진다.

- `slotId`
- `componentId`
- `role`
- `authoringScope`
- `content`
- `html`
- `tailwindNotes`
- `constraints`

### 7.2A sections[*].authoringScope

- `mode`
- `targetElements`

#### mode

- `full-rewrite`
- `style-only`
- `copy-only`
- `targeted-elements`

#### targetElements

예:

- `headline`
- `cta-primary`
- `badge`
- `hero-image`

규칙:

- `targeted-elements` 모드일 때만 사용한다
- `element` 실행 모드는 이 필드를 통해 직접 수정 범위를 제한한다

### 7.3 sections[*].content

카피 책임을 명확히 하기 위해
content 계약을 분리한다.

- `sourceMode`
- `contentIntent`
- `messageConstraints`
- `headline`
- `supportText`
- `ctaLabels`

#### sourceMode

- `generated`
- `extracted`
- `fixed`

의미:

- `generated`: Author model이 직접 생성
- `extracted`: 현재 페이지에서 추출해 유지/정리
- `fixed`: 사용자가 고정 지시한 문구

중요:

- 기본값은 `generated` 또는 `extracted`
- placeholder는 허용하지 않는다

### 7.4 sections[*].html

이 필드는 실제 authored result다.

- section 단위 HTML
- Tailwind class 포함
- section 내부 구조 완성본

이미지/asset 규칙:

- 현재 페이지에서 추출된 URL은 재사용 가능하다.
- 새 이미지 URL을 임의로 넣는 것은 금지한다.
- 새 이미지가 필요하면 asset slot placeholder를 사용한다.

예:

```html
<img data-asset-slot="hero-main" alt="LG 오브제컬렉션 냉장고 메인 이미지" />
```

Runtime Renderer 규칙:

- `data-asset-slot`를 실제 URL로 치환한다.
- 치환할 수 없으면 advisory에 기록하고 fallback asset 정책을 적용한다.

즉 최종 시각 판단은 여기서 끝나야 한다.

### 7.5 sections[*].tailwindNotes

선택 필드:

- class 의도
- spacing/typography rationale
- reviewer 참고 메모

이 필드는 디버그용이지 본선 입력이 아니다.

---

## 8. Runtime Renderer 계약

Runtime Renderer는 authored HTML package를 받아 아래만 한다.

### 8.1 입력

- `Authored Section HTML Package`
- `reference page shell`
- `targetGroup boundary`
- `executionBrief.authoringMode`

### 8.2 출력

- `before HTML`
- `after HTML`
- `draftBuild`

### 8.3 금지

- authored HTML을 다시 template/family로 환원하지 않는다
- authored HTML을 patch schema로 재분해하지 않는다
- section 내부 카피를 다시 쓰지 않는다
- `element` 모드를 `full`로 승격하지 않는다
- `copy-only` 모드를 `layout-only`나 `full`로 확장하지 않는다

즉 runtime은 `HTML authoring`이 아니라 `HTML delivery`다.

---

## 9. Visual Verification 계약

이전처럼 hard gate 무한 루프로 가면 안 된다.

따라서 visual verification은 아래처럼 정의한다.

### 9.1 입력

- rendered after screenshot
- rendered before screenshot
- target group info
- concept package

### 9.2 체크 항목

- `hierarchy`
- `brandAlignment`
- `changeDelta`
- `targetGroupIntegrity`

### 9.3 출력

- `pass`
- `retry`
- `advisory`

### 9.4 retry 규칙

- retry target은 `Design Author Model`
- retry는 `specific instruction`을 가져야 한다
- Concept Model 전체 재실행은 기본 경로가 아니다
- `maxRetryCount = 1`
- `onRetryExhausted = advisory-pass`
- `passWithAdvisory`는 허용한다

예:

- “hero 카피가 혜택 중심으로 기울어 브랜드 톤이 약하다”
- “quickmenu가 hero와 하나의 top-stage로 읽히지 않는다”
- “CTA hierarchy가 2개 모두 강해서 primary action이 흐린다”

즉 이 구조는 이전처럼 무한 루프로 가지 않는다.

- 1차 authoring
- 필요 시 1회 retry
- 그래도 부족하면 advisory를 남기고 종료

---

## 10. UI 분리 기준

### 10.0 UI Scope Selection Mapping

현재 UI에는

- 수정하고자 하는 영역 선택
- 이전 화면과 비교

가 이미 존재한다.

이 정보는 단순 화면 편의 기능이 아니라,
실행 경로를 정하는 상위 입력 계약으로 연결되어야 한다.

즉 UI는 renderer를 직접 제어하는 것이 아니라
아래 3개를 결정하는 입력 계층이다.

- `authoringModeHint`
- `targetGroup.scopeUnit`
- `targetGroup`

#### 10.0.1 기본 매핑 원칙

- UI에서 선택한 범위가 작을수록 실행 모드는 더 얕아진다.
- UI에서 선택한 범위가 클수록 `cluster` 또는 `page` 단위로 올라간다.
- 비교 화면은 실행 범위를 결정하지 않고, 검증/판단 보조 정보로만 사용한다.
- Runtime Renderer는 이 매핑을 해석해서 범위를 바꾸면 안 된다.

#### 10.0.2 UI 입력 -> 실행 계약 매핑 힌트

| UI 선택 | 의미 | scopeUnit | authoringModeHint | Concept Model의 기본 구체화 예시 |
|---|---|---|---|---|
| 페이지 전체 수정 | 페이지를 새로 재구성 | `page` | `full` | 전체 재설계 경로 |
| 상단/구매영역 등 그룹 수정 | 여러 컴포넌트를 하나의 흐름으로 재구성 | `cluster` | `full` 또는 `layout-only` | top-stage, purchase-cluster 등 |
| 컴포넌트 1개 수정 | hero, quickmenu, summary 같은 개별 컴포넌트 수정 | `component` | `layout-only` 또는 `copy-only` | 최종 mode는 Concept Model이 결정 |
| 텍스트만 수정 | 구조 유지, 카피만 변경 | `component` | `copy-only` | Author Model 경량 경로 |
| 특정 요소 직접 수정 | headline, CTA, badge, 이미지 slot 등 직접 지정 | `component` | `element` | Runtime Renderer 직행 |

중요:

- 이 표는 UI가 `authoringMode`를 직접 선택한다는 뜻이 아니다.
- 이 표는 UI 선택이 어떤 실행 힌트로 들어가는지 보여주는 것이다.
- 최종 `authoringMode`는 항상 Concept Model이 결정한다.

#### 10.0.3 비교 화면의 역할

UI의 이전 화면 비교는 아래 용도로만 쓴다.

- 사용자가 변화량을 판단
- Visual Verifier 입력 보조
- Author Model에게 현재/이전 맥락 전달

즉 비교 화면은

- 실행 범위 결정기 아님
- renderer 결정기 아님
- 구조를 다시 해석하는 기준 아님

#### 10.0.4 현재 UI 필드와 연결되는 값

UI에서 최소한 아래 값을 추출해 실행 계약으로 넘긴다.

- `selectedScopeUnit`
- `selectedTargetGroupId`
- `selectedComponentIds`
- `selectedSlotIds`
- `selectedAuthoringModeHint`
- `selectedTargetElements`
- `beforeAfterReference`

이 값들은 아래 계약으로 정규화된다.

```json
{
  "targetGroup": {
    "groupId": "top-stage",
    "groupLabel": "Top Stage",
    "scopeUnit": "cluster",
    "componentIds": ["home.hero", "home.quickmenu"],
    "slotIds": ["hero", "quickmenu"],
    "boundary": {
      "mode": "scoped-rewrite",
      "preserveOutsideGroup": true,
      "entrySlotId": "hero",
      "exitSlotId": "quickmenu"
    }
  },
  "authoringModeHint": "full",
  "beforeAfterReference": {
    "beforeScreenshot": "url-or-blob",
    "currentDiffSummary": "현재 화면과 직전 draft의 차이 요약"
  }
}
```

#### 10.0.5 element 모드의 특별 규칙

`element` 모드는 가장 좁은 수정 경로다.

필수 조건:

- `scopeUnit = component`
- `authoringMode = element`
- `targetElements`가 비어 있지 않아야 함

예:

```json
{
  "targetGroup": {
    "groupId": "home.hero",
    "groupLabel": "Hero Component",
    "scopeUnit": "component",
    "componentIds": ["home.hero"],
    "slotIds": ["hero"],
    "boundary": {
      "mode": "scoped-update",
      "preserveOutsideGroup": true,
      "entrySlotId": "hero",
      "exitSlotId": "hero"
    }
  },
  "authoringMode": "element",
  "targetElements": ["headline", "cta-primary"]
}
```

이 경우 허용되는 동작은 아래뿐이다.

- headline 교체
- CTA 라벨 교체
- badge 문구 교체
- 특정 asset slot 교체

허용되지 않는 동작:

- layout 재구성
- wrapper 구조 변경
- 주변 section까지 영향 확장

#### 10.0.6 full 모드의 특별 규칙

`full` 모드는 가장 넓은 재구성 경로다.

허용:

- section 전체 재작성
- target group 안의 여러 component 동시 재작성
- page 단위 재구성

제한:

- boundary 밖 수정 금지
- shell 전체 재작성 금지
- target group이 정의되지 않은 full page rewrite 금지

즉 `full`도 무제한 전체 생성이 아니라
`선택된 범위 안에서의 전체 재구성`이다.

### 10.1 컨셉서 패널

보여줄 것:

- page identity
- 문제 정의
- 정보 위계
- 범위 통제
- 선택된 컨셉안
- target group 설명

보여주면 안 되는 것:

- authored HTML
- tailwind class
- draft build id
- runtime debug

### 10.2 디자인 빌더 패널

보여줄 것:

- 어떤 컨셉서 기준으로 authoring하는지
- authoring 실행 상태
- verifier 결과
- 최신 draft 결과
- preview / compare

보여주면 안 되는 것:

- 컨셉서 본문 전체 반복
- preset/family/template
- raw renderer payload

### 10.3 기술 상세 패널

보여줄 것:

- authored HTML raw
- sanitization report
- debug notes
- verifier advisory

이 패널은 기본적으로 접혀 있어야 한다.

---

## 11. 삭제/금지 대상

본선에서 제거하거나 금지해야 할 것:

- operations를 canonical 본선으로 쓰는 구조
- patch 중심 renderer
- slot-specific local hardcoding
- family/template 선택만으로 품질을 해결하려는 구조
- critic retry/recovery loop
- compare rerun
- authoring 결과를 다시 legacy schema에 맞추는 배선

---

## 12. 한 줄 기준

`컨셉서는 방향을 정하고, Design Author LLM이 section HTML/Tailwind를 직접 작성하고, Runtime Renderer는 그 결과를 안전하게 삽입하고 서빙한다.`
