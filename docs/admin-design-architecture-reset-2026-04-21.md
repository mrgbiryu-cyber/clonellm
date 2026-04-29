# Design Architecture Reset (2026-04-21)

## 목적

이 문서는 현재 시스템을 다시 처음부터 정렬하기 위한 `최종 목표 아키텍처`를 정의한다.

최상위 기준 문서:

- [Design Quality North Star](./admin-design-quality-north-star-2026-04-21.md)
- [Schema Guardrail](./admin-schema-guardrail-2026-04-21.md)

이 문서의 목적은 두 가지다.

1. 레거시 구조에 다시 끌려가지 않도록 본선 기준을 고정한다.
2. 임시 구현, 브리지 분기, slot 특화 하드코딩 없이 설계 원칙을 먼저 확정한다.

이 문서는 구현 문서가 아니라 `본선 설계 문서`다.

---

## 1. 우리가 원래 하려던 것

우리가 만들고 싶은 것은 아래다.

- LG 원본 페이지를 참고한다.
- 요구사항을 디자인 관점으로 구조화한다.
- 컨셉서를 만든다.
- 그 컨셉서를 기반으로 renderer가 바로 소비할 수 있는 `canonical render model`을 만든다.
- 이 모델로 draft를 렌더하고 비교한다.

즉 목표는 `국소 패치 시스템`이 아니라 `디자인 실행 시스템`이다.

---

## 2. 하지 않을 것

이번 리셋 이후 아래는 본선에 넣지 않는다.

- slot 이름에 직접 의존하는 생성기
- `hero`, `quickmenu`, `summary`, `sticky` 전용 하드코딩 분기
- 특정 카피 문자열을 코드에 직접 넣는 deterministic 시안 생성
- planner/composer/builder/critic/recovery 같은 다단 해석 루프
- visual critic hard gate
- compare rerun
- recovery router
- patch를 canonical 출력으로 취급하는 구조

즉 `임시로라도 먼저 붙이자`는 방식은 금지한다.

---

## 3. 본선의 단일 흐름

최종 본선은 아래 하나만 가진다.

```text
Requirements
  -> Concept Package
  -> Builder
  -> Canonical Render Model
  -> Renderer
  -> Draft Save
  -> Clone / Compare
```

여기서 중요한 점:

- `Concept Package`가 정책과 방향을 담당한다.
- `Builder`는 판단이 아니라 실행을 담당한다.
- `Renderer`는 canonical model만 보고 그린다.
- Clone/Compare는 결과를 보여주는 채널일 뿐 생성 로직이 아니다.

---

## 4. 핵심 원칙

### 4.1 문서 타입은 하나다

사용자에게 보이는 문서 타입은 `컨셉서` 하나다.

차이는 문서 타입이 아니라 생성 방식 메타다.

- `provider = local`
- `provider = llm`

즉 Local과 LLM은 서로 다른 문서가 아니라 `같은 컨셉서의 생성 경로`다.

### 4.2 정책은 Builder 앞에 있다

디자인 정책은 Builder가 만들면 안 된다.

Builder 앞에서 이미 아래가 정리되어 있어야 한다.

- 페이지 정체성
- 디자인 정책
- 컨셉안
- 실행 브리프

Builder는 위 문서를 받아 `render model`을 만든다.

### 4.3 canonical은 patch가 아니다

canonical output은 `patch`가 아니라 `render/composition model`이다.

즉 canonical은 아래를 직접 가져야 한다.

- target group boundary
- layout
- tone
- typography
- assets
- content intention
- constraints

`patch`나 `operations`는 존재하더라도 하위 호환 bridge일 뿐이다.

### 4.4 target은 slot이 아니라 group이다

본선은 `slot-first`가 아니라 `target-group-first`다.

예:

- `top-stage`
- `service-entry`
- `purchase-cluster`

Builder는 “hero를 바꿔라”가 아니라 “top-stage를 재구성하라”를 받아야 한다.

### 4.5 renderer가 구조의 주인이다

Builder는 renderer가 이해할 수 있는 모델만 만든다.

즉 출력의 주인은 renderer이고,
레거시 patch schema나 critic score가 아니다.

---

## 5. 본선 모듈

본선은 아래 5개 모듈만 가진다.

### 5.1 Requirements Normalizer

역할:

- 사용자 입력을 정리
- 페이지/뷰포트/타겟 그룹/범위를 명시
- 컨셉서 생성 입력으로 변환

출력:

- `normalizedRequirements`

### 5.2 Concept Provider

역할:

- normalized requirements를 바탕으로 컨셉서 생성

provider 종류:

- `local`
- `llm`

출력은 동일해야 한다.

출력:

- `conceptPackage`

### 5.3 Builder

역할:

- concept package를 바탕으로 canonical render model 생성
- renderer-native 구조 선택

출력:

- `canonicalRenderModel`

Builder는 아래를 하면 안 된다.

- 특정 slot 전용 문구 생성
- hardcoded hero/quickmenu formatter
- critic retry loop 실행

### 5.4 Renderer

역할:

- canonical render model을 HTML로 렌더
- target group boundary 안쪽만 새 구조로 그림

입력:

- `canonicalRenderModel`
- `reference page snapshot`

