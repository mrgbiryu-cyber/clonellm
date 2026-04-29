# Design Author Input Contract (2026-04-21)

## 목적

이 문서는 `Design Author Model (LLM)`이 실제로 어떤 입력을 받아야 하는지 정의한다.

핵심은 하나다.

`Design Author Model은 현재 코드 구조가 아니라, Concept Package와 현재 페이지 참조 정보를 입력으로 받아 section HTML/Tailwind를 직접 작성한다.`

상위 기준 문서:

- [Design Quality North Star](./admin-design-quality-north-star-2026-04-21.md)
- [Schema Guardrail](./admin-schema-guardrail-2026-04-21.md)
- [Design Authoring Architecture](./admin-design-authoring-architecture-2026-04-21.md)
- [Concept Package Minimal Schema](./admin-concept-package-minimal-schema-2026-04-21.md)

---

## 1. 한 줄 정의

`Design Author Input`은

- 방향 문서인 `Concept Package`
- 현재 페이지를 직접 읽기 위한 `Reference Context`
- 현재 수정 범위를 직접 보기 위한 `Current Section Context`

를 합친 authoring 입력이다.

---

## 2. 최상위 구조

```json
{
  "conceptPackage": {},
  "referenceContext": {},
  "currentSectionContext": {},
  "authoringRequest": {},
  "advisory": []
}
```

주의:

- 이 문서는 현재 runtime 구현 편의를 위해 축약하지 않는다.
- template/family/preset 이름은 입력에 없다.

---

## 3. conceptPackage

의미:

- Design Author가 따라야 할 방향 문서

필수:

- `pageIdentity`
- `designPolicy`
- `conceptOptions`
- `selectedConceptId`
- `executionBrief`

Design Author는 이 문서를 보고

- 왜 바꾸는지
- 무엇을 유지해야 하는지
- 어떤 컨셉이 선택되었는지
- 어느 범위를 대상으로 하는지

를 이해해야 한다.

금지:

- Design Author가 conceptPackage를 다시 요약해서 새 문서를 만들지 않는다
- conceptPackage를 template 선택 입력으로 환원하지 않는다

---

## 4. referenceContext

의미:

- 현재 페이지의 실제 시각 문맥

필수 권장 필드:

- `currentPageScreenshot`
- `currentPageHtmlExcerpt`
- `currentPageTextOutline`
- `brandReferenceAssets`
- `beforeAfterReference`

좋은 예:

```json
{
  "currentPageScreenshot": "blob-or-url",
  "currentPageHtmlExcerpt": "<main>...</main>",
  "currentPageTextOutline": [
    "LG전자 공식 메인",
    "현재 hero headline",
    "quickmenu item labels"
  ],
  "brandReferenceAssets": [
    "lg-red brand reference",
    "current hero visual asset"
  ]
}
```

주의:

- 이 문맥은 “현재 페이지를 어떻게 보고 판단할지”를 위한 것이다
- runtime 내부 상태나 legacy patch payload는 넣지 않는다

---

## 5. currentSectionContext

의미:

- target group 안의 현재 section 상태

필수 권장 필드:

- `currentSectionHtmlMap`
- `currentSectionTextMap`
- `currentSectionAssetMap`

### 5.1 currentSectionHtmlMap

예:

```json
{
  "hero": "<section>...</section>",
  "quickmenu": "<section>...</section>"
}
```

의미:

- Author가 현재 section 구조를 직접 읽을 수 있게 함

### 5.2 currentSectionTextMap

예:

```json
{
  "hero": ["현재 headline", "현재 CTA"],
  "quickmenu": ["TV", "냉장고", "세탁기"]
}
```

의미:

- Author가 현재 메시지를 유지/재작성 판단할 수 있게 함

### 5.3 currentSectionAssetMap

예:

```json
{
  "hero": [
    { "assetSlotId": "hero-main", "source": "https://..." }
  ]
}
```

의미:

- 재사용 가능한 현재 자산을 바로 볼 수 있게 함

주의:

- 이 필드는 runtime이 아니라 Author를 위한 관찰 정보다

---

## 6. authoringRequest

의미:

- 이번 실행 자체에 대한 최소 요청 정보

권장 필드:

- `authoringMode`
- `targetGroup`
- `requestedChangeLevel`
- `userFixedContent`
- `userDirectEdits`

### 6.1 authoringMode

의미:

- 이번 요청의 실행 깊이

주의:

- 이 값은 Design Author가 임의로 승격하지 않는다
- `element` 모드는 여기 들어오지 않을 수 있다

### 6.2 targetGroup

의미:

- 이번 authoring의 적용 범위

필수:

- `groupId`
- `groupLabel`
- `componentIds`
- `slotIds`
- `boundary`

### 6.3 userFixedContent

의미:

- 사용자가 절대 유지/삽입하라고 지시한 문구

예:

```json
[
  "2025 LG 히트상품",
  "구매 혜택 자세히 보기"
]
```

### 6.4 userDirectEdits

의미:

- element 또는 copy-only에 가까운 직접 수정 힌트

예:

```json
[
  {
    "slotId": "hero",
    "targetElement": "headline",
    "value": "2025 LG 히트상품"
  }
]
```

주의:

- 이 필드는 Author가 덮어쓸 수 있는 영역이 아니라 반영해야 하는 지시다

---

## 7. Design Author가 출력 전에 만족해야 하는 이해

Design Author는 입력을 보고 최소한 아래를 이해해야 한다.

1. 현재 페이지는 어떤 성격의 페이지인가
2. 이번 수정 범위는 정확히 어디까지인가
3. 무엇을 유지해야 하는가
4. 무엇을 바꿔야 하는가
5. 현재 section에서 재사용 가능한 구조/카피/자산은 무엇인가

즉 Design Author는 “빈 캔버스에서 생성”하는 것이 아니라,
`현재 페이지를 실제로 읽고, 선택된 범위 안에서 새 section HTML을 작성`하는 것이다.

---

## 8. 금지 규칙

다음은 입력에 넣지 않는다.

- `templateId`
- `familyId`
- `presetId`
- `layoutMode`
- `themeMode`
- `fallbackPolicy`

이유:

- 입력이 다시 코드 게이트로 변질된다

---

## 9. 한 줄 기준

`Design Author Input은 방향 문서와 현재 페이지의 실제 관찰 정보를 함께 전달하는 최소 프로토콜이며, Author가 직접 section HTML/Tailwind를 작성할 수 있을 만큼 충분히 구체적이어야 하지만 코드 분기를 위한 기술 제약은 포함하지 않는다.`
