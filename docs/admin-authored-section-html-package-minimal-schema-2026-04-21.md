# Authored Section HTML Package Minimal Schema (2026-04-21)

## 목적

이 문서는 `Authored Section HTML Package`의 최소 계약을 정의한다.

이 문서는 다음을 하지 않는다.

- 현재 renderer 구조를 반영하지 않는다
- template/family/preset 중심 schema를 만들지 않는다
- enum, mode 문자열, fallback 분기를 넣지 않는다

즉 이 문서는 `Design Author LLM이 실제 section HTML/Tailwind를 작성하고, Runtime Renderer가 이를 안전하게 서빙하기 위한 최소 프로토콜`만 정의한다.

상위 기준 문서:

- [Design Quality North Star](./admin-design-quality-north-star-2026-04-21.md)
- [Schema Guardrail](./admin-schema-guardrail-2026-04-21.md)
- [Design Authoring Architecture](./admin-design-authoring-architecture-2026-04-21.md)

---

## 1. 한 줄 정의

`Authored Section HTML Package`는 선택된 범위 안에서 실제로 작성된 section HTML/Tailwind 결과를 담는 운반용 문서다.

즉 이 문서는

- 어떤 범위를 대상으로 썼는지
- 각 section에서 무엇을 어떻게 썼는지
- 어떤 카피가 생성/추출/고정된 것인지
- 어떤 asset slot이 필요한지

를 runtime에 넘긴다.

---

## 2. 최상위 구조

```json
{
  "pageId": "home",
  "viewportProfile": "pc",
  "targetGroup": {},
  "sections": [],
  "advisory": []
}
```

주의:

- 이 문서는 authored result를 담는다.
- renderer가 다시 template/family로 환원하기 위한 구조가 아니다.

---

## 3. 최상위 필드

### 3.1 pageId

의미:

- 어떤 페이지에 대한 authored result인지 식별

### 3.2 viewportProfile

의미:

- 어떤 뷰포트 기준으로 작성한 결과인지 식별

### 3.3 targetGroup

의미:

- 이번 authored result가 적용될 범위

최소 필드:

- `groupId`
- `groupLabel`
- `scopeUnit`
- `componentIds`
- `slotIds`
- `boundary`

### 3.4 sections

의미:

- 실제로 작성된 section 단위 결과물 배열

형태:

- 배열

### 3.5 advisory

의미:

- authored result를 runtime이 처리할 때 참고할 주의 메모

예:

- asset slot 중 치환이 필요한 항목
- 특정 문구는 사용자 고정 지시
- 현재 section HTML이 부족해 일부 추정이 포함됨

주의:

- fallback 실행 계약이 아니다
- 디버그/주의 메모다

---

## 4. targetGroup 최소 계약

`targetGroup`은 적용 범위를 뜻한다.

최소 필드:

- `groupId`
- `groupLabel`
- `scopeUnit`
- `componentIds`
- `slotIds`
- `boundary`

