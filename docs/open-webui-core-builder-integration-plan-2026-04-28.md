# Open WebUI Core / clonellm Builder Integration Plan (2026-04-28)

## 목적

이 문서는 현재 `clonellm` 프로젝트를 Open WebUI 안으로 흡수하는 방향을 정리한 논의용 계획서다.

핵심 방향은 다음과 같다.

> 기획 컨셉서 생성, 문서/정책/히스토리/온톨로지, 산출물 관리는 Open WebUI가 core로 담당하고, `clonellm`은 LGE 사이트 목업을 생성하는 builder engine으로 분리한다.

즉 Open WebUI가 `product workspace / knowledge core / artifact manager`가 되고, `clonellm`은 `LGE-specialized rendering builder`가 된다.

## 배경

현재 `clonellm`의 최종 목적은 단순 화면 클론이 아니다.

- `live reference` 기준 화면 재현
- `slot/component` 단위 편집면
- workspace-ready editing
- LLM-ready editing surface
- LGE 사이트 정책, 자산 역할, 렌더링 정합성 보존

이 목적은 Open WebUI의 채팅/문서/RAG/도구 호출/사용자 관리 구조와 결합하기 좋다.

다만 `clonellm`의 런타임은 아래 제약이 강하다.

- Tailwind runtime parity
- `runtime-draft` / `runtime-compare` canonical render
- asset role policy
- `request -> saved plan -> concept package -> author input` 보존
- preview와 full render의 단일 truth
- legacy URL/UI vocabulary 격리

따라서 Open WebUI가 현재 런타임을 직접 재작성하는 방식은 위험하다. 대신 Open WebUI가 기획/지식/산출물의 소유자가 되고, `clonellm`은 빌드 요청을 받아 실행하는 엔진으로 유지하는 방식이 적합하다.

## 목표 구조

```text
Open WebUI
  - Concept Author
  - Ontology Store
  - Document / Policy / History Search
  - Idea Bench
  - Artifact Manager
  - Review / Approval
       |
       | Builder Request
       v
clonellm Builder
  - LGE policy runtime
  - slot/component registry
  - design-pipeline
  - asset role policy
  - runtime-draft / runtime-compare
       |
       | Build Artifact
       v
Open WebUI
  - stores result
  - manages versions
  - shows preview / compare
```

## 책임 경계

### Open WebUI 책임

- 기획자 UI
- 요구사항 입력
- 기획 컨셉서 생성
- LGE 정책 / 기존 문서 / 아이디어 히스토리 / 디자인 히스토리 저장
- 온톨로지 및 RAG 검색
- 아이디어 벤치
- 빌드 요청 생성
- 생성 결과물의 canonical 저장
- 버전 관리
- 승인 / 보류 / 수정 요청 관리
- 사용자 / 프로젝트 / 권한 관리

### clonellm 책임

- Open WebUI가 넘긴 컨셉서와 빌드 요청을 해석
- LGE 사이트의 `page / slot / component` 맥락 연결
- asset role policy 적용
- Design Author input 생성
- authored section package 생성
- runtime draft 렌더링
- before/after compare 생성
- 빌드 리포트 및 validation 결과 반환

### 원칙

Open WebUI가 의미와 기록의 source of truth다.

`clonellm`은 컨셉서 의미를 새로 판단하거나 재요약하는 core가 아니라, 전달받은 컨셉을 LGE 렌더링 시스템에 맞게 실행하는 builder다.

## 사용자 Flow

1. 기획자가 Open WebUI에서 `LGE Site` 프로젝트를 연다.
2. 요구사항, 참고 문서, 캠페인 방향, 정책 문서를 등록한다.
3. Open WebUI가 기존 문서/정책/히스토리를 검색한다.
4. Open WebUI가 기획 컨셉서를 생성한다.
5. 기획자는 컨셉서를 검토하고 아이디어 벤치에서 후보를 비교한다.
6. 선택한 컨셉으로 `목업 생성`을 요청한다.
7. Open WebUI가 `clonellm` builder API를 호출한다.
8. `clonellm`이 LGE 목업을 생성한다.
9. `clonellm`이 draft id, preview path, compare path, authored package, report를 반환한다.
10. Open WebUI가 결과물을 artifact로 저장한다.
11. 사용자는 Open WebUI 안에서 preview/compare를 확인한다.
12. 승인, 보류, 수정 요청이 다시 Open WebUI 히스토리와 온톨로지에 저장된다.

## 온톨로지 초안

### 주요 엔티티

```text
Project
Document
Policy
Requirement
ConceptDocument
DesignIdea
Decision
DesignHistory
Page
Slot
Component
Asset
AssetRole
BuilderRun
DraftBuild
RuntimePreview
Evaluation
Artifact
UserWorkspace
```

### 주요 관계

```text
Requirement -> references -> Document
Requirement -> targets -> Page / Slot / Component
Policy -> constrains -> Slot / Component / AssetRole
ConceptDocument -> derived_from -> Requirement
DesignIdea -> derived_from -> ConceptDocument
DesignIdea -> uses -> Policy / History / Benchmark
BuilderRun -> executes -> ConceptDocument
BuilderRun -> targets -> Page / Slot / Component
DraftBuild -> generated_from -> BuilderRun
DraftBuild -> renders -> RuntimePreview
Evaluation -> reviews -> DraftBuild
Decision -> accepts/rejects -> DesignIdea / DraftBuild
Artifact -> stores -> DraftBuild / Report / AuthoredPackage
```

## Builder API 제안

현재 `clonellm`에는 다음 경계가 있다.

- `POST /api/workspace/plan`
- `POST /api/workspace/build-local-draft`
- `POST /api/workspace/runtime-draft`
- `/runtime-draft/:draftBuildId`
- `/runtime-compare/:draftBuildId`

Open WebUI를 core로 삼으려면 workspace 내부 저장을 전제로 한 API와 별도로, builder-only API를 추가하는 것이 좋다.

### Draft 생성

```http
POST /api/builder/lge/draft
```

요청 예시:

```json
{
  "externalProjectId": "openwebui-project-id",
  "externalConceptId": "concept-id",
  "pageId": "home",
  "viewportProfile": "pc",
  "conceptDocument": "기획 컨셉서 Markdown 원문",
  "conceptPackage": {
    "title": "홈 상단 프리미엄 경험 강화",
    "targetGroup": {
      "groupId": "home-top",
      "groupLabel": "Home Top",
      "slotIds": ["hero", "quickmenu"],
      "componentIds": ["home.hero", "home.quickmenu"]
    },
    "designPolicy": {
      "mustKeep": [],
      "mustChange": [],
      "guardrails": []
    }
  },
  "builderOptions": {
    "rendererSurface": "tailwind",
    "designChangeLevel": "medium",
    "patchDepth": "medium",
    "interventionLayer": "section-group",
    "authorProvider": "local"
  }
}
```

응답 예시:

```json
{
  "ok": true,
  "builderRunId": "runtime-draft-1776875630802",
  "previewPath": "/runtime-draft/runtime-draft-1776875630802",
  "comparePath": "/runtime-compare/runtime-draft-1776875630802",
  "artifact": {
    "pageId": "home",
    "viewportProfile": "pc",
    "authoredSectionMarkdownDocument": "...",
    "authoredSectionHtmlPackage": {},
    "snapshotData": {},
    "report": {},
    "validation": {}
  }
}
```

## Artifact 저장 원칙

Open WebUI가 canonical artifact 저장소다.

`clonellm`은 아래 정보를 반환한다.

- builder run id
- preview path
- compare path
- page id
- viewport profile
- target group
- authored section markdown document
- authored section html package
- rendered html reference
- snapshot data
- validation report
- runtime advisory

Open WebUI는 이 정보를 자기 DB/스토리지에 저장한다.

`clonellm`에 남는 정보는 실행 캐시, preview를 열기 위한 draft, debugging trace 정도로 제한한다.

## Preview 전략

### 1단계

Open WebUI에서 `clonellm`의 `/runtime-draft/:id`와 `/runtime-compare/:id`를 iframe 또는 별도 panel로 보여준다.

이 단계에서는 `clonellm` 렌더링 경로를 유지한다.

### 2단계

`clonellm`이 static artifact bundle을 반환한다.

Open WebUI가 HTML/CSS/assets bundle을 저장하고 자체 artifact viewer로 보여준다.

### 3단계

Open WebUI의 artifact viewer에서 승인/댓글/수정 요청이 바로 ontology와 history에 연결된다.

## 구현 단계

### Phase 1: Builder API 분리

- `clonellm`에 `POST /api/builder/lge/draft` 추가
- 기존 `build-local-draft` 내부 로직을 재사용하되, Open WebUI 외부 concept input을 받을 수 있게 adapter 작성
- concept 원문을 재요약하지 않고 보존
- 응답에 Open WebUI가 저장할 artifact payload 포함

### Phase 2: Open WebUI Tool/Pipeline 연결

- Open WebUI에서 LGE builder tool 추가
- concept document와 target metadata를 builder API로 전달
- 응답 artifact를 Open WebUI에 저장
- preview/compare link를 결과물 카드로 노출

### Phase 3: Idea Bench

- 요구사항별 관련 문서/정책/히스토리 검색
- 후보 컨셉 여러 개 생성
- 후보별 target page/slot/component 연결
- 후보별 builder run 실행
- 결과 비교 및 승인 흐름 추가

### Phase 4: Ontology Store

- 문서, 정책, 요구사항, 컨셉, 아이디어, draft, evaluation, decision을 graph 형태로 연결
- vector search와 graph traversal을 함께 사용
- 예: "quickmenu 관련 과거 실패와 현재 asset policy를 같이 보여줘"

### Phase 5: Artifact Ownership 전환

- `clonellm` preview 의존도를 줄이고 Open WebUI artifact viewer로 이동
- `clonellm`은 preview generation service로만 남김
- 산출물 lifecycle은 Open WebUI에서 관리

## 반드시 지켜야 할 guardrails

### 렌더 정합성

- authored Tailwind HTML은 Tailwind runtime에서 렌더해야 한다.
- full after / section preview / compare는 같은 rendered truth를 봐야 한다.
- Open WebUI viewer로 이동하더라도 Tailwind runtime parity가 깨지면 안 된다.

### 원문 보존

- Open WebUI에서 생성한 `conceptDocument`는 원문으로 보존한다.
- `clonellm`은 concept 의미를 임의로 축약하거나 재해석하지 않는다.
- `conceptDocument -> conceptPackage -> authorInput -> draft` trace가 남아야 한다.

### Asset role

- hero/stage full-bleed는 `background-only` 정책을 지킨다.
- quickmenu는 `icon-only family` 정책을 지킨다.
- `promo-complete` 자산을 배경이나 아이콘 대체로 재사용하지 않는다.

### Legacy 격리

- 기본 preview는 `/runtime-draft/:draftBuildId`와 `/runtime-compare/:draftBuildId`를 사용한다.
- `/clone?...draftBuildId=...` 같은 legacy path는 Open WebUI의 본선 UI에 노출하지 않는다.

### Ownership

- 기획/컨셉/결정/산출물의 canonical source는 Open WebUI다.
- LGE 렌더링/목업 생성의 canonical builder는 `clonellm`이다.

## 리스크

### Open WebUI 포크 유지보수

Open WebUI 프론트를 많이 수정하면 upstream update 충돌이 커진다.

초기에는 Tool/Pipeline과 custom page 최소 확장으로 시작하는 것이 좋다.

### Artifact 이중 저장

Open WebUI와 `clonellm` 양쪽에 draft가 저장되면 source of truth가 흔들릴 수 있다.

canonical artifact는 Open WebUI로 정하고, `clonellm` 저장은 preview cache로 정의해야 한다.

### Concept schema drift

Open WebUI가 만든 concept package와 `clonellm`의 `buildConceptPackageFromRequirementPlan()` 기대 shape가 어긋날 수 있다.

builder-only adapter에서 schema contract를 고정해야 한다.

### Preview portability

Open WebUI artifact viewer로 옮길 때 Tailwind runtime, asset URL, interaction runtime이 빠지면 화면이 깨질 수 있다.

1단계에서는 iframe preview를 유지하고, static export는 별도 검증 후 진행한다.

## Claude와 논의할 질문

1. Open WebUI를 포크해서 전용 `LGE Workbench` 페이지를 추가할지, 우선 Tool/Pipeline만으로 시작할지?
2. `conceptDocument`의 canonical format은 Markdown-only로 둘지, Markdown + JSON sidecar로 둘지?
3. ontology store는 Open WebUI 내부 DB 확장으로 갈지, 외부 graph/vector DB를 붙일지?
4. `clonellm` builder API는 인증을 Open WebUI token으로 받을지, 내부 네트워크 전용으로 둘지?
5. Open WebUI가 저장해야 하는 artifact 최소 단위는 어디까지인가?
6. preview는 언제까지 `clonellm` iframe에 의존하고, 언제 static artifact viewer로 전환할 것인가?
7. 기존 `clonellm` workspace 기능은 유지할지, Open WebUI 전환 후 admin-only debug mode로 격리할지?

## 잠정 결론

현재 방향은 타당하다.

가장 안전한 구조는 다음이다.

```text
Open WebUI = 기획 컨셉서 / 온톨로지 / 아이디어 벤치 / 산출물 관리 core
clonellm = LGE 사이트 목업 생성 builder engine
```

다음 작업은 `clonellm`에 Open WebUI 전용 builder-only API를 추가하고, Open WebUI에서 해당 API를 호출해 artifact를 저장하는 최소 흐름을 만드는 것이다.

---

## 검토 추가 (2026-04-28)

위 설계는 구조, 책임 경계, guardrails, 리스크 모두 타당하다. 아래는 열린 질문에 대한 답변과 설계에서 누락된 5개 항목을 추가한다.

---

### 열린 질문 답변

**질문 1 — 포크 vs Tool/Pipeline만으로 시작**

Phase 1-2는 포크 없이 Open WebUI **Function**(서버사이드 Python)으로 시작한다. Open WebUI의 Tool/Function/Pipeline 세 가지는 다음과 같이 구분된다.

| 방식 | 실행 위치 | 적합한 용도 |
|---|---|---|
| **Tool** | LLM이 호출 결정 | 대화 중 LLM이 판단해서 실행할 기능 |
| **Function** | 서버사이드 Python | 확실한 사이드이펙트 (빌드 호출, DB 저장) |
| **Pipeline** | 미들웨어 체인 | 요청/응답 변환, RAG 전처리 |

