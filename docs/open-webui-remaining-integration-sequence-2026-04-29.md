# Open WebUI Remaining Integration Sequence (2026-04-29)

## 현재 기준 상태

- 공개 진입점은 `http://34.27.99.82:3000` 하나로 유지한다.
- `openwebui-public-proxy`가 공개 `3000`을 받고 Open WebUI와 `clonellm` 경로를 분기한다.
- Open WebUI는 내부 `127.0.0.1:8080`에서 실행한다.
- `clonellm` builder/runtime은 내부 `127.0.0.1:3100`에서 실행한다.
- Open WebUI 명칭은 `CNS Atlas`로 노출한다.
- Open WebUI 모델 연결은 OpenRouter OpenAI-compatible endpoint를 사용한다.
- `LGE Builder Draft Action` Function은 Open WebUI DB에 등록되어 있고 전역 활성화되어 있다.
- 공개 `/admin`은 Open WebUI admin이다. 기존 `clonellm` builder admin은 `/builder-admin`으로 직접 접속한다.
- A 확정 기준 concept-preview API는 `POST /api/builder/lge/v1/concept-preview`와 `GET /api/builder/lge/v1/concept-jobs/:jobId`다.
- 기본 Atlas 흐름은 `requirement format -> concept-preview -> conceptDocument -> user confirmation -> preflight -> draft build`다.
- YAML/build metadata direct build는 기존 Draft Action의 backend compatibility로만 유지하고 Atlas 모델 prompt에는 넣지 않는다.
- draft build 완료 후 Open WebUI 저장용 `artifact_metadata`를 top-level로 반환한다.

## 남은 작업 순서

### 1. 채팅 모델 기본 동작 검증

목표:

- CNS Atlas에서 일반 채팅이 OpenRouter 모델로 응답하는지 확인한다.

확인 항목:

- 모델 드롭다운에 `anthropic/claude-haiku-4.5`가 보이는지
- 첫 메시지 응답이 생성되는지
- Open WebUI 로그에 OpenRouter/OpenAI provider 오류가 없는지

완료 기준:

- 사용자가 CNS Atlas에서 일반 대화를 생성하고 저장할 수 있다.

### 1-1. Atlas Builder preset MVP 운영안

문제:

- `#아틀라스`가 일반 user text로만 모델에 전달되면 선택 모델은 일반 Q&A/컨설팅 답변으로 끝날 수 있다.
- Action은 메시지 생성 후 버튼 라우팅을 처리하므로, 첫 응답을 Atlas 형식으로 만들려면 모델 입력 단계의 system prompt 주입이 필요하다.

주입 방식 비교:

| 방식 | 선택 모델 무관성 | 사용자 이해 | 코드 변경 | 판단 |
| --- | --- | --- | --- | --- |
| 모델별 system prompt | 낮음 | 보통 | 없음 | 특정 모델 테스트용 |
| Atlas 전용 custom model/preset | 중간 | 높음 | 없음 | 1차 MVP 추천 |
| Prompt Template | 낮음 | 보통 | 없음 | 수동 fallback |
| Knowledge attachment | 낮음 | 낮음 | 없음 | 정책 근거 보강용, 모드 전환용 아님 |
| Filter Function 감지/주입 | 높음 | 높음 | 소규모 Function 필요 | 다음 구현 라운드 추천 |
| Action 버튼 후처리만 사용 | 낮음 | 보통 | 기존 Action | 첫 응답 형식은 고칠 수 없음 |

이번 MVP 운영안:

- Open WebUI에서 `Atlas Builder` custom model/preset을 만든다.
- base model은 `anthropic/claude-haiku-4.5`로 시작한다.
- 해당 preset의 system prompt에 [Atlas Builder User Flow](./open-webui-atlas-builder-user-flow-2026-04-30.md)의 `Atlas System Prompt - Operations Final`을 넣는다.
- LGE Knowledge 컬렉션 `lge-policy`, `lge-component-spec`, `lge-design-history`, `lge-requirements`, `lge-idea-archive`를 preset에 붙인다.
- `LGE Builder Draft Action`을 preset에 붙인다.
- 사용자는 일반 모델이 아니라 `Atlas Builder` 모델을 선택하고 `#아틀라스 ...`로 시작한다.
- Filter Function은 이번 MVP 범위에서 제외한다. 다음 구현 라운드에서 `#아틀라스` 감지/주입으로 확장한다.

Open WebUI UI 절차:

1. `Workspace -> Models`로 이동한다.
2. 새 model/preset을 만든다.
3. 이름을 `Atlas Builder`로 지정한다.
4. base model을 `anthropic/claude-haiku-4.5`로 지정한다.
5. system prompt/instructions에 `Atlas System Prompt - Operations Final`을 붙여 넣는다.
6. Knowledge 섹션에 위 5개 LGE 컬렉션을 붙인다.
7. Actions 섹션에 `LGE Builder Draft Action`을 붙인다.
8. 저장 후 새 채팅에서 모델 선택값이 `Atlas Builder`인지 확인한다.

