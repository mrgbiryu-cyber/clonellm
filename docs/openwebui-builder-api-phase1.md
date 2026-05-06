# Open WebUI Builder API Phase 1

## Scope

This phase exposes a builder-only API in `clonellm` for Open WebUI service calls. Open WebUI UI integration is not included yet.

Implemented endpoints:

- `POST /api/builder/lge/v1/concept-preview`
- `GET /api/builder/lge/v1/concept-jobs/:jobId`
- `POST /api/builder/lge/v1/preflight`
- `POST /api/builder/lge/v1/draft`
- `GET /api/builder/lge/v1/jobs/:jobId`
- `POST /api/builder/lge/v1/jobs/:jobId/ack`

The concept-preview endpoint is the Open WebUI service-token version of the admin requirement planning preview. It accepts `requirementDraft`, generates `conceptDisplayMarkdown` for the chat UI and the full builder-source `conceptDocument` for later build confirmation, and does not create a draft build, preview, compare page, or artifact.

`conceptDisplayMarkdown` is display-only. The final build must restore and submit the saved full `conceptDocument`; summaries or compact UI text must not become build input. Each concept job also writes a debug trace under `data/debug/openwebui-concept-preview/<jobId>/` so `providerResult`, `requirementPlan`, display markdown, builder markdown, design spec, and final `conceptDocument` can be compared when the generated concept feels over-assembled.

The preflight endpoint checks whether the same payload is currently buildable without creating a job, draft build, preview, or artifact.

The draft endpoint returns immediately with `status: queued`. Open WebUI polls the job endpoint until it receives `status: done` or `status: failed`.

## Auth

Requests require:

```http
Authorization: Bearer <OPENWEBUI_BUILDER_SERVICE_TOKEN>
X-OpenWebUI-User-Id: <open-webui-user-id>
X-OpenWebUI-Project-Id: <open-webui-project-id>
X-OpenWebUI-Request-Id: <request-id>
```

Local default token:

```text
dev-openwebui-builder-token
```

Production must set:

```text
OPENWEBUI_BUILDER_SERVICE_TOKEN
OPENWEBUI_PREVIEW_TOKEN_SECRET
```

## Concept Preview

Open WebUI should not make the model directly author final builder YAML as the default path. The default flow is:

```text
user request -> Atlas requirementDraft -> concept-preview job -> conceptDocument -> user confirms -> preflight -> draft build
```

`POST /api/builder/lge/v1/concept-preview` uses the same service token as the draft API:

```bash
curl -X POST http://localhost:3100/api/builder/lge/v1/concept-preview \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer dev-openwebui-builder-token' \
  -H 'X-OpenWebUI-User-Id: owui-smoke-user' \
  -H 'X-OpenWebUI-Project-Id: owui-smoke-project' \
  -d '{
    "requirementDraft": {
      "builderProvider": "local",
      "pageId": "home",
      "viewportProfile": "pc",
      "title": "프리미엄 메인 첫 화면",
      "message": "메인 첫 화면을 프리미엄 가전 캠페인 느낌으로 정리",
      "direction": "히어로와 바로가기의 정보 위계를 강화",
      "targetGroupId": "home-top",
      "targetGroupLabel": "메인 상단",
      "targetComponents": ["home.hero", "home.quickmenu"],
      "patchDepth": "medium"
    }
  }'
```

Queued response:

```json
{
  "ok": true,
  "jobId": "builder-concept-job-...",
  "status": "queued",
  "pollUrl": "/api/builder/lge/v1/concept-jobs/builder-concept-job-..."
}
```

Poll `GET /api/builder/lge/v1/concept-jobs/:jobId`. While running, the response includes `stage`, `message`, and `percent`. Stages are:

- `queued`
- `resolving_target`
- `analyzing_references`
- `generating_concept`
- `formatting_concept_document`
- `done`

Done response includes:

- `requirementDraft`
- `requirementPlan`
- `builderMarkdown`
- `designSpecMarkdown`
- `conceptDocument`
- `plannerProvider`
- `completedAt`

`conceptDocument` is review-only by default and contains top-level Atlas frontmatter with `builderReady: false`, plus the original requirement text, `referenceUrls`, `Builder Markdown`, and `Design Spec Markdown`. It is intended for the user to read and confirm before build. The canonical saved build artifact is still produced later by `/api/builder/lge/v1/draft`.

## RequirementDraft Mapping

The admin UI canonical requirement shape maps into the planner payload as follows:

| requirementDraft | server planner payload |
| --- | --- |
| `mode` | `mode` |
| `changeLevel` | `designChangeLevel` |
| `interventionLayer` | `interventionLayer` |
| `patchDepth` | `patchDepth` |
| `rendererSurface` | `rendererSurface` |
| `builderProvider` | `builderProvider` / `plannerProvider` |
| `journeyMode` | `journeyMode` |
| `journeyId` | `journeyId` |
| `journeyDiscoveryMode` | `journeyDiscoveryMode` |
| `scopePreset` | `scopePreset` |
| `targetScope` | `targetScope` |
| `targetComponents` | `targetComponents` |
| `targetGroupId` | `targetGroupId` |
| `targetGroupLabel` | `targetGroupLabel` |
| `title` | `title`, fallback for `keyMessage` |
| `message` | `requestText`, fallback for `keyMessage` |
| `background` | appended to `requestText` |
| `direction` | `preferredDirection` |
| `tone` | `toneAndMood` |
| `avoid` | `avoidDirection` |
| `refs` | `referenceUrls` |

If Open WebUI sends server payload fields directly, those fields take precedence over nested `requirementDraft` aliases.

## Preflight

Open WebUI Actions should call preflight before the draft endpoint. Use the same bearer token and a draft-like JSON payload:

```bash
curl -X POST http://localhost:3100/api/builder/lge/v1/preflight \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer dev-openwebui-builder-token' \
  -H 'X-OpenWebUI-User-Id: owui-smoke-user' \
  -H 'X-OpenWebUI-Project-Id: owui-smoke-project' \
  --data-binary @data/normalized/sample-openwebui-builder-request-v1.json
```

`ok: true` means the Action may route to `POST /api/builder/lge/v1/draft`:

```json
{
  "ok": true,
  "route": "build",
  "reasonCode": "ok",
  "message": "Builder request is buildable.",
  "buildable": {
    "pageId": "home",
    "viewportProfile": "pc",
    "slots": ["hero", "quickmenu"],
    "componentIds": ["home.hero", "home.quickmenu"]
  },
  "missing": [],
  "unsupported": []
}
```

`ok: false` means the Action should not call the draft endpoint. Route it to feasibility handling and show `message`, `reasonCode`, `missing`, and `unsupported`:

```json
{
  "ok": false,
  "route": "feasibility",
  "reasonCode": "unsupported_viewport",
  "message": "ta viewport is reserved. Use pc or mo.",
  "buildable": {
    "pageId": "home",
    "viewportProfile": "pc",
    "slots": ["hero", "quickmenu"],
    "componentIds": ["home.hero", "home.quickmenu"]
  },
  "missing": [],
  "unsupported": [
    {
      "field": "viewportProfile",
      "value": "ta",
      "supported": ["pc", "mo"]
    }
  ]
}
```

Fixed `reasonCode` values:

- `unsupported_page`
- `unsupported_section`
- `unsupported_viewport`
- `unsupported_component`
- `missing_asset_policy`
- `asset_policy_violation`
- `missing_source_snapshot`
- `concept_too_vague`
- `ok`

`ta` remains accepted by the lower-level draft schema for compatibility, but preflight treats it as not buildable and returns `unsupported_viewport`.

## Sample Request

Use the Phase 0D sample payload:

```bash
curl -X POST http://localhost:3100/api/builder/lge/v1/draft \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer dev-openwebui-builder-token' \
  -H 'X-OpenWebUI-User-Id: owui-smoke-user' \
  -H 'X-OpenWebUI-Project-Id: owui-smoke-project' \
  -H 'X-OpenWebUI-Request-Id: owui-smoke-request-001' \
  --data-binary @data/normalized/sample-openwebui-builder-request-v1.json
```

Response includes:

- `jobId`
- `status: queued`
- `pollUrl`

Poll `pollUrl` until the job response includes:

- `status: done`
- `builderRunId`
- `previewPath`
- `comparePath`
- `previewToken`
- `artifact`
- `artifactRecord`

`previewPath` and `comparePath` include a short-lived read-only preview token, so they do not require the local `clonellm` login cookie.

## Artifact Record

When a job reaches `status: done`, Open WebUI should persist `job.artifactRecord` as the canonical artifact metadata record. The same object is also embedded at `job.artifact.artifactRecord`, with a thinner lookup copy at `job.artifact.metadata`.

