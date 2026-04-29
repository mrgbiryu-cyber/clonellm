# Codex 수정 코드 검증 리포트

Date: 2026-04-18
Owner: 코드 단위 직접 확인
Status: 검증 완료

변경 범위: 미커밋 working tree (git diff HEAD 기준)
주요 수정 파일:

- `llm.js` +2127줄
- `server.js` +3428줄
- `web/admin-research.html` +2672줄
- `web/admin.html` +699줄
- `auth.js` +158줄

---

## 1. 올바르게 구현된 부분

### 1.1 Hard Visual Delta Gate — 정상 작동

pixelmatch 기반 픽셀 비교 → 임계값 미달 시 HTTP 409 + `status: "quality-failed"` 처리까지 완전히 연결되어 있다.

**server.js:5025-5031 — threshold 계산:**
```javascript
function getVisualDeltaThreshold(builderInput = {}) {
  const patchDepth = String(builderInput?.generationOptions?.patchDepth || "").trim();
  if (patchDepth === "full") return 0.02;
  if (patchDepth === "strong") return 0.015;
  if (patchDepth === "medium") return 0.006;
  if (patchDepth === "light") return 0.002;
  return 0.006;
}
```

**server.js:4996 — pixelmatch 실제 호출:**
```javascript
const changedPixels = pixelmatch(beforeCrop.data, afterCrop.data, diff.data, width, height, { threshold: 0.1 });
```

**server.js:21923-21926 — quality-failed 상태 저장:**
```javascript
saved = saveDraftBuild(user.userId, {
  ...saved,
  status: hardVisualGateFailed ? "quality-failed" : (saved?.status || "draft"),
  ...
```

**server.js:21986 — HTTP 409 반환:**
```javascript
return sendJson(res, 409, {
  error: "visual_quality_gate_failed",
  summary: buildResult.summary || "시안 생성 완료",
  draftBuildId: saved?.id || null,
  criticReport: saved?.report?.critic || buildResult.buildResult?.report?.critic || null,
  qualityGate: saved?.snapshotData?.qualityGate || null,
  buildResult: buildResult.buildResult || {},
});
```

판정: 정상. hard delta gate는 end-to-end로 연결되어 있다.

### 1.2 Visual Critic 흐름 연결 — 정상

`runVisualCriticForDraft` → `compareScreenshotDataUrls` → `handleLlmVisualCritic` → `normalizedVisualCritic` 흐름이 올바르게 연결되어 있다.

### 1.3 Structural Critic → Fix Pass → 1회 Retry — 정상

**llm.js:4479-4480:**
```javascript
if (retryTrigger?.shouldRetry) {
  const fixResult = await handleLlmFix(detailerInput, normalizedResult.buildResult);
```

fix 결과를 operations에 병합하고 governance 재적용까지 올바르게 처리한다.

---

## 2. 문제 있는 부분

### 2.1 [CRITICAL] replace_component_template 미구현 — 실행되지 않음

**위치:** `llm.js:4785-4787`

**코드:**
```javascript
if (op.action === "replace_component_template") {
  continue;
}
```

`continue`만 있고 아무 처리도 없다. operation이 완전히 버려진다.

**문제:**

LLM은 이 operation을 사용하도록 명시적으로 지시받는다.

**llm.js:2682:**
```
"Use only replace_component_template, update_component_patch, update_slot_text, update_hero_field, update_slot_image, and update_page_title.",
```

**llm.js:2958 — 예시까지 주입됨:**
```javascript
{ action: "replace_component_template", pageId: "home", slotId: "hero", componentId: "home.hero", familyId: "hero-carousel-composition", templateId: "hero-editorial-v1", summary: "히어로를 새 구조로 교체", ... }
```

governance 검증(llm.js:3978-3999)도 통과하고, changedTargets에도 `"template_replace"`로 기록된다.

**llm.js:4499:**
```javascript
changeType: action === "replace_component_template" ? "template_replace" : "component_patch",
```

그런데 applyOperations 함수에서는 실행 없이 버려진다.

