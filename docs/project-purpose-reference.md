# Project Purpose Reference

이 문서는 이 프로젝트의 **최상위 목적 기준**이다.

다른 문서를 다시 열 때도, 구현을 다시 시작할 때도, 먼저 이 문서를 본다.

---

## 1. 최종 목적

이 프로젝트의 목적은 단순한 클론 화면 구현이 아니다.

최종 목적은 아래 5가지다.

1. `live reference`를 실제 브라우저 화면 기준으로 읽는다.
2. 그 화면을 `clone`에서 시각적으로 최대한 맞춘다.
3. 맞춘 결과를 `slot/component` 단위로 다룰 수 있게 만든다.
4. 사용자가 프론트 화면에서 각 컴포넌트의 텍스트, 위치, 이미지, 디자인을 바꾸며 확인할 수 있게 만든다.
5. 최종적으로 `LLM`과 `Figma-derived` 변경이 이 컴포넌트 단위 위에서 안전하게 동작하게 만든다.

즉 지금 하는 모든 작업은 결국 아래 목적을 위한 것이다.

- `view truth` 기준 재현
- `component-ready rendering`
- `workspace-ready editing`
- `LLM-ready editing surface`

---

## 2. 절대 잊으면 안 되는 기준

### 2.1 최종 기준은 view truth

최종 기준은 항상 `live reference`의 실제 브라우저 화면이다.

- JSON
- DOM
- extractor
- workbench

는 전부 보조 도구다.

즉:

1. DOM이 맞아도 화면이 다르면 실패
2. JSON이 맞아도 화면이 다르면 실패
3. workbench가 pass여도 사용자가 보기 다르면 실패

추가 원칙:

최종 일괄 시각 판정 전에는, 섹션 묶음별로 `reference screenshot vs current clone screenshot` 비교를 계속 누적한다.

즉:

1. 마지막 사용자는 한 번에 최종 판정
2. 그 전까지는 Codex가 screenshot compare loop로 계속 맞춰 나간다

### 2.2 지금의 view 작업은 최종 편집 구조를 위한 전 단계

현재는 화면을 맞추고 있지만, 끝 목표는 화면 고정이 아니다.

끝 목표는:

1. 각 영역을 `component/slot`로 나누고
2. source/variant를 바꿀 수 있게 만들고
3. 계정별 workspace에서 수정하고
4. LLM이 그 단위를 대상으로 patch를 생성하고 적용하는 것이다.

즉 `view fix`는 끝이 아니라 **componentize / LLMize 전 단계**다.

### 2.3 새 섹션은 무조건 sandbox first

특히 `home` 하단은 메인에 바로 넣지 않는다.

기본 규칙:

1. `sandbox`
2. 시각 확인
3. acceptance
4. `main`

이 순서를 지킨다.

### 2.4 이미 맞춘 메인 기준선은 함부로 흔들지 않는다

메인 `/clone/home`은 현재 acceptance된 기준선이 있다.

따라서:

1. 새 실험은 작은 sandbox에서
2. 안 맞으면 즉시 폐기/롤백
3. 메인 반영은 승인 후

으로 간다.

---

## 3. Home에서 특히 중요한 이유

`home`은 다른 페이지보다 어렵다.

이유:

1. `pc raw`
2. `mo raw`
3. `live rendered view`
4. `custom renderer`

가 섞인다.

즉 `home`은 단일 페이지가 아니라 **zone assembly**에 가깝다.

그래서 `home`에서는 아래를 항상 분리해서 생각해야 한다.

1. 실제 보이는 순서
2. 실제 source
3. runtime dependency
4. 구현 방식

---

## 4. 현재 합의된 구현 원칙

### 4.1 visual fix -> componentize

전체를 거꾸로 전부 구조화하지 않는다.

현재 원칙:

1. 먼저 시각적으로 맞춘다
2. 맞춘 영역부터 component boundary로 승격한다

### 4.2 신규 하단 섹션은 view-first + registry-first

`best-ranking`까지는 `view-first`로 많이 닫혔다.

하지만 `brand-showroom`부터는 아래 원칙을 같이 적용한다.

1. 시각적으로 맞춘다
2. 동시에 `slot registry`에 들어갈 수 있는 구조를 의식한다
3. source/variant 전환이 나중에 가능해야 한다

즉 앞으로 신규 하단 섹션은:

> `view-first + registry-first`

로 본다.

### 4.3 slot/source는 명시적이어야 한다

나중에 LLM이 수정하려면 최소한 아래가 필요하다.