### 4.1 boundary

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
  "boundaryIntent": "상단 진입부만 authored HTML로 교체"
}
```

나쁜 예:

```json
{
  "mode": "replace-inside-group"
}
```

이유:

- mode 문자열은 runtime 분기로 곧바로 연결된다
- schema guardrail에 위배된다

---

## 5. sections[*] 최소 계약

각 section은 아래를 가진다.

```json
{
  "slotId": "hero",
  "componentId": "home.hero",
  "role": "브랜드 첫 인상을 만드는 상단 메시지 영역",
  "authoringScope": {},
  "content": {},
  "html": "",
  "constraints": {},
  "assetPlaceholders": []
}
```

### 5.1 slotId

의미:

- 어떤 슬롯인지 식별

### 5.2 componentId

의미:

- 어떤 컴포넌트인지 식별

### 5.3 role

의미:

- 이 section이 페이지 안에서 맡는 역할

좋은 예:

- `브랜드 첫 인상을 만드는 상단 메시지 영역`
- `hero를 보조하는 탐색 진입 영역`

나쁜 예:

- `hero-primary`
- `quickmenu-grid-v2`

이유:

- 후자는 다시 내부 mode/type 이름으로 굳어진다

### 5.4 authoringScope

의미:

- 이 section이 어떤 깊이로 수정되었는지 설명

권장 필드:

- `authoringIntent`
- `targetElements`

좋은 예:

```json
{
  "authoringIntent": "구조와 스타일은 유지하고 헤드라인/CTA만 재작성",
  "targetElements": ["headline", "cta-primary"]
}
```

주의:

- `mode` enum으로 닫지 않는다
- runtime 분기용 코드 문자열을 넣지 않는다

### 5.5 content

의미:

- 카피와 메시지 출처/의도를 담는 계층

권장 필드:

- `sourceMode`
- `contentIntent`
- `messageConstraints`
- `headline`
- `supportText`
- `ctaLabels`

#### sourceMode

의미:

- generated / extracted / fixed 같은 출처 설명

주의:

- 이 필드는 구현 분기를 위한 gate가 아니라 provenance 기록이다
- `content` 필드는 provenance와 메시지 설명용 계층이다.
- runtime은 `content`로 `html`을 덮어쓰지 않는다.
- runtime은 항상 `html` 필드를 정본으로 사용한다.

### 5.6 html

의미:

- 실제 authored section HTML

규칙:

- section 단위 HTML이어야 한다
- Tailwind class를 포함할 수 있다
- section 내부 구조는 완성본이어야 한다
- runtime이 이 HTML을 다시 template/family/preset으로 분해하면 안 된다

### 5.7 constraints

의미:

- 이 authored result를 runtime이 안전하게 처리하기 위해 알아야 할 최소 보존 조건

권장 필드:

- `preserveIntent`
- `doNotBreak`
- `userFixedContent`

좋은 예:

```json
{
  "preserveIntent": "현재 hero의 주 이미지와 섹션 외부 레이아웃은 유지",
  "doNotBreak": [
    "기존 shell 밖으로 마크업을 확장하지 않는다"
  ],
  "userFixedContent": [
    "2025 LG 히트상품"
  ]
}
```

나쁜 예:

```json
{
  "allowedLayouts": ["split-left", "stacked"],
  "requiresPreset": true
}
```

이유:

- constraints가 다시 코드 gate로 변질된다

### 5.8 assetPlaceholders

의미:

- authored HTML 안에서 runtime이 실제 asset으로 치환해야 하는 자리

형태:

- 배열

각 항목 최소 필드:

- `assetSlotId`
- `assetIntent`
- `placementHint`

좋은 예:

```json
{
  "assetSlotId": "hero-main",
  "assetIntent": "현재 페이지의 대표 제품 이미지를 재사용하거나 브랜드 대표 이미지를 넣는다",
  "placementHint": "hero section 오른쪽 주 비주얼"
}
```

주의:

- assetSlot은 닫힌 식별자 필드다
- 하지만 asset 해법은 열린 의도 필드로 남긴다

---

## 6. authored HTML 안의 asset 규칙

이미지나 비주얼이 필요한 경우 아래 원칙을 따른다.

### 6.1 현재 페이지 asset 재사용 가능

- 현재 페이지에서 직접 추출한 URL은 재사용 가능

### 6.2 새 URL 임의 생성 금지

- LLM이 새 이미지 URL을 임의로 적는 것은 금지

### 6.3 새 asset이 필요하면 placeholder 사용

예:

```html
<img data-asset-slot="hero-main" alt="LG 오브제컬렉션 냉장고 메인 이미지" />
```

의미:

- runtime이 실제 URL을 결정해 치환

주의:

- placeholder는 디자인 품질을 위한 열린 자리다
- preset/template 강제를 위한 도구가 아니다

---

## 7. 좋은 예 / 나쁜 예

### 7.1 좋은 예

```json
{
  "pageId": "home",
  "viewportProfile": "pc",
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
      "boundaryIntent": "상단 진입부만 authored HTML로 교체"
    }
  },
  "sections": [
    {
      "slotId": "hero",
      "componentId": "home.hero",
      "role": "브랜드 첫 인상을 만드는 상단 메시지 영역",
      "authoringScope": {
        "authoringIntent": "상단 메시지와 주 비주얼 구조를 새로 작성"
      },
      "content": {
        "sourceMode": "generated",
        "contentIntent": "브랜드 신뢰를 먼저 전달하고 CTA를 명확히 한다",
        "headline": "일상을 더 정제된 경험으로 연결하는 LG전자",
        "supportText": "혜택과 탐색이 균형 잡힌 공식 메인 상단 진입부",
        "ctaLabels": ["자세히 보기", "혜택 보기"]
      },
      "html": "<section data-authored-slot=\"hero\" class=\"...\">...</section>",
      "constraints": {
        "preserveIntent": "shell 밖 구조는 유지"
      },
      "assetPlaceholders": [
        {
          "assetSlotId": "hero-main",
          "assetIntent": "현재 페이지 대표 제품 이미지 재사용",
          "placementHint": "hero 우측 주 비주얼"
        }
      ]
    }
  ]
}
```

### 7.2 나쁜 예

```json
{
  "sections": [
    {
      "slotId": "hero",
      "layoutMode": "split-left",
      "themeMode": "light-neutral",
      "presetId": "hero-premium-light",
      "fallbackLayout": "stacked-basic"
    }
  ]
}
```

이유:

- authored result가 아니라 코드 gate다
- runtime 분기와 레거시 template 시스템으로 다시 끌린다

---

## 8. Runtime이 이 문서를 받는 방식

Runtime Renderer는 이 문서를 받고 아래만 한다.

- targetGroup boundary 확인
- authored HTML 삽입
- asset placeholder 치환
- sanitize
- before/after 생성

Runtime이 하지 않는 것:

- HTML 구조 재작성
- class 재결정
- 카피 재작성
- template/family 환원

즉 runtime은 이 문서를 `해석`하는 것이 아니라 `전달받아 안전하게 적용`한다.

---

## 9. 한 줄 기준

`Authored Section HTML Package는 Design Author LLM이 직접 작성한 section HTML/Tailwind 결과를 전달하는 최소 프로토콜이며, runtime이 다시 디자인 결정을 가져가도록 허용해서는 안 된다.`
