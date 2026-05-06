# Open WebUI Atlas Builder User Flow (2026-04-30)

## Purpose

This document fixes the first usable Open WebUI flow for LGE Builder work.

The product rule is:

- Open WebUI chat is the concept review surface.
- `#아틀라스` starts the LGE Builder work mode.
- The selected chat model fills an admin-compatible `requirementDraft` from the conversation and asks only for fields that are missing.
- The default concept-generation path is `requirementDraft -> POST /api/builder/lge/v1/concept-preview -> conceptDocument -> user confirmation -> preflight -> draft build`.
- `POST /api/builder/lge/v1/concept-preview` creates only a review-only concept document. It does not create a draft build, preview, compare view, or artifact.
- The final draft build starts only after the user confirms the concept, preflight passes, and the build Action/API is actually invoked.
- A plain chat message must never trigger a builder job.
- The same Action entry point may route non-buildable messages to concept-preview, feasibility, Knowledge candidate, or note candidate UX.

`#아틀라스` means "enter Builder work mode." It is not an instruction to immediately start a build. The assistant must not answer a `#아틀라스` request as a generic Q&A response, and it must not claim that a build has started unless the build Action/API has actually started a draft job.

## Atlas Mode Injection

The April 30 UI test showed that `#아틀라스` alone is not enough. If the selected model receives it only as ordinary user text, it can produce a generic web-design or consulting answer and never enter Atlas mode.

Injection options:

| Option | Works across selected models | User clarity | Code change | Future toggle/icon fit | Assessment |
| --- | --- | --- | --- | --- | --- |
| Open WebUI model-level system prompt | Only for models where admins configure it | Medium; user must pick the configured model | None | Medium | Good for quick manual test, weak if users can choose any base model |
| Atlas custom model/preset | Strong when users select the Atlas preset | High; visible as a dedicated Atlas model | None | High | Recommended MVP because it binds system prompt, Knowledge, and tools without backend changes |
| Prompt Template | User must manually apply it | Medium | None | Low | Useful as backup or onboarding, not reliable as automatic mode entry |
| Knowledge attachment | Depends on retrieval and instruction following | Low | None | Medium | Good for policy context, not sufficient as the primary mode switch |
| Filter Function detecting `#아틀라스` and injecting system/developer instructions | Strongest across base models if attached globally or to target models | High after setup; user can keep choosing familiar models | Small new Function, not part of this round | Highest | Best follow-up after MVP; can later back a bottom icon/toggle |
| Action button post-processing only | Does not affect the model's initial answer | Medium | Already exists | Medium | Useful for routing existing messages, but cannot fix the first response shape |

MVP operating model:

1. Create an `Atlas Builder` custom model/preset in Open WebUI.
2. Use `anthropic/claude-haiku-4.5` as the base model for the first OpenRouter-backed MVP preset.
3. Set the Atlas system prompt below as the model instruction.
4. Attach `LGE Builder Draft Action` to that model. In the updated MVP this Action may expose a concept-preview route before the final draft-build route.
5. Attach the five LGE Knowledge collections: `lge-policy`, `lge-component-spec`, `lge-design-history`, `lge-requirements`, and `lge-idea-archive`.
6. Keep a Prompt Template with the same instruction only as an admin fallback for debugging.
7. Defer the Filter Function to the next implementation step. The MVP does not depend on Filter injection.

This MVP gives users a clear Atlas entry point. The Filter Function remains the correct next step when the product needs `#아틀라스` to work regardless of selected model.

### Open WebUI Preset Setup

Create the MVP preset in Open WebUI as an admin:

1. Open `Workspace -> Models`.
2. Create a new model or model preset.
3. Set the display name to `Atlas Builder`.
4. Set the base model to `anthropic/claude-haiku-4.5`.
5. Paste the `Atlas System Prompt - Operations Final` text below into the model system prompt/instructions field.
6. Attach Knowledge collections:
   - `lge-policy`
   - `lge-component-spec`
   - `lge-design-history`
   - `lge-requirements`
   - `lge-idea-archive`
7. Attach the Action Function `LGE Builder Draft Action` in the model Actions section. If the Action is global, still verify it appears on assistant message toolbars for this preset.
8. Save the preset.
9. Start a new chat and select `Atlas Builder` from the model selector.
10. Send the three validation prompts in the test matrix below using `test@cnspartner.com`.

Preset contents:

| Item | MVP value |
| --- | --- |
| Preset name | `Atlas Builder` |
| Base model | `anthropic/claude-haiku-4.5` |
| System prompt | `Atlas System Prompt - Operations Final` |
| Knowledge | `lge-policy`, `lge-component-spec`, `lge-design-history`, `lge-requirements`, `lge-idea-archive` |
| Action | `LGE Builder Draft Action` |
| Filter Function | Not included in MVP; next phase |

Documentation convergence:

- This document is the canonical source for Atlas system prompt, response templates, and user-language mapping.
- `integrations/openwebui/README.md` should keep only Action setup and a short pointer to these templates.
- `docs/openwebui-integration-assets.md` should keep only integration asset notes and a short pointer to these templates.
- `docs/open-webui-remaining-integration-sequence-2026-04-29.md` should track rollout steps and validation, not duplicate the full prompt text.
- Session A has fixed the concept-preview API names and job stages used below. Do not rename the endpoint, stages, or done response fields in UX copy.

### Default UX Flow

The default user flow is no longer "model writes final YAML and build starts." It is:

1. User sends a `#아틀라스` request.
2. Atlas fills the same intent shape as the builder requirement form: `requirementDraft`.
3. If required fields are missing, Atlas asks for only those fields using text-answer syntax, not Markdown checkboxes.
4. If fields are sufficient, the user runs the concept-preview Action/API.
5. The backend starts a concept-preview job through `POST /api/builder/lge/v1/concept-preview`.
6. Open WebUI polls `GET /api/builder/lge/v1/concept-jobs/:jobId` and shows progress in chat.
7. When the job is done, the chat displays the builder-generated concept outputs:
   - `requirementPlan`
   - `builderMarkdown`
   - `designSpecMarkdown`
   - `conceptDocument`
8. User either requests a revision or confirms the concept.
9. Revision updates `requirementDraft` and reruns concept-preview.
10. Confirmation moves to preflight.
11. If preflight passes, the draft build Action/API starts the actual draft build.
12. When the draft build is done, Open WebUI shows preview/compare links based on `builder_public_url`.

Allowed user-facing copy:

- "컨셉서 생성을 시작하려면 Action을 실행하세요."
- "컨셉서가 준비되었습니다. 수정하려면 수정 내용을 말하고, 빌드하려면 '이 컨셉서로 빌드'라고 답하세요."
- "이 메시지는 review-only 컨셉서입니다. 아직 draft build를 만들지 않았습니다."
- "빌드는 Action이 실행될 때 시작됩니다."

Forbidden user-facing copy:

- The assistant must not independently say that a build has started.
- The assistant must not say it will notify the user later unless a real job exists and is being polled.
- The assistant must not present internal build-ready metadata generation as a user-facing model flow.
- The assistant must not use Markdown checkbox syntax.

### Concept-Preview API Contract

Concept-preview is the backend concept-generation path:

| Item | Fixed contract |
| --- | --- |
| Start endpoint | `POST /api/builder/lge/v1/concept-preview` |
| Poll endpoint | `GET /api/builder/lge/v1/concept-jobs/:jobId` |
| Auth | Open WebUI service token |
| Input | `requirementDraft` or server planner payload |
| Output purpose | Generate a review-only Atlas concept document |
| Does not create | draft build, preview, compare, artifact |
| Default `conceptDocument` state | `builderReady: false`, review-only |
| Next step after user confirmation | preflight, then draft build |

Concept job stages:

| Stage | Chat status copy |
| --- | --- |
| `queued` | 컨셉서 생성 요청을 받았습니다. |
| `resolving_target` | 대상 화면과 변경 범위를 정리하고 있습니다. |
| `analyzing_references` | 레퍼런스와 참고 자료를 분석하고 있습니다. |
| `generating_concept` | 기존 빌더 컨셉서 생성 로직으로 초안을 작성하고 있습니다. |
| `formatting_concept_document` | 채팅창에 표시할 컨셉서 문서를 정리하고 있습니다. |
| `done` | 컨셉서가 준비되었습니다. |
| `failed` | 컨셉서 생성에 실패했습니다. |

When the concept job is `done`, Open WebUI should display these response fields without renaming them:

- `requirementDraft`
- `requirementPlan`
- `builderMarkdown`
- `designSpecMarkdown`
- `conceptDocument`
- `plannerProvider`
- `completedAt`

### Requirement Format

Atlas should organize user language into this requirement format. This is an internal Action/backend input shape, not a chat output template:

| Requirement field | Required | Notes |
| --- | --- |
| `screen` | yes | User-facing screen, page, category, or PDP name |
| `viewport` | yes | PC/desktop/web or mobile/MO |
| `scope` | yes | Whole page, first screen, top area, product list, PDP top, etc. |
| `targetArea` | no | More specific area if known; ask only when ambiguous |
| `request` | yes | What the user wants changed or improved |
| `purpose` | no | Campaign goal, conversion goal, navigation goal, etc. |
| `changeLevel` | no | `low`, `medium`, or `high` if user provided it or it is safe to infer |
| `tone` | no | User-provided tone such as premium, luxury, simple, clear |
| `keep` | no | Constraints to preserve |
| `avoid` | no | Constraints to avoid |
| `refs` | no | Reference URLs or named references |

### Input Combination UX

| Input combination | UX handling |
| --- | --- |
| Requirements only | Concept-preview can run without `referenceUrls`. Use current page, target scope, and request text. |
| References only | Treat `referenceUrls` as the center of analysis. Ask only for target screen and scope. Do not allow exact layout copy. |
| Requirements + references | Requirements win. References support direction, guardrails, and mood. |
| Page / scope only | Generate an automatic draft from page identity, design reference library, and asset policy. Label it as "구체 요구가 약한 초안". |
| Customer journey | Do not send directly to a single draft build. Create a journey strategy / flow candidate, then split into page-level builds. |

### State Model

| State | Meaning |
| --- | --- |
| `intake` | Atlas is collecting missing requirement fields. |
| `requirement_draft_ready` | `requirementDraft` is sufficient for concept-preview. |
| `concept_preview_queued` | Concept-preview job was created. |
| `concept_preview_running` | Concept-preview job is being polled. |
| `concept_ready` | `conceptDocument` and supporting Markdown are ready in chat. |
| `concept_revision_requested` | User requested changes; update `requirementDraft` and rerun concept-preview. |
| `build_confirmation_requested` | User asked to build from the reviewed concept. |
| `preflight_running` | Backend preflight is checking target, contract, and feasibility. |
| `feasibility_blocked` | Preflight or concept constraints blocked the build. |
| `build_queued` | Actual draft build job was queued. |
| `build_running` | Draft build is running. |
| `build_done` | Draft build completed; preview/compare links are available. |
| `build_failed` | Draft build failed; show failure reason and next action. |

### Build Job UX

Concept-preview and draft build are separate:

- Concept-preview creates a review-only concept.
- Draft creates the actual build, preview, compare result, and artifact metadata.
- The model should not claim that a build is running by itself.
- Actual draft build starts only when the build Action/API starts it after user confirmation and preflight.
- Preview/compare links appear only after draft build completion.

Direct YAML builder-ready messages remain a fallback/final-build compatibility path for the existing Draft Action. They are not the default user flow.

### Atlas System Prompt - Operations Final

Use this as the production system prompt for the `Atlas Builder` custom model/preset:

```text
당신은 CNS Atlas의 LGE Builder 요구사항 정리자다.

목표:
- 사용자의 LGE 사이트 개선 요청을 멀티턴으로 정리한다.
- 컨셉서 생성과 빌드는 직접 하지 않는다.
- 실제 컨셉서 생성, preflight, draft build는 Open WebUI의 `LGE Builder Draft Action`이 수행한다.
- 당신의 핵심 산출물은 매 응답에 남기는 `요구사항 상태`다. Action은 이 상태를 읽어 backend concept-preview에 전달한다.

Atlas 모드 지속 규칙:
- 현재 대화의 어느 이전 사용자 메시지에든 `#아틀라스`가 있었거나, 이전 assistant 메시지에 `요구사항 상태`, `컨셉서 생성 완료`, `컨셉서 참조`, `LGE Builder Draft Action` 안내가 있으면 이 대화는 계속 Atlas 작업 모드다.
- 후속 사용자 메시지에 `#아틀라스`가 없어도 일반 Q&A로 풀지 않는다. 이전 `요구사항 상태`를 기준으로 이어서 해석한다.
- 사용자가 “일반 대화로 전환”, “아틀라스 종료”, “빌더 모드 끄기”처럼 명시한 경우에만 Atlas 작업 모드를 종료한다.
- `빌드해줘`, `이걸로 빌드`, `확정`, `진행`은 일반 설명 요청이 아니라 이전 컨셉 검토본을 확정하려는 의도다. 이때 새 요구사항을 다시 묻지 말고 Action 실행 안내로 연결한다.
- “얼마나 걸려?”, “지금 뭐 하면 돼?”, “버튼 어디 눌러?” 같은 운영 질문도 Atlas 작업 모드 안의 질문으로 답한다. 답변은 짧게 하고, 기존 요구사항 상태를 버리지 않는다.

역할 경계:
- 컨셉서를 직접 쓰지 않는다.
- YAML, JSON, 코드블록, 내부 debug를 출력하지 않는다.
- `pageId`, `targetGroupId`, `slot`, `builderReady`, `atlasMode` 같은 내부 코드를 사용자에게 요구하지 않는다.
- 실제 Action/API가 실행되기 전에는 “빌드 시작”, “진행중”, “Preview 생성”, “완료되면 알려드림”이라고 말하지 않는다.

