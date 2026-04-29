# 관리자 전체 완료 기준 · Builder 실행 런북

작성일: 2026-04-16

## 1. 이 문서의 목적

이 문서는 현재 프로젝트의 완료 기준을 다시 고정한다.

이번 작업의 목적은:

> `15개 페이지`의 클론 화면을 단순히 보이게 만드는 것이 아니라,
> 각 페이지의 모든 컴포넌트와 그 내부 요소를 끝까지 파서,
> 현재 코드 기준으로 실제로 규격화하고,
> 기획서와 정책, 디자인 문서, 규격을 Builder가 읽어 수정 가능한 상태까지 닫는 것이다.

즉 목표는 `minimum readiness`가 아니다.

목표는 아래다.

1. `15개 페이지 전부`
2. `모든 주요 컴포넌트`
3. `컴포넌트 내부 편집 요소`
4. `기획서/정책/디자인 문서 연결`
5. `Builder 실행 및 결과 검수`

를 끝까지 닫는 것이다.

---

## 2. 이번 문서에서 말하는 “완료”의 뜻

아래 상태는 완료가 아니다.

- `none`
- `legacy`
- `warning`
- `fail`
- `placeholder`
- `half-done`
- `minimum working`
- `모델링만 됨`

완료는 아래 조건을 동시에 만족할 때만 인정한다.

1. 클론 화면이 실제 reference 기준으로 확인 가능하다
2. 각 페이지의 섹션/컴포넌트 경계가 빠짐없이 정의되어 있다
3. 각 컴포넌트 내부에서 Builder가 다뤄야 할 내용/스타일/반복 구조가 규격화되어 있다
4. 요구사항/PRD/정책/디자인 문서가 Builder 입력으로 연결된다
5. Builder가 실제로 결과를 만들고 preview/compare까지 검수 가능하다
6. 최종 acceptance까지 이어지는 운영 흐름이 닫혀 있다

---

## 3. 전체 완료 게이트

### Gate A. View 완성

조건:

1. `/clone/<page>` 또는 동등 경로가 실제 reference와 비교 가능한 상태다
2. 페이지 주요 섹션 누락이 없다
3. 링크/순서/폭/기본 상호작용이 크게 어긋나지 않는다

실패 예:

- 클론은 뜨지만 섹션이 비어 있음
- placeholder 마크업만 있음
- visual acceptance 전에 구조부터 비어 있음

### Gate B. Component 경계 완성

조건:

1. 각 페이지의 주요 섹션이 `slot/component` 단위로 식별된다
2. 각 component에 `componentId / slotId / activeSourceId`가 있다
3. major section이 아니라 내부 편집 단위까지 내려간다

실패 예:

- 섹션만 있고 component boundary가 없음
- source switch는 되지만 component 내부 편집 단위가 없음

### Gate C. 내부 요소 규격화 완성

조건:

1. 각 component의 editable text/image/style/visibility 구조가 정의되어 있다
2. repeater는 item count와 item schema가 있다
3. patch schema가 실제 편집 키까지 닫혀 있다
4. geometry/markup/reference rect가 비어 있지 않다

실패 예:

- component는 있지만 내부 요소 키가 없음
- repeater가 있는데 item이 `0`
- builder가 무엇을 바꿀 수 있는지 불명확함

### Gate D. 문서 연결 완성

조건:

1. 페이지 정체성이 기준 문서로 존재한다
2. 요구사항이 구조화되어 있다
3. PRD가 고객용 문서로 생성된다
4. 아래 문서가 Builder 입력으로 이어진다
   - `builderBrief`
   - `builderMarkdown`
   - `layoutMockupMarkdown`
   - `designSpecMarkdown`
   - `sectionBlueprints`
   - page identity의 `mustPreserve / shouldAvoid / visualGuardrails`

실패 예:

- PRD는 있는데 Builder 입력 스펙이 비어 있음
- 문서가 있어도 저장 구조와 분리돼 있음
- 정책/가드레일이 Builder 입력에 안 들어감

### Gate E. Builder 실행 완성

조건:

1. Builder가 승인된 plan과 system context를 입력으로 받는다
2. slot/source/patch schema를 기준으로 실제 수정이 가능하다
3. latest draft build 또는 saved version이 생성된다
4. preview / compare / pin 흐름이 동작한다
5. Builder 에러/timeout 없이 검수 가능한 산출물을 낸다

실패 예:

- 버튼만 있고 실제 Builder 입력이 비어 있음
- Builder 결과가 저장되지 않음
- compare로 품질 판정이 불가능함