`clonellm` builder 호출은 **Function**으로 구현한다. LLM이 "부를지 말지" 판단하게 두면 빌드가 누락되거나 중복된다. 기획자가 명시적으로 "목업 생성" 버튼을 누르거나 채팅에서 특정 의도를 표현하면 Function이 직접 실행된다.

포크가 필요한 시점은 Phase 3 이후 Idea Bench 전용 UI 패널이 필요할 때다.

**질문 2 — conceptDocument 포맷**

**YAML frontmatter + Markdown body**를 canonical format으로 권고한다. 별도 JSON sidecar는 파일 두 개를 동기화해야 하는 부담이 생긴다.

```markdown
---
conceptId: concept-20260428-home-premium
projectId: lge-home-2026-q2
pageId: home
targetGroup: home-top
slots: [hero, quickmenu]
tone: premium
patchDepth: medium
status: draft
createdAt: 2026-04-28
---

## 컨셉 요약

홈 상단 프리미엄 경험 강화를 위해 hero 영역의 ...

## 디자인 방향

...

## 제약 조건

- mustKeep: ...
- mustChange: ...
```

YAML frontmatter는 clonellm adapter에서 파싱해 `conceptPackage`로 변환한다. Markdown body는 원문 그대로 `conceptDocument` 필드로 넘긴다.

---

### 추가 1 — 비동기 빌드 API 패턴

현재 builder API 제안은 동기 응답을 전제한다. 실제 빌드는 30-90초가 소요될 수 있으므로 **async/polling 패턴**이 필요하다.

#### 흐름

```text
POST /api/builder/lge/draft
  → 즉시 응답: { ok: true, jobId: "job-xxx", status: "queued" }

GET /api/builder/lge/jobs/:jobId
  → status: "queued" | "running" | "done" | "failed"
  → done 시 artifact payload 포함
```

#### 요청/응답 예시

```http
POST /api/builder/lge/draft
```

즉시 응답:

```json
{
  "ok": true,
  "jobId": "job-17768756",
  "status": "queued",
  "pollUrl": "/api/builder/lge/jobs/job-17768756"
}
```

폴링 응답 (done):

```json
{
  "ok": true,
  "jobId": "job-17768756",
  "status": "done",
  "builderRunId": "runtime-draft-1776875630802",
  "previewPath": "/runtime-draft/runtime-draft-1776875630802",
  "comparePath": "/runtime-compare/runtime-draft-1776875630802",
  "artifact": { ... }
}
```

Open WebUI Function은 폴링 루프를 내부적으로 돌리거나, 빌드 완료 후 Open WebUI에 결과를 push하는 webhook endpoint를 별도로 둔다.

#### Webhook (선택)

```http
POST /api/builder/lge/draft
body: { ..., "webhookUrl": "https://openwebui.internal/api/builder-callback" }
```

`clonellm`이 빌드 완료 시 `webhookUrl`로 artifact payload를 POST한다. Open WebUI는 해당 채팅 세션에 결과를 주입한다.

---

### 추가 2 — Knowledge Base 컬렉션 설계

Open WebUI의 RAG Knowledge Base는 컬렉션 단위로 구성된다. LGE 온톨로지 엔티티를 아래 컬렉션으로 매핑한다.

| 컬렉션 이름 | 포함 문서 유형 | 주요 태그 |
|---|---|---|
| `lge-policy` | LGE 사이트 정책, asset role 정책, 렌더 guardrails | `#policy`, `#asset-role`, `#guardrail` |
| `lge-design-history` | 과거 빌드 결과, 승인/기각 이력, 디자인 변경 이력 | `#history`, `#decision`, `#pageId` |
| `lge-idea-archive` | 기획 아이디어, 컨셉 후보, 벤치마크 레퍼런스 | `#idea`, `#benchmark`, `#tone` |
| `lge-requirements` | 요구사항 문서, 캠페인 브리프, 기획서 | `#requirement`, `#campaign`, `#quarter` |
| `lge-component-spec` | slot/component 스펙, section family contracts | `#component`, `#slot`, `#pageId` |

#### 문서 메타데이터 스키마

각 문서는 업로드 시 아래 메타데이터를 함께 등록한다.

```json
{
  "collection": "lge-design-history",
  "pageId": "home",
  "slots": ["hero", "quickmenu"],
  "date": "2026-04-15",
  "decision": "approved",
  "tags": ["#premium", "#hero", "#history"]
}
```

이 메타데이터를 기반으로 "quickmenu 관련 과거 실패 사례만 보여줘" 같은 필터링 쿼리가 가능해진다.

#### Phase 4 Graph 확장 시점

vector search만으로는 관계 탐색이 약하다. `DesignIdea -> derived_from -> Requirement` 같은 관계 쿼리가 자주 필요해지는 시점 (Phase 3 이후)에 외부 graph DB (Neo4j Aura 또는 Weaviate hybrid)를 붙인다. 초기에는 Open WebUI 내부 ChromaDB로 충분하다.

---

### 추가 3 — Schema Contract Enforcement

"Concept schema drift" 리스크에 대한 구체적인 미티게이션이다.

#### 어댑터 레이어에 JSON Schema 고정

`clonellm`의 builder-only API 어댑터 입구에서 inbound concept payload를 JSON Schema로 검증한다.

```
/api/builder/lge/draft
  → validateConceptPayload(body)   ← JSON Schema 검증
  → adaptConceptToBuilderInput()   ← clonellm 내부 shape으로 변환
  → runBuilderV2()
```

Open WebUI Function이 만드는 payload shape과 clonellm이 기대하는 shape을 이 어댑터에서만 맞춘다. 양쪽이 직접 의존하지 않는다.

#### Schema 버전 관리

API 경로에 버전을 포함한다.

```
/api/builder/lge/v1/draft
```

Open WebUI Function은 `builderApiVersion: "v1"` 을 명시한다. clonellm이 schema를 변경할 때 v2를 추가하고 v1을 유지 기간 동안 병행한다.

---

### 추가 4 — Idea Bench 병렬 빌드 상세

Phase 3의 Idea Bench는 단순 목록이 아니라 **병렬 빌드 + 나란히 비교** 구조가 핵심이다.

#### 흐름

```text
기획자: 컨셉 후보 A, B, C 각각 생성
  → Open WebUI: 세 개 빌드 요청을 병렬로 실행
      POST /api/builder/lge/v1/draft  (jobId-A)
      POST /api/builder/lge/v1/draft  (jobId-B)
      POST /api/builder/lge/v1/draft  (jobId-C)
  → 세 개 job 완료 후 Open WebUI가 Idea Bench 패널 구성
  → 기획자: A / B / C preview를 나란히 보면서 비교
  → 선택 → Decision 엔티티로 온톨로지에 저장
```

#### Open WebUI 구현 방식

Phase 3에서는 Open WebUI를 포크해 `LGE Idea Bench` 전용 페이지를 추가한다. 이 페이지는:

- 세 개 이상의 iframe preview를 grid로 배치
- 각 후보에 vote / approve / reject 버튼
- 선택 이유를 텍스트로 입력 → `Decision` 엔티티로 저장
- 비교 결과가 `lge-design-history` 컬렉션에 자동 추가

---

### 추가 5 — 승인 후 핸드오프 경로

현재 flow는 승인(approval)에서 끊긴다. 승인 후 개발팀 전달까지 이어져야 한다.

#### 핸드오프 artifact 패키지

Open WebUI가 승인 결정 시 아래 항목을 패키징한다.

```text
handoff-package/
  concept-document.md          ← YAML frontmatter + Markdown 원문
  authored-section.md          ← clonellm이 반환한 authored markdown
  authored-html/               ← authored section HTML package
  preview-snapshot.png         ← 승인 시점 visual snapshot
  builder-report.json          ← validation, runtime advisory
  decision.json                ← 승인자, 승인 시각, 선택 이유
```

#### 전달 방식 (단계별)

| 단계 | 방식 |
|---|---|
| Phase 1-2 | Open WebUI에서 핸드오프 패키지 zip 다운로드 |
| Phase 3 | GitHub/GitLab PR 자동 생성 (Open WebUI Pipe로 처리) |
| Phase 4+ | clonellm에 `POST /api/builder/lge/v1/publish` 추가 → 승인된 authored package를 workspace에 반영하고 production export |

#### 핸드오프와 온톨로지 연결

```text
Decision (approved)
  → triggers → Handoff
  → Handoff → references → Artifact, AuthoredPackage, ConceptDocument
  → Handoff → status: delivered | pending | blocked
```

이 연결로 "이 디자인이 실제 반영됐는지" 를 온톨로지에서 추적할 수 있다.

## Codex 검토 — Claude 보강안 수용 / 보정 (2026-04-28)

Claude의 `검토 추가` 섹션은 전체 방향과 대부분 일치한다.

아래는 바로 수용할 항목, 보정이 필요한 항목, MVP에서 고정할 결정을 나눈 것이다.

### 1. 수용 항목

#### 1.1 Phase 1-2는 Open WebUI 포크 없이 시작

수용한다.

초기에는 Open WebUI 프론트를 포크하지 않고, Function / Action / API 호출 기반으로 `clonellm` builder를 연결한다.

이유:

- Open WebUI upstream update 충돌을 줄일 수 있다.
- builder API contract를 먼저 안정화할 수 있다.
- 실제 기획자가 "목업 생성"을 반복적으로 쓰는 흐름이 검증되기 전까지 전용 UI를 만들 필요가 없다.

단, 용어는 더 구체화해야 한다.

Open WebUI의 Function은 Pipe / Filter / Action으로 나뉘므로, "목업 생성 버튼"은 기본적으로 **Action Function** 또는 Open WebUI backend extension에 가깝다.

LLM이 임의로 호출하는 Tool에만 맡기지 않는다.

#### 1.2 YAML frontmatter + Markdown body conceptDocument

수용한다.

기획 컨셉서의 canonical authoring format은 사람이 읽고 수정하기 쉬워야 하므로 YAML frontmatter + Markdown body가 적절하다.

예:

```markdown
---
conceptId: concept-20260428-home-premium
projectId: lge-home-2026-q2
pageId: home
targetGroup: home-top
slots: [hero, quickmenu]
tone: premium
patchDepth: medium
status: draft
createdAt: 2026-04-28
---

## 컨셉 요약

...
```

보완:

- Open WebUI는 Markdown 원문을 보존한다.
- 동시에 frontmatter를 파싱한 normalized metadata JSON도 저장한다.
- builder API에는 원문 `conceptDocument`와 normalized `conceptPackage`를 함께 전달한다.

즉 원문과 구조화 데이터를 둘 다 유지한다.

#### 1.3 Async builder job API

수용한다.

`clonellm` 빌드는 Design Author, asset resolution, runtime render, validation을 포함할 수 있어 동기 응답에 적합하지 않다.

MVP API는 아래 형태를 기본으로 한다.

```text
POST /api/builder/lge/v1/draft
  -> { ok: true, jobId, status: "queued", pollUrl }

GET /api/builder/lge/v1/jobs/:jobId
  -> { status: "queued" | "running" | "done" | "failed" }
```

`done` 상태에서 preview path, compare path, artifact payload를 반환한다.

#### 1.4 Knowledge Base 컬렉션 설계

수용한다.

초기에는 Open WebUI 내부 Knowledge Base를 사용하고, 컬렉션은 다음 기준으로 나눈다.

```text
lge-policy
lge-design-history
lge-idea-archive
lge-requirements
lge-component-spec
```

이 분리는 기획자 질의와 builder handoff 양쪽에 유용하다.

예:

- "quickmenu 관련 과거 실패 사례"
- "hero asset role policy"
- "home top accepted design history"
- "category TV PDP component spec"

초기에는 vector / hybrid search로 충분하다.

Graph DB는 Phase 3 이후 관계 쿼리가 실제 병목이 될 때 붙인다.

#### 1.5 Schema contract / versioning

수용한다.

`clonellm` builder-only API는 버전 경로를 사용한다.

```text
/api/builder/lge/v1/draft
/api/builder/lge/v1/jobs/:jobId
```

Open WebUI Function은 `builderApiVersion: "v1"`을 명시한다.

`clonellm`은 API 입구에서 JSON Schema 검증을 수행하고, 내부 shape 변환은 adapter 레이어에서만 한다.

Open WebUI와 `clonellm`이 서로의 내부 데이터 구조에 직접 의존하지 않게 한다.

#### 1.6 Handoff package

수용한다.

승인 후 개발팀 전달까지 이어지려면 handoff package가 필요하다.

초기 handoff package:

```text
handoff-package/
  concept-document.md
  concept-metadata.json
  authored-section.md
  authored-html-package.json
  preview-snapshot.png
  builder-report.json
  decision.json
```

Phase 1-2에서는 zip 다운로드를 우선한다.

GitHub/GitLab PR 자동 생성은 Phase 3 이후로 미룬다.

### 2. 보정 항목

#### 2.1 Function / Tool / Pipeline 역할 재정의

Claude의 "builder 호출은 Function" 판단은 방향상 맞지만, 실제 구현에서는 역할을 더 분리해야 한다.

정리:

| 역할 | 사용처 | MVP 적용 |
|---|---|---|
| Tool | LLM이 대화 중 참고 데이터 조회 또는 제한된 외부 호출 | 보조 |
| Action Function | 사용자가 명시적으로 버튼을 눌러 builder 실행 | 핵심 |
| Pipe Function | LGE 전용 agent/model처럼 동작하는 고정 흐름 | 선택 |
| Pipeline | 요청/응답 전처리, 별도 inference chain | MVP 제외 |
| Open WebUI forked page | Idea Bench 전용 UI | Phase 3 이후 |

MVP에서는 `Action Function + builder API polling`을 기준으로 한다.

LLM이 "빌드할지 말지"를 판단하게 두지 않는다.

사용자가 `목업 생성`을 명시적으로 실행해야 한다.

#### 2.2 Webhook은 MVP에서 제외

Claude는 webhook option을 제안했다.

방향은 타당하지만 MVP에서는 제외한다.

이유:

- Open WebUI 내부 callback endpoint와 세션 주입 방식 확인이 필요하다.
- 인증, retry, 중복 callback, 실패 처리까지 같이 설계해야 한다.
- 초기에는 polling이 단순하고 디버깅 가능하다.

