# Design Author Output Validation (2026-04-21)

## 목적

이 문서는 `Design Author Model (LLM)`이 만든 `Authored Section HTML Package`가
`Runtime Renderer`에 들어가기 전에 어떤 최소 검증을 통과해야 하는지 정의한다.

핵심은 하나다.

`이 검증은 디자인 품질 판단이 아니라, authored result가 안전하고 온전한 형태로 전달 가능한지 확인하는 계층이다.`

상위 기준 문서:

- [Design Quality North Star](./admin-design-quality-north-star-2026-04-21.md)
- [Schema Guardrail](./admin-schema-guardrail-2026-04-21.md)
- [Design Authoring Architecture](./admin-design-authoring-architecture-2026-04-21.md)
- [Authored Section HTML Package Minimal Schema](./admin-authored-section-html-package-minimal-schema-2026-04-21.md)
- [Runtime Renderer Contract](./admin-runtime-renderer-contract-2026-04-21.md)

---

## 1. 한 줄 정의

`Design Author Output Validation`은 authored result가

- 실제로 존재하는지
- 지정된 범위를 벗어나지 않는지
- runtime이 안전하게 전달 가능한지

를 확인하는 형식/안전성 검증이다.

이 계층은 “더 예쁜가”를 판정하지 않는다.

---

## 2. 입력

최소 입력은 아래다.

```json
{
  "authoredSectionHtmlPackage": {},
  "conceptPackage": {},
  "authorInputSnapshot": {},
  "validationContext": {}
}
```

### 2.1 authoredSectionHtmlPackage

의미:

- 검증 대상인 실제 authored 결과

### 2.2 conceptPackage

의미:

- 원래 어떤 범위와 방향으로 authoring 되었는지 확인하기 위한 기준 문서

주의:

- validation이 concept을 다시 해석해 디자인 판단을 해서는 안 된다

### 2.3 authorInputSnapshot

의미:

- Design Author에게 실제로 들어갔던 입력의 최소 스냅샷

권장 필드:

- `targetGroup`
- `currentSectionContext`
- `userDirectEdits`

### 2.4 validationContext

의미:

- 전달 가능성을 확인하기 위한 최소 검증 문맥

권장 필드:

- `referencePageShell`
- `assetResolutionContext`
- `sanitizePolicy`

---

## 3. 무엇을 확인하는가

이 계층은 아래만 확인한다.

### 3.1 authored result 존재 여부

확인 내용:

- `targetGroup`이 존재하는가
- `sections` 배열이 존재하는가
- 각 `sections[*].html`이 비어 있지 않은가

### 3.2 범위 일치 여부

확인 내용:

- authored 결과가 `targetGroup`과 일치하는가
- 입력에 없는 바깥 section이 새로 포함되지 않았는가
- boundary 설명과 authored section 구성이 서로 모순되지 않는가

주의:

- 이 확인은 runtime 범위 안전성 확인이다
- “이 범위를 넓히는 게 더 좋다” 같은 판단은 금지다

### 3.3 shell 침범 여부

확인 내용:

- authored HTML이 페이지 전체 shell을 다시 쓰려 하지 않는가
- `<html>`, `<head>`, `<body>`, 전역 `<main>` 재작성처럼 본선 바깥 구조를 포함하지 않는가

### 3.4 asset placeholder 계약 준수 여부

확인 내용:

- 이미지가 임의 외부 URL에 의존하지 않는가
- 새 자산이 필요할 경우 `data-asset-slot` 또는 `assetPlaceholders`로 표현되었는가
- 현재 페이지 재사용 자산이 있으면 authored result와 연결 가능하게 남아 있는가

### 3.5 위험 요소 포함 여부

확인 내용:

- inline script
- 외부 실행 스니펫
- runtime sanitize가 제거해야 할 요소가 과도하게 포함되었는가

주의:

- sanitize가 가능하더라도 authored result가 거의 무의미해질 정도면 advisory를 남긴다

### 3.6 direct edit 보존 여부

확인 내용:

- `userDirectEdits`
- `userFixedContent`

같은 직접 지시가 authored result에서 사라지지 않았는가

---

## 4. 무엇을 확인하지 않는가

아래는 이 계층의 역할이 아니다.

### 4.1 디자인 품질 판정 금지

- 더 세련됐는가
- Claude.ai/design 수준에 가까운가
- hierarchy가 충분히 좋은가

이 판단은 `Visual Verifier`가 맡는다.

### 4.2 template/family 환원 금지

- authored HTML을 template로 분류하지 않는다
- family/preset/template 기준으로 적합성을 따지지 않는다

### 4.3 content 재조립 금지

- `sections[*].content`를 기준으로 `html`을 다시 만들지 않는다
- `html`이 정본이다

### 4.4 실행 범위 승격 금지

- `copy-only`를 `layout-only`처럼 판정 금지
- `component` 범위를 `page`처럼 확장 금지

---

## 5. 출력

최소 출력은 아래다.

```json
{
  "deliveryReadiness": {},
  "checkRecords": [],
  "advisory": []
}
```

### 5.1 deliveryReadiness

의미:

- runtime에 전달 가능한지에 대한 최종 정리

권장 필드:

- `summary`
- `readyForRuntime`
- `blockingReasons`

좋은 예:

```json
{
  "summary": "target group과 authored html은 온전하며 runtime 전달 가능",
  "readyForRuntime": true,
  "blockingReasons": []
}
```

주의:

- 이 필드는 디자인 점수나 품질 등급이 아니다

### 5.2 checkRecords

의미:

- 어떤 항목을 어떻게 확인했는지 남기는 기록

예:

- `hero section html 존재 확인`
- `boundary 밖 section 포함 없음`
- `asset slot placeholder 존재 확인`

### 5.3 advisory

의미:

- 전달은 가능하지만 후속 참고가 필요한 메모

예:

- sanitize 시 제거될 가능성이 있는 속성이 일부 포함됨
- quickmenu 이미지가 현재 페이지 자산과 직접 매핑되지 않음

---

## 6. 차단 기준

아래는 runtime 전달 차단 사유다.

- `sections[*].html` 부재
- `targetGroup` 부재
- boundary 밖 authored section 포함
- 페이지 shell 전체 재작성 시도
- asset 계약을 전혀 따르지 않아 broken delivery가 확실한 경우

주의:

- “디자인이 약하다”는 차단 사유가 아니다
- 차단은 전달 불가능 또는 안전성 훼손일 때만 가능하다

---

## 7. 구현 가드레일

이 문서를 코드로 옮길 때 아래를 금지한다.

- 검증 결과를 enum 기반 상태 머신으로 확장
- template/family/preset 적합성 검사 추가
- runtime이 authored html 일부를 자동 수정하도록 연결
- validation을 visual critic 대체물로 사용

이 계층은 `shape and safety check`다.

---

## 8. 한 줄 기준

`Design Author Output Validation은 authored result가 runtime에 안전하게 전달 가능한지 확인할 뿐, 디자인을 다시 판단하거나 재작성하지 않는다.`
