# Preservation / Interference Audit Checklist

Date: 2026-04-22
Owner: Codex
Status: Active

## 목적

이 문서는 현재 코드 감사를 할 때 무엇을 확인해야 하는지에 대한 실제 체크리스트다.

상위 방법론은 다음 문서를 따른다.

- [Preservation / Interference Debug Method](./admin-preservation-interference-debug-method-2026-04-22.md)

## 1. Requirement -> Plan 저장 경로

확인 질문:

- 사용자가 입력한 requirement가 저장 시 요약/축약되는가
- `targetGroupId`, `targetComponents`, `sectionBlueprints`, `selectedConcept`, `planningPackage`가 저장본에 그대로 남는가
- `normalizeRequirementPlan()`이 필드를 버리거나 강제로 정규화하는가

현재 확인 대상:

- [web/admin-research.html](../web/admin-research.html)
- [auth.js](../auth.js)

실패 신호:

- preview에서는 존재하던 값이 saved plan에서 비어 있음

## 2. Saved Plan -> Concept Package

확인 질문:

- `buildConceptPackageFromRequirementPlan()`이 plan 원문을 다시 해석해서 새 target group을 만들고 있는가
- `targetComponents`, `slotIds`, `sectionBlueprints`가 그대로 전달되는가
- authoringMode를 중간에서 구현 편의상 재설정하는가

현재 확인 대상:

- [design-pipeline/author-input.js](../design-pipeline/author-input.js)

실패 신호:

- saved plan에는 값이 있는데 conceptPackage에서 비어짐

## 3. Concept Package -> Design Author Input

확인 질문:

- `buildDesignAuthorInput()`이 target section identifiers를 보존하는가
- `packet.sections`를 만들 때 새 기준을 강제로 넣는가
- `currentSectionHtmlMap`와 identifier 연결이 끊기지 않는가
- packet이 원문을 대체하는 입력으로 비대해지고 있지 않은가

현재 확인 대상:

- [design-pipeline/author-input.js](../design-pipeline/author-input.js)

실패 신호:

- `packetSectionKeys=[]`
- `packetStats.sectionCount=0`
- declared identifiers와 현재 section html map이 불일치

## 4. Design Author Sequence

확인 질문:

- `buildSectionSequencePlan()`이 packet.sections를 재정의하지 않고 순서만 정하는가
- 빈 시퀀스가 생겼을 때 그 원인을 상위 입력에서 찾을 수 있는가
- upstream context가 다음 섹션을 오염시키지 않는가

현재 확인 대상:

- [design-pipeline/section-sequence.js](../design-pipeline/section-sequence.js)
- [design-pipeline/author-llm.js](../design-pipeline/author-llm.js)

실패 신호:

- `design_author_sequence_plan_empty`
- sequence plan이 declared section identifiers와 다름

## 5. Design Author Provider

확인 질문:

- 모델이 실제로 어떤 응답을 줬는지 raw document가 보이는가
- provider truncation인지, parser failure인지, identifier mismatch인지 구분 가능한가
- parser가 존재하지 않는 HTML을 억지 복구하지 않는가

현재 확인 대상:

- [design-pipeline/author-llm.js](../design-pipeline/author-llm.js)
- [llm.js](../llm.js)

실패 신호:

- `finishReason=length`
- `reasoning_tokens` 과다
- `declaredSectionKeys`는 있는데 `projectedSectionKeys`가 비어 있음

## 6. Authored Markdown -> Runtime Projection

확인 질문:

- projection이 section identifiers를 기준으로만 동작하는가
- count 기반 성공 판정에 의존하지 않는가
- authored markdown의 html 정본을 다시 content 필드로 덮어쓰지 않는가

현재 확인 대상:

- [design-pipeline/author-document.js](../design-pipeline/author-document.js)
- [design-pipeline/author-validation.js](../design-pipeline/author-validation.js)
- [design-pipeline/runtime-input.js](../design-pipeline/runtime-input.js)

실패 신호:

- `missingSectionKeys` 발생
- `content`가 `html`보다 우선해서 소비됨

## 7. Runtime Delivery

확인 질문:

- runtime이 delivery 외 의미 해석을 하지 않는가
- shell insertion이 target group을 다시 넓히지 않는가
- asset slot resolution이 authored html을 재작성하지 않는가

현재 확인 대상:

- [design-pipeline/runtime-renderer.js](../design-pipeline/runtime-renderer.js)
- [design-pipeline/html-inserter.js](../design-pipeline/html-inserter.js)
- [design-pipeline/asset-resolver.js](../design-pipeline/asset-resolver.js)
- [design-pipeline/runtime-sanitize.js](../design-pipeline/runtime-sanitize.js)

실패 신호:

- runtime이 content/layout/copy를 다시 조합함
- runtime이 target boundary를 다시 계산해 authored section 범위를 바꿈

## 8. Debug / Trace 사용 원칙

확인 질문:

- trace 필드가 정본처럼 재사용되는가
- debug용 sectionCount가 설계를 끌고 가는가
- declared / projected section identifiers가 중심이고, count는 보조로만 쓰는가

현재 확인 대상:

- [server.js](../server.js)
- saved draft `snapshotData`

실패 신호:

- trace 값으로 다음 입력을 만들기 시작함
- count가 identifier보다 우선 판단 기준이 됨

## 9. 얇은 E2E 기준

현재 권장 테스트:

1. requirement 저장
2. concept 저장
3. build 실행
4. saved draft의 `snapshotData` 확인

우선 보는 항목:

- `authoringStageTrace.request`
- `authoringStageTrace.approvedPlan`
- `authoringStageTrace.conceptPackage`
- `authoringStageTrace.authorInput`
- `authoringStageTrace.sequencePlan`
- `designAuthorProviderMeta`
- `designAuthorFailureDebug`

## 10. 보정 원칙

문제가 발견되면 다음 순서로 보정한다.

1. 원문 보존 보정
2. 중간 개입 제거
3. runtime 지원 보강
4. 모델 품질/프롬프트 튜닝

그 반대로 가면 다시 레거시 보정 루프로 돌아간다.
