# Model Boundary And Handoff (2026-04-21)

## 목적

이 문서는 현재 섞여 있는

- 컨셉서
- 디자인 빌더
- 기술 상세

를 명확히 분리하고,

각 모델이

- 무엇을 받아야 하는지
- 무엇을 결정해야 하는지
- 무엇을 다음 단계에 넘겨야 하는지

를 고정한다.

핵심 원칙은 하나다.

`각 모델은 자기 목적에 맞는 정보만 한 번에 정확히 받아서 처리하고, 다음 모델에는 자기 결과만 정확히 전달한다.`

---

## 1. 전체 흐름

최종 흐름은 아래와 같다.

```text
User Requirements
  -> Concept Model
  -> Concept Package
  -> Design Builder Model
  -> [출력: Canonical Render Model]
  -> Renderer
  -> Draft Result
```

이후 UI는 결과를 세 영역으로 나눠 보여준다.

- 컨셉서
- 디자인 빌더
- 기술 상세

중요:

- UI 영역과 모델 역할은 1:1로 섞이지 않는다.
- 컨셉서 UI는 `Concept Package`를 보여준다.
- 디자인 빌더 UI는 `Build Execution State + Draft Result`를 보여준다.
- 기술 상세 UI는 `Canonical Render Model / Renderer Payload`를 보여준다.

---

## 2. 모델별 역할

### 2.1 Concept Model

역할:

- 사용자 요구사항을 디자인 실행 가능한 문서로 구조화
- 페이지 정체성, 정책, 컨셉안, 실행 브리프를 만든다

이 모델은 아래를 책임진다.

- 왜 바꾸는가
- 무엇을 유지하는가
- 무엇을 바꾸는가
- 어떤 레이아웃 방향을 선택하는가
- 사용자가 준 범위 힌트를 실행 가능한 target group으로 구체화하는가

이 모델은 아래를 하면 안 된다.

- family/template/primitive 결정
- preset id 직접 선택
- Tailwind class 결정
- HTML 구조 결정

출력:

- `Concept Package`

### 2.2 Design Builder Model

역할:

- Concept Package를 받아 canonical render model을 만든다
- renderer가 바로 소비할 수 있는 디자인 실행 구조를 결정한다

이 모델은 아래를 책임진다.

- 어떤 target group boundary를 적용할지
- 어떤 section composition을 쓸지
- 어떤 layout/tone/typography/assets/content/constraints를 section에 부여할지

이 모델은 아래를 하면 안 된다.

- 문제 정의를 다시 쓰기
- 유지/변경 이유를 다시 해석하기
- 컨셉서를 다시 서술하기
- 최종 HTML을 직접 만들기

출력:

- `Canonical Render Model`

### 2.3 Renderer

역할:

- Canonical Render Model을 HTML로 렌더한다

이 모델은 아래를 책임진다.

- family/template/primitive를 HTML 구조로 풀기
- tone/typography/assets/content spec을 Tailwind HTML로 변환하기

이 모델은 아래를 하면 안 된다.

- 컨셉 변경
- 범위 재해석
- 정책 재판단
- 컨셉서 내용 생성

출력:

- `HTML`

---

## 3. 전달 계약

### 3.1 User Requirements -> Concept Model

입력은 아래만 가진다.

- `pageId`
- `viewportProfile`
- `referenceContext`
- `userRequirements`
- `requestedChangeLevel`
- `targetScope`

여기에는 renderer 내부 정보가 들어가면 안 된다.

주의:

- `targetScope`는 사용자 입력 힌트다.
- Concept Model은 이 값을 최종 범위로 그대로 사용하지 않는다.
- Concept Model은 이 힌트를 `executionBrief.targetGroup`으로 구체화한다.

금지:

- `familyId`
- `templateId`
- `primitiveType`
- `presetId`
- `patch`

### 3.2 Concept Model -> Design Builder Model

Concept Model의 출력은 `Concept Package`다.

이 문서만 Builder에 전달한다.

#### Concept Package

필수 계층:

- `pageIdentity`
- `designPolicy`
- `selectedConcept`
- `executionBrief`

#### pageIdentity

- `character`
- `visualLanguage`
- `userGoal`
- `sectionFlow`

#### designPolicy

- `problemStatement`
- `hierarchyGoals`
- `mustKeep`
- `mustChange`
- `guardrails`
- `exclusions`

#### selectedConcept

- `conceptId`
- `conceptLabel`
- `narrative`
- `layoutSystem`
- `typographySystem`
- `colorSystem`
- `ctaPolicy`
- `promotionTonePolicy`

#### executionBrief

- `northStar`
- `targetGroup`
- `groupIntent`
- `preserveRules`
- `changeRules`
- `excludedChoices`
- `builderInstructions`
- `builderToolAccess`

