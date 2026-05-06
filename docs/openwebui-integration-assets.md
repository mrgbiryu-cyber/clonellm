# Open WebUI Integration Assets

This repository now ships two stable Open WebUI-facing integration assets.

## OpenAPI Tool Server Spec

```text
integrations/openwebui/lge-builder-openapi.json
```

Use this when Open WebUI should treat `clonellm` as an external REST tool server. Configure the server URL to the running `clonellm` instance and set the bearer token to `OPENWEBUI_BUILDER_SERVICE_TOKEN`.

## Native Action Function

```text
integrations/openwebui/lge_builder_action.py
```

Use this when users need a visible chat action button with status updates. Import it in Open WebUI:

```text
Admin Panel -> Functions -> Import/Create -> paste or import lge_builder_action.py
```

Then configure Valves:

```text
builder_base_url=http://127.0.0.1:3000
builder_public_url=http://34.27.99.82:3000
builder_service_token=<OPENWEBUI_BUILDER_SERVICE_TOKEN>
default_project_id=<open-webui project id>
default_page_id=home
default_viewport_profile=pc
```

The action sends the selected/latest message as `conceptDocument`, queues a `clonellm` builder job, polls until done, acknowledges the job, and returns preview/compare links plus save-ready artifact metadata.

For Open WebUI 0.9.x, do not add `requirements: requests` to this Action frontmatter unless the Open WebUI runtime Python has working `pip`. The local deployment already has `requests` and `pydantic`; forcing requirements installation can make `/api/v1/functions/id/<id>/valves/spec` return 500 and prevent the Action button from appearing in chat.

Visibility checklist:

- Import as `Workspace -> Functions` or `Admin Panel -> Functions`, not as a Tool.
- If the function was imported before this cleanup, update the existing Function content from the latest `lge_builder_action.py` or delete/re-import it so the stored copy no longer contains `requirements: requests`.
- Confirm type is `action`.
- Enable the Function and enable Global, or attach it to the specific model.
- Check the generated message toolbar for the action button; it is not part of the chat composer tool menu.

If Open WebUI runs on the same GCP VM as `clonellm`, use:

```text
builder_base_url=http://localhost:3000
builder_public_url=http://34.27.99.82:3000
```

## Atlas Concept-Preview And Draft Build Flow

The default Atlas flow is `requirementDraft -> POST /api/builder/lge/v1/concept-preview -> conceptDisplayMarkdown/conceptDocument -> user confirmation -> preflight -> draft build`.

`POST /api/builder/lge/v1/concept-preview` uses the Open WebUI service token and accepts `requirementDraft` or a server planner payload. It creates only a review-only concept job. It does not create a draft build, preview, compare view, or artifact. Poll concept jobs with `GET /api/builder/lge/v1/concept-jobs/:jobId`. `conceptDisplayMarkdown` is the chat-visible concept; the full saved `conceptDocument` remains the canonical build input.

The YAML frontmatter path remains final-build compatibility for the existing Draft Action, but it is not an Atlas model prompt pattern. Do not ask the model to emit YAML, build metadata, or internal target IDs in chat.

`#아틀라스` means Builder work mode, not immediate build. The first assistant response should be short: 4-6 lines of requirement understanding, no long consulting answer, no YAML frontmatter, no JSON/code block, no internal IDs, and no debug output. The model is a requirement organizer, not a concept writer or build runner. It organizes user language into `screen`, `viewport`, `scope`, `targetArea`, `request`, `purpose`, `changeLevel`, `tone`, `keep`, `avoid`, and `refs`.