출력:

- `after HTML`

### 5.5 Draft Store

역할:

- 컨셉서와 canonical render model 저장
- clone/compare가 읽을 수 있게 제공

출력:

- `draftBuild`

---

## 6. 핵심 계약

### 6.1 Normalized Requirements

필수 필드:

- `pageId`
- `viewportProfile`
- `targetGroup`
- `requestedChangeLevel`
- `referenceContext`
- `userRequirements`

### 6.2 Concept Package

컨셉서는 아래 4층을 가진다.

#### A. Page Identity

- `character`
- `visualLanguage`
- `userGoal`
- `sectionFlow`

#### B. Design Policy

- `problemStatement`
- `hierarchyGoals`
- `mustKeep`
- `mustChange`
- `guardrails`
- `exclusions`

#### C. Concept Plan

- `conceptId`
- `conceptLabel`
- `narrative`
- `layoutSystem`
- `typographySystem`
- `colorSystem`
- `ctaPolicy`
- `promotionTonePolicy`

#### D. Execution Brief

- `northStar`
- `targetGroupIntent`
- `selectedConcept`
- `preserveRules`
- `changeRules`
- `exclusionRules`
- `builderInstructions`
- `builderToolAccess`

### 6.3 Canonical Render Model

필수 필드:

- `pageId`
- `viewportProfile`
- `rendererSurface`
- `renderIntent`
- `targetGroup`
- `sections`

#### renderIntent

- `modelVersion`
- `compositionMode`
- `selectedConceptId`
- `selectedConceptLabel`
- `northStar`
- `themeTone`
- `guardrails`

#### targetGroup

- `groupId`
- `groupLabel`
- `componentIds`
- `slotIds`
- `boundary`

#### sections[*]

- `slotId`
- `componentId`
- `familyId`
- `templateId`
- `layout`
- `tone`
- `typography`
- `assets`
- `content`
- `constraints`
- `primitiveTree`

주의:

- `primitiveTree`는 renderer bridge다.
- `patch`는 canonical 필수 필드가 아니다.
- canonical 의미는 `section spec`에서 끝나야 한다.

### 6.4 Draft Build

필수 저장물:

- `conceptPackage`
- `canonicalRenderModel`
- `summary`
- `advisory`

선택 저장물:

- `operations`
- `componentComposition`

선택 저장물은 레거시 확인용일 뿐 본선 기준이 아니다.

---

## 7. Clone / Compare의 역할

`clone`과 `compare`는 결과 표시 채널이다.

이 둘은 생성 로직을 가지면 안 된다.

외부 계약은 아래 두 상태만 가진다.

- `before`
- `after`

즉 public contract에서 아래는 제거 대상이다.

- reinject
- rebuild
- fallback-final
- retry-aware branch

---

## 8. Local과 LLM의 위치

### 8.1 Local

Local은 테스트용 deterministic provider다.

역할:

- 입력 계약 검증
- 컨셉서 구조 검증
- builder/renderer 연결 검증

Local은 아래를 하면 안 된다.

- slot-specific hardcoded 카피 생산
- 특정 페이지 전용 시안 생성기 역할
- 본선 디자인 품질의 대체물 역할

### 8.2 LLM

LLM은 표현 확장 provider다.

역할:

- 더 풍부한 컨셉서 생성
- 더 다양한 컨셉안 제안

LLM도 결국 같은 `conceptPackage`만 출력해야 한다.

즉 local과 llm은 출력 계약이 같아야 한다.

---

## 9. 삭제/유지 기준

### 유지

- page identity 데이터
- design policy/brief 데이터
- renderer에서 재사용 가능한 순수 함수
- draft 저장/불러오기
- clone/compare shell

### 본선 제외

- builder-v2 orchestration
- composer
- critic retry loop
- recovery router
- compare rerun
- patch-centric runtime translation
- slot-specific deterministic local builder

### 삭제 후보

- `/api/llm/plan`
- `/api/llm/build`
- builder-v2 mainline modules
- visual critic hard gate 흐름

---

## 10. 다음 설계 단계

구현 전 다음 3개를 먼저 확정해야 한다.

1. `Concept Package` JSON 계약
2. `Canonical Render Model` JSON 계약
3. `Renderer Consumption Contract`

이 3개가 먼저 고정되기 전에는 구현하지 않는다.

---

## 11. 현재 상태에 대한 판단

현재 코드베이스는 일부 방향은 맞지만, 아직 아래 문제가 남아 있다.

- canonical model을 말하면서도 생성부가 slot-specific 하드코딩에 끌려감
- local provider가 범용 provider보다 전용 시나리오 생성기처럼 동작함
- 레거시 renderer/patch 개념이 본선 판단을 다시 끌어감

따라서 다음 단계는 기능 추가가 아니라,

- `계약 먼저 확정`
- `slot-specific 생성 제거`
- `renderer 소비 계약 분리`

순서여야 한다.

---

## 12. 한 줄 기준

이 리셋의 기준은 아래 한 줄이다.

`우리는 patch 시스템을 고치는 것이 아니라, 컨셉서에서 render model로 직결되는 디자인 실행 아키텍처를 다시 세운다.`
