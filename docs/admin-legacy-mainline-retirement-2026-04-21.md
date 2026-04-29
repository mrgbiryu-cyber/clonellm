# Legacy Mainline Retirement

## Goal

`builder-v2`와 legacy LLM 오케스트레이션을 더 이상 본선으로 사용하지 않는다.

새 본선은 아래 한 줄로 고정한다.

`요구사항 -> 컨셉서 -> canonical render model -> local build draft -> clone/compare`

## Keep

- `design-pipeline/`
- `canonical cloneRenderModel`
- `local planning provider`
- `local build draft`
- `clone shell`, `compare shell`
- 원본 캡처/자산 추출 유틸
- 재사용 가능한 순수 renderer 함수
- page identity / policy / concept / brief 데이터

## Isolate

- `builder-v2/` 전체
- `/api/llm/plan`
- `/api/llm/build`
- composer / critic / recovery / compare rerun 계층
- legacy `report.componentComposition` 우선 소비 경로
- patch 중심 runtime 번역 계층

위 항목은 즉시 삭제보다 먼저 `본선 진입 차단` 상태로 둔다.

## Drop

- 본선에서 더 이상 호출되지 않는 legacy planner/builder API
- UI에서 노출되는 `외부 모델(openrouter)` 선택 경로
- legacy mainline에 묶인 loop / retry / quality gate 기본 경로

## Execution Order

1. UI 기본 경로를 `local concept -> local build`로 고정한다.
2. `/api/llm/plan`, `/api/llm/build`는 `legacy_mainline_retired`로 차단한다.
3. canonical renderer 소비자를 붙이고, legacy runtime 번역 계층을 우회한다.
4. 그 뒤 `builder-v2/`와 legacy orchestration을 물리 삭제한다.

## Current Boundary

현재는 아직 legacy renderer 소비 계층이 일부 살아 있어서 canonical model이 최종 HTML에서 약화된다.

다음 작업의 기준은 이것이다.

- legacy를 “고쳐서” canonical을 태우지 않는다.
- canonical 경로를 독립적으로 닫는다.
- legacy는 참조/재사용 대상으로만 남기고 본선 결정권을 주지 않는다.