Required fields are `screen`, `viewport`, `scope`, and `request`. The `요구사항 상태` table should show only those required fields plus missing/ambiguous status. `purpose`, `tone`, `changeLevel`, `keep`, `avoid`, `refs`, and `targetArea` are optional reference values; show them only as optional examples and do not keep asking only because they are missing. The model does not directly write the concept document. Backend concept-preview creates `conceptDocument`. Atlas responses must not expose internal reasoning, Thought, reasoning details, analysis process, scratchpad, debug JSON, raw requirement JSON, `builderReady`, `pageId`, or `targetScope`. They must not use Markdown checkboxes. When required fields are missing or ambiguous, ask with a short user-facing sentence such as `필수 정보 중 viewport가 빠졌습니다. PC인지 모바일인지 알려주세요.` When required fields are enough, say `요구사항 정리 완료. 메인 / 모바일 / 전체 페이지 / 럭셔리 개선으로 정리했습니다. 이 메시지에서 LGE Builder Draft Action을 실행하면 컨셉서 검토본이 생성됩니다.`

`#아틀라스` must be injected through model instructions. The MVP is an Open WebUI `Atlas Builder` custom model/preset that uses base model `anthropic/claude-haiku-4.5` and includes the Atlas system prompt, LGE Knowledge collections, and the `LGE Builder Draft Action`. Knowledge attachment alone is not enough because it provides retrieval context, not a guaranteed mode switch. Prompt Templates are useful as manual fallback only.

Filter Function injection is deferred until after the custom model/preset MVP. The next hardening step is a Filter Function that detects `#아틀라스` before the selected model is called and prepends the Atlas instruction. Action-only routing cannot fix the first assistant response because Actions run after a message already exists.

Preset setup summary:

1. Open `Workspace -> Models`.
2. Create `Atlas Builder`.
3. Set base model to `anthropic/claude-haiku-4.5`.
4. Paste `Atlas System Prompt - Operations Final` from `docs/open-webui-atlas-builder-user-flow-2026-04-30.md`.
5. Attach Knowledge collections: `lge-policy`, `lge-component-spec`, `lge-design-history`, `lge-requirements`, `lge-idea-archive`.
6. Attach `LGE Builder Draft Action`.

User-facing intake should accept natural screen expressions and avoid asking users for internal IDs. The intended mapping chain is:

```text
user expression -> requirementDraft -> concept-preview -> conceptDocument -> preflight -> draft build
```

First-pass mapping examples:

- `lge.co.kr 메인`, `LGE 메인`, `메인`, `홈 화면`, `home` -> `pageId: home`
- `PC`, `데스크탑`, `웹` -> `viewportProfile: pc`
- `모바일`, `MO`, `mobile` -> `viewportProfile: mo`
- `태블릿`, `tablet`, `TA` -> reserved target; explain feasibility because current runtime-pass targets are `pc` and `mo`
- `냉장고 카테고리`, `냉장고 PLP`, `refrigerator category` -> `pageId: category-refrigerators`
- `TV 카테고리`, `TV PLP` -> `pageId: category-tvs`
- `냉장고 PDP`, `냉장고 제품상세`, `냉장고 상세` -> ask which candidate: `pdp-refrigerator-general`, `pdp-refrigerator-glass`, or `pdp-refrigerator-knockon`
- `TV PDP`, `TV 제품상세`, `TV 상세`, `OLED 상세` -> ask which candidate: `pdp-tv-general` or `pdp-tv-premium`
- `케어솔루션`, `가전 구독` -> `pageId: care-solutions` or `care-solutions-pdp`; ask main/PDP if unclear
- `베스트샵`, `매장`, `매장 찾기` -> `pageId: bestshop`
- `고객지원`, `서비스`, `A/S`, `문의` -> `pageId: support`
- `홈스타일`, `인테리어`, `공간 제안` -> `pageId: homestyle-home` or `homestyle-pdp`; ask main/PDP if unclear
- `장바구니`, `결제`, `주문 완료` -> journey/reference candidate only, not a single-page builder target yet

The backend preflight endpoint remains internal-ID based. A future `resolve_user_target()` layer should run before preflight so Action/Atlas parser output can translate natural user expressions into the builder contract.

