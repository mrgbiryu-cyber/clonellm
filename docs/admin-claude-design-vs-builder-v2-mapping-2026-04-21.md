# Claude Design Flow vs Builder V2 대응표 (2026-04-21)

## 목적

이 문서는 `Claude Design` 스타일의 design-first 흐름과 현재 `Builder V2` 흐름을 1:1로 대응시켜,

- 실제로 같은 역할을 하는 단계가 무엇인지 분명히 하고
- 중복되거나 품질을 떨어뜨리는 단계를 걷어내기 위한 기준을 정리하기 위한 문서다.

핵심 판단:

- 현재 우리 시스템은 단계 수가 더 많고
- 실행/검증 계층이 너무 두꺼우며
- 디자인 결정보다 후처리와 critic 통과가 더 강하게 작동한다.

즉, 방향은 `새 기능 추가`보다 `중간 계층 축소`가 맞다.

---

## 1. 단계 대응표

| Claude Design 흐름 | 현재 Builder V2 흐름 | 현재 상태 평가 | 정리 방향 |
|---|---|---|---|
| 사용자 입력 해석 | `Planner` | 필요 | 유지 |
| 문제 정의 / 왜 바꾸는가 정리 | `Planner output + prompt text` | 약함 | 강화 |
| 유지/변경 범위 정리 | `approvedPlan + guardrails + builderBrief` | 있음 | 유지 |
| A/B 또는 대표 방향 제안 | `Composer` | 부분 중복 | 축소 또는 Planner 흡수 |
| 상위 레이아웃 개념 결정 | `Composer + Builder primitiveTree` | 분산됨 | Builder 중심으로 단순화 |
| 섹션별 표현 설계 | `Builder operations + componentComposition` | 필요 | 유지 |
| 실제 Hi-fi 결과 렌더 | `server.js + renderer/*` | 필요 | 유지 |
| 결과 미리보기 | `/clone-content`, `/clone`, draft build` | 필요 | 유지 |
| 자동 품질 판정 | `structural critic + visual critic + recovery router` | 과함 | 대폭 축소 |
| 반복 수정 | `fix pass + recovery router + compare rerun` | 과함 | 1회 이하로 제한 |

---

## 2. Claude 대비 우리가 두꺼운 지점

### 2.1 Composer

현재 Composer는 상위 구조를 먼저 잡는 역할이지만, 실제로는 Planner와 Builder 사이에 하나의 LLM 단계를 더 넣는다.

문제:

- prompt 비용 증가
- 실패 지점 증가
- `layout intent`가 Builder에서 다시 해석되며 약해짐

판단:

- 특정 슬롯 조합이 아니라 `Planner가 지정한 target group cluster`는 Composer 없이도 Planner에서 `cluster brief`를 만들고 Builder가 바로 primitive를 고르게 할 수 있다.

정리 방향:

- Composer를 기본 경로에서 제거
- 필요한 경우에만 `page-level full redesign`에 한해 sidecar 단계로 한정

### 2.2 Structural critic

현재 structural critic은 execution 관점에서 유용하지만, 지나치게 세밀한 품질 판정기로 쓰이고 있다.

문제:

- design score가 아니라 schema coverage score에 가까움
- retry를 유도하면서 결과를 설명적/보수적으로 만듦

판단:

- structural critic은 `불법 operation 제거` 수준이면 충분하다.

정리 방향:

- 점수화/재시도 판정 제거
- 역할을 `operation sanitizer + basic validation`으로 축소

### 2.3 Visual critic / recovery router

현재 visual critic은 가장 큰 병목이다.

문제:

- capture 품질에 따라 결과가 흔들림
- schema invalid, timeout, navigation interruption 등 비디자인성 실패가 많음
- compare rerun / recovery router / fix pass가 연쇄적으로 붙음

판단:

- 지금은 디자인을 끌어올리는 장치보다 흐름을 무겁게 만드는 장치에 가깝다.

정리 방향:

- visual critic을 기본 완료 조건에서 제거
- 우선은 `advisory report`로만 저장
- execution fail을 critic invalid와 분리

### 2.4 Generated asset / image gen

현재 hero 이미지 생성은 OpenRouter credit, latency, 실패율에 직접 영향을 받는다.

문제:

- 시안 결과보다 인프라 상태에 품질이 좌우됨
- hero 텍스트/레이아웃 실험과 섞여 디버깅이 어려움

정리 방향:

- top-stage 실험에서는 기본 비활성화
- asset은 fallback 없이 deterministic starter 우선

---

## 3. 걷어낼 것 / 남길 것

### 남길 것

- Planner
- Builder
- renderer surface (`tailwind` / `custom`)
- draft build 저장
- page identity / slot guidance
- primitiveTree / componentComposition

### 걷어낼 것

- Composer 기본 경로
- structural critic의 score/retry 로직
- visual critic의 hard gate 역할
- compare fresh rerun
- recovery router
- top-stage 기본 image generation

### 축소할 것

- fix pass: 최대 1회
- quality report: 저장은 하되 gate에는 약하게 반영
- reference asset: `fullpage + target focus` 2장 정도로 단순화

---

## 4. 목표 단순화 흐름

권장 목표 흐름은 아래다.

```text
User Input
  -> Planner
  -> Builder
  -> Renderer
  -> Draft Save
  -> Advisory Critic Report
```

현재 흐름:

```text
User Input
  -> Planner
  -> Composer
  -> Builder
  -> Structural Critic
  -> Fix Pass
  -> Renderer
  -> Visual Critic
  -> Compare Rerun
  -> Recovery Router
  -> Visual Critic Again
  -> Draft Save / Fail
```

즉 제거 대상은 중간 생성 단계보다 `생성 후 반복 판정 계층`이다.

---

## 5. target group 기준 권장 운영 모델

특정 슬롯 조합을 하드코딩하지 않는다.

대신 `Planner가 지정한 target group`을 하나의 cluster로 우선 취급한다.

예:

- `home.hero + home.quickmenu` -> `top-stage cluster`
- `pdp.summary + pdp.sticky` -> `purchase cluster`
- `support.hero + support.tabs + support.ranking` -> `service-entry cluster`

Builder 입력은 아래 4가지만 강하게 주면 충분하다.

1. 문제 정의
2. 정보 위계
3. 유지할 구조
4. 선택 가능한 layout direction

Builder 출력은 아래 3가지만 책임지게 한다.

1. `primitiveTree`
2. `replace_component_template`
3. `update_component_patch`

여기서 중요한 것은:

- `좋은 시안인지`는 우선 사람이 보고 판단
- 시스템은 `실행 가능한 시안인지`만 보장

---

## 6. 다음 리팩터링 우선순위

1. `builder-v2` 기본 경로에서 Composer 제거
2. `runStructuralCriticFixLoop()`를 sanitizer-only로 축소
3. `finalize.js`에서 visual critic을 advisory-only로 변경
4. compare / recovery router / rerun 분기 제거
5. target-group build를 `Planner -> Builder -> Render` 3단으로 고정

---

## 7. 결론

Claude Design과 우리 흐름의 본질은 완전히 다르지 않다.

둘 다 결국:

- 입력을 해석하고
- 디자인 방향을 정하고
- 결과를 렌더한다.

차이는 우리가 그 사이에 너무 많은 `중간 판단 계층`을 넣었다는 점이다.

따라서 지금 필요한 것은 새 LLM 단계 추가가 아니라,

- `Composer`
- `critic retry loop`
- `recovery router`

같은 계층을 걷어내고, `Planner -> Builder -> Render` 중심으로 얇게 만드는 것이다.
