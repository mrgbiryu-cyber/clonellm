# Codex 변경 사항 코드 레벨 리뷰 (2026-04-19, Session 4)

## 검증 대상

- `server.js` (+10,049줄 변경)
- `llm.js` (+3,356줄 변경)
- `web/admin-research.html` (+2,722줄 변경)
- `web/admin.html` (+699줄 변경)
- `auth.js` (+227줄 변경)
- 신규 문서 다수: `admin-track-b-webdesign-quality-rebuild-plan`, `admin-quality-recovery-and-generation-routing`, `admin-webdesign-quality-endpoint` 등

---

## 전체 평가 요약

| 항목 | 상태 |
| --- | --- |
| 문법 오류 | ✅ 없음 (`node --check` 통과) |
| 의존성 로드 | ✅ sharp, pngjs, pixelmatch, playwright 모두 설치·로드 정상 |
| Track B Wave 1 (품질 게이트) | ✅ **구현 완료** |
| Track B Wave 2 (충분성 사전 게이트) | ✅ **구현 완료** |
| Track B Wave 3 (Primitive Composition) | ❌ **미구현** — 코드에 명시적으로 `directCompositionPreview: false` |
| Track B Wave 4+ (Token System, Style Runtime) | ❌ **미구현** |
| Arial 하드코딩 | ⚠️ 88회 잔존 — 변화 없음 |
| 토큰 CSS 변수 시스템 | ❌ 부재 — 변화 없음 |
| `@keyframes` / 모션 시스템 | ❌ 부재 — 변화 없음 |

---

## 잘된 것: Wave 1 — 품질 게이트 재설계

### Visual Quality Gate (`evaluateVisualQualityGate`, server.js:5637)

새로운 **patchDepth별 최소 점수 프로파일** 도입:

```js
light:   { hierarchy: 45, changeStrength: 35 }
medium:  { hierarchy: 60, changeStrength: 50, requireRetryClear: true }
strong:  { hierarchy: 68, changeStrength: 58, requireRetryClear: true }
full:    { hierarchy: 72, changeStrength: 65, requireRetryClear: true }
```

이전에는 `visualDelta`(픽셀 비교)만 가지고 pass/fail 했으나, 이제 **LLM Critic 점수가 직접 게이트 역할**을 한다. 구조 Critic(planCoverage, changeDepth 등)과 Visual Critic(hierarchy, changeStrength 등)이 **Dual Critic** 으로 merge되어 저장된다 (server.js:25029-25035).

`hardDeltaFailed: false` 로 하드코딩 — 픽셀 델타 실패는 advisory로만 남김. `deltaBelowThreshold` 는 findings 에 경고로만 기록됨 (server.js:5928-5934). 이건 **의도된 완화**이며, Critic 점수로 품질을 판단하는 방향으로 이동한 것이라 올바름.

### Recovery Router (`resolveQualityRecoveryRoute`, server.js:5988)

품질 실패 시 3가지 Recovery Mode 중 하나를 선택:
- `composition-recovery` — 구조 재구성 강화
- `asset-assisted-recovery` — 레퍼런스/브랜드 정렬 약할 때
- `generation-backed-recovery` — 고임팩트 슬롯(hero 등)이 visual delta 약할 때

각 모드별로 `handleLlmFix` + `enforceBuilderOperations` 로 Recovery 빌드를 실제로 재실행 (server.js:25247-25300). **Recovery가 코드로 연결**돼 있음.

### 내부 Visual Critic 캡처 (`captureUrlAsScreenshotDataUrl`, server.js:5446)

Playwright headless chromium으로 before/after 스크린샷을 실제 캡처:
```js
const { chromium } = require("playwright");
const browser = await chromium.launch({ headless: true });
// ...
await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
```

URL은 `INTERNAL_VISUAL_CRITIC_KEY`(crypto.randomUUID) + `criticUserId` 로 인증하는 내부 경로 (server.js:5433-5443). **보안 처리 적절함.**

---

## 잘된 것: Wave 2 — 사전 충분성 게이트

### `evaluateBuilderSufficiencyGate` (server.js:6123)

