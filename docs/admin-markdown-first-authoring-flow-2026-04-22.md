# Markdown-First Authoring Flow (2026-04-22)

## 목적

이 문서는 새 본선에서

- 사용자 요구사항
- 컨셉서
- Design Author 입력
- Design Author 출력

을 `JSON 중심 계약`이 아니라
`Markdown 원문 중심 흐름`으로 다시 고정한다.

핵심 판단은 아래다.

`LLM이 읽는 문서는 가능한 한 원문 Markdown으로 유지하고, 코드는 마지막 delivery 단계에서만 최소 projection을 수행한다.`

상위 기준:

- [Design Quality North Star](./admin-design-quality-north-star-2026-04-21.md)
- [Design Authoring Architecture](./admin-design-authoring-architecture-2026-04-21.md)
- [Schema Guardrail](./admin-schema-guardrail-2026-04-21.md)
- [Runtime Renderer Contract](./admin-runtime-renderer-contract-2026-04-21.md)

---

## 1. 왜 Markdown-first 인가

현재까지의 위험은 두 가지였다.

1. 현재 코드에 schema가 끌려감
2. schema 자체가 LLM의 판단 범위를 좁힘

특히 아래 같은 구조는 결국 다시 품질을 제한한다.

- enum
- mode string
- preset/template/family 중심 계약
- strict JSON only output
- 중간 packet이 원문 문서를 재해석하는 구조

반대로 Claude.ai/design 류의 강점은 아래에 있다.

- 원문 요구사항을 그대로 읽음
- 현재 페이지를 직접 봄
- 문서 흐름을 끊지 않고 바로 디자인 판단으로 이어감

즉 상위 레이어에서는
`문서 -> 문서`
흐름이 더 자연스럽고, 품질 손실이 적다.

---

## 2. 새 기준

### 2.1 사용자 요구사항은 Markdown 원문으로 유지한다

사용자가 입력한 요구사항은

- form 값이 있더라도
- 최종적으로는 LLM이 읽기 좋은 Markdown 문서로 정리한다

이 문서는 UI가 보기 위한 화면 조각이 아니라
`모델 입력용 원문`이다.

### 2.2 컨셉서는 Markdown 원문으로 유지한다

Concept Model의 출력은 JSON schema가 아니라
`컨셉서 Markdown 원문`이다.

이 문서는 아래 내용을 포함할 수 있다.

- 문제 정의
- 정보 위계 재설계
- 범위 통제
- 유지할 것
- 바꿀 것
- 선택된 컨셉안
- section별 방향

중요:

- UI는 이 문서를 읽어 보여준다
- 다음 LLM도 이 문서를 직접 읽는다
- 코드는 이 문서를 다시 “요약 번역”하지 않는다

### 2.3 Design Author는 원문 문서를 직접 읽는다

Design Author의 본 입력은 아래다.

1. 요구사항 Markdown 원문
2. 컨셉서 Markdown 원문
3. 현재 target section HTML
4. 재사용 가능한 asset 목록
5. 현재 페이지 screenshot / 참조

즉 Design Author는
`원문 문서 + 현재 section context`
를 직접 읽는다.

### 2.4 코드가 하는 일은 마지막 projection 뿐이다

코드는 상위 문서를 재구성하지 않는다.

코드는 마지막에만 아래를 수행한다.

- section HTML 추출
- asset placeholder 치환
- sanitize
- before/after 생성
- draft 저장

이 단계는 디자인 판단이 아니라
`runtime delivery projection`
이다.

---

## 3. 새 본선 흐름

```text
User Requirement Input
  -> Requirement Markdown
  -> Concept Model
  -> Concept Markdown
  -> Design Author Model
  -> Authored Section Markdown
  -> Runtime Delivery Projection
  -> Draft Result
  -> Preview / Compare / Visual Verification
```

핵심:

- 상위 레이어는 Markdown 원문 중심
- 하위 runtime만 최소 projection

---

## 4. 각 단계의 산출물

### 4.1 Requirement Markdown

성격:

- 사용자가 실제로 의도한 수정 요청을 LLM이 읽기 좋게 정리한 원문 문서

포함:

- 무엇을 바꾸려는가
- 왜 바꾸려는가
- 무엇을 유지해야 하는가
- 무엇을 피해야 하는가
- 범위와 비교 기준

### 4.2 Concept Markdown

성격:

- 방향 문서

포함:

- 문제 정의
- 정보 위계
- 범위 통제
- 선택된 컨셉
- 섹션별 설계 방향

### 4.3 Authored Section Markdown

성격:

- Design Author가 작성한 결과 문서

권장 형식:

```md
## Section: hero

### Role
브랜드 첫 인상과 핵심 메시지를 담당하는 메인 히어로

### Intent
과한 할인 톤 없이 신뢰감 있는 에디토리얼 히어로로 재구성

### HTML
```html
<section>...</section>
```

### Assets
- hero-main
- hero-secondary

### Advisory
- 기존 영상 asset은 정적 이미지로 대체
```
```

중요:

- LLM은 Markdown 문서를 쓴다
- HTML은 fenced block으로 포함한다
- strict JSON object를 강제하지 않는다

---

## 5. Runtime Delivery Projection

이 단계는 “추출”이 아니라
`서빙용 최소 projection`이다.

목적:

- authored Markdown에서 section HTML을 읽는다
- asset placeholder를 해석한다
- before/after HTML을 만든다
- draft 저장 형식을 만든다

하지 않는 일:

- 의미 재해석
- 카피 재작성
- layout 재결정
- family/template/preset 환원

즉 projection은
디자인 판단이 아니라
`delivery adapter`
이다.

---

## 6. 왜 JSON 본선을 피해야 하는가

HTML authoring 작업에서 strict JSON only 출력은 자주 깨진다.

예:

- fenced json
- leading/trailing explanation
- 긴 html string escaping 문제
- 일부 section만 비는 문제

이는 모델이 나빠서가 아니라
출력 계약이 작업 성격과 안 맞기 때문이다.

따라서:

- LLM -> LLM 전달은 Markdown이 기본
- 코드 소비 직전만 최소 projection

이 구조가 더 안정적이다.

---

## 7. 허용되는 최소 구조화

다만 runtime이 서빙하려면 최소한 아래 정도는 알아야 한다.

- 어느 section의 HTML인지
- 어떤 asset slot을 치환해야 하는지
- advisory가 있는지

이 정보는 Markdown 문서 안의 고정 heading 규칙이나
fenced block 규칙으로 충분히 추출 가능하다.

즉:

- 상위 문서 전체를 JSON화하지 않는다
- runtime이 필요한 최소 단위만 projection한다

---

## 8. 구현 원칙

### 8.1 먼저 바꿀 것

- Design Author 입력을 Markdown 원문 중심으로 전환
- Authored output을 JSON 대신 Markdown 문서형으로 전환
- runtime parser를 delivery projection으로 한정

### 8.2 나중에 바꿀 것

- UI 렌더를 Markdown 원문 기반으로 재구성
- compare/preview도 authored document 기준 메타를 노출

### 8.3 금지

- 상위 문서를 packet으로 계속 재요약하기
- 코드가 컨셉서 의미를 다시 조합하기
- runtime이 authored result를 재작성하기

---

## 9. 한 줄 기준

`상위 흐름은 Markdown 원문으로 유지하고, 코드는 마지막 runtime delivery projection만 수행한다.`