MVP:

```text
Open WebUI Action Function
  -> POST builder draft
  -> jobId 수신
  -> GET job status polling
  -> done artifact 수신
  -> 채팅 메시지 / artifact card / 링크로 표시
```

Webhook은 Phase 2.5 또는 Phase 3에서 추가한다.

#### 2.3 Markdown 원문만으로는 부족

YAML frontmatter + Markdown body는 authoring canonical format으로 좋다.

하지만 검색, 필터링, builder handoff, artifact relation에는 normalized metadata가 필요하다.

따라서 Open WebUI 저장 단위는 다음처럼 잡는다.

```json
{
  "conceptDocument": "원문 Markdown",
  "conceptMetadata": {
    "conceptId": "concept-20260428-home-premium",
    "projectId": "lge-home-2026-q2",
    "pageId": "home",
    "targetGroup": "home-top",
    "slots": ["hero", "quickmenu"],
    "patchDepth": "medium",
    "status": "draft"
  },
  "conceptPackage": {
    "title": "...",
    "targetGroup": {},
    "designPolicy": {}
  }
}
```

`conceptDocument`는 보존 원문이고, `conceptMetadata`와 `conceptPackage`는 실행과 검색을 위한 projection이다.

#### 2.4 Idea Bench 포크 시점은 늦춘다

Claude는 Phase 3에서 Open WebUI를 포크해 `LGE Idea Bench` 전용 페이지를 추가하자고 했다.

방향은 맞지만, 포크는 다음 조건이 충족된 뒤 진행한다.

- builder API v1이 안정적이다.
- 단일 concept -> draft 생성이 반복적으로 성공한다.
- artifact card / preview link 기반 workflow가 실제로 사용된다.
- 2개 이상 concept 후보를 병렬 비교하는 요구가 자주 발생한다.
- iframe preview의 session/auth 문제가 정리된다.

그 전까지는 채팅 메시지, artifact card, preview/compare link만으로 충분하다.

#### 2.5 Static artifact viewer는 후순위

Open WebUI 자체 artifact viewer로 HTML/CSS/assets bundle을 렌더하는 방향은 좋다.

하지만 `clonellm`의 current runtime은 Tailwind runtime, interaction runtime, asset URL rewriting, canonical rendered truth에 강하게 의존한다.

따라서 MVP에서는 `clonellm`의 `/runtime-draft/:id`와 `/runtime-compare/:id`를 그대로 사용한다.

Static export / Open WebUI native artifact viewer는 다음 검증 뒤 진행한다.

- Tailwind runtime parity 유지
- interaction runtime 포함
- asset URL portability
- before/after compare parity
- preview snapshot과 exported artifact의 visual diff

### 3. MVP 고정안

MVP는 아래 흐름으로 고정한다.

```text
Open WebUI
  1. 기획자 요구사항 입력
  2. Knowledge Base 검색
  3. conceptDocument 생성
  4. conceptMetadata / conceptPackage projection 생성
  5. 사용자가 "목업 생성" 실행
       |
       v
clonellm
  6. POST /api/builder/lge/v1/draft
  7. job queue 등록
  8. Design Author / runtime render 실행
  9. artifact 생성
       |
       v
Open WebUI
  10. GET /api/builder/lge/v1/jobs/:jobId polling
  11. done artifact 수신
  12. previewPath / comparePath 표시
  13. artifact metadata 저장
  14. 승인/보류/수정 요청 기록
```

### 4. MVP에서 제외

아래는 MVP에서 제외한다.

- Open WebUI 프론트 포크
- LGE Idea Bench 전용 페이지
- webhook callback
- GitHub/GitLab PR 자동 생성
- external graph DB
- Open WebUI native static artifact viewer
- production publish API

### 5. 다음 구현 순서

1. `clonellm` builder API v1 schema 정의
2. `POST /api/builder/lge/v1/draft` job 생성 API 추가
3. `GET /api/builder/lge/v1/jobs/:jobId` status API 추가
4. 기존 `build-local-draft` 로직을 builder adapter 뒤에서 재사용
5. conceptDocument + conceptPackage 보존 trace 추가
6. artifact payload 최소 필드 확정
7. Open WebUI Action Function 초안 작성
8. Open WebUI Knowledge 컬렉션 초기 구성
9. 단일 concept -> draft -> preview/compare loop 검증

### 6. Claude 재검토 요청

다음 검토에서는 일반론보다 아래 항목을 중심으로 확인한다.

1. `Action Function + polling`을 MVP 기본으로 두는 결정이 Open WebUI 구현 현실에 맞는가?
2. `conceptDocument`를 YAML frontmatter + Markdown body로 두고, `conceptMetadata`와 `conceptPackage`를 projection으로 저장하는 구조가 적절한가?
3. `/api/builder/lge/v1/draft`와 `/api/builder/lge/v1/jobs/:jobId` 두 API만으로 Phase 1 loop가 충분한가?
4. Open WebUI를 canonical artifact owner로 두면서도 `clonellm` preview cache를 유지하는 ownership 경계가 안전한가?
5. MVP 제외 항목 중 반드시 앞당겨야 하는 것이 있는가?

---

## Claude 재검토 (2026-04-28)

### Codex 재검토 요청 5개 답변

**Q1. Action Function + polling이 Open WebUI 구현 현실에 맞는가?**

맞다. Open WebUI의 Action Function은 채팅 메시지 아래 버튼으로 노출되므로, 기획자가 "목업 생성"을 명시적으로 누르는 UX에 정확히 대응한다. 단, Open WebUI의 Action Function은 동기 응답을 기다리므로 polling 루프를 Function 내부에서 돌려야 한다. 빌드가 90초 이상 걸리면 Open WebUI의 HTTP timeout에 걸린다. 이를 피하기 위해 Function 내부 polling은 `max_wait=120s`, 초과 시 "빌드 진행 중" 메시지를 반환하고 별도 "결과 확인" Action으로 분리하는 구조를 권고한다.

```text
Action: 목업 생성
  → POST /api/builder/lge/v1/draft → jobId 수신
  → polling loop (max 120s)
  → done → preview/compare 링크 채팅에 삽입
  → timeout → "빌드 진행 중. jobId: {id}" 메시지 반환

Action: 빌드 결과 확인 (jobId 입력)
  → GET /api/builder/lge/v1/jobs/:jobId
  → done → preview/compare 링크 채팅에 삽입
```

**Q2. YAML frontmatter + Markdown body + conceptMetadata projection 구조가 적절한가?**

적절하다. 단 하나를 추가한다. Open WebUI가 conceptDocument를 Knowledge Base에 등록할 때 frontmatter를 파싱해 `lge-requirements` 컬렉션의 메타데이터로도 인덱싱해야 한다. 그래야 "2026 Q2 home 기획서 중 premium tone" 같은 쿼리가 RAG 검색에서 작동한다. 즉 authoring 포맷과 RAG 인덱스 포맷을 동시에 만족하는 구조다.

**Q3. 두 API(draft + jobs)만으로 Phase 1 loop가 충분한가?**

충분하다. 단 **선결 조건**이 하나 있다 — iframe 인증 문제(아래 추가 6). 이걸 해결하지 않으면 MVP flow의 12단계(preview 표시)가 동작하지 않는다. 두 API가 완성돼도 preview 링크를 클릭하면 clonellm 인증 화면이 뜰 수 있다.

**Q4. Open WebUI canonical owner + clonellm preview cache 경계가 안전한가?**

안전하되, **TTL 정책**이 명시돼야 한다. clonellm draft cache는 7일 TTL을 기본으로 한다. 7일 이후에는 preview URL이 만료되고, Open WebUI에 저장된 artifact(HTML package, snapshot)만 남는다. 이 만료 정책이 없으면 clonellm의 `data/runtime/` 디렉토리가 무기한 증가한다. 또한 ownership 경계의 취약점이 있다: Open WebUI가 artifact를 저장하기 전에 네트워크 오류가 발생하면 clonellm에는 draft가 있지만 Open WebUI에는 아무것도 없는 상태가 된다. 이를 위해 job 완료 직후 Open WebUI가 artifact 저장 완료를 clonellm에 confirm하는 `POST /api/builder/lge/v1/jobs/:jobId/ack` 엔드포인트를 추가하는 것을 권고한다.

**Q5. MVP 제외 항목 중 반드시 앞당겨야 하는 것이 있는가?**

**iframe 인증 처리**는 앞당겨야 한다. 이것은 MVP flow의 blocking 항목이다. 나머지 제외 항목(포크, webhook, graph DB, static viewer, publish API)은 현재 순서가 맞다.

---

### 추가 6 — iframe 인증 문제 (MVP blocking 선결항목)

MVP flow 12단계 "previewPath / comparePath 표시"는 clonellm의 `/runtime-draft/:id`를 iframe으로 보여주는 것을 전제한다. 그런데 현재 clonellm의 `auth.js`는 `lge_workspace_session` 쿠키 기반 인증을 사용한다. Open WebUI에서 열리는 iframe은 이 쿠키가 없어서 빈 화면이나 인증 오류가 뜰 수 있다.

#### 해결 옵션 세 가지

| 옵션 | 방법 | 장단점 |
|---|---|---|
| **A. 서명된 preview token** | draft 생성 시 단기 token 발급, URL에 포함: `/runtime-draft/:id?token=xxx` | 가장 안전. 구현 공수 낮음. **권고** |
| **B. 인증 없는 draft preview endpoint** | `/runtime-draft/:id`는 draftBuildId를 알면 누구나 접근 가능 | 단순하지만 내부 draft URL 노출 위험 |
| **C. clonellm과 Open WebUI를 동일 origin에 배포** | nginx reverse proxy로 `/builder/` prefix 아래 clonellm 마운트 | same-origin cookie 공유 가능. 배포 복잡도 증가 |

#### 권고: 옵션 A

builder API 응답에 단기 preview token을 포함한다.

```json
{
  "previewPath": "/runtime-draft/runtime-draft-1776875630802",
  "previewToken": "ptk_eyJ...",
  "previewTokenExpiresAt": "2026-04-28T15:30:00Z",
  "comparePath": "/runtime-compare/runtime-draft-1776875630802",
  "compareToken": "ptk_eyJ..."
}
```

clonellm은 `/runtime-draft/:id?token=:token` 경로에서 token 유효성만 검사하고 쿠키 세션 없이 접근을 허용한다. token은 HMAC-SHA256으로 서명하고 만료 시간(예: 7일)을 포함한다.

이 변경은 Phase 1에서 반드시 처리해야 한다.

---

### 추가 7 — 기존 clonellm 데이터 Knowledge Base 부트스트랩

현재 clonellm `data/normalized/` 아래에는 Open WebUI Knowledge Base에 바로 쓸 수 있는 구조화된 데이터가 이미 있다. 이것을 빈 Knowledge Base에서 시작하면 RAG 검색 품질이 낮다.

#### 부트스트랩 대상 파일과 매핑 컬렉션

| clonellm 파일 | 매핑 컬렉션 | 내용 |
|---|---|---|
| `page-builder-prompt-blueprints.json` | `lge-policy` | 페이지별 design goals, mustKeep, avoidance patterns |
| `design-reference-library.json` | `lge-idea-archive` | 외부 디자인 레퍼런스 10개+ (Wise, Ferrari, HashiCorp 등) |
| `component-rebuild-schema-catalog.json` | `lge-component-spec` | 39개 component family patch schema, slot definitions |
| `section-family-contracts.json` | `lge-component-spec` | slot-level contracts per section family |
| `home-recipe-library.json` | `lge-design-history` | hero/quickmenu recipe variants (premium, editorial, cinematic, neutral, service-trust) |
| `style-runtime-token-presets.json` | `lge-component-spec` | runtime style token presets |

#### 부트스트랩 스크립트 추가 위치

```
clonellm/scripts/export-knowledge-base.js
  → data/normalized/ 파일들을 컬렉션별 Markdown 또는 JSON-L로 변환
  → Open WebUI Knowledge Base import API 또는 파일 업로드 포맷으로 출력
```

이 스크립트는 Phase 1 구현 시작 전에 실행해 Knowledge Base를 채워두어야 한다. 빈 상태로 시작하면 "관련 정책 검색" 단계(flow 3번)가 무의미해진다.

---

### 추가 8 — Concept 반복/수정 루프 (iteration loop)

현재 설계는 `요구사항 → 컨셉서 → 첫 빌드 → 승인/기각`으로만 구성돼 있다. 실제 기획 작업에서는 "이 부분만 바꿔줘"라는 수정 요청이 반복된다. 이 iteration 루프가 설계에 없다.

#### 수정 요청 흐름

```text
기획자: draft 검토 후 "hero 타이포그래피를 더 크게, quickmenu 아이콘은 유지"
  → Open WebUI: patchRequest 생성
  → POST /api/builder/lge/v1/draft
      body: {
        ...기존 conceptPackage...,
        "parentDraftId": "runtime-draft-1776875630802",
        "patchInstruction": "hero typography scale up, keep quickmenu icons",
        "patchDepth": "light"
      }
  → clonellm: parentDraftId 기반으로 before context 로딩
  → 새 draftBuildId로 수정본 생성
  → Open WebUI: 이전 draft와 새 draft 비교 표시
```

#### 온톨로지에 iteration 관계 추가

기존 온톨로지 주요 관계에 다음을 추가한다.

```text
DraftBuild -> revised_from -> DraftBuild   ← 수정 이력 체인
DraftBuild -> patch_instruction -> text    ← 어떤 수정이었는지
Evaluation -> requests_revision -> DraftBuild  ← 기각이 아닌 수정 요청
```

이 관계가 없으면 "이 draft가 몇 번째 수정본인지", "어떤 수정 요청이 있었는지"를 온톨로지에서 추적할 수 없다.

#### builder API에 parentDraftId 추가

Phase 1 API 스펙에 `parentDraftId` 필드를 선택 필드로 추가한다.

```json
{
  "parentDraftId": "runtime-draft-1776875630802",
  "patchInstruction": "hero typography scale up",
  "patchDepth": "light"
}
```

`parentDraftId`가 없으면 신규 빌드, 있으면 수정 빌드로 처리한다. clonellm의 기존 `patchDepth` 파라미터와 자연스럽게 연결된다.

---

### 추가 9 — Multi-viewport 빌드 고려

