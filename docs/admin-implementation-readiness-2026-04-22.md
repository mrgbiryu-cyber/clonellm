# Implementation Readiness (2026-04-22)

## 목적

이 문서는 문서 계약이 닫힌 현재 시점에서
언제부터 코드 구현으로 내려가도 되는지,
그리고 구현 중 어떤 회귀를 금지해야 하는지 고정한다.

핵심은 하나다.

`이제부터는 문서를 더 늘리는 단계가 아니라, 새 계약을 기준으로 현재 코드를 잘라내고 첫 본선 구현 slice를 여는 단계다.`

상위 기준 문서:

- [Design Quality North Star](./admin-design-quality-north-star-2026-04-21.md)
- [Schema Guardrail](./admin-schema-guardrail-2026-04-21.md)
- [Design Authoring Architecture](./admin-design-authoring-architecture-2026-04-21.md)
- [Concept Package Minimal Schema](./admin-concept-package-minimal-schema-2026-04-21.md)
- [Design Author Input Contract](./admin-design-author-input-contract-2026-04-21.md)
- [Authored Section HTML Package Minimal Schema](./admin-authored-section-html-package-minimal-schema-2026-04-21.md)
- [Design Author Output Validation](./admin-design-author-output-validation-2026-04-21.md)
- [Runtime Renderer Contract](./admin-runtime-renderer-contract-2026-04-21.md)
- [Visual Verifier Contract](./admin-visual-verifier-contract-2026-04-21.md)

---

## 1. 현재 상태

문서 계약은 1차로 닫혔다.

이미 정의된 것:

1. 품질 북극성
2. schema guardrail
3. concept package 최소 계약
4. design author 입력 계약
5. authored section html package 최소 계약
6. output validation 계약
7. runtime renderer 계약
8. visual verifier 계약

즉 다음 단계는:

- 계약을 다시 짜는 것
- 현재 코드에 맞춰 계약을 비트는 것

이 아니라

- 현재 코드가 새 계약을 어디서 위반하는지 확인
- 위반 지점을 삭제/격리/신규 구현 대상으로 분류

하는 것이다.

---

## 2. 구현 시작 가능 조건

아래 조건이 충족되면 구현을 시작해도 된다.

### 2.1 필수 조건

- Concept Package 계약이 닫혀 있다
- Design Author Input 계약이 닫혀 있다
- Authored Section HTML Package 계약이 닫혀 있다
- Runtime Renderer 계약이 닫혀 있다
- Visual Verifier 계약이 닫혀 있다

### 2.2 구현 전 확인 조건

- 현재 코드 audit이 문서 기준으로 작성되어 있다
- audit 결과를 보고 문서를 고치지 않는다
- 새 구현 slice가 “레거시 연장”이 아니라 “새 본선 최소 경로”로 정의되어 있다

### 2.3 구현 시작 선언

다음 문장이 참이면 구현 시작 가능이다.

`이제부터는 현재 코드를 참고하되, 새 계약에 맞지 않는 부분은 살리지 않고 잘라낸다.`

---

## 3. 구현 중 절대 금지

### 3.1 계약 회귀 금지

- enum 추가 금지
- mode 문자열 추가 금지
- fallback 계약 추가 금지
- preset/template/family를 본선 계약에 넣기 금지

### 3.2 runtime 회귀 금지

- runtime이 authored html을 재작성하는 경로 추가 금지
- runtime이 content로 html을 다시 조합하는 경로 추가 금지
- runtime이 디자인 판단을 다시 하는 경로 추가 금지

### 3.3 bridge 확장 금지

- `patch`, `operations`, `componentComposition`를 본선 결과처럼 확장 금지
- 새 slice를 legacy draft shape에 맞추기 위해 의미를 축소 금지

### 3.4 구현 편의 우회 금지

- “일단 legacy 경로에 꽂고 나중에 교체” 금지
- 새 slice를 기존 `inject/reinject` 본선에 얹기 금지

---

## 4. 구현의 단위

첫 구현은 페이지 완성이 아니라 경로 완성이다.

즉 구현 단위는 아래다.

1. `Concept Package -> Design Author Input`
2. `Authored Section HTML Package`
3. `Runtime Renderer delivery`
4. `before/after`
5. `draft save`

이 다섯 개가 한 번 연결되면 첫 slice가 성립한다.

주의:

- 15개 페이지 전체 대응은 첫 slice 목표가 아니다
- page type 분기는 첫 slice 목표가 아니다
- 기존 clone 조립 로직을 더 똑똑하게 만드는 것도 목표가 아니다

---

## 5. 구현 우선순위

### 5.1 먼저 할 것

- 현재 코드와 새 계약의 충돌 지점 audit
- 삭제/격리/신규 구현 대상 분류
- 첫 runtime slice 경계 확정

### 5.2 그 다음 할 것

- 새 runtime renderer 최소 경로 구현
- authored html 삽입 경로 구현
- asset placeholder 치환 구현
- before/after 생성
- draft 저장 연결

### 5.3 아직 하지 말 것

- legacy inject 함수 보강
- builder-v2 recovery/critic 루프 유지보수
- family/template/preset 기반 확장
- 전체 페이지 타입 대응

---

## 6. 한 줄 기준

`구현은 이제 시작해도 되지만, 시작 조건은 “현재 코드가 무엇을 할 수 있나”가 아니라 “새 계약을 위반하는 부분을 얼마나 빨리 잘라낼 수 있나”다.`
