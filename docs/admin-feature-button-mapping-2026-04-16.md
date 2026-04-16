# 관리자 화면 기능 · 버튼 매핑

## 1. 목적

이 문서는 최신 pull 기준 `web/admin.html`에 존재하는 기능과 버튼을 전부 나열하고,

- 무엇이 현재 화면에 있는지
- 어떤 버튼이 어떤 동작을 하는지
- 향후 구조 개편 시 무엇을 메인에 남기고
- 무엇을 새 창/새 탭으로 빼거나
- 무엇을 접거나 운영 전용으로 내려도 되는지

를 판단하기 위한 인벤토리 문서다.

이번 매핑은 **삭제 판단용이 아니라 보존 판단용**이다.

즉 “없어져도 되나?”가 아니라,

**“어디에 남겨야 안전한가?”**

를 보기 위한 문서다.

---

## 2. 현재 주요 라우트

최신본 기준 사용자/운영 진입 경로는 아래다.

- `/preview` 또는 `/`
  - 기존 preview 화면
- `/login`
  - 운영 로그인
- `/admin`
  - 현재 운영 관리자 화면
- `/compare/:pageId`
  - 비교 화면
- `/page/:pageId`
  - 페이지 보기 계열

관련 코드:

- [server.js](/mnt/c/users/llm/desktop/project/rull/clonellm-latest/server.js:16581)

---

## 3. 기능 분류 기준

각 기능은 아래 4가지로 분류한다.

- `메인 유지`
  - 새 관리자 구조에서도 본문 또는 상단에 직접 보여야 함
- `새 창/새 탭 가능`
  - 본문 안에 둘 필요는 없고, 링크로 열어도 됨
- `접힘 섹션`
  - 유지하되 기본 노출하지 않아도 됨
- `운영 전용`
  - 일반 문서 흐름과 분리해야 함

---

## 4. 전역 / 공통 기능

| 기능 | 현재 위치 | 현재 UI | 권장 분류 | 비고 |
| --- | --- | --- | --- | --- |
| 로그아웃 | 상단 헤더 | `#logoutBtn` | 메인 유지 | 운영 세션 종료 |
| 세션 정보 표시 | 상단 헤더 | `#sessionMeta` | 메인 유지 | 다만 노출 밀도는 축소 가능 |
| 관리자 공지 | 좌측 목록 상단 | `#adminNotice` | 메인 유지 | 에러/복사 완료 등 피드백용 |
| 작업 이력 패널 | 좌측 하단 | `#historyPanel` | 접힘 섹션 | 문서 작업 중심 구조에선 후순위 |
| 도움말 모달 | 전역 | `data-help-*`, `auxModal` | 메인 유지 | 각 섹션에 필요한 최소 도움말만 유지 |

관련 코드:

- [web/admin.html](/mnt/c/users/llm/desktop/project/rull/clonellm-latest/web/admin.html:295)
- [web/admin.html](/mnt/c/users/llm/desktop/project/rull/clonellm-latest/web/admin.html:3746)

---

## 5. 좌측 목록 영역

## 5.1 페이지 목록

| 기능 | 현재 위치 | 현재 UI | 권장 분류 | 비고 |
| --- | --- | --- | --- | --- |
| 페이지 목록 표시 | 좌측 메인 | `#pageList` | 메인 유지 | 개편 후에도 핵심 |
| 빠른 페이지 선택 | 좌측 툴바 | `#pageQuickSelect` | 메인 유지 | 검색/필터와 합칠 수 있음 |
| 선택 페이지 적용 | 좌측 툴바 | `.apply-selected-page-btn` | 메인 유지 | 더 단순한 구조로 바꿀 수 있음 |
| 페이지 클릭 이동 | 좌측 목록 행 | `.row` / `.page-item` | 메인 유지 | 핵심 내비 |
| 사이드 기록 선택 | 좌측 보조영역 | `.sidebar-record-item` | 접힘 섹션 | 플랜/드래프트/버전 선택용 |

관련 코드:

- [web/admin.html](/mnt/c/users/llm/desktop/project/rull/clonellm-latest/web/admin.html:1782)
- [web/admin.html](/mnt/c/users/llm/desktop/project/rull/clonellm-latest/web/admin.html:1543)