현재 API 스펙은 `viewportProfile: "pc"` 단일 viewport를 전제한다. clonellm은 `home@pc`, `home@mo`, `home@ta` 세 viewport를 독립적으로 관리한다. 기획자가 하나의 컨셉을 모바일과 PC에서 동시에 검증해야 할 경우 현재 구조로는 빌드를 두 번 따로 실행해야 한다.

#### 권고: viewport 배열 지원 추가 (Phase 2)

```json
{
  "pageId": "home",
  "viewportProfiles": ["pc", "mo"],
  "conceptDocument": "..."
}
```

clonellm이 내부적으로 두 job을 생성하고 각각 draftBuildId를 반환한다.

```json
{
  "jobs": [
    { "viewport": "pc", "jobId": "job-pc-xxx", "pollUrl": "..." },
    { "viewport": "mo", "jobId": "job-mo-xxx", "pollUrl": "..." }
  ]
}
```

Open WebUI Idea Bench에서 PC / MO preview를 나란히 보여주는 구조와 자연스럽게 연결된다. Phase 1에서는 단일 viewport만 지원하되, API 스펙에 배열 지원을 예약해두는 것이 좋다 (`viewportProfiles` 복수형으로 네이밍).

---

### 추가 10 — clonellm을 Open WebUI Custom Model Endpoint로 등록하는 대안

현재 설계는 `Open WebUI Function → clonellm API` 구조다. 대안으로 **clonellm을 OpenAI 호환 Custom Model Endpoint로 등록**하는 방식이 있다.

#### 구조

```text
Open WebUI: "LGE Builder" 모델 선택
  → OpenAI 호환 /v1/chat/completions 포맷으로 요청
clonellm: /v1/chat/completions 엔드포인트 추가
  → 메시지에서 intent 파싱
  → Planner → Composer → Builder → Critic 파이프라인 실행
  → 응답: stream으로 빌드 진행 상황 + 최종 preview/compare 링크
```

#### 장점

- Open WebUI의 모델 선택 UI에 "LGE Builder"가 바로 나타남
- Action Function 없이 채팅만으로 빌드 트리거 가능
- streaming 응답으로 "Planner 실행 중... Composer 실행 중..." 상태를 실시간으로 보여줄 수 있음
- RAG 검색 결과를 system message로 자동 주입하는 Open WebUI Pipeline과 결합 가능

#### 단점

- clonellm에 `/v1/chat/completions` 엔드포인트 추가 공수
- intent 파싱이 애매할 경우 빌드가 의도치 않게 트리거될 수 있음 (Q1에서 지적한 문제)
- 명시적 "목업 생성" 버튼 UX가 사라짐

#### 권고

Phase 1-2는 **Action Function + polling**이 맞다. 의도가 명확하고 디버깅이 쉽다.

Phase 3 이상에서 기획자가 자유 대화로 빌드를 트리거하는 UX가 필요할 때 `/v1/chat/completions` 등록을 검토한다. 이 시점에는 Planner 역할을 Open WebUI의 LLM이 맡고, clonellm은 Composer 이하만 실행하는 역할 분리도 가능해진다.

---

### 추가 11 — RAG → 컨셉서 생성 브릿지 설계

현재 설계에서 "Knowledge Base 검색"과 "컨셉서 생성" 사이의 연결이 묵시적으로 처리된다. 기획자가 "home hero 개선 컨셉서 만들어줘"라고 말하면 Open WebUI LLM이 RAG 검색을 해서 컨셉서를 쓴다. 그런데 이 LLM이 어떤 컬렉션을 어떤 쿼리로 검색해야 할지, 검색 결과를 어떻게 컨셉서에 반영해야 할지가 정해져 있지 않다.

#### System Prompt 설계

Open WebUI에서 "LGE 기획자 어시스턴트" Model Preset을 만들고 system prompt를 고정한다.

```text
너는 LGE 사이트 UX 기획 어시스턴트다.

컨셉서를 만들 때 다음 순서로 Knowledge Base를 검색한다:
1. lge-policy 컬렉션에서 대상 page / slot에 적용되는 정책과 guardrails 검색
2. lge-design-history 컬렉션에서 동일 page / slot의 과거 approved / rejected 이력 검색
3. lge-component-spec 컬렉션에서 대상 component의 slot 계약과 patch 제약 검색
4. lge-idea-archive 컬렉션에서 tone / 캠페인 방향이 유사한 레퍼런스 검색

검색 결과를 YAML frontmatter의 mustKeep, mustChange, guardrails 필드에 반영한다.

컨셉서 포맷은 반드시 YAML frontmatter + Markdown body를 사용한다.
```

이 system prompt가 없으면 LLM이 Knowledge Base를 임의로 검색하거나 무시하게 된다. Open WebUI Pipeline으로 RAG 결과를 강제 주입하는 방법도 있지만, system prompt 설계가 선행돼야 한다.

---

### 종합 검토 요약

| 항목 | 상태 | 우선순위 |
|---|---|---|
| Action Function + polling MVP | 맞다. timeout 처리 보완 필요 | Phase 1 |
| YAML frontmatter + projection 구조 | 맞다. RAG 인덱싱 연결 필요 | Phase 1 |
| 두 API(draft + jobs)로 충분한가 | 충분하되 iframe auth 선결 필요 | Phase 1 blocking |
| canonical ownership 경계 | 맞다. TTL + ack endpoint 추가 필요 | Phase 1 |
| MVP 앞당길 항목 | **iframe 인증 처리** 필수 | Phase 1 blocking |
| Knowledge Base 부트스트랩 | Phase 1 시작 전 필요 | Phase 0 |
| Concept iteration loop | API 스펙에 `parentDraftId` 추가 | Phase 1 |
| Multi-viewport 빌드 | API 네이밍 예약 | Phase 2 |
| clonellm custom model endpoint | Phase 3 이후 검토 | Phase 3+ |
| RAG → 컨셉서 생성 브릿지 | system prompt 설계 선행 필요 | Phase 1 |

## Codex 추가 검토 — Schema / Ontology / Migration Risk (2026-04-28)

사용자 추가 우려:

> 데이터와 스키마들이 온톨로지 및 Open WebUI와 연동될 때 마이그레이션과 연동 고려사항이 많을 것 같다.

이 우려는 맞다. 현재 계획에서 가장 큰 기술 리스크는 API 연결보다 **데이터 스키마 이식과 ontology projection**이다.

`clonellm`의 `data/normalized/`에는 다음 성격의 데이터가 섞여 있다.

- 실행 가능한 runtime truth
- 오래된 blueprint 또는 stale signal
- 정책 문서로 쓸 수 있는 guardrail
- builder prompt input으로 쓸 수 있는 contract
- Open WebUI Knowledge Base에 넣기 좋은 설명형 자료
- builder가 직접 참조해야 하는 machine-readable registry
- runtime preview cache에 가까운 transient artifact

이것들을 구분하지 않고 Open WebUI Knowledge Base나 온톨로지에 일괄 import하면, 검색 결과가 builder 실행 truth와 어긋나는 문제가 생긴다.

### 1. 핵심 원칙: 원본 이전이 아니라 projection 이전

Open WebUI로 옮기는 것은 `clonellm` 원본 데이터 전체가 아니다.

원칙:

```text
clonellm raw/normalized data
  -> migration adapter
  -> ontology projection
  -> Open WebUI Knowledge / metadata / artifact store
```

Open WebUI는 `clonellm` 내부 JSON shape를 직접 알면 안 된다.

Open WebUI가 보는 것은 아래 세 종류의 projection이다.

```text
1. Knowledge projection
   - 사람이 읽고 RAG 검색할 수 있는 Markdown / text document

2. Ontology projection
   - Project, Page, Slot, Component, Policy, Asset, Artifact 관계 그래프

3. Builder contract projection
   - builder API v1에 넘길 수 있는 검증된 JSON payload
```

원본 JSON은 `clonellm` 쪽에 남고, Open WebUI에는 versioned projection만 들어간다.

### 2. 데이터 분류표

초기 migration에서 각 파일을 같은 방식으로 다루면 안 된다.

| 데이터 | 성격 | Open WebUI 처리 | 주의 |
|---|---|---|---|
| `page-builder-prompt-blueprints.json` | 정책/프롬프트 blueprint | Knowledge + Policy projection | stale 여부 표기 필요 |
| `section-family-contracts.json` | component/slot contract | Knowledge + Ontology + Builder contract | 실행 제약으로 쓰일 수 있음 |
| `component-rebuild-schema-catalog.json` | component family schema | Knowledge + Ontology | familyId/componentId mapping 보존 |
| `image-asset-registry.json` | asset registry | Ontology + Builder contract | license/status/role/viewport variant 보존 필수 |
| `asset-role-policies.json` | asset role policy | Knowledge + Builder guardrail | runtime validation과 연결 |
| `style-runtime-token-presets.json` | style token preset | Builder contract | Knowledge 문서로만 쓰면 부족 |
| `home-recipe-library.json` | design history / recipe | Knowledge + Idea archive | approved/candidate 구분 필요 |
| `page-runtime-status.json` | runtime readiness snapshot | Artifact/status projection | 시간 민감, TTL/날짜 필요 |
| `admin-design-target-audit-*.json/md` | audit snapshot | Knowledge + Evaluation history | 최신성/대상 viewport 명시 |
| `site-document.json` / `editable-prototype.json` | early structural model | Legacy/reference only | 현재 truth로 오인 금지 |
| `generated-asset-cache.json` | transient/generated cache | 기본 import 제외 | 승인 asset registry와 분리 |
| `draftBuild` / runtime cache | preview cache | Artifact link only | Open WebUI canonical artifact와 구분 |

### 3. Canonical ID 정책

온톨로지 migration에서 가장 먼저 고정해야 하는 것은 ID 정책이다.

현재 데이터에는 다음 ID 계열이 함께 존재한다.

```text
pageId: home
slotId: hero
componentId: home.hero
familyId: hero-carousel-composition
assetId: home.hero.generated.premium-stage.candidate-a
variantId: home.hero.generated.premium-stage.candidate-a.pc
draftBuildId: runtime-draft-1777022607772
planId: ...
conceptId: ...
externalConceptId: ...
```

Open WebUI ontology는 내부 UUID를 만들 수 있지만, `clonellm` builder와 연결되는 stable external key를 반드시 보존해야 한다.

권장:

```json
{
  "id": "owui-generated-uuid",
  "entityType": "Component",
  "externalKeys": {
    "clonellm": "home.hero",
    "pageId": "home",
    "slotId": "hero",
    "familyId": "hero-carousel-composition"
  },
  "schemaVersion": "ontology-v1"
}
```

Open WebUI 내부 ID와 `clonellm` ID를 섞지 않는다.

Builder API에는 항상 `externalKeys.clonellm` 또는 versioned builder payload를 넘긴다.

### 4. Versioning / Freshness 정책

Open WebUI Knowledge에 들어간 문서는 시간이 지나면 낡는다.

특히 다음 데이터는 freshness가 중요하다.

- runtime status
- asset approval status
- generated asset candidates
- audit reports
- accepted/rejected design history
- page/slot readiness

모든 migrated entity에는 아래 필드를 둔다.

```json
{
  "sourcePath": "data/normalized/page-runtime-status.json",
  "sourceHash": "sha256:...",
  "sourceGeneratedAt": "2026-04-27T04:29:26.488Z",
  "importedAt": "2026-04-28T00:00:00.000Z",
  "projectionVersion": "knowledge-projection-v1",
  "freshness": "current | stale | snapshot | legacy",
  "truthLevel": "runtime-truth | policy | candidate | historical | legacy-reference"
}
```

RAG 응답과 컨셉서 생성 prompt에는 `freshness`와 `truthLevel`을 같이 노출해야 한다.

예:

```text
이 문서는 2026-04-27 runtime snapshot이며, 현재 runtime truth일 수 있지만 이후 build 결과와 다를 수 있다.
```

### 5. Knowledge 문서와 Builder contract 분리

Open WebUI Knowledge Base는 사람이 읽고 LLM이 검색하기 좋은 형태다.

하지만 builder 실행에는 정확한 JSON contract가 필요하다.

따라서 같은 source file에서 두 projection을 만든다.

예: `image-asset-registry.json`

```text
Knowledge projection:
  "home hero premium-stage candidate-a는 generated background-only asset이며 final output에는 승인 전 사용 금지..."

Builder contract projection:
  {
    "assetId": "...",
    "role": "background-only",
    "status": "candidate",
    "allowedUsage": ["hero-background"],
    "restrictedUsage": ["icon", "quickmenu-icon", "promo-reoverlay"],
    "variants": { "pc": {...}, "mo": {...} }
  }
```

LLM이 Knowledge 문서를 읽고 "사용 가능"이라고 추론하게 두면 안 된다.

최종 builder는 machine-readable contract를 기준으로 validation해야 한다.

### 6. Migration Adapter 필요

Phase 0에 아래 스크립트가 필요하다.

```text
scripts/export-openwebui-knowledge.mjs
scripts/export-openwebui-ontology.mjs
scripts/export-builder-contract-v1.mjs
```

역할:

```text
export-openwebui-knowledge
  -> data/normalized files
  -> collection별 Markdown/JSONL
  -> sourcePath/sourceHash/freshness/truthLevel metadata 포함

export-openwebui-ontology
  -> Project/Page/Slot/Component/Policy/Asset 관계 edge 생성
  -> stable externalKeys 포함

export-builder-contract-v1
  -> builder API v1이 직접 검증할 contract bundle 생성
  -> JSON Schema validation 포함
```

Open WebUI import는 이 export 결과만 받는다.

원본 `data/normalized/*.json`을 직접 Open WebUI에 업로드하지 않는다.

### 7. Ontology Edge 초안

초기 ontology는 너무 넓게 잡지 않는다.

Phase 1에서는 builder와 RAG에 꼭 필요한 edge만 만든다.

```text
Page -> has_slot -> Slot
Slot -> implemented_by -> Component
Component -> belongs_to_family -> ComponentFamily
ComponentFamily -> governed_by -> SectionFamilyContract
Slot -> governed_by -> AssetRolePolicy
Asset -> usable_for -> Slot
Asset -> has_variant -> AssetVariant
AssetVariant -> targets_viewport -> ViewportProfile
ConceptDocument -> targets -> Page / Slot / Component
BuilderRun -> executes -> ConceptDocument
DraftBuild -> generated_from -> BuilderRun
DraftBuild -> revised_from -> DraftBuild
Evaluation -> reviews -> DraftBuild
Decision -> accepts/rejects/requests_revision -> DraftBuild
```