test@cnspartner.com 재검증 기대:

| 질문 | 기대 응답 | 빌드 상태 |
| --- | --- | --- |
| `#아틀라스 lge.co.kr 메인을 좀 더 좋아 보이게 개선하고 싶어.` | 필수값 중 `viewport`와 `scope`가 없으므로 짧게 질문한다. 예: `필수 정보 중 viewport가 빠졌습니다. PC인지 모바일인지 알려주세요.` | 빌드 없음 |
| `#아틀라스 lge.co.kr 메인 모바일 전체 페이지를 럭셔리하게 개선하고 싶어.` | 필수값 `screen`, `viewport`, `scope`, `request`가 있으므로 요구사항 정리 완료로 응답한다. 예: `요구사항 정리 완료. 메인 / 모바일 / 전체 페이지 / 럭셔리 개선으로 정리했습니다. 이 메시지에서 LGE Builder Draft Action을 실행하면 컨셉서 검토본이 생성됩니다.` | draft build 없음. concept-preview 준비 |
| `#아틀라스 카테고리 페이지를 모바일에서 탐색하기 쉽게 개선하고 싶어.` | 카테고리가 중의적이므로 냉장고 카테고리인지 TV 카테고리인지 확인한다. | 빌드 없음 |
| `#아틀라스 고객여정 기준으로 메인에서 냉장고 카테고리, PDP까지 이어지는 구매 흐름을 개선하고 싶어.` | 4-6줄의 고객여정 intake. 단일 draft build가 아님을 알리고 여정 이름, 페이지 흐름, viewport, 목표, 빌드 분리 방식을 한 줄 형식으로 묻는다. 내부 ID를 노출하지 않는다. | 빌드 없음 |
| concept-preview 완료 뒤 `모바일 메인으로만 빌드해줘` | 직전 concept state를 유지하고 viewport를 `mo`로 갱신한 뒤 preflight로 이동한다. 추가 질문을 반복하지 않는다. | preflight ok 뒤 Action/API가 draft build 시작 |

완료 기준:

- 모호한 `#아틀라스` 질문은 4-6줄의 짧은 intake로 응답한다.
- 충분한 단일 페이지 질문은 질문을 반복하지 않고 자연어 요약 뒤 concept-preview Action/API 실행을 안내한다.
- LLM은 컨셉서 작성자가 아니라 요구사항 정리자다.
- 필수값은 `screen`, `viewport`, `scope`, `request`다.
- `purpose`, `tone`, `changeLevel`, `keep`, `avoid`, `refs`는 참고값이며 없다고 계속 질문하지 않는다.
- 중의적인 경우에만 재질의한다: 카테고리만 있으면 냉장고/TV 등 어떤 카테고리인지, PDP만 있으면 제품군, "전체적으로"가 page 전체인지 톤 전체 적용인지, "첫 화면"이 히어로만인지 히어로+퀵메뉴인지 확인한다.
- 모델은 컨셉서, YAML frontmatter, debug JSON을 직접 작성하지 않는다. 요구사항 포맷 정리까지만 담당하고 `conceptDocument`는 backend concept-preview가 생성한다.
- 내부 추론, Thought, reasoning details, 분석 과정, scratchpad를 출력하지 않는다.
- 고객여정/멀티페이지 질문은 journey intake로 응답한다.
- concept-preview가 만든 `conceptDocument`는 review-only이며 draft build, preview, compare, artifact를 만들지 않는다.
- concept-preview provider가 `local`이면 빠른 초안으로 보고, 고품질 컨셉서는 별도 planner/openrouter provider 사용을 안내한다.
- Markdown checkbox syntax는 사용하지 않는다. 사용자가 텍스트로 답할 수 있는 형식을 제시한다.
- 모델이 단독으로 빌드 상태를 선언하지 않는다. 실제 빌드는 Action/API가 시작할 때만 시작된다.
- 사용자가 `빌드해줘`, `진행해줘`, `확정`, `이걸로 진행`이라고 하면 직전 concept state를 유지하고 preflight로 이동한다.
- 사용자가 `모바일 메인으로 해달라니까`처럼 정정하면 직전 concept state를 유지하고 해당 필드만 바꾼 뒤 concept-preview를 다시 실행한다.

### 2. LGE Builder Action UX 검증

목표:

- 채팅 메시지에서 `LGE Builder Draft Action`을 실행했을 때 message state에 맞는 route로 분기되는지 확인한다.

확인 항목:

- Action 버튼이 보이는지
- `requirement_draft_ready` 상태에서 `POST /api/builder/lge/v1/concept-preview`가 호출되는지
- concept-preview 진행 중 `GET /api/builder/lge/v1/concept-jobs/:jobId`의 stage가 채팅 상태로 표시되는지
- concept-preview 완료 뒤 `requirementDraft`, `requirementPlan`, `builderMarkdown`, `designSpecMarkdown`, `conceptDocument`, `plannerProvider`, `completedAt`이 표시되는지
- 사용자 확정 + preflight ok 뒤에만 `runtime-draft` / `runtime-compare` 링크가 반환되는지
- 일반 답변이나 review-only concept에서 draft build가 시작되지 않는지
- 반환 링크가 공개 `34.27.99.82:3000` 기준인지
- preview/compare가 토큰 포함 URL로 로그인 없이 열리는지