멀티턴 원칙:
- 이전 assistant의 `요구사항 상태`를 계속 유지한다.
- 사용자가 새로 답한 내용은 기존 상태에 병합한다.
- 사용자가 정정하면 해당 필드만 바꾸고 나머지는 유지한다.
- 충분한 값이 있는데 같은 질문을 반복하지 않는다.
- 체크박스나 선택 UI를 쓰지 않는다. 한 줄 답변 예시만 준다.
- 후속 턴에서 사용자가 짧게 답해도 이전 Atlas 상태의 답변으로 간주한다. 예: `모바일만`, `전체 메인`, `이걸로`, `빌드해줘`.

필수 필드:
- 화면: 메인, 홈, lge.co.kr 첫 화면, 냉장고 카테고리/PLP, TV 카테고리/PLP, PDP, 고객여정 등
- viewport: PC 또는 모바일
- 범위: 전체 페이지, 첫 화면, 히어로/퀵메뉴, 특정 영역, 여러 페이지 등
- 요청: 사용자가 바꾸고 싶은 핵심 요구
- 사용자가 이 필드명을 직접 말할 필요는 없다. 사용자의 문장을 읽고 의미상 해당 필드를 채운다.
- 필수 필드를 못 채우는 경우에도 내부 코드나 선택지를 나열하지 말고, 사용자가 자연어로 답할 수 있게 유도 질문을 한다.

참고 필드:
- 대상 영역, 목적, 톤, 변경 강도, 유지, 금지, 레퍼런스
- 참고 필드는 없다고 계속 질문하지 않는다. 있으면 상태에 반영한다.

의미 해석 원칙:
- 아래 예시는 고정 매핑표가 아니라 의미 판단을 돕는 힌트다. 표현이 조금 달라도 같은 의도면 같은 필드로 정리한다.
- “메인”, “홈”, “lge.co.kr 첫 화면”처럼 말하면 어떤 화면인지 의미로 판단한다.
- “전체적으로”, “전체 메인”, “메인페이지 전체”처럼 말하면 전체 페이지 범위인지, 톤만 전체 적용인지 문맥으로 판단한다. 문맥상 불확실할 때만 짧게 되묻는다.
- “첫 화면”, “상단”, “히어로”, “퀵메뉴”처럼 말하면 특정 영역 요청으로 이해하되, 구분이 빌드 범위에 중요할 때만 확인한다.
- “PC”, “웹”, “데스크탑”, “모바일”처럼 말하면 viewport 의미로 정리한다.
- “카테고리”, “PLP”, “PDP”, “제품상세”처럼 말하면 화면 유형으로 이해한다. 제품군이나 페이지 후보가 중의적이면 그 지점만 확인한다.
- “고객여정”, “여정”, “여러 페이지”, “메인에서 PDP까지”처럼 말하면 멀티페이지 흐름으로 이해하고 단일 빌드로 보내지 않는다.
- 모델이 확신할 수 있으면 질문하지 않는다. 모델이 의미를 확정할 수 없을 때만 부족한 필수값을 한 번에 물어본다.

응답 형식:
항상 아래 최소 표를 포함한다. 표에는 Action이 concept-preview 가능 여부를 판단하는 필수값만 둔다. 값이 없으면 `미정`이라고 쓴다. 표 밖에 raw JSON, YAML, 내부 코드를 쓰지 않는다.

### 요구사항 상태

| 필수 항목 | 값 |
| --- | --- |
| 상태 | collecting 또는 ready_for_concept |
| 화면 | ... |
| viewport | ... |
| 범위 | ... |
| 요청 | ... |
| 부족한 필수값 | screen, viewport, scope, request 중 실제로 부족한 값만. 없으면 없음 |
| 확인 필요 | 필수값 중 의미가 중의적인 항목만. 없으면 없음 |

### 추가로 반영할 수 있는 요구사항 예

아래 항목은 필수가 아니다. 사용자가 이미 말했거나, 더 좋은 컨셉서 생성을 위해 도움이 될 때만 짧게 제안한다. 누락되어도 질문을 반복하지 않는다.

- 목적=캠페인 인지도 / 탐색성 개선 / 상담 전환 / 제품 이해 강화
- 톤=프리미엄 / 럭셔리 / 실용적 / 친근함 / 기술 중심
- 변경 강도=low / medium / high
- 유지=현재 메뉴 구조 유지 / quickmenu 유지 / 기존 브랜드 톤 유지
- 금지=과한 애니메이션 / promo-complete 이미지 재사용 / 가격 할인 중심 표현
- 레퍼런스=참고 URL 또는 비교하고 싶은 페이지
- 대상 영역=첫 화면 상단 / 히어로 / 퀵메뉴 / 제품 리스트 / PDP 상세 상단

상태 결정:
- 필수 필드 중 하나라도 없거나 중의적이면 상태는 collecting이다.
- 필수 필드가 모두 있으면 상태는 ready_for_concept다.
- 고객여정/멀티페이지는 단일 page build가 아니므로 collecting 또는 journey intake로 안내한다. 단일 컨셉서 생성 Action을 바로 유도하지 않는다.
- 부족한 필수값에는 화면, viewport, 범위, 요청만 넣는다. 목적, 톤, 변경 강도, 유지, 금지, 레퍼런스, 대상 영역은 참고값이므로 부족한 필수값에 넣지 않는다.
- 참고 필드는 `요구사항 상태` 표에 넣지 않는다. 필요한 경우 `추가로 반영할 수 있는 요구사항 예`에서 선택 입력 예시로만 보여준다.

collecting일 때:
- 부족한 필수값만 짧게 묻는다.
- 예: `viewport=모바일, 범위=전체 메인`
- 참고 필드가 비어 있다는 이유로 collecting을 유지하지 않는다.

ready_for_concept일 때:
- “요구사항은 컨셉서 생성을 시작할 만큼 충분합니다.”라고 말한다.
- “이 assistant 메시지의 `LGE Builder Draft Action`을 실행하면 backend concept-preview가 컨셉서 검토본을 생성합니다.”라고 안내한다.
- 추가 질문을 반복하지 않는다.
- 추가 예시는 최대 2-3개만 제안하고, 필수처럼 요구하지 않는다.

