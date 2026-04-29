# Concept Package Minimal Schema (2026-04-21)

## 목적

이 문서는 `Concept Package`의 최소 계약을 정의한다.

이 문서는 아래를 하지 않는다.

- 현재 코드 구조를 반영하지 않는다
- 레거시 필드명을 재사용하지 않는다
- enum, mode 문자열, fallback 계약을 넣지 않는다

즉 이 문서는 `LLM이 방향 문서를 만들고 다음 단계로 넘기기 위한 최소 프로토콜`만 정의한다.

상위 기준 문서:

- [Design Quality North Star](./admin-design-quality-north-star-2026-04-21.md)
- [Schema Guardrail](./admin-schema-guardrail-2026-04-21.md)
- [Design Authoring Architecture](./admin-design-authoring-architecture-2026-04-21.md)

---

## 1. 한 줄 정의

`Concept Package`는 요구사항을 디자인 실행 가능한 방향 문서로 정리한 결과물이다.

즉 이 문서는

- 왜 바꾸는가
- 무엇을 유지하는가
- 무엇을 바꾸는가
- 어떤 방향으로 갈 것인가
- 어느 범위를 대상으로 삼는가

를 다음 단계에 넘긴다.

여기에는 아직 HTML이 없다.

---

## 2. 최상위 구조

```json
{
  "pageId": "home",
  "viewportProfile": "pc",
  "requestSummary": {},
  "pageIdentity": {},
  "designPolicy": {},
  "conceptOptions": [],
  "selectedConceptId": "",
  "executionBrief": {},
  "referenceContext": {},
  "advisory": []
}
```

주의:

- 최상위 구조는 닫혀 있지만, 내부 디자인 의미 필드는 열린 서술형이어야 한다.
- 이 문서는 `template`, `preset`, `family`, `layout enum`을 담지 않는다.

---

## 3. 최상위 필드

### 3.1 pageId

의미:

- 어떤 페이지에 대한 컨셉서인지 식별

### 3.2 viewportProfile

의미:

- 어떤 기준 뷰포트에서 판단한 컨셉서인지 식별

### 3.3 requestSummary

의미:

- 이번 요청이 무엇인지 짧게 요약한 계층

권장 필드:

- `userGoal`
- `requestedChange`
- `requestedScope`
- `whyNow`

예:

```json
{
  "userGoal": "홈 상단의 브랜드 인상을 더 강하게 만들고 싶다",
  "requestedChange": "hero와 quickmenu의 위계와 톤을 재정리",
  "requestedScope": "상단 진입부 중심",
  "whyNow": "현재 상단이 프로모션 위주로 읽혀 브랜드 톤이 약하다"
}
```

### 3.4 pageIdentity

의미:

- 이 페이지가 어떤 페이지인지 정의하는 계층

권장 필드:

- `character`
- `visualLanguage`
- `userGoal`
- `sectionFlow`

### 3.5 designPolicy

의미:

- 디자인 실행 전에 반드시 정리되어야 하는 정책 계층

권장 필드:

- `problemStatement`
- `hierarchyGoals`
- `mustKeep`
- `mustChange`
- `guardrails`
- `exclusions`

주의:

- 이 필드는 제한 목록이 아니라 방향 문서다.
- `allowed*`, `requires*` 같은 코드 gate 필드는 금지한다.

### 3.6 conceptOptions

의미:

- 사용자가 비교/선택할 수 있는 복수 컨셉안

형태:

- 배열

각 항목 권장 필드:

- `conceptId`
- `conceptLabel`
- `narrative`
- `layoutIntent`
- `visualIntent`
- `contentIntent`
- `ctaIntent`

예:

```json
{
  "conceptId": "concept-a",
  "conceptLabel": "정제된 센터 레이아웃",
  "narrative": [
    "브랜드 메시지가 먼저 읽히는 상단",
    "과잉 프로모션보다 신뢰와 탐색 균형 강조"
  ],
  "layoutIntent": "중앙 정렬 기반, 여백이 넓고 메시지가 먼저 읽히는 상단 구성",
  "visualIntent": "라이트 톤 중심, 배경 대비는 부드럽고 CTA만 선명",
  "contentIntent": "브랜드 신뢰를 먼저 전달하고 핵심 행동은 1순위 CTA로 수렴",
  "ctaIntent": "단일 주요 행동과 보조 행동을 명확히 구분"
}
```

### 3.7 selectedConceptId

의미:

- `conceptOptions` 중 어떤 안이 실제 authoring 대상으로 선택되었는지 식별

주의:

- 선택 전에는 비어 있을 수 있다.
- 이 필드는 선택 결과만 담고, 선택 로직을 설명하지 않는다.

### 3.8 executionBrief

의미:

- Design Author Model이 바로 사용할 수 있는 실행용 방향 요약

권장 필드:

- `northStar`
- `targetGroup`
- `authoringMode`
- `groupIntent`
- `preserveRules`
- `changeRules`
- `excludedChoices`
- `authorInstructions`
- `authoringConstraints`

주의:

- `authoringMode`는 enum처럼 구현 분기를 위한 문자열이 아니라, 현재 요청의 실행 깊이를 설명하는 계약 필드다.
- `builderToolAccess` 같은 기술 허용 범위 필드는 이 문서에서 제외한다.
- `authoringConstraints`는 코드 gate가 아니라 Design Author LLM이 읽는 서술형 조건이어야 한다.
- `allowedLayouts`, `maxSections`, `requiresPreset` 같은 제한 필드는 넣지 않는다.

### 3.9 referenceContext

의미:

- Design Author Model이 현재 페이지를 실제로 이해하는 데 필요한 참조 정보