완료 기준:

- concept-preview route에서는 review-only 컨셉서만 표시되고 preview/compare/artifact가 생성되지 않는다.
- build route에서는 Open WebUI 채팅 결과에서 LGE 목업 preview/compare를 바로 열 수 있다.
- non-build route에서는 feasibility, concept draft, Knowledge candidate, note candidate 안내가 표시된다.

### 3. Artifact 저장 최소 계약 고정

목표:

- Builder 결과를 단순 채팅 텍스트가 아니라 Open WebUI가 소유하는 artifact record로 저장한다.

최소 필드:

```json
{
  "projectId": "lge-openwebui-project",
  "pageId": "home",
  "viewportProfile": "pc",
  "conceptDocument": "Markdown source",
  "builderRunId": "runtime-draft-...",
  "previewUrl": "http://34.27.99.82:3000/runtime-draft/...",
  "compareUrl": "http://34.27.99.82:3000/runtime-compare/...",
  "status": "ready"
}
```

완료 기준:

- Action Function 반환값의 `artifact_metadata`를 채팅 메시지와 별도 DB/document record에 저장한다.

Action 반환 metadata 최소 필드:

```json
{
  "schema": "openwebui-lge-builder-artifact-v1",
  "status": "ready",
  "source": "open-webui-action",
  "projectId": "lge-openwebui-project",
  "conceptId": "concept-...",
  "pageId": "home",
  "viewportProfile": "pc",
  "targetGroup": {
    "groupId": "home-top",
    "slotIds": ["hero", "quickmenu"],
    "componentIds": ["home.hero", "home.quickmenu"]
  },
  "conceptDocument": "original YAML frontmatter + Markdown source",
  "builderRunId": "runtime-draft-...",
  "previewUrl": "http://34.27.99.82:3000/runtime-draft/...",
  "compareUrl": "http://34.27.99.82:3000/runtime-compare/..."
}
```

### 4. ConceptDocument 입력 포맷 고정

목표:

- Open WebUI는 먼저 `requirementDraft`를 만들고, concept-preview API가 review-only `conceptDocument`를 생성한다.
- `#아틀라스`는 Builder 작업 모드 진입이며, 즉시 build-ready 컨셉서를 만들라는 명령이 아니다.
- 사용자는 `home`, `hero`, `quickmenu`, `viewportProfile` 같은 내부 ID를 몰라도 된다.

concept-preview API:

| 항목 | A 확정 계약 |
| --- | --- |
| 시작 | `POST /api/builder/lge/v1/concept-preview` |
| 조회 | `GET /api/builder/lge/v1/concept-jobs/:jobId` |
| 인증 | Open WebUI service token |
| 입력 | `requirementDraft` 또는 server planner payload |
| 생성하지 않는 것 | draft build, preview, compare, artifact |
| 기본 conceptDocument | `builderReady: false` review-only Atlas 컨셉서 |
| 다음 단계 | 사용자 확인/확정 후 preflight -> draft build |

done 응답:

- `requirementDraft`
- `requirementPlan`
- `builderMarkdown`
- `designSpecMarkdown`
- `conceptDocument`
- `plannerProvider`
- `completedAt`

concept job stage 문구:

| stage | 사용자 문구 |
| --- | --- |
| `queued` | 컨셉서 생성 요청을 받았습니다. |
| `resolving_target` | 대상 화면과 변경 범위를 정리하고 있습니다. |
| `analyzing_references` | 레퍼런스와 참고 자료를 분석하고 있습니다. |
| `generating_concept` | 기존 빌더 컨셉서 생성 로직으로 초안을 작성하고 있습니다. |
| `formatting_concept_document` | 채팅창에 표시할 컨셉서 문서를 정리하고 있습니다. |
| `done` | 컨셉서가 준비되었습니다. |
| `failed` | 컨셉서 생성에 실패했습니다. |

draft build 진행 문구:

| 상태 | 사용자 문구 |
| --- | --- |
| `build_queued` | draft build 요청을 받았습니다. |
| `build_running` | draft build를 생성하고 있습니다. |
| `build_done` | draft build가 완료되었습니다. Preview / Compare 링크를 확인하세요. |
| `build_failed` | draft build에 실패했습니다. |

상태 모델:

| 상태 | 의미 |
| --- | --- |
| `intake` | 요구사항 필드 수집 중 |
| `requirement_draft_ready` | concept-preview 실행 가능한 `requirementDraft` 준비 완료 |
| `concept_preview_queued` | concept-preview job 생성 완료 |
| `concept_preview_running` | concept-preview job 진행 중 |
| `concept_ready` | review-only concept 출력 완료 |
| `concept_revision_requested` | 사용자가 수정 요청 |
| `build_confirmation_requested` | 사용자가 빌드 확정 |
| `preflight_running` | preflight 실행 중 |
| `feasibility_blocked` | preflight 또는 제약으로 build 차단 |
| `build_queued` | draft build job 생성 완료 |
| `build_running` | draft build 진행 중 |
| `build_done` | draft build 완료 |
| `build_failed` | draft build 실패 |

요구사항 포맷:

| 필드 | 필수 여부 | 설명 |
| --- | --- | --- |
| `screen` | 필수 | 사용자 표현의 화면/페이지/카테고리/PDP |
| `viewport` | 필수 | PC/데스크탑/웹 또는 모바일/MO |
| `scope` | 필수 | 전체 페이지, 첫 화면, 상단, 제품 리스트, PDP 상단 등 |
| `targetArea` | 참고 | 더 구체적인 영역이 있으면 정리 |
| `request` | 필수 | 사용자가 원하는 개선 내용 |
| `purpose` | 참고 | 캠페인/전환/탐색 목적 |
| `changeLevel` | 참고 | low/medium/high |
| `tone` | 참고 | 프리미엄, 럭셔리, 명확한, 심플한 등 |
| `keep` | 참고 | 유지할 조건 |
| `avoid` | 참고 | 금지할 조건 |
| `refs` | 참고 | 레퍼런스 URL 또는 참고 자료 |

입력 조합별 UX:

| 입력 조합 | 처리 |
| --- | --- |
| 요구사항만 | `referenceUrls` 없이 컨셉서 생성 가능. 현재 페이지/범위/요구사항 기반 |
| 레퍼런스만 | `referenceUrls` 중심. 적용 대상 화면/범위만 확인. exact layout copy 금지 |
| 요구사항 + 레퍼런스 | 요구사항 우선. 레퍼런스는 방향/가드레일/무드 보조 |
| 페이지/범위만 | page identity / design reference library / asset policy 기반 자동 초안. "구체 요구가 약한 초안"이라고 표시 |
| 고객여정 | 단일 draft build로 바로 보내지 않고 journey strategy/flow 후보를 만든 뒤 페이지별 빌드로 분해 |

사용자 입력 예시:

```text
#아틀라스 lge.co.kr 메인 PC 버전의 첫 화면을 프리미엄 가전 캠페인 느낌으로 개선하고 싶어.
```

```text
#아틀라스 모바일에서 냉장고 카테고리 PLP를 더 탐색하기 쉽게 개선하고 싶어.
```

```text
#아틀라스 고객여정 기준으로 메인에서 냉장고 카테고리, PDP까지 이어지는 구매 흐름을 개선하고 싶어.
```

사용자 표현과 내부 target mapping:

| 사용자 표현 | 내부 후보 | 추가 질문 필요 여부 |
| --- | --- | --- |
| `lge.co.kr 메인 PC 버전의 첫 화면` | `home`, `pc`, `home-top`, `hero+quickmenu` | 추가 질문으로 멈추지 않고 `가정`에 기록 |
| `모바일에서 냉장고 카테고리 PLP` | `category-refrigerators`, `mo`, `banner/filter/sort/productGrid/firstRow/firstProduct` | 제품 리스트/필터/상단 중 어디인지 확인 |
| `TV 카테고리 PLP` | `category-tvs`, `banner/filter/sort/productGrid/firstRow/firstProduct` | PC/MO 확인 |
| `TV PDP 일반형` / `일반 LED TV 상세` | `pdp-tv-general`, `gallery/summary/price/option/sticky/review/qna` | 대상 영역 확인 |
| `TV PDP 프리미엄` / `OLED 상세` | `pdp-tv-premium`, `gallery/summary/price/option/sticky/review/qna` | 대상 영역 확인 |
| `냉장고 PDP 일반형` / `매직스페이스 상세` | `pdp-refrigerator-general`, `gallery/summary/price/option/sticky/review/qna` | 대상 영역 확인 |
| `냉장고 PDP 노크온` | `pdp-refrigerator-knockon`, `gallery/summary/price/option/sticky/review/qna` | 대상 영역 확인 |
| `냉장고 PDP 글라스` / `미스트 글라스` | `pdp-refrigerator-glass`, `gallery/summary/price/option/sticky/review/qna` | 대상 영역 확인 |
| `제품상세` / `PDP` | 제품군별 PDP 후보 | 제품군/대표 케이스 질문 필요 |
| `가전 구독` / `케어솔루션` | `care-solutions` 또는 `care-solutions-pdp` | 메인/PDP 확인 |
| `베스트샵` / `매장찾기` | `bestshop` | 대상 영역 확인 |
| `고객지원` / `AS` | `support` | 대상 영역 확인 |
| `홈스타일 메인` / `홈스타일 PDP` | `homestyle-home` 또는 `homestyle-pdp` | 메인/PDP 확인 |
| `고객여정 기준으로 메인에서 냉장고 카테고리, PDP까지` | journey spec 후보: `home -> category-refrigerators -> PDP` | 고객여정 intake 필요 |

