# Atlas Ontology Knowledge Graph Plan

## Decision

Atlas will build its own internal knowledge graph system without Neo4j.

The target architecture is:

- OpenWebUI remains the chat, permission, sharing, and entry-point surface.
- LightRAG is not adopted as a backend solution. Its WebUI graph visualization pattern is reference material only.
- `ontology-service` is a separate service, not code inside `server.js`.
- SQLite stores graph, document, provenance, job, and collaboration records.
- Qdrant stores semantic vectors and metadata filters.
- OpenRouter embeddings are used through an adapter first, with a planned local embedding adapter replacement.
- Qdrant is not exposed to clients. All access goes through `ontology-service`.
- Neo4j, TrustGraph, and Graphiti remain future research options only, not target dependencies.

## Service Boundary

```text
OpenWebUI
  Atlas Pipe
  Knowledge entry points
  Chat and sharing UX
        |
        v
clonellm builder
  concept-preview
  authoringPlan
  prebuild/build
  draft artifacts
        |
        v
ontology-service
  ingestion
  chunking
  extraction
  graph persistence
  vector upsert/search
  retrieval
  conflict/provenance/impact APIs
        |
        +--> SQLite
        +--> Qdrant
```

`server.js` only calls `ontology-service` over HTTP for builder-time policy retrieval, build-result registration, and graph UI proxying where needed.

## Primary Queries

The schema and vector strategy are driven by these queries:

| ID | Query | Primary method |
| --- | --- | --- |
| Q1 | Which policies apply to this requirement? | Qdrant policy-rule search + graph scope filter |
| Q2 | Does this concept conflict with any policy? | Qdrant candidate mapping + SQLite `CONFLICTS_WITH` traversal |
| Q3 | Which previous builds succeeded for the same page/component/tone? | Graph filter + Qdrant similarity + approval ranking |
| Q4 | What is affected if this policy changes? | SQLite recursive CTE impact traversal |
| Q5 | Which previous concepts are semantically similar? | Qdrant concept chunk search |
| Q6 | Which shared artifacts are most accepted by a team? | SQLite graph + aggregate ranking |
| Q7 | Which design patterns are reusable for this component? | Graph filter + artifact/design-reference vectors |
| Q8 | What is the provenance of this artifact? | SQLite recursive CTE lineage traversal |

## SQLite Graph Schema

SQLite is not a graph database, so graph traversal must be explicit, bounded, and indexed.

```sql
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  node_type TEXT NOT NULL,
  title TEXT,
  content TEXT,
  properties_json TEXT NOT NULL DEFAULT '{}',
  source_type TEXT,
  source_id TEXT,
  content_hash TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_nodes_type ON nodes(node_type);
CREATE INDEX idx_nodes_source ON nodes(source_type, source_id);
CREATE INDEX idx_nodes_hash ON nodes(content_hash);

CREATE TABLE edges (
  id TEXT PRIMARY KEY,
  from_node_id TEXT NOT NULL,
  to_node_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  properties_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(from_node_id, to_node_id, relation_type)
);

CREATE INDEX idx_edges_from ON edges(from_node_id, relation_type);
CREATE INDEX idx_edges_to ON edges(to_node_id, relation_type);
CREATE INDEX idx_edges_relation ON edges(relation_type);
```

All traversal APIs must enforce:

- `maxDepth` default: 6
- `maxDepth` hard limit: 8
- `maxNodes` default: 500
- visited-node protection to avoid cycles
- allowed relation filters per API

### Provenance Traversal

Artifact lineage is a bounded reverse/forward traversal:

```text
Artifact -> Build -> ConceptDocument -> Requirement -> PolicyRule -> PolicyDocument
```

Example query shape:

```sql
WITH RECURSIVE lineage(node_id, depth, path) AS (
  SELECT :artifactNodeId, 0, :artifactNodeId
  UNION ALL
  SELECT e.to_node_id, lineage.depth + 1, path || '>' || e.to_node_id
  FROM edges e
  JOIN lineage ON e.from_node_id = lineage.node_id
  WHERE lineage.depth < :maxDepth
    AND e.relation_type IN ('BUILT_FROM', 'SATISFIES', 'DERIVED_FROM', 'HAS_RULE')
    AND instr(path, e.to_node_id) = 0
)
SELECT node_id, depth, path
FROM lineage
LIMIT :maxNodes;
```