## 5.2 좌측 목록에서 앞으로 보여줄 상태

문서 중심 구조로 바뀌면 좌측에서 반드시 보존해야 하는 상태는 아래 3개다.

- 정체성
- 요구사항
- 기획서

즉 현재 좌측에서 노출되는 다른 runtime/acceptance 중심 상태는 후순위로 밀 수 있다.

---

## 6. 우측 상세 헤더

현재 헤더 기능:

| 기능 | 현재 UI | 권장 분류 | 비고 |
| --- | --- | --- | --- |
| 페이지 제목/메타 | 기본 텍스트 | 메인 유지 | 개편 후 간결화 |
| 홈 뷰포트 선택 | `#homeViewportProfile` | 메인 유지 | 홈 대상일 때만 |
| 페이지 정체성 편집 | `#editPageIdentityBtn` | 메인 유지 | 단, 모달이 아니라 본문 섹션으로 이동 예정 |
| 이 페이지 수정 초기화 | `#resetWorkspaceBtn` | 운영 전용 | 일반 문서 흐름에서 전면 노출 불필요 |

관련 코드:

- [web/admin.html](/mnt/c/users/llm/desktop/project/rull/clonellm-latest/web/admin.html:2488)
- [web/admin.html](/mnt/c/users/llm/desktop/project/rull/clonellm-latest/web/admin.html:3238)

---

## 7. 상단 미리보기

| 기능 | 현재 위치 | 현재 UI | 권장 분류 | 비고 |
| --- | --- | --- | --- | --- |
| clone preview iframe | 헤더 바로 아래 | `<iframe class="preview-frame">` | 새 창/새 탭 가능 | 문서 중심 구조에서는 본문에서 분리 가능 |

판단:

- 현재 문서 중심 개편에서는 **본문에 크게 유지할 필요가 없다**
- `미리보기 열기` 버튼으로 새 창/새 탭 이동 구조가 더 적절함

관련 코드:

- [web/admin.html](/mnt/c/users/llm/desktop/project/rull/clonellm-latest/web/admin.html:2509)

---

## 8. 요구사항 정리 / Planner 영역

현재 이 영역은 사실상 3개의 레이어가 섞여 있다.

1. 요구사항 입력
2. 기획 초안 생성
3. 기획서 편집/렌더

이 때문에 향후 반드시 분리해야 한다.

## 8.1 요구사항 입력 기능

| 기능 | 현재 UI | 권장 분류 | 비고 |
| --- | --- | --- | --- |
| 입력 방식 선택 | `#planMode` | 메인 유지 | 요구사항 섹션에 남김 |
| 적용 범위 선택 | `#planComponentOnly` | 메인 유지 | 요구사항 섹션에 남김 |
| 대상 컴포넌트 선택 | `name=\"planTargetComponent\"` | 메인 유지 | 범위가 컴포넌트일 때만 |
| 디자인 변화율 선택 | `#planDesignChangeLevel` | 메인 유지 | 요구사항 섹션 또는 기획서 생성 옵션으로 유지 |
| 레퍼런스 URL 입력 | `#planReferenceUrls` | 메인 유지 | 요구사항 섹션 |
| 원하는 방향 | `#planPreferredDirection` | 메인 유지 | 요구사항 섹션 |
| 톤앤매너 | `#planToneAndMood` | 메인 유지 | 요구사항 섹션 |
| 핵심 메시지 | `#planKeyMessage` | 메인 유지 | 요구사항 섹션 |
| 피하고 싶은 방향 | `#planAvoidDirection` | 메인 유지 | 요구사항 섹션 |
| 고객요구사항 입력 | `#planRequestText` | 메인 유지 | 요구사항 섹션의 핵심 |
| 기획안 생성 | `#runPlanner` | 메인 유지 | 요구사항 섹션의 핵심 CTA |

관련 코드:

- [web/admin.html](/mnt/c/users/llm/desktop/project/rull/clonellm-latest/web/admin.html:2520)
- [web/admin.html](/mnt/c/users/llm/desktop/project/rull/clonellm-latest/web/admin.html:3242)

## 8.2 기획서 / 초안 기능