#### builderToolAccess

`builderToolAccess`는 기술 상세가 아니라 실행 허용 범위만 담는다.

허용 필드:

- `allowedCompositionModes`
- `canAddNewSections`
- `canRemoveExistingSections`
- `canReorderSectionsInsideGroup`
- `maxVisualChangeStrength`

금지 필드:

- `familyId`
- `templateId`
- `primitiveType`
- `presetId`
- `className`
- `cssValue`

중요:

- 이 단계에서 이미 “왜/무엇/어떤 방향”은 끝나 있어야 한다.
- Builder는 이 문서를 보고 다시 기획하면 안 된다.

### 3.3 Design Builder Model -> Renderer

Builder의 출력은 `Canonical Render Model`이다.

이 모델만 Renderer에 전달한다.

#### Canonical Render Model

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

- `patch`는 bridge 전용 필드다.
- `section spec`이 완전히 채워진 경우 `patch`는 무시한다.
- `section spec`이 없는 슬롯에만 fallback으로 사용한다.
- `patch` fallback이 발생하면 advisory에 기록한다.
- Renderer의 본선 입력은 항상 `section spec`이어야 한다.

### 3.4 Renderer -> Draft Result

Renderer 결과는 아래만 저장하면 된다.

- `draftSummary`
- `canonicalRenderModel`
- `renderedHtmlReference`
- `advisory`

선택 저장:

- `operations`
- `componentComposition`
- `debugPayload`

선택 저장물은 본선 결과 설명이 아니라 기술 확인용이다.

---

## 4. UI 영역 분리

### 4.1 컨셉서 패널

보여줄 것:

- 페이지 정체성
- 문제 정의
- 정보 위계 재설계
- 범위 통제
- 선택된 컨셉안
- 섹션별 방향
- 유지 요소
- 변경 요소

보여주면 안 되는 것:

- family/template
- primitive
- preset id
- renderer payload
- build status
- draftBuildId

즉 컨셉서는 `디자인 문서`여야 한다.

### 4.2 디자인 빌더 패널

보여줄 것:

- 어떤 컨셉서 기준으로 실행하는지
- 실행 가능 여부
- 실행 중 / 완료 상태
- 최신 draft 결과
- 미리보기 / 비교 열기

보여주면 안 되는 것:

- 컨셉서 본문 반복
- 정책 문장 재출력
- 상세 preset 목록
- primitive 구조

즉 디자인 빌더는 `실행 패널`이어야 한다.

### 4.3 기술 상세 패널

보여줄 것:

- family/template
- primitive
- asset preset
- renderer payload
- debug/advisory 정보

이 패널은 기본적으로 접혀 있어야 한다.

즉 기술 상세는 `디버그 패널`이어야 한다.

---

## 5. 지금 섞여 있는 대표 문제

현재 잘못 섞여 있는 예:

- `레이아웃 전략`, `유지 요소`, `주요 변경 요소`
  - 이것은 컨셉서 영역이다.

- `실행 기준`, `실행 상태`, `최근 실행 완료`
  - 이것은 디자인 빌더 영역이다.

- `editorial-label`, `hero-premium-light`, `badge + headline + support + action`
  - 이것은 기술 상세 영역이다.

- `모델 판단 메모`
  - 이것도 기본은 기술 상세다.

즉 지금 문제는 정보가 없는 것이 아니라, `정보가 잘못된 패널에 들어가 있는 것`이다.

---

## 6. 금지 규칙

### 6.1 Concept Model 금지

- HTML 생성 금지
- Tailwind class 생성 금지
- primitive/family/template 선택 금지

### 6.2 Design Builder Model 금지

- 문제 정의 재작성 금지
- 컨셉서 서술 반복 금지
- slot-specific 카피 하드코딩 금지

### 6.3 Renderer 금지

- 범위 재해석 금지
- 정책 재판단 금지
- 컨셉 변경 금지

### 6.4 UI 금지

- 컨셉서 패널에 기술 필드 노출 금지
- 디자인 빌더 패널에 컨셉서 본문 반복 금지
- 기본 화면에 debug payload 노출 금지

---

## 7. 다음 단계

다음 구현 전 먼저 확정할 것:

1. `Concept Package Schema`
2. `Canonical Render Model Schema`
3. `UI Ownership Matrix`

이 세 가지가 먼저 닫혀야,

- 컨셉서 렌더
- 디자인 빌더 패널
- 기술 상세 패널

을 정확히 나눌 수 있다.

---

## 8. 한 줄 기준

`컨셉서는 방향을 결정하고, 디자인 빌더는 실행을 결정하고, 렌더러는 HTML을 만든다. 각 단계는 자기 역할만 하고 다음 단계에는 자기 결과만 넘긴다.`