`synthesizeComponentCompositionFromTemplateOperations`(llm.js:3449-3465)는 이 operation을 composition 문서로 변환하는 함수인데, 이것도 실제 HTML 렌더링이 아니라 report 기록용이다.

**결과:**

- LLM이 "hero를 editorial 구조로 전면 교체하라"는 `replace_component_template` operation을 생성한다
- validation 통과, changedTargets 기록
- `applyOperations`에서 `continue`로 버려짐
- 렌더링 결과는 원본 그대로
- 사용자는 변화가 있었다는 report만 보고 실제 시각 변화는 없음

이것이 "디자인이 약하다"는 근본 원인 중 하나다.

**필요한 조치:**

`replace_component_template`을 prompt에서 제거하거나, 실제 component renderer 호출로 연결하거나, 둘 중 하나를 선택해야 한다.

---

### 2.2 [HIGH] Visual Critic Fallback — 품질 게이트를 무력화

**위치:** `llm.js:4669-4678`, `llm.js:4696-4704`

**코드:**
```javascript
demoFallback: () => ({
  summary: "visual critic fallback",
  visualCritic: {
    scores: { hierarchy: 70, alignment: 70, referenceAlignment: 70, brandFit: 70, changeStrength: 70 },
    strengths: [],
    findings: [],
    targetSlots: [],
    retryTrigger: { shouldRetry: false, failedDimensions: [], instructions: [], targetSlots: [] },
  },
}),
```

`demoFallback`은 demo 모드일 때, 또는 API 호출 자체가 실패해서 fallback model로 재시도할 때 사용된다 (`llm.js:1445-1448`).

**문제:**

- 모든 score가 70으로 고정된다
- LLM 기반 critic threshold는 대부분 75~85 수준이므로 "70"은 warning이거나 fail 경계
- `retryTrigger.shouldRetry: false`로 고정되어 retry가 발생하지 않는다

**차이점:**

hard delta gate(pixelmatch 기반)는 별도로 작동하므로 fallback이 되어도 pixel 변화량은 측정된다. 단, LLM visual critic 기반 판단(hierarchy, alignment, brandFit 등)은 완전히 우회된다. demo 환경이나 API 실패 상황에서 시각 품질 검증이 동작하지 않는다.

**필요한 조치:**

fallback 시 `shouldRetry: true`, `failedDimensions: ["critic-unavailable"]`을 설정해서 최소한 retry는 트리거하거나, fallback 자체를 throw로 바꿔서 build를 failed로 처리해야 한다.

---

### 2.3 [HIGH] Admin UI — 409 quality-failed 응답 데이터 유실

**위치:** `web/admin-research.html:5137-5163`

**코드:**
```javascript
await fetchJson("/api/llm/build", {
  method: "POST",
  ...
});
setBuilderRunState(page.id, "idle");
await reloadCurrentPage();
...
} catch (error) {
  setBuilderRunState(page.id, "idle");
  renderPage(currentPageId);
  console.error("[admin-research] build failed", error);
  alert(`빌더 실행 실패: ${error.message || error}`);
}
```

**문제:**

서버가 HTTP 409로 반환할 때 body에는 다음이 포함된다:

```javascript
{
  error: "visual_quality_gate_failed",
  draftBuildId: ...,
  criticReport: ...,
  qualityGate: { hardDeltaFailed: true, changedRatio: 0.001, minChangedRatio: 0.006 },
  buildResult: { ... }
}
```

그런데 `fetchJson`이 non-2xx에서 throw하면 `error.message`만 남고 body 전체가 버려진다. catch 블록은 `error.message`만 `alert()`으로 보여준다.

**결과:**

- 사용자에게 "빌더 실행 실패: visual_quality_gate_failed" 같은 메시지만 나온다
- 실제로 draftBuildId가 생성되었고, criticReport와 qualityGate 데이터가 있다
- 이 데이터를 활용해서 "어떤 이유로 실패했고, 어떻게 수정하면 되는지" UI에 표시할 수 있는데 버려진다
- 실패한 draft 자체도 접근할 수 없게 된다

