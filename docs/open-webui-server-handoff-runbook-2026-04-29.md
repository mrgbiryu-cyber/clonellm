# Open WebUI Server Handoff Runbook (2026-04-29)

## 목적

로컬 Open WebUI를 붙여 서버에 올릴 때 `clonellm`의 구조와 연결점이 바뀌므로, 현재 본선 구조와 이관 경계를 고정한다.

이 문서는 기존 큰 방향 문서인 [`open-webui-core-builder-integration-plan-2026-04-28.md`](./open-webui-core-builder-integration-plan-2026-04-28.md)의 실행용 정리본이다.

## 결론

초기 배포에서는 Open WebUI와 `clonellm`을 합치지 않는다.

```text
Open WebUI = 기획 / 컨셉 / 온톨로지 / 히스토리 / 산출물 관리 core
clonellm  = LGE 전용 builder / runtime preview / compare service
public 3000 proxy = Open WebUI main + clonellm preview/API path routing
```

Open WebUI는 `clonellm`을 내부 builder API로 호출하고, 결과 URL과 artifact를 자기 DB에 저장한다. 공개 `/admin`은 Open WebUI admin으로 유지하고, `clonellm`의 builder debug/admin 화면은 `/builder-admin` prefix로 격리한다.

## 현재 clonellm 본선

### 서비스

- 서버 루트: `/home/mrgbiryu/clonellm`
- 실행: `pm2` apps `openwebui-public-proxy`, `openwebui`, `clonellm`
- 공개 포트: `3000`
- Open WebUI 내부 포트: `127.0.0.1:8080`
- clonellm 내부 포트: `127.0.0.1:3100`
- GCP 외부 URL: `http://34.27.99.82:3000`
- 공개 명칭: `CNS Atlas`
- Open WebUI 모델 provider: OpenRouter (`https://openrouter.ai/api/v1`)
- 환경파일: `/home/mrgbiryu/clonellm/.env`
- 원격 저장소: `https://github.com/mrgbiryu-cyber/clonellm.git`
- 현재 Open WebUI API 브랜치: `openwebui-phase-0a-1-builder-api`

### 사용자가 보는 본선 URL

- Open WebUI Admin: `/admin`
- Builder debug/admin: `/builder-admin` (`/builder-login`, `/builder-admin-research`, `/builder-admin-legacy`)
- 원본 클론: `/clone/:pageId?viewportProfile=pc|mo`
- 생성 미리보기: `/runtime-draft/:draftBuildId?viewportProfile=pc|mo`
- 전후 비교: `/runtime-compare/:draftBuildId?viewportProfile=pc|mo`
- 공개 공유: `/share/:token`, `/share/:token/compare`

Open WebUI에 노출할 기본 URL은 `runtime-draft`, `runtime-compare`, `share`만 사용한다. `/clone`은 원본 확인용으로만 제한하고, `/builder-admin`은 Open WebUI 사용자 플로우에 직접 노출하지 않는다.

## 현재 내부 API 연결점

### 유지할 clonellm workspace API

현재 `web/admin-research.html`이 직접 사용하는 내부 API다. Open WebUI 초기 연동에서는 이 API를 그대로 외부 core로 끌고 가지 않는다.

- `POST /api/workspace/plan`
- `POST /api/workspace/plan-local-preview`
- `POST /api/workspace/build-local-draft`
- `POST /api/workspace/runtime-draft`
- `GET /api/workspace/draft-builds`
- `POST /api/workspace/journey-build`
- `GET /api/workspace/journey-builds`
- `GET /api/workspace/journey-build/:jobId`
- `POST /api/workspace/share-draft`
- `POST /api/workspace/share-version`
- `POST /api/workspace/share-journey-build`

이 API들은 `clonellm admin/debug` 전용으로 유지한다.

### Open WebUI용으로 새로 만들 API

Open WebUI는 workspace 내부 화면 API가 아니라 builder-only API를 호출해야 한다.

```text
POST /api/builder/lge/v1/draft
GET  /api/builder/lge/v1/jobs/:jobId
POST /api/builder/lge/v1/jobs/:jobId/ack
```

초기에는 기존 workspace API를 adapter 내부에서 재사용해도 되지만, Open WebUI가 보는 contract는 위 builder API로 고정한다.

## 책임 경계

### Open WebUI가 소유하는 것

- 프로젝트
- 사용자 요청
- 요구사항 원문
- 컨셉서 원문
- 고객여정 전략
- 온톨로지 / RAG 문서
- 승인 / 반려 / 수정 이력
- 최종 artifact metadata
- 공유 대상 및 업무 히스토리

### clonellm이 소유하는 것

- LGE page/slot/component 해석
- PC/MO viewport별 clone baseline
- asset role policy
- Design Author input 생성
- authored section HTML package
- Tailwind runtime render
- `runtime-draft` / `runtime-compare`
- builder validation/report
- preview cache용 draft sidecar

### 애매하면 이렇게 판단한다

- 의미와 결정은 Open WebUI.
- 렌더링과 LGE 화면 생성은 `clonellm`.
- 저장본의 업무상 최종 소유권은 Open WebUI.
- `clonellm`에 남는 draft는 preview cache와 디버깅 자료.