빌드 시작 **전에** 세 가지를 체크:
1. `wholePageContext` 이미지 수 (strong/full은 최소 3개)
2. `referenceVisuals` 이미지 수 (strong/full은 최소 2개)
3. 고임팩트 슬롯(hero, summary-banner-2, marketing-area 등)의 visual support 유무

부족하면:
- `asset-assisted-recovery` / `generation-backed-recovery` → 자동 자산 생성 시도
- `composition-recovery` → 빌드 **블로킹** (`409 reference_asset_sufficiency_failed` 응답)

파이프라인에 실제로 연결돼 있음 (server.js:24847-24907). **잘 구현됨.**

### 이미지 생성 파이프라인 (`callOpenRouterImageGeneration`, llm.js:1743)

OpenRouter API 통해 이미지 생성:
- `modalities: ["image", "text"]`, `image_config.aspect_ratio` 지원
- `maxAttempts` retry (기본 2회)
- 타임아웃 분리 (`OPENROUTER_IMAGE_TIMEOUT_MS` / `OPENROUTER_IMAGE_MAX_ATTEMPTS` env 지원)
- 생성된 이미지를 `data/raw/assets/generated-*.png|jpg` 로 저장, `generated-asset-cache.json`에 기록

`materializeGeneratedBuildAssets` 는 `patchDepth === "strong" || "full"` 일 때만 호출 (server.js:24920). **적절한 조건부 실행.**

**잠재적 문제**: `.env.example`에 `OPENROUTER_IMAGE_MODEL`이 없음. 설정 안 되면 기본 LLM 모델로 이미지 생성을 시도하는데, Claude는 이미지 생성 불가(텍스트 전용). `.env.example`에 별도 항목 추가 필요.

### Whole-page Context 이미지 (`buildWholePageContextSections` + overlay, server.js:2206, 2269)

섹션별 bounding box를 annotate한 canvas overlay 이미지를 LLM에 제공. **이게 "local-first 생성 편향" 문제를 줄이는 핵심 장치**이고 구현된 것을 확인.

---

## 잘된 것: Export/호출 분리 정리

`llm.js`에서 새로 export된 함수들:
- `handleLlmFix` — 이전엔 `handleLlmBuildOnData` 내부에 묻혀 있었음
- `handleLlmVisualCritic` — 별도 분리
- `callOpenRouterImageGeneration` — 서버에서 직접 호출 가능
- `applyOperations` — 이전엔 서버 내 중복 정의
- `enforceBuilderOperations` — 신규

이 분리가 Recovery Router에서 `handleLlmFix`를 독립적으로 재호출하는 것을 가능하게 만듦. **구조적으로 올바른 분리.**

---

## 문제 발견: Wave 3 미구현 (가장 큰 이슈)

`buildInterventionCapabilityProfile()` (server.js:9712) 이 여전히 반환:

```js
{
  supports: {
    directCompositionPreview: false,   // ← 명시적으로 false
  },
  missingCapabilities: [
    "composition renderer",
    "layout composition operation schema",
  ],
  ...
}
```

Track B Wave 3 (`Primitive Composition Builder`) 은 **아직 한 줄도 구현되지 않았다.** Builder는 여전히 27키 패치 + 5개 hero variant 하드코딩 분기 안에서만 동작한다.

Track B 문서에는 Wave 3을 "primitive-first 구성으로 patch-first 생성을 대체"한다고 명시했지만, 현재 코드는:
- `Stack`, `Grid`, `CTACluster`, `LeadCardRail` 등 primitive 정의 없음
- Composition tree → renderer 파이프라인 없음
- Builder LLM 시스템 프롬프트는 여전히 6종 operation만 허용

**결론**: Wave 1/2는 잘 됐지만 실제 디자인 품질을 높이는 핵심인 Wave 3이 없으므로, 현재는 "더 나쁜 것을 더 잘 막는" 단계이지, "더 좋은 걸 만드는" 단계는 아직 시작하지 않았다.

---

## 문제 발견: Arial/토큰 미해결

