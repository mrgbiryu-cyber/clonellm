# Open WebUI Builder API Phase 1

## Scope

This phase exposes a builder-only API in `clonellm` for Open WebUI service calls. Open WebUI UI integration is not included yet.

Implemented endpoints:

- `POST /api/builder/lge/v1/draft`
- `GET /api/builder/lge/v1/jobs/:jobId`
- `POST /api/builder/lge/v1/jobs/:jobId/ack`

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

`previewPath` and `comparePath` include a short-lived read-only preview token, so they do not require the local `clonellm` login cookie.

## Current Limits

- `authorProvider=local` only.
- Jobs are in-memory and reset when the process restarts.
- Open WebUI Function/Tool integration is not implemented in this phase.
- Preview token allows read-only draft/compare access only.

## Smoke Test

With the server running:

```bash
OPENWEBUI_BUILDER_BASE_URL=http://localhost:3100 npm run smoke:openwebui-builder
```