Phase 1에서 제외:

- full journey graph
- detailed DOM node graph
- every screenshot crop as entity
- every prompt token/history as entity

너무 촘촘한 graph는 초기에 유지보수 비용만 만든다.

### 8. Backward / Forward Migration

스키마가 바뀔 때를 대비해 migration을 양방향으로 나눠야 한다.

```text
forward migration:
  clonellm normalized data -> Open WebUI projection

backward handoff:
  Open WebUI concept/artifact/decision -> clonellm builder input or publish input
```

특히 backward handoff가 중요하다.

Open WebUI가 canonical owner가 되면, 나중에 승인된 artifact를 `clonellm` workspace나 production export로 다시 넘겨야 한다.

따라서 Open WebUI artifact에는 builder가 다시 읽을 수 있는 fields를 유지한다.

```json
{
  "builderApiVersion": "v1",
  "conceptDocument": "...",
  "conceptPackage": {},
  "target": {
    "pageId": "home",
    "slotIds": ["hero", "quickmenu"],
    "componentIds": ["home.hero", "home.quickmenu"],
    "viewportProfile": "pc"
  },
  "authoredSectionHtmlPackage": {},
  "assetUsageManifest": {},
  "validationReport": {}
}
```

### 9. Conflict / Drift Handling

마이그레이션 후 drift가 반드시 생긴다.

예:

- Open WebUI에는 asset이 approved로 남아 있는데 `clonellm` registry에서는 retired됨
- component family assignment가 바뀜
- page runtime status가 새 build로 갱신됨
- conceptDocument가 오래된 policy를 참조함

필요한 정책:

```text
1. sourceHash가 바뀌면 projection 재생성
2. Open WebUI artifact는 생성 시점의 contract snapshot을 보관
3. 새 build를 실행할 때는 latest contract로 revalidate
4. old artifact는 historical truth로 남기고 current truth로 승격하지 않음
5. RAG 결과에는 stale/current 표시를 포함
```

### 10. Access / License / Privacy Migration

asset registry와 generated cache에는 provenance, license, sourceRef가 포함된다.

Open WebUI로 이동할 때 다음을 구분해야 한다.

```text
searchable metadata:
  asset role, status, allowedUsage, visualTone, llmDescription

restricted metadata:
  sourceUrl, sourceRef, licenseProfile, providerName, provenanceNotes

binary / private asset:
  raw image file, generated cache file, internal LGE-derived asset
```

기획자 RAG에는 필요한 설명만 노출하고, 실제 asset file 접근은 builder/runtime이 관리한다.

Open WebUI Knowledge에 내부 asset URL이나 private file path를 무제한 노출하지 않는다.

### 11. Phase 재정렬 제안

기존 Phase 0/1 사이에 migration foundation을 넣는다.

```text
Phase 0A: Schema inventory
  - data/normalized 파일별 owner, truthLevel, freshness, import policy 분류
  - canonical ID map 작성

Phase 0B: Projection schema
  - Knowledge projection schema
  - Ontology projection schema
  - Builder contract v1 schema

Phase 0C: Export scripts
  - export-openwebui-knowledge
  - export-openwebui-ontology
  - export-builder-contract-v1

Phase 0D: Dry-run migration
  - 5개 대표 파일만 변환
  - home.hero / home.quickmenu / asset-role / section-family / runtime-status 기준 검증

Phase 1: Builder API
  - builder API는 export-builder-contract-v1 결과를 읽어 검증
  - Open WebUI는 projection만 사용
```

### 12. 추가 Claude 검토 질문

다음 Claude 검토에서는 아래를 물어본다.

1. `clonellm` 원본 JSON을 Open WebUI에 직접 import하지 않고 projection export만 허용하는 원칙이 적절한가?
2. `truthLevel` / `freshness` / `sourceHash`를 모든 migrated entity에 강제하는 것이 과한가, 아니면 필수인가?
3. Phase 1 ontology edge 범위가 충분히 작고 실행 가능하게 잡혔는가?
4. `Knowledge projection`과 `Builder contract projection`을 분리하는 방식이 RAG와 runtime validation을 모두 만족하는가?
5. Open WebUI canonical artifact가 나중에 `clonellm` publish/export로 되돌아갈 수 있도록 backward handoff fields를 고정해야 하는가?

### 결론

Open WebUI 연동은 API부터 만들면 안 된다.

먼저 `schema inventory -> projection schema -> dry-run migration`을 끝낸 뒤 builder API를 붙여야 한다.

그렇지 않으면 Open WebUI에는 검색 가능한 지식이 쌓이지만, 그 지식이 실제 builder/runtime truth와 어긋나는 상태가 된다.

---

## Claude 피드백/데이터 구조 검토 (2026-04-28)

### Codex 재검토 요청 5개 답변

**Q1. 원본 JSON 직접 import 금지, projection만 허용 — 적절한가?**

적절하다. 이유가 중요하다: `clonellm`의 내부 JSON은 builder 실행 shape으로 최적화돼 있어서 LLM이 RAG로 읽기에 적합하지 않다. 예를 들어 `component-rebuild-schema-catalog.json`의 `patchSchema` 필드는 diff operation 형식이라 LLM이 이걸 읽고 "이 컴포넌트는 X를 지원한다"고 올바르게 추론하기 어렵다. Projection 레이어가 builder 실행 shape을 사람이 읽을 수 있는 서술형으로 변환하는 역할을 해야 한다.

단 예외 하나: builder contract projection은 원본 JSON과 구조가 거의 같아도 된다. 이것은 LLM이 읽는 게 아니라 `validateConceptPayload()`가 기계적으로 검증하는 것이므로.

**Q2. truthLevel / freshness / sourceHash를 모든 entity에 강제 — 과한가, 필수인가?**

**데이터 성격에 따라 분리**가 맞다. 전부 강제하면 static reference 데이터(component spec, section family contract)에 불필요한 유지보수 부담이 생긴다.

| truthLevel | freshness 강제 | sourceHash 강제 | 이유 |
|---|---|---|---|
| `runtime-truth` | 필수 | 필수 | 빌드 결과와 직접 연결 |
| `policy` | 필수 | 필수 | guardrail 위반 방지에 필수 |
| `candidate` | 필수 | 권고 | asset 상태가 바뀔 수 있음 |
| `historical` | 불필요 | 권고 | 한 번 기록된 뒤 변경 없음 |
| `legacy-reference` | 불필요 | 불필요 | 참고용, 실행 연결 없음 |

**Q3. Phase 1 ontology edge 14개 범위 — 충분히 작은가?**

적절하다. 단 하나 추가해야 한다.

```text
Handoff -> implements -> DraftBuild
```

이 edge가 없으면 승인된 draft가 실제로 전달됐는지 온톨로지에서 추적할 수 없다. `Decision -> accepts -> DraftBuild`와 `Handoff -> implements -> DraftBuild`는 다른 이야기다. 전자는 의도, 후자는 실행이다.

**Q4. Knowledge projection + Builder contract projection 이중 projection — RAG와 runtime validation 모두 만족하는가?**

만족한다. 핵심 원칙은 이것이다: **LLM의 "추론"과 builder의 "검증"은 다른 채널을 통해야 한다.** LLM이 Knowledge projection을 읽고 "사용 가능"이라고 추론한 것이 builder contract validation을 통과할 보장이 없다. 따라서 두 projection이 같은 source에서 나오더라도 서로 다른 경로로 소비돼야 한다.

단 consistency 문제가 생긴다: Knowledge projection과 Builder contract projection이 같은 source에서 다른 내용을 말하면 LLM과 builder가 충돌한다. 이 consistency는 export script 레벨에서 검증해야 한다 — Knowledge projection에서 "background-only"라고 서술된 asset의 Builder contract에 `allowedUsage`에 해당 역할이 포함돼 있는지 export 시 자동 확인.

**Q5. Open WebUI canonical artifact에 backward handoff fields 고정 — 필수인가?**

필수다. 이유: Phase 5에서 `clonellm`이 "preview generation service"로만 남더라도, 승인된 artifact를 production에 반영하는 경로는 여전히 clonellm 빌드 시스템을 통해야 한다. 이때 Open WebUI artifact에 `builderApiVersion`, `conceptPackage`, `target`, `authoredSectionHtmlPackage`가 없으면 재현이 불가능하다. Artifact가 snapshot일 뿐이고 재실행 불가능해진다.

추가로: backward handoff fields에 `builderContractVersion` 필드를 반드시 포함해야 한다. 1년 뒤 v2 contract로 전환된 상황에서 v1 artifact를 재실행하려면 어떤 contract 버전이었는지 알아야 한다.

---

### 데이터 구조 보완 — 3개 공백

#### D1. ConceptThread ID — iteration chain의 누락된 anchor

현재 `DraftBuild -> revised_from -> DraftBuild` 관계만으로는 "이 draft가 몇 번째 수정본인지", "같은 컨셉에서 시작한 빌드들을 한 번에 조회"하는 것이 어렵다. graph를 역방향으로 traverse해야 하기 때문이다.

해결: **ConceptThread** 엔티티를 추가한다.

```text
ConceptThread
  - conceptThreadId: "thread-home-top-premium-20260428"
  - projectId
  - pageId
  - targetGroup
  - originConceptId    ← 첫 컨셉서
  - latestDraftId      ← 현재 최신 draft
  - status: active | approved | abandoned
  - iterationCount
```

온톨로지 관계:

```text
ConceptThread -> contains -> ConceptDocument (복수)
ConceptThread -> contains -> DraftBuild (복수)
DraftBuild -> belongs_to -> ConceptThread
ConceptDocument -> starts -> ConceptThread
```

builder API 요청에 `conceptThreadId`를 선택 필드로 추가한다. 없으면 신규 thread 생성, 있으면 기존 thread에 iteration 추가.

```json
{
  "conceptThreadId": "thread-home-top-premium-20260428",
  "parentDraftId": "runtime-draft-1776875630802",
  "patchInstruction": "...",
  "patchDepth": "light"
}
```

#### D2. Freshness 트리거 메커니즘 — 누가 언제 re-export를 실행하는가

현재 설계에는 `sourceHash`로 변경을 감지한다고 돼 있지만, 누가 어느 타이밍에 감지하고 re-export를 실행하는지 설계가 없다. 세 가지 트리거 방식을 정의한다.

| 트리거 | 방식 | 권고 Phase |
|---|---|---|
| **수동** | `npm run export:knowledge` 직접 실행 | Phase 0 (초기 세팅) |
| **pre-commit hook** | `data/normalized/` 파일 변경 시 hash diff → 변경 파일만 re-export | Phase 1 |
| **빌드 완료 이벤트** | builder job done 시 해당 page/slot 관련 projection refresh | Phase 3 |

Phase 1에서는 pre-commit hook 방식을 기본으로 한다. `data/normalized/` 내 파일이 커밋될 때 `scripts/export-openwebui-knowledge.mjs`가 변경된 파일만 재생성하고 `import-manifest.json`의 sourceHash를 업데이트한다. Open WebUI는 manifest를 폴링하거나 webhook으로 변경을 감지해 해당 컬렉션만 재인덱싱한다.

```json
// import-manifest.json
{
  "version": "knowledge-projection-v1",
  "lastExportedAt": "2026-04-28T10:00:00Z",
  "files": [
    {
      "source": "data/normalized/page-builder-prompt-blueprints.json",
      "sourceHash": "sha256:abc123",
      "projection": "exports/knowledge/lge-policy/page-blueprints.md",
      "collection": "lge-policy",
      "freshness": "current"
    }
  ]
}
```

#### D3. Phase 0A Schema Inventory — 실제 파일 목록 확인 필요

Codex의 데이터 분류표는 잘 만들어졌지만 `data/normalized/` 아래 실제 파일을 전수 확인한 뒤 분류표와 대조해야 한다. 특히:

- `image-asset-registry.json` — 존재 여부와 현재 schema 확인 필요 (`generated-asset-cache.json`과 다른 파일인지)
- `asset-role-policies.json` — 실제 파일명 확인 (CLAUDE.md에는 언급 없음)
- `page-runtime-status.json` — runtime 디렉토리에 있을 가능성 (gitignored라면 Phase 0 import 대상에서 제외)

Phase 0A 시작 전에 `ls data/normalized/`를 실행해 실제 파일 목록을 기준으로 분류표를 완성해야 한다.

---

### 피드백 루프 설계 — 현재 설계의 가장 큰 공백

현재 전체 설계에서 **학습 루프(feedback loop)** 가 없다. 지식이 KB에 들어가는 경로만 있고, 빌드 결과와 사람의 평가가 KB를 갱신하는 경로가 없다.

```text
현재 설계:
  clonellm data → (projection) → KB → RAG → 컨셉서 → 빌드 → 평가
                                                            ↓
                                                         [종료]

필요한 설계:
  clonellm data → (projection) → KB → RAG → 컨셉서 → 빌드 → 평가
                       ↑                                     ↓
                       └──────── feedback loop ──────────────┘
```

#### FL1. 자동 피드백: Builder Critic 결과 → KB

clonellm의 visual critic과 structural critic은 이미 quality evaluation을 생성한다. 이 결과가 현재는 `artifact.report` 안에 묻혀서 Open WebUI artifact로만 저장된다. **KB의 `lge-design-history` 컬렉션에도 자동으로 추가**돼야 한다.

구조화된 critic 피드백 스키마:

```json
{
  "feedbackId": "fb-runtime-draft-1776875630802-critic",
  "sourceType": "critic",
  "draftId": "runtime-draft-1776875630802",
  "conceptThreadId": "thread-home-top-premium-20260428",
  "pageId": "home",
  "slots": ["hero", "quickmenu"],
  "tone": "premium",
  "verdict": "passed" | "failed" | "passed-with-warning",
  "strengths": ["premium tone 유지됨", "hero asset role 준수"],
  "weaknesses": ["quickmenu 아이콘 대비 낮음", "hero 텍스트 hierarchy 약함"],
  "actionableSignals": ["quickmenu icon contrast 개선", "hero h1 weight 증가"],
  "qualityScore": 0.72,
  "generatedAt": "2026-04-28T10:05:00Z"
}
```