- `server.js`에서 `Arial` 88회 → 이전과 동일. `buildHomeHeroRuntimeCss()` (server.js:14619) 는 새 버전이지만 폰트 스택 자체는 변경 없음.
- `:root { --ct-color-*, --ct-space-* }` 디자인 토큰 0회. 이전과 동일.
- `@keyframes` 0회, `prefers-reduced-motion` 0회, `container-type` 0회. 이전과 동일.

Wave 5 (Style Runtime) 진입 전에 이 부분이 해결돼야 한다.

---

## 문제 발견: quality gate 임계값이 낮을 수 있음

`patchDepth=full` 기준 `changeStrength: 65` — 이 수치는 LLM이 비교적 보수적인 패치로도 쉽게 달성한다. "Claude-level" 웹 디자인 품질을 목표로 한다면 eventually `changeStrength: 75~80` 수준으로 올려야 할 수 있다. 지금은 초기 임계값으로 적절하지만, Wave 3 이후 실제 compositional 출력이 가능해진 뒤 상향 검토 필요.

---

## 문제 발견: `OPENROUTER_IMAGE_MODEL` env 누락

`.env.example`:

```
OPENROUTER_IMAGE_MODEL=  ← 없음
```

이 키가 없으면 `callOpenRouterImageGeneration`이 `OPENROUTER_MODEL` 폴백을 사용 (llm.js:1757). Claude나 Gemini 같은 텍스트 전용 모델이 설정된 경우, 이미지 생성 시도 자체가 실패하거나 예상치 못한 응답 형식이 온다. `.env.example`에 아래 추가 필요:

```
OPENROUTER_IMAGE_MODEL=openai/gpt-4o  # 또는 다른 image generation 지원 모델
```

---

## 기타 확인 사항

- **auth.js +227줄**: 상세 확인 미진행 (우선순위 낮음)
- `data/normalized/component-rebuild-schema-catalog.json` 신규 — Wave 3 준비를 위한 스키마 정의 파일로 보임. 내용 검토는 Wave 3 시작 시 필요.
- `data/normalized/readiness-audit.json` 신규 — 빌드 준비도 감사. `buildFullCompletionReport()` (server.js 내 신규)가 생성.
- `scripts/run_track_b_validation.js` 신규 — Track B 검증 스크립트. 아직 실행하지 않음.
- 신규 generated asset 파일들 (`generated-home-hero-*.png/jpg`) — 이미지 생성이 이미 1~2회 시도된 것으로 보임.

---

## 다음 단계 우선순위

| 우선순위 | 작업 | Wave |
| --- | --- | --- |
| 🔴 HIGH | `.env.example`에 `OPENROUTER_IMAGE_MODEL` 추가 | 즉시 |
| 🔴 HIGH | Wave 3 Primitive Composition Builder 시작 | W3 |
| 🟡 MEDIUM | quality gate `changeStrength` 임계값 수준 실전 테스트 후 상향 판단 | W1 보완 |
| 🟡 MEDIUM | Token Core / CSS variable 주입 (`--ct-*`) | W5 |
| 🟢 LOW | `component-rebuild-schema-catalog.json` 내용 검토 및 primitive 정의 연결 | W3 준비 |
| 🟢 LOW | `scripts/run_track_b_validation.js` 실행해 대표 시나리오 초기 기준 수립 | W8 |

---

## 최종 판단

Codex가 진행한 작업은 **Track B Wave 1/2를 충실히 구현했고, 코드 품질은 안정적**이다. 문법 오류 없고, 의존성 정상, 새 함수들의 연결 구조도 논리적으로 올바르다. 특히 Playwright 기반 실제 스크린샷 캡처와 충분성 사전 게이트는 이전 대비 실질적인 개선이다.

단, **실제 디자인 품질의 핵심인 Wave 3(Primitive Composition Builder)은 아직 시작조차 되지 않았다.** Recovery Router가 `composition-recovery` 를 쓰더라도 결국 돌아오는 것은 같은 27키 patch builder이다. 이 구조적 한계를 해결하지 않으면 Wave 1/2의 "더 잘 거르기"가 "더 자주 실패"로 나타나면서 전체 생성 성공률만 낮아질 수 있다.

Wave 3 착수가 가장 시급하다.