The Open WebUI Action returns an `artifact_metadata` wrapper for chat/action UX. That wrapper is not the canonical storage target. If the Action is used, persist `artifact_metadata.artifactRecord`, which is copied from `job.artifactRecord` or `job.artifact.artifactRecord`.

Required storage fields:

- `artifactRecord.schemaVersion: openwebui-builder-artifact-v1`
- `artifactRecord.artifactType: lge-builder-draft`
- `artifactRecord.artifactId`
- `artifactRecord.builderJobId`
- `artifactRecord.builderRunId`
- `artifactRecord.draftBuildId`
- `artifactRecord.pageId`
- `artifactRecord.viewportProfile`
- `artifactRecord.links.previewPath`
- `artifactRecord.links.comparePath`
- `artifactRecord.storage.recommendedRecordKey`
- `artifactRecord.sourceTrace`

Optional pass-through IDs are preserved when present:

- `externalRequirementId`
- `conceptGroupId`
- `conceptThreadId`

`artifactRecord.sourceTrace` and `artifact.sourceTrace` expose the same trace object:

- `source: clonellm-builder-api-v1`
- `conceptDocumentPreserved: true`
- `conceptDocumentSha256`
- `conceptDocumentBytes`
- `externalProjectId`
- `externalRequirementId`
- `externalConceptId`
- `conceptGroupId`
- `conceptThreadId`
- `builderJobId`
- `draftBuildId`
- `snapshotTracePath: artifact.snapshotData.authoringStageTrace`

`artifact` remains the full builder payload for Open WebUI storage or later review. It includes `authoredSectionHtmlPackage`, `snapshotData`, `report`, `validation`, `runtimeAdvisory`, `links`, `storage`, `metadata`, `sourceTrace`, and `artifactRecord`.

Example shape:

```json
{
  "status": "done",
  "builderRunId": "runtime-draft-1777500000000",
  "previewPath": "/runtime-draft/runtime-draft-1777500000000?token=...",
  "comparePath": "/runtime-compare/runtime-draft-1777500000000?token=...",
  "artifactRecord": {
    "schemaVersion": "openwebui-builder-artifact-v1",
    "artifactType": "lge-builder-draft",
    "artifactId": "openwebui-artifact-openwebui-project-concept-runtime-draft-1777500000000",
    "builderJobId": "builder-job-1777500000000-abcd1234",
    "draftBuildId": "runtime-draft-1777500000000",
    "pageId": "home",
    "viewportProfile": "pc",
    "sourceTrace": {
      "source": "clonellm-builder-api-v1",
      "conceptDocumentPreserved": true,
      "conceptDocumentSha256": "abc123...",
      "conceptDocumentBytes": 24000,
      "externalProjectId": "openwebui-project",
      "externalRequirementId": "requirement-id",
      "externalConceptId": "concept",
      "conceptGroupId": "concept-group",
      "conceptThreadId": "ct-123e4567-e89b-42d3-a456-426614174000",
      "builderJobId": "builder-job-1777500000000-abcd1234",
      "draftBuildId": "runtime-draft-1777500000000",
      "snapshotTracePath": "artifact.snapshotData.authoringStageTrace"
    },
    "links": {
      "previewPath": "/runtime-draft/runtime-draft-1777500000000?token=...",
      "comparePath": "/runtime-compare/runtime-draft-1777500000000?token=..."
    },
    "storage": {
      "owner": "open-webui",
      "recommendedRecordKey": "openwebui-artifact-openwebui-project-concept-runtime-draft-1777500000000"
    }
  }
}
```

## Current Limits

- `authorProvider=local` remains available for deterministic smoke checks.
- Open WebUI Action production flow sends `authorProvider=openrouter` with `designAuthorModel=anthropic/claude-sonnet-4.6`; explicit model requests bypass the runtime design-model profile.
- Jobs are in-memory and reset when the process restarts.
- Open WebUI Function/Tool integration is not implemented in this phase.
- Preview token allows read-only draft/compare access only.

## Smoke Test

With the server running:

```bash
OPENWEBUI_BUILDER_BASE_URL=http://localhost:3100 npm run smoke:openwebui-builder
```

Through the public proxy:

```bash
OPENWEBUI_BUILDER_BASE_URL=http://127.0.0.1:3000 npm run smoke:openwebui-builder
```

The smoke checks preflight valid/invalid routing, preview/compare HTML, and that `artifactRecord`, `artifactRecord.sourceTrace`, `artifact.sourceTrace`, `artifact.artifactRecord`, `artifact.metadata`, `artifact.links`, and `artifact.storage` are present and internally consistent.