**필요한 조치:**

`fetchJson`이 non-2xx일 때 body를 parse해서 반환하거나, catch 블록에서 `error.response?.json()` 형태로 body를 읽어 UI에 표시해야 한다.

---

### 2.4 [MEDIUM] INTERNAL_VISUAL_CRITIC_KEY — 서버 재시작마다 무효화

**위치:** `server.js:84`

**코드:**
```javascript
const INTERNAL_VISUAL_CRITIC_KEY = String(process.env.INTERNAL_VISUAL_CRITIC_KEY || crypto.randomUUID()).trim();
```

env var가 없으면 서버 시작 시마다 새로운 UUID가 생성된다.

**server.js:454 — 검증:**
```javascript
if (criticKey !== INTERNAL_VISUAL_CRITIC_KEY) return null;
```

**server.js:4932 — URL 생성:**
```javascript
params.set("criticKey", INTERNAL_VISUAL_CRITIC_KEY);
```

**문제:**

visual critic 내부 preview URL에 criticKey가 포함된다. 서버가 재시작되면 기존에 생성된 preview URL의 criticKey가 무효화되어 screenshot 캡처에 실패한다. 개발 환경에서 서버를 재시작할 때마다 visual critic이 silent fail할 수 있다.

**필요한 조치:**

`.env` 파일에 `INTERNAL_VISUAL_CRITIC_KEY=<고정값>`을 설정하거나, 서버 최초 실행 시 파일로 저장하고 재시작 시 읽어오는 방식을 사용해야 한다.

---

### 2.5 [MEDIUM] Slot Registry Merge — 루트 레벨 불필요 속성 오염

**위치:** `server.js:3820-3825`

**코드:**
```javascript
return {
  ...(fallback || {}),
  ...(current || {}),
  pageId,
  slots: mergedSlots,
};
```

**문제:**

`fallback`과 `current`는 slot registry 객체 전체다. 이 객체들이 루트 레벨에 `sources`, `status`, `activeSourceId`, `version` 같은 속성을 가지고 있다면 return 객체에 포함된다. `pageId`와 `slots`는 명시적으로 덮어쓰지만 다른 속성들은 `current`의 값이 `fallback`을 덮어쓰면서 의도치 않게 병합된다.

예: `current.status = "validated"`가 있으면 merged registry에 `status: "validated"`가 포함된다.

**필요한 조치:**

```javascript
return {
  pageId,
  slots: mergedSlots,
};
```

필요한 필드만 명시적으로 반환해야 한다.

---

### 2.6 [MEDIUM] Visual Critic Retry — 빌드 재실행 없이 실패만 기록

**구조적 흐름 확인:**

- 구조 critic (`buildBuilderCriticReport`) → `shouldRetry: true` → fix pass 1회 실행 → 재적용 (**llm.js:4479-4488**) ← 정상
- visual critic (`runVisualCriticForDraft`) → `hardDeltaFailed: true` → HTTP 409 반환 (**server.js:21986**) ← 여기서 끝

**문제:**

visual critic이 실패하면 draft를 `quality-failed`로 저장하고 409를 반환한다. 하지만 자동 재빌드는 없다. `hardDeltaFailed`가 `retryTrigger.shouldRetry: true`를 설정하지만(`server.js:5158`), 이 retryTrigger는 draft report에 저장될 뿐 builder 재실행으로 연결되지 않는다.

**결과:**

- visual delta가 낮으면 사용자가 수동으로 다시 "빌드 실행"을 눌러야 한다
- 재실행해도 LLM이 동일한 operation을 생성할 가능성이 높다 (fix 지시 없이 재시작)
- `retryTrigger.instructions`가 존재하지만 다음 빌드에서 사용되지 않는다

**필요한 조치:**

visual critic fail 시 `retryTrigger.instructions`를 다음 빌더 실행의 fix hint로 넘기는 메커니즘이 필요하다. 또는 서버 side에서 visual fail → fix pass → 재빌드 loop를 추가해야 한다.

