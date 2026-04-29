# Preservation / Interference Debug Method

Date: 2026-04-22
Owner: Codex
Status: Active

## 목적

이 문서는 현재 디자인 파이프라인 디버깅을 어떻게 해야 하는지에 대한 방법론을 고정한다.

핵심 목표는 다음 둘이다.

1. 원문 Markdown과 authored HTML이 중간 단계에서 훼손되지 않았는지 확인한다.
2. 레거시 코드가 중간에서 새 의미를 강제로 넣고 있는지 확인한다.

이 문서는 “각 단계가 제 역할을 잘 했는가”를 묻지 않는다.
대신 “각 단계가 원문을 보존했는가, 아니면 개입했는가”를 묻는다.

## 상위 기준

- [Design Quality North Star](./admin-design-quality-north-star-2026-04-21.md)
- [Schema Guardrail](./admin-schema-guardrail-2026-04-21.md)
- [Markdown First Authoring Flow](./admin-markdown-first-authoring-flow-2026-04-22.md)
- [Design Authoring Architecture](./admin-design-authoring-architecture-2026-04-21.md)

## 왜 이 방법을 쓰는가

현재 시스템의 가장 큰 위험은 다음 둘이다.

1. 중간 단계가 원문을 다시 요약하거나 재구성해서 의미를 바꾼다.
2. 테스트 결과를 보고 임시 보정을 얹다가 다시 레거시 중심 구조로 끌려간다.

따라서 디버깅의 핵심은 기능 성공/실패 자체보다 다음을 먼저 확인하는 것이다.

- source preserved?
- identifier preserved?
- runtime interference?
- provider truncation?

## 방법론

디버깅은 다음 4단계로 한다.

### 1. 원칙 기반 코드 감사

먼저 코드를 읽고 다음을 찾는다.

- 원문 Markdown을 다시 요약하는가
- target section identifier를 재계산하는가
- target scope를 중간에서 다시 정하는가
- runtime이 content/html을 다시 조합하는가
- enum, mode, fallback이 다시 숨어 들어가는가

이 단계의 목적은 “정답 구현”을 찾는 것이 아니라 “개입 지점”을 찾는 것이다.

### 2. 가장 얇은 E2E 테스트

그 다음 최소 케이스 하나만 끝까지 태운다.

예:

- page: home
- target group: hero + quickmenu
- model: structure test profile
- flow: requirement -> concept -> author -> runtime preview

이 단계에서는 기능을 많이 붙이지 않는다.
원문과 identifier가 끊기지 않고 흐르는지만 본다.

### 3. 실패 유형 분류

실패를 바로 고치지 않고 아래 유형으로 먼저 분류한다.

#### preservation failure

원문 또는 핵심 식별자가 중간 단계에서 사라짐

예:

- selected concept가 다음 단계에 안 넘어감
- section identifiers가 build 단계에서 비어짐

#### interference failure

중간 단계가 새 의미를 강제로 넣음

예:

- runtime이 content 필드로 html을 덮어씀
- buildInput이 target scope를 다시 정함

#### capability failure

현재 runtime 또는 parser가 그 형식을 처리할 능력이 없음

예:

- authored markdown은 정상인데 runtime projection이 지원하지 못함

#### provider / truncation failure

모델이나 provider가 응답을 중간에서 끊음

예:

- finishReason=length
- reasoning token 과다
- html fence 미완성

### 4. 최소 보정

보정은 항상 아래 순서로 한다.

1. preserve
2. non-interference
3. support
4. quality tuning

즉 품질 튜닝보다 먼저 원문 보존과 비개입을 닫는다.

## 계측 원칙

계측은 허용하되, 계측이 새 중간 개입층이 되면 안 된다.

### 허용되는 계측

- source preserved 여부
- identifier preserved 여부
- runtime interference 여부
- provider truncation 여부

### 금지되는 계측

- 다음 단계의 정본으로 재사용되는 debug 필드
- 원문 대신 쓰이기 시작하는 summary packet
- build/runtime이 실제 입력처럼 소비하는 trace 값

## trace 해석 원칙

trace는 세 종류로 나눈다.

### source-of-truth

정본 문서 계층

- Requirement Markdown
- Concept Markdown
- Authored Section Markdown

### handoff-debug

정본이 다음 단계로 그대로 넘어갔는지 보는 진단값

- selected concept identifier
- target group identifier
- declared section identifiers
- projected section identifiers

### runtime-debug

현재 코드가 이 문서를 서빙할 수 있는지 보는 진단값

- section boundary keys
- current section html keys
- asset slot keys

runtime-debug는 설계 기준이 아니다.
현재 코드 준비 상태를 보는 보조 관측값일 뿐이다.

## 지금 단계의 적용 방식

현재 코드에서는 다음 순서로 적용한다.

1. preservation / interference 체크리스트로 코드 감사
2. 가장 얇은 UI 또는 direct build 테스트 1회
3. 실패를 4가지 유형 중 하나로 분류
4. 최소 보정 후 다시 같은 얇은 테스트 재실행

## 하지 말아야 할 것

- 테스트가 실패했다고 곧바로 fallback이나 loop를 본선 해결책으로 넣지 않는다.
- trace가 비었다는 이유로 그 자리를 자동 재생성 로직으로 메우지 않는다.
- runtime-debug 값을 상위 문서의 진실처럼 취급하지 않는다.
- provider 실패를 parser 보정으로 덮지 않는다.

## 한 줄 원칙

디버깅의 목적은 각 단계의 역할을 강제하는 것이 아니라, 원문이 보존되었는지와 중간 개입이 있었는지를 확인하는 것이다.
