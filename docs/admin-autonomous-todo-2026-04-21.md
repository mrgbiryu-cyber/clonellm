# Autonomous TODO (2026-04-21)

현재 스냅샷:

- [Runtime Checkpoint (2026-04-22)](./admin-runtime-checkpoint-2026-04-22.md)
- [Design Runtime Guardrails (2026-04-22)](./admin-design-runtime-guardrails-2026-04-22.md)

## 목적

이 문서는 다음 작업 세션에서 자동으로 이어갈 수 있도록,
현재까지 확정된 설계 원칙과 구현 TODO를 고정한다.

최상위 기준:

- [Design Quality North Star](./admin-design-quality-north-star-2026-04-21.md)
- [Markdown-First Authoring Flow](./admin-markdown-first-authoring-flow-2026-04-22.md)
- [Schema Guardrail](./admin-schema-guardrail-2026-04-21.md)
- [Design Authoring Architecture](./admin-design-authoring-architecture-2026-04-21.md)
- [Concept Package Minimal Schema](./admin-concept-package-minimal-schema-2026-04-21.md)
- [Authored Section HTML Package Minimal Schema](./admin-authored-section-html-package-minimal-schema-2026-04-21.md)
- [Preservation / Interference Debug Method](./admin-preservation-interference-debug-method-2026-04-22.md)
- [Preservation / Interference Audit Checklist](./admin-preservation-interference-audit-checklist-2026-04-22.md)

핵심 원칙:

- 레거시는 기본적으로 걷어낸다
- 현재 코드는 기준이 아니라 참고물이다
- schema는 코드에 맞추지 않는다
- 상위 LLM 전달은 Markdown 원문 우선이다
- 코드는 마지막 runtime delivery projection만 한다
- 목표는 `Claude.ai/design 이상 수준의 디자인 품질`

---

## 0. 절대 금지

아래는 다음 세션에서도 금지한다.

- 현재 코드 구조에 schema를 맞추기
- enum / mode 문자열 / fallback을 새 계약에 넣기
- preset/template/family를 본선 계약에 넣기
- “일단 붙이고 나중에 정리” 방식으로 runtime 브리지를 늘리기
- audit 결과를 보고 계약을 수정하기
- renderer가 다시 구조 판단 주체가 되게 만들기
- 상위 문서를 packet/JSON으로 재요약해서 LLM 입력의 정본처럼 쓰기
- trace/debug 값을 다음 단계 정본처럼 재사용하기

---

## 1. 현재 완료 상태

이미 완료된 것:

1. 품질 목표 고정
2. 레거시 우선이 아니라 품질 우선 원칙 고정
3. `Concept Model -> Design Author LLM -> Runtime Renderer` 구조 문서화
4. `authoringMode`, `scopeUnit`, `targetGroup` 방향 문서화
5. `Concept Package` 최소 schema 정의
6. `Authored Section HTML Package` 최소 schema 정의
7. schema guardrail 문서 정의
8. `Runtime Renderer Contract` 문서 정의
9. `Design Author Input Contract` 문서 정의
10. `Design Author Output Validation` 문서 정의
11. `Visual Verifier Contract` 문서 정의
12. 구현 착수 조건 문서 정의
13. 현재 코드 충돌 audit 문서 정의
14. 첫 runtime slice 문서 정의
15. 레거시 삭제/격리 계획 문서 정의
16. 첫 runtime slice 파일 경계 문서 정의
17. Markdown-first authoring flow 문서 정의

즉 새 본선의 문서 계약은 1차로 닫힌 상태다.
다음부터는 schema 정의를 다시 시작하지 말고,
구현 착수 조건과 코드 정리 단계로 내려가면 된다.

단, 이후 구현은 `JSON strict output`을 본선으로 강화하는 방향이 아니라
`Markdown authored document -> runtime projection`
기준으로 진행한다.

---

## 2. 다음 우선순위

### Priority 1

preservation / interference 코드 감사

목표:

- 현재 코드가 원문을 어디서 재요약하거나 재해석하는지 먼저 찾기

필수 포함:

- saved plan 보존 감사
- concept package 보존 감사
- author input 보존 감사
- runtime interference 감사

---

### Priority 2

가장 얇은 E2E 한 줄 유지

목표:

- home top-stage 기준으로 requirement -> concept -> author -> runtime 흐름을 가장 얇게 유지

필수 포함:

- preservation trace 확인
- identifier mismatch 확인
- provider truncation 확인

---

### Priority 3

실패 유형 분류 후 최소 보정

목표:

- failure를 preservation / interference / capability / provider-truncation으로 나눈 뒤 최소 보정만 넣기

필수 포함:

- 원문 보존 보정 우선
- runtime 재해석 제거
- 품질 튜닝은 마지막

---

## 3. 구현 착수 순서

문서 계약은 완료됐다.

이제부터의 순서:

1. preservation / interference 감사
2. 가장 얇은 E2E 실행
3. 실패 유형 분류
4. 최소 보정
5. 그 다음에만 품질 튜닝

주의:

- 감사는 “역할 확인”이 아니라 “원문 보존과 개입 확인” 기준으로 한다
- audit 결과로 문서를 코드에 맞추지 않는다
- 문서를 기준으로 코드를 바꾼다

---

## 4. 디버깅 기준

지금 단계에서 우선 보는 항목:

1. source preserved?
2. identifier preserved?
3. runtime interference?
4. provider truncation?

이 네 가지가 닫히기 전에는 보조 loop나 fallback을 본선 해결책으로 채택하지 않는다.

---

## 5. 자동 진행 체크리스트

다음 세션에서 시작할 때 순서대로 확인:

1. 지금 하려는 작업이 품질 목표를 직접 높이는가
2. 아니면 현재 코드를 살리기 위한 것인가
3. 새 문서 계약을 더 명확하게 하는가
4. enum/mode/fallback을 새로 넣으려 하고 있지 않은가
5. runtime이 다시 구조 판단을 하려 하고 있지 않은가
6. 현재 수정이 원문을 더 보존하는가, 아니면 중간 개입층을 늘리는가

하나라도 위험 신호가 있으면 문서 기준으로 되돌린다.

---

## 6. 종료 조건

다음 세션에서 최소 종료 조건:

- preservation / interference 감사 1회 완료
- 가장 얇은 E2E에서 실패 유형이 명확히 분류됨

이 두 개가 끝나면 최소 보정으로 내려갈 수 있다.

---

## 7. 한 줄 기준

`이제 다음 작업은 기능을 더 붙이는 일이 아니라, 원문 보존과 중간 개입 여부를 기준으로 현재 코드를 감사하고, 가장 얇은 흐름 하나를 끝까지 통과시키는 일이다.`