### Impact Traversal

Policy impact is a reverse dependency traversal:

```text
PolicyRule -> Requirement -> ConceptDocument -> Build -> Artifact
```

```sql
WITH RECURSIVE impact(node_id, depth, path) AS (
  SELECT :policyRuleNodeId, 0, :policyRuleNodeId
  UNION ALL
  SELECT e.from_node_id, impact.depth + 1, path || '>' || e.from_node_id
  FROM edges e
  JOIN impact ON e.to_node_id = impact.node_id
  WHERE impact.depth < :maxDepth
    AND e.relation_type IN ('USES_RULE', 'DERIVED_FROM', 'SATISFIES', 'BUILT_FROM', 'PRODUCED')
    AND instr(path, e.from_node_id) = 0
)
SELECT node_id, depth, path
FROM impact
LIMIT :maxNodes;
```

## Node Types

Core node types:

- `PolicyDocument`
- `PolicyRule`
- `Requirement`
- `ConceptDocument`
- `AuthoringPlan`
- `Build`
- `Artifact`
- `Page`
- `Component`
- `Asset`
- `DesignReference`
- `User`
- `Team`
- `Project`
- `Share`
- `Approval`
- `Comment`
- `Decision`

Core relations:

```text
PolicyDocument -HAS_RULE-> PolicyRule
PolicyDocument -SUPERSEDES-> PolicyDocument
PolicyRule -APPLIES_TO-> Page / Component
PolicyRule -CONFLICTS_WITH-> PolicyRule

Requirement -DERIVED_FROM-> PolicyRule / PolicyDocument
Requirement -TARGETS-> Page / Component

ConceptDocument -SATISFIES-> Requirement
ConceptDocument -USES_RULE-> PolicyRule
ConceptDocument -CONFLICTS_WITH-> PolicyRule
ConceptDocument -SUPERSEDES-> ConceptDocument

AuthoringPlan -PLANS_FOR-> ConceptDocument
Build -BUILT_FROM-> ConceptDocument
Build -USED_PLAN-> AuthoringPlan
Build -PRODUCED-> Artifact

Artifact -IMPLEMENTS-> PolicyRule
Artifact -TARGETS-> Page / Component
Artifact -USES_ASSET-> Asset
Artifact -REFERENCES-> DesignReference

User -AUTHORED-> PolicyDocument / ConceptDocument
User -EXECUTED-> Build
User -SHARED-> Artifact / ConceptDocument
User -APPROVED / REJECTED / BOOKMARKED-> Artifact
User -COMMENTED_ON-> Artifact / ConceptDocument
Team -HAS_MEMBER-> User
Project -BELONGS_TO-> Team
Project -CONTAINS-> Page
```

## Qdrant Vector Design

Qdrant stores semantic search data only. It is not the source of truth for permissions or graph relations.

Collection:

```text
atlas_knowledge_chunks
```

Initial vector contract is BGE-M3 compatible:

```text
dimension: 1024
distance: COSINE
hnsw.m: 16
hnsw.ef_construct: 200
```

Reasoning:

- The system is Korean-first.
- Local embedding replacement is a stated goal.
- BGE-M3 and multilingual-e5-large both fit the 1024-dimension local path.
- OpenRouter embeddings are temporary behind an adapter.
- If a 1536/3072-dimension hosted model is selected temporarily, it must use a separate collection name and trigger a full re-embed plan.

Collection naming convention:

```text
atlas_knowledge_chunks_bge_m3_1024
atlas_knowledge_chunks_openai_3_small_1536
```

The active collection is resolved from service config:

```text
ONTOLOGY_EMBEDDING_PROVIDER=openrouter
ONTOLOGY_EMBEDDING_MODEL=<provider/model>
ONTOLOGY_EMBEDDING_DIMENSIONS=1024
ONTOLOGY_QDRANT_COLLECTION=atlas_knowledge_chunks_bge_m3_1024
```

### Qdrant Payload Contract

Required payload fields:

```text
tenantId
teamId
projectId
visibility
sourceType
sourceId
chunkId
chunkType
chunkIndex
nodeId
parentNodeId
pageId
componentId
slotId
ruleType
severity
policyStatus
policySeverity
conceptHash
conceptJobId
draftBuildId
authoringPlanHash
contentHash
embeddingModel
embeddingProvider
embeddingDimensions
createdAt
updatedAt
```

Payload filters are performance and relevance filters only. They are not security controls.

Security rules:

- Qdrant is private to `ontology-service`.
- Clients never receive Qdrant credentials.
- Clients never call Qdrant directly.
- `ontology-service` performs authentication and authorization before vector search.
- Qdrant `tenantId`, `teamId`, `projectId`, and `visibility` are pre-filters after service-level permission checks.

## Embedding and Chunking

Embedding adapter interface:

```text
embedTexts({
  texts,
  model,
  dimensions,
  inputType: 'query' | 'document'
}) -> [{ vector, model, dimensions }]
```

Chunking strategy:

| Source | Chunk unit | Vector? |
| --- | --- | --- |
| PolicyDocument | heading section, then PolicyRule candidate | yes |
| PolicyRule | one rule per vector | yes |
| Requirement | full requirement | yes |
| ConceptDocument | document summary + section chunks | yes |
| Artifact | summary + pageId + slotIds + visual intent only | yes |
| DesignReference | reference summary + role/scope | yes |
| Build | graph only | no |
| User/Team/Project | graph only | no |
| Share/Approval/Comment | graph/ranking only | no by default |

HTML artifacts are not embedded directly. The service stores a summary and stable pointer to the draft artifact.

## Conflict Detection

Conflict detection uses a hybrid approach:

1. Split the concept into section chunks.
2. Search Qdrant for relevant `PolicyRule` candidates using the concept chunk text.
3. Filter candidates by `pageId`, `componentId`, `slotId`, `ruleType`, `severity`, and policy status.
4. Traverse SQLite for candidate `PolicyRule -CONFLICTS_WITH-> PolicyRule`.
5. Check whether the conflicting rule also applies to the same target scope.
6. Return deterministic conflicts first.
7. Optionally run an LLM verifier on the top conflicts only.

LLM extraction is not the primary mapper. It is used only as a verifier or fallback because it is costly and less deterministic.

Conflict output:

```json
{
  "conceptId": "concept:...",
  "conflicts": [
    {
      "policyRuleId": "policy-rule:...",
      "conflictingPolicyRuleId": "policy-rule:...",
      "severity": "must",
      "confidence": 0.86,
      "evidenceChunkIds": ["chunk:..."],
      "description": "..."
    }
  ]
}
```

## OpenWebUI Knowledge Ingestion

The target flow is not to depend on OpenWebUI's internal Knowledge storage as the source of truth.

Decision:

- Add an Atlas Knowledge upload/registration entry point.
- OpenWebUI can link to it, but `ontology-service` owns ingestion state.
- Atlas Pipe can register policy/concept/build outputs directly with `ontology-service`.
- OpenWebUI Knowledge import can remain optional for plain RAG compatibility, not canonical ontology ingestion.

Flow:

```text
Planner uploads or registers policy document
  -> Atlas Knowledge upload UI/API
  -> ontology-service creates ingestion_job
  -> document parsed/chunked
  -> PolicyDocument/PolicyRule nodes stored in SQLite
  -> vectors upserted to Qdrant
  -> ingestion result visible in Knowledge Graph UI
```

Optional compatibility path:

```text
OpenWebUI Knowledge export/poll
  -> ontology-service importer
  -> canonicalize as PolicyDocument or DesignReference
```

This importer is secondary. It must not be the only ingestion path.

## Graph UI

Atlas Knowledge Graph UI is a first-class Atlas UI, not a LightRAG embed.

Implementation target:

- React
- sigma.js
- `@react-sigma/core`
- graphology
- ForceAtlas2 layout
- lucide-react

Placement:

```text
clonellm web/admin-research.html
  -> link to /atlas/knowledge-graph

web/atlas-knowledge-graph/
  -> built static UI or integrated admin module
```

Serving and auth:

- UI is served by `clonellm` to reuse existing session and deployment.
- UI API calls go to `clonellm` proxy endpoints or directly to `ontology-service` only from same trusted internal network.
- Browser clients do not receive Qdrant credentials.
- Browser clients do not call Qdrant.
- Authorization is checked before graph data is returned.

Primary views:

- Graph Overview
- Policy Impact View
- Concept Provenance View
- Artifact Lineage View
- Similar Pattern View
- Conflict View

Graph UI work should run in parallel with concept/build integration because it is also the development verification surface.

## Document Updates and Re-embedding

Policy updates are versioned, not overwritten.

```text
PolicyDocument v2 -SUPERSEDES-> PolicyDocument v1
```

Update flow:

1. Compute `contentHash`.
2. If unchanged, mark ingestion job as `skipped_unchanged`.
3. If changed, create a new `PolicyDocument` version.
4. Mark previous version `deprecated` or `superseded`.
5. Insert new PolicyRule nodes and new chunks.
6. Upsert new vectors to Qdrant.
7. Soft-delete old chunk payloads with `policyStatus=deprecated`, or hard-delete when retention expires.
8. Record impact candidates using reverse graph traversal.
9. Mark dependent concepts/builds with `policyReviewStatus=needs_review` if they used superseded rules.

Qdrant points use `contentHash` and `embeddingModel` for idempotency. Re-embedding is required when either content or embedding model changes.

## Ingestion Jobs

Ingestion must be restartable and idempotent.

```sql
CREATE TABLE ingestion_jobs (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_uri TEXT,
  status TEXT NOT NULL,
  content_hash TEXT,
  chunk_offset INTEGER NOT NULL DEFAULT 0,
  total_chunks INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  error_at INTEGER,
  locked_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(source_type, source_id, content_hash)
);
```

Statuses:

```text
queued
parsing
extracting
embedding
upserting
completed
skipped_unchanged
failed_retryable
failed_terminal
cancelled
```

Retry policy:

- retry transient parse/embed/Qdrant errors
- never duplicate nodes, edges, or chunks with the same source/content hash
- resume from `chunk_offset`
- terminal fail after configured max attempts

## Implementation Sequence

### Stage 1: Schema and Contracts

- Create `ontology-service` package boundary.
- Define SQLite schema for nodes, edges, documents, chunks, ingestion jobs, and feedback records.
- Define Qdrant payload contract and collection naming.
- Define embedding adapter contract with 1024-dimension local-compatible default.
- Define graph traversal API contracts and bounded recursive CTE rules.

### Stage 2: Ingestion and Vector Storage

- Implement policy document registration API.
- Implement heading/rule chunking.
- Implement OpenRouter embedding adapter.
- Implement Qdrant upsert/search adapter.
- Implement idempotent ingestion jobs.

### Stage 3: Graph Retrieval

- Implement related policy retrieval.
- Implement provenance traversal.
- Implement impact traversal.
- Implement hybrid conflict detection.

### Stage 4: Builder Integration

- Inject related policy rules into concept-preview.
- Store `Requirement`, `ConceptDocument`, `AuthoringPlan`, `Build`, and `Artifact` nodes from existing builder flows.
- Link concept/build output to policy and provenance edges.

### Stage 5: Knowledge Graph UI

- Build Atlas graph explorer using sigma.js/graphology.
- Add node type filters, relation filters, search, detail panel, and conflict/provenance/impact views.
- Use this UI during Stage 4 verification, not after all backend work is done.

### Stage 6: Sharing and Internal Knowledge

- Store share, approval, rejection, bookmark, and comment relations.
- Rank reusable concepts/artifacts by scope, similarity, and team approval signals.
- Feed highly adopted patterns back into concept authoring context.

### Stage 7: Local Model Transition

- Add local embedding adapter.
- Re-embed collections into the 1024-dimension target collection when switching models.
- Keep OpenRouter adapter as an optional external provider only.

## Non-goals

- Do not add ontology ingestion or GraphRAG logic to `server.js`.
- Do not adopt Neo4j.
- Do not adopt LightRAG as the backend.
- Do not expose Qdrant to browsers or OpenWebUI clients.
- Do not build schedule/Gantt management directly; use future external tool integration if needed.
