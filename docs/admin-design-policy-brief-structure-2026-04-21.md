# Design Policy / Concept / Brief Structure (2026-04-21)

## 목적

기존 기획 문서를 `디자인 실행 이전 문서`로 재정의한다.

핵심 변경:

1. 기획 문서를 `컨셉안`과 `브리프`로 분리한다.
2. `가드레일`과 `제외 판단 이유`를 정책 문서의 일부로 명시한다.
3. Builder는 정책을 생성하지 않고, 정책을 전달받아 실행한다.
4. Builder에는 가능한 도구와 표현 surface를 충분히 제공하되, 금지선은 문서로 고정한다.

---

## 1. 문서 계층

새 구조는 아래 4개 문서 계층으로 나눈다.

### 1. Page Identity

페이지 자체의 정체성.

- character
- visualLanguage
- userGoal
- sectionFlow

### 2. Design Policy

디자인 생성을 위한 정책.

- 문제 정의
- 정보 위계 목표
- 반드시 유지할 것
- 반드시 바꿀 것
- 가드레일
- 제외 판단 이유

### 3. Concept Plan

A/B 같은 디자인 방향 정의.

- typography
- color system
- layout system
- cta policy
- promotion tone policy
- concept narrative

### 4. Execution Brief

Builder에게 전달되는 실행 문서.

- north star
- selected concept
- target group
- builder instructions
- guardrails
- excluded choices
- tool access

---

## 2. 11. 가드레일

가드레일에는 아래 범주의 내용을 넣는다.

- 페이지 정체성과 충돌하는 표현
- 요구사항에서 허용하지 않은 스타일
- 브랜드 톤을 무너뜨리는 장치
- 범위 밖 구조 변경

예:

- 일부 슬롯만 다크 테마 분리 금지
- 할인몰형 뱃지 / 과장 할인 카피 금지
- 섹션 간 시각 언어 단절 금지
- target group 밖 구조 재배치 금지

---

## 3. 12. 미결 사항 / 제외 판단 이유

여기에는 아래를 적는다.

- 이번 시안에서 의도적으로 제외한 것
- 왜 제외했는지
- Builder가 만지면 안 되는 이유

예:

- 모바일 반응형 제외: 현재 데스크톱 우선 검증 단계
- 전체 GNB 재설계 제외: target group 범위 밖
- 이미지 생성 제외: 현재는 레이아웃과 hierarchy 검증이 우선
- price/spec 변경 제외: 사실 데이터 보호 필요

---

## 4. Builder 전달 구조

Builder는 아래 순서로 입력받아야 한다.

1. Page Identity
2. Design Policy
3. Selected Concept Plan
4. Execution Brief
5. Allowed Tool Access

중요:

- Builder는 `무엇이 좋은 디자인인가`를 처음부터 발명하지 않는다.
- Builder는 `정해진 정책과 컨셉을 어떻게 실행할 것인가`를 결정한다.

---

## 5. Builder Tool Access

Builder에는 아래 범주의 도구를 충분히 열어준다.

- primitive family 선택
- template replacement
- component patch
- typography preset
- color/tone preset
- spacing / density preset
- asset binding
- section composition option

단, 아래는 정책 계층에서 금지할 수 있다.

- 특정 theme 사용
- 과도한 promotion tone
- 범위 밖 구조 변경
- unsupported asset generation

---

## 6. 결론

기획 문서는 더 이상 `설명서`가 아니라 `디자인 정책 패키지`여야 한다.

즉:

- `정체성`
- `정책`
- `컨셉안`
- `실행 브리프`

로 분리하고, Builder는 이 패키지를 받아 실행하는 구조로 가야 한다.