## 데이터 소유권 전환

### 현재 clonellm 저장소

- 사용자/세션: `data/runtime/users.json`, `data/runtime/sessions.json`
- workspace shard: `data/runtime/workspaces/*`
- draft sidecar: `data/runtime/workspaces/*.draftBuilds.*.json`
- journey build: `data/runtime/journey-builds.json`
- journey flow: `data/runtime/journey-flows.json`
- share link: `data/runtime/share-links.json`

### Open WebUI 붙인 후

Open WebUI가 canonical로 저장해야 하는 최소 단위:

- `externalProjectId`
- `externalRequirementId`
- `externalConceptId`
- `conceptGroupId`
- `conceptThreadId`
- `builderJobId`
- `draftBuildId`
- `pageId`
- `viewportProfile`
- `journeyId`
- `previewUrl`
- `compareUrl`
- `shareUrl`
- `artifact.report`
- `artifact.validation`
- `artifact.authoredSectionHtmlPackage`
- `artifact.snapshotData` 요약

단일 draft job의 `status: done` 응답에서는 `artifactRecord`를 canonical 저장 레코드로 쓴다.
Open WebUI Action이 반환하는 `artifact_metadata`는 채팅/Action 반환용 wrapper이며, canonical 저장 대상은 그 안의 `artifact_metadata.artifactRecord`다.

필수 저장 필드:

- `artifactRecord.schemaVersion`
- `artifactRecord.artifactId`
- `artifactRecord.artifactType`
- `artifactRecord.builderJobId`
- `artifactRecord.builderRunId`
- `artifactRecord.draftBuildId`
- `artifactRecord.pageId`
- `artifactRecord.viewportProfile`
- `artifactRecord.links.previewPath`
- `artifactRecord.links.comparePath`
- `artifactRecord.storage.recommendedRecordKey`
- `artifactRecord.sourceTrace`

동일한 레코드는 `artifact.artifactRecord`에도 들어 있고, 빠른 인덱싱용 요약은 `artifact.metadata`에 들어 있다. `artifactRecord.sourceTrace`와 `artifact.sourceTrace`는 `conceptDocumentPreserved=true`, 외부 ID pass-through, `builderJobId`, `draftBuildId`, `snapshotTracePath=artifact.snapshotData.authoringStageTrace`를 제공한다. Open WebUI는 업무 이력/검색에는 `artifactRecord`와 `artifact.metadata`를 저장하고, 상세 재검토에는 `artifact.report`, `artifact.validation`, `artifact.authoredSectionHtmlPackage`, `artifact.snapshotData`를 보관한다.

`snapshotData.renderedHtmlReference.afterHtml` 전체를 Open WebUI에 저장할지는 2단계에서 결정한다. 1단계에서는 URL + metadata + report 위주로 저장하고, 실제 렌더는 `clonellm` iframe에 맡긴다.

## 인증 / 배포 연결

### 초기 배포 권장

```text
Open WebUI ──internal token──> clonellm builder API
사용자 브라우저 ──Open WebUI──> iframe/runtime URL
```

권장 환경변수:

```bash
CLONELLM_BASE_URL=http://127.0.0.1:3000
CLONELLM_BUILDER_TOKEN=...
OPEN_WEBUI_BASE_URL=...
```

builder API에는 Open WebUI 전용 bearer token을 둔다. 기존 `mrgbiryu` 세션 쿠키에 의존하지 않는다.

### 공개 preview

- 로그인 사용자 내부 확인: `/runtime-draft`, `/runtime-compare`
- 외부 공유: `/share/:token`, `/share/:token/compare`

Open WebUI에서 외부 전달용 링크는 가능하면 `/share`를 저장한다. 로그인 필요한 runtime URL을 외부 공유 링크로 쓰지 않는다.

## PC / MO 처리 원칙

`viewportProfile`은 모든 API payload와 artifact metadata에 반드시 포함한다.

허용값:

```text
pc
mo
```

운영 기준은 현재 `pc`, `mo`다. builder API와 일부 내부 코드가 `ta`를 허용하더라도 `ta`는 reserved/experimental 값으로 보고, Open WebUI 운영 플로우에서는 기본 선택지로 노출하지 않는다.

Open WebUI의 화면 선택, 요구사항, 컨셉서, builder 호출, preview, compare, share metadata가 모두 같은 `viewportProfile`을 가져야 한다.

PC/MO를 한 artifact 안에서 섞지 않는다. 같은 요구사항이라도 PC와 MO는 별도 builder run으로 본다.

## 고객여정 처리 원칙

고객여정은 `interventionLayer=page`일 때만 활성화한다.

Open WebUI가 넘길 필수 값:

- `journeyId`
- `journeyStrategy`
- `journeyFlow.pages[]`
- `sourcePageId`
- `viewportProfile`
- `conceptDocument`

`clonellm`은 각 page를 별도 draft로 생성하고, 여정 위젯과 다음 페이지 링크를 후처리한다.

초기 완료 기준:

- journey job이 `completed`
- 모든 runnable page가 draft를 가진다.
- 각 draft compare URL이 열린다.
- 여정 위젯이 `/runtime-draft`와 `/runtime-compare`에 보인다.
- 마지막 페이지는 next link 없이 widget-only 상태가 된다.

## Open WebUI Function 계약 초안

### 단일 페이지 빌드 요청

```json
{
  "externalProjectId": "openwebui-project-id",
  "externalRequirementId": "requirement-id",
  "externalConceptId": "concept-id",
  "pageId": "care-solutions",
  "viewportProfile": "mo",
  "conceptDocument": "---\\n...\\n---\\n\\n## 컨셉서 원문",
  "target": {
    "interventionLayer": "page",
    "slotIds": [],
    "componentIds": []
  },
  "builderOptions": {
    "authorProvider": "openrouter",
    "modelProfile": "production",
    "rendererSurface": "tailwind"
  }
}
```

### 여정 빌드 요청

```json
{
  "externalProjectId": "openwebui-project-id",
  "externalConceptId": "concept-id",
  "sourcePageId": "care-solutions",
  "viewportProfile": "mo",
  "journeyId": "care-subscription",
  "journeyStrategy": {
    "label": "구매/신청 전환 여정",
    "emphasis": "신뢰, 혜택 이해, 신청 완료"
  },
  "journeyFlow": {
    "journeyId": "care-subscription",
    "pages": [
      { "pageId": "home", "nextPageId": "care-solutions", "ctaLabel": "가전 구독 알아보기" },
      { "pageId": "care-solutions", "nextPageId": "care-solutions-pdp", "ctaLabel": "구독 상품 보기" },
      { "pageId": "care-solutions-pdp", "nextPageId": "checkout", "ctaLabel": "신청하기" },
      { "pageId": "checkout", "nextPageId": "order-complete", "ctaLabel": "신청 완료" },
      { "pageId": "order-complete", "nextPageId": "", "ctaLabel": "완료 후 추천 보기" }
    ]
  },
  "conceptDocument": "컨셉서 원문"
}
```

## 서버 배포 순서

1. `clonellm` 현재 main 배포 상태 고정
2. Open WebUI 로컬 Function에서 `CLONELLM_BASE_URL`로 현재 runtime URL 열기 검증
3. builder-only API adapter 추가
4. Open WebUI Function이 builder-only API 호출
5. Open WebUI가 job polling 결과를 artifact로 저장
6. Open WebUI 화면에서 preview/compare iframe 노출
7. share link 생성 및 외부 접속 검증
8. 이후 Open WebUI 전용 UI 패널 또는 Idea Bench 확장

## 서버 올리기 전 체크리스트

- `pm2 list`에서 `clonellm` online
- `node --check server.js`
- `node --check auth.js`
- `/runtime-compare/:draftBuildId?viewportProfile=mo`가 같은 계정 세션에서 열린다.
- `/share/:token/compare`가 비로그인 상태에서 열린다.
- Open WebUI에서 저장하는 artifact가 `artifactRecord.artifactId`, `pageId`, `viewportProfile`, `draftBuildId`, `links.previewPath`, `links.comparePath`를 모두 가진다.
- builder API 호출에는 Open WebUI token만 쓰고 사용자 PAT나 GitHub token을 섞지 않는다.
- `.env`에 모델/토큰을 넣되 문서와 git에는 값을 남기지 않는다.

## 변경 금지선

초기 Open WebUI 연결 중 아래는 건드리지 않는다.

- `runtime-draft` canonical render
- `runtime-compare` canonical compare
- Tailwind runtime injection
- asset role validation
- PC/MO `viewportProfile` 분리
- `/share` public viewer
- 기존 `/admin` debug flow

이 선을 건드리면 Open WebUI 연결 문제가 아니라 런타임 안정성 문제가 된다. 먼저 별도 브랜치에서 검증한다.

## 다음 코딩 순서

1. Open WebUI에 `integrations/openwebui/lge_builder_action.py` import
2. Open WebUI Function Valves에 `builder_base_url=http://127.0.0.1:3000`, `builder_public_url=http://34.27.99.82:3000` 설정
3. Open WebUI가 다른 서버나 로컬 PC에서 실행되면 Function Valves에 `builder_base_url=http://34.27.99.82:3000`, `builder_public_url=http://34.27.99.82:3000` 설정
4. `OPENWEBUI_BUILDER_SERVICE_TOKEN` 값을 Open WebUI Function과 `clonellm` `.env`에서 동일하게 맞춤
5. Open WebUI에서 action 실행 후 반환된 `previewUrl`, `compareUrl`, `builderRunId`를 artifact로 저장
6. iframe preview/compare 연결
7. share link 생성 버튼 연결
8. journey-build 전용 builder API가 필요해지는 시점에 별도 adapter 추가
9. 운영 모델 profile 복구와 비용 제한값 분리

## 남은 작업 순서 문서

- [Open WebUI Remaining Integration Sequence (2026-04-29)](./open-webui-remaining-integration-sequence-2026-04-29.md)