| 기능 | 현재 UI | 권장 분류 | 비고 |
| --- | --- | --- | --- |
| planner 로딩 박스 | `#plannerLoadingBox` | 메인 유지 | 기획서 생성 과정에서 필요 |
| 기획 초안 영역 | `#plannerDraftRegion` | 메인 유지 | 하지만 “기획서” 섹션으로 독립 |
| 편집 모드 전환 | `#togglePlanEditModeBtn` | 메인 유지 | 기획서 섹션 안으로 이동 |
| 기획서 요약 렌더 | `requirementPlanDigestHtml` | 메인 유지 | 고객용 문서의 핵심 |
| 기획서 원문 보기 | `fold-section` | 메인 유지 | 보조 노출 |
| 와이어프레임 보기 | `fold-section` | 메인 유지 | 기획서의 부록 성격 |
| 기획안 제목 수정 | `#planTitle` | 메인 유지 | 기획서 섹션 |
| 요구사항 요약 수정 | `#planRequestSummary` | 메인 유지 | 기획서 섹션 |
| 기획 방향 수정 | `#planPlanningDirection` | 메인 유지 | 기획서 섹션 |
| 디자인 방향 수정 | `#planDesignDirection` | 메인 유지 | 기획서 섹션 |
| 우선순위 수정 | `#planPriority` | 메인 유지 | 기획서 섹션 |
| 가드레일 수정 | `#planGuardrails` | 메인 유지 | 기획서 섹션 |
| 기획안 저장 | `#savePlanBtn` | 메인 유지 | 기획서 저장 CTA |

관련 코드:

- [web/admin.html](/mnt/c/users/llm/desktop/project/rull/clonellm-latest/web/admin.html:2616)
- [web/admin.html](/mnt/c/users/llm/desktop/project/rull/clonellm-latest/web/admin.html:3310)

## 8.3 기획서 영역에서 메인에서 빼야 할 것

아래는 기획서 메인 노출에서 빼는 것이 좋다.

| 기능 | 현재 UI | 권장 분류 | 비고 |
| --- | --- | --- | --- |
| Builder 목표 | `#planBuilderObjective` | 접힘 섹션 | 고객 문서보다 빌더 입력에 가까움 |
| Builder 집중 slot | `#planBuilderFocusSlots` | 접힘 섹션 | 내부용 |
| 유지해야 할 것 | `#planBuilderMustKeep` | 접힘 섹션 | 내부용 |
| 반드시 바꿔야 할 것 | `#planBuilderMustChange` | 접힘 섹션 | 내부용 |

즉 `builderBrief` 계열은 기획서 전면이 아니라, 추후 빌더 섹션 또는 접힌 고급 옵션으로 내리는 것이 맞다.

---

## 9. 레퍼런스 분석 결과

| 기능 | 현재 UI | 권장 분류 | 비고 |
| --- | --- | --- | --- |
| Slot 매칭 요약 | planner 하단 | 접힘 섹션 | 기획 생성 맥락에는 유용하지만 기본 노출은 과함 |
| Guardrail 표시 | planner 하단 | 접힘 섹션 | 운영/검토용 |
| reference analysis 목록 | planner 하단 | 접힘 섹션 | 기본 화면에선 길어짐 |
| artifact path / design-md metadata | planner 하단 | 운영 전용 | 일반 사용자는 경로를 볼 필요 없음 |

관련 코드:

- [web/admin.html](/mnt/c/users/llm/desktop/project/rull/clonellm-latest/web/admin.html:2723)

---

## 10. 빌더 / 버전 / 현재 View

이 영역은 기능상 중요하지만, 이번 문서 중심 개편에서는 **메인 전면 영역에서 내려야 한다.**

## 10.1 빌더 영역

| 기능 | 현재 UI | 권장 분류 | 비고 |
| --- | --- | --- | --- |
| 버전명 힌트 입력 | `#builderVersionLabelHint` | 접힘 섹션 | 빌더 영역에 유지 |
| 디자인 생성 실행 | `#runBuilder` | 접힘 섹션 | 필요하지만 문서 3섹션 뒤로 |
| builder 로딩 박스 | `#builderLoadingBox` | 접힘 섹션 | 빌더 내부 전용 |
| draft 결과 새 탭 보기 | 링크 버튼 | 새 창/새 탭 가능 | 별도 미리보기 적합 |
| 생성 전/후 비교 | `#openDetailPageCompareBtn` | 새 창/새 탭 가능 | 현재 구조상 외부 링크 적합 |