---

### 2.7 [LOW] networkidle 타임아웃 — 무한 polling 페이지에서 실패 가능

**위치:** `server.js:4948`

**코드:**
```javascript
await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
```

`networkidle`은 500ms 동안 네트워크 요청이 2개 이하일 때 완료 판정한다. real-time polling이나 websocket을 사용하는 페이지에서는 45초 내내 networkidle에 도달하지 못할 수 있다. 현재 preview 페이지가 polling을 사용한다면 screenshot 캡처가 항상 타임아웃된다.

**필요한 조치:**

```javascript
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
await page.waitForTimeout(2000); // 렌더링 안정화 대기
```

또는 `load` event + timeout 조합으로 변경.

---

## 3. 에이전트가 지적했으나 실제로는 정상인 부분

### 3.1 pixelmatch PNG 포맷 — 정상

에이전트는 `sharp().png()`가 RGB만 출력할 수 있다고 지적했으나, sharp는 PNG 변환 시 기본적으로 RGBA(4채널)를 유지한다. `PNG.sync.read`도 RGBA로 파싱한다. `idx + 3`(alpha) 접근은 정상이다.

**server.js:4986-4996:**
```javascript
const beforePng = PNG.sync.read(await sharp(before.buffer).png().toBuffer());
const afterPng = PNG.sync.read(await sharp(after.buffer).png().toBuffer());
// ...
const idx = (y * width + x) * 4;
const alpha = diff.data[idx + 3];
```

정상 코드다.

### 3.2 buildResult.buildResult 이중 중첩 — 의도적 구조

**server.js:21910:**
```javascript
buildResult: buildResult.buildResult || {},
```

`handleLlmBuildOnData`의 return 구조가 `{ summary, buildResult, operations }` 형태이므로 `buildResult.buildResult`는 이중 중첩이 맞다. 명명이 혼란스럽지만 버그는 아니다.

---

## 4. 요약표

| 번호 | 위치 | 심각도 | 설명 |
|------|------|--------|------|
| 2.1 | llm.js:4785-4787 | **CRITICAL** | replace_component_template → continue로 버려짐, 렌더링 미발생 |
| 2.2 | llm.js:4669-4678 | **HIGH** | critic fallback 시 모든 score 70 고정, shouldRetry: false |
| 2.3 | admin-research.html:5159-5163 | **HIGH** | 409 응답 body(criticReport, qualityGate) 버려짐, alert만 표시 |
| 2.4 | server.js:84 | **MEDIUM** | 서버 재시작마다 criticKey 변경 → preview URL 무효화 |
| 2.5 | server.js:3820-3825 | **MEDIUM** | slot registry merge 시 루트 속성 오염 |
| 2.6 | server.js:21971-21993 | **MEDIUM** | visual fail → 409 반환, 자동 재빌드 없음 |
| 2.7 | server.js:4948 | **LOW** | networkidle 조건이 polling 페이지에서 타임아웃 가능 |

---

## 5. 코덱스가 올바르게 추가한 것

- pixelmatch 기반 hard visual delta gate: end-to-end 완전 구현
- patchDepth별 threshold 분기
- visual critic 결과를 draft report에 병합
- hardDeltaFailed → status "quality-failed" 저장
- structural critic 기반 fix pass retry (1회)
- 이 부분들은 아키텍처 문서의 요구사항을 정확히 구현했다

---

## 6. 즉시 조치 우선순위

1. **replace_component_template**: prompt에서 제거하거나 실제 renderer 연결 — 둘 중 하나 선택 (지금은 약속과 실행이 분리된 상태)
2. **admin-research.html 409 처리**: catch 블록에서 response body를 읽어 criticReport / qualityGate를 UI에 표시
3. **critic fallback**: `shouldRetry: true`로 변경하거나 fallback 시 critic을 threw로 처리
4. **INTERNAL_VISUAL_CRITIC_KEY**: `.env`에 고정값 설정 (운영 환경에서 필수)