1. `slotId`
2. `activeSourceId`
3. `availableSources`
4. `viewportProfile`

따라서 신규 섹션 구현은 점점 이 구조에 가까워져야 한다.

### 4.4 홈 하단 실행 루프는 고정한다

홈 하단은 아래 루프를 고정 실행 순서로 사용한다.

1. 작업리스트는 사용자가 정리한 live reference 순서로 고정한다.
2. 각 작업리스트 항목에 대응하는 모바일 섹션을 먼저 찾는다.
3. 해당 모바일 섹션의 자산과 요소를 하나씩 정확히 가져온다.
4. 기존 히스토리에서 이미 맞춘 방식, 최종 목적, Claude 피드백을 함께 반영한다.
5. 다음 항목으로 넘어가며 2~4를 반복한다.
6. 전체가 끝나면 코드, 경로, 링크, slot/source를 다시 점검하고 홈을 마무리한다.

운영 규칙:

1. `quickmenu` 아래 순서는 현재 `mobile-like order`를 기본 working truth로 사용한다.
2. 섹션이 `mobile-derived`로 충분하면 메인 `/clone/home`에서 바로 정리한다.
3. `custom-renderer`가 필요한 섹션만 sandbox를 유지한다.
4. raw import는 기본값이 아니라, 섹션 매핑과 자산 경로가 확인된 경우에만 사용한다.

---

## 5. 현재 허용 / 금지

### 허용

1. 작은 `sandbox` 실험
2. 사용자 visual check 후 메인 반영
3. accepted 영역 유지
4. 기존 renderer를 source 구현체로 재사용
5. 점진적인 componentization

### 금지

1. 메인에 신규 하단 섹션 바로 반영
2. raw import first를 기본값으로 쓰기
3. accepted-main 영역을 이유 없이 흔들기
4. 최종 목적 없이 view-only 코드만 계속 누적하기
5. `LLM이 나중에 어떻게 수정할지`를 전혀 고려하지 않은 신규 구조 추가

---

## 6. 항상 확인할 질문

구현을 시작하기 전, 아래 질문에 답이 안 되면 방향을 다시 본다.

1. 이 작업은 실제 `live reference`를 맞추기 위한 것인가?
2. 이 작업은 메인을 흔들지 않고 `sandbox`에서 검증 가능한가?
3. 이 작업 결과는 나중에 `slot/component`로 승격 가능한가?
4. 이 구조는 나중에 `LLM`이 `slotId + sourceId` 기준으로 수정할 수 있는 방향인가?
5. 지금 추가하는 코드가 단순 임시 보정인지, 장기 구조에 남길 수 있는 것인지 구분했는가?

---

## 7. 현재 기준 문서

항상 같이 보는 문서:

1. `docs/project-purpose-reference.md`
2. `docs/project-consolidated-status.md`
3. `docs/home-progress-log.md`
4. `docs/home-remediation-plan.md`
5. `docs/llm-composition-design.md`
6. `docs/interaction-implementation-plan.md`

이 중에서 **최상위 기준은 이 문서**다.

---

## 8. 홈 완료 이후 전체 실행 순서

홈이 끝난 뒤에는 아래 순서를 프로젝트 공통 실행 순서로 고정한다.

1. 홈에서 각 화면으로 이동하는 링크를 정리한다.
2. 각 화면의 범위는 기존 히스토리 문서를 찾아 해당 경로까지 다시 이어서 진행한다.
3. 각 화면이 `mobile` 분기인지 `pc` 분기인지 먼저 확인하고 진행한다.
4. 모바일 화면과 PC 화면을 모두 진행한다.
5. 모바일 화면과 PC 화면은 실제 브라우저에서 각각 확인하고, 코드 구조도 같이 점검한다.
6. 페이지 구현이 끝나면 다시 돌아가서 LLM이 바로 다룰 수 없는 항목을 뽑는다.
7. 그 항목을 `LLM-editable` 형태의 리스트로 다시 정리한다.
8. 그 리스트 기준으로 slot/source/variant/component 경계를 보강하고, 변경 적용 후 화면이 틀어지지 않는지 다시 확인한다.
9. 위 단계가 끝나면 pre-LLM foundation 완료로 보고 LLM 작업으로 전환한다.

운영 해석:

1. view 구현 완료가 곧 종료는 아니다.
2. 각 화면은 `visual acceptance -> componentize -> LLM-ready list` 순서로 닫는다.
3. 링크 정리, 분기 확인, 코드 점검은 화면별 종료 조건에 포함한다.