## 10.2 저장 버전 / 현재 View

| 기능 | 현재 UI | 권장 분류 | 비고 |
| --- | --- | --- | --- |
| 저장 버전 확정 | `#saveVersionBtn` | 접힘 섹션 | 빌더 후속 액션 |
| 현재 View로 고정 | `.pin-version-btn` | 접힘 섹션 | 운영/반영 액션 |
| 저장 버전 목록 | planner-ref-list | 접힘 섹션 | 기본 화면에서 길어짐 |
| 현재 View 상태 표시 | `#versionStatus` | 접힘 섹션 | 빌더 영역 내부 상태 |

관련 코드:

- [web/admin.html](/mnt/c/users/llm/desktop/project/rull/clonellm-latest/web/admin.html:2761)
- [web/admin.html](/mnt/c/users/llm/desktop/project/rull/clonellm-latest/web/admin.html:3322)

---

## 11. Legacy 직접 AI 적용

| 기능 | 현재 UI | 권장 분류 | 비고 |
| --- | --- | --- | --- |
| 직접 프롬프트 입력 | `#llmPrompt` | 운영 전용 | 문서 중심 구조와 충돌 |
| AI로 바로 적용 | `#runLlm` | 운영 전용 | planner/builder 우회 경로 |
| legacy 상태 메시지 | `#llmStatus` | 운영 전용 | 내부/임시 기능 |

판단:

- 이 기능은 없어지면 애매할 수 있으므로 유지하되,
- 반드시 **운영 도구**로 내려야 한다.

관련 코드:

- [web/admin.html](/mnt/c/users/llm/desktop/project/rull/clonellm-latest/web/admin.html:2848)
- [web/admin.html](/mnt/c/users/llm/desktop/project/rull/clonellm-latest/web/admin.html:3383)

---

## 12. 수정 가능한 컴포넌트

| 기능 | 현재 UI | 권장 분류 | 비고 |
| --- | --- | --- | --- |
| source 선택 | `.source-select` | 운영 전용 | low-level 조작 |
| 이 소스로 바꾸기 | `.apply-source-btn` | 운영 전용 | low-level 조작 |
| 저장된 수정 불러오기 | `.load-patch-btn` | 운영 전용 | low-level 조작 |
| patch JSON 입력 | `.patch-json` | 운영 전용 | 운영자/개발자 전용 |
| 직접 수정 저장 | `.apply-patch-btn` | 운영 전용 | 고객용 문서 흐름과 분리 |

관련 코드:

- [web/admin.html](/mnt/c/users/llm/desktop/project/rull/clonellm-latest/web/admin.html:2867)
- [web/admin.html](/mnt/c/users/llm/desktop/project/rull/clonellm-latest/web/admin.html:3416)

판단:

- 절대 없어지면 안 됨
- 하지만 메인 문서 구조에서 완전히 분리해야 함

---

## 13. 공유용 섹션 / 원본 섹션 추출 / 디자인 레퍼런스 라이브러리

| 기능 | 현재 UI | 권장 분류 | 비고 |
| --- | --- | --- | --- |
| 공유용 섹션 메타 | `shareSectionsHtml` | 운영 전용 | builder/구조 검증용 |
| 원본 섹션 추출 메타 | `artifactSectionsHtml` | 운영 전용 | 구조 추출/검증용 |
| 디자인 레퍼런스 라이브러리 | `designReferenceLibraryHtml` | 접힘 섹션 | 유지 필요, 기본 전면 노출은 과함 |
| 수집 우선 소스 | `designReferenceSeedHtml` | 접힘 섹션 | 레퍼런스 관리용 |

판단:

- 라이브러리 자체는 중요함
- 다만 이번 문서 중심 메인 흐름에는 직접 넣지 않고, `레퍼런스 / 지식` 접힘 영역이나 별도 페이지가 적절함

관련 코드:

- [web/admin.html](/mnt/c/users/llm/desktop/project/rull/clonellm-latest/web/admin.html:2932)

---

## 14. 비교 자료 / 운영 번들

