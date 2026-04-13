# Document Placeholder Audit 2026-04-13

이 문서는 `docs` 내 문서에서 개발 진행 중 오해를 만들 수 있는 아래 요소를 점검한 결과를 정리한다.

1. 빈 객체 / 빈 배열 예시
2. 실제 운영값처럼 보이는 샘플 URL
3. `TBD`, `placeholder` 같은 미확정 텍스트
4. 하드코딩 기본값처럼 오해될 수 있는 예시값

목적은 문서 예시를 실제 기준으로 착각해서 개발이 잘못 진행되는 것을 줄이는 것이다.

---

## 1. 점검 기준

문서를 아래 3종으로 나눠서 본다.

1. `현재 기준 문서`
   - 지금 구현 방향을 직접 결정하는 문서
2. `역사 기록 문서`
   - 과거 판단과 진행 로그를 남긴 문서
3. `의도적 표현`
   - 실제 placeholder가 아니라 개념 설명용 용어

---

## 2. 이번에 바로 정리한 문서

### 2.1 docs/llm-planner-builder-schema.md

조치:

1. `example.com` 계열 URL 제거
2. reserved domain인 `.invalid` 샘플로 변경
3. 빈 객체 `{}` / 빈 배열 `[]` 예시를 실전형 샘플 값으로 교체
4. 문서 상단에 예시 규칙 추가

현재 상태:

- `Planner / Builder` 구현 기준 문서로 사용 가능
- 예시값을 production literal로 오해할 여지를 줄임

### 2.2 docs/llm-composition-design.md

조치:

1. 외부 URL 샘플을 reserved-domain 기준으로 변경
2. `reference.groups`, `checks`, `working.groups`, `checks`에 실전형 샘플 추가
3. `plan / patch / report` 빈 객체 예시를 구조화된 샘플로 교체

현재 상태:

- 구조 설명 문서로 사용 가능
- 빈 JSON 예시 때문에 구현자가 공란 스키마로 오해할 가능성을 줄임

---

## 3. 현재 기준 문서 중 비어 있지 않다고 판단한 문서

아래 문서는 이번 점검 기준에서 `실제 공란 문서`로 보지 않았다.

1. `docs/admin-preview-workbench-structure.md`
2. `docs/admin-plp-pdp-target-catalog.md`
3. `docs/llm-planner-builder-schema.md`
4. `docs/llm-composition-design.md`

주의:

1. `docs/admin-preview-workbench-structure.md`의 `셀렉트 placeholder`는 UI 용어이므로 정리 대상 placeholder와 다르다.

---

## 4. 의도적 표현이라 유지 가능한 항목

아래 문서는 `placeholder`라는 단어가 들어 있어도 실제 공란이나 미정 하드코딩으로 바로 판단하지 않는다.

### 4.1 docs/lge-prototype-schema.md

사유:

1. `placeholder`는 스키마의 상태/컴포넌트 개념으로 사용된다.
2. 예:
   - `crawlStatus: "captured" | "restricted" | "placeholder"`
   - `restricted-page-placeholder`

판정:

- 지금 당장 수정 필요 없음

### 4.2 docs/admin-preview-workbench-structure.md

사유:

1. `placeholder`는 UI 문구로만 사용된다.

판정:

- 수정 필요 없음

---

## 5. 후속 정리 대상 문서

아래 문서는 현재 코드 기준을 직접 결정하는 1급 문서는 아니지만, 개발 중 참고될 가능성이 높아서 추후 정리가 필요하다.

### 5.1 높은 우선순위

1. `docs/project-consolidated-status.md`
   - `TBD`, `placeholder` 관련 표현이 가장 많이 남아 있음
   - 범위가 넓어 과거 판단과 현재 기준이 섞여 있음
2. `docs/home-remediation-plan.md`
   - placeholder replacement, 상태 메모가 남아 있음
3. `docs/home-progress-log.md`
   - 진행 로그 성격이 강하지만 개발 중 자주 참고될 수 있음
4. `docs/home-lower-order-reference.md`
   - `TBD` 표현이 직접 남아 있음

현재 상태:

1. 위 4개 문서에는 상단에 `문서 상태` 안내를 추가했다.
2. 즉, 지금은 문서를 열자마자 `현재 기준 문서인지`, `역사 기록인지` 구분할 수 있다.
3. `project-consolidated-status.md`와 `home-lower-order-reference.md`의 대표적인 `TBD` 표기도 기록용 표현으로 치환했다.
4. `home-remediation-plan.md`와 `home-progress-log.md`의 비날짜 요약 섹션도 중립 표현으로 정리했다.
5. `project-consolidated-status.md`의 일부 `현재 정답/현재 우회 방식` 표현도 당시 기준의 권장 패턴으로 읽히도록 중립화했다.
6. 다만 본문 전체의 과거 `TBD/placeholder` 표현까지 완전히 제거한 것은 아니므로, 후속 정리는 계속 필요하다.

### 5.2 중간 우선순위

1. `docs/home-lower-cross-review-checkpoint.md`
2. `docs/current-output.md`
3. `docs/implementation-notes.md`

판정:

1. 위 문서들은 `역사 기록`과 `현재 기준`이 섞여 있다.
2. `docs/current-output.md`, `docs/implementation-notes.md`에는 상단 `문서 상태` 안내와 스냅샷 기준 표현 정리를 추가했다.
3. `docs/home-lower-cross-review-checkpoint.md`에도 상단 `문서 상태` 안내와 시점 기준 표현 정리를 추가했다.
4. `docs/runtime-visual-audit-2026-04-12.md`는 dated audit snapshot으로 명시했다.
5. `docs/slot-snapshot-design.md`는 빈 배열 JSON이 스키마 shape 예시일 뿐 production default가 아니라는 점을 명시했다.
6. 당장 전부 고치기보다, 아래 원칙으로 정리하는 것이 맞다.
   - 현재 유효한 기준만 남긴다
   - 과거 메모는 `historical`로 명시한다
   - `TBD`가 아직 살아 있으면 현재 미확정인지 과거 기록인지 구분한다

---

## 6. 문서 작성 규칙 제안

앞으로 활성 기준 문서에는 아래 규칙을 적용한다.

1. 외부 URL 예시는 reserved domain 사용
   - 예: `https://reference.example.invalid/...`
2. 빈 객체 `{}` / 빈 배열 `[]`는 가능한 한 피한다
3. 예시값은 `샘플`, `설명용`, `production default 아님`을 명시한다
4. `TBD`를 남길 때는 반드시 아래를 함께 적는다
   - 왜 미정인지
   - 누가 확정해야 하는지
   - 언제 다시 확인할지
5. 역사 로그 문서에는 현재 기준과 과거 메모를 구분한다

---

## 7. 현재 결론

1. 현재 활성 기준 문서 중 핵심 2개는 이번에 실전형 예시로 정리했다.
2. 지금 가장 큰 오해 위험은 `역사 기록 문서`에 남아 있는 `TBD/placeholder` 메모다.
3. 이후 개발 중 기준으로 삼을 문서는 아래 4개를 우선 사용한다.
   - `docs/admin-preview-workbench-structure.md`
   - `docs/admin-plp-pdp-target-catalog.md`
   - `docs/llm-composition-design.md`
   - `docs/llm-planner-builder-schema.md`
4. 대형 누적 문서들은 별도 정리 작업으로 분리하는 것이 맞다.
5. 영향이 큰 중간 문서들도 대부분 `문서 상태`와 `스냅샷/역사 기준`으로 정리된 상태다.