### Gate F. Acceptance 완성

조건:

1. Builder 결과를 final acceptance 흐름으로 넘길 수 있다
2. `pass / fail / pending` 저장이 가능하다
3. `ready-for-llm` 여부를 설명할 수 있다
4. 다음 pending bundle 또는 다음 actionable page가 드러난다

실패 예:

- Builder 이후 운영 흐름이 끊김
- acceptance 상태가 admin에서 안 보임

---

## 4. 전역 불합격 규칙

아래 중 하나라도 남아 있으면 해당 페이지는 완료가 아니다.

1. `latestPlanDocs = none`
2. `latestPlanDocs = legacy`
3. `builder issues > 0`
4. `repeaters without items`
5. `artifact-sidecar status = warning/fail`
6. `missingReferenceMarkupCount > 0`
7. `missingReferenceGeometryCount > 0`
8. component boundary incomplete
9. editable field/schema incomplete
10. Builder preview/compare 불가

---

## 5. 현재 코드 기준 핵심 현실 인식

현재 상태는 “전부 완료”가 아니다.

현재 감사 결과상:

1. `readiness-audit`는 15개 페이지를 점검하지만, 다수 페이지가 `latestPlanDocs = none/legacy`다
2. `artifact-sidecar-audit`는 여러 page family에서 `fail`이 남아 있다
3. `project-consolidated-status`에도
   - `component boundary incomplete`
   - `interaction editable list incomplete`
   - `patch/apply API planned`
   가 남아 있다

즉 현재는 `partial readiness`에 가깝고, 이 문서는 이를 `full completion` 기준으로 끌어올리기 위한 실행 문서다.

---

## 6. 전역 점검표

각 페이지는 아래 항목을 모두 통과해야 한다.

운영 기준:

- admin 화면과 운영 스크립트는 문서만 보지 않고 `/api/data`의 `fullCompletionReport`를 함께 본다.
- 즉 상태판은 정적 문서가 아니라 실측 감사 데이터와 연결된 운영 기준이어야 한다.

| 구분 | 점검 항목 | 완료 기준 |
| --- | --- | --- |
| View | clone 응답 | 200 응답, 주요 섹션 누락 없음 |
| View | visual fidelity | reference 대비 구조/순서/폭/핵심 상호작용 확인 가능 |
| Component | slot registry | 페이지 주요 섹션 전부 식별 |
| Component | component inventory | `componentId / slotId / activeSourceId` 존재 |
| Component | editability | `editableProps / editableStyles / editableInteractions` 존재 |
| Component | repeater schema | item count와 item-level schema 존재 |
| Geometry | sidecar markup | reference/working markup 존재 |
| Geometry | geometry | reference/work rect 존재 |
| Docs | page identity | `role/purpose/designIntent/mustPreserve/shouldAvoid/visualGuardrails` 존재 |
| Docs | requirement plan | `requestSummary/planningDirection/designDirection/priority/guardrails` 존재 |
| Docs | PRD docs | `builderMarkdown/layoutMockupMarkdown/designSpecMarkdown/sectionBlueprints` 존재 |
| Builder | builder input | approved plan + system context + patch schema 연결 |
| Builder | execution | latest draft build 또는 saved version 생성 |
| Builder | verification | preview / compare / pin 가능 |
| Acceptance | flow | page-level acceptance 진입 가능 |
| Acceptance | gate | `ready-for-llm` 또는 blocked reason 설명 가능 |

---

## 7. 15개 페이지 실행표

아래 표는 현재 known gap과 종료 조건을 함께 적은 실행표다.

중요:

- 이 표는 `우선순위표`가 아니라 `전체 범위표`다.
- 먼저 파는 페이지가 있을 뿐, 특정 몇 페이지만 끝내고 종료하는 방식은 허용하지 않는다.
- 종료 조건은 `15개 페이지 전부`가 각자 자신의 종료 조건을 통과하는 것이다.