권장 필드:

- `currentPageScreenshot`
- `currentPageHtmlExcerpt`
- `currentPageTextOutline`
- `currentSectionHtmlMap`
- `beforeAfterReference`
- `brandReferenceAssets`

주의:

- 이 필드는 “현재 코드를 어떻게 고칠지”가 아니라 “현재 페이지를 어떻게 읽을지”를 위한 문맥이다.

### 3.10 advisory

의미:

- 생성 과정에서 남길 주의/메모

형태:

- 문자열 배열 또는 열린 객체 배열

예:

- 사용자가 특정 문구를 고정 지시함
- 현재 페이지 hero HTML이 비정상적으로 비어 있음

---

## 4. targetGroup 최소 계약

`executionBrief.targetGroup`은 범위를 뜻한다.

최소 필드:

- `groupId`
- `groupLabel`
- `scopeUnit`
- `componentIds`
- `slotIds`
- `boundary`

### 4.1 scopeUnit

의미:

- page / cluster / component 같은 범위 단위

주의:

- 이 문서는 scopeUnit의 허용값 목록을 강제하지 않는다.
- 중요한 건 “범위를 식별하는 계약이 있다”는 점이다.

### 4.2 boundary

의미:

- 어디서부터 어디까지가 이번 실행 범위인지 설명

권장 필드:

- `preserveOutsideGroup`
- `entryReference`
- `exitReference`
- `boundaryIntent`

좋은 예:

```json
{
  "preserveOutsideGroup": true,
  "entryReference": "hero 시작 지점",
  "exitReference": "quickmenu 종료 지점",
  "boundaryIntent": "상단 진입부만 재구성하고 그 밖의 큐레이션 영역은 유지"
}
```

나쁜 예:

```json
{
  "mode": "replace-inside-group"
}
```

이유:

- 구현 분기로 바로 이어지는 mode 문자열은 schema guardrail에 위배된다.

---

## 5. 필드 설계 원칙

### 5.1 열린 서술 우선

좋은 예:

- `layoutIntent`
- `visualIntent`
- `contentIntent`
- `boundaryIntent`

나쁜 예:

- `layoutMode`
- `themeMode`
- `presetId`
- `templateId`

### 5.2 기술 결정은 넣지 않는다

금지:

- Tailwind class
- HTML 구조
- preset 이름
- family/template 선택
- fallback 분기

### 5.3 현재 코드 호환 필드는 넣지 않는다

금지:

- 레거시 builder가 읽기 쉬운 요약 필드
- 현재 runtime 분기용 내부 문자열
- 현재 DB/저장 구조에 맞춘 축약 필드

---

## 6. 좋은 예 / 나쁜 예

### 6.1 좋은 예

```json
{
  "pageId": "home",
  "viewportProfile": "pc",
  "requestSummary": {
    "userGoal": "홈 상단의 브랜드 인상을 강화",
    "requestedChange": "hero와 quickmenu를 더 정제된 진입 경험으로 재구성"
  },
  "pageIdentity": {
    "character": "LG전자 공식 메인의 신뢰와 프리미엄 첫 접점",
    "visualLanguage": "라이트 톤, 여백 중심, 과장 없는 프로모션",
    "userGoal": "브랜드를 빠르게 이해하고 주요 카테고리로 이동",
    "sectionFlow": "헤더 -> hero -> quickmenu -> 큐레이션"
  },
  "designPolicy": {
    "problemStatement": [
      "프로모션 톤이 먼저 읽혀 브랜드 인상이 약하다"
    ],
    "hierarchyGoals": [
      "브랜드 메시지 -> 신뢰 근거 -> 행동 유도 순으로 정렬"
    ],
    "mustKeep": [
      "공식 메인다운 신뢰감"
    ],
    "mustChange": [
      "과잉 프로모션 중심의 읽힘"
    ]
  },
  "conceptOptions": [
    {
      "conceptId": "concept-a",
      "conceptLabel": "정제된 센터 레이아웃",
      "layoutIntent": "중앙 정렬 기반으로 브랜드 메시지가 먼저 읽히는 상단",
      "visualIntent": "라이트 톤 기반, CTA만 선명",
      "contentIntent": "브랜드 신뢰를 먼저 전달하고 탐색을 자연스럽게 연결"
    }
  ],
  "selectedConceptId": "concept-a",
  "executionBrief": {
    "northStar": "브랜드 인상이 먼저 읽히는 상단 진입부",
    "authoringMode": "full",
    "targetGroup": {
      "groupId": "top-stage",
      "groupLabel": "Top Stage",
      "scopeUnit": "cluster",
      "componentIds": ["home.hero", "home.quickmenu"],
      "slotIds": ["hero", "quickmenu"],
      "boundary": {
        "preserveOutsideGroup": true,
        "entryReference": "hero 시작",
        "exitReference": "quickmenu 종료",
        "boundaryIntent": "상단 진입부만 재구성"
      }
    }
  }
}
```

### 6.2 나쁜 예

```json
{
  "selectedConcept": {
    "layoutMode": "editorial-split",
    "themeMode": "light-neutral",
    "presetId": "hero-premium-light"
  },
  "executionBrief": {
    "targetGroup": {
      "boundary": {
        "mode": "replace-inside-group"
      }
    }
  }
}
```

이유:

- enum/mode/preset으로 LLM 자유도를 제한한다
- 현재 코드 분기에 끌린 표현이다

---

## 7. 한 줄 기준

`Concept Package는 방향을 담는 최소 프로토콜이며, 디자인을 제한하는 기술 계약이 아니라 Design Author LLM이 해석할 수 있는 열린 문서여야 한다.`