| 기능 | 현재 UI | 권장 분류 | 비고 |
| --- | --- | --- | --- |
| 페이지 비교 보기 | 링크 버튼 | 새 창/새 탭 가능 | 본문 임베드보다 외부 링크 적합 |
| 번들 비교 보기 | 링크 버튼 | 새 창/새 탭 가능 | 외부 비교 화면 적합 |
| 링크 복사 | `.review-copy-btn` 등 | 접힘 섹션 | 검토용 보조 기능 |
| 운영 번들 목록 | `allBundlesHtml` / `bundleHtml` | 운영 전용 | 문서 흐름과 별개 |
| 홈 링크 현황 | `homeLinkCoverageHtml` | 운영 전용 | 기술/운영 메타 |

관련 코드:

- [web/admin.html](/mnt/c/users/llm/desktop/project/rull/clonellm-latest/web/admin.html:2943)
- [web/admin.html](/mnt/c/users/llm/desktop/project/rull/clonellm-latest/web/admin.html:3590)

---

## 15. 기술 정보

| 기능 | 현재 UI | 권장 분류 | 비고 |
| --- | --- | --- | --- |
| 런타임 범위 | `runtimeScopeHtml` | 운영 전용 | 일반 사용자 대상 아님 |
| 페이지 주의사항 | `advisoryHtml` | 운영 전용 | 운영 검토용 |
| PDP 연결 상태 | meta block | 운영 전용 | 구조 설명용 |
| Pre-LLM 상태 | `gaps` | 운영 전용 | readiness/debug 정보 |
| 배치 상태 | `visualBatch` | 운영 전용 | 수집/검증용 |

관련 코드:

- [web/admin.html](/mnt/c/users/llm/desktop/project/rull/clonellm-latest/web/admin.html:2966)

---

## 16. 모달 / 보조 기능

| 기능 | 현재 UI | 권장 분류 | 비고 |
| --- | --- | --- | --- |
| 페이지 정체성 모달 | `pageIdentityModal` | 메인 유지(형태 변경) | 기능은 유지, 모달에서 본문 섹션으로 이동 예정 |
| 도움말 모달 | `auxModal` | 메인 유지 | context help로 유용 |
| 히스토리 모달 | `renderHistoryModal()` | 접힘 섹션 | 메인 문서 흐름에서는 뒤로 |

관련 코드:

- [web/admin.html](/mnt/c/users/llm/desktop/project/rull/clonellm-latest/web/admin.html:236)
- [web/admin.html](/mnt/c/users/llm/desktop/project/rull/clonellm-latest/web/admin.html:1624)

---

## 17. 구조 개편 관점의 보존 우선순위

## 17.1 메인에 남겨야 하는 것

1. 페이지 목록
2. 페이지 정체성
3. 요구사항 입력
4. 기획서 렌더 / 편집 / 저장
5. 기획안 생성 CTA
6. 최소 상태 피드백

## 17.2 링크로 빼도 되는 것

1. clone 미리보기
2. 생성 전/후 비교
3. 페이지 비교 / 번들 비교

즉 **미리보기/비교는 새 창으로 빼도 기능 손실이 크지 않다.**

## 17.3 접어도 되는 것

1. 레퍼런스 분석 결과
2. 디자인 레퍼런스 라이브러리
3. 저장 버전 / 현재 View
4. 작업 이력

## 17.4 운영 전용으로 분리해야 하는 것

1. Legacy 직접 AI 적용
2. 수정 가능한 컴포넌트
3. 공유용 섹션 / 원본 섹션 추출
4. acceptance / runtime / coverage / artifact / batch 상태

---

## 18. 결론

최신본 기준으로 보면, 현재 admin에는 기능이 빠진 것이 아니라 **너무 많이 한 화면에 있다.**

따라서 구조 개편의 원칙은 이렇다.

- 메인 문서 흐름:
  - 페이지 정체성
  - 요구사항
  - 기획서
- 외부 링크:
  - 미리보기
  - 비교
- 접힘/보조:
  - 레퍼런스 / 버전 / 이력
- 운영 전용:
  - low-level 조작
  - acceptance/runtime/debug

즉 새 창으로 빠져도 되는 것은 꽤 있지만,
**없어지면 애매한 기능들은 대부분 “운영 전용/접힘”으로 남겨야 한다.**