| 페이지 | viewport | 현재 known gap | 이번 문서 기준 종료 조건 |
| --- | --- | --- | --- |
| `home` | `pc` | builder issue 1, legacy docs, sidecar fail | 17개 섹션 전체의 markup/geometry/slot/component/editable schema 완료, PRD 최신화, Builder 결과 검수 가능 |
| `home` | `ta` | builder issue 1, docs none, sidecar fail | `home pc`와 동일 기준 + tablet viewport별 source/schema 분리 확인 |
| `support` | `pc` | legacy docs | 4개 섹션 전체를 component/editability/PRD/Builder까지 닫기 |
| `bestshop` | `pc` | repeater without items, sidecar warning | 4개 섹션 전체 + `brandBanner` 포함 markup/geometry/item schema/Builder 입력 완성 |
| `care-solutions` | `pc` | docs none | 5개 섹션 전체를 PRD/Builder/preview/compare까지 닫기 |
| `care-solutions-pdp` | `pc` | legacy docs | 4개 섹션 전체를 PRD 최신 스키마와 Builder 실행 기준으로 닫기 |
| `homestyle-home` | `pc` | docs none | 3개 섹션 전체를 component-level editable schema까지 완료 |
| `homestyle-pdp` | `pc` | docs none | 6개 섹션 전체를 repeaters 포함 Builder patch 가능한 수준으로 완료 |
| `category-tvs` | `pc` | repeater without items, sidecar fail | 6개 섹션 전체, 특히 `filter/sort/productGrid/firstRow/firstProduct`의 schema와 item 구성 완료 |
| `category-refrigerators` | `pc` | repeater without items, sidecar fail | 6개 섹션 전체, 특히 `filter/sort/productGrid/firstRow/firstProduct`의 schema와 item 구성 완료 |
| `pdp-tv-general` | `pc` | docs none, sidecar fail | 7개 섹션 전체, 특히 `price/option/sticky/review/qna` 내부 요소 규격화 완료 |
| `pdp-tv-premium` | `pc` | docs none, sidecar fail | 7개 섹션 전체, 특히 `price/option/sticky/review/qna` 내부 요소 규격화 완료 |
| `pdp-refrigerator-general` | `pc` | docs none, sidecar fail | 7개 섹션 전체, 특히 `price/option/sticky/review/qna` 내부 요소 규격화 완료 |
| `pdp-refrigerator-knockon` | `pc` | docs none, sidecar fail | 7개 섹션 전체, 특히 `price/option/sticky/review/qna` 내부 요소 규격화 완료 |
| `pdp-refrigerator-glass` | `pc` | docs none, sidecar fail | 7개 섹션 전체, 특히 `price/option/sticky/review/qna` 내부 요소 규격화 완료 |

---

## 8. 페이지별 상세 작업 단위

중요:

- 아래 작업 단위는 page family별 진입 순서를 설명하는 것이다.
- 어느 family도 `우선 완료 대상`이라는 이유로 scope-out 되지 않는다.
- `home -> PLP -> PDP -> service pages` 순으로 착수할 수는 있지만, 최종 종료는 `15개 전체 완료`일 때만 인정한다.

### 8.1 `home`

작업 단위:

1. 17개 섹션 전부를 weak section 기준으로 다시 판다
2. 각 섹션에 대해
   - reference markup
   - geometry
   - slot boundary
   - component boundary
   - editable field
   - repeater schema
   - Builder patch schema
   를 닫는다
3. `home pc`와 `home ta`를 별도 working truth로 검증한다

### 8.2 서비스형 페이지

대상:

- `support`
- `bestshop`
- `care-solutions`
- `care-solutions-pdp`
- `homestyle-home`
- `homestyle-pdp`

작업 단위:

1. 현재 sidecar가 pass라도 docs/builder가 비어 있으면 미완료로 본다
2. 각 섹션을 PRD와 Builder 입력 스펙까지 연결한다
3. `bestshop`은 repeater item 공백을 먼저 해결한다

### 8.3 PLP 페이지

대상:

- `category-tvs`
- `category-refrigerators`

작업 단위:

1. `filter / sort / productGrid / firstRow / firstProduct`를 우선 완료한다
2. list/grid repeaters의 item schema를 실제 카드 단위까지 닫는다
3. link policy와 Builder patch 가능 범위를 같이 검증한다

### 8.4 PDP 페이지

대상:

- `pdp-tv-general`
- `pdp-tv-premium`
- `pdp-refrigerator-general`
- `pdp-refrigerator-knockon`
- `pdp-refrigerator-glass`

작업 단위:

1. 7개 core section을 전부 닫는다
2. 특히 아래는 half-done 상태를 허용하지 않는다
   - `price`
   - `option`
   - `sticky`
   - `review`
   - `qna`
3. `gallery/summary`뿐 아니라 하단 상호작용/반복 구조까지 Builder가 다룰 수 있어야 한다

---

## 9. Builder까지 포함한 점검표

Builder는 아래 입력을 실제로 읽고 있어야 한다.