User input examples:

```text
#아틀라스 lge.co.kr 메인 PC 버전의 첫 화면을 프리미엄 가전 캠페인 느낌으로 개선하고 싶어.
```

```text
#아틀라스 모바일에서 냉장고 카테고리 PLP를 더 탐색하기 쉽게 개선하고 싶어.
```

```text
#아틀라스 고객여정 기준으로 메인에서 냉장고 카테고리, PDP까지 이어지는 구매 흐름을 개선하고 싶어.
```

User language mapping:

| User phrase | Internal candidate | Follow-up |
| --- | --- | --- |
| `lge.co.kr 메인 PC 버전의 첫 화면` | `home`, `pc`, `home-top`, `hero+quickmenu` | Do not block on follow-up; record assumptions in `가정` |
| `메인 중간 영역`, `타임딜`, `랭킹`, `브랜드 쇼룸`, `혜택 안내` | `home-middle`, `home-lower-primary`, or `home-lower-secondary` | Ask which visible block if multiple match |
| `모바일에서 냉장고 카테고리 PLP` | `category-refrigerators`, `mo`, `banner/filter/sort/productGrid/firstRow/firstProduct` | Ask exact target area only if the phrase is broader than one area |
| `TV 카테고리 PLP` | `category-tvs`, `banner/filter/sort/productGrid/firstRow/firstProduct` | Ask PC/MO if missing |
| `TV PDP 일반형`, `OLED 상세` | `pdp-tv-general` or `pdp-tv-premium`, `gallery/summary/price/option/sticky/review/qna` | Ask exact representative case if unclear |
| `냉장고 PDP 일반형`, `노크온`, `글라스` | `pdp-refrigerator-general`, `pdp-refrigerator-knockon`, or `pdp-refrigerator-glass` | Ask exact representative case if unclear |
| `제품상세` / `PDP` only | product-family PDP candidate | Ask product family and representative case |
| `케어솔루션 메인`, `가전 구독 랭킹`, `구독 혜택` | `care-solutions`, `hero/ranking/benefit/tabs/careBanner` | Ask PC/MO if missing |
| `케어솔루션 상세`, `구독 PDP` | `care-solutions-pdp`, `visual/detailInfo/noticeBanner/reviewInfo` | Ask target area if needed |
| `베스트샵`, `매장 안내`, `매장 리뷰` | `bestshop`, `hero/shortcut/review/brandBanner` | Ask target area if needed |
| `고객지원`, `A/S`, `서비스 팁`, `공지` | `support`, `mainService/notice/tipsBanner/bestcare` | Ask target area if needed |
| `홈스타일 메인`, `공간 제안` | `homestyle-home`, `quickMenu/labelBanner/brandStory` | Ask main/PDP if ambiguous |
| `홈스타일 상세`, `공간 상세` | `homestyle-pdp`, `detailInfo/bestProduct/review/qna/guides/seller` | Ask target area if needed |
| customer journey from main to category to PDP | future journey spec candidate; current builder targets are per-page | Ask journey intake |

Viewport mapping: `PC` / `데스크탑` / `웹` -> `pc`; `모바일` / `mobile` / `MO` -> `mo`; `태블릿` -> reserved `ta` with feasibility guidance.

Users do not need to know slot names. Atlas maps `첫 화면`, `상단`, `바로가기`, `배너`, `제품 리스트`, `필터`, `정렬`, `첫 번째 상품`, `상세 상단`, `이미지 영역`, `구매 옵션`, `가격`, `리뷰`, `Q&A`, `공지`, `서비스 팁`, and `매장 리뷰` to internal slot candidates.

Requirement format:

| Field | Required | Notes |
| --- | --- | --- |
| `screen` | yes | User-facing screen, page, category, or PDP name |
| `viewport` | yes | PC/desktop/web or mobile/MO |
| `scope` | yes | Whole page, first screen, top area, product list, PDP top, etc. |
| `targetArea` | no | More specific area if known |
| `request` | yes | What the user wants changed or improved |
| `purpose` | no | Campaign goal, conversion goal, navigation goal |
| `changeLevel` | no | `low`, `medium`, or `high` |
| `tone` | no | User-provided tone |
| `keep` | no | Constraints to preserve |
| `avoid` | no | Constraints to avoid |
| `refs` | no | Reference URLs or named references |

Input combination handling:

| Input | Handling |
| --- | --- |
| Requirements only | Concept-preview can run without `referenceUrls`; use current page, scope, and request text. |
| References only | Use `referenceUrls` for direction and ask only for target screen/scope; exact layout copy is forbidden. |
| Requirements + references | Requirements win; references support direction, guardrails, and mood. |
| Page / scope only | Use page identity, design reference library, and asset policy; label as "구체 요구가 약한 초안". |
| Customer journey | Create journey strategy / flow candidate first, then split into page-level builds. |

Without a completed review-only `conceptDocument` and explicit user confirmation, the Action does not queue a draft build. The preferred generation path is `requirement format -> backend concept-preview -> conceptDocument -> user confirmation -> preflight -> draft build`; the model should not write final builder YAML or internal build metadata directly.

Direct YAML/build metadata compatibility remains an Action/backend concern only. Do not include it in Atlas model prompt examples.

Do not use `minor`, `moderate`, or `major` for `designChangeLevel`.

## Action Routing UX

The Action button should route before it builds:

- Requirement drafting should fill the admin-compatible `requirementDraft` shape first, then call `POST /api/builder/lge/v1/concept-preview` to get a review-only `conceptDocument`.
- `concept_preview_queued` / `concept_preview_running` -> poll `GET /api/builder/lge/v1/concept-jobs/:jobId`.
- `concept_ready` + user revision -> update `requirementDraft` and rerun concept-preview.
- `concept_ready` + user build confirmation -> run preflight.
- preflight ok -> queue draft build.
- preflight not ok -> feasibility report.
- ordinary LGE/design/requirement answer -> offer Atlas concept draft conversion.
- unrelated message -> intake guidance.
- reusable policy/constraint/decision -> Knowledge candidate.
- user idea or temporary memo -> personal note candidate.
- team requirement/decision/candidate concept -> shared note candidate.

Concept-preview job stages:

| Stage | Chat status copy |
| --- | --- |
| `queued` | 컨셉서 생성 요청을 받았습니다. |
| `resolving_target` | 대상 화면과 변경 범위를 정리하고 있습니다. |
| `analyzing_references` | 레퍼런스와 참고 자료를 분석하고 있습니다. |
| `generating_concept` | 기존 빌더 컨셉서 생성 로직으로 초안을 작성하고 있습니다. |
| `formatting_concept_document` | 채팅창에 표시할 컨셉서 문서를 정리하고 있습니다. |
| `done` | 컨셉서가 준비되었습니다. |
| `failed` | 컨셉서 생성에 실패했습니다. |

The `done` response displays `requirementDraft`, `requirementPlan`, `builderMarkdown`, `designSpecMarkdown`, `conceptDocument`, `plannerProvider`, and `completedAt`.

Draft build status is separate:

| State | Chat status copy |
| --- | --- |
| `build_queued` | draft build 요청을 받았습니다. |
| `build_running` | draft build를 생성하고 있습니다. |
| `build_done` | draft build가 완료되었습니다. Preview / Compare 링크를 확인하세요. |
| `build_failed` | draft build에 실패했습니다. |

Knowledge candidates, personal notes, and shared notes are separate from build and must not queue builder jobs.

If `screen`, `viewport`, `scope`, and `request` are present, summarize in user language and ask the user to run the Action. If a required field is missing, ask one short follow-up. If the target is ambiguous, ask only the resolving question: category means refrigerator/TV/other, PDP needs product family, `전체적으로` needs whole-page vs tone clarification, and `첫 화면` can ask hero-only vs hero+quickmenu when it matters.