이 JSON을 Markdown으로 변환해 `lge-design-history` 컬렉션에 자동 추가한다. 다음 컨셉서 생성 시 RAG가 "quickmenu 아이콘 대비 낮음은 과거 실패 패턴" 이라는 컨텍스트를 참조할 수 있게 된다.

#### FL2. 인간 평가 → KB 자동 업데이트

기획자가 Open WebUI에서 Decision을 내릴 때 (approve / reject / request_revision) 이 결정이 KB에 자동으로 반영돼야 한다. 현재 설계는 "온톨로지에 저장"이라고만 돼 있고 KB 업데이트 트리거가 없다.

```text
기획자: Open WebUI에서 draft 승인
  → Decision 엔티티 생성 (ontology)
  → [신규] KB update trigger:
      lge-design-history 컬렉션에 structured feedback 추가
      {
        feedbackId: "fb-...-human",
        sourceType: "human",
        evaluatorId: "planner-kim",
        verdict: "approved",
        decisionReason: "premium tone과 hero 구성 방향 맞음",
        strengths: [...],
        weaknesses: [...],
        linkedFeedbacks: ["fb-...-critic"]  ← critic 피드백과 연결
      }
```

승인/기각 이유가 KB에 쌓이면, 다음 기획자가 "home hero premium 방향으로 과거 승인된 사례와 이유"를 RAG로 검색할 수 있게 된다.

#### FL3. Contract 위반 피드백 → Policy KB 자동 강화

빌드가 guardrail 위반으로 실패했을 때 (`asset role violation`, `slot contract violation` 등), 그 위반 사례가 `lge-policy` 컬렉션에 자동으로 추가돼야 한다.

```text
builder validation 실패:
  "hero slot에 promo-complete asset 사용 시도 → background-only policy 위반"
  → lge-policy 컬렉션 업데이트:
      "2026-04-28: home hero slot에 promo-complete asset을 background로 사용하려는 시도가 있었음.
       이 조합은 asset-role policy에 의해 차단됨. 향후 컨셉서 작성 시 hero slot은
       background-only 또는 hero-generated class asset만 사용할 것."
```

이 패턴이 축적되면 RAG가 policy 위반 가능성을 컨셉서 생성 단계에서 미리 경고할 수 있게 된다.

#### FL4. 피드백 루프 구현 위치

| 피드백 유형 | 트리거 | 구현 위치 |
|---|---|---|
| Critic 결과 → KB | 빌드 job done 시 | clonellm `finalize.js` 에서 KB update API 호출 |
| 인간 평가 → KB | Open WebUI Decision 저장 시 | Open WebUI Pipeline (after-hook) |
| Contract 위반 → KB | builder validation 실패 시 | clonellm `validateConceptPayload()` 실패 핸들러 |

이 세 가지 피드백 경로가 없으면 KB는 초기 데이터만 갖고 있고, 실제 사용하면서 축적되는 패턴/실패/성공 정보가 사라진다.

---

### Phase 재정렬 보완

Codex의 Phase 0A-0D는 잘 설계됐다. 피드백 루프 구현을 Phase 순서에 추가한다.

```text
Phase 0A: Schema inventory + 실제 파일 목록 확인
Phase 0B: Projection schema 설계 (Knowledge / Ontology / Builder contract)
Phase 0C: Export scripts (export-openwebui-knowledge / ontology / builder-contract)
Phase 0D: Dry-run migration (5개 파일 검증)

Phase 1: Builder API + iframe auth + ConceptThread ID + ack endpoint
Phase 1.5: KB 자동 업데이트 — Critic 결과 자동 추가 (FL1)
Phase 2: Open WebUI Action Function + polling + Knowledge Base 부트스트랩
Phase 2.5: 인간 평가 → KB 자동 업데이트 (FL2) + Contract 위반 → KB (FL3)
Phase 3: Idea Bench + multi-viewport + ConceptThread 비교 UI
Phase 4: Graph DB + full ontology traversal
Phase 5: Static artifact viewer + production publish API
```

Phase 1.5를 Phase 1과 분리한 이유: Phase 1에서 builder API가 안정적으로 동작하는 걸 확인한 뒤에 KB 자동 업데이트를 붙여야 한다. KB 자동 업데이트를 Phase 1에 함께 넣으면 빌드 파이프라인 디버깅이 어려워진다.

---

### 종합 평가

Codex의 Schema/Migration Risk 섹션은 방향이 맞다. 특히:

- Projection 원칙 (원본 이전 금지)
- Canonical ID 이중 구조 (owui UUID + clonellm externalKeys)
- Freshness + truthLevel 메타데이터
- Forward + backward migration 분리
- Phase 0 세분화

이 중 지금 보완이 필요한 것은 두 가지다.

1. **Freshness 트리거**: pre-commit hook + import-manifest.json 방식으로 구체화 (D2)
2. **피드백 루프**: critic/human/violation 세 가지 경로로 KB가 자동 갱신되는 구조 없으면 KB가 초기 상태에서 멈춘다 (FL1-FL4)

## Codex 최종 검토 — 데이터 구조 피드백 수용 / 개발 착수 기준 (2026-04-28)

Claude의 데이터 구조 검토는 대부분 수용한다.

이번 섹션은 지금까지의 논의를 개발 착수 가능한 기준으로 정리한다.

### 1. 수용 항목

#### 1.1 Projection-only migration

수용한다.

`clonellm` 원본 JSON을 Open WebUI Knowledge Base에 직접 import하지 않는다.

Open WebUI로 전달되는 것은 항상 projection 결과물이다.

```text
clonellm source data
  -> Knowledge projection
  -> Ontology projection
  -> Builder contract projection
```

예외:

Builder contract projection은 LLM이 읽는 자료가 아니라 machine validation 자료이므로 원본 JSON shape와 가까워도 된다.

#### 1.2 truthLevel / freshness / sourceHash 차등 적용

수용한다.

모든 entity에 동일 강도로 강제하지 않고, 데이터 성격에 따라 적용 수준을 나눈다.

| truthLevel | freshness | sourceHash | 비고 |
|---|---|---|---|
| `runtime-truth` | 필수 | 필수 | builder/runtime과 직접 연결 |
| `policy` | 필수 | 필수 | guardrail source |
| `candidate` | 필수 | 권고 | asset/status 변경 가능 |
| `historical` | 불필요 | 권고 | 당시 기록 보존 |
| `legacy-reference` | 불필요 | 불필요 | 실행 연결 금지 |

단, projection manifest에는 가능한 한 모든 source file hash를 기록한다.

#### 1.3 ConceptThread 추가

수용한다.

`DraftBuild -> revised_from -> DraftBuild`만으로는 기획 iteration을 조회하기 어렵다.

따라서 `ConceptThread`를 추가한다.

```text
ConceptThread
  - conceptThreadId
  - projectId
  - pageId
  - targetGroup
  - originConceptId
  - latestDraftId
  - status: active | approved | abandoned
  - iterationCount
```

관계:

```text
ConceptThread -> contains -> ConceptDocument
ConceptThread -> contains -> DraftBuild
DraftBuild -> belongs_to -> ConceptThread
ConceptDocument -> starts -> ConceptThread
```

Builder API v1에는 선택 필드로 포함한다.

```json
{
  "conceptThreadId": "thread-home-top-premium-20260428",
  "parentDraftId": "runtime-draft-1776875630802",
  "patchInstruction": "hero typography scale up",
  "patchDepth": "light"
}
```

#### 1.4 Handoff edge 추가

수용한다.

아래 edge를 추가한다.

```text
Handoff -> implements -> DraftBuild
```

`Decision -> accepts -> DraftBuild`는 승인 의사결정이고, `Handoff -> implements -> DraftBuild`는 실제 전달/반영 흐름이다.

두 관계는 분리해야 한다.

#### 1.5 builderContractVersion 추가

수용한다.

Open WebUI canonical artifact에는 `builderContractVersion`을 반드시 포함한다.

```json
{
  "builderApiVersion": "v1",
  "builderContractVersion": "builder-contract-v1",
  "conceptPackage": {},
  "target": {},
  "authoredSectionHtmlPackage": {},
  "assetUsageManifest": {},
  "validationReport": {}
}
```

이 필드가 없으면 나중에 v2 전환 이후 v1 artifact를 재실행하거나 publish하기 어렵다.

#### 1.6 Projection consistency check

수용한다.

같은 source에서 나온 Knowledge projection과 Builder contract projection이 서로 다른 말을 하면 안 된다.

예:

```text
Knowledge projection:
  "asset A는 background-only"

Builder contract:
  role: "background-only"
  allowedUsage includes "hero-background"
```

export 시점에 consistency check를 수행한다.

불일치하면 export를 실패시킨다.

#### 1.7 import-manifest.json

수용한다.

모든 projection export 결과에는 manifest를 생성한다.

```json
{
  "version": "knowledge-projection-v1",
  "lastExportedAt": "2026-04-28T10:00:00Z",
  "files": [
    {
      "source": "data/normalized/page-builder-prompt-blueprints.json",
      "sourceHash": "sha256:abc123",
      "projection": "exports/openwebui/knowledge/lge-policy/page-blueprints.md",
      "collection": "lge-policy",
      "truthLevel": "policy",
      "freshness": "current"
    }
  ]
}
```

Open WebUI import는 이 manifest를 기준으로 수행한다.

#### 1.8 Feedback loop

수용한다.

Open WebUI Knowledge Base는 초기 import로 끝나면 안 된다.

아래 세 경로를 추가한다.

```text
FL1. Critic 결과 -> lge-design-history
FL2. 인간 평가 / 승인 / 기각 / 수정 요청 -> lge-design-history
FL3. Contract 위반 -> lge-policy
```

단, builder API가 안정화되기 전에는 자동 KB update를 붙이지 않는다.

### 2. 보정 항목

#### 2.1 pre-commit hook은 기본값이 아니라 optional

Claude는 Phase 1에서 pre-commit hook을 기본 방식으로 제안했다.

방향은 맞지만 초기에는 보정한다.

이유:

- `data/normalized/` 파일 수와 크기가 크다.
- export가 무거워지면 일반 개발 흐름을 방해한다.
- 현재 repo는 이미 대량의 generated/data 파일이 섞여 있어 hook 실패가 개발을 막을 수 있다.

따라서 초기 freshness trigger는 아래 순서로 간다.

```text
Phase 0:
  수동 export
  npm run export:openwebui

Phase 1:
  manifest diff check
  npm run check:openwebui-export

Phase 1.5:
  optional pre-commit hook

Phase 3:
  builder job done event 기반 partial refresh
```

pre-commit hook은 선택 옵션으로 둔다.

#### 2.2 KB 자동 업데이트는 Phase 1.5부터

Feedback loop는 중요하지만 Phase 1에 같이 넣지 않는다.

Phase 1에서는 builder API, preview auth, artifact return을 먼저 안정화한다.

KB 자동 업데이트는 Phase 1.5부터 추가한다.

```text
Phase 1:
  builder job 생성/조회/preview 확인

Phase 1.5:
  critic result -> KB
  contract violation -> KB

Phase 2.5:
  human decision -> KB
```

이 순서가 디버깅하기 쉽다.

#### 2.3 Phase 0A에서 실제 파일 목록 기반 inventory 먼저 수행

수용하되 개발 순서를 더 명확히 한다.

Phase 0A의 첫 작업은 문서 작성이 아니라 실제 파일 inventory 생성이다.

```text
scripts/inventory-openwebui-sources.mjs
  -> data/normalized 파일 목록 수집
  -> 파일별 schema fingerprint 생성
  -> owner / importPolicy / truthLevel 후보 출력
  -> docs 또는 data/normalized/openwebui-source-inventory.json 생성
```

이 inventory를 기준으로 projection export 대상을 확정한다.

### 3. 최종 Phase Plan

개발 착수 기준 phase를 아래로 고정한다.

#### Phase 0A: Source Inventory

목표:

`data/normalized/`의 실제 파일을 기준으로 Open WebUI 연동 대상과 제외 대상을 분류한다.

작업:

```text
scripts/inventory-openwebui-sources.mjs
data/normalized/openwebui-source-inventory.json
```

필드:

```json
{
  "sourcePath": "data/normalized/section-family-contracts.json",
  "exists": true,
  "sourceHash": "sha256:...",
  "schemaFingerprint": {
    "topLevelKeys": ["generatedAt", "version", "global", "clusters", "families"],
    "arrayFields": [],
    "objectFields": ["global", "clusters", "families"]
  },
  "owner": "clonellm",
  "importPolicy": "project",
  "truthLevel": "policy",
  "freshnessPolicy": "required",
  "targetProjections": ["knowledge", "ontology", "builder-contract"]
}
```

#### Phase 0B: Projection Schema

목표:

세 projection의 schema를 고정한다.

```text
Knowledge projection
Ontology projection
Builder contract projection
```

산출물:

```text
docs/openwebui-projection-schema-v1.md
data/normalized/openwebui-projection-schema-v1.json
```

#### Phase 0C: Export Scripts

목표:

Open WebUI import 가능한 projection export를 생성한다.

작업:

```text
scripts/export-openwebui-knowledge.mjs
scripts/export-openwebui-ontology.mjs
scripts/export-builder-contract-v1.mjs
scripts/check-openwebui-export.mjs
```

산출물:

```text
exports/openwebui/knowledge/
exports/openwebui/ontology/
exports/openwebui/builder-contract/
exports/openwebui/import-manifest.json
```

#### Phase 0D: Dry-run Migration

목표:

대표 파일 5개만 먼저 migration한다.

대상:

```text
section-family-contracts.json
component-rebuild-schema-catalog.json
image-asset-registry.json
asset-role-policies.json
page-runtime-status.json
```

검증:

```text
home.hero
home.quickmenu
asset role
section family contract
runtime status
```

#### Phase 1: Builder API v1

목표:

Open WebUI에서 호출 가능한 builder job API를 만든다.

API:

```text
POST /api/builder/lge/v1/draft
GET /api/builder/lge/v1/jobs/:jobId
```

필수 포함:

```text
builderApiVersion
builderContractVersion
conceptThreadId optional
parentDraftId optional
patchInstruction optional
previewToken
compareToken
artifact payload
```

#### Phase 1.5: Builder Runtime Hardening

목표:

builder API 안정화 후 운영 안전장치를 붙인다.

작업:

```text
signed preview token
draft cache TTL
job ack endpoint
critic result -> KB export payload
contract violation -> KB export payload
```

참고:

KB에 직접 write하기보다, 우선 KB update payload를 export artifact로 남긴다.

Open WebUI import 자동화는 그 다음 단계에서 붙인다.

#### Phase 2: Open WebUI Integration MVP

목표:

Open WebUI에서 기획 컨셉서 작성 후 목업 생성/확인이 가능하게 한다.

작업:

```text
LGE planner assistant system prompt
Open WebUI Knowledge collection bootstrap
Action Function: 목업 생성
Action Function: 빌드 결과 확인
artifact card / preview link 표시
```

#### Phase 2.5: Human Feedback Loop

목표:

기획자의 승인/기각/수정 요청을 KB와 ontology에 반영한다.

작업:

```text
Decision entity
human feedback projection
lge-design-history update payload
ConceptThread status update
```

#### Phase 3: Idea Bench

목표:

여러 concept 후보를 병렬 빌드하고 비교한다.

작업:

```text
multi-viewport support
viewportProfiles array
parallel build jobs
Idea Bench UI 검토
optional Open WebUI fork
```

#### Phase 4+

후순위:

```text
external graph DB
custom model endpoint
static artifact viewer
production publish API
GitHub/GitLab PR 자동 생성
```

### 4. 개발 착수 조건

바로 builder API부터 만들지 않는다.

개발 착수 순서는 아래로 고정한다.

```text
1. Phase 0A source inventory
2. Phase 0B projection schema
3. Phase 0C export scripts
4. Phase 0D dry-run migration
5. Phase 1 builder API
```

Phase 0D가 끝나기 전에는 Open WebUI Action Function이나 builder API를 구현하지 않는다.

이 순서를 어기면 Open WebUI에 쌓이는 knowledge와 실제 `clonellm` runtime truth가 어긋날 가능성이 높다.

### 5. 최종 결론

현재 통합 방향은 유지한다.

```text
Open WebUI = planning / ontology / knowledge / artifact core
clonellm = LGE specialized builder/runtime engine
```

하지만 개발 시작점은 API가 아니라 migration foundation이다.

최초 구현 목표:

```text
clonellm data/normalized
  -> versioned Open WebUI projection
  -> dry-run import 검증
  -> builder contract v1
  -> builder API v1
```

이 foundation이 있어야 Open WebUI에서 생성한 컨셉서, Knowledge 검색 결과, builder 실행 결과가 같은 truth 위에서 움직인다.

---

## Claude 최종 보완 (2026-04-28)

Codex의 최종 Phase Plan은 전체 방향이 맞다. 개발 착수 기준(Phase 0D 완료 전 API 구현 금지)도 타당하다.

아래는 개발에 들어가기 전에 확정이 필요한 3개 항목이다.

---

### 보완 A — Feedback Payload Schema는 Phase 0B에서 확정해야 한다

현재 Phase 1.5에 "critic result → KB export payload", "contract violation → KB export payload"가 배정돼 있다. 그런데 이 payload의 shape이 Phase 0B Projection Schema에 포함되지 않으면, Phase 1.5에서 임시 포맷을 만들게 된다. 나중에 Open WebUI import 자동화(Phase 2.5)와 shape이 맞지 않는 문제가 생긴다.

따라서 **Phase 0B Projection Schema 산출물에 Feedback Projection Schema를 추가**한다.

#### 확정할 Feedback Projection Schema

```json
{
  "$schema": "feedback-projection-v1",
  "feedbackId": "fb-{draftId}-{sourceType}",
  "sourceType": "critic" | "human" | "contract-violation",
  "conceptThreadId": "thread-xxx",
  "draftId": "runtime-draft-xxx",
  "pageId": "home",
  "slots": ["hero", "quickmenu"],
  "tone": "premium",
  "verdict": "passed" | "failed" | "approved" | "rejected" | "revision_requested" | "violation",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "actionableSignals": ["string"],
  "qualityScore": 0.0,
  "violationDetail": {
    "rule": "asset-role-policy",
    "attempted": "promo-complete as hero background",
    "blocked": "background-only policy"
  },
  "targetCollection": "lge-design-history" | "lge-policy",
  "projectionVersion": "feedback-projection-v1",
  "generatedAt": "ISO8601"
}
```

- `critic` 피드백은 `lge-design-history`로
- `human` 피드백은 `lge-design-history`로
- `contract-violation` 피드백은 `lge-policy`로

이 schema를 Phase 0B에서 확정하면 Phase 1.5 구현이 schema를 따르게 되고, Phase 2.5 human feedback도 동일 포맷을 재사용한다.

---

### 보완 B — Phase 0D Dry-run 통과 기준 (pass/fail criteria)

Phase 0D는 "대표 파일 5개 migration 검증"인데, 무엇이 통과이고 무엇이 실패인지 기준이 없다. 기준 없이는 dry-run이 완료 신호를 줄 수 없다.

#### Pass 기준 (전부 만족해야 Phase 1 착수 가능)

| 검증 항목 | 통과 기준 |
|---|---|
| **Existence check** | 5개 대상 파일이 Phase 0A inventory에 존재 확인됨 (없으면 대체 파일로 교체) |
| **Knowledge projection 가독성** | projection Markdown을 LLM에 직접 던져 "home hero slot에 어떤 asset을 쓸 수 있는가?"를 물었을 때 올바른 답변 반환 |
| **Builder contract roundtrip** | Builder contract projection을 `validateConceptPayload()`에 통과시켰을 때 validation 오류 없음 |
| **Projection consistency** | 같은 source의 Knowledge projection과 Builder contract가 동일 asset에 대해 상충하는 내용 없음 (export script consistency check 통과) |
| **import-manifest.json 정합성** | 모든 projection 파일의 실제 hash가 manifest에 기록된 hash와 일치 |
| **Ontology edge 최소 검증** | `home.hero` component가 `Page -> has_slot -> Slot -> implemented_by -> Component` path로 조회 가능 |

Phase 0D에서 위 6개 중 하나라도 실패하면 Phase 1을 시작하지 않는다.

단, Phase 0A inventory에서 원래 대상 파일 일부가 존재하지 않는 것으로 확인되면, 존재하는 파일로 대체하고 Phase 0D 대상 파일 목록을 갱신한다. `image-asset-registry.json`과 `asset-role-policies.json`은 존재 여부 미확인 상태이므로 Phase 0A 이후 확정한다.

---

### 보완 C — ConceptThread ID 포맷 수정

현재 스펙의 `conceptThreadId: "thread-home-top-premium-20260428"` 는 타임스탬프와 의미 슬러그를 결합한 형태다. 두 가지 문제가 있다.

1. **충돌 가능**: 같은 날 두 기획자가 `home-top-premium` 작업을 시작하면 동일한 ID가 생성된다
2. **tone이 ID에 포함됨**: tone이 바뀌어도 같은 thread면 ID가 맞지 않는 상황 발생

#### 권고 포맷

```json
{
  "conceptThreadId": "ct-{uuid-v4}",
  "name": "home-top-premium-2026q2",
  "projectId": "lge-home-2026-q2",
  "pageId": "home",
  "targetGroup": "home-top",
  "createdAt": "2026-04-28T10:00:00Z",
  "createdBy": "planner-kim"
}
```

- `conceptThreadId`는 UUID v4 기반으로 충돌 없이 생성
- `name`은 사람이 읽기 쉬운 선택 필드, 중복 허용
- builder API에서는 `conceptThreadId`(UUID)를 stable key로 사용
- Open WebUI UI에서는 `name`으로 표시

이 변경은 builder API v1 스펙 확정 전에 반영해야 한다.

---

### Phase 0B 산출물 최종 목록

위 보완을 반영해 Phase 0B Projection Schema 산출물을 확정한다.

```text
docs/openwebui-projection-schema-v1.md
data/normalized/openwebui-projection-schema-v1.json

포함 schema:
  1. Knowledge projection schema
  2. Ontology projection schema (ConceptThread 포함)
  3. Builder contract projection schema
  4. Feedback projection schema (FL1/FL2/FL3 공통 포맷)
  5. import-manifest.json schema
  6. ConceptThread ID 포맷 (UUID v4 기반)
```

Feedback projection schema가 여기서 확정돼야 Phase 1.5 구현이 schema를 따를 수 있다.

## Codex 최종 보정 — Ontology Validation / Schema Gate 확정 (2026-04-28)

Claude의 8라운드 보완은 수용한다.

다만 Phase 0A 개발에 들어가기 전에 아래 항목을 더 닫아야 한다.

핵심 원칙:

```text
Ontology는 최종 판정자가 아니다.
Ontology는 관계 지도, 추적 장부, stale 감지 레이어다.
최종 실행 판정은 Builder Contract와 Runtime Validation이 한다.
```

따라서 Phase 0B/0D의 gate는 LLM 판단이 아니라 deterministic validation으로 닫는다.

### 1. Feedback Projection Schema는 실제 JSON Schema로 정의

Claude가 제안한 feedback payload shape는 방향이 맞다.

하지만 문서의 예시는 JSON code block 안에 TypeScript union 문법이 들어가 있다.

Phase 0B 산출물에는 아래처럼 실제 JSON Schema 형식으로 고정한다.

```json
{
  "$id": "feedback-projection-v1",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": [
    "feedbackId",
    "sourceType",
    "pageId",
    "verdict",
    "targetCollection",
    "projectionVersion",
    "generatedAt"
  ],
  "properties": {
    "feedbackId": { "type": "string", "minLength": 1 },
    "sourceType": {
      "type": "string",
      "enum": ["critic", "human", "contract-violation"]
    },
    "conceptThreadId": { "type": "string" },
    "draftId": { "type": "string" },
    "pageId": { "type": "string", "minLength": 1 },
    "slots": {
      "type": "array",
      "items": { "type": "string" }
    },
    "tone": { "type": "string" },
    "verdict": {
      "type": "string",
      "enum": [
        "passed",
        "failed",
        "passed-with-warning",
        "approved",
        "rejected",
        "revision_requested",
        "violation"
      ]
    },
    "strengths": {
      "type": "array",
      "items": { "type": "string" }
    },
    "weaknesses": {
      "type": "array",
      "items": { "type": "string" }
    },
    "actionableSignals": {
      "type": "array",
      "items": { "type": "string" }
    },
    "qualityScore": {
      "type": "number",
      "minimum": 0,
      "maximum": 1
    },
    "violationDetail": {
      "type": "object",
      "properties": {
        "rule": { "type": "string" },
        "attempted": { "type": "string" },
        "blocked": { "type": "string" }
      },
      "additionalProperties": true
    },
    "targetCollection": {
      "type": "string",
      "enum": ["lge-design-history", "lge-policy"]
    },
    "projectionVersion": {
      "type": "string",
      "const": "feedback-projection-v1"
    },
    "generatedAt": {
      "type": "string",
      "format": "date-time"
    }
  },
  "additionalProperties": false
}
```

추가 validation:

```text
sourceType=critic              -> targetCollection=lge-design-history
sourceType=human               -> targetCollection=lge-design-history
sourceType=contract-violation  -> targetCollection=lge-policy
sourceType=contract-violation  -> violationDetail 필수
```

이 cross-field rule은 JSON Schema만으로 부족하면 `check-openwebui-export.mjs`에서 별도 검증한다.

### 2. Validator 경계 분리

현재 문서에는 `Builder contract projection을 validateConceptPayload()에 통과`시키는 표현이 있다.

이 경계는 분리한다.

```text
validateBuilderContract(contract)
  - export-builder-contract-v1 결과 자체가 valid한지 검증

validateConceptPayload(payload)
  - Open WebUI가 builder API에 보낸 request shape 검증

validateConceptAgainstContract(payload, contract)
  - concept target, slot, component, asset, viewport가 contract와 충돌하지 않는지 검증
```

Phase 0D pass 기준에는 세 validator가 모두 들어간다.

```text
1. validateBuilderContract(builder-contract-v1) pass
2. validateConceptPayload(sample-openwebui-request) pass
3. validateConceptAgainstContract(sample-openwebui-request, builder-contract-v1) pass
```

Builder API Phase 1에서도 동일한 순서를 사용한다.

### 3. LLM Readability Check는 Optional로 낮춤

Claude가 제안한 `Knowledge projection 가독성` 검증은 유용하지만 Phase 0D blocking gate로 두면 안 된다.

LLM 답변은 모델, temperature, retrieval 상태에 따라 흔들릴 수 있다.

따라서 Phase 0D blocking gate는 deterministic check로 구성한다.

Blocking gate:

```text
1. projection Markdown 생성 여부
2. required metadata 존재 여부
3. sourcePath/sourceHash/projectionVersion 존재 여부
4. target collection mapping 유효성
5. known phrase / known field coverage check
6. builder contract consistency check
```

Optional quality check:

```text
LLM에 projection Markdown을 읽히고
"home hero slot에 어떤 asset role이 허용되는가?"를 물어본다.
```

이 optional check는 품질 참고용이며, Phase 1 착수 blocking 조건이 아니다.

### 4. Canonical Ontology Edge List 갱신

문서 앞쪽의 ontology edge 초안은 이후 논의와 불일치한다.

Phase 0B에서 아래 목록을 canonical edge list v1로 고정한다.

```text
Page -> has_slot -> Slot
Slot -> implemented_by -> Component
Component -> belongs_to_family -> ComponentFamily
ComponentFamily -> governed_by -> SectionFamilyContract
Slot -> governed_by -> AssetRolePolicy
Asset -> usable_for -> Slot
Asset -> has_variant -> AssetVariant
AssetVariant -> targets_viewport -> ViewportProfile
ConceptDocument -> targets -> Page / Slot / Component
ConceptDocument -> starts -> ConceptThread
ConceptThread -> contains -> ConceptDocument
ConceptThread -> contains -> DraftBuild
DraftBuild -> belongs_to -> ConceptThread
BuilderRun -> executes -> ConceptDocument
DraftBuild -> generated_from -> BuilderRun
DraftBuild -> revised_from -> DraftBuild
Evaluation -> reviews -> DraftBuild
Decision -> accepts/rejects/requests_revision -> DraftBuild
Handoff -> implements -> DraftBuild
```

Phase 1에서 제외:

```text
full journey graph
detailed DOM node graph
every screenshot crop as entity
every prompt token/history as entity
```

