# Schema Guardrail (2026-04-21)

## 목적

이 문서는 다음 단계에서 정의할

- `Concept Package`
- `Authored Section HTML Package`

계약이 다시 레거시 gate 시스템으로 변질되지 않도록 막기 위한 상위 가드레일이다.

핵심은 하나다.

`최소 계약은 전달 프로토콜이어야 하며, LLM의 디자인 자유도를 제한하는 제약 시스템이 되어서는 안 된다.`

---

## 1. 왜 이 문서가 필요한가

처음에는 모든 schema가 안전해 보인다.

예:

- `targetGroup`
- `sections`
- `content`
- `constraints`

하지만 실제 구현으로 내려갈 때 아래가 들어오기 시작한다.

- enum
- mode 문자열
- 허용값 목록
- fallback 분기
- preset 강제
- layout 타입 제한

이 순간 schema는 전달 계약이 아니라 `코드 gate`가 된다.

그 결과:

- LLM은 열린 디자인 판단을 못 한다
- 결과는 enum 목록 안에서만 움직인다
- Claude.ai/design과 같은 직접 authoring 품질에 도달하지 못한다

즉 흔들리는 지점은 “지금”이 아니라,
`필드 정의를 실제 값 수준으로 구체화하는 순간`이다.

---

## 2. 기본 원칙

### 2.1 schema는 gate가 아니다

schema의 역할:

- 단계 간 정보를 전달
- 식별자와 책임 경계를 명확히 함
- runtime이 필요한 최소 조립 정보를 가짐

schema의 역할이 아닌 것:

- 디자인 해법 제한
- 허용 가능한 시각 선택 목록 제공
- 코드 템플릿 분기 제어
- 레거시 fallback 우회 경로 제공

### 2.2 닫힌 필드는 인프라 필드만 허용한다

닫혀도 되는 필드:

- `pageId`
- `viewportProfile`
- `targetGroupId`
- `slotId`
- `componentId`
- `assetSlotId`
- `sectionHtml`

즉 식별, 전달, 서빙에 필요한 필드만 닫는다.

### 2.3 디자인 의미 필드는 열어둔다

아래는 enum으로 닫지 않는다.

- layout
- tone
- typography
- visual intent
- content intent
- brand expression
- CTA direction

이 필드들은 LLM이 채우는 열린 공간이어야 한다.

---

## 3. 금지 규칙

다음은 schema에 넣지 않는다.

### 3.1 enum 금지

금지 예:

```json
{
  "allowedLayouts": ["split-left", "split-right", "full-bleed"]
}
```

이유:

- layout을 코드 템플릿 목록으로 다시 제한한다

### 3.2 mode 문자열 금지

금지 예:

```json
{
  "themeMode": "light-neutral",
  "layoutMode": "editorial-split"
}
```

이유:

- mode 문자열은 나중에 그대로 switch/case 분기로 연결된다
- 결국 레거시 template/family 분기와 다를 바 없어짐

### 3.3 allowed/supported/requires 계열 금지

금지 예:

```json
{
  "requiresPreset": true,
  "supportedVariants": ["A", "B"],
  "allowedTone": ["neutral", "premium"]
}
```

이유:

- schema가 허용 범위를 닫아버린다

### 3.4 fallback 계약 금지

금지 예:

```json
{
  "fallbackLayout": "stacked-basic",
  "fallbackAssetMode": "reuse-first"
}
```

이유:

- fallback이 본선 계약 안에 들어오면
  품질보다 안전한 저품질 우회가 먼저 살아남는다

### 3.5 preset/template 강제 금지

금지 예:

```json
{
  "requiredTemplate": "hero-editorial-v1",
  "presetId": "hero-premium-light"
}
```

이유:

- authored HTML이 아니라 다시 코드 템플릿 선택기로 돌아간다

---

## 4. 권장 규칙

### 4.1 open text / open object 우선

좋은 예:

```json
{
  "layoutIntent": "브랜드 메시지가 먼저 읽히는 좌텍스트 우이미지 구조"
}
```

나쁜 예:

```json
{
  "layoutMode": "split-left"
}
```

### 4.2 intent는 설명이지 분기가 아니다

좋은 예:

```json
{
  "visualIntent": "라이트 톤 기반, 배경 대비는 부드럽고 CTA만 선명"
}
```

나쁜 예:

```json
{
  "themeMode": "light-neutral"
}
```

### 4.3 asset도 의도로 기록한다

좋은 예:

```json
{
  "assetIntent": "현재 페이지의 대표 이미지를 재사용하고, 부족하면 hero-main asset slot을 사용"
}
```

나쁜 예:

```json
{
  "assetPolicy": "preset-only"
}
```

### 4.4 content는 작성 공간이어야 한다

좋은 예:

```json
{
  "contentIntent": "브랜드 신뢰 강화, 1줄 헤드라인, CTA 포함"
}
```

나쁜 예:

```json
{
  "contentMode": "headline-cta-basic"
}
```

---

## 5. 필드 검토 기준

새 필드를 추가하려 할 때는 아래를 묻는다.

1. 이 필드는 식별/전달/서빙에 꼭 필요한가
2. 아니면 디자인 해법을 제한하는가
3. 이 값이 나중에 switch/case 분기로 바뀔 가능성이 높은가
4. 이 값이 enum 목록으로 닫히는가

2~4 중 하나라도 `예`이면 schema에서 제거한다.

---

## 6. 예외 허용 범위

예외는 아래에만 허용한다.

- 식별자
- boundary 존재 여부
- asset slot placeholder
- runtime sanitize 결과

즉 인프라성 필드 외에는
“코드가 해석해서 디자인을 제한하는 값”을 넣지 않는다.

---

## 7. 다음 단계에 적용하는 규칙

앞으로 아래 문서를 쓸 때 이 가드레일을 상위 기준으로 적용한다.

- `Concept Package Schema`
- `Authored Section HTML Package Schema`
- `Runtime Renderer Contract`

즉 schema를 만들 때는

- 현재 코드가 뭘 지원하는지
- 어떤 enum이 익숙한지
- 어떤 fallback이 이미 있는지

를 기준으로 쓰지 않는다.

오직:

- 전달에 필요한 최소 필드인가
- LLM authoring 자유도를 막지 않는가

만 기준으로 쓴다.

---

## 8. 한 줄 기준

`schema는 LLM이 디자인할 공간을 운반하는 최소 프로토콜이어야 하며, enum/mode/fallback으로 디자인을 제한하는 gate가 되어서는 안 된다.`