Provider quality note: `plannerProvider=local` is the fast draft concept path. For a higher-quality concept, use a dedicated planner/OpenRouter provider instead of letting the assistant invent missing strategy details.

Customer journey, funnel, multi-page, or page-flow requests must collect journey-level intake first and must not go directly to draft build until a single-page concept is split out and explicitly confirmed. Use a text answer format such as `여정=냉장고 구매, 페이지=메인>냉장고PLP>PDP, viewport=모바일, 빌드=순차`.

For journey prompts, use user-facing screen names such as `메인 -> 카테고리/PLP -> 제품상세/PDP` while collecting intent. Internal IDs should be added only after target resolution.

Canonical Atlas templates live in `docs/open-webui-atlas-builder-user-flow-2026-04-30.md`:

- Atlas system prompt draft
- short ambiguous request response
- short single-page concept-preview Action guidance
- short customer journey / multi-page intake
- Note and Knowledge candidate routing

The existing Draft Action remains the final build action. It calls `POST {builder_base_url}/api/builder/lge/v1/preflight` immediately before `POST /api/builder/lge/v1/draft`. A feasibility response stops the draft call and is shown in chat with `reasonCode`, `message`, `unsupported`, `missing`, and suggested alternatives.

A concept-generation Action branch should call `POST {builder_base_url}/api/builder/lge/v1/concept-preview`, poll `/api/builder/lge/v1/concept-jobs/:jobId`, and emit `queued`, `resolving_target`, `analyzing_references`, `generating_concept`, `formatting_concept_document`, `done`, and `failed` through `__event_emitter__`.

## Action Return Metadata

After a completed job, preview and compare URLs are always composed from `builder_public_url`, using the builder-returned `previewPath` and `comparePath`.

The returned Action object includes:

```json
{
  "content": "Markdown summary for chat display",
  "artifact_metadata": {
    "schema": "openwebui-lge-builder-artifact-v1",
    "status": "ready",
    "source": "open-webui-action",
    "wrapperFor": "clonellm-builder-artifact-record",
    "jobId": "builder-job-...",
    "projectId": "lge-openwebui-project",
    "externalRequirementId": "requirement-123",
    "conceptId": "concept-spring-hero",
    "conceptGroupId": "campaign-spring",
    "conceptThreadId": "ct-...",
    "pageId": "home",
    "viewportProfile": "pc",
    "targetGroup": {
      "groupId": "home-top",
      "slotIds": ["hero", "quickmenu"],
      "componentIds": ["home.hero", "home.quickmenu"]
    },
    "conceptDocument": "original YAML frontmatter + Markdown",
    "builderRunId": "runtime-draft-...",
    "previewUrl": "http://34.27.99.82:3000/runtime-draft/...",
    "compareUrl": "http://34.27.99.82:3000/runtime-compare/...",
    "artifactRecord": {
      "schemaVersion": "openwebui-builder-artifact-v1",
      "artifactType": "lge-builder-draft",
      "artifactId": "openwebui-artifact-...",
      "sourceTrace": {
        "source": "clonellm-builder-api-v1",
        "conceptDocumentPreserved": true
      }
    },
    "authoredSectionMarkdownDocument": {},
    "authoredSectionHtmlPackage": {},
    "snapshotData": {},
    "validation": {},
    "runtimeAdvisory": []
  },
  "metadata": {
    "lgeBuilderArtifact": "same object as artifact_metadata"
  }
}
```

`artifact_metadata` is the Action return wrapper. Persist `artifact_metadata.artifactRecord` as the canonical builder artifact record.

## Current Status

These source assets are ready for import into an Open WebUI instance. Do not place them under `exports/openwebui/`; that folder is regenerated by `npm run export:openwebui`.
