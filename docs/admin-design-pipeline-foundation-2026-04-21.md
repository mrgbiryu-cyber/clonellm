# Design Pipeline Foundation (2026-04-21)

## 목적

이 문서는 기존 `builder-v2` 배선을 기준으로 하지 않고,

- `Claude Design` 스타일의 design-first 흐름
- `clone-content`를 단일 진실 원천으로 삼는 렌더 구조

를 기준으로 새 파이프라인의 뼈대를 정의한다.

이 문서는 구현 기준 문서다.

---

## 1. 새 파이프라인의 기준

새 파이프라인은 아래 원칙만 따른다.

1. `clone render`가 가장 먼저 정의된다.
2. Builder는 `clone render model`을 만든다.
3. Renderer는 `clone render model`만 보고 화면을 만든다.
4. critic은 저장용 보고서일 뿐 완료 조건이 아니다.
5. target은 slot 하드코딩이 아니라 `target group`으로 해석한다.

---

## 2. 목표 흐름

```text
User Input
  -> Identity / Policy Normalizer
  -> Planner
  -> Concept Plan
  -> Execution Brief
  -> Builder
  -> Clone Renderer
  -> Draft Save
  -> Advisory Critic
```

제외 대상:

- Composer
- structural retry loop
- compare rerun
- recovery router
- visual critic hard gate

---

## 3. 핵심 계약

### 3.1 Build Request

입력 계약은 아래 계층을 가진다.

- `pageId`
- `viewportProfile`
- `targetGroup`
- `pageIdentity`
- `designPolicy`

### 3.2 Page Identity

`pageIdentity`는 이 페이지가 어떤 페이지인지 정의한다.

필수 필드:

- `character`
- `visualLanguage`
- `userGoal`
- `sectionFlow`

### 3.3 Design Policy

`designPolicy`는 디자인 생성을 위한 정책 문서다.

이 계층은 Builder가 만들지 않는다.

필수 필드:

- `problemStatement`
- `hierarchyGoals`
- `mustKeep`
- `mustChange`
- `guardrails`
- `exclusions`
- `layoutDirections`

### 3.4 Target Group

`targetGroup`은 slot 배열이 아니라 cluster 단위 디자인 대상을 뜻한다.

필수 필드:

- `groupId`
- `groupLabel`
- `componentIds`
- `slotIds`
- `layoutIntent`

### 3.5 Concept Plan

`conceptPlan`은 A/B 같은 설계 방향 문서다.

필수 필드:

- `conceptId`
- `conceptLabel`
- `narrative`
- `layoutSystem`
- `typography`
- `colorSystem`
- `ctaPolicy`
- `promotionTonePolicy`

### 3.6 Execution Brief

`executionBrief`는 Builder에 바로 전달되는 실행 문서다.

필수 필드:

- `northStar`
- `targetGroup`
- `selectedConcept`
- `guardrails`
- `excludedChoices`
- `builderInstructions`
- `builderToolAccess`

### 3.7 Clone Render Model

새 파이프라인의 핵심 산출물은 `clone render model`이다.

이 모델은 renderer가 바로 소비할 수 있어야 한다.

필수 필드:

- `pageId`
- `viewportProfile`
- `rendererSurface`
- `renderIntent`
- `targetGroup`
- `sections`

`renderIntent`는 patch가 아니라 시각적 의도를 직접 담는 계층이다.

필수 필드:

- `modelVersion`
- `designChangeLevel`
- `compositionMode`
- `selectedConceptId`
- `selectedConceptLabel`
- `layoutDirection`
- `themeTone`
- `northStar`
- `guardrails`

`targetGroup`은 단순 목록이 아니라 boundary를 가져야 한다.

추가 필드:

- `boundary.mode`
- `boundary.preserveOutsideGroup`
- `boundary.entrySlotId`
- `boundary.exitSlotId`

각 section은 아래 필드를 가진다.

- `slotId`
- `componentId`
- `familyId`
- `templateId`
- `primitiveTree`
- `patch`
- `priority`
- `layout`
- `tone`
- `typography`
- `assets`
- `content`
- `constraints`

즉 canonical 모델은 `patch model`이 아니라 `section composition model`이어야 한다.

`patch`는 실제 렌더러 브리지용 하위 필드로 남고,

- 어떤 레이아웃을 쓸지
- 어떤 톤을 쓸지
- 어떤 타이포를 쓸지
- 어떤 자산 정책을 쓸지
- 무엇을 유지하고 무엇을 바꿀지

는 각 section spec에 직접 기록한다.

### 3.8 Draft Result

draft는 아래만 저장하면 된다.

- `summary`
- `cloneRenderModel`
- `conceptPlan`
- `executionBrief`
- `operations`
- `componentComposition`
- `advisory`

---

## 4. clone 구조 기준

새 파이프라인에서 `clone-content`는 아래 두 상태만 가진다.

- `before`: 원본 기준 snapshot
- `after`: draft 기준 snapshot

그 외 `live`, `rebuilt`, `reinject`, `fallback-final` 같은 중간 상태를 clone public contract에 노출하지 않는다.

즉 외부에서 보면 항상 아래 둘만 존재해야 한다.

```text
clone(before)
clone(after)
```

Renderer 내부에서 intermediate step이 있더라도, public contract에는 단일 결과만 보여야 한다.

---

## 5. 구현 순서

1. `design-pipeline/` namespace 생성
2. request / target / clone model 계약 정의
3. clone canonical render 함수 분리
4. `conceptPlan / executionBrief` 계약 정의
5. draft 저장 구조를 `cloneRenderModel` 중심으로 준비
6. 이후에 Planner/Builder만 연결

이번 단계에서는 여기까지를 목표로 한다.

---

## 6. 재사용 원칙

기존 코드에서 가져와도 되는 것은 아래뿐이다.

- tailwind renderer 함수
- primitiveTree / componentComposition 자료형
- draft 저장 함수
- page identity / slot guidance 정규화 결과
- concept / brief compiler
- builder tool registry

기존 코드에서 그대로 가져오면 안 되는 것은 아래다.

- `builder-v2` 오케스트레이션 배선
- critic retry 구조
- recovery router
- clone reinject 다중 경로

---

## 7. 이번 단계 산출물

이번 단계의 산출물은 `새 구조의 실서비스 연결`이 아니라:

- 새 namespace
- 새 계약
- concept / brief 구조
- clone canonical model
- 새 아키텍처 기준 문서

이다.