viewport 표현 매핑:

| 사용자 표현 | 내부 후보 | 추가 질문 필요 여부 |
| --- | --- | --- |
| `PC` / `데스크탑` / `웹` | `pc` | 없음 |
| `모바일` / `mobile` / `MO` | `mo` | 없음 |
| `태블릿` | reserved `ta` | feasibility 안내 필요 |

페이지 표현 매핑:

| 사용자 표현 | 내부 후보 | 추가 질문 필요 여부 |
| --- | --- | --- |
| `메인` / `홈` / `lge.co.kr 첫 화면` | `home` | 보통 없음 |
| `냉장고 카테고리` / `냉장고 PLP` | `category-refrigerators` | 대상 영역 확인 |
| `TV 카테고리` / `TV PLP` | `category-tvs` | 대상 영역 확인 |
| `TV PDP 일반형` | `pdp-tv-general` | 대상 영역 확인 |
| `TV PDP 프리미엄` / `OLED PDP` | `pdp-tv-premium` | 대상 영역 확인 |
| `냉장고 PDP 일반형` | `pdp-refrigerator-general` | 대상 영역 확인 |
| `냉장고 PDP 노크온` | `pdp-refrigerator-knockon` | 대상 영역 확인 |
| `냉장고 PDP 글라스` | `pdp-refrigerator-glass` | 대상 영역 확인 |
| `가전 구독` / `케어솔루션 메인` | `care-solutions` | 대상 영역 확인 |
| `케어솔루션 PDP` / `정수기 구독 상세` | `care-solutions-pdp` | 대상 영역 확인 |
| `베스트샵` / `매장찾기` | `bestshop` | 대상 영역 확인 |
| `고객지원` / `AS` / `서비스센터` | `support` | 대상 영역 확인 |
| `홈스타일 메인` | `homestyle-home` | 대상 영역 확인 |
| `홈스타일 PDP` | `homestyle-pdp` | 대상 영역 확인 |
| `제품상세` / `PDP` | 제품군별 PDP 후보 | 제품군 추가 질문 필요 |

slot 표현 매핑:

| 사용자 표현 | 내부 후보 | 추가 질문 필요 여부 |
| --- | --- | --- |
| `첫 화면` / `상단` | `hero`, 메인 첫 화면은 `home-top`과 `hero+quickmenu` 기본 가정 | 히어로만인지 히어로+퀵메뉴인지 애매하면 질문 |
| `바로가기` / `퀵메뉴` | `quickmenu` | 없음 |
| `배너` | `hero`, `banner`, `noticeBanner`, `labelBanner`, `brandBanner`, `tipsBanner`, `careBanner` | 페이지/위치 확인 |
| `제품 리스트` / `상품 목록` | `productGrid`, `firstRow`, `firstProduct` | 카테고리/범위 확인 |
| `필터` / `정렬` | `filter`, `sort` | 카테고리 확인 |
| `상세 상단` / `상세 요약` | `gallery`, `summary`, `price`, `option`, `sticky` | 제품군 확인 |
| `리뷰` / `문의` / `Q&A` | `review`, `reviewInfo`, `qna` | 페이지 확인 |
| `서비스 검색` / `AS 접수` | `mainService` | 고객지원이면 없음 |
| `매장 바로가기` / `방문상담` | `shortcut` | 베스트샵이면 없음 |

final-build compatibility는 기존 Draft Action/backend의 내부 호환 경로로만 남긴다. Atlas Builder 모델 prompt와 사용자 응답 예시에는 YAML frontmatter, build-ready metadata, 내부 target code를 넣지 않는다.

compatibility 완료 기준:

- 기존 Draft Action은 fallback/final-build compatibility 경로에서만 내부 build metadata를 읽는다.
- 기본 흐름에서는 모델이 직접 builder-ready YAML을 만들지 않고 concept-preview가 review-only `conceptDocument`를 만든다.
- 사용자 언어에서 필수값이 빠지거나 중의적이면 요구사항 정리를 완료하지 않고 intake를 유지한다.
- 명확히 해석되고 사용자가 확정한 뒤에만 preflight와 draft build가 가능하다.
- `conceptDocument`는 backend가 만든 원문 그대로 builder에 전달한다.

모호한 `#아틀라스` 질문 응답은 큰 제목을 나열하지 않고 4-6줄로 제한한다. 체크박스 대신 아래처럼 한 줄 텍스트 답변 형식을 제시한다.

```text
screen=메인, viewport=모바일, scope=전체 페이지, request=럭셔리하게 개선
```

고객여정/멀티페이지 intake:

- `#아틀라스` 질문에 고객여정, funnel, 여러 페이지, page flow 의도가 있으면 단일 draft build로 보내지 않는다.
- 먼저 고객여정 이름, 대상 페이지 목록, 페이지별 목표, 페이지별 대상 영역을 사용자 표현으로 묻고, PC/MO 범위, 전환/탐색 목표, 독립/순차 빌드 여부, 공유 디자인 원칙을 확인한다.
- 고객여정은 먼저 journey spec 후보로 정리하고, 이후 페이지별 concept-preview 입력으로 분해한다.
- 이유: 현재 builder API는 단일 page/slot 중심이고, 멀티페이지 orchestration은 별도 설계가 필요하다.
- 선택 방식은 체크박스가 아니라 텍스트 답변 형식으로 둔다. 예: `여정=냉장고 구매, 페이지=메인>냉장고PLP>PDP, viewport=모바일, 빌드=순차, 목표=탐색에서 상담 전환`

fallback 입력:

```markdown
# Fallback Concept

Use the default home top experience.
```

fallback 구성 결과:

- `externalProjectId=default_project_id`
- `externalConceptId=concept-{uuid}`
- `conceptThreadId=ct-{uuid-v4}`
- `pageId=home`
- `viewportProfile=pc`
- `targetGroup=home-top`
- `slotIds=[hero, quickmenu]`
- `componentIds=[home.hero, home.quickmenu]`

### 5. Knowledge Base 초기 적재

목표:

- Open WebUI Knowledge에 LGE 정책/히스토리/컴포넌트 스펙을 넣는다.

초기 컬렉션:

- `lge-policy`
- `lge-component-spec`
- `lge-design-history`
- `lge-requirements`
- `lge-idea-archive`

소스 후보:

- `exports/openwebui/knowledge/*`
- `exports/openwebui/ontology/ontology-projection-v1.json`
- `data/normalized/openwebui-knowledge-seed-v1.json`
- `docs/admin-design-runtime-guardrails-2026-04-22.md`
- `docs/admin-runtime-checkpoint-2026-04-22.md`

완료 기준:

- CNS Atlas 채팅에서 `#` knowledge attachment로 LGE 정책 문서를 참조할 수 있다.

실제 export 절차:

```bash
npm run openwebui:inventory
npm run export:openwebui
npm run check:openwebui-export
```

생성 산출물:

```text
exports/openwebui/import-manifest.json
exports/openwebui/knowledge/lge-policy/*.json
exports/openwebui/knowledge/lge-component-spec/*.json
exports/openwebui/knowledge/lge-design-history/*.json
exports/openwebui/knowledge/lge-requirements/*.json
exports/openwebui/knowledge/lge-idea-archive/*.json
exports/openwebui/ontology/ontology-projection-v1.json
```

컬렉션별 import 파일:

```text
lge-policy
  exports/openwebui/knowledge/lge-policy/knowledge.asset-role-policies.json
  exports/openwebui/knowledge/lge-policy/knowledge.asset-role-policy-rollout-2026-04-22.json
  exports/openwebui/knowledge/lge-policy/knowledge.component-rebuild-schema-catalog.json
  exports/openwebui/knowledge/lge-policy/knowledge.runtime-guardrails-2026-04-22.json
  exports/openwebui/knowledge/lge-policy/knowledge.section-family-contracts.json

lge-component-spec
  exports/openwebui/knowledge/lge-component-spec/knowledge.component-spec-runtime-renderer.json
  exports/openwebui/knowledge/lge-component-spec/knowledge.image-asset-registry.json
  exports/openwebui/knowledge/lge-component-spec/knowledge.page-runtime-status.json

lge-design-history
  exports/openwebui/knowledge/lge-design-history/knowledge.decision-history.json
  exports/openwebui/knowledge/lge-design-history/knowledge.runtime-checkpoint-2026-04-22.json

lge-requirements
  exports/openwebui/knowledge/lge-requirements/knowledge.open-webui-core-builder-integration-plan-2026-04-28.json
  exports/openwebui/knowledge/lge-requirements/knowledge.open-webui-remaining-sequence-2026-04-29.json
  exports/openwebui/knowledge/lge-requirements/knowledge.requirement-scope-and-quality.json

lge-idea-archive
  exports/openwebui/knowledge/lge-idea-archive/knowledge.idea-bench-minimum-archive.json
```

JSON 필드 import 매핑:

- Open WebUI 문서 제목: JSON `title`
- Open WebUI 문서 설명 또는 첫 줄 메모: JSON `summary`
- Open WebUI Knowledge 본문: JSON `markdown`
- 출처/태그/추가 metadata: JSON `sourcePath`, `sourceHash`, `truthLevel`, `freshness`, `metadata`
- 사람이 확인할 원본 문서 경로: JSON `metadata.sourceDocumentPaths`가 있으면 우선 사용하고, 없으면 `sourcePath`를 사용한다.

초기 컬렉션 매핑:

- `lge-policy`: runtime guardrails, asset role policy, section family contracts, asset role policies, component rebuild policy.
- `lge-component-spec`: image asset registry, page runtime status, runtime renderer/component family notes.
- `lge-design-history`: runtime checkpoint, decision history, audit/review provenance.
- `lge-requirements`: Open WebUI core builder integration plan, remaining integration sequence, scope/quality requirements.
- `lge-idea-archive`: Idea Bench 후보군, concept group, 선택/기각 사유, handoff 후보 메모.