컨셉서 생성 이후:
- Action 결과가 컨셉 검토본을 만든 뒤, 사용자가 `확정`, `이걸로 빌드`, `빌드해줘`, `진행`이라고 하면 사용자는 다시 Action을 눌러야 한다고 안내한다.
- 이때 새 요구사항 상태를 다시 만들거나 새 질문을 반복하지 않는다.
- “검토본을 봤나요?”, “정말 바로 빌드할까요?”처럼 되묻지 않는다. 사용자의 확정 의도를 인정하고, “이 메시지의 `LGE Builder Draft Action`을 실행하면 최종 빌드가 진행됩니다.”라고만 짧게 안내한다.
- 실제 빌드 완료, 미리보기 링크, 비교 링크는 Action 결과만 말한다. 모델은 Action 실행 전 임의로 완료나 링크를 말하지 않는다.
```

### MVP Validation Matrix

Use `test@cnspartner.com`, select the `Atlas Builder` preset, and run a new chat for each prompt.

| Test prompt | Expected response shape | Expected build state |
| --- | --- | --- |
| `#아틀라스 lge.co.kr 메인을 좀 더 좋아 보이게 개선하고 싶어.` | Missing `viewport` and `scope`. Ask one short question such as `필수 정보 중 viewport가 빠졌습니다. PC인지 모바일인지 알려주세요.` Do not output YAML, JSON, internal IDs, or checkboxes. | No build. No builder-ready YAML. |
| `#아틀라스 lge.co.kr 메인 모바일 전체 페이지를 럭셔리하게 개선하고 싶어.` | Required fields are sufficient: screen=메인, viewport=모바일, scope=전체 페이지, request=럭셔리 개선. Summarize in user language and tell the user to run the Action. | No draft build. Ready for concept-preview only. |
| `#아틀라스 냉장고 카테고리를 모바일에서 탐색하기 쉽게 개선하고 싶어.` | Required fields are sufficient: screen=냉장고 카테고리, viewport=모바일, scope can be inferred as category page, request=탐색성 개선. Summarize and tell the user to run the Action. | No draft build. Ready for concept-preview only. |
| `#아틀라스 카테고리 페이지를 모바일에서 탐색하기 쉽게 개선하고 싶어.` | Category is ambiguous. Ask whether this means refrigerator category, TV category, or another category. | No build. |
| `#아틀라스 고객여정 기준으로 메인에서 냉장고 카테고리, PDP까지 이어지는 구매 흐름을 개선하고 싶어.` | Short journey intake. State that this is a multi-page purchase flow and not a single draft build. Ask for journey name, viewport, conversion goal, and build split using one-line text format. Do not expose internal IDs. | No build. Future journey spec or shared note candidate. |
| `모바일 메인으로만 빌드해줘` after concept-ready | State update and build confirmation. Keep the previous concept intent, change target viewport to `mo`, do not repeat intake questions, then move to preflight. If preflight passes, the build Action/API starts the draft build. | Build starts only after preflight and Action/API invocation. |

### Current Code Target Catalog

This catalog is based on the current runtime/index data:

- `data/normalized/page-runtime-status.json`
- `data/normalized/plp-groups/index.json`
- `data/normalized/pdp-groups/index.json`
- `data/normalized/service-groups/index.json`
- `data/normalized/representative-pdps/index.json`
- `data/normalized/journey-definitions.json`
- `docs/admin-plp-pdp-target-catalog.md`
- `server.js` intervention group presets

Supported page-level targets:

| User language | Internal pageId | Viewport | Target groups / slots |
| --- | --- | --- | --- |
| 메인, 홈, lge.co.kr 첫 화면 | `home` | `pc`, `mo`; `ta` reserved | `home-top`: `header-top`, `header-bottom`, `hero`, `quickmenu`; `home-middle`: `timedeal`, `md-choice`, `best-ranking`; `home-lower-primary`: `space-renewal`, `subscription`, `brand-showroom`, `latest-product-news`, `smart-life`; `home-lower-secondary`: `summary-banner-2`, `missed-benefits`, `lg-best-care`, `bestshop-guide` |
| TV 카테고리, TV PLP, TV 목록 | `category-tvs` | `pc`, `mo` | PLP slots: `banner`, `filter`, `sort`, `productGrid`, `firstRow`, `firstProduct` |
| 냉장고 카테고리, 냉장고 PLP, 냉장고 목록 | `category-refrigerators` | `pc`, `mo` | PLP slots: `banner`, `filter`, `sort`, `productGrid`, `firstRow`, `firstProduct` |
| TV PDP 일반형, 일반 LED TV 상세 | `pdp-tv-general` | `pc`, `mo` | PDP slots: `gallery`, `summary`, `price`, `option`, `sticky`, `review`, `qna` |
| TV PDP 프리미엄, 올레드, OLED 상세 | `pdp-tv-premium` | `pc`, `mo` | PDP slots: `gallery`, `summary`, `price`, `option`, `sticky`, `review`, `qna` |
| 냉장고 PDP 일반형, 매직스페이스 상세 | `pdp-refrigerator-general` | `pc`, `mo` | PDP slots: `gallery`, `summary`, `price`, `option`, `sticky`, `review`, `qna` |
| 냉장고 PDP 노크온 | `pdp-refrigerator-knockon` | `pc`, `mo` | PDP slots: `gallery`, `summary`, `price`, `option`, `sticky`, `review`, `qna` |
| 냉장고 PDP 글라스, 미스트 글라스 | `pdp-refrigerator-glass` | `pc`, `mo` | PDP slots: `gallery`, `summary`, `price`, `option`, `sticky`, `review`, `qna` |
| 가전 구독, 케어솔루션 메인 | `care-solutions` | `pc`, `mo` | `hero`, `ranking`, `benefit`, `tabs`, `careBanner` |
| 케어솔루션 PDP, 정수기 구독 상세 | `care-solutions-pdp` | `pc`, `mo` | `visual`, `detailInfo`, `noticeBanner`, `reviewInfo` |
| 베스트샵, 매장, 매장찾기, 방문상담 | `bestshop` | `pc`, `mo` | `hero`, `shortcut`, `review`, `brandBanner` |
| 고객지원, 고객센터, AS, 서비스센터, 문의 | `support` | `pc`, `mo` | `mainService`, `notice`, `tipsBanner`, `bestcare` |
| 홈스타일 메인, 라이프스타일 홈 | `homestyle-home` | `pc`, `mo` | `quickMenu`, `labelBanner`, `brandStory` |
| 홈스타일 PDP, 홈스타일 상품상세 | `homestyle-pdp` | `pc`, `mo` | `detailInfo`, `bestProduct`, `review`, `qna`, `guides`, `seller` |

Current journey-only / reference-based pages:

| User language | Internal candidate | Handling |
| --- | --- | --- |
| 장바구니 | `cart` | Journey intake only; not a single builder target in the MVP |
| 결제 | `checkout` | Journey intake only; not a single builder target in the MVP |
| 주문완료 | `order-complete` | Journey intake only; not a single builder target in the MVP |

Representative PDP routing notes:

| User language | Internal pageId | Representative URL |
| --- | --- | --- |
| TV 일반형 PDP | `pdp-tv-general` | `/tvs/32lq635bkna-stand` |
| TV 프리미엄 PDP | `pdp-tv-premium` | `/tvs/oled97g5kna-stand` |
| 냉장고 일반형 PDP | `pdp-refrigerator-general` | `/refrigerators/t873mee111` |
| 냉장고 노크온 PDP | `pdp-refrigerator-knockon` | `/refrigerators/t875mee412` |
| 냉장고 글라스 PDP | `pdp-refrigerator-glass` | `/refrigerators/h875gbb111` |

### Ambiguous Request Template

Use this when a `#아틀라스` request is missing required fields or contains an ambiguous target. Required fields are `screen`, `viewport`, `scope`, and `request`. This is a first assistant response, so keep it to 4-6 lines and do not output YAML, JSON, code blocks, internal IDs, debug data, or large headings.

Example first response:

lge.co.kr 메인 개선 의도는 확인했습니다.
필수 정보 중 viewport와 scope가 빠졌습니다.
PC인지 모바일인지, 첫 화면인지 전체 페이지인지 알려주세요.
예: `screen=메인, viewport=모바일, scope=전체 페이지, request=럭셔리하게 개선`

Expected behavior for:

```text
#아틀라스 lge.co.kr 메인을 좀 더 좋아 보이게 개선하고 싶어.
```

The assistant should not give only generic improvement advice. It should use the missing-field template because viewport and scope are required.

### Single-Page Concept-Preview Ready Template

Use this when required fields are present: `screen`, `viewport`, `scope`, and `request`. Optional fields such as `purpose`, `tone`, `changeLevel`, `keep`, `avoid`, and `refs` may be empty and should not trigger repeated questioning. The assistant may internally organize the requirement format, but the chat response must not print JSON, YAML, or internal IDs.

Example first response:

요구사항 정리 완료.
메인 / 모바일 / 전체 페이지 / 럭셔리 개선으로 정리했습니다.
컨셉서는 제가 직접 쓰지 않고 Action/backend API가 생성합니다.
이 메시지에서 LGE Builder Draft Action을 실행하면 컨셉서 검토본이 생성됩니다.

### Customer Journey Intake Template

Use this when the request mentions customer journey, funnel, multiple pages, page flow, or sequential page improvement:

Example first response:

요청은 메인에서 냉장고 카테고리, PDP까지 이어지는 구매 여정 개선으로 이해했습니다.
이 흐름은 여러 화면을 포함하므로 단일 draft build로 바로 보내지 않습니다.
먼저 여정 이름, PC/MO 범위, 전환 목표, 페이지별 역할을 정리한 뒤 페이지별 컨셉서로 나누겠습니다.
아래 형식으로 한 줄로 답해 주세요.
`여정=냉장고 구매, 페이지=메인>냉장고PLP>PDP, viewport=모바일, 빌드=순차, 목표=탐색에서 상담 전환`

## User Flow

### 1. Start Atlas Mode

The user starts with an explicit Korean command:

```text
#아틀라스 lge.co.kr 메인 PC 버전의 첫 화면을 프리미엄 가전 캠페인 느낌으로 개선하고 싶어.
```

Other valid user-language examples:

```text
#아틀라스 모바일에서 냉장고 카테고리 PLP를 더 탐색하기 쉽게 개선하고 싶어.
```

```text
#아틀라스 고객여정 기준으로 메인에서 냉장고 카테고리, PDP까지 이어지는 구매 흐름을 개선하고 싶어.
```

If the user enters only `#아틀라스`, the assistant starts intake instead of building.

If the request after `#아틀라스` is ambiguous, the assistant must answer in 4-6 short lines, without large headings, YAML, JSON, code blocks, internal IDs, debug output, or Markdown checkboxes. It should ask only for the missing fields with a one-line answer format.

The answer should identify useful material for notes or Knowledge, but it must not claim that a concept-preview or draft build job exists until an Action/API has actually started one.

Expected first response example:

lge.co.kr 메인 개선 의도는 확인했습니다.
필수 정보 중 viewport와 scope가 빠졌습니다.
PC인지 모바일인지, 첫 화면인지 전체 페이지인지 알려주세요.
예: `screen=메인, viewport=모바일, scope=전체 페이지, request=럭셔리하게 개선`

### 1-1. User Language Mapping

Users do not need to know internal page IDs, viewport profiles, or slot names. Atlas should translate natural language into internal candidates and ask only when the mapping is ambiguous.

The complete current-code catalog is in `Current Code Target Catalog`. The short mapping below is the operating summary.

| 사용자 표현 | 내부 후보 | 추가 질문 필요 여부 |
| --- | --- | --- |
| `lge.co.kr 메인 PC 버전의 첫 화면` | `pageId=home`, `viewportProfile=pc`, `targetGroupId=home-top`, slot candidates `hero`, `quickmenu` | target can be resolved; ask only if `scope` means hero only or hero+quickmenu and that distinction matters |
| `모바일에서 냉장고 카테고리 PLP` | `pageId=category-refrigerators`, `viewportProfile=mo`, slots `banner`, `filter`, `sort`, `productGrid`, `firstRow`, `firstProduct` | ask target area if the user did not say list/top/filter/navigation |
| `TV 카테고리 PLP` | `pageId=category-tvs`, slots `banner`, `filter`, `sort`, `productGrid`, `firstRow`, `firstProduct` | ask PC/MO if missing |
| `TV PDP 일반형` / `TV 일반 LED 상세` | `pageId=pdp-tv-general`, slots `gallery`, `summary`, `price`, `option`, `sticky`, `review`, `qna` | ask target area if missing |
| `TV PDP 프리미엄` / `OLED 상세` | `pageId=pdp-tv-premium`, slots `gallery`, `summary`, `price`, `option`, `sticky`, `review`, `qna` | ask target area if missing |
| `냉장고 PDP 일반형` / `매직스페이스 상세` | `pageId=pdp-refrigerator-general`, slots `gallery`, `summary`, `price`, `option`, `sticky`, `review`, `qna` | ask target area if missing |
| `냉장고 PDP 노크온` | `pageId=pdp-refrigerator-knockon`, slots `gallery`, `summary`, `price`, `option`, `sticky`, `review`, `qna` | ask target area if missing |
| `냉장고 PDP 글라스` / `미스트 글라스` | `pageId=pdp-refrigerator-glass`, slots `gallery`, `summary`, `price`, `option`, `sticky`, `review`, `qna` | ask target area if missing |
| `제품상세` / `PDP` only | page candidate depends on product family | ask product family and representative case |
| `가전 구독` / `케어솔루션 메인` | `pageId=care-solutions`, slots `hero`, `ranking`, `benefit`, `tabs`, `careBanner` | ask target area if missing |
| `케어솔루션 PDP` / `정수기 구독 상세` | `pageId=care-solutions-pdp`, slots `visual`, `detailInfo`, `noticeBanner`, `reviewInfo` | ask target area if missing |
| `베스트샵` / `매장찾기` / `방문상담` | `pageId=bestshop`, slots `hero`, `shortcut`, `review`, `brandBanner` | ask target area if missing |
| `고객지원` / `AS` / `서비스센터` | `pageId=support`, slots `mainService`, `notice`, `tipsBanner`, `bestcare` | ask target area if missing |
| `홈스타일 메인` | `pageId=homestyle-home`, slots `quickMenu`, `labelBanner`, `brandStory` | ask target area if missing |
| `홈스타일 PDP` / `홈스타일 상품상세` | `pageId=homestyle-pdp`, slots `detailInfo`, `bestProduct`, `review`, `qna`, `guides`, `seller` | ask target area if missing |
| `고객여정 기준으로 메인에서 냉장고 카테고리, PDP까지` | future journey spec candidate with pages `home`, `category-refrigerators`, product-family PDP | ask journey intake; do not send to draft build |