### 5. Ontology Validation Rules

Ontology projection은 최소한 아래 validation을 통과해야 한다.

```text
Referential integrity
  - 모든 edge source/target entity가 존재한다.

Cardinality
  - DraftBuild -> belongs_to -> ConceptThread 는 정확히 1개다.
  - ConceptDocument -> starts -> ConceptThread 는 신규 thread 생성 시 1개다.

External key integrity
  - Page/Slot/Component/Asset externalKeys.clonellm 값이 builder contract에 존재한다.

Role constraint
  - Asset -> usable_for -> Slot 관계가 AssetRolePolicy와 충돌하지 않는다.
  - promo-complete asset은 hero background usable_for로 export되면 실패한다.

Viewport constraint
  - AssetVariant -> targets_viewport 값은 pc/mo/ta 중 하나다.
  - viewport-specific asset은 해당 viewport contract에만 나타난다.

Freshness gate
  - truthLevel=runtime-truth 또는 policy 인 entity는 sourceHash와 freshness를 가져야 한다.
  - stale policy는 builderContract current set에 들어갈 수 없다.

Provenance
  - ontology entity는 sourcePath, sourceHash, projectionVersion을 추적 가능해야 한다.
```

이 validation은 `scripts/check-openwebui-export.mjs`에서 실행한다.

### 6. 존재 확인된 Phase 0D 대상 파일

로컬 기준으로 아래 파일은 존재한다.

```text
data/normalized/section-family-contracts.json
data/normalized/component-rebuild-schema-catalog.json
data/normalized/image-asset-registry.json
data/normalized/asset-role-policies.json
data/normalized/page-runtime-status.json
```

따라서 이전 문서의 "image-asset-registry.json과 asset-role-policies.json은 존재 여부 미확인" 문구는 Phase 0A 이후 갱신 대상이 아니라, 현재 기준으로는 존재 확인된 것으로 본다.

Phase 0A inventory script가 최종 확인 source가 된다.

### 7. Phase 0D 최종 Pass/Fail Gate

Phase 0D는 아래 gate를 모두 통과해야 Phase 1로 넘어간다.

| Gate | Blocking | 통과 기준 |
|---|---:|---|
| Source existence | Yes | 5개 대표 파일이 inventory에 존재 |
| Source hash | Yes | manifest hash와 실제 파일 hash 일치 |
| Knowledge projection metadata | Yes | collection, truthLevel, sourcePath, sourceHash, projectionVersion 존재 |
| Builder contract validation | Yes | `validateBuilderContract()` pass |
| Concept payload validation | Yes | sample payload가 `validateConceptPayload()` pass |
| Concept vs contract validation | Yes | sample payload가 `validateConceptAgainstContract()` pass |
| Projection consistency | Yes | Knowledge와 Builder contract가 asset role/usage에 대해 충돌하지 않음 |
| Ontology referential integrity | Yes | 모든 edge source/target 존재 |
| Ontology canonical path | Yes | `home.hero`가 `Page -> has_slot -> Slot -> implemented_by -> Component`로 조회 가능 |
| Ontology role constraint | Yes | forbidden asset-slot relation이 export되지 않음 |
| import-manifest integrity | Yes | 모든 projection file hash 일치 |
| LLM readability | No | optional quality note로만 기록 |

### 8. 최종 개발 착수 기준

Phase 0A 구현에 들어가기 전 문서상 남은 결정을 이 섹션으로 닫는다.

확정:

```text
1. Feedback schema는 JSON Schema enum 기반으로 작성한다.
2. Ontology는 판정자가 아니라 관계/추적/검증 보조 레이어다.
3. Builder Contract가 실행 전 최종 machine validation 권한을 가진다.
4. Runtime Validation이 최종 렌더 결과를 검증한다.
5. Phase 0D gate는 deterministic test만 blocking으로 둔다.
6. LLM readability check는 optional이다.
7. Phase 0D 통과 전 Builder API와 Open WebUI Action Function은 구현하지 않는다.
```

이 기준으로 Phase 0A Source Inventory 개발에 들어갈 수 있다.

## Claude 확인 — Phase 0A 착수 가능 / Phase 0B 전 정책 결정사항 (2026-04-28)

Claude가 Codex 최종 보정 섹션을 확인했다.

결론:

```text
Phase 0A Source Inventory 착수 기준은 문서상으로 닫혔다.
```

다만 Phase 0B Projection Schema와 Phase 0C export scripts를 작성하기 전 아래 두 정책은 확정해야 한다.

### 1. Schema extension policy

현재 feedback schema는 아래 정책을 사용한다.

```json
{
  "additionalProperties": false
}
```

의미:

```text
schema v1에 정의되지 않은 필드는 허용하지 않는다.
새 필드가 필요하면 schema v2로 버전 bump한다.
```

장점:

- projection shape가 안정적이다.
- Open WebUI import와 builder validation이 예측 가능하다.
- 임시 debug field가 canonical artifact에 섞이는 것을 막는다.

단점:

- 운영 중 debug field를 추가하려면 매번 schema 변경 또는 별도 sidecar가 필요하다.
- 빠른 실험에는 답답할 수 있다.

결정:

```text
Canonical projection schema는 additionalProperties: false를 유지한다.
Debug / trace / experimental 값은 canonical projection에 넣지 않고 별도 meta/debug sidecar에 둔다.
```

권장 sidecar:

```text
exports/openwebui/debug/
exports/openwebui/traces/
```

즉 v1 projection은 엄격하게 유지하고, 확장이 필요하면 다음 중 하나를 택한다.

```text
1. schema v2로 bump
2. non-canonical debug sidecar에 저장
```

### 2. Stale policy definition

Ontology validation rule에는 다음 원칙이 있다.

```text
stale policy는 builderContract current set에 들어갈 수 없다.
```

Phase 0B/0C 전에 `stale` 판단 기준을 고정한다.

#### Policy data

`truthLevel=policy` 데이터는 sourceHash 기반으로 stale 여부를 판단한다.

```text
fresh:
  import-manifest.json의 sourceHash가 현재 sourceHash와 일치

stale:
  source file hash가 바뀌었지만 projection/export가 갱신되지 않음
```

TTL은 적용하지 않는다.

이유:

- policy는 시간이 지났다는 이유만으로 stale이 되지 않는다.
- source가 변경됐는데 projection이 따라오지 않았을 때 stale이다.

#### Runtime truth data

`truthLevel=runtime-truth` 데이터는 sourceHash와 TTL을 함께 본다.

```text
fresh:
  sourceHash 일치
  TTL 이내

stale:
  sourceHash 불일치
  또는 TTL 초과
```

초기 TTL 기본값:

```text
runtime-truth TTL: 7일
```

#### Candidate data

`truthLevel=candidate` 데이터는 status와 sourceHash를 함께 본다.

```text
fresh:
  sourceHash 일치
  status가 candidate/approved/blocked/retired 중 하나로 명시됨

stale:
  sourceHash 불일치
  또는 status 누락
```

#### Historical data

`truthLevel=historical` 데이터는 stale로 전환하지 않는다.

대신 snapshot provenance만 보존한다.

```text
historical:
  sourcePath
  sourceHash 권고
  generatedAt 또는 capturedAt 권고
```

#### Legacy reference

`truthLevel=legacy-reference` 데이터는 builder contract current set에 들어갈 수 없다.

Knowledge에는 들어갈 수 있지만, RAG 응답에는 legacy 표시가 필요하다.

### 3. Phase impact

Phase 0A에는 영향 없다.

Phase 0A는 실제 파일 목록과 schema fingerprint를 추출하는 작업이므로 위 두 정책이 없어도 시작할 수 있다.

Phase 0B부터는 반드시 반영한다.

```text
Phase 0A:
  source inventory 가능

Phase 0B:
  additionalProperties policy 반영
  stale policy definition 반영

Phase 0C:
  check-openwebui-export.mjs에서 stale 판단 구현
  import-manifest hash validation 구현
```

### 최종 착수 상태

```text
Phase 0A Source Inventory: 착수 가능
Phase 0B Projection Schema: 위 두 정책 반영 후 착수
Phase 0C Export Scripts: Phase 0B schema 확정 후 착수
```

## Auth / Session Integration Plan (2026-04-28)

Open WebUI 통합 시 로그인과 세션은 반드시 하나로 모아야 한다.

현재 `clonellm`에는 자체 login/session 구조가 있다.

```text
clonellm login
lge_workspace_session cookie
auth.js workspace/session handling
```

하지만 Open WebUI가 core가 되면 사용자, 프로젝트, 권한, artifact ownership은 Open WebUI가 source of truth가 되어야 한다.

따라서 통합 후 기본 방향은 다음이다.

```text
Open WebUI = identity / user / project / permission source of truth
clonellm = Open WebUI가 호출하는 builder/runtime service
```

### 1. 기본 원칙

```text
1. 사용자는 Open WebUI에만 로그인한다.
2. clonellm 일반 사용자 로그인 화면은 본선 flow에 노출하지 않는다.
3. builder API는 Open WebUI가 서명한 요청만 받는다.
4. runtime preview는 short-lived signed preview token으로 접근한다.
5. clonellm 자체 login은 admin/debug mode로만 유지한다.
```

### 2. 권장 구조

```text
User
  -> Open WebUI login
  -> Open WebUI session
  -> Open WebUI Action Function / backend call
  -> clonellm builder API
       Authorization: Bearer <OpenWebUI service token or signed request>
  -> clonellm returns jobId / artifact / preview token
  -> Open WebUI shows preview iframe/link
       /runtime-draft/:draftId?token=:previewToken
```

### 3. Builder API 인증

Builder API는 Open WebUI에서 온 요청만 허용한다.

Phase 1에서는 service-to-service signed request를 우선한다.

요청 예:

```http
POST /api/builder/lge/v1/draft
Authorization: Bearer <openwebui-builder-service-token>
X-OpenWebUI-User-Id: <owui-user-id>
X-OpenWebUI-Project-Id: <owui-project-id>
X-OpenWebUI-Request-Id: <request-id>
```

검증:

```text
1. Authorization token 유효성 확인
2. token scope에 builder:write 포함
3. userId/projectId 존재 확인
4. requestId 기록
5. job/artifact에 external owner metadata 저장
```

Artifact owner metadata:

```json
{
  "externalOwner": {
    "provider": "open-webui",
    "userId": "owui-user-id",
    "projectId": "owui-project-id",
    "requestId": "owui-request-id"
  }
}
```

### 4. Preview 인증

Open WebUI iframe 또는 preview link에서 clonellm cookie를 요구하면 안 된다.

따라서 preview는 signed preview token을 사용한다.

URL:

```text
/runtime-draft/:draftBuildId?token=:previewToken
/runtime-compare/:draftBuildId?token=:compareToken
```

Preview token payload:

```json
{
  "type": "preview",
  "draftBuildId": "runtime-draft-xxx",
  "projectId": "owui-project-id",
  "userId": "owui-user-id",
  "scope": ["preview:read"],
  "expiresAt": "2026-05-05T00:00:00.000Z"
}
```

권장:

```text
signature: HMAC-SHA256
ttl: 7일
scope: preview:read only
mutation: forbidden
```

Preview token은 draft/compare 읽기 전용이다.

이 token으로 builder API, workspace mutation, publish API를 호출할 수 없어야 한다.

### 5. Same-origin / Reverse Proxy 선택지

배포 시 reverse proxy로 같은 origin에 묶는 방식은 권장 가능하다.

예:

```text
https://app.example.com/
  -> Open WebUI

https://app.example.com/builder/
  -> clonellm
```

장점:

```text
CORS 단순화
iframe 제약 감소
cookie SameSite 이슈 완화
preview URL 관리 용이
```

주의:

```text
same-origin 배포만으로 로그인 통합이 끝나지는 않는다.
clonellm은 여전히 Open WebUI token 또는 signed request를 검증해야 한다.
```

### 6. clonellm 기존 로그인 처리

기존 `clonellm` login은 제거하지 않는다.

대신 역할을 축소한다.

```text
본선 사용자 flow:
  Open WebUI login only

clonellm login:
  local development
  admin/debug
  emergency direct access
```

본선 UI에서는 `clonellm` login path를 노출하지 않는다.

### 7. Ownership 경계

Open WebUI가 canonical artifact owner다.

clonellm은 다음 정보만 preview/runtime cache로 보관한다.

```text
draftBuildId
jobId
externalOwner metadata
preview token metadata
artifact snapshot copy
debug trace
TTL
```

Open WebUI 저장이 완료되면 job ack를 보낼 수 있다.

```http
POST /api/builder/lge/v1/jobs/:jobId/ack
Authorization: Bearer <openwebui-builder-service-token>
```

ack 이후 clonellm cache는 TTL 정책에 따라 정리 가능하다.

### 8. Security guardrails

```text
1. Preview token은 read-only다.
2. Preview token은 draftBuildId와 scope에 묶인다.
3. Builder API token과 preview token은 분리한다.
4. Open WebUI userId/projectId를 clonellm local user로 자동 생성하지 않는다.
5. externalOwner metadata만 저장하고, user authority는 Open WebUI가 판단한다.
6. token 검증 실패 시 clonellm login으로 redirect하지 말고 401/403을 반환한다.
7. iframe preview에서 mutation endpoint를 호출할 수 없어야 한다.
```

### 9. Phase 반영

Auth/session 통합은 Phase 1/2에 걸쳐 반영한다.

```text
Phase 0A-0D:
  영향 없음
  source inventory / projection / dry-run migration은 auth와 독립

Phase 1:
  builder API service token 검증
  externalOwner metadata 저장
  signed preview token 발급
  runtime-draft/runtime-compare token read path 허용

Phase 1.5:
  job ack endpoint
  draft cache TTL cleanup
  token expiry cleanup

Phase 2:
  Open WebUI Action Function에서 builder token 사용
  preview iframe/link를 token 포함 URL로 표시

Phase 3:
  reverse proxy / same-origin 배포 검토
  Idea Bench iframe grid 인증 안정화
```

### 10. 최종 결정

로그인 통합 방향은 아래로 고정한다.

```text
Open WebUI login/session = canonical identity
clonellm auth = builder API token + preview token validation
clonellm local login = admin/debug only
```

이 방식이면 사용자는 Open WebUI에만 로그인하고, `clonellm` preview와 builder 실행은 Open WebUI 소유의 요청으로 처리된다.