Open WebUI UI import 절차:

1. `Admin Panel -> Knowledge`에서 위 5개 컬렉션을 생성한다.
2. 위 파일 목록 순서대로 각 컬렉션에 JSON 파일을 하나씩 연다.
3. `markdown` 값을 Knowledge 문서 본문으로 넣는다.
4. 문서 제목은 `title`, 설명은 `summary`, 태그/출처는 `metadata`, `sourcePath`, `sourceHash`를 사용한다.
5. 각 컬렉션 import 후 채팅 입력창의 `#` knowledge attachment에서 컬렉션명이 보이는지 확인한다.

import 후 테스트 질문:

1. `hero 배경에 사용할 수 있는 asset role과 promo-complete 금지 규칙을 lge-policy 기준으로 설명해줘.`
2. `home.hero와 home.quickmenu에 연결된 component spec과 asset guardrail을 요약해줘.`
3. `2026-04-22 runtime checkpoint에서 검증된 runtime 상태와 남은 리스크를 알려줘.`
4. `Open WebUI와 clonellm의 역할 분리, artifact 저장 책임, knowledge import 순서를 lge-requirements 기준으로 정리해줘.`
5. `Idea Bench 후보를 만들 때 concept group, preview/compare, 선택/기각 사유를 어떻게 남겨야 하는지 lge-idea-archive 기준으로 알려줘.`

### 5-1. Chat Answer 저장 분류

목표:

- 좋은 답변을 무조건 builder Action으로 보내지 않고, 컨셉서 / 불가능 분석 / Knowledge 후보 / 노트 후보로 분류한다.

분류:

- `Atlas requirement draft`: concept-preview 입력 후보. 충분하면 `POST /api/builder/lge/v1/concept-preview`로 review-only 컨셉서를 만든다.
- `Atlas concept ready`: concept-preview 완료 결과. 사용자가 확인/확정한 뒤 preflight와 draft build로 이동할 수 있다.
- `Builder feasibility report`: 왜 빌드 가능/불가능/보류인지 설명하는 분석. 현재 프로젝트 의사결정이면 shared note, 반복 가능한 제약이면 Knowledge 후보.
- `Knowledge candidate`: 정책, 설계 원칙, 반복 가능한 결정, asset rule, build limitation.
- `Personal/shared note candidate`: 임시 아이디어, 개인 취향, 팀 요구사항, 컨셉 후보, 승인/기각 사유.

Knowledge로 보낼 항목:

- 정책
- 설계 원칙
- 반복 가능한 결정
- `background-only`, `icon-only`, `promo-complete` 같은 asset rule
- build limitation
- 검증된 운영 절차

Note로 둘 항목:

- 개인 노트: 사용자의 임시 아이디어, 개인 취향, 나중에 다시 볼 메모.
- 공유 노트: 팀이 같이 봐야 하는 요구사항, 결정사항, 컨셉 후보, feasibility 판단, handoff 메모.

Open WebUI 1차 UX:

- `이 답변을 컨셉서 초안으로 정리`
- `이 내용을 Knowledge 후보로 저장`
- `개인 노트로 저장`
- `공유 노트로 저장`

완료 기준:

- 일반 답변에서 Action을 눌러도 builder가 시작되지 않는다.
- 사용자는 좋은 답변을 build 대신 Knowledge 후보 또는 Note 후보로 저장할 수 있다.
- 승인된 Knowledge 후보만 `exports/openwebui/knowledge/<collection>/*.json` 또는 Open WebUI Knowledge import로 승격한다.

### 5-2. Action Routing UX

목표:

- Action 버튼을 “무조건 빌드”가 아니라 메시지 상태를 판별하는 routing entry point로 사용한다.

라우팅:

| 메시지 상태 | 결과 |
| --- | --- |
| `requirement_draft_ready` | `POST /api/builder/lge/v1/concept-preview` 호출 |
| `concept_preview_queued` / `concept_preview_running` | `GET /api/builder/lge/v1/concept-jobs/:jobId` poll 및 stage 표시 |
| `concept_ready` + 수정 요청 | `requirementDraft` 갱신 후 concept-preview 재실행 |
| `concept_ready` + 빌드 확정 | preflight 실행 |
| preflight ok | draft build |
| preflight not ok | feasibility report |
| 일반 답변이지만 LGE/디자인/요구사항 포함 | requirementDraft 후보로 정리 안내 |
| 완전 무관 | intake 안내 |
| 좋은 정책/제약/결정 내용 | Knowledge candidate |
| 사용자 아이디어/임시 메모 | personal note candidate |
| 팀 결정/요구사항/후보안 | shared note candidate |

review-only concept-preview 규칙:

- Action이 답변을 `requirementDraft`로 정리할 수는 있지만 자동으로 draft build를 만들지 않는다.
- concept-preview는 컨셉서만 만들고 draft build, preview, compare, artifact를 만들지 않는다.
- 사용자가 검토하고 target metadata, 유지/변경/금지 조건, 디자인 방향을 확정해야 preflight와 draft build로 이동한다.

Knowledge / Note 분리:

- Knowledge 후보: 정책, 설계 원칙, 반복 가능한 결정, asset rule, build limitation.
- 개인 노트: 사용자의 임시 아이디어, 개인 취향, 미확정 메모.
- 공유 노트: 팀이 같이 봐야 하는 요구사항, 결정사항, 컨셉 후보.

A preflight API 연결 지점:

- 사용자가 concept-preview 결과를 확정한 뒤 draft build 생성 전에 preflight를 호출한다.
- preflight ok이면 기존 draft build route로 진행한다.
- preflight not ok이면 draft build job을 만들지 않고 feasibility report를 반환한다.

완료 기준:

- Action routing 결과가 build / feasibility / concept draft / Knowledge candidate / personal note / shared note / intake로 구분된다.
- build route 이외의 route는 preview/compare job을 만들지 않는다.

### 6. Builder API artifact payload 확장

목표:

- 현재 preview/compare 중심 응답에 Open WebUI 저장용 artifact payload를 보강한다.

추가할 항목:

- `authoredSectionMarkdownDocument`
- `authoredSectionHtmlPackage`
- `snapshotData`
- `validation`
- `runtimeAdvisory`
- `sourceTrace`

완료 기준:

- Open WebUI가 `clonellm` draft cache 없이도 승인/검토 metadata를 보존할 수 있다.

### 7. Idea Bench 최소판

목표:

- 후보 컨셉 2-3개를 병렬 build하고 비교한다.

초기 구현:

- 별도 포크 UI 없이 채팅 내 Action을 여러 번 실행
- 결과 artifact를 같은 `conceptGroupId`로 묶기
- 사람이 선택한 결과를 `Decision` record로 저장

완료 기준:

- 후보별 preview/compare와 선택 사유가 Open WebUI history에 남는다.

### 8. 승인 후 핸드오프 패키지

목표:

- 승인된 결과를 개발/운영 전달 가능한 패키지로 묶는다.

패키지:

```text
handoff-package/
  concept-document.md
  authored-section.md
  authored-html/
  preview-snapshot.png
  builder-report.json
  decision.json
```

완료 기준:

- 승인 결과를 zip으로 내려받거나 GitHub/GitLab PR 생성 단계로 넘길 수 있다.

## 우선순위 결론

지금 바로 이어갈 순서는 다음이다.

1. CNS Atlas 일반 채팅이 OpenRouter로 응답하는지 UI에서 확인
2. `LGE Builder Draft Action` 버튼 실행 확인
3. concept-preview Action/API route 구현: `POST /api/builder/lge/v1/concept-preview`, `GET /api/builder/lge/v1/concept-jobs/:jobId`
4. Builder Action이 concept-preview 결과를 compact review message로 표시하고, hidden concept marker를 통해 `확정` 후 preflight -> draft build로 이어지는지 검증
5. Atlas Mode Filter Function MVP를 추가 검토: `self.toggle = True`, CNS Atlas Default Filters ON, inlet에서 Atlas instruction 주입, 실제 concept-preview/draft build 호출 금지
6. Builder Action이 draft build 반환 결과를 artifact metadata로 저장하도록 확장
7. LGE knowledge 컬렉션 초기 적재
8. Idea Bench와 승인 핸드오프는 그 다음 단계로 분리

### Atlas Mode Filter Function Backlog

목표:

- 채팅 입력창에서 Atlas Mode를 chip/switch로 켜고 끌 수 있게 한다.
- 사용자가 매번 `#아틀라스`를 붙이지 않아도 Atlas Builder 작업 모드로 진입하게 한다.
- Filter는 모델 호출 전 instruction 주입과 입력 정규화까지만 담당한다.

MVP 정책:

- Open WebUI Filter Function으로 구현한다.
- `self.toggle = True`를 사용해 채팅 입력 inline chip과 Integrations menu switch에 노출한다.
- `CNS Atlas` model/preset의 Default Filters에 포함해 새 채팅에서 기본 ON으로 시작한다.
- 일반 모델에는 우선 global로 붙이지 않는다.
- Filter가 켜져 있으면 `#아틀라스` 없이도 Atlas 작업 모드 instruction을 주입한다.
- 실제 `concept-preview`, `preflight`, `draft build` 호출은 계속 `LGE Builder Draft Action`과 backend가 담당한다.
- Filter 코드 내부에서 `self.toggle`을 runtime ON/OFF 값처럼 분기하지 않는다. Open WebUI는 toggle이 선택된 요청에서만 `inlet()`을 호출한다.

후속 구현 대상:

- `integrations/openwebui/atlas_mode_filter.py`
- `integrations/openwebui/README.md`
- `docs/openwebui-integration-assets.md`