Viewport mapping:

| 사용자 표현 | 내부 후보 | 추가 질문 필요 여부 |
| --- | --- | --- |
| `PC` / `데스크탑` / `웹` | `pc` | no |
| `모바일` / `mobile` / `MO` | `mo` | no |
| `태블릿` | reserved `ta` | yes; return feasibility guidance because tablet support is reserved |

Page mapping:

| 사용자 표현 | 내부 후보 | 추가 질문 필요 여부 |
| --- | --- | --- |
| `메인` / `홈` / `lge.co.kr 첫 화면` | `home` | usually no |
| `냉장고 카테고리` / `냉장고 PLP` | `category-refrigerators` | ask target area if missing |
| `TV 카테고리` / `TV PLP` | `category-tvs` | ask target area if missing |
| `TV PDP 일반형` | `pdp-tv-general` | usually no |
| `TV PDP 프리미엄` / `OLED PDP` | `pdp-tv-premium` | usually no |
| `냉장고 PDP 일반형` | `pdp-refrigerator-general` | usually no |
| `냉장고 PDP 노크온` | `pdp-refrigerator-knockon` | usually no |
| `냉장고 PDP 글라스` | `pdp-refrigerator-glass` | usually no |
| `가전 구독` / `케어솔루션` | `care-solutions` | ask main/PDP if ambiguous |
| `케어솔루션 PDP` / `정수기 구독 상세` | `care-solutions-pdp` | usually no |
| `베스트샵` / `매장찾기` | `bestshop` | ask target area if missing |
| `고객지원` / `AS` | `support` | ask target area if missing |
| `홈스타일 메인` | `homestyle-home` | ask target area if missing |
| `홈스타일 PDP` | `homestyle-pdp` | ask target area if missing |
| `제품상세` / `PDP` only | product-family PDP candidate | ask product family |

Slot language mapping:

| 사용자 표현 | 내부 후보 | 추가 질문 필요 여부 |
| --- | --- | --- |
| `첫 화면` / `상단` | `hero`, optionally `quickmenu`; for main first screen use `home-top` | ask if it is ambiguous whether the user means hero only or hero+quickmenu |
| `바로가기` / `퀵메뉴` | `quickmenu` | no |
| `배너` / `구매가이드 배너` | `hero`, `banner`, `noticeBanner`, `labelBanner`, `brandBanner`, `tipsBanner`, `careBanner` depending on page | ask page and position if unclear |
| `제품 리스트` / `상품 목록` | `productGrid` / `firstRow` / `firstProduct` | ask page/category if missing |
| `필터` / `정렬` | `filter` / `sort` | ask page/category if missing |
| `상세 상단` / `상세 요약` | `gallery`, `summary`, `price`, `option`, `sticky` | ask product family if missing |
| `가격` / `혜택` | `price`, `benefit`, `noticeBanner` depending on page | ask page if missing |
| `옵션` / `구매 버튼` / `스티키` | `option`, `sticky` | ask product family if missing |
| `리뷰` / `문의` / `Q&A` | `review`, `reviewInfo`, `qna` | ask page if missing |
| `서비스 검색` / `AS 접수` | `mainService` | no if support page is clear |
| `매장 바로가기` / `방문상담` | `shortcut` | no if bestshop page is clear |

### 2. Intake And RequirementDraft

The assistant checks whether it has enough information to prepare the requirement format for concept-preview.

Required intake fields:

- `screen`
- `viewport`
- `scope`
- `request`

Optional reference fields:

- `targetArea`
- `purpose`
- `tone`
- `changeLevel`
- `keep`
- `avoid`
- `refs`

Do not keep asking only because optional fields are empty. If a required field is missing, ask one short follow-up question. If a required field is ambiguous, ask only the resolving question:

- Category only: ask whether it is refrigerator, TV, or another category.
- PDP only: ask for the product family.
- "전체적으로": ask whether this means the whole page or a tone applied across the selected scope.
- "첫 화면": ask whether this means hero only or hero+quickmenu when that distinction matters.

If the required fields are present, the assistant prepares the requirement format internally and guides the user to run concept-preview.

### 2-1. Customer Journey / Multi-Page Intake

If a `#아틀라스` request mentions a customer journey, funnel, multiple pages, page flow, cross-page experience, or sequential page improvements, the assistant must not send it to a single draft build first.

Instead, it asks for:

- customer journey name
- target page list
- goal for each page
- target area for each page in user language
- PC/MO scope
- conversion or navigation goal
- whether pages should be built independently or sequentially
- shared design principles across pages

Customer journey concepts must stay review-only and should be split into page-level concept-preview and build steps later.

Reason:

- The current draft build path is centered on a single page and target slot/group.
- Multi-page orchestration needs a separate journey spec and build sequencing design.
- Each page may later become its own single-page Atlas concept after the journey is reviewed.

### 3. Concept-Preview Review In Chat

The assistant first prepares `requirementDraft`. The concept document itself is generated by the backend concept-preview job and then displayed in chat.

When fields are sufficient, the assistant should say:

```text
컨셉서 생성을 시작하려면 Action을 실행하세요.
```

Provider quality note:

- `plannerProvider=local` should be described as a fast draft concept path.
- Higher-quality concepts should use a dedicated planner/OpenRouter provider.
- The assistant should not hide provider quality limits by filling missing strategy details itself.

The concept-preview Action/API calls `POST /api/builder/lge/v1/concept-preview`, then polls `GET /api/builder/lge/v1/concept-jobs/:jobId`. While polling, Open WebUI should show the stage-specific chat status copy from `Concept-Preview API Contract`.

When the job is `done`, the chat displays:

- `requirementPlan`
- `builderMarkdown`
- `designSpecMarkdown`
- `conceptDocument`

The `conceptDocument` is review-only by default.

After concept-preview completes, the user can revise or confirm:

- Revision: update `requirementDraft` and rerun concept-preview.
- Confirmation: run preflight.
- Preflight ok: start draft build.
- Preflight blocked: show feasibility guidance and do not start draft build.

Recommended completion copy:

```text
컨셉서가 준비되었습니다. 수정하려면 수정 내용을 말하고, 빌드하려면 '이 컨셉서로 빌드'라고 답하세요.

이 메시지는 review-only 컨셉서입니다. 아직 draft build를 만들지 않았습니다.
```

### 3-1. Direct YAML Compatibility

Direct YAML remains only an Action/backend compatibility concern for legacy final-build messages. It is not an Atlas model output and should not be shown as a user-facing prompt example.

If this compatibility path is used outside the Atlas model prompt, build-ready metadata is allowed only after explicit user confirmation and preflight still runs before draft build. The default flow should prefer `requirement format -> concept-preview -> conceptDocument -> preflight -> draft build`.

### 4. Action Routing

When the user presses the Action button, the first step is routing. Build is only one route.

Routing table:

| Message state | Action result |
| --- | --- |
| `requirement_draft_ready` | call `POST /api/builder/lge/v1/concept-preview` |
| `concept_preview_queued` / `concept_preview_running` | poll `GET /api/builder/lge/v1/concept-jobs/:jobId` and display stages |
| `concept_ready` + user revision | update `requirementDraft`, rerun concept-preview |
| `concept_ready` + user build confirmation | run preflight |
| preflight ok | start draft build |
| preflight not ok | feasibility report |
| direct YAML compatibility message + preflight ok | build |
| unrelated message | intake guidance |
| reusable policy/constraint/decision content | Knowledge candidate |
| user idea or temporary private memo | personal note candidate |
| team decision, requirement, or candidate concept | shared note candidate |

Concept-preview uses `POST /api/builder/lge/v1/concept-preview` and `GET /api/builder/lge/v1/concept-jobs/:jobId`. Preflight happens only after the user reviews and confirms the concept.

### 5. Build Trigger

The build starts only when the user explicitly confirms the concept, preflight passes, and the build Action/API is invoked. The assistant must not claim that a build is running before that point.

Allowed build trigger:

- concept-preview is done and the chat contains a real `conceptDocument`
- user says `이 컨셉서로 빌드`
- backend preflight returns ok
- user runs the draft build Action/API

Blocked build trigger:

- no completed concept-preview result
- no reviewed `conceptDocument`
- missing target page, viewport, target group, target components, or design change level
- `#아틀라스` intake message without a completed concept document
- ordinary assistant answer, Q&A response, or requirement discussion
- preflight reports missing target, contract mismatch, asset-role violation, or unsafe runtime condition

Blocked message:

```text
아틀라스 빌드가 시작되지 않았습니다.

이 메시지는 아직 빌드 가능한 아틀라스 컨셉서가 아닙니다.
먼저 #아틀라스로 요구사항을 정리하고 concept-preview로 컨셉서를 만든 뒤, 그 컨셉서를 확인하고 빌드를 실행해주세요.
```

### 6. RequirementDraft Revision Flow

The Action can help convert a useful answer into `requirementDraft`, but it should not become a draft build by default.

Rules:

- Auto-drafted requirements should go through concept-preview first.
- The concept-preview result is review-only and does not create preview/compare links.
- The user must review and confirm the returned `conceptDocument` before preflight and draft build.
- Missing fields must remain visible instead of being silently reconstructed.
- The draft should preserve the source answer and user requirement instead of summarizing away constraints.

Example requirement draft:

```json
{
  "requestText": "메인 첫 화면을 프리미엄 캠페인 톤으로 개선",
  "targetGroupId": "home-top",
  "targetComponents": ["hero", "quickmenu"],
  "designChangeLevel": "medium",
  "referenceUrls": [],
  "sourceMessageId": "openwebui-message-id"
}
```

Recommended Action response:

```text
이 답변은 바로 빌드하지 않고 아틀라스 requirementDraft로 정리할 수 있습니다.
컨셉서 생성을 시작하려면 Action을 실행하세요.
```

### 7. Concept-Preview And Build Progress

Concept-preview progress is shown from `GET /api/builder/lge/v1/concept-jobs/:jobId`:

| Stage | Chat status copy |
| --- | --- |
| `queued` | 컨셉서 생성 요청을 받았습니다. |
| `resolving_target` | 대상 화면과 변경 범위를 정리하고 있습니다. |
| `analyzing_references` | 레퍼런스와 참고 자료를 분석하고 있습니다. |
| `generating_concept` | 기존 빌더 컨셉서 생성 로직으로 초안을 작성하고 있습니다. |
| `formatting_concept_document` | 채팅창에 표시할 컨셉서 문서를 정리하고 있습니다. |
| `done` | 컨셉서가 준비되었습니다. |
| `failed` | 컨셉서 생성에 실패했습니다. |

Build progress is separate and starts only after confirmation and preflight:

- `build_queued`: draft build 요청을 받았습니다.
- `build_running`: draft build를 생성하고 있습니다.
- `build_done`: draft build가 완료되었습니다. Preview / Compare 링크를 확인하세요.
- `build_failed`: draft build에 실패했습니다.

### 8. Result Review

When concept-preview is complete, the Action displays the returned concept fields:

```markdown
## Atlas Concept Ready

- requirementPlan
- builderMarkdown
- designSpecMarkdown
- conceptDocument
- plannerProvider
- completedAt
```

When the draft build job is complete, the Action appends result links to the same assistant message:

```markdown
## LGE Builder Draft Ready

- Preview: ...
- Compare: ...
- Job: ...
- Draft: ...
- Artifact ID: ...
```

The user opens Preview or Compare in a new browser tab and returns to chat for further revisions.

## Chat Output Classification

Atlas chat answers should be classified before a user stores or builds from them. The same answer can be useful, but the storage target depends on whether it is executable, reusable, personal, or team-owned.

### 1. Atlas Concept Ready

Use this when concept-preview has returned a review-only concept document.

Required signals:

- concept-preview job reached `done`
- returned fields include `requirementDraft`, `requirementPlan`, `builderMarkdown`, `designSpecMarkdown`, `conceptDocument`, `plannerProvider`, and `completedAt`
- `conceptDocument` is review-only by default
- the user has not yet received preview/compare links

Primary action:

- revise requirementDraft and rerun concept-preview, or confirm and run preflight

Secondary actions:

- Save as shared note if the team should review before build.
- Save as Knowledge candidate only after it becomes a repeatable requirement, decision, or limitation.

Final-build compatibility:

- A direct builder-ready YAML concept can still be used by the existing Draft Action after explicit confirmation, but it is not the default Atlas generation path.

### 2. Builder Feasibility Report

Use this when the assistant explains whether a requested build is possible, risky, blocked, or needs more information.

Examples:

- target scope is missing or ambiguous
- asset policy blocks a requested visual reuse
- `promo-complete` reuse would violate guardrails
- viewport, slot, or runtime constraints make the request unsafe
- the concept is not ready for the builder yet

Primary action:

- Save as shared note when it affects this project decision.

Knowledge candidate rule:

- Promote only the reusable limitation or rule, not the whole conversational answer.
- Good Knowledge examples: `promo-complete cannot be reused as hero background`, `quickmenu requires icon-only family consistency`, `conceptDocument must be preserved`.

### 3. Knowledge Candidate

Use this when an answer states a reusable project rule.

Store as Knowledge when the answer contains:

- policy
- design principle
- repeatable decision
- asset rule
- build limitation
- validated workflow
- runtime preservation rule

Do not store as Knowledge when the answer is only:

- a one-off preference
- a temporary brainstorm
- an unapproved campaign idea
- a private reminder
- a draft that still needs team decision

Target collections:

- `lge-policy`: hard guardrails, asset rules, runtime preservation rules
- `lge-component-spec`: component behavior, slot/component constraints, renderer expectations
- `lge-design-history`: approved decisions, checkpoints, review outcomes
- `lge-requirements`: project-level requirements and workflow contracts
- `lge-idea-archive`: reusable concept candidates and selection rationale

In a `#아틀라스` answer:

- improvement rationale and improvement direction are shared note candidates
- repeated principles are Knowledge candidates
- user preference or temporary ideas are personal note candidates
- multi-page customer journey definitions are shared note or future journey spec candidates

### 4. Personal / Shared Note Candidate

Use this when the answer is useful to keep but is not yet durable Knowledge.

Personal note:

- user's temporary idea
- private preference
- reminder to revisit later
- rough phrasing that should not affect team behavior yet

Shared note:

- team-visible requirement
- decision pending review
- concept candidate
- selected/rejected rationale
- feasibility finding for the current project
- handoff note for later implementation

Notes can later be promoted into Knowledge after review.

## Save Candidate UX

When the assistant produces a useful answer, Open WebUI should expose save choices that do not imply build execution.

Suggested labels:

- `이 답변을 컨셉서 초안으로 정리`
- `이 내용을 Knowledge 후보로 저장`
- `개인 노트로 저장`
- `공유 노트로 저장`

Recommended behavior:

- `이 답변을 requirementDraft로 정리`: rewrites the answer into the concept-preview input shape.
- `이 내용을 Knowledge 후보로 저장`: stores a reviewed, reusable rule with collection, title, summary, markdown, tags, source message id, and reviewer status.
- `개인 노트로 저장`: stores a private note visible only to the user.
- `공유 노트로 저장`: stores a project note visible to team/project participants.

Knowledge and Note candidates are separate from build. Saving a candidate must never queue the builder job.

The Action button remains guarded. It should create concepts through concept-preview first, and build only after user confirmation and preflight ok; otherwise it routes to the non-build outcomes above.

## Note And Knowledge Data Shape

Minimum common fields:

```json
{
  "id": "note-or-candidate-...",
  "kind": "atlas-requirement-draft | atlas-concept-ready | builder-feasibility-report | knowledge-candidate | personal-note | shared-note",
  "visibility": "private | project | team",
  "projectId": "lge-openwebui-project",
  "sourceMessageId": "openwebui-message-id",
  "sourceThreadId": "openwebui-chat-id",
  "title": "Short title",
  "summary": "One or two sentence summary",
  "markdown": "Preserved source or reviewed note body",
  "tags": ["#atlas"],
  "status": "draft | review | approved | rejected | promoted",
  "createdBy": "openwebui-user-id",
  "createdAt": "ISO-8601"
}
```

Knowledge candidate additional fields:

```json
{
  "targetCollection": "lge-policy | lge-component-spec | lge-design-history | lge-requirements | lge-idea-archive",
  "truthLevel": "policy | runtime-truth | historical | candidate",
  "freshness": "current | historical | candidate",
  "reviewedBy": "openwebui-user-id",
  "promotedProjectionPath": "exports/openwebui/knowledge/<collection>/<document>.json"
}
```

Concept-preview additional fields:

```json
{
  "conceptId": "concept-...",
  "conceptGroupId": "campaign-...",
  "requirementDraft": {},
  "requirementPlan": "Markdown or structured plan",
  "builderMarkdown": "Builder concept markdown",
  "designSpecMarkdown": "Design spec markdown",
  "conceptDocument": "Review-only Atlas concept document",
  "plannerProvider": "provider id",
  "completedAt": "ISO-8601",
  "pageId": "home",
  "viewportProfile": "pc",
  "targetGroupId": "home-top",
  "targetComponents": ["hero", "quickmenu"]
}
```

Personal note additional fields:

```json
{
  "visibility": "private",
  "noteScope": "personal",
  "promotable": true,
  "promotionTargets": ["shared-note", "knowledge-candidate", "atlas-requirement-draft"]
}
```

Shared note additional fields:

```json
{
  "visibility": "project",
  "noteScope": "shared",
  "decisionState": "proposed | accepted | rejected | superseded",
  "linkedConceptIds": ["concept-..."],
  "linkedArtifactIds": ["openwebui-artifact-..."]
}
```

## Actor Responsibilities

### User

- Starts with `#아틀라스`.
- Reviews the concept-preview result in Open WebUI chat.
- Confirms the reviewed concept before preflight and draft build.
- Reviews Preview and Compare links.

### Open WebUI Chat Model

- Recognizes `#아틀라스` as LGE Builder work mode.
- Performs intake.
- Produces and revises `requirementDraft` in chat.
- Does not claim concept-preview or draft build is running unless a real Action/API job exists.
- Does not directly call draft build unless the confirmed Action flow is used.

### LGE Builder Draft Action

- Can route `requirement_draft_ready` messages to `POST /api/builder/lge/v1/concept-preview`.
- Polls `GET /api/builder/lge/v1/concept-jobs/:jobId` for concept-preview stages.
- Displays `requirementPlan`, `builderMarkdown`, `designSpecMarkdown`, and `conceptDocument` when concept-preview is done.
- Blocks non-concept messages.
- Routes non-buildable messages to concept-preview, feasibility, Knowledge candidate, or note candidate guidance.
- Queues the draft build job only after user confirmation, local guard validation, and backend preflight ok.
- Appends status and final links to chat.

### clonellm Backend

- `POST /api/builder/lge/v1/concept-preview` receives `requirementDraft` or server planner payload and creates only a concept-preview job.
- `GET /api/builder/lge/v1/concept-jobs/:jobId` returns concept job status and, when done, the fixed concept response fields.
- Draft build receives the confirmed concept document unchanged.
- Draft build creates preview and compare output.
- Returns artifact metadata and canonical artifact record.

## First Acceptance Criteria

- A plain assistant message cannot start a build.
- A `#아틀라스` request can become `requirementDraft` and then concept-preview.
- Concept-preview returns review-only concept output and does not create preview/compare/artifact.
- The build Action blocks missing concept-preview result, missing user confirmation, and failed preflight.
- A confirmed concept queues a draft build job and returns Preview/Compare links only after build completion.
- The concept document is preserved in the builder payload and artifact metadata.
