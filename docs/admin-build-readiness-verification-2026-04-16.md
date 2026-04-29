# 관리자 빌드 준비도 검증 기준

작성일: 2026-04-16

## 1. 이 문서의 목적

이 문서는 이번 `admin` 화면 수정의 목적을 고정한다.

이번 `admin` 개편은 단순 UI 정리가 아니다.

핵심 목적은 아래 한 줄이다.

> 운영자가 `최종 빌드로 넘어가기 전에`, 현재 페이지가 실제로 빌드 가능한 상태인지와 최종 acceptance 전에 무엇이 비어 있는지를 `admin`에서 바로 판정할 수 있게 만드는 것.

즉 `admin`은:

1. 입력 화면
2. 기준 문서 화면
3. 빌드 실행 진입 화면
4. 품질 점검 화면

을 한 흐름으로 묶는 운영 검증 레이어다.

---

## 2. 여기서 말하는 “검증”의 뜻

이번 검증은 “버튼을 눌러보니 에러가 안 난다” 수준이 아니다.

아래 5가지를 통과했는지를 보는 의미다.

1. 이 페이지의 정체성이 기준 문서로 준비되어 있는가
2. 이번 요청이 요구사항으로 충분히 구조화되어 있는가
3. 요구사항이 고객용 PRD로 변환되어 승인 가능한가
4. PRD가 실제 builder 실행 입력으로 연결 가능한가
5. builder 결과와 acceptance 상태를 보고 최종 빌드 진입 여부를 판정할 수 있는가

즉 검증 대상은 `UI`, `문서`, `빌드 입력`, `결과물`, `최종 수용 상태`까지 포함한다.

---

## 3. 빌드 준비도 판단 게이트

### Gate 1. 기준 문서 준비

대상:
- 페이지 정체성

통과 조건:
- `role`
- `purpose`
- `designIntent`
- `mustPreserve`
- `shouldAvoid`
- `visualGuardrails`

중 핵심 항목이 비어 있지 않다.

판정 의미:
- 이 gate를 통과하지 못하면 이후 PRD와 builder 판단 기준이 흔들린다.

### Gate 2. 요구사항 준비

대상:
- 현재 변경 요청

통과 조건:
- 요청 제목 또는 요청 배경이 존재
- 핵심 메시지/원하는 방향/피해야 할 방향/레퍼런스 중 최소 일부가 존재
- 변화 강도와 범위가 결정되어 있다

판정 의미:
- builder 실행 전 “무엇을 바꾸려는가”가 문장으로 정리돼 있어야 한다.

### Gate 3. PRD 준비

대상:
- 고객/내부 담당자가 읽을 수 있는 문서형 결과

통과 조건:
- `requirementPlan`이 존재
- `requestSummary`, `planningDirection`, `designDirection`, `priority`, `guardrails`가 문서로 읽히는 수준으로 채워져 있다
- 단순 raw JSON이 아니라 화면에서 읽을 수 있는 PRD 렌더가 가능하다

판정 의미:
- 이 gate를 통과하지 못하면 builder는 돌아가더라도 승인된 작업으로 보기 어렵다.

### Gate 4. Builder 실행 준비

대상:
- builder 입력 스펙

통과 조건:
- `builderBrief`가 존재
- `designSpecMarkdown` 또는 동급 실행 스펙이 존재
- `sectionBlueprints` 또는 섹션 수준 실행 기준이 존재
- 어떤 섹션을 중심으로 바꾸는지 설명 가능하다

판정 의미:
- PRD가 있어도 builder 입력이 비어 있으면 “문서는 있음, 빌드는 불가” 상태다.

### Gate 5. 결과물 및 Acceptance 준비

대상:
- draft build / saved version / final acceptance

통과 조건:
- 최신 draft build 또는 saved version이 존재
- preview / compare / pinned 흐름이 동작한다
- final acceptance 전 필요한 API/summary 상태를 읽을 수 있다
- `ready-for-llm` 또는 그 이전 block reason을 설명할 수 있다

판정 의미:
- 이 gate는 “실제로 다음 단계로 넘길 수 있는가”를 판정한다.

---

## 4. `admin`이 보여줘야 하는 최소 판정 축

이번 범위에서 `admin`은 아래 축을 최소한 명확히 보여줘야 한다.

1. `페이지 정체성 준비됨 / 미준비`
2. `요구사항 준비됨 / 작성중 / 미준비`
3. `PRD 준비됨 / 생성 필요`
4. `Builder 실행 가능 / 스펙 부족 / 결과 있음`
5. `Final acceptance 대기 / 진행중 / 완료`

중요:
- 마지막 축이 빠지면 운영자는 “builder는 돌았는데 최종 빌드로 넘겨도 되는지”를 판단할 수 없다.
- 즉 `admin`은 builder 실행 화면에서 끝나면 안 되고, acceptance 진입점까지 이어져야 한다.

---

## 5. 운영 판정에 사용할 근거 데이터

### 기준 문서

- `GET /api/workspace/page-identity`
- 최신 `requirementPlan`
- `builderMarkdown`
- `layoutMockupMarkdown`
- `designSpecMarkdown`
- `sectionBlueprints`

### 실행 결과

- `latestDraftBuild`
- `savedVersions`
- `currentPinnedView`
- `preview / compare` 링크

### 품질 및 readiness

- `/api/visual-batch-summary`
- `/api/workspace/pre-llm-gaps?pageId=<id>`
- `/api/workspace/final-readiness`
- acceptance bundle 상태

---

## 6. 이번 admin 개편에서 놓치면 안 되는 것

1. 연구용 mock 상태를 운영 준비도 판정으로 착각하면 안 된다.
2. `요구사항/PRD/정체성`은 읽기 쉬워야 하지만, 운영 저장 구조와 분리되면 안 된다.
3. builder 결과가 있어도 acceptance 상태가 없으면 최종 빌드 준비 완료로 보면 안 된다.
4. 반대로 acceptance만 강조하고 builder 입력 스펙이 비어 있으면 운영자가 다시 아래로 내려가서 원인을 찾게 된다.
5. 따라서 `admin`은 “입력 -> 문서 -> 실행 -> 검수”를 한 화면 흐름으로 연결해야 한다.

---

## 7. 이 문서와 연결되는 기존 문서

같이 보는 문서:

1. `docs/requirements-prd-identity-focus-2026-04-16.md`
2. `docs/admin-operational-field-mapping-2026-04-16.md`
3. `docs/admin-prd-adapter-design-2026-04-16.md`
4. `docs/final-acceptance-runbook.md`
5. `data/normalized/readiness-audit.md`

정리:

- `requirements-prd-identity-focus`는 범위 정의
- `field mapping`은 운영 데이터 정합성 정의
- `PRD adapter`는 문서 렌더 정의
- `final acceptance runbook`은 마지막 검수 순서 정의
- 이 문서는 그 전체를 `admin`이 어떤 의미로 검증해야 하는지 정의한다.