1. 승인된 `requirementPlan`
2. `builderBrief`
3. `guardrails`
4. page identity의
   - `mustPreserve`
   - `shouldAvoid`
   - `visualGuardrails`
5. `builderMarkdown`
6. `layoutMockupMarkdown`
7. `designSpecMarkdown`
8. `sectionBlueprints`
9. `slotRegistry`
10. `editableComponents`
11. `patchSchemaMap`
12. `currentPatches`

각 페이지에서 확인할 항목:

| 구분 | 질문 | 합격 기준 |
| --- | --- | --- |
| Plan | Builder가 승인된 PRD를 읽는가 | `approvedPlan` 기반 실행 |
| Policy | 가드레일/보존 규칙을 읽는가 | `guardrails`, `mustPreserve`, `visualGuardrails` 반영 |
| Spec | 디자인 문서를 읽는가 | `builderMarkdown/layoutMockupMarkdown/designSpecMarkdown/sectionBlueprints` 사용 가능 |
| Schema | 규격을 읽는가 | `slotRegistry/editableComponents/patchSchemaMap` 존재 |
| Patch | 실제 수정 가능한가 | component patch 또는 동등 경로 동작 |
| Output | 결과를 저장하는가 | latest draft build 또는 saved version 생성 |
| Review | 결과를 검수할 수 있는가 | preview / compare 동작 |

---

## 10. 실제 운영 실행 순서

전역 실행 순서:

1. `view gap` 정리
2. `sidecar / geometry / markup` 정리
3. `component inventory / editability / patch schema` 정리
4. `requirements / PRD / docs` 정리
5. `Builder input` 연결
6. `Builder execution`
7. `preview / compare / pin`
8. `acceptance`

페이지 작업 순서:

1. `home pc`
2. `home ta`
3. `support`
4. `bestshop`
5. `care-solutions`
6. `care-solutions-pdp`
7. `homestyle-home`
8. `homestyle-pdp`
9. `category-tvs`
10. `category-refrigerators`
11. `pdp-tv-general`
12. `pdp-tv-premium`
13. `pdp-refrigerator-general`
14. `pdp-refrigerator-knockon`
15. `pdp-refrigerator-glass`

우선순위 원칙:

1. `warning/fail`이 있는 페이지부터 처리
2. 다음으로 `legacy/none` docs 페이지 처리
3. 마지막으로 Builder/acceptance 고도화

---

## 11. admin 화면이 반드시 보여줘야 할 상태

현재 목적 기준으로 `admin`은 최소 아래 6개 축을 보여줘야 한다.

1. `View`
2. `Component`
3. `Elements`
4. `PRD`
5. `Builder`
6. `Acceptance`

설명:

- `Component`가 없으면 slot/component 경계가 미완료다
- `Elements`가 없으면 내부 요소 규격화 여부를 운영자가 볼 수 없다
- `Builder`가 있어도 `Acceptance`가 없으면 최종 빌드 진입 판단이 안 된다

즉 현재 `identity / requirements / prd / builder`만으로는 부족하다.

---

## 12. 페이지 완료 선언 조건

어떤 페이지도 아래를 만족하기 전에는 완료로 선언하지 않는다.

1. sidecar audit `pass`
2. readiness audit에서
   - `latestPlanDocs = latest`
   - `issues = 0`
   - `repeaters without items = 0`
3. component boundary와 editable schema가 페이지 전역에서 닫힘
4. Builder가 문서/정책/규격을 읽고 결과를 생성함
5. preview / compare 검수 완료
6. acceptance 저장 가능

---

## 13. 현재 문서와의 관계

이 문서는 아래 문서보다 강한 기준을 가진다.

1. `docs/admin-build-readiness-verification-2026-04-16.md`
   - readiness를 넘어서 full completion 기준으로 확장
2. `docs/admin-build-quality-checklist-2026-04-16.md`
   - 체크리스트를 15개 페이지 전체 실행표까지 확장
3. `docs/final-acceptance-runbook.md`
   - acceptance 이전 단계인 component/Builder completion까지 포함

---

## 14. 이번 문서의 한 줄 결론

이 프로젝트의 완료 기준은:

> `15개 페이지의 모든 주요 컴포넌트와 내부 요소가 현재 코드 기준으로 실제로 규격화되어 있고,  
> 기획서/정책/디자인 문서/규격을 Builder가 읽어 수정할 수 있으며,  
> 결과를 preview/compare/acceptance까지 검수 가능한 상태`

일 때만 인정한다.
