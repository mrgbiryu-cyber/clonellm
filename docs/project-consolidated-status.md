# Project Consolidated Status

> 먼저 읽을 기준 문서:
> `docs/project-purpose-reference.md`

## 1. Goal

이 프로젝트의 목표는 단순한 HTML 복제가 아니다.

핵심 목표는 아래 4가지다.

1. `live reference`를 브라우저 기준으로 읽고
2. 그 화면을 `clone`에서 시각적으로 최대한 맞추고
3. 그 결과를 나중에 `component` 단위로 다룰 수 있게 만들고
4. 최종적으로는 `LLM`과 `Figma-derived` 변경이 그 컴포넌트 단위 위에서 안전하게 동작하도록 만드는 것이다.

즉 지금의 작업은:

- 임시 화면 복제
- 단순 DOM 편집

이 아니라,

- `view truth` 기준 재현
- `component-ready rendering`
- `LLM-ready editing surface`

를 만드는 과정이다.

관련 결정 문서:

- `docs/project-purpose-reference.md`
- `docs/decision-history.md`
- `docs/implementation-schedule.md`
- `docs/home-remediation-plan.md`
- `docs/llm-composition-design.md`
- `docs/home-progress-log.md`

## 2. Initial Requirements

초기 요구사항은 아래와 같이 정리할 수 있다.

### 2.1 Rendering / View

1. 기준은 코드가 아니라 `실제 브라우저 화면`이다.
2. `Chrome + CDP + screenshot + measured rect`가 기준이다.
3. `home`은 단일 desktop 또는 단일 mobile 페이지가 아니라 `hybrid`다.
4. 상단과 일부 영역은 `pc-like truth`, 하단 일부는 `mo-like truth`를 따른다.

### 2.2 Execution / Architecture

1. 페이지 전체를 한 번에 맞추지 않는다.
2. `zone -> slot -> group -> rule` 단위로 잘라서 맞춘다.
3. 한 번에 전 페이지 병렬로 돌리지 않고 `queue + single worker` 기준으로 돌린다.
4. 실제 맞는지 빠르게 보기 위해 `sandbox -> visual check -> main apply` 루프를 쓴다.

### 2.3 Editing / Future Product

1. 최종적으로는 `component` 단위로 편집해야 한다.
2. 나중에 `LLM`이 각 컴포넌트의 텍스트, 위치, 이미지, 디자인 token을 수정할 수 있어야 한다.
3. `Figma-derived` variant도 동일한 컴포넌트 구조 위에 얹혀야 한다.
4. 여러 계정이 각자 변경한 내용을 자기 `workspace` 기준으로 볼 수 있어야 한다.

## 3. Current High-Level Decisions

### 3.1 Live truth first

최종 기준은 항상 `live reference`다.

- workbench
- snapshot
- metadata

는 전부 보조 도구다.

즉:

- JSON이 맞아도 화면이 다르면 실패
- DOM이 비슷해도 시각이 다르면 실패

다.

### 3.2 `visual fix -> componentize`

전체를 거꾸로 완전히 재구성하지 않는다.

현재 전략은:

1. 먼저 시각적으로 맞춘다
2. 맞춘 영역을 점진적으로 `component` 경계로 승격한다

이다.

이 전략을 택한 이유:

1. 지금 전부 다시 구조화하면 속도가 너무 느리다
2. 아직 기준 화면이 안 닫힌 영역이 있다
3. LLM/Figma용 구조화는 맞는 화면 위에서 해야 의미가 있다

### 3.3 `sandbox -> accept -> main`

하단 신규 섹션은 메인 홈에 바로 넣지 않는다.

현재 검증된 방식:

1. `homeSandbox=<slot>`으로 샌드박스 경로에서 먼저 본다
2. 시각적으로 수용 가능해지면
3. 메인 `/clone/home`에 올린다

이 방식은 이미 `best-ranking`에서 검증됐다.

## 4. Why Home Is Difficult

`home`이 유독 어려운 이유는 아래 5가지다.

### 4.1 Home is hybrid, not a single baseline

`home`은 단일한 one-source 페이지가 아니다.

- 상단 header / GNB / hero
- quickmenu
- lower-content

가 서로 같은 source 규칙을 따르지 않는다.

즉 `page-level clone`보다 `zone-level source resolution`이 필요하다.

### 4.2 Runtime dependency is high

홈 하단과 일부 상단은:

- skeleton
- hydrated data
- slider init
- runtime DOM mutation

에 많이 의존한다.

그래서 raw HTML만 가져오면 맞지 않는다.

### 4.3 Some live sections are only skeletons in raw HTML

대표적인 예가 `베스트 랭킹`이다.

- 홈 raw HTML에는 `best-ranking skeleton`만 있다
- 실제 카드 본문은 runtime/API를 통해 완성된다

즉 단순 section import가 안 된다.

### 4.4 Source conflicts were real

실제 작업 중 확인된 문제:

1. quickmenu를 잘못 `pc structural source`로 읽으면 `1행 10개`처럼 보인다
2. 하지만 visual truth 기준으로는 `mo-like`로 봐야 했다

즉 홈은 source lock을 엄격히 안 하면 바로 흔들린다.

### 4.5 Lower-content cannot be imported blindly

`가전 구독` 실험에서 확인된 것처럼,

- 원본 section을 먼저 끼워 넣으면
- 순서, 폭, 위치가 틀어진다

그래서 하단은 반드시:

1. 위치/폭 먼저
2. 빈 컨테이너 또는 controlled structure
3. 그 뒤 데이터 주입

순서로 가야 한다.

## 5. Current Work Method

현재 홈 작업 방식은 아래와 같이 정리된다.

### 5.1 Top / mid sections

상단부는 비교적 `captured fidelity` 방향으로 진행됐다.

이미 많이 정리된 영역:

1. `header-top`
2. `header-bottom`
3. `GNB panels`
4. `hero`
5. `quickmenu`
6. `promotion`
7. `MD's CHOICE`
8. `timedeal`

### 5.2 Lower-content sections

하단 신규 섹션은 아래 패턴으로만 진행한다.

1. `sandbox` 경로로 먼저 붙인다
2. 위치/폭/제목을 먼저 맞춘다
3. 내부 구조를 맞춘다
4. 데이터/이미지를 주입한다
5. 시각 확인 후 메인에 반영한다

### 5.3 Best-ranking became the first repeatable pattern

`best-ranking`은 하단 신규 섹션 처리 방식의 첫 완성형 예시다.

실제 진행 순서:

1. 홈 raw HTML의 skeleton 위치를 찾음
2. 샌드박스에서 `best-ranking` 섹션을 직접 렌더
3. 섹션 폭/제목/탭/리스트 구조를 맞춤
4. live source로부터:
   - 탭 이미지
   - API 데이터
   - 가격/상품명/배지 문구
   를 가져옴
5. 시각 확인 후 메인 홈으로 올림

즉 이 패턴이 다음 하단 섹션들의 기준이 된다.

## 6. Current Home Status

### 6.1 Main home (`/clone/home`)

현재 메인 홈에서 잠정적으로 수용 가능한 영역:

1. header top
2. header bottom
3. GNB panels
4. hero
5. quickmenu
6. promotion
7. `MD's CHOICE`
8. `타임딜`
9. `베스트 랭킹`

### 6.2 What was already proven

1. footer 아래로 새어나오는 hidden chunk 문제 해결
2. `MD's CHOICE` / `타임딜` 이미지 복구
3. `베스트 랭킹`을 sandbox에서 검증 후 메인 반영

### 6.3 What remains on home

남은 하단 섹션은 여전히 정리 대상이다.

예:

1. `브랜드 쇼룸`
2. `최신 제품 소식`
3. `슬기로운 가전생활`
4. 기타 하단 프로모션/안내 섹션

이들은 `best-ranking`과 같은 패턴으로 하나씩 처리해야 한다.

## 7. Login / Workspace / Per-account Editing

복잡한 권한 체계는 아직 넣지 않았다.

현재 방향은 `minimal login + per-account workspace`다.

### 7.1 Current rules

1. 로그인만 둔다
2. 계정별 작업 내역을 저장한다
3. 계정별 LLM 사용량을 저장한다
4. 새 계정은 항상 `shared default`부터 시작한다
5. 사용자는 자기 `workspace`에서만 변경을 본다

### 7.2 Why this matters

나중에 LLM 편집을 붙이면:

1. 같은 화면이라도 사용자별 draft가 달라질 수 있다
2. 누가 어떤 컴포넌트를 바꿨는지 기록해야 한다
3. `shared default`와 `user workspace`를 분리해야 안전하다

## 8. LLM / Figma / Component Plan

LLM은 raw HTML generator가 아니다.

현재 합의된 모델은:

1. `component-aware planner`
2. `slot/variant/rule patch editor`
3. `report generator`

이다.

### 8.1 LLM should edit component contracts

나중에 LLM은 아래를 수정하게 된다.

1. 텍스트
2. 이미지
3. 위치
4. spacing / token
5. active variant

하지만 전부 `component contract` 안에서만 움직인다.

### 8.2 Figma also attaches at component level

Figma-derived variant도 마찬가지다.

즉:

- 페이지 전체를 통째로 갈아끼우는 게 아니라
- `component / slot` 단위로 variant를 바꾸는 구조

가 목표다.

### 8.3 Why current visual work matters

지금 홈을 맞추는 이유는 단순 시각 보정이 아니라,

나중에 각 블록을

- `home-md-choice`
- `home-timedeal`
- `home-best-ranking`
- `home-brand-showroom`

같은 컴포넌트로 승격하기 위한 준비이기 때문이다.

즉 지금은:

1. visual acceptance 확보
2. 이후 component boundary 승격
3. 이후 LLM / Figma 연결

순서다.

## 9. Consolidated Code Map

아래는 현재 작업의 실제 코드 기준선이다.

### 9.1 Home source / clone rendering

| Tag | Purpose | Code |
| --- | --- | --- |
| `home.clone.rewrite` | clone HTML 재작성 메인 함수 | `server.js:4255` `rewriteCloneHtml(...)` |
| `home.clone.inject` | home 섹션 교체/삽입 메인 함수 | `server.js:4155` `injectHomeReplacements(...)` |
| `home.clone.enhancements` | quickmenu/promotion/md/timedeal/best-ranking 섹션 조합 | `server.js:4141` `renderHomeEnhancements(...)` |
| `home.clone.shell` | clone shell iframe wrapper | `server.js:6416` `sendCloneShell(...)` |
| `home.clone.route` | clone content route | `server.js:6304-6313` |
| `home.clone.shell-route` | clone shell route | `server.js:6858-6892` |

### 9.2 Home mobile-derived lower sections

| Tag | Purpose | Code |
| --- | --- | --- |
| `home.slot.quickmenu.extract` | mobile quickmenu section 추출 | `server.js:2814` |
| `home.slot.promotion.extract` | mobile promotion section 추출 | `server.js:2819` |
| `home.slot.timedeal.extract` | mobile timedeal section 추출 | `server.js:2824` |
| `home.slot.md-choice.extract` | mobile MD's CHOICE section 추출 | `server.js:2829` |
| `home.slot.images.inject` | section 내부 상품 이미지 주입 | `server.js:2955` `injectProductImagesIntoSection(...)` |

### 9.3 Best-ranking

| Tag | Purpose | Code |
| --- | --- | --- |
| `home.slot.best-ranking.render` | best-ranking sandbox/main section 렌더 | `server.js:4064` |
| `home.slot.best-ranking.tabs` | best-ranking 상단 탭 데이터 | `server.js:2814-2890` 근처 `HOME_BEST_RANKING_TABS` |
| `home.slot.best-ranking.items` | 샌드박스용 실제 상품 샘플 데이터 | `server.js:2903` 이후 `HOME_BEST_RANKING_SAMPLE_ITEMS` |
| `home.slot.best-ranking.format-price` | 가격 포맷 | `server.js:2891` |
| `home.slot.best-ranking.abs-url` | 절대 URL 변환 | `server.js:2897` |
| `home.slot.best-ranking.inject-main` | 홈 skeleton 자리에 best-ranking 삽입 | `server.js:4182`, `server.js:4232-4235` |
| `home.slot.best-ranking.css` | best-ranking visual rules | `server.js:4773-4958` |

### 9.4 Auth / workspace / activity

| Tag | Purpose | Code |
| --- | --- | --- |
| `auth.storage.paths` | users/sessions/workspaces/activity 파일 경로 | `auth.js:6-12` |
| `auth.workspace.init` | `shared-default` 기반 workspace 초기화 | `auth.js:162-176` |
| `auth.workspace.save` | workspace 저장 + history 적재 | `auth.js:183-202` |
| `auth.llm.usage` | 계정별 LLM usage count 증가 | `auth.js:207-212` |
| `auth.register` | 계정 생성 | `auth.js:215-236` |
| `auth.login` | 로그인 | `auth.js:238-249` |
| `auth.logout` | 로그아웃 | `auth.js:251-256` |
| `api.auth.session` | 현재 세션/워크스페이스 메타 | `server.js:8082-8093` |
| `api.auth.register` | 회원가입 API | `server.js:8097-8109` |
| `api.auth.login` | 로그인 API | `server.js:8111-8122` |
| `api.auth.logout` | 로그아웃 API | `server.js:8124-8130` |
| `api.workspace.reset` | shared default로 workspace reset | `server.js:8133-8138` |
| `api.workspace.history` | 저장 이력 조회 | `server.js:8141-8146` |
| `api.activity` | activity log 조회 | `server.js:8149-8154` |
| `workspace.source.resolve` | shared-default vs user-workspace 분기 | `server.js:96-103` |

### 9.5 Login / admin UI

| Tag | Purpose | Code |
| --- | --- | --- |
| `ui.login` | 로그인/회원가입 화면 | `web/login.html` |
| `ui.admin.session` | admin session 메타 표시 | `web/admin.html:44-45`, `web/admin.html:104-115` |
| `ui.admin.reset` | workspace reset 버튼 | `web/admin.html:149-180` |
| `ui.admin.history` | history/activity 표시 | `web/admin.html:74-98` |

### 9.6 Planning / rules / LLM documents

| Tag | Purpose | Doc |
| --- | --- | --- |
| `plan.foundation` | backend first, LLM later | `docs/implementation-schedule.md` |
| `plan.home.remediation` | home 영역별 remediation 기준 | `docs/home-remediation-plan.md` |
| `plan.execution` | hybrid home / LLM 규칙 / validation checklist | `docs/execution-checklist.md` |
| `plan.history` | 주요 의사결정 히스토리 | `docs/decision-history.md` |
| `plan.llm` | LLM input/output/component contract | `docs/llm-composition-design.md` |

## 10. Current Forward Plan

현재부터의 가장 현실적인 순서는 아래다.

1. `home` 하단 남은 섹션을 계속 `sandbox -> visual accept -> main`으로 진행
2. 홈 전체 visual acceptance를 먼저 닫음
3. 맞춘 영역부터 component boundary를 올림
4. minimal login/workspace를 기반으로 per-account draft를 유지
5. 그 후에만 LLM이 component 단위로 수정

즉 LLM은 아직 메인 작업이 아니다.

LLM 전에 필요한 것은:

1. 홈 전체 시각 기준 정리
2. 각 섹션의 component boundary 정의
3. 사용자별 workspace 분리 안정화

다.

## 11. Practical Rule Going Forward

앞으로는 아래 규칙만 지킨다.

1. live reference를 먼저 본다
2. 위치/폭/순서를 먼저 맞춘다
3. 그 다음 내용/이미지를 넣는다
4. 신규 하단 섹션은 무조건 sandbox 먼저
5. 수용 가능해지면 메인 반영
6. 반영 후에는 component 후보로 태깅한다

이 규칙을 벗어나면 홈처럼 다시 흔들린다.

---

## 12. Guidance for Codex — 현재 막힌 지점과 다음 방향

> 이 섹션은 Claude Code가 전체 문서와 실패 히스토리(12.4)를 교차 분석하여 작성한 지침이다.
> **코드 수정 전에 12.4를 먼저 읽고, 이 섹션을 코드 수준 체크리스트로 사용하라.**

---

### 12.1 왜 홈/클론 비주얼 매칭이 어려운가 — 코드 수준 원인 분석

단순 CSS 문제가 아니다. 12.4의 실패 히스토리를 포함해 구조적 충돌 여섯 가지가 동시에 일어나고 있다.

---

#### 원인 A: Hybrid zone — zone마다 source baseline이 다르다

`/clone/home`은 단일 HTML source를 복제하는 게 아니다.

| zone | source baseline | 담당 함수 |
|---|---|---|
| header-top / header-bottom / GNB / hero | PC view truth | `rewriteCloneHtml` |
| quickmenu / promotion / MD / timedeal | 현재는 mobile-derived로 취급 중, 섹션별 재검증 대상 | `renderHomeEnhancements` → `injectHomeReplacements` |
| best-ranking | skeleton anchor + **custom renderer** + actual data injection | `renderBestRankingSandboxSection()` → `injectHomeReplacements()` |
| lower-content (브랜드쇼룸 등) | **source TBD** (mobile 추정이지만 미검증) | 동일 패턴 예정, 섹션별 재검증 필요 |

> **반박 수용 (Codex 12.5.수정5 항목 1,2):**
> `best-ranking`은 raw mobile section 추출이 아니라 `renderBestRankingSandboxSection()`이 만든 custom renderer다.
> `lower-content` 하단 섹션의 source를 `mo`로 미리 단정하지 마라. `가전 구독` raw import 실패 선례가 있다.
> 각 섹션은 skeleton anchor / data availability / runtime dependency를 먼저 직접 확인한 후 source를 결정한다.

**코드 수준 대응:**
```js
// renderHomeEnhancements 내 각 section 루트에 data-source 속성 추가
// 예시: renderBestRankingSandboxSection() 함수 내부
return `<section class="codex-best-ranking" data-codex-slot="home-best-ranking" data-source="mo">
  ...
</section>`;
```
- `data-codex-slot`: **현재 구현 기준 키** (server.js 전체에서 `[data-codex-slot]` 셀렉터로 동작 중)
  - `data-slot-id`는 미래 설계 방향이지만 지금 바꾸면 workbench/coverage/slot snapshot 수집이 깨진다
  - 현재는 `data-codex-slot` 유지, 나중에 일괄 마이그레이션 또는 병행 추가
- `data-source`: `pc` / `mo` 명시
- 이 두 속성이 없는 섹션은 LLM patch 대상이 될 수 없다

> **반박 수용 (Codex 12.5.수정5 항목 3):**
> 현재 구현은 `data-codex-slot`을 기준으로 동작한다 (server.js:4066, 4296, 5857).
> `data-slot-id`로 당장 교체하면 기존 workbench/coverage/snapshot 수집이 흔들린다.

---

#### 원인 B: Runtime-dependent section — static 비교가 불가능하다

`best-ranking`, `브랜드 쇼룸`, `최신 제품 소식`은 raw HTML에 skeleton만 있다.
데이터는 JS runtime / API 이후에 채워지므로 container가 비어 있으면 높이/간격이 live와 다르다.

**12.4 실패 5, 6 확인됨.** 이미 검증된 패턴:

```js
// ❌ 금지: skeleton 위에 CSS만 맞추기
// ✅ 정답: 반드시 샘플 데이터를 주입한 상태로 sandbox 렌더

// best-ranking 패턴 (이미 구현됨, 다른 섹션도 동일하게 적용)
const items = HOME_BEST_RANKING_SAMPLE_ITEMS; // 실제 상품 데이터 필수
const html = renderBestRankingSection({ items, tabs: HOME_BEST_RANKING_TABS });
```

placeholder-only 상태(빈 thumb box, line placeholder)를 오래 유지하면 텍스트 리듬 / 이미지 비율 / badge 위치가 계속 어긋난다. 실제 데이터를 최대한 빨리 넣어라.

---

#### 원인 C: Raw section import — 레이아웃 context 오염

원본 LG 섹션은 `.lge-wrap`, `.container` width를 전역으로 상속받는다.
그대로 clone에 붙이면 폭/간격/z-index 충돌이 발생한다.

**12.4 실패 1, 9 확인됨.** 이미 확립된 패턴:

```js
// ❌ 금지
const html = rawLgeSectionHtml; // 원본 그대로 삽입

// ✅ 정답: skeleton anchor + custom inner renderer
// 1. 홈 raw HTML에서 skeleton 위치(anchor)만 찾는다
// 2. 내부 렌더 구조는 codex-* 전용 class로 완전히 새로 작성
// 3. 원본 CSS class에 끌려다니지 마라
return `
  <div class="codex-section-wrapper codex-brand-showroom"
       data-codex-slot="home-brand-showroom"
       data-source="mo">
    <!-- inner renderer: 원본 class 사용 금지, codex-* prefix 사용 -->
    <!-- data-source는 섹션별 직접 확인 후 결정. mo로 미리 단정 금지 -->
    <h2 class="codex-section-title">브랜드 쇼룸</h2>
    ...
  </div>
`;
```

---

#### 원인 D: Global hidden override — Next stream chunk 노출

**12.4 실패 4 확인됨.** 이것이 `[hidden]` 처리 관련 가장 크리티컬한 실패다.

```js
// ❌ 절대 금지
html = html.replace(/\[hidden\]/g, ''); // → S:0, S:1, S:2 chunk가 footer 아래 노출됨

// ✅ 정답: rewriteCloneHtml 내에서 footer 이후를 잘라낸다
const footerEnd = html.indexOf('</footer>');
if (footerEnd !== -1) {
  html = html.slice(0, footerEnd + '</footer>'.length);
}
// 하단 섹션은 잘라낸 후 renderHomeEnhancements()로 명시적으로 다시 붙인다
```

---

#### 원인 E: 상대경로 URL — clone에서 이미지가 안 뜸

**12.4 실패 7 확인됨.**

```js
// ❌ 금지: /kr/images/... 상대경로 그대로 사용

// ✅ 정답: 모든 외부 asset은 절대경로화
// 이미 server.js:2897에 toLgeAbsoluteUrl() 구현됨
// → 새 섹션 렌더 시 반드시 이 함수를 거쳐야 한다

function renderBrandShowroomItem(item) {
  return `<img src="${toLgeAbsoluteUrl(item.imageUrl)}" ...>`;
  //                  ↑ 이 처리 없으면 localhost 기준으로 깨짐
}
```

---

#### 원인 F: Render helper 누락 — sandbox 500 오류

**12.4 실패 8 확인됨.**

```js
// ❌ 실패 패턴: 템플릿에서 formatPrice() 호출했지만 선언 안 됨
// → /clone-content/home?homeSandbox=brand-showroom → 500 "Clone render failed"

// ✅ 정답: 섹션 renderer 함수 선언 전에 helper 체크리스트
// 새 섹션 추가 시 아래 helper가 반드시 참조 가능한지 확인:
// - formatPrice()        → server.js:2891
// - toLgeAbsoluteUrl()   → server.js:2897
// - renderTabList()      → 필요시 직접 선언
// sandbox 경로에서 먼저 렌더해서 500이 뜨면 즉시 helper 누락을 의심하라
```

---

### 12.2 하단 남은 섹션 처리 — 코드 수준 반복 패턴

`브랜드 쇼룸`, `최신 제품 소식`, `슬기로운 가전생활` 등은 새로운 접근이 필요한 게 아니다.
아래 패턴을 `best-ranking` 구현(`server.js:4064`)을 템플릿으로 그대로 반복하라.

**Step 1. 홈 raw HTML에서 skeleton anchor 위치 확인**

```js
// rewriteCloneHtml 또는 injectHomeReplacements 내에서
// 예: '브랜드쇼룸' skeleton이 어떤 class/id로 마킹되어 있는지 확인
const skeletonMarker = html.indexOf('brand-showroom') !== -1
  ? 'brand-showroom'
  : null;
```

**Step 2. sandbox 독립 렌더 경로 추가**

```js
// renderHomeEnhancements() 내에서
// homeSandbox 파라미터 분기에 새 슬롯 추가
if (sandbox === 'brand-showroom') {
  return renderBrandShowroomSection(sampleData);
}
```

**Step 3. custom inner renderer 작성**

```js
function renderBrandShowroomSection(items) {
  const absItems = items.map(i => ({
    ...i,
    imageUrl: toLgeAbsoluteUrl(i.imageUrl),  // ← 절대경로 필수
  }));
  // data-codex-slot: 현재 구현 기준 키 (data-slot-id 아님)
  // data-source: live reference screenshot 확인 후 결정 (미리 mo 단정 금지)
  return `
    <section class="codex-brand-showroom"
             data-codex-slot="home-brand-showroom"
             data-source="TBD">
      <h2 class="codex-section-title">브랜드 쇼룸</h2>
      <div class="codex-brand-showroom__grid">
        ${absItems.map(renderBrandShowroomItem).join('')}
      </div>
    </section>
  `;
}

// ⚠️ 반박 수용: 브랜드쇼룸이 best-ranking과 동일 패턴으로 바로 성공한다고 가정하지 마라.
// 반드시 아래를 먼저 확인하라:
//   1. 홈 raw HTML에서 이 섹션의 skeleton anchor가 존재하는가?
//   2. 실제 데이터 source가 어디인가? (live API / lgajax / static?)
//   3. runtime dependency가 있는가? (slider init, hydration 등)
// 이 셋 중 하나라도 다르면 best-ranking 패턴을 그대로 쓸 수 없다.
```

**Step 4. sandbox에서 먼저 확인 (`homeSandbox=brand-showroom`)**

- `http://localhost:3000/clone/home?homeSandbox=brand-showroom`
- 렌더 500 → helper 누락 확인
- 폭/제목/구조 먼저 맞추고, 그 다음 데이터/이미지 주입

**Step 5. visual acceptance 후 메인 반영**

```js
// injectHomeReplacements() 내에서
// sandbox 통과 후 메인 섹션으로 편입
const brandShowroom = renderBrandShowroomSection(BRAND_SHOWROOM_SAMPLE);
html = insertAfterAnchor(html, 'best-ranking', brandShowroom);
// ↑ best-ranking 뒤에 붙이는 방식
```

**Step 6. 원본 JS/CSS 반드시 먼저 확인**

- 원본 섹션 JS/CSS 파일이 확보되어 있으면 먼저 확인해서 `.item__*` 클래스 구조를 역매핑하라
- 감으로 CSS를 조정하지 마라. 원문 소스가 있으면 그것이 우선이고, 없으면 live reference screenshot과 DOM을 함께 본다

---

### 12.3 LLM 프론트 편집 툴 — 올바른 설계 방향

> **이전 Section 12.2(구버전)의 LLM 설계는 틀렸다. 이 섹션으로 대체한다.**
>
> 기존 제안의 오류: `component contract + data-component-id` 방식이 이미 설계된
> `slotId / source variant / workbench` 아키텍처와 충돌한다.
> `docs/llm-composition-design.md`가 진짜 설계 문서다.

#### LLM 툴은 현재 Phase 12다. 지금 만들지 마라.

`docs/implementation-schedule.md`의 Phase 순서:
1. 홈 baseline 완료 (현재 Phase 2 진행 중)
2. category/PLP baseline
3. PDP template baseline
4. slot/variant registry
5. minimal auth/workspace
6. **Phase 12: LLM**

지금 필요한 건 LLM 툴이 아니라 **홈 비주얼 acceptance 완료**다.
LLM 구현 전에 아래 gate가 열려야 한다:
- `home` acceptance: blocker = 0, overlay = 0, placeholder = 0
- slot tagging: accepted 섹션부터 점진적으로 `data-codex-slot` 태깅 (전체 완료 아님)
- variant registry: `captured` / `custom` 구분이 major 섹션에서 작동
- workspace: per-account 분리가 auth.js 수준에서 안정화

> **반박 수용 (Codex 12.5.수정5 항목 5):**
> "모든 섹션 태깅 완료"는 현재 사실이 아니다. lower-content 신규 섹션은 진행 중이다.
> gate 조건은 `all slots tagged`가 아니라 `accepted sections progressively tagged`로 읽어야 한다.

#### 올바른 LLM 입력 계약 (`docs/llm-composition-design.md` 기준)

LLM에게 넘겨야 하는 입력은 raw HTML이 아니라 아래 구조다:

```json
{
  "mode": "workbench-selection",
  "pageContext": {
    "pageId": "home",
    "viewportProfile": "mo",
    "stateId": "default"
  },
  "selection": {
    "zoneId": "content-zone",
    "slotId": "home-best-ranking",
    "componentType": "best-ranking-grid"
  },
  "working": {
    "activeSourceId": "custom-home-best-ranking-mo-v1",
    "availableSourceIds": [
      "captured-home-best-ranking-mo",
      "custom-home-best-ranking-mo-v1"
    ]
  },
  "instruction": "베스트 랭킹 타이틀을 이달의 인기 상품으로 바꿔줘"
}
```

주의: `componentId`가 아니라 `slotId`다. `viewportProfile`은 필수다.

#### 올바른 LLM 출력 계약 (patch action 타입)

LLM이 HTML을 반환하게 하면 안 된다. 반드시 구조화된 action 중 하나여야 한다:

```json
{
  "plan": { "affectedSlots": ["home-best-ranking"], "changeType": "token-only" },
  "patch": {
    "action": "update_slot",
    "pageId": "home",
    "viewportProfile": "mo",
    "slotId": "home-best-ranking",
    "changes": {
      "tokens": { "titleText": "이달의 인기 상품" }
    }
  },
  "report": { "summary": "타이틀 텍스트 변경", "affectedRules": [] }
}
```

허용 action 타입 (이 외는 금지):
- `update_slot` — 텍스트/레이아웃 props 변경
- `update_rule` — 규칙 수준 변경
- `create_variant` — 새 custom variant 생성
- `switch_source` — captured ↔ custom ↔ figma-derived 전환
- `update_tokens` — design token 변경
- `update_scoped_css` — 스코프 제한 CSS 변경 (token으로 불가할 때만)

`captured` 원본을 직접 수정하는 action은 허용되지 않는다.

#### 올바른 approval flow

```
사용자 지시
  → LLM: plan 생성
  → LLM: patch 생성
  → 서버: preview 렌더 (적용 전 미리보기)
  → 사용자: Approve / Hold / Rollback
  → 서버: workspace에 patch 저장 (auth.js workspace 구조 활용)
  → 서버: workbench replay 실행
    - blocker > 4px → 자동 rollback
    - warning 2~4px → 사용자에게 알림
    - cosmetic ≤ 2px → 통과
  → 서버: report 저장
  → clone 페이지 재렌더
```

preview 없이 바로 apply하거나, workbench replay 없이 완료 처리하지 마라.

#### 지금 당장 할 수 있는 LLM 준비 작업 (비주얼 작업과 병행)

비주얼 맞추는 작업 중에 아래만 추가하면 나중에 LLM 연결 비용이 크게 줄어든다:

```js
// 각 섹션 루트 엘리먼트에 두 개 속성 추가
// data-codex-slot: 현재 구현 기준 키 (server.js 전체에서 이 셀렉터로 동작)
// data-source: live reference 확인 후 결정 (pc / mo / TBD)

return `<section class="codex-best-ranking"
  data-codex-slot="home-best-ranking"
  data-source="mo">
  ...
</section>`;
```

이것이 workbench slot snapshot 수집 및 추후 LLM slotId 연결의 기준이 된다.

> **반박 수용 (Codex 12.5.수정5 항목 3):**
> `data-slot-id`는 미래 목표 키 이름이고, 현재 코드는 `data-codex-slot`으로 동작한다.
> `/api/workspace/patch`, `/api/llm/edit`는 **planned** 상태이고 현재 구현이 아니다.
> 현재 실제 구현된 API는 `/api/auth/*`, `/api/workspace/reset`, `/api/workspace/history`, `/api/activity`뿐이다.

#### source variant lifecycle (LLM이 생성하는 variant의 상태 흐름)

```
LLM이 create_variant → draft
  → workbench replay pass → validated
  → 사용자 Activate → active
  → 이전 active variant → deprecated
  → 사용자 Rollback → previous variant active 복구
```

---

### 12.4 현재 코드에서 수정이 필요한 구체 항목

#### 수정 1: Code Map line number는 참고용이다

`server.js:4255` 등의 line number는 작업이 진행되면서 이미 틀어져 있다.
아래 함수명으로 grep해서 찾아라:

```bash
grep -n "rewriteCloneHtml\|injectHomeReplacements\|renderHomeEnhancements\|sendCloneShell\|toLgeAbsoluteUrl\|formatPrice" server.js
```

#### 수정 2: 신규 섹션 추가 시 반드시 통과해야 하는 체크리스트

하단 신규 섹션(`브랜드쇼룸`, `최신제품소식`, `슬기로운가전생활`)을 추가할 때 아래를 순서대로 확인하라:

```
[ ] live reference screenshot 확인 (source: pc/mo/TBD 이때 결정)
[ ] 홈 raw HTML에서 skeleton anchor 위치 확인 (없으면 삽입 anchor 결정)
[ ] 실제 data source 확인 (live API / lgajax / static 중 무엇인가?)
[ ] runtime dependency 확인 (slider init / hydration / API call 있는가?)
[ ] 원본 JS/CSS 파일에서 클래스 구조 역매핑 (감으로 CSS 조정 금지)
[ ] sandbox 경로 추가 (homeSandbox=<slot-name>)
[ ] helper 함수 선언 확인: toLgeAbsoluteUrl, formatPrice
[ ] codex-* prefix class 사용 (원본 CSS class 오염 금지)
[ ] data-codex-slot / data-source 속성 추가  ← data-slot-id 아님
[ ] 실제 샘플 데이터 주입 (placeholder-only 금지)
[ ] sandbox에서 500 없음 확인
[ ] sandbox 시각 acceptance 확인 (1차 gate)
[ ] injectHomeReplacements()에 편입
[ ] 메인 /clone/home 전체 회귀 확인 (2차 gate)
[ ] 필요시 workbench/home 확인 (3차 gate, 보조)
```

> **반박 수용 (Codex 12.5.수정5 항목 8):**
> best-ranking 패턴이 다른 섹션에서 바로 성공한다고 가정하지 마라.
> skeleton anchor 존재 여부, data source, runtime dependency가 섹션마다 다를 수 있다.
> 위 체크리스트에서 앞 세 항목(data source / runtime dependency / JS-CSS 역매핑)이 먼저다.

#### 수정 3: 홈 상단 임시 overlay는 여전히 금지

`home-remediation-plan.md` 고정 원칙 2조:
- `홈스타일` 등 임시 fixed/floating overlay로 reference를 흉내 내지 않는다
- 모든 상단 요소는 header-bottom / GNB 구조 안에서만 재현해야 한다

코드에서 `position: fixed`, `position: absolute`로 특정 요소를 float시키는 임시 처리가 있다면 즉시 제거하고 구조 안에서 재현하라.

#### 수정 4: workbench replay 없이 visual-only patch 누적 금지

`home-remediation-plan.md`에서 명시:
> workbench check 없이 visual-only patch를 바로 누적하지 않는다

CSS를 직접 조정할 때 아래 우선순위로 확인하라:

1. **(1차, 필수)** sandbox 시각 확인 → `http://localhost:3000/clone/home?homeSandbox=<slot>`
2. **(2차, 필수)** 메인 회귀 확인 → `http://localhost:3000/clone/home` 전체 스크롤
3. **(3차, 필요시)** workbench 확인 → `http://localhost:3000/workbench/home` 또는 `/api/home-workbench`
4. **(4차, 보조)** page-level visual snapshot → `python3 scripts/capture_visual_snapshots.py home`
   - `data/visual/home/compare.png` 참고

> **반박 수용 (Codex 12.5.수정5 항목 6):**
> `capture_visual_snapshots.py`는 page-level 캡처이므로 하단 섹션을 sandbox로 맞추는
> 중간 단계에서는 신호가 너무 거칠다. 매 패치의 유일한 gate로 쓰면 안 된다.
> sandbox → 메인 회귀 → workbench → snapshot 순서가 맞다.

---

### 12.5 Codex 반박 검토 결과 — Claude 분석

> Codex가 12.4.수정5에 제기한 반박 9개에 대한 Claude의 검토 결과다.
> 각 항목에 대해 `수용 / 부분 수용 / 유지` 판정을 내린다.

#### 반박 1: `best-ranking`은 mobile source 추출이 아니다 — **✅ 수용**

**판정:** 맞다. 내 12.1 표의 분류가 틀렸다.

실제 구현을 확인하면:
- `best-ranking`은 raw mobile section을 가져오는 게 아니라 `renderBestRankingSandboxSection()`이 직접 HTML을 생성하는 custom renderer다
- 이미 12.1 표와 12.2 Step 3 코드를 수정 완료했다

**남은 영향:** `quickmenu / promotion / MD / timedeal`도 실제로 raw mobile extract인지 직접 코드 확인이 필요하다. 표에 남아 있는 `mobile source 추출` 분류도 추후 재검증 대상이다.

---

#### 반박 2: `lower-content = mobile source 추출`도 아직 사실이 아니다 — **✅ 수용**

**판정:** 맞다. `가전 구독` raw import 실패가 이미 선례다.

남은 lower-content 섹션의 source는 `mo`로 단정할 수 없다. 섹션별로:
- skeleton anchor가 홈 raw HTML에 있는가?
- 실제 데이터는 어디서 오는가? (lgajax / API / static?)
- runtime dependency (slider, hydration)가 있는가?

이 세 가지를 직접 확인한 후 source를 결정한다. 12.1 표와 체크리스트에 반영 완료했다.

---

#### 반박 3: 현재 구현 키는 `data-slot-id`가 아니라 `data-codex-slot`이다 — **✅ 수용**

**판정:** 맞다. 가장 직접적인 코드 오류였다.

- server.js:4066, 4296, 5857에서 `[data-codex-slot]` 셀렉터로 동작 중
- 지금 `data-slot-id`로 바꾸면 workbench/coverage/slot snapshot 수집이 깨진다
- 12.1, 12.2, 12.3, 12.4 코드 예시 전체를 `data-codex-slot`으로 수정 완료했다

**마이그레이션 방향 (미래):** 나중에 `data-slot-id`를 공식 키로 통일할 때는 아래 순서가 안전하다:
```js
// 1단계: 두 속성 병행 추가 (하위 호환 유지)
data-codex-slot="home-best-ranking" data-slot-id="home-best-ranking"

// 2단계: 서버 코드에서 data-codex-slot 참조를 data-slot-id로 일괄 교체
// grep -n "\[data-codex-slot\]" server.js → 전체 확인 후 마이그레이션

// 3단계: data-codex-slot 제거
```

---

#### 반박 4: `/api/workspace/patch`, `/api/llm/edit`는 현재 구현이 아니다 — **✅ 수용**

**판정:** 맞다. 내가 planned API를 기존 구현처럼 서술했다.

현재 실제 구현된 API (server.js:8082 이후):
- `/api/auth/session`, `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`
- `/api/workspace/reset`, `/api/workspace/history`
- `/api/activity`

planned (미구현):
- `/api/workspace/patch` — workspace에 component patch 저장
- `/api/llm/edit` — LLM 편집 요청 수신/실행
- preview renderer, replay integration, report persistence

12.3 LLM 섹션에 "planned 상태" 명시를 추가 완료했다.

---

#### 반박 5: `slot registry: 모든 섹션 태깅 완료`는 사실이 아니다 — **✅ 수용**

**판정:** 맞다. LLM gate 조건을 과대 기술했다.

실제 현황:
- header/hero/quickmenu + 일부 home replacement → `data-codex-slot` 태깅됨
- lower-content 신규 섹션 → main 반영과 component boundary 승격이 진행 중

올바른 gate 조건: `accepted sections progressively tagged` (전부 완료가 아님)
12.3에 반영 완료했다.

---

#### 반박 6: `capture_visual_snapshots.py`는 보조 수단이다 — **✅ 수용**

**판정:** 맞다. page-level 스크립트를 section-level sandbox 작업의 primary gate로 서술한 것이 틀렸다.

이 스크립트는 `live-reference / reference-replay / working / compare`를 page 전체로 캡처하므로:
- 하단 섹션을 sandbox로 맞추는 중간 단계에서는 신호가 너무 거칠다
- sandbox → 메인 회귀 → workbench → snapshot 순서로 우선순위를 재정리했다

12.4 수정4에 반영 완료했다.

---

#### 반박 7: "이전 LLM 설계는 틀렸다"는 표현이 과하다 — **⚠️ 부분 수용**

**판정:** 표현은 과했다. 하지만 지적한 구체 항목들은 여전히 유효하다.

**수용하는 부분:**
- 이 프로젝트의 LLM 설계 철학(`slot/state/source/rule patch editor`)은 처음부터 올바른 방향이었다
- `docs/llm-composition-design.md`가 이미 그 방향을 잡고 있었다
- "틀렸다"는 표현은 과하고, 더 정확한 표현은 "Section 12 첫 버전의 구현 레벨 서술이 기존 설계와 어긋났다"이다

**유지하는 부분 (철회하지 않음):**
- Section 12 첫 버전의 구체적 오류들은 실제로 있었다:
  - `componentId` (→ `slotId`가 맞음)
  - `{ op: patch, changes: {...} }` (→ `action: create_variant / update_slot` 등이 맞음)
  - approval flow에서 workbench replay 누락
  - `viewportProfile` 없음
- 이 오류들은 `llm-composition-design.md`와 충돌하는 내용이었고, 수정이 필요했다

**결론:** "이전 설계 철학은 맞았고, 이전 Section 12의 구현 레벨 서술이 어긋났다"로 정정한다.

---

#### 반박 8: `best-ranking` 하나만 검증됐다, 패턴 일반화 전제 금지 — **✅ 수용**

**판정:** 맞다. "그대로 반복하라"는 서술이 너무 단정적이었다.

각 섹션은 아래를 먼저 재검증해야 한다:
1. skeleton anchor 존재 여부 (홈 raw HTML에 있는가?)
2. data source (lgajax API / static JSON / 없음?)
3. runtime dependency (slider init / hydration 필요한가?)

이 세 가지가 best-ranking과 동일한 경우에만 같은 패턴을 쓸 수 있다.
체크리스트에 앞 세 항목을 선행 확인으로 이동 완료했다.

---

#### 반박 9: 현재 진행 방향 요약 — **✅ 합의 확인**

Codex가 정리한 방향이 모든 문서와 일치한다. 이것을 공식 합의로 고정한다:

| 영역 | 방향 |
|---|---|
| 홈 상단/중단 | visual lock 우선, 통과 후 componentize |
| 홈 하단 | sandbox first, section-by-section, location/width first |
| lower-content 신규 섹션 | raw import 금지, custom renderer 우선, source는 직접 확인 |
| LLM | slotId/variant 기반 설계 유지, patch/apply 구현은 후순위 (Phase 12) |

---

#### 반박 수용 후 수정 완료 목록

| 항목 | 수정 위치 | 상태 |
|---|---|---|
| best-ranking 분류 오류 | 12.1 표 | ✅ 수정 완료 |
| lower-content source TBD | 12.1 표, 12.2 Step3 | ✅ 수정 완료 |
| data-codex-slot 적용 | 12.1, 12.2, 12.3, 12.4 코드 예시 전체 | ✅ 수정 완료 |
| planned API 명시 | 12.3 LLM 섹션 | ✅ 수정 완료 |
| slot registry gate 조건 완화 | 12.3 LLM 게이트 | ✅ 수정 완료 |
| capture script 우선순위 하향 | 12.4 수정4 | ✅ 수정 완료 |
| 섹션별 사전 검증 체크리스트 | 12.4 수정2 | ✅ 수정 완료 |
| "틀렸다" 표현 완화 | 12.5 반박7 판정 | ✅ 기록 완료 |

---

### 12.5 실제 히스토리 기반 보정 — 이미 실패한 시도와 현재 우회 방식

> 아래 내용은 이 프로젝트에서 **실제로 실패했던 시도**들이다.
> 다음 분석자는 이 항목을 먼저 읽고, 이미 실패한 경로를 다시 제안하지 않아야 한다.

#### 실패 1: 홈 하단 섹션을 raw section import로 바로 붙이기

실제 실패 사례:

- `가전 구독`을 기존 PC 블록 위치에 바로 치환
- 원본 section을 먼저 가져오고 나중에 폭/위치 보정 시도

결과:

- live reference와 섹션 순서가 달라짐
- 폭이 틀어짐
- 원본 전역 CSS context가 깨져서 위치가 어긋남

현재 우회 방식:

1. 먼저 `live reference`에서 위치/폭/순서 확인
2. 그 자리에 controlled container 또는 custom section 렌더
3. 이후에만 데이터/이미지 주입

즉 **section import first**는 폐기된 방식이다.

#### 실패 2: 홈 하단을 메인 `/clone/home`에 바로 넣기

실제 실패 사례:

- 하단 신규 섹션을 메인 홈에 바로 넣고 보정

결과:

- 이미 맞춰둔 상단~타임딜 영역까지 계속 흔들림
- rollback 비용이 커짐

현재 우회 방식:

1. 무조건 `homeSandbox=<slot>`에서 먼저 확인
2. 통과 후에만 메인 반영

즉 신규 하단 섹션은 **main direct apply 금지**다.

#### 실패 3: quickmenu를 `pc structural source`로 읽기

실제 실패 사례:

- quickmenu를 구조적으로 desktop source에서 읽어서 `1행 10개`처럼 해석

결과:

- 문서 합의와 충돌
- 실제 시각과 불일치

현재 우회 방식:

- quickmenu는 항상 `live visual truth` 기준으로 source를 잠근다
- 애매하면 screenshot을 먼저 보고 결정한다

즉 홈 하단/중단 source는 **DOM 추론보다 live screenshot 우선**이다.

#### 실패 4: 홈 하단 hidden chunk를 깨우는 전역 처리

실제 실패 사례:

- 전역 `[hidden]` 해제
- hidden 속성 제거

결과:

- Next stream chunk (`S:0`, `S:1`, `S:2`)가 footer 아래로 노출
- 홈 하단 전체가 무너짐

현재 우회 방식:

1. hidden chunk를 깨우지 않는다
2. 필요하면 `</footer>` 뒤를 잘라낸다
3. 홈 하단은 필요한 섹션만 명시적으로 다시 붙인다

즉 **global hidden override**는 금지다.

#### 실패 5: `best-ranking`을 홈 raw HTML만으로 해결하려고 시도

실제 실패 사례:

- 홈 raw HTML 안의 best-ranking skeleton만 보고 해결하려고 시도

결과:

- 실제 카드 본문 데이터가 없음
- 아무리 CSS를 맞춰도 높이/구조가 안 맞음

현재 우회 방식:

1. 홈에서는 skeleton 위치만 사용
2. 실제 카드 내용은
   - `best-ranking` 전용 페이지
   - `retrieveCategoryProductList.lgajax`
   를 참고해서 가져온다

즉 **skeleton 위치 + 별도 data source**가 현재 정답이다.

#### 실패 6: 샘플 카드 placeholder만으로 오래 버티기

실제 실패 사례:

- `best-ranking`에서 line placeholder, 빈 thumb box로 오래 보정 시도

결과:

- 텍스트 리듬, 이미지 비율, badge 위치가 계속 어긋남
- 사용자 검토가 어려워짐

현재 우회 방식:

- 가능한 빨리 실제 상품 데이터
  - 이미지
  - 상품명
  - 가격
  - badge case
  를 넣고 그 상태로 시각 보정

즉 **placeholder-only phase는 짧게** 가져가야 한다.

#### 실패 7: 이미지 경로를 상대경로로 둔 상태에서 clone 렌더

실제 실패 사례:

- 상품 이미지 URL이 `/kr/images/...` 상대경로 그대로 들어감

결과:

- `localhost` 기준으로 해석되어 이미지가 안 뜸

현재 우회 방식:

- `toLgeAbsoluteUrl()`로 `https://www.lge.co.kr/...` 절대경로로 변환

즉 clone에서 외부 asset은 **절대경로화**가 기본이다.

#### 실패 8: renderer helper 없이 템플릿 문자열만 확장

실제 실패 사례:

- `best-ranking` 카드에 `formatPrice()`를 쓰면서 helper 정의 누락

결과:

- `/clone-content/home?...` 500
- `Clone render failed`

현재 우회 방식:

- 템플릿 확장 전에 helper 존재 여부를 먼저 확인
- 섹션별 renderer helper는 명시적으로 선언

즉 샌드박스라도 **render fail 0**이 우선이다.

#### 실패 9: 원본 CSS 클래스에 계속 끌려다니기

실제 실패 사례:

- `best-ranking`을 원본 skeleton/list class 위에 부분 덮기만 시도

결과:

- 좌측 정렬 오염
- 가로 flow 오염
- 세로 리스트 강제 실패

현재 우회 방식:

- 원본 slot 위치는 유지하되,
- 내부 렌더 구조는 `codex-*` 전용 class로 분리

즉 **skeleton anchor + custom inner renderer**가 현재 반복 가능한 패턴이다.

#### 실패 10: 배치 작업을 병렬/중복 실행

실제 실패 사례:

- extractor/capture를 여러 번 중복 실행
- headless Chrome 세션이 누적

결과:

- CPU/RAM 과부하
- 서버/작업 멈춤

현재 우회 방식:

1. `queue`
2. `single worker`
3. `lock file`
4. 신규 batch는 예상 시간 먼저 공유

즉 backend 실행은 **serial queue 기준**으로만 간다.

#### 실패 11: 홈 상단 임시 overlay 보정

실제 실패 사례:

- `홈스타일` chip 등 임시 floating overlay로 맞추려는 시도

결과:

- 실제 구조 fidelity를 가리지 못하고 더 어색해짐

현재 우회 방식:

- overlay 보정 금지
- 실제 header/GNB fidelity만으로 해결

즉 **temporary overlay patch 금지**는 계속 유지한다.

#### 실패 12: 베스트 랭킹 번호/배지를 추정 감각으로만 맞추기

실제 실패 사례:

- 배지 위치, 번호 위치, 색을 감으로 조정

결과:

- 사용자 검수에서 반복적으로 어긋남

현재 우회 방식:

1. `bestRanking.min.js`에서 카드 템플릿 확인
2. `bestRanking.min.css`에서 `.item__num`, `.item__badge`, `.item__image`, `.item__info` 확인
3. 그 기준으로 카드 구조와 스타일을 역매핑

즉 현재부터는 **home 하단 신규 섹션도 반드시 JS/CSS 원문 확인 후 작업**한다.

#### 현재 합의된 하단 처리 패턴

위 실패들을 반영하면, 하단 신규 섹션은 아래 순서만 허용한다.

1. live reference screenshot 확인
2. 홈 raw HTML에서 skeleton 또는 anchor 위치 확인
3. sandbox 독립 렌더
4. custom inner renderer 구성
5. 실제 데이터/이미지 주입
6. visual acceptance
7. main 반영
8. 이후 component boundary 승격

이 패턴을 벗어나면 다시 같은 실패를 반복한다.


---

## 13. 홈 하단 실행 협의 프로토콜

> 이 섹션은 앞으로 Codex와 Claude가 **같은 방식으로 구현 방향을 점검하기 위한 공통 실행 계약**이다.
> 신규 하단 섹션 작업은 이 순서를 벗어나지 않는다.

### 13.0 현재 고정된 실행 루프

홈 하단은 아래 루프로 진행한다.

1. 작업리스트는 사용자가 정리한 live reference 순서로 고정한다.
2. 각 항목에 대응하는 모바일 섹션을 먼저 찾는다.
3. 해당 모바일 섹션의 자산과 요소를 하나씩 정확히 가져온다.
4. 기존 히스토리에서 이미 맞춘 방식, 최종 목적, Claude 피드백을 함께 반영한다.
5. 다음 항목으로 넘어가며 2~4를 반복한다.
6. 전체가 끝나면 코드, 경로, 링크, slot/source를 다시 점검하고 홈을 마무리한다.

실행 해석:

1. `quickmenu` 아래 순서는 현재 `mobile-like order`를 working truth로 사용한다.
2. `mobile-derived`로 충분한 섹션은 메인 `/clone/home`에서 바로 정리한다.
3. `custom-renderer`가 필요한 섹션만 sandbox를 유지한다.
4. 섹션별 precheck/postcheck를 통과하지 못하면 메인에 직접 올리지 않는다.
5. 섹션별 세부 체크 항목은 `docs/home-lower-order-reference.md`의 `섹션 진행 체크 태그`를 따른다.

### 13.0.a 홈 완료 이후 상위 실행 순서

홈 이후에는 아래 프로젝트 공통 순서를 따른다.

1. 홈에서 각 화면으로 이동하는 링크를 정리한다.
2. 각 화면의 범위는 기존 히스토리/결정 문서를 찾아 해당 경로까지 다시 이어서 진행한다.
3. 각 화면이 `mobile`인지 `pc`인지 먼저 판정한다.
4. 모바일과 PC 화면을 모두 구현/검증한다.
5. 실제 브라우저와 코드 둘 다 확인해서 맞는지 점검한다.
6. 화면 구현 후 다시 돌아가서 LLM이 바로 다룰 수 없는 항목을 뽑는다.
7. 그 항목을 `LLM-editable` 리스트로 재정리한다.
8. slot/source/variant/component 경계를 보강하고, 화면이 틀어지지 않는지 다시 검증한다.
9. 위 단계가 완료되면 pre-LLM foundation을 닫고 LLM 작업으로 전환한다.

### 13.0.b 인터랙션 구현 및 LLM-editable 전환 스케줄

LLM 전에는 view만 맞는 상태로 끝내지 않는다.

반드시 아래 순서로 인터랙션도 닫는다.

1. `interaction inventory`를 만든다.
2. 핵심 baseline interaction을 실제 브라우저에서 구현한다.
3. 시각 확인과 state verification을 같이 한다.
4. interaction unit을 slot/component와 연결한다.
5. interaction editable list를 만든다.
6. 그 뒤에만 LLM이 interaction까지 수정 가능한 구조로 넘어간다.

추가 실행 규칙:

1. 최종 사용자의 일괄 시각 판정 전에는 섹션 묶음별 screenshot compare를 계속 누적한다.
2. 각 compare는 `reference screenshot vs current clone screenshot`로 저장한다.
3. 차이는 `structure / style / interaction`으로 분류한다.
4. 지금 단계에서는 기존 캡처 도구를 우선 재사용한다.
5. 외부 이미지 분석 의존성은 기존 도구로 부족할 때만 제한적으로 추가한다.

대표 대상:

1. `home.gnb.open`
2. `home.hero.carousel`
3. `home.quickmenu.carousel`
4. `home.lower.slider`
5. `pdp.gallery.carousel`
6. `pdp.option.select`
7. `support.accordion.open`

세부 구현과 체크 기준은 `docs/interaction-implementation-plan.md`를 따른다.

### 13.1 목표

하단 신규 섹션은 아래 3가지를 동시에 만족해야 한다.

1. live reference 기준으로 위치/폭/순서가 맞아야 한다
2. 메인 `/clone/home`의 기존 안정 구간을 깨뜨리면 안 된다
3. 나중에 `data-codex-slot` 기준으로 component boundary 승격이 가능해야 한다

### 13.2 현재 확정된 구현 방식

현재 검증된 순서는 아래 하나뿐이다.

1. live reference screenshot 확인
2. 홈 raw HTML에서 skeleton 또는 anchor 위치 확인
3. `homeSandbox=<slot>`로 샌드박스 경로에서 먼저 렌더
4. 원본 section import 대신 `codex-*` custom renderer 작성
5. 실제 데이터/이미지 주입
6. sandbox 시각 확인
7. 메인 `/clone/home`에 반영
8. 반영 후 `data-codex-slot` 기준으로 component 후보 유지

이 순서는 `best-ranking`에서만 실제로 검증됐다. 다른 섹션은 이 패턴을 **참조**하되, 그대로 성공한다고 가정하지 않는다.

### 13.3 금지 사항

아래 방식은 이미 실패했으므로 다시 시도하지 않는다.

1. raw section import first
2. 메인 홈 direct apply first
3. placeholder-only 상태 장기 유지
4. 상대경로 이미지 유지
5. 원본 CSS class 위에 부분 덮기만 하기
6. global hidden override
7. 임시 overlay/floating patch

### 13.4 코드레벨 진행 순서

신규 섹션 예: `brand-showroom`

1. anchor 확인
```js
// rewriteCloneHtml / injectHomeReplacements 부근
const hasAnchor = html.includes('brand-showroom') || html.includes('브랜드 쇼룸');
```

2. source/데이터/삽입 위치 확인
```js
// 먼저 결정할 것
// - source: pc / mo / TBD
// - data: static / lgajax / live API / 없음
// - runtime dependency: slider / hydration / none
// - insertAfterSlot: live reference에서 확인한 바로 앞 섹션
const decision = {
  source: 'TBD',
  dataSource: 'none',
  runtimeDependency: 'none',
  insertAfterSlot: null,
};
```

3. 샌드박스 렌더 분기 추가
```js
if (options.homeSandbox === 'brand-showroom') {
  return renderBrandShowroomSection(sampleItems);
}
```

4. custom renderer 작성
```js
function renderBrandShowroomSection(items, { source = 'TBD' } = {}) {
  return `
    <section class="codex-brand-showroom"
             data-codex-slot="home-brand-showroom"
             data-source="${source}">
      ...
    </section>
  `;
}
```

5. helper 확인
```js
if (typeof formatPrice !== 'function') throw new Error('helper missing: formatPrice');
if (typeof toLgeAbsoluteUrl !== 'function') throw new Error('helper missing: toLgeAbsoluteUrl');
// 추가 helper는 renderer 근처에 명시적으로 선언
// 공용 삽입 helper가 없으면 injectHomeReplacements 안에서 명시적 replacement 로직을 직접 작성한다
```

6. visual acceptance 후 메인 반영
```js
const decision = {
  source: 'mo',
  insertAfterSlot: 'best-ranking', // 반드시 live reference 순서 확인 후 결정
};
const brandShowroom = renderBrandShowroomSection(sampleItems, { source: decision.source });

if (!decision.insertAfterSlot) {
  throw new Error('insertAfterSlot not decided from live reference');
}

// 공용 helper가 없으면 injectHomeReplacements 안에서 명시적 replacement 로직 사용
html = placeAfterConfirmedAnchor(html, decision.insertAfterSlot, brandShowroom);
```

### 13.5 체크리스트

아래 체크리스트는 구현 전/후 모두 사용한다.

```
[ ] live reference screenshot을 먼저 확인했다
[ ] 섹션 순서가 실제 홈 하단 순서와 맞는지 확인했다
[ ] skeleton 또는 anchor 위치를 raw HTML에서 찾았다
[ ] source를 pc/mo/TBD 중 하나로 기록했다
[ ] data-source에 TBD가 아닌 실제 확인값을 넣을 준비가 됐다
[ ] data source를 기록했다 (static / lgajax / live API / none)
[ ] runtime dependency를 기록했다 (slider / hydration / none)
[ ] live reference 기준 바로 앞 섹션을 기록했다 (삽입 앵커 결정)
[ ] anchor가 없을 때의 fallback 삽입 위치를 기록했다
[ ] sandbox 경로를 먼저 만들었다
[ ] renderer는 codex-* 전용 class만 쓴다
[ ] data-codex-slot을 붙였다
[ ] data-source에 실제 확인값을 붙였다 (pc / mo / TBD 금지)
[ ] 상대경로 이미지를 절대경로로 바꿨다
[ ] placeholder-only 상태로 오래 두지 않았다
[ ] sandbox에서 500이 없다
[ ] sandbox에서 시각적으로 수용 가능하다
[ ] 메인 반영 후 상단~타임딜까지 회귀 이상이 없다
[ ] 필요 시 workbench/home로 보조 확인했다
```

### 13.6 Claude 점검 요청 기준

클로드에게 다음 4가지를 기준으로만 피드백을 받는다.

1. 이 섹션이 `raw import first`로 다시 회귀하는가
2. `data-codex-slot` / 현재 workspace 구조와 충돌하는가
3. source를 성급하게 `mo` 또는 `pc`로 단정하고 있는가
4. sandbox first 원칙을 깨고 바로 메인 반영을 유도하는가

---

## 14. Section 13 점검 결과 — Claude

> 13.6의 4가지 기준 + 구현 레벨 추가 검토.
> 아래 항목에서 통과 / 수정 필요를 구분한다.

### 14.1 원칙 레벨 점검

#### 점검 1: raw import first 회귀 여부 — ✅ 통과

- 13.2 Step 4: "원본 section import 대신 `codex-*` custom renderer 작성" 명시
- 13.3 금지 목록 1번: "raw section import first" 명시 금지
- 13.4 Step 4: `renderBrandShowroomSection()` custom renderer 패턴 사용
- **회귀 없음**

---

#### 점검 2: source 성급한 단정 여부 — ✅ 수용 및 13.4 반영

- 13.4 Step 2: `source: pc / mo / TBD` 명시, 성급한 단정 없음 ✅
- 13.4 Step 4의 renderer 함수 시그니처에 **문제 있음**:

```js
// 현재 코드
function renderBrandShowroomSection(items) {
  return `<section ... data-source="TBD">`;
}
```

`data-source="TBD"`가 함수 내부에 하드코딩되어 있다.
Step 2에서 source를 결정해도 renderer에 전달되는 경로가 없다.
결과적으로 실제 배포 후에도 `data-source="TBD"`가 HTML에 남는다.

**수정 방향:**

```js
// source를 파라미터로 받아야 한다
function renderBrandShowroomSection(items, { source = 'TBD' } = {}) {
  return `
    <section class="codex-brand-showroom"
             data-codex-slot="home-brand-showroom"
             data-source="${source}">
      ...
    </section>
  `;
}

// 호출 시 source를 명시적으로 전달
// Step 2에서 결정한 source를 여기서 주입
const determinedSource = 'mo'; // Step 2 확인 결과
const brandShowroom = renderBrandShowroomSection(sampleItems, { source: determinedSource });
```

체크리스트 항목 "data-source를 붙였다"도 실제로는 TBD가 붙은 상태를 점검하게 되므로, 아래로 교체해야 한다:
```
[ ] data-source에 TBD가 아닌 실제 확인된 값을 붙였다 (pc / mo)
```

---

#### 점검 3: sandbox first 준수 여부 — ✅ 통과

- 13.2 Step 3: sandbox가 메인 반영보다 앞에 있음
- 13.4 Step 3 → Step 6 순서: `homeSandbox` 분기 먼저, 메인 반영은 나중
- 13.3 금지 목록 2번: "메인 홈 direct apply first" 명시 금지
- **sandbox first 준수됨**

---

#### 점검 4: `data-codex-slot` / workspace 충돌 여부 — ✅ 통과

- 13.4 Step 4: `data-codex-slot` 사용 (data-slot-id 아님)
- 13.5 체크리스트: "data-codex-slot을 붙였다" 명시
- workspace 관련 API 혼용 없음
- **충돌 없음**

---

### 14.2 구현 레벨 추가 점검

13.6의 4가지 기준 외에 실제 코드 실행 시 문제가 될 수 있는 항목들.

---

#### 문제 A: 13.4 Step 6 — 삽입 위치가 live reference와 연결되지 않음 — ✅ 수용 및 13.4 반영

현재 코드:
```js
html = insertAfterAnchor(html, 'best-ranking', brandShowroom);
```

**문제 1: 삽입 앵커가 암묵적으로 `best-ranking`으로 고정됨**

`brand-showroom`이 live reference에서 `best-ranking` 바로 다음에 오는지 검증한 적이 없다.
Step 1에서 screenshot을 "확인"하라고 하지만, 그 확인 결과가 Step 6의 삽입 앵커 결정에 연결되어 있지 않다.

실제 live reference에서 섹션 순서가 아래와 같을 수 있다:
```
best-ranking → 최신제품소식 → 브랜드쇼룸 → 슬기로운가전생활
```
이 경우 `insertAfterAnchor(html, 'best-ranking', brandShowroom)`은 틀린 위치에 삽입한다.

**문제 2: `insertAfterAnchor` helper 존재 여부가 검증되지 않음**

실패 8 패턴(helper 누락 → 500)이 그대로 재현될 수 있다.
`insertAfterAnchor`가 server.js에 없으면 `injectHomeReplacements()` 자체가 500을 낸다.

**수정 방향:**
```js
// Step 1에서 screenshot을 보고 섹션 순서를 명시적으로 기록한다
// 예: brand-showroom은 best-ranking 다음, 최신제품소식 앞
const INSERT_AFTER = 'best-ranking'; // ← 반드시 live reference screenshot으로 확인된 값

// insertAfterAnchor 존재 여부 먼저 확인
if (typeof insertAfterAnchor !== 'function') {
  throw new Error('helper missing: insertAfterAnchor');
}

html = insertAfterAnchor(html, INSERT_AFTER, brandShowroom);
```

Step 1 체크리스트에 아래를 추가해야 한다:
```
[ ] live reference에서 이 섹션의 앞/뒤 섹션을 기록했다 → 삽입 앵커 결정에 사용
```

---

#### 문제 B: 13.4 Step 1 — anchor 미존재 시 처리 경로 없음 — ✅ 수용 및 13.4 반영

현재 코드:
```js
const hasAnchor = html.includes('brand-showroom') || html.includes('브랜드 쇼룸');
```

`hasAnchor === false`인 경우 어떻게 하는지가 없다.

실제로 `best-ranking`의 경우 홈 raw HTML에 skeleton이 있었지만, 다른 섹션은 완전히 runtime-generated라서 raw HTML에 anchor가 없을 수 있다.

**수정 방향:**

```js
const hasAnchor = html.includes('brand-showroom') || html.includes('브랜드 쇼룸');

if (!hasAnchor) {
  // 방법 1: 다른 알려진 anchor 사용 (live reference에서 순서 확인 후)
  // 방법 2: 특정 section 뒤에 삽입 (best-ranking 등 이미 존재하는 anchor)
  // → 어떤 방법을 쓸지는 live reference screenshot 확인 후 결정
  // → 이 결정 없이 다음 단계로 진행 금지
  throw new Error(`anchor not found for brand-showroom — verify live reference order first`);
}
```

체크리스트에 추가:
```
[ ] anchor가 없는 경우 대체 삽입 위치를 live reference 기준으로 결정했다
```

---

#### 문제 C: 13.4 Step 5 — helper 확인이 주석으로만 되어 있음 — ✅ 부분 수용 및 13.4 반영

현재:
```js
// 최소 확인
formatPrice
toLgeAbsoluteUrl
```

이것은 단순 주석이다. 실제로 함수가 존재하는지 확인하지 않는다.
실패 8 패턴: 주석에 `formatPrice`를 썼지만 실제 선언이 없어서 500이 났다.

**수정 방향:**
```js
// renderer 선언 전에 실행되는 guard
if (typeof formatPrice !== 'function') throw new Error('helper missing: formatPrice');
if (typeof toLgeAbsoluteUrl !== 'function') throw new Error('helper missing: toLgeAbsoluteUrl');
// 공용 삽입 helper는 현재 코드에 없을 수 있다.
// 이 경우 존재하지 않는 helper 이름을 가정하지 말고 injectHomeReplacements 안에 명시적 replacement를 작성한다.
// sandbox에서 500이 나면 helper 누락을 첫 번째로 의심한다.
```

---

### 14.3 수정 요약 — Codex에게 전달

Section 13 원칙 레벨은 통과했다. 아래 4개 항목만 코드 수준에서 수정하면 된다.

| 항목 | 위치 | 수정 내용 | 심각도 |
|---|---|---|---|
| `data-source` 파라미터화 | 13.4 Step 4 | renderer 함수가 `source`를 파라미터로 받도록 수정 | **중** — source가 영구 TBD로 남는 버그 |
| 삽입 앵커 → live reference 연결 | 13.4 Step 6 | Step 1 screenshot 확인 결과를 삽입 앵커 결정에 명시적으로 연결 | **높음** — 잘못된 위치에 섹션 삽입 가능 |
| anchor 미존재 처리 | 13.4 Step 1 | `hasAnchor === false` 시 fallback 또는 명시적 에러 처리 추가 | **중** — 조용히 삽입 누락되는 버그 |
| helper 실행 검증 | 13.4 Step 5 | 주석이 아니라 실제 존재 확인 코드로 교체, 또는 sandbox 500을 첫 번째 검증으로 활용 | **낮음** — sandbox에서 조기 발견 가능하지만 실패 8 재현 위험 |

---

### 14.4 Section 13 최종 판정

| 원칙 | 판정 |
|---|---|
| raw import first 회귀 | ✅ 없음 |
| source 성급한 단정 | ✅ 단정 없음 / ⚠️ 단 결정된 source가 renderer로 흐르지 않음 |
| sandbox first 위반 | ✅ 없음 |
| data-codex-slot 충돌 | ✅ 없음 |
| 삽입 위치 미검증 | ❌ 13.4 Step 6에서 live reference 순서와 연결 없음 |
| anchor 미존재 처리 | ❌ 13.4 Step 1에서 false case 없음 |
| helper 실존 검증 | ⚠️ 주석만 있고 실제 guard 없음 |

**전체 판정:** 원칙 수준은 합의를 준수한다. 구현 레벨에서 3개 항목 수정 필요.

이 네 가지 중 하나라도 해당하면 합의 전 수정하지 않는다.

---

## 15. Claude Review Prompt — Home Lower Order / Source Validation

아래 문안은 홈 하단 구조를 다시 검토할 때 그대로 사용할 수 있는 검토 요청문이다.

```md
홈 하단 구조를 다시 검토해줘.  
이번에는 전체 프로젝트 일반론 말고, **아래 순서를 live reference 기준의 홈 하단 정답 순서 후보**로 두고 검토해줘.

## 전제
- 기준은 `lge.co.kr`의 **실제 live reference 화면**
- `quickmenu` 아래부터 `footer` 전까지의 순서다
- 현재 프로젝트는 `pc raw`, `mo raw`, `live rendered view`, `custom renderer`가 섞여 있어서 홈만 구조 판단이 흔들리고 있다
- 다른 페이지(PLP/PDP/support)는 비교적 잘 맞는데, home만 유독 안 맞는다
- 그래서 이번엔 **섹션 순서와 source 분류**만 엄격하게 검토하려고 한다

## 현재 사람이 눈으로 본 live reference 순서
1. `summary banner`
2. `MD's CHOICE`
3. `timedeal`
4. `best-ranking`
5. `homestyle-explore`
6. `space-renewal`
7. `subscription`
8. `brand-showroom`
9. `latest-product-news`
10. `smart-life`
11. `summary banner 2`
12. `missed-benefits`
13. `lg-best-care`
14. `bestshop-guide`
15. `footer`

## 현재 우리 프로젝트에서 이미 확정된 것
- `summary banner`
- `MD's CHOICE`
- `timedeal`
- `best-ranking`
까지는 어느 정도 닫혔다
- `best-ranking`은 `raw import`가 아니라 `custom renderer + actual data injection`
- 신규 하단 섹션은 원칙적으로 `sandbox -> acceptance -> main`
- `data-codex-slot`이 현재 실제 구현 키다
- `data-slot-id`는 아직 계획 단계다

## 검토 요청
아래 4개를 중심으로만 답해줘.

### 1. 이 순서를 live reference 기준 홈 하단 정답 순서로 받아들여도 되는지
- 순서 자체에 구조적 모순이 있는지
- `quickmenu` 아래는 사실상 mobile-like order로 보는 게 맞는지

### 2. 각 섹션 source 분류 제안
각 섹션을 아래 중 하나로 분류해줘.
- `pc-like`
- `mobile-derived`
- `custom-renderer`
- `TBD`

분류 대상:
- `summary banner`
- `MD's CHOICE`
- `timedeal`
- `best-ranking`
- `homestyle-explore`
- `space-renewal`
- `subscription`
- `brand-showroom`
- `latest-product-news`
- `smart-life`
- `summary banner 2`
- `missed-benefits`
- `lg-best-care`
- `bestshop-guide`

### 3. raw import 금지 대상
아래 중 어떤 섹션은 raw import first로 가면 안 되는지 골라줘.
이유도 같이 적어줘.
- runtime dependency
- skeleton only
- hidden chunk dependency
- JS initialized layout
- asset/template dependency
- order mismatch risk

### 4. sandbox 삽입 anchor 전략
우리는 신규 섹션을 메인에 바로 넣지 않고 sandbox에서 먼저 맞춘다.
그러면 각 섹션을 sandbox에서 시험할 때,
어느 섹션 뒤에 붙여서 확인하는 게 맞는지 제안해줘.

예:
- `brand-showroom`은 `best-ranking` 뒤?
- `latest-product-news`는 `brand-showroom` 뒤?
- `smart-life`는 `latest-product-news` 뒤?

## 중요한 제한
- 현재 코드에 없는 API나 helper를 “있는 것처럼” 가정하지 말아줘
- `data-slot-id`로 이미 구현됐다고 가정하지 말아줘
- `best-ranking`을 mobile raw import로 오해하지 말아줘
- 구현된 것과 planned를 구분해서 적어줘

## 원하는 답변 형식
1. 순서 검증 결과
2. 섹션별 source 분류 표
3. raw import 금지 대상 목록
4. sandbox anchor 제안
5. 지금 우리가 채택한 방식과 충돌하는 부분이 있으면 반박 포인트
```

---

## 16. Section 15 검토 — Claude (구조 문제 진단과 접근 방식)

> 사용자 지적: "Codex가 인식하는 섹션과 실제 클론을 뜨는 사이트의 섹션이 다르다. 이게 구조 문제인 것 같다."
>
> 이 Section은 Section 15의 Q1~Q4에 직접 답변하는 대신, **그 질문의 전제 자체가 깨져 있음을 먼저 지적하고**, ground truth를 확보하는 방식을 제시한다.

---

### 16.1 Section 15의 전제에 있는 핵심 문제

Section 15는 "사람이 눈으로 본 live reference 순서"를 검토 대상으로 제시한다. 하지만:

1. **이 순서가 어느 URL / 어느 UA / 어느 시점에서 본 것인지가 기록되지 않았다**
2. **섹션 이름이 실제 DOM 클래스명인지, 사람이 붙인 의미 이름인지 구분되지 않았다**
   - 예: `homestyle-explore`, `space-renewal`, `smart-life` — 이것이 실제 `.homestyle-explore` 클래스인가, 아니면 "홈스타일 탐색해보기 같은 섹션"이라는 서술인가?
3. **14개 섹션이 모두 하나의 동일한 snapshot에서 나왔다는 증거가 없다**

즉 이 순서는 `ground truth`가 아니라 **관찰자의 기억/추정**이다.
Section 15의 Q1/Q2/Q4에 답하는 순간, 이 기억/추정을 정답으로 고정하게 되고, 사용자가 이미 지적한 "인식 ↔ 실제" 불일치가 그대로 문서에 박제된다.

**그래서 직접 답변하지 않는다.** 먼저 ground truth를 잡는다.

---

### 16.2 섹션 불일치가 발생하는 구조적 원인 6가지

홈만 유독 안 맞는 이유는 아래 중 하나 이상이 동시에 작용하기 때문이다.

| # | 원인 | 증상 |
|---|---|---|
| 1 | **Temporal drift** | 사이트가 업데이트됐는데 오래된 snapshot 기준으로 작업 |
| 2 | **Rendering mode mismatch** | PC UA / 모바일 UA / hybrid 뷰 중 무엇을 기준으로 하는지 고정 안 됨 |
| 3 | **Data-driven variance** | 로그인 상태 / 지역 / 시간 / 캠페인에 따라 섹션 구성이 달라짐 |
| 4 | **Skeleton ↔ runtime-rendered mismatch** | raw HTML에 없는 섹션이 JS로 주입됨 (실패 5 재현) |
| 5 | **Hybrid zone 혼선** | pc source 순서와 mo source 순서가 다른데 섞여서 관찰됨 |
| 6 | **Snapshot divergence** | CDN/cache/AB test로 같은 URL도 다른 응답을 받음 |

`home`은 이 6가지가 전부 동시에 일어날 수 있는 유일한 페이지다. PLP/PDP/support가 잘 맞는 이유는 이 중 1~3개만 해당하기 때문이다.

---

### 16.3 Section 15의 4개 질문 — 답변 가능성 분류

| 질문 | ground truth 필요? | 지금 답 가능? |
|---|---|---|
| Q1. 순서 검증 | ✅ 필요 | ❌ 불가 |
| Q2. 섹션별 source 분류 | ✅ 필요 | ❌ 불가 |
| Q3. raw import 금지 대상 | ❌ 일반 규칙 | ✅ 가능 |
| Q4. sandbox anchor 전략 | ✅ 필요 | ❌ 불가 |

Q1, Q2, Q4는 ground truth가 없으면 guess가 된다. Q3만 일반 규칙으로 답할 수 있다.

---

### 16.4 Q3 답변 (일반 규칙이므로 지금 답 가능)

아래 조건 중 하나라도 해당하면 **raw import first는 금지**다. ground truth와 무관한 일반 규칙이다.

| 조건 | 이유 | 대응 |
|---|---|---|
| runtime dependency | JS가 뒤늦게 DOM 주입 → raw HTML에 없음 | custom renderer + actual data injection |
| skeleton only | 껍데기만 있고 콘텐츠는 API로 채워짐 | skeleton anchor + 별도 data source |
| hidden chunk dependency | Next stream chunk (`S:0`, `S:1`)에 묶여 있음 | global hidden override 금지, 섹션만 명시 재구성 |
| JS initialized layout | slider/carousel init 후에야 폭/위치 확정 | custom renderer에서 JS 초기화 재현 |
| asset/template dependency | 원본 CSS/JS 참조 없으면 깨짐 | 원본 JS/CSS에서 구조 역매핑 후 custom |
| order mismatch risk | pc/mo 순서가 다르거나 확신 없음 | sandbox first, 순서 검증 후 메인 |

**결론:** Section 15의 14개 섹션 중 `best-ranking` 같은 패턴(skeleton only + runtime dependency)이 대부분일 가능성이 높으므로 **원칙적으로 전부 raw import 금지**로 시작하는 게 안전하다. 예외는 ground truth 확인 후 개별 허용한다.

---

### 16.5 Q1, Q2, Q4를 답하기 전에 필요한 것 — Ground Truth Capture

Section 15의 나머지 질문은 아래 5단계가 끝난 후에만 의미 있게 답할 수 있다.

#### Step 1: Capture 환경 고정

기록해야 하는 변수:

```yaml
capture_id: home-gt-2026-04-11-001
url: https://www.lge.co.kr/
user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ... Chrome/..."
viewport: { width: 1440, height: 900 }
device_scale_factor: 1
locale: ko-KR
geo: KR
logged_in: false
timestamp: 2026-04-11T00:00:00+09:00
wait_strategy: networkidle + 3s buffer
```

동일 환경으로 PC / Mobile 두 번 캡처한다.

#### Step 2: 캡처 실행 (Chrome + CDP, 기존 queue 재사용)

기존 `scripts/capture_visual_snapshots.py`와 동일 queue/single-worker 원칙을 따라 새 스크립트 또는 기존 스크립트 확장:

```
scripts/capture_home_ground_truth.py
  → PC capture
  → Mobile capture
  → 각 캡처에서 full DOM + full screenshot 저장
```

산출물:
```
data/ground-truth/home/{capture_id}/
  ├── meta.json                     # 위 Step 1의 환경 변수
  ├── pc-dom.html                   # 전체 rendered DOM
  ├── pc-screenshot.png             # 전체 스크린샷 (footer까지 scroll)
  ├── pc-sections.json              # Step 3 산출물
  ├── mo-dom.html
  ├── mo-screenshot.png
  └── mo-sections.json
```

#### Step 3: 섹션 인벤토리 추출 (자동)

DOM에서 `quickmenu` 직후부터 `footer` 직전까지 각 top-level block을 추출한다.

각 섹션에 대해 저장해야 할 메타:

```json
{
  "index": 5,
  "tag": "section",
  "classes": ["home-best-ranking", "lge-section"],
  "id": null,
  "data_attrs": { "data-section-type": "best-ranking" },
  "bounding_rect": { "x": 0, "y": 2450, "w": 1440, "h": 680 },
  "first_heading": "베스트 랭킹",
  "has_skeleton": true,
  "has_runtime_data": true,
  "outer_html_head": "<section class=\"home-best-ranking\"...>",
  "script_refs": ["bestRanking.min.js"],
  "style_refs": ["bestRanking.min.css"]
}
```

`has_skeleton` / `has_runtime_data` 판정 기준:
- skeleton: 카드 컨테이너는 있지만 내부 텍스트/이미지가 비어 있거나 placeholder
- runtime_data: 같은 선택자에 대해 `DOMContentLoaded` 직후 vs `networkidle` 이후의 텍스트가 다름

#### Step 4: Codex 예상 순서 ↔ 실제 캡처 diff

Section 15의 14개 섹션 이름을 실제 capture의 섹션 인벤토리와 매칭한다.

```markdown
| Codex 예상 | 실제 존재? | 실제 class 이름 | pc 순서 | mo 순서 | 비고 |
|---|---|---|---|---|---|
| summary banner | ? | ? | ? | ? | ? |
| MD's CHOICE | ? | ? | ? | ? | ? |
| ...
```

이 표가 채워지면 다음이 드러난다:

1. Codex가 말한 이름 중 실제 class와 매칭되지 않는 것 (기억/추정이었던 것)
2. Codex가 누락한 섹션 (실제 사이트에는 있는데 예상 목록에 없는 것)
3. pc 순서와 mo 순서가 다른 섹션 (hybrid 결정 필요)
4. runtime으로만 등장하는 섹션 (raw import 금지)

#### Step 5: Ground Truth 문서 고정

```
docs/home-lower-ground-truth.md (신규)
```

내용:
- 어느 capture_id를 정답으로 삼는지
- pc / mo 순서
- 각 섹션의 class, skeleton 여부, runtime dependency
- 변경 감지 규칙 (예: 매주 capture 후 diff 실행)

이 문서가 생기기 전까지 Section 15의 순서는 **"관찰자 메모"로만 취급**하고 코드 기준으로 쓰지 않는다.

---

### 16.6 Ground Truth가 잡히기 전까지의 임시 규칙

ground truth 확보에는 시간이 걸릴 수 있으므로, 그 사이 홈 작업이 완전히 멈추지 않도록 임시 규칙을 둔다.

**허용:**
- 이미 메인 반영된 섹션 유지: `summary banner`, `MD's CHOICE`, `timedeal`, `best-ranking`
- 신규 섹션은 **sandbox 단계까지만** 작업 (`homeSandbox=<slot>`)
- sandbox에서 custom renderer 작성, 샘플 데이터 주입, 시각 확인까지 OK

**금지:**
- 신규 섹션의 **메인 `/clone/home` 반영 금지**
- Section 15의 14개 순서를 "정답"으로 인용 금지
- 섹션별 source를 `pc` / `mo`로 선언 금지 (모두 `TBD` 유지)
- `insertAfterAnchor(html, 'best-ranking', ...)` 같은 암묵 순서 가정 금지

이 규칙은 ground truth 문서가 생기는 순간 자동 해제된다.

---

### 16.7 권고 실행 순서 — 지금부터 무엇을 할지

| 우선순위 | 작업 | 담당 |
|---|---|---|
| 1 | `scripts/capture_home_ground_truth.py` 작성 | Codex |
| 2 | PC / Mobile capture 1회 실행 | Codex |
| 3 | `pc-sections.json` / `mo-sections.json` 추출 자동화 | Codex |
| 4 | Codex 예상 순서 ↔ 실제 섹션 diff 표 작성 | Codex |
| 5 | `docs/home-lower-ground-truth.md` 고정 | Codex + 사용자 승인 |
| 6 | 이 문서 기준으로 Section 15의 Q1/Q2/Q4 재작성 | Claude |
| 7 | Section 13의 신규 섹션 실행 프로토콜을 ground truth 문서에 연결 | Codex |

**핵심 원칙:** 이 순서는 `best-ranking` 방식(sandbox → visual acceptance → main)의 **page-level 버전**이다. 즉 "먼저 ground truth capture → inventory 추출 → 순서 확정 → 이후에만 섹션 작업 재개"다. 섹션 단위에서 sandbox first를 지키는 것과 페이지 단위에서 capture first를 지키는 것은 같은 원칙의 다른 레벨이다.

---

### 16.8 요약 — 지금 답할 수 있는 것 / 없는 것

**지금 답할 수 있는 것:**
1. **Q3 답변 (16.4)** — raw import 금지 조건 6가지 일반 규칙, 지금 바로 적용 가능
2. **Ground truth 확보 방법론 (16.5)** — capture 환경 고정 → 인벤토리 추출 → diff → 문서 고정 5단계
3. **임시 규칙 (16.6)** — ground truth 전까지 sandbox까지만, 메인 반영 금지

**지금 답할 수 없는 것 (거부):**
- Q1. 순서 검증
- Q2. 섹션별 source 분류
- Q4. sandbox anchor 전략

Section 15의 Q1, Q2, Q4는 16.5 Step 5가 끝난 후에만 재요청하라.
그 전에 답하면 관찰자 기억을 코드 정답으로 고정하는 셈이 되고, 사용자가 지적한 "인식 ↔ 실제" 불일치가 그대로 문서에 박제된다.

**답변 거부 자체가 이 프로젝트의 `view truth first` 원칙을 지키는 유일한 방법이다.**

---

### 16.9 Codex 검토 — 수용 / 보정 / 반박

Section 16은 방향 자체는 유효하다. 특히 아래 4개는 수용 가능하다.

1. `home`만 유독 안 맞는 이유를 `Temporal drift / Rendering mode mismatch / Hybrid zone 혼선 / runtime dependency`로 본 진단
2. `raw import first` 금지 조건 6가지 일반 규칙
3. 신규 하단 섹션은 `sandbox -> acceptance -> main`을 더 엄격히 지켜야 한다는 점
4. ground truth를 별도 문서/캡처로 고정해야 한다는 점

하지만 그대로 수용하면 안 되는 부분도 있다.

#### 반박 A: Q1 / Q2 / Q4를 전면 보류하면 현재 진행과 충돌한다

Section 16은 `Q1/Q2/Q4는 ground truth 전까지 답변 불가`라고 했지만, 이 프로젝트는 이미 사용자 visual acceptance를 통해 일부 구간을 잠정 확정해 왔다.

예:
- `summary banner`
- `MD's CHOICE`
- `timedeal`
- `best-ranking`

이 네 개는 완전한 page-level inventory가 없어도:
- live reference를 사용자와 같이 보고
- sandbox에서 맞추고
- 메인 반영 후 재확인
하는 방식으로 닫혔다.

즉, 더 정확한 표현은 다음이다.

- `Q1/Q2/Q4를 최종 문서 정답으로 확정하는 것은 ground truth 이후`
- 하지만 **실행용 잠정 답변**은 사용자 visual confirmation을 전제로 지금도 가능

Section 15의 순서는 "관찰자 기억"으로만 취급할 것이 아니라:

> **사용자 live visual observation 기반의 temporary working truth**

로 낮춰서 사용해야 한다.

#### 반박 B: 새로운 스크립트를 반드시 새로 만들 필요는 없다

Section 16은:

```text
scripts/capture_home_ground_truth.py 작성
```

을 제안하지만, 저장소에는 이미 아래 도구가 있다.

- `scripts/capture_visual_snapshots.py`
- `scripts/capture_states.mjs`
- `tmp_measure_one.js`
- `tmp_measure_timedeal.js`

즉 방향은 맞지만,

> "새 스크립트를 반드시 작성"

이 아니라

> **기존 캡처/측정 도구를 우선 재사용하고, 부족할 때만 새 스크립트 추가**

가 더 정확하다.

#### 반박 C: source를 모두 `TBD`로 되돌리면 현재 accepted baseline과 충돌한다

Section 16.6은 ground truth 전까지 source를 `pc/mo로 선언 금지`라고 했는데,
이 원칙을 이미 accepted-main 섹션까지 확장하면 현재 코드와 문서가 어긋난다.

현재는 이미 다음 source가 코드에 태깅되어 있다.

- `md-choice` → `mobile-derived`
- `timedeal` → `mobile-derived`
- `best-ranking` → `custom-renderer`
- `brand-showroom` → `mobile-derived`
- `latest-product-news` → `mobile-derived`

그리고 `best-ranking`은 실제 구현도 custom renderer다.

따라서 더 맞는 규칙은:

- **accepted-main 섹션의 source 표기는 유지**
- 신규 섹션 또는 논쟁 중인 섹션만 `TBD` 허용

#### 반박 D: page-level ground truth는 필요하지만, 신규 섹션 작업을 완전히 멈추게 하면 안 된다

Section 16의 큰 방향은 맞지만, 현재 프로젝트는 사용자와 같이 view를 확인하며 섹션을 하나씩 닫고 있다.
따라서 page-level ground truth를 기다리느라 아래 작업이 멈추면 안 된다.

허용해야 하는 것:

1. `best-ranking` 이후 섹션을 sandbox에서 계속 실험
2. 사용자 확인 후 수용 가능한 경우만 메인 반영
3. 동시에 capture/inventory 문서를 병행 작성

즉 올바른 운영은:

> **ground truth capture와 section-by-section sandbox 작업을 병행**

이다.

둘 중 하나만 택하는 구조가 아니다.

#### 현재 합의된 보정 결론

1. Section 16의 진단(구조 문제)은 수용
2. Section 16의 raw import 금지 규칙은 수용
3. `home-lower-ground-truth.md` 같은 문서를 만드는 방향은 수용
4. 다만 다음 3개는 보정
   - `Section 15 순서 = temporary working truth`
   - `기존 캡처 도구 우선 재사용`
   - `ground truth 전에도 sandbox 작업은 계속 진행`

#### 실행 결론

지금부터는 두 축을 병행한다.

1. **Execution track**
   - `brand-showroom`
   - `latest-product-news`
   - `smart-life`
   순서로 sandbox 작업 계속

2. **Ground truth track**
   - 기존 캡처 도구 재사용
   - `home-lower-ground-truth.md` 초안 작성
   - 섹션 인벤토리 / 순서 / source 확인

이 방식이 현재 사용자 합의, 기존 성공 패턴(`best-ranking`), 그리고 Section 16의 문제의식을 동시에 만족시키는 가장 현실적인 절충안이다.

---

## 17. Claude 재검토 — Codex 반박 수용 및 병행 트랙 방식 제안

> 사용자 요청: "방식을 전부 수정하기 힘든 현실적 사항이라면 별도로 만들어서 A/B 테스트 방식으로 해보고, 안될 경우 롤백하는 형태. 작은 샌드박스에서 진행하는 방식."
>
> 이 섹션은 Codex 16.9 반박을 전부 수용하고, 사용자 제안대로 A/B + 롤백 가능한 병행 트랙을 구체적으로 설계한다.

---

### 17.1 Codex 반박 A~D 의견 — 전부 수용

| 반박 | 판정 | 이유 |
|---|---|---|
| A. Q1/Q2/Q4 전면 보류는 현재 진행과 충돌 | ✅ **수용** | `summary banner / MD's CHOICE / timedeal / best-ranking`은 page-level inventory 없이도 user visual acceptance로 닫혔다. "canonical truth"와 "working truth"를 구분해야 한다. Section 16의 "답변 거부"는 과했다. |
| B. 새 스크립트 필수 주장은 과함 | ✅ **수용** | `capture_visual_snapshots.py`, `capture_states.mjs`, `tmp_measure_*.js`가 이미 있다. 기존 도구 재사용이 원칙이고, 부족할 때만 신규 작성이다. |
| C. source 전면 TBD 되돌리기는 코드-문서 충돌 | ✅ **수용** | `md-choice / timedeal / best-ranking / brand-showroom / latest-product-news`는 이미 태깅되어 있다. accepted-main 섹션의 태깅은 유지, 논쟁 중이거나 미검증 섹션만 `TBD`로 한다. |
| D. ground truth 기다리느라 작업 멈추면 안 됨 | ✅ **수용** | best-ranking 패턴은 sandbox 병행으로 성공했다. page-level capture와 section-level sandbox는 병행 가능하고 병행해야 한다. |

**Section 16의 16.5~16.7 Step은 Codex 16.9 보정을 받은 상태에서만 읽어야 한다.**

---

### 17.2 보정된 실행 원칙 — 2트랙 병행

Section 16.9에서 Codex가 제시한 "2트랙 병행"은 그대로 유효하다. 여기에 사용자가 제안한 **A/B 테스트 + 롤백** 프레임을 얹는다.

```
                   ┌─────────────────────────────────────┐
                   │         사용자 live acceptance         │
                   └───────────────┬─────────────────────┘
                                   │
                ┌──────────────────┴──────────────────┐
                │                                     │
        Track A (Execution)                  Track B (Ground Truth)
        기존 sandbox 작업 계속                  capture 기반 검증
                │                                     │
      brand-showroom sandbox                 home-lower-ground-truth.md
      latest-product-news sandbox            pc/mo 섹션 inventory
      smart-life sandbox                     순서 diff 표
                │                                     │
                └──────────┬──────────────────────────┘
                           │
                  Merge / Promote / Rollback
                           │
                    `/clone/home` 메인
```

핵심:
- **Track A는 멈추지 않는다** (Codex 반박 D)
- **Track B는 Track A를 깨지 않는다** (격리)
- **승격/롤백이 section 단위로 가능하다** (작은 샌드박스)

---

### 17.3 구현 방식 1 — 작은 샌드박스 단위 A/B (권장, 즉시 적용 가능)

가장 작고 안전한 시작. 기존 `homeSandbox=` 메커니즘을 그대로 확장한다.

#### 작동 방식

```
현재:
  /clone/home?homeSandbox=brand-showroom
  → renderBrandShowroomSection(sampleItems)

추가:
  /clone/home?homeSandbox=brand-showroom&variant=gt
  → renderBrandShowroomSection(sampleItems, { useGroundTruth: true })
```

한 함수 안에서 분기만 추가한다:

```js
function renderBrandShowroomSection(items, opts = {}) {
  const { useGroundTruth = false, source = 'TBD' } = opts;

  if (useGroundTruth) {
    // Track B: ground truth capture 기반 렌더
    // - 새로 추출한 섹션 인벤토리 사용
    // - 실제 DOM class 이름 사용
    // - ground truth의 data-source 값 사용
    return renderBrandShowroomFromGroundTruth(items);
  }

  // Track A: 현재 working truth 기반 렌더 (기존 코드 유지)
  return `
    <section class="codex-brand-showroom"
             data-codex-slot="home-brand-showroom"
             data-source="${source}">
      ...
    </section>
  `;
}
```

#### 비교

```
PC에서 두 탭을 나란히 열고 비교:
  탭1: http://localhost:3000/clone/home?homeSandbox=brand-showroom
  탭2: http://localhost:3000/clone/home?homeSandbox=brand-showroom&variant=gt
```

#### 장점
- 기존 sandbox 메커니즘 재사용 (신규 라우트/워크스페이스 불필요)
- 섹션 단위로 **완전 격리**
- Track A 코드는 수정하지 않음 (단순 분기만 추가)
- 롤백이 필요 없음 — Track B가 실패하면 그냥 `variant=gt` 쓰지 않으면 됨

#### 적용 범위
- `brand-showroom`, `latest-product-news`, `smart-life` 등 **미검증 신규 섹션**
- 이미 닫힌 `summary banner / MD's CHOICE / timedeal / best-ranking`에는 적용 안 함 (Codex 반박 C 수용)

---

### 17.4 구현 방식 2 — 페이지 레벨 A/B (필요 시, 더 큰 실험)

Ground truth가 일부 정리된 후 "holistic한 순서"를 실험하고 싶을 때 사용한다.

#### 작동 방식

```
현재:
  /clone/home
  → rewriteCloneHtml() → injectHomeReplacements() → 기존 섹션 삽입

추가:
  /clone/home?gt=1
  → rewriteCloneHtml() → injectHomeReplacementsGT() → ground truth 기반 순서로 삽입
```

`injectHomeReplacements()`는 절대 건드리지 않고, `injectHomeReplacementsGT()`를 **복사본으로 신규 작성**한다.

```js
// 기존 (절대 수정 금지)
function injectHomeReplacements(html, ctx) {
  // Track A: 현재 working order
  // best-ranking 뒤에 brand-showroom, latest-product-news, smart-life 순서로 삽입
  ...
}

// 신규 (Track B용, 독립 파일/함수)
function injectHomeReplacementsGT(html, ctx) {
  // Track B: ground truth 순서
  // inventory JSON 읽어서 섹션 순서 결정
  const inventory = loadGroundTruthInventory(); // home-lower-ground-truth.md 기반
  for (const section of inventory) {
    html = insertSection(html, section);
  }
  return html;
}

// 라우트 분기
app.get('/clone-content/home', (req, res) => {
  const useGT = req.query.gt === '1';
  const injectFn = useGT ? injectHomeReplacementsGT : injectHomeReplacements;
  const html = injectFn(baseHtml, ctx);
  res.send(html);
});
```

#### 롤백
- `?gt=1` 쿼리 제거하면 즉시 기존 동작으로 복귀
- `injectHomeReplacementsGT()` 함수 자체를 삭제해도 기존 코드에 영향 없음

#### 장점
- 전체 홈 하단 순서를 ground truth 기준으로 실험 가능
- Track A 경로는 완전히 무영향
- 두 경로를 `/workbench/home-compare` 같은 곳에서 나란히 비교 가능

#### 단점
- 두 함수를 유지하는 복잡도 증가
- 너무 오래 분기 상태가 유지되면 divergence 발생

#### 사용 시점
- 17.3 방식으로 섹션 2~3개가 Track B에서 검증된 후
- ground truth inventory가 어느 정도 채워진 후
- **지금 당장은 아니다**

---

### 17.5 구현 방식 3 — Git 브랜치 격리 (Code 레벨 rollback)

진짜 큰 실험을 할 때만 사용. 지금 단계에서는 과하다.

```bash
# 현재 작업 (Track A)
git checkout main

# 실험 작업 (Track B)
git checkout -b experiment/home-ground-truth
# 자유롭게 실험
git commit -am "experiment: ground truth rendering"

# 성공 시
git checkout main
git merge experiment/home-ground-truth

# 실패 시
git branch -D experiment/home-ground-truth
# main은 무영향
```

이건 17.3/17.4가 커버하지 못하는 **root cause 리팩터링** 수준의 실험에만 쓴다. 예: renderer 함수 전체 재작성, source resolver 교체 등.

---

### 17.6 Rollback 메커니즘 — 각 레벨별

| 레벨 | 실패 증상 | Rollback 방법 |
|---|---|---|
| 섹션 샌드박스 (17.3) | `variant=gt`에서 500 또는 시각 깨짐 | 해당 쿼리 쓰지 않음. 코드 변경 없음. |
| 페이지 A/B (17.4) | `?gt=1`에서 회귀 발생 | `?gt=1` 쿼리 쓰지 않음. `injectHomeReplacementsGT()` 삭제 가능. |
| Git 브랜치 (17.5) | experiment 브랜치 전체 실패 | `git branch -D` |
| Main 반영 후 회귀 | accepted 섹션까지 깨짐 | `git revert <commit>` + workspace snapshot 복구 |

**메인 반영은 여전히 가장 조심해야 하는 지점이다.**
- 메인 반영 전에 Track B가 반드시 Track A와 비교 검증되어야 함
- 메인 반영 후에도 git tag로 섹션별 체크포인트 유지
  - 예: `git tag home-brand-showroom-v1` 메인 반영 직후
  - 회귀 시 `git revert HEAD` 또는 해당 tag로 rollback

---

### 17.7 Track B → Track A 승격 기준

Track B에서 맞춘 결과를 메인(`Track A`)으로 올릴 때 아래 전부 통과해야 한다.

```
[ ] Track B sandbox에서 시각 acceptance 확인 (사용자 확인)
[ ] Track A sandbox(기존 방식)와 시각 비교 → Track B가 동등 또는 개선
[ ] Track A의 기존 accepted 섹션(summary banner ~ best-ranking) 회귀 없음
[ ] 500 / runtime error 없음
[ ] data-codex-slot 유지
[ ] data-source가 TBD가 아닌 실제 확인된 값으로 교체됨
[ ] Ground truth 문서(`home-lower-ground-truth.md`)에 해당 섹션 기록됨
[ ] 사용자가 메인 반영 명시적으로 승인함
```

하나라도 미충족이면 Track B에 머물고 Track A로 승격 안 한다.

---

### 17.8 승격 실패 시 — Track B 내에서 재시도 또는 폐기

Track B에서 섹션이 작동하지 않을 때:

1. **재시도 (recoverable)**
   - ground truth inventory에서 해당 섹션 데이터 재확인
   - capture 환경 변수 조정 (UA, viewport, wait strategy)
   - 같은 sandbox에서 다시 작업

2. **폐기 (unrecoverable)**
   - Track B 실험을 버리고 Track A 방식(working truth)으로 복귀
   - 해당 섹션은 기존 sandbox 패턴으로 닫음
   - 이 결정도 `home-lower-ground-truth.md`에 "TB 실패 사유"로 기록

폐기도 유효한 결과다. "ground truth 기반 접근이 이 섹션에서는 통하지 않는다"는 사실 자체가 다음 섹션 결정에 정보가 된다.

---

### 17.9 지금 바로 시작할 수 있는 최소 구현

사용자가 "현실적인 방식"을 요청했으므로, 지금 바로 실행 가능한 가장 작은 증분을 제안한다.

#### 단계 0: 아무것도 추가하지 않고 시작 (Day 0)

현재 Track A(`brand-showroom` sandbox 작업)을 그대로 진행한다.
어떤 코드도 추가하지 않는다. Section 17.3~17.8은 준비 문서로만 사용한다.

#### 단계 1: 첫 ground truth capture 1회만 실행 (Day 1)

```bash
# 기존 스크립트 재사용
cd /mnt/c/Users/mrgbi/lge-site-analysis
python3 scripts/capture_visual_snapshots.py home
# 산출물: data/visual/home/live-reference.png, working.png, compare.png
```

기존 스크립트가 PC/Mobile UA 분리 캡처를 하지 못하면, 그때만 최소한의 옵션 추가:
```bash
python3 scripts/capture_visual_snapshots.py home --ua pc
python3 scripts/capture_visual_snapshots.py home --ua mo
```

이 결과를 **수동으로** 봐서 Section 15의 14개 섹션이 실제로 존재하는지 눈으로 1차 확인한다.

#### 단계 2: `home-lower-ground-truth.md` 초안 작성 (Day 1~2)

단계 1의 캡처를 보면서 아래 최소 정보만 기록:

```markdown
# Home Lower Ground Truth (draft)

## Capture
- URL: https://www.lge.co.kr/
- UA: (어느 것으로 찍었는지)
- Date: 2026-04-11
- Screenshot: data/visual/home/live-reference.png

## Observed order (quickmenu 아래부터 footer까지)
1. [실제로 본 첫 번째 섹션 이름 + 추정 class]
2. ...

## Matches Section 15 order?
(Section 15 목록과 일치/불일치 표시)

## Notes
- (관찰자가 확신하지 못하는 부분)
```

이 문서는 완벽할 필요 없다. **"일단 1개 snapshot에서 본 것"** 이 기록되면 충분하다.

#### 단계 3: Track A sandbox 작업은 계속 (Day 1~N)

Codex 반박 D대로 `brand-showroom` sandbox 작업을 멈추지 않는다.
단계 1~2는 병행이다.

#### 단계 4: Track B는 첫 섹션부터 조심스럽게 (Day N+)

`brand-showroom`이 Track A sandbox에서 어느 정도 시각이 나오면, 그때 17.3의 `variant=gt` 분기를 **1개 섹션에만** 추가해서 비교해본다.

Track B가 Track A보다 명백히 나으면 Track A로 승격 시도.
Track B가 동등하거나 나쁘면 Track A 그대로 진행, Track B 실험은 폐기.

#### 단계 5: 2~3개 섹션에서 Track B 패턴이 반복 작동하면 그때 17.4 고려

17.4의 페이지 레벨 A/B (`?gt=1` 라우트)는 Track B가 섹션 레벨에서 2~3번 성공한 후에만 추가한다. 미리 만들지 않는다.

---

### 17.10 Codex 답변에 대한 Claude 의견 — 종합

**짧게:**

Codex 16.9는 맞다. 4개 반박 전부 수용한다. Section 16의 "답변 거부 / 전면 정지" 기조는 과했고, 현실적으로 Track A(기존 sandbox 작업)을 멈추면 프로젝트 동력이 죽는다.

**다만:**

Codex 16.9의 "2트랙 병행"은 방향은 맞지만 **trace 메커니즘이 구체화되지 않았다**. 두 트랙을 병행할 때 어떻게 격리하고, 어떻게 비교하고, 어떻게 롤백할지가 문서에 없었다. 사용자가 요청한 "A/B + 롤백 + 작은 샌드박스" 프레임이 정확히 그 공백을 메운다.

**결론:**

- Section 16.9 수용 (Codex 기조 유지)
- Section 17.3 즉시 적용 (작은 샌드박스 variant 분기)
- Section 17.4는 Track B 성공 2~3회 후 고려
- Section 17.5는 지금 불필요
- Section 17.9 단계 0~3부터 **오늘 시작 가능**

**핵심 원칙 한 줄:**

> `best-ranking` 방식이 "섹션 단위 sandbox first"였다면, 지금 필요한 건 "실험 단위 variant first"다. Track B는 항상 격리된 variant로 시작하고, 성공했을 때만 Track A로 합류한다.

이 방식이 Codex의 현실적 제약과 Section 16의 구조 진단을 동시에 만족시키는 가장 작은 증분이다.

---

### 17.11 Codex 검토 — 코드 현실 기준 보정

Section 17의 방향은 대체로 수용 가능하다. 특히 아래는 그대로 유효하다.

1. `2트랙 병행` 자체
2. `sandbox first`
3. `variant 기반 A/B`
4. 실패 시 작은 범위에서 롤백

다만 예시 코드와 실행 예시는 현재 저장소 현실과 안 맞는 부분이 있다.

#### 보정 A: 현재 구현 키는 `data-source`가 아니라 `data-codex-source`

현재 코드:

- `server.js:3081`
- `server.js:4203`

즉 Section 17의 예시:

```html
data-source="TBD"
```

는 현재 구현 기준으로는 아래가 맞다.

```html
data-codex-source="TBD"
```

`data-source`는 미래 alias로 추가할 수는 있지만, 지금 예시를 그대로 복사하면 실제 코드와 어긋난다.

#### 보정 B: `home-brand-showroom` 같은 slot id 예시는 현재 코드와 다르다

현재 구현은:

- `best-ranking`
- `brand-showroom`
- `latest-product-news`
- `md-choice`
- `timedeal`

처럼 **짧은 slot id**를 쓴다.

따라서 Section 17의 예시:

```html
data-codex-slot="home-brand-showroom"
```

보다는 현재 구현 기준으로:

```html
data-codex-slot="brand-showroom"
```

가 맞다.

#### 보정 C: `renderBrandShowroomSection()`은 현재 존재하지 않는다

Section 17.3은:

```js
renderBrandShowroomSection(items, opts)
```

같은 예시를 쓰지만, 현재 `brand-showroom`, `latest-product-news`는 이 구조가 아니다.

현재는:

1. `extractMobileBrandShowroomSection()`
2. `extractMobileLatestProductNewsSection()`
3. `injectTemplateImagesIntoSection()`
4. `markHomeLowerReplay()`
5. `renderHomeEnhancements()`
6. `injectHomeReplacements()`

경로를 탄다.

즉 `variant=gt`를 붙이더라도 처음에는 `renderBrandShowroomSection()` 새 함수부터 만들기보다,
기존 `homeSandbox` 파이프라인 안에서 분기하는 게 더 현실적이다.

더 정확한 초기 적용 위치:

- `parseHomeEnhancements(..., options)`
- `renderHomeEnhancements(..., options)`
- `injectHomeReplacements(..., options)`

#### 보정 D: 페이지 레벨 A/B (`injectHomeReplacementsGT`)는 가능하지만 아직 이르다

Section 17.4는 방향상 맞다.
하지만 지금 바로 `injectHomeReplacementsGT()` 복사본을 만드는 건 아직 이르다.

이유:

1. `brand-showroom`
2. `latest-product-news`
3. `smart-life`

세 섹션 중 하나도 아직 `Track B`에서 시각 acceptance를 통과하지 않았다.

따라서 현재 우선순위는:

1. 섹션 레벨 variant/sandbox
2. 그다음 page-level A/B

이다.

#### 보정 E: Git 브랜치 rollback은 현재 저장소 상태에선 바로 적용 불가

현재 작업 디렉터리에서는:

```bash
git status
→ fatal: not a git repository
```

즉 Section 17.5의 git branch rollback은 **개념적으로는 맞지만, 현재 이 작업 경로에선 즉시 적용할 수 없다.**

이 항목은:

- 저장소가 실제 git 관리 하에 있음을 먼저 확인한 뒤
- 그 다음 사용

으로 내려야 한다.

#### 보정 F: `capture_visual_snapshots.py`는 현재 `--ua` 옵션이 없다

현재 스크립트:

- `scripts/capture_visual_snapshots.py`

는 `--ua pc`, `--ua mo` 같은 옵션을 지원하지 않는다.
그리고 `home` live reference는 기본적으로:

```python
https://www.lge.co.kr/m/home
```

으로 resolve된다.

즉 Section 17.9 예시:

```bash
python3 scripts/capture_visual_snapshots.py home --ua pc
python3 scripts/capture_visual_snapshots.py home --ua mo
```

는 현재 그대로는 실행되지 않는다.

맞는 표현은:

1. 기존 스크립트를 그대로 써서 baseline screenshot 확보
2. PC/MO 분리 캡처가 필요하면 **그때 옵션을 추가하거나 별도 small script 작성**

이다.

#### 현재 합의 가능한 실행안

1. Section 17의 `2트랙 병행` 수용
2. Section 17.3의 `작은 샌드박스 A/B` 수용
3. 단, 첫 구현은 **기존 `homeSandbox` 파이프라인 안에서 variant 분기**
4. Section 17.4는 보류
5. Section 17.5는 git 환경 확인 전 보류
6. Section 17.9의 캡처 예시는 현재 스크립트 옵션 현실에 맞게 수정 필요

#### 실행 우선순위

1. `brand-showroom` sandbox
2. `latest-product-news` sandbox
3. `smart-life` sandbox
4. 각 섹션에서 필요한 경우만 `variant=gt` 추가
5. 2~3개 성공 후 page-level A/B 검토

---

## Section 18. Claude PM 검토 — 17.11 보정 수용/거부 및 구조 지시

### 18.1 수용하는 기술 보정 (A, B, F)

아래 3개 보정은 코드 현실을 정확히 반영한 것으로 수용한다.

| 보정 | 내용 | 판단 |
|------|------|------|
| A | `data-source` → `data-codex-source` | 수용 |
| B | `home-brand-showroom` → `brand-showroom` | 수용 |
| F | `--ua` 옵션 없음, 별도 스크립트 작성 필요 | 수용 |

---

### 18.2 보정 C — 거부 (핵심 구조 문제)

Codex 보정 C는 다음을 제안한다:

> "renderBrandShowroomSection() 새 함수를 만들기보다 기존 homeSandbox 파이프라인 안에서 분기하는 게 현실적"

**이 방향은 수용하지 않는다.**

이유:

현재 파이프라인은 다음 구조다:

```
extractMobileBrandShowroomSection()
  → injectTemplateImagesIntoSection()
  → markHomeLowerReplay()
  → renderHomeEnhancements()
  → injectHomeReplacements()
```

이 구조의 문제:

1. **섹션마다 별도 extract/inject 함수가 추가된다** — 섹션이 늘수록 코드가 분기로 가득 찬다
2. **variant 전환이 코드 분기다** — LLM이 source를 바꾸려면 코드를 건드려야 한다
3. **slot 경계가 없다** — LLM이 "brand-showroom 슬롯의 source를 custom으로 전환"하는 명령을 실행할 수 있는 단위가 없다
4. **replay 기준이 slot 단위가 아니다** — 어느 slot이 무슨 source로 렌더링되었는지 추적 불가

이것이 사용자가 걱정하는 것과 정확히 일치한다:

> "섹션별로 하나하나씩 수정하고 별도로 맞추는 과정 자체가 이후 LLM 프론트 수정 뷰 변경이 안 될까봐 걱정"

걱정이 맞다. 기존 파이프라인 안에서 variant 분기를 추가하는 것은 **섹션별 수동 맞추기 패턴을 구조화하는 것이 아니라, 강화하는 것이다.**

---

### 18.3 올바른 구조 방향 — Slot Registry 기반 렌더링

LLM이 나중에 `PATCH /api/workspace/patch` 한 번으로 source를 교체하려면, 렌더링 파이프라인이 **slot registry를 읽어서 동작**해야 한다. 코드 분기가 아니다.

#### 목표 구조

```js
// slot-registry 최소 형태 (server.js 또는 별도 모듈)
const homeSlotRegistry = {
  'brand-showroom': {
    id: 'brand-showroom',
    viewportProfile: 'mo',
    activeSourceId: 'captured',   // LLM이 이것만 바꾸면 된다
    sources: {
      captured: {
        type: 'captured',
        render: (data) => renderBrandShowroomCaptured(data)
      },
      custom: {
        type: 'custom',
        render: (data) => renderBrandShowroomCustom(data)
      }
    }
  },
  'latest-product-news': {
    id: 'latest-product-news',
    viewportProfile: 'mo',
    activeSourceId: 'captured',
    sources: { ... }
  }
  // 새 섹션을 추가할 때마다 여기에 entry 하나 추가
};
```

#### 렌더링 파이프라인

```js
function renderHomeSlot(slotId, data, registry = homeSlotRegistry) {
  const slot = registry[slotId];
  if (!slot) throw new Error(`Unknown slot: ${slotId}`);
  const source = slot.sources[slot.activeSourceId];
  if (!source) throw new Error(`Unknown source: ${slot.activeSourceId}`);
  const html = source.render(data);
  // data-codex-slot, data-codex-source 자동 주입
  return wrapWithSlotMeta(html, slot);
}

function wrapWithSlotMeta(html, slot) {
  // 기존 data-codex-slot / data-codex-source 부착 위치를 이 함수로 통합
  return html.replace(
    /^<(\w+)/,
    `<$1 data-codex-slot="${slot.id}" data-codex-source="${slot.activeSourceId}"`
  );
}
```

#### LLM patch 동작 예시

```js
// LLM이 PATCH /api/workspace/patch를 호출하면
// 서버에서 아래만 실행하면 된다
function applyPatch(patch) {
  if (patch.action === 'switch_source') {
    homeSlotRegistry[patch.slotId].activeSourceId = patch.sourceId;
  }
  if (patch.action === 'update_scoped_css') {
    homeSlotRegistry[patch.slotId].sources[patch.sourceId].scopedCss = patch.css;
  }
  // 이게 전부다. 코드 분기 없음.
}
```

이 구조에서는 새 섹션을 추가하더라도 `injectHomeReplacements()` 안에 분기 코드를 추가하는 게 아니라, **registry에 entry 하나를 추가하는 것으로 끝난다.**

---

### 18.4 보정 D — 부분 수용, 조건 추가

`injectHomeReplacementsGT()` 복사본 생성을 지금 하지 않는 것은 동의한다.

단, 조건:

- page-level A/B를 나중에 추가할 때도 **slot registry에서 activeSourceId를 읽는 구조**여야 한다
- `injectHomeReplacementsGT()`가 별도 함수일 이유가 없어진다 — registry에서 `gt` source를 읽으면 된다
- 지금 당장 만들 필요는 없지만, 나중에 만들더라도 코드 복사 방식은 허용하지 않는다

---

### 18.5 보정 E — 거부, 즉시 시정 지시

Codex 보정 E는 다음을 제안한다:

> "git status → fatal: not a git repository. git branch rollback은 현재 이 작업 경로에선 즉시 적용할 수 없다."

**이것은 현실 제약이 아니라 기술 부채다. 즉시 시정해야 한다.**

이유:

1. git 없이는 롤백 기준이 없다 — Track B 실패 시 "어느 상태로 돌아가는가"가 정의되지 않는다
2. Section 6 Queue execution rule에서 이미 "lock files must prevent duplicate runs"를 결정했다 — lock 파일 기반 직렬화를 운용하는 프로젝트가 version control 없이 운영되는 것은 수용할 수 없다
3. 실험 단위 variant first 원칙은 Track B 실패 → Track A로 복귀가 가능해야 한다 — git 없이 이 보장을 줄 수 없다

**Codex 즉시 지시:**

```bash
# 프로젝트 루트에서 실행
git init
git add .
git commit -m "chore: initial commit — current working state before slot registry refactor"
```

이것은 5분 작업이다. 현실 제약이 아니다.

---

### 18.6 사용자 핵심 우려 — PM 진단

사용자가 제기한 문제를 정리한다:

> "섹션별로 하나하나씩 수정하고 별도로 맞추는 과정 자체가 이후 LLM 프론트 수정 뷰 변경이 안 될까봐 걱정"

이 우려는 정당하다. 지금 Codex가 진행하는 방식의 구조적 결함:

| 현재 방식 | LLM 목표 요구 |
|-----------|--------------|
| 섹션마다 `extractMobile*()` 함수 추가 | slot registry에 entry 추가 |
| variant 전환 = 코드 분기 | variant 전환 = registry `activeSourceId` 변경 |
| 섹션 경계 = 암묵적 (함수 이름에 의존) | 섹션 경계 = 명시적 (slot id) |
| replay = 전체 파이프라인 재실행 | replay = slotId 단위 재렌더링 |
| LLM이 수정하려면 코드를 건드려야 함 | LLM이 PATCH API 한 번으로 수정 |

지금 패턴을 계속 쌓으면, LLM이 나중에 연결되더라도 **LLM이 건드릴 수 있는 단위가 없다.** LLM에게 전달할 수 있는 것은 slotId + activeSourceId 쌍이다. 그것이 없으면 LLM은 코드를 직접 편집해야 한다. 그것은 이 프로젝트의 목표가 아니다.

---

### 18.7 Codex에게 주는 즉시 지시 — 변경 불가 규칙

아래는 현실 제약을 이유로 낮추거나 우회할 수 없다.

#### 규칙 1: 새 섹션 추가 = slot registry entry 먼저

새로운 home lower 섹션(`latest-product-news`, `smart-life` 등)을 코드로 추가하기 전에, **반드시 slot registry entry를 먼저 작성한다.**

```js
// 코드 작성 전에 이것이 먼저 있어야 한다
homeSlotRegistry['latest-product-news'] = {
  id: 'latest-product-news',
  viewportProfile: 'mo',
  activeSourceId: 'captured',
  sources: {
    captured: { type: 'captured', render: null },  // 아직 구현 전이면 null
    custom: { type: 'custom', render: null }
  }
};
```

render 함수가 아직 없어도 된다. **slot id와 source 목록이 먼저 존재해야 한다.**

#### 규칙 2: render 함수는 slot registry를 통해 호출

```js
// 허용하지 않는 패턴
injectHomeReplacements() {
  if (sectionType === 'brand-showroom') { ... }
  if (sectionType === 'latest-product-news') { ... }
  // 분기가 계속 늘어나는 구조
}

// 허용하는 패턴
injectHomeReplacements() {
  for (const slotId of Object.keys(homeSlotRegistry)) {
    const html = renderHomeSlot(slotId, data[slotId]);
    inject(html);
  }
}
```

#### 규칙 3: `data-codex-slot` + `data-codex-source`는 렌더링 함수가 자동 부착

개별 섹션 렌더 함수에서 직접 attribute를 붙이지 않는다. `wrapWithSlotMeta()`가 일괄 처리한다.

#### 규칙 4: git 초기화는 오늘 실행

`git init` → 초기 commit → 이후 모든 실험은 커밋 단위로 추적.

---

### 18.8 허용하는 점진적 이행 경로

전체 리팩토링을 지금 당장 요구하지 않는다. 아래 순서로 점진 이행한다.

#### 단계 1 (오늘): git 초기화

```bash
git init
git add .
git commit -m "chore: initial commit"
```

#### 단계 2 (brand-showroom 작업 중): slot registry 파일 생성

```js
// home-slot-registry.js (또는 server.js 내 상단)
const homeSlotRegistry = {
  'brand-showroom': {
    id: 'brand-showroom',
    viewportProfile: 'mo',
    activeSourceId: 'captured',
    sources: {
      captured: { type: 'captured', render: renderBrandShowroomCaptured },
    }
  }
};
module.exports = { homeSlotRegistry, renderHomeSlot };
```

`brand-showroom`의 기존 코드를 이 registry에 역소급 등록한다.

#### 단계 3 (latest-product-news 시작 전): registry entry 먼저

`latest-product-news` 코드를 작성하기 전에 registry entry를 추가한다. render는 나중에 채운다.

#### 단계 4 (sandbox A/B 때): variant는 sources에 추가

`variant=gt`가 필요하면 `sources['gt'] = { ... }` 추가, `activeSourceId = 'gt'`로 전환. 코드 분기 없음.

---

### 18.9 PM 최종 입장

Codex의 기술 보정(A, B, F)은 맞다. 수용한다.

그러나 보정 C(기존 파이프라인 분기)는 **LLM 편집 목표와 구조적으로 충돌하므로 수용하지 않는다.**

보정 E(git 없음 = 현실 제약)는 **즉시 시정해야 할 기술 부채다.**

사용자의 걱정은 정확하다. 섹션별 수동 맞추기 패턴이 구조로 굳어지면, LLM이 나중에 연결되더라도 수정 가능한 단위가 없다. 지금 당장 slot registry를 도입하는 것이 추가 공수가 아니다. **지금 slot registry 없이 섹션을 계속 추가하는 것이 나중에 갚아야 할 부채를 쌓는 것이다.**

**변경 불가 원칙 한 줄:**

> 새로운 섹션을 추가하는 모든 코드는 반드시 slot registry를 통해 등록되어야 한다. LLM이 `PATCH /api/workspace/patch` 한 번으로 source를 바꿀 수 없는 구조는 받아들이지 않는다.

---

### 18.10 Codex 검토 — 최종 LLM 목표 기준 판정

Section 18은 이번에는 단순한 `home` view 작업이 아니라, **최종 목표인 "LLM이 프론트에서 slot/component를 바꾸며 테스트하는 시스템"** 기준으로 읽어야 한다. 그 기준에서 보면 핵심 진단은 대체로 맞다.

#### 수용 1: 현재 `homeSandbox` 파이프라인을 그대로 확장하면 LLM 연결성이 약하다

현재 코드:

- `extractMobileBrandShowroomSection()` / `extractMobileLatestProductNewsSection()`
- `injectTemplateImagesIntoSection()`
- `renderHomeEnhancements()`
- `injectHomeReplacements()`

이 경로는 **view를 맞추는 데는 유효**했지만, 새로운 하단 섹션이 늘어날수록 아래 문제가 커진다.

1. 섹션별 함수가 계속 늘어난다
2. source 전환이 코드 분기가 된다
3. slot boundary가 함수/정규식에 암묵적으로 묻힌다
4. LLM이 바꿔야 할 단위(`slotId`, `activeSourceId`)가 1급 데이터로 존재하지 않는다

즉 Section 18.2의 지적은 **장기적으로 맞다.**

#### 수용 2: slot registry 방향은 맞다

최종 목표가:

- LLM이 특정 컴포넌트의 텍스트/레이아웃/이미지/variant를 바꾸고
- 계정별 workspace에서 확인하고
- replay/workbench로 다시 검증하는 것

이라면, 최소한 아래 구조가 필요하다.

```js
slotId
activeSourceId
availableSources
viewportProfile
render()
```

즉 `slot registry`는 나중 옵션이 아니라 **목표 구조의 핵심**이다.

#### 부분 수용 3: 하지만 "지금부터 모든 신규 섹션은 registry 먼저"는 방향은 맞아도, 구현 방식은 점진 이행이어야 한다

Section 18.7은 방향상 옳다.
다만 현재 프로젝트는 이미:

- `best-ranking` accepted-main
- `brand-showroom` sandbox
- `latest-product-news` sandbox

까지 진행 중이다.

그래서 현실적으로는:

1. **현재 render path를 즉시 전면 폐기**가 아니라
2. **기존 render path를 registry 뒤로 감싸는 점진 이행**

이 맞다.

즉 초기 단계에서는 아래 구조가 더 현실적이다.

```js
const homeSlotRegistry = {
  'best-ranking': {
    id: 'best-ranking',
    viewportProfile: 'mo',
    activeSourceId: 'custom-renderer',
    sources: {
      'custom-renderer': { render: renderBestRankingSandboxSection }
    }
  },
  'brand-showroom': {
    id: 'brand-showroom',
    viewportProfile: 'mo',
    activeSourceId: 'mobile-derived',
    sources: {
      'mobile-derived': {
        render: (ctx) =>
          markHomeLowerReplay(
            injectTemplateImagesIntoSection(ctx.brandShowroomSection, ctx.brandShowroomProducts),
            'brand-showroom',
            'mobile-derived'
          )
      }
    }
  }
}
```

즉 `extract*()/inject*()`를 당장 버리는 게 아니라, **source renderer 구현체로 registry에 수용**하는 방식이 맞다.

#### 부분 반박 4: `git init`은 필요하지만 "5분 작업"이라고 단정하면 안 된다

Section 18.5의 방향은 맞다.
롤백 기준을 위해 version control은 필요하다.

하지만 현재 작업 디렉터리는 아직 git repository가 아니고, 아래처럼 대용량 산출물도 많다.

- `data/`
- `tmp/`
- screenshot/artifact

따라서 `git init`은 필요하지만, 바로 아래를 같이 결정해야 한다.

1. `.gitignore`
2. 추적할 파일 / 제외할 파일
3. 초기 commit 범위

즉:

- **git 도입 필요** → 수용
- **그냥 `git add .` 바로 실행** → 보정 필요

#### 반박 5: `injectHomeReplacements()`에서 분기를 전부 제거하는 단계는 아직 이르다

Section 18.7의 이상적인 형태는 맞다.
하지만 지금 당장:

```js
for (const slotId of Object.keys(homeSlotRegistry)) { ... }
```

로 완전히 뒤집으면, 이미 맞춘:

- `hero`
- `quickmenu`
- `promotion`
- `md-choice`
- `timedeal`
- `best-ranking`

까지 흔들 위험이 크다.

현재 맞는 순서는:

1. **새 하단 섹션부터 registry 진입**
2. 기존 accepted-main 섹션은 점진 이관
3. 이관이 누적되면 그때 `injectHomeReplacements()` 일반화

즉 `full registry rewrite now`는 과하고,
`new lower sections must register first`는 수용 가능하다.

#### 최종 판단

Section 18은 아래처럼 읽는 것이 맞다.

**바로 수용**
1. slot registry 방향
2. LLM 목표 기준에서 현재 파이프라인이 장기적으로 약하다는 지적
3. git 도입 필요성

**보정 후 수용**
1. 기존 renderer를 source 구현체로 registry 뒤에 감싼다
2. 신규 하단 섹션부터 registry-first로 간다
3. git은 `.gitignore` 포함해서 도입한다

**지금은 보류**
1. 전체 `injectHomeReplacements()` 전면 재작성
2. page 전체를 한 번에 registry loop로 교체

#### 실행 결론

이 프로젝트 목적 기준으로, 다음 원칙이 맞다.

1. **view 작업은 계속한다**
2. **하지만 신규 하단 섹션은 이제 registry entry 없이 추가하지 않는다**
3. **기존 accepted 섹션은 나중에 점진적으로 registry로 승격한다**

즉:

> `best-ranking`까지는 view-first로 잠궜고,  
> `brand-showroom`부터는 view-first + registry-first를 같이 시작해야 한다.

## 19. Home Lower Canonical Mapping Notes

### 19.1 `summary banner`

- 현재 canonical raw mapping:
  - mobile `메인 상단 배너 영역`
  - class: `HomeMoBannerPromotion_banner_promotion__...`
- 현재 메인에서는 `quickmenu` 아래 프로모션으로 이미 반영됨

### 19.2 `summary banner 2`

- 현재 canonical raw mapping:
  - mobile `메인 하단 배너 영역`
  - class: `HomeMoBannerPromotion_banner_promotion__...`
- 현재 메인에서는 `summary-banner-2` slot으로 반영됨

### 19.3 `homestyle-explore`

- 아직 독립 lower section으로 확정하지 않음
- 현재 가장 유력한 해석:
  1. hero 2번 캠페인 `All New 세일 홈스타일 특가 최대 82% 할인`
  2. 또는 `메인 상단 배너 영역` 1번 슬라이드 `한샘, 시몬스, 일룸 등 최대 82% 브랜드 특가`
- 즉 `homestyle-explore`는 section id가 아니라, 사용자가 읽은 캠페인 의미 이름일 가능성이 높다
- current decision:
  1. lower independent slot으로 승격하지 않는다
  2. `hero / top promotion campaign label`로만 관리한다
  3. home lower main slot completion 기준에서 제외한다

## 20. Current LLM-Readiness Gaps

아래 항목은 현재 view/slot/source는 상당 부분 올라왔지만, 아직 `LLM-editable`로 바로 열 수 없는 축이다.

1. interaction registry 미완료
   - home interaction baseline은 올라오기 시작했지만
   - PLP / PDP / support까지 같은 수준의 `interactionId + stateSchema`는 아직 부족하다

2. link policy incomplete
   - home lower product links는 PDP visual index 기반 내부 경로로 확장 중
   - service / event / story 계열 링크 정책은 아직 page-family별로 정리 중이다

3. component boundary incomplete
   - home 하단 major slot은 올라왔지만
   - 모든 accepted-main section이 `componentId / editableProps / sourceId`까지 닫힌 상태는 아니다

4. patch/apply API planned
   - workspace/session은 구현됨
   - LLM patch/apply API는 아직 planned 상태다

5. interaction editable list incomplete
   - `home.gnb.open`, `home.hero.carousel`, `home.best-ranking.tabs`, `home.quickmenu.nav`, `home.timedeal.cards`는 baseline이 있음
   - 하지만 editable field, rollback rule, verification schema까지는 아직 완전하지 않다

## 21. Current Working APIs For LLM Transition

현재 코드 기준으로, LLM 전환에 직접 연결되는 working-side API는 아래다.

1. `/api/slot-snapshots?pageId=<id>&source=working`
   - slot 단위 구조/소스 확인

2. `/api/interaction-snapshots?pageId=<id>&source=working`
   - interaction inventory baseline 확인

3. `/api/component-inventory?pageId=<id>&source=working`
   - `componentId / slotId / activeSourceId / interactionIds`

4. `/api/component-editability?pageId=<id>&source=working`
   - `editableProps / editableStyles / editableInteractions`

5. `/api/component-rollback?pageId=<id>&source=working`
   - component 단위 rollback 규칙

6. `/api/interaction-verification?pageId=<id>&source=working`
   - interactionId별 verification schema

7. `/api/llm-readiness?pageId=<id>&source=working`
   - 현재 component별 pre-LLM gap 확인

현재 원칙:

1. 위 API들은 `working truth`를 읽는 경로다
2. 아직 patch/apply는 없다
3. 즉 현재 단계는 `editable execution`이 아니라 `editable modeling` 단계다

### 21.1 Home Link Coverage Verification

1. 실행
   - `npm run verify:home-links`
2. 출력
   - `data/reports/home-link-coverage.json`
3. 기준
   - `clone/home` shell이 아니라 iframe 내부 `clone-content/home`의 실제 브라우저 상태 링크를 수집
4. 현재 보고서 요약
   - verified slots: `12/12`
   - `clone-product`: `1`
   - `clone-page`: `62`
   - `blocked`: `64`
   - `external`: `1`

### 21.2 Current Home Readiness State

1. 경로
   - `/api/llm-readiness?pageId=home&source=working`
2. 현재 상태
   - `overallStatus = pass`
   - `globalGaps = []`
   - `linkCoverage` 포함
3. 해석
   - home은 working 기준에서 pre-LLM foundation을 거의 닫았다
   - 남은 일은 visual batch acceptance와 page-family 확장이다

### 21.3 Page-Family Working Component Inventory

다음 page family는 이제 working component inventory / editability / rollback / verification API를 최소 수준으로 제공한다.

1. `category-tvs`
2. `support`
3. `bestshop`
4. `care-solutions`

방식:

1. 기존 workbench group
2. existing working interaction snapshot

를 합쳐 최소 `componentId / slotId / activeSourceId / interactionIds`를 생성한다.

목적:

1. home 이후 page family도 `slot/source/interaction` 관점으로 확장
2. 이후 링크 정책, patch/apply, LLM editable 범위 확장의 기반 확보

### 21.4 Current Working Readiness Status

현재 working readiness는 아래 상태까지 올라왔다.

1. `home`
   - `overallStatus = pass`
   - `linkCoverage` 포함
2. `category-tvs`
   - `overallStatus = pass`
3. `category-refrigerators`
   - `overallStatus = pass`
4. `support`
   - `overallStatus = pass`
5. `bestshop`
   - `overallStatus = pass`
6. `care-solutions`
   - `overallStatus = pass`

의미:

1. home 이후 주요 page family도 `component / source / interaction / rollback / verification / editability` 기준의 최소 working 모델을 갖기 시작했다.
2. 다음 병목은 view fidelity보다는 `workspace patch/apply`와 `slot source switching`의 실제 실행 API 쪽이다.

### 21.5 Workspace Slot Registry Progress

현재 추가된 workspace-side API:

1. `GET /api/workspace/slot-registry?pageId=<id>`
2. `GET /api/workspace/slot-variants?pageId=<id>&slotId=<id>`
3. `POST /api/workspace/slot-source`

현재 의미:

1. authenticated workspace는 page별 slot registry를 직접 읽을 수 있다.
2. slot의 `activeSourceId`를 workspace 단위로 바꿀 수 있다.
3. `normalizeEditableData()`가 active source를 강제로 captured로 되돌리던 버그는 수정되었다.

현재 한계:

1. workspace slot registry는 현재 `home` 중심이다.
2. source switch가 실제 clone render path와 완전히 연결된 것은 아니다.
3. 즉 지금 단계는 `workspace-side source state`를 저장/검증하는 단계다.

### 21.6 Workspace Render / Inventory Binding

현재는 workspace source state가 실제 render와 inventory 둘 다에 반영된다.

추가된 사실:

1. `readDataForRequest(req)`의 workspace data가 `rewriteCloneHtml()`까지 전달된다.
2. authenticated request에서 home slot의 `activeSourceId`가 실제 `clone-content/home` HTML에 반영된다.
3. authenticated request에서 `/api/workspace/component-inventory?pageId=home`도 같은 active source를 반환한다.

현재 실제 render 분기까지 연결된 home slot:

1. `hero`
   - `custom-home-hero-v1`
   - `figma-home-hero-v1`
   - 현재는 style/runtime variant 수준
2. `best-ranking`
   - `custom-renderer`
   - `figma-home-best-ranking-v1`
   - 현재는 `figma` class variant까지 반영
3. `brand-showroom`
   - `mobile-derived`
   - `custom-home-brand-showroom-v1`
   - custom renderer 반영
4. `latest-product-news`
   - `mobile-derived`
   - `custom-home-latest-product-news-v1`
   - custom renderer 반영

의미:

1. workspace source switch는 더 이상 저장-only가 아니다.
2. 프론트가 source switching UI를 붙였을 때, render/inventory/readiness를 같은 기준으로 읽을 수 있다.
3. 다음 단계는 source switch 이후의 `component patch/apply` 최소 버전이다.

### 21.7 Workspace Patch / Apply Minimum Path

현재 workspace는 source switch 다음 단계인 component patch/apply 최소 경로를 가진다.

추가된 API:

1. `GET /api/workspace/component-patches?pageId=<id>`
2. `GET /api/workspace/component-patches?pageId=<id>&componentId=<id>&sourceId=<id>`
3. `POST /api/workspace/component-patch`

현재 실제 render까지 연결된 patch 대상:

1. `home.best-ranking`
2. `home.brand-showroom`
3. `home.latest-product-news`

현재 최소 patch schema:

1. `title`
2. `subtitle`
3. `moreLabel`
4. `styles.titleColor`
5. `styles.subtitleColor`
6. `styles.background`
7. `styles.radius`

해석:

1. source switch만 되는 상태를 넘어서, 같은 source 위에 workspace patch를 얹을 수 있다.
2. 이 patch는 실제 `clone-content/home` HTML에 반영된다.
3. 즉 LLM/프론트 편집의 최소 저장-렌더 루프가 시작됐다.

### 21.8 Workspace Inventory Patch Awareness

`GET /api/workspace/component-inventory?pageId=home`는 이제 component 단위 patch 상태를 포함한다.

추가 필드:

1. `hasPatch`
2. `patchKeys`

의미:

1. 프론트는 slot/component 목록에서 현재 source뿐 아니라 patch 존재 여부까지 바로 표시할 수 있다.
2. 이후 editor UI는 `source switch -> patch edit -> rollback` 흐름을 하나의 목록에서 다룰 수 있다.

### 21.9 Page-Family Workspace Registry / Render Binding

home 전용이던 workspace source/patch 루프를 `support`, `bestshop`, `care-solutions`, `category-*`까지 확장했다.

추가된 구조:

1. `llm.js`
   - `support`
   - `bestshop`
   - `care-solutions`
   - `category-tvs`
   - `category-refrigerators`
   default slot registry 추가
2. `auth.js`
   - 기존 사용자 workspace도 `normalizeEditableData()`를 거치도록 수정
3. `server.js`
   - working group selector를 이용한 generic slot annotation 추가
   - non-home page에 `data-codex-slot`, `data-codex-component-id`, `data-codex-active-source-id` 주입
   - generic section patch 적용 경로 추가

현재 실제 render까지 확인된 페이지군:

1. `support`
   - `mainService`
2. `bestshop`
   - `hero`
3. `care-solutions`
   - `hero`
4. `category-tvs`
   - `banner`

의미:

1. `workspace slot-source -> clone render -> component inventory` 루프가 home 밖으로 확장됐다.
2. service page는 selector 기반 generic patch/render가 가능해졌다.
3. category는 현재 `banner` slot부터 실제 render-bound가 시작됐다.

### 21.10 Generic Page Patch Minimum Schema

non-home page에서 현재 generic patch로 다룰 수 있는 최소 범위는 아래와 같다.

1. `title`
2. `subtitle`
3. `styles.background`
4. `styles.radius`
5. `styles.titleColor`
6. `styles.subtitleColor`
7. `visibility`

현재 한계:

1. category의 `productGrid/firstRow/firstProduct`는 selector가 약해서 아직 generic render-bound가 아니다.
2. service page의 subtitle/title는 DOM 패턴에 따라 일부 위치만 교체된다.
3. 즉 page-family 확장은 시작됐지만, 모든 slot이 동일 수준으로 patchable한 상태는 아니다.

### 21.11 Patch Schema Exposure / Sanitization

workspace patch는 이제 저장 전에 schema 기준으로 정리된다.

추가된 것:

1. `GET /api/workspace/component-editability?pageId=<id>`
   - 각 component에 `patchSchema` 포함
2. `POST /api/workspace/component-patch`
   - `patchSchema.rootKeys`
   - `patchSchema.styleKeys`
   기준으로 patch를 sanitize한 뒤 저장

실제 확인된 동작:

1. `support.mainService`
   - `unknownRoot`
   - `styles.unknownColor`
   는 저장 시 제거됨
2. 저장된 sanitized patch는 실제 `clone-content/support` HTML에 반영됨

의미:

1. 프론트/LLM은 이제 “무엇을 보낼 수 있는지”를 API에서 직접 읽을 수 있다.
2. render path도 같은 schema 기준으로 흔들림을 줄일 수 있다.

### 21.12 Slot-Accurate Generic Patch Schema

page-family generic patch는 이제 모든 slot에 동일 schema를 노출하지 않는다.

변경 이유:

1. `support.notice`는 title/subtitle block이 아니라 notice list 영역이다.
2. `care-solutions.tabs`는 controls block이다.
3. `care-solutions.ranking`, `care-solutions.benefit`은 title 중심 구조이지, 공통 subtitle 구조가 아니다.

현재 slot-accurate schema:

1. `support.mainService`
   - `title`, `subtitle`, `visibility`
   - `background`, `radius`, `titleColor`, `subtitleColor`
2. `support.notice`
   - `visibility`
   - `background`, `radius`
3. `support.bestcare`
   - `title`, `subtitle`, `visibility`
   - `background`, `radius`, `titleColor`, `subtitleColor`
4. `bestshop.review`
   - `title`, `subtitle`, `visibility`
   - `background`, `radius`, `titleColor`, `subtitleColor`
5. `care-solutions.ranking`
   - `title`, `visibility`
   - `background`, `radius`, `titleColor`
6. `care-solutions.benefit`
   - `title`, `visibility`
   - `background`, `radius`, `titleColor`
7. `care-solutions.tabs`
   - `visibility`
   - `background`, `radius`
8. `care-solutions.careBanner`
   - `title`, `subtitle`, `visibility`
   - `background`, `radius`, `titleColor`, `subtitleColor`

의미:

1. generic patch는 더 이상 “편하게 많이 열어둔 schema”가 아니다.
2. LLM/프론트는 slot마다 실제 구조에 맞는 편집 surface만 보게 된다.

### 21.13 Additional Page-Family Verification

추가로 실제 patch/render가 확인된 slot:

1. `bestshop.review`
   - `figma-bestshop-review-v1`
   - title/subtitle patch 실제 반영
2. `care-solutions.benefit`
   - `figma-care-solutions-benefit-v1`
   - title patch 실제 반영
3. `care-solutions.careBanner`
   - `figma-care-solutions-careBanner-v1`
   - title/subtitle patch 실제 반영
4. `category-refrigerators.banner`
   - `figma-category-refrigerators-banner-v1`
   - active source / component boundary 실제 반영

결과:

1. `home`에서 시작한 workspace source/patch/render/inventory 루프가
2. `support`, `bestshop`, `care-solutions`, `category-*`로 확장되고 있다.

### 21.14 Pre-LLM Gap API

workspace 기준으로 아직 warning/fail인 component만 별도로 뽑는 API를 추가했다.

추가 API:

1. `GET /api/workspace/pre-llm-gaps?pageId=<id>`

반환 내용:

1. `overallStatus`
2. `globalGaps`
3. `componentGapCount`
4. `componentGaps[]`
   - `componentId`
   - `slotId`
   - `status`
   - `missing[]`

현재 확인 결과:

1. `home`
2. `support`
3. `bestshop`
4. `care-solutions`
5. `category-tvs`
6. `category-refrigerators`

모두 `overallStatus = pass`, `componentGapCount = 0` 상태다.

의미:

1. 이제 “무엇이 아직 LLM editable이 아닌가”를 component 단위로 바로 조회할 수 있다.
2. page-family별 pre-LLM 준비 상태를 프론트/운영 레이어에서 바로 점검할 수 있다.

### 21.15 Admin Workspace Editor Surface

`web/admin.html`은 이제 단순 page list가 아니라 workspace 편집 진입면으로 확장됐다.

현재 admin에서 가능한 것:

1. page별 `component inventory` 조회
2. `pre-LLM gap` 조회
3. slot별 source 선택
4. component patch load / apply
5. `/clone/:pageId` iframe preview로 즉시 확인

의미:

1. `slot/source/patch/pre-llm-gaps` API가 프론트 편집 UI까지 연결되기 시작했다.
2. 이후 LLM 편집 UI는 이 admin surface를 확장하는 방향으로 갈 수 있다.

### 21.16 Visual Batch Runner / Summary API

최종 visual acceptance 전에 artifact를 한 번에 갱신하는 batch runner를 추가했다.

추가된 것:

1. `scripts/capture_visual_batch.mjs`
2. `npm run capture:visual-batch`
3. `GET /api/visual-batch-summary`

batch가 수행하는 일:

1. `home` 전체 visual snapshot
2. `home-lower` section clip
3. `service-pages` reference/working capture
4. `plp` reference/working capture

summary가 제공하는 것:

1. step별 성공/실패
2. `homeLower` artifact 요약
3. `servicePages` capture 수 / error 수
4. `plp` capture 수 / error 수

의미:

1. 마지막 visual batch를 수동 명령 여러 개가 아니라 하나의 배치로 돌릴 수 있다.
2. `/admin`과 운영 레이어는 summary API로 현재 배치 상태를 읽을 수 있다.

### 21.17 Visual Review Manifest

final acceptance에 필요한 compare/artifact 링크를 한 번에 내리는 API를 추가했다.

추가 API:

1. `GET /api/visual-review-manifest`

포함되는 것:

1. `home`
   - `/compare/home`
   - live / working / compare image
2. `homeLower`
   - slot별 live / working / metadata
3. `servicePages`
   - `support`
   - `bestshop`
   - `care-solutions`
   compare / pc/mo artifact
4. `plpPages`
   - `category-tvs`
   - `category-refrigerators`
   compare / pc/mo artifact

의미:

1. 마지막 수동 visual acceptance 전에 필요한 review 링크를 API에서 직접 읽을 수 있다.
2. `/admin`은 이 manifest를 사용해 현재 page 기준 compare 링크를 바로 노출한다.

### 21.18 LLM Editable List API

LLM이 바로 수정할 수 있는 component 목록을 page 단위로 조회하는 API를 추가했다.

추가 API:

1. `GET /api/workspace/llm-editable-list?pageId=<id>`

반환:

1. `componentCount`
2. `components[]`
   - `componentId`
   - `slotId`
   - `kind`
   - `activeSourceId`
   - `editableProps`
   - `editableStyles`
   - `patchSchema`
   - `interactionIds`

현재 확인된 count:

1. `home` → `16`
2. `support` → `4`
3. `bestshop` → `4`
4. `care-solutions` → `5`
5. `category-tvs` → `10`
6. `category-refrigerators` → `10`

의미:

1. 이제 “LLM이 지금 당장 어떤 component를 편집할 수 있는가”를 API로 직접 읽을 수 있다.
2. 이후 LLM 편집 UI/워크플로우는 이 리스트를 기준으로 시작할 수 있다.

### 21.19 Final Acceptance Runbook / Bundle Surface

마지막 visual acceptance는 이제 문서와 admin 양쪽에서 같은 bundle 순서로 진행한다.

추가된 것:

1. `docs/final-acceptance-runbook.md`
2. `/admin`의 `Final Acceptance Bundles`
   - 전체 recommended order
   - 현재 page 관련 bundle

고정된 순서:

1. `home-core`
2. `home-lower-primary`
3. `home-lower-secondary`
4. `support-pcmo`
5. `bestshop-pcmo`
6. `care-solutions-pcmo`
7. `category-tvs-pcmo`
8. `category-refrigerators-pcmo`

의미:

1. 최종 acceptance가 사람 기억에 의존하지 않는다.
2. 문서/운영 UI/API가 동일 bundle 기준을 공유한다.

### 21.20 Final Readiness API

acceptance 직전 상태를 한 번에 읽는 workspace API를 추가했다.

추가 API:

1. `GET /api/workspace/final-readiness`

반환:

1. `visualBatchStatus`
2. `acceptanceBundleCount`
3. `overallStatus`
4. `pages[]`
   - `pageId`
   - `preLlmStatus`
   - `componentGapCount`
   - `editableComponentCount`
5. `failingPages[]`

현재 확인 결과:

1. `overallStatus = ready-for-acceptance`
2. `visualBatchStatus = pass`
3. `acceptanceBundleCount = 8`
4. `failingPages = []`

의미:

1. acceptance 진입 여부를 더 이상 여러 API를 직접 조합해서 판단할 필요가 없다.
2. `/admin`은 이 값을 상단 meta로 바로 노출한다.

### 21.21 Workspace Acceptance Result API

최종 acceptance를 준비하는 수준을 넘어서, bundle별 검수 결과를 실제 workspace 상태로 저장하는 API를 추가했다.

추가 API:

1. `GET /api/workspace/acceptance-results?pageId=<id>`
2. `POST /api/workspace/acceptance-result`

저장 단위:

1. `bundleId`
2. `pageId`
3. `status`
   - `pending`
   - `pass`
   - `fail`
4. `note`
5. `updatedAt`

연결:

1. `/admin`의 `Final Acceptance Bundles`
2. bundle별 status select
3. bundle별 note textarea
4. save action 후 즉시 재조회

현재 확인 결과:

1. `home-core -> pass` 저장 성공
2. note: `auto verification`
3. `final-readiness`는 acceptance 진행률
   - `acceptance.pass`
   - `acceptance.fail`
   - `acceptance.pending`
   를 같이 반환

의미:

1. 마지막 visual acceptance가 더 이상 문서 메모에만 남지 않는다.
2. bundle별 pass/fail/note가 실제 사용자 workspace에 귀속된다.
3. 이후 LLM 단계 전환 시, 어떤 bundle이 실제 검수 완료인지 API로 판정할 수 있다.

### 21.22 Acceptance Progress Summary

acceptance 결과를 단순 item 목록이 아니라 운영 가능한 진행 요약으로 같이 반환하도록 확장했다.

확장 항목:

1. `overallStatus`
2. `pageSummaries[]`
3. `nextPendingBundle`

의미:

1. 각 page가 acceptance 기준으로
   - `accepted`
   - `in-progress`
   - `needs-review`
   중 어디에 있는지 바로 알 수 있다.
2. 사람이 다음에 어떤 bundle을 봐야 하는지 다시 계산할 필요가 없다.
3. `/admin`은 현재 page의 acceptance summary와 next pending bundle을 바로 노출한다.

### 21.23 LLM Gate By Acceptance

`final-readiness`는 이제 visual batch와 pre-LLM gap만이 아니라 acceptance 완료 여부까지 포함해 LLM 진입 게이트를 계산한다.

추가 반환:

1. `llmGateStatus`
   - `ready-for-llm`
   - `blocked-by-acceptance`
2. `pages[].acceptanceStatus`
3. `pages[].acceptanceCounts`

기준:

1. `visualBatchStatus = pass`
2. `failingPages = []`
3. `acceptance.pass === acceptance.total`

위 3개가 모두 만족될 때만 `llmGateStatus = ready-for-llm` 이다.

의미:

1. 이제 LLM 단계 전환이 단순 “구조 준비 완료”가 아니라 “최종 acceptance 완료” 기준으로 잠긴다.
2. `/admin`은 page별 acceptance summary와 함께 현재 LLM gate 상태를 상단에 노출한다.

### 21.24 Admin Acceptance Filter

`/admin`의 Pages 패널에 acceptance 상태 기준 필터를 추가했다.

필터:

1. `all`
2. `pending`
3. `fail`
4. `accepted`

정렬:

1. `needs-review`
2. `in-progress`
3. `accepted`

같은 상태 안에서는 `pending` 수가 많은 page가 먼저 온다.

의미:

1. acceptance 운영 시 사람이 다음 대상 page를 기억할 필요가 줄어든다.
2. review가 필요한 page를 빠르게 위로 올려 볼 수 있다.

### 21.25 Admin Acceptance Summary Bar

`/admin` Pages 패널 상단에 acceptance 요약 bar를 추가했다.

표시:

1. `overall acceptance pass / total`
2. `llm gate`
3. `next actionable page`
4. completion progress bar

의미:

1. acceptance 운영자가 detail을 열기 전에도 전체 진행률을 바로 볼 수 있다.
2. 다음 page 이동 기준이 page list 상단에 고정된다.

### 21.26 Server-Driven Next Actionable / LLM UI Gate

`final-readiness`가 이제 다음 actionable page를 직접 반환하고, `/admin`은 이 값을 사용해 운영 흐름을 고정한다.

추가 반환:

1. `nextActionablePageId`

추가 동작:

1. `/admin`의 summary bar는 `nextActionablePageId`를 우선 사용
2. `llmGateStatus !== ready-for-llm` 이면 `Apply with OpenRouter` 버튼을 비활성화

의미:

1. acceptance 완료 전에는 LLM 변경을 UI에서 직접 막는다.
2. 다음 검수 대상 page가 client 추정이 아니라 server 계산 기준으로 고정된다.

### 21.27 Global Next Acceptance Target

`final-readiness`가 이제 page 수준 다음 대상뿐 아니라 전체 기준의 다음 acceptance bundle도 직접 반환한다.

추가 반환:

1. `nextAcceptanceTarget`
   - `bundleId`
   - `pageId`
   - `title`
   - `review`

추가 동작:

1. `/admin` Pages 패널 상단에서 전역 다음 acceptance target을 노출
2. compare 링크가 있으면 `Open Global Next Compare`로 바로 이동 가능

의미:

1. acceptance 운영자가 현재 page와 무관하게 다음 bundle을 바로 열 수 있다.
2. bundle 순서 기준이 detail 내부뿐 아니라 전역 운영면에서도 고정된다.

### 21.28 Server-Side LLM Gate Enforcement

LLM 변경은 이제 `/admin` UI 비활성화만이 아니라 server API에서도 acceptance gate를 확인한다.

적용:

1. `POST /api/llm/change`

동작:

1. `buildFinalReadinessReport()` 기준으로 `llmGateStatus !== ready-for-llm` 이면 요청 거부
2. 반환:
   - `error = llm_gate_blocked`
   - `detail = blocked-by-acceptance`
   - `nextActionablePageId`
   - `nextAcceptanceTarget`

추가 UI:

1. `/admin` Pages 패널 summary bar에 `Go To Next Page` 버튼 추가

의미:

1. acceptance 완료 전 LLM 변경은 client 우회로도 실행되지 않는다.
2. 운영자가 바로 다음 page로 이동해 검수를 이어갈 수 있다.

### 21.29 Acceptance Activity Logging

acceptance 결과 저장은 이제 workspace save 외에 별도 activity event로도 기록된다.

event:

1. `acceptance_result_saved`

detail:

1. `bundleId`
2. `pageId`
3. `status`
4. `note`

의미:

1. acceptance 진행 이력이 단순 최신 상태만이 아니라 event log로도 남는다.
2. `/admin`의 `Workspace Activity` 패널에서 bundle 단위 acceptance 변경을 바로 볼 수 있다.

---

## Section 22. Claude PM 코드 레벨 검토 — home-progress-log + server.js + llm.js 직접 확인

### 22.1 Section 18 정오표 — 코드 확인 후 수정

Section 18은 코드를 보기 전에 작성됐다. 실제 코드를 확인한 결과, 아래 두 가지는 Section 18 판단이 틀렸다.

**정오표 1: Slot registry는 이미 구현되어 있다**

`server.js:6251`의 `getHomeLowerSlotRegistry()` 함수는 Section 18이 요구한 구조와 거의 일치한다:

```js
// 실제 구현 (server.js:6255)
return [
  {
    id: "brand-showroom",
    activeSourceId: resolveSlotSourceId("brand-showroom", "mobile-derived"),
    enabled: (data, options) => ...,
    render: (data, options, slot) => ...
  },
  // 나머지 슬롯도 동일 패턴
];
```

`renderHomeLowerSlots()` (server.js:6452)는 이 registry를 루프로 처리한다:

```js
function renderHomeLowerSlots(data, options = {}) {
  return getHomeLowerSlotRegistry(options.editableData)
    .filter((slot) => slot.enabled(data, options))
    .map((slot) => slot.render(data, options, slot))
    .filter(Boolean)
    .join("\n");
}
```

Section 18이 걱정했던 "섹션별 if/else 분기 추가" 패턴은 이미 registry 루프로 대체되어 있다. Section 18.2는 이 부분에서 틀렸다.

**정오표 2: Sources 열거는 `llm.js`에 있다**

`llm.js:34`의 `buildDefaultHomeSlotRegistry()`는 각 slot에 `sources` 배열을 명시한다:

```js
{
  slotId: "brand-showroom",
  componentType: "home-lower",
  activeSourceId: "mobile-derived",
  sources: [
    { sourceId: "mobile-derived", sourceType: "mobile-derived", renderer: "component", status: "active" },
    { sourceId: "custom-home-brand-showroom-v1", sourceType: "custom", renderer: "component", status: "draft" },
    { sourceId: "figma-home-brand-showroom-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
  ]
}
```

`POST /api/workspace/slot-source` (server.js:11127)는 이 sources 배열을 검증한다:

```js
if (!(slot.sources || []).some((source) => source.sourceId === sourceId)) {
  return sendJson(res, 400, { error: "source_not_found", ... });
}
```

Section 18의 "sources enumeration missing" 진단은 틀렸다. `llm.js`와 workspace API에 이미 구현되어 있다.

---

### 22.2 진행 상태 — 실제로 잘 된 것

코드 직접 확인 결과 아래는 기대 이상으로 잘 구현되어 있다:

| 항목 | 위치 | 상태 |
|------|------|------|
| `getHomeLowerSlotRegistry()` registry 루프 | `server.js:6251` | 정상 |
| `resolveSlotSourceId()` workspace 연동 | `server.js:6252` | 정상 |
| `llm.js` slot sources enumeration | `llm.js:34` | 정상 |
| `POST /api/workspace/slot-source` 검증 | `server.js:11110` | 정상 |
| `normalizeSlotRegistry()` activeSourceId 보존 | `llm.js:256` | 정상 |
| component patch system | `server.js:11152` | 정상 |
| `GET /api/workspace/llm-editable-list` | 확인됨 | 정상, home=16 |
| `GET /api/workspace/pre-llm-gaps` | 확인됨 | 정상, 6 pages pass |
| `data-codex-slot/source/component-id/active-source-id` | server.js 전역 | 정상 |
| acceptance gate — LLM 변경 서버 차단 | `POST /api/llm/change` | 정상 |

---

### 22.3 발견된 실제 코드 버그 3개

Section 18이 잘못 진단한 부분과 달리, 코드를 직접 보니 다른 3가지 실제 문제가 있다.

---

#### Bug 1: `homeVariant` URL 파라미터가 workspace `activeSourceId`를 바이패스한다

**위치:** `server.js:6336`

```js
render: (data, options, slot) =>
  options.homeVariant === "custom" || slot.activeSourceId === "custom-home-brand-showroom-v1"
    ? renderBrandShowroomCustomSection(...)
    : applyHomeLowerSectionPatch(...)
```

**문제:**

`?homeVariant=custom` URL 파라미터가 workspace state를 무시하고 강제로 custom renderer를 선택한다.

이 상태에서:
- workspace: `activeSourceId = "mobile-derived"`
- URL: `?homeVariant=custom`
- 실제 렌더: custom renderer

따라서:
- `/api/workspace/component-inventory` → `activeSourceId: "mobile-derived"` 반환
- `/clone/home?homeVariant=custom` → custom renderer로 실제 렌더
- **두 API가 서로 다른 source state를 보고 있다**

LLM이 `component-inventory`를 읽고 `mobile-derived` 기준으로 patch를 적용했는데, 실제 렌더는 custom이면 patch가 잘못된 target에 적용된다.

**수정:**

```js
// server.js:6335 근처
// homeVariant 체크 제거 — workspace activeSourceId가 유일한 source truth여야 한다
render: (data, _options, slot) =>
  slot.activeSourceId === "custom-home-brand-showroom-v1"
    ? renderBrandShowroomCustomSection(data.brandShowroomProducts, slot.activeSourceId, resolveComponentPatch(slot.id, slot.activeSourceId))
    : applyHomeLowerSectionPatch(
        markHomeLowerReplay(
          injectTemplateImagesIntoSection(data.brandShowroomSection, data.brandShowroomProducts),
          "brand-showroom", slot.activeSourceId
        ),
        "brand-showroom", slot.activeSourceId,
        resolveComponentPatch(slot.id, slot.activeSourceId)
      ),
```

`homeVariant` query param은 이제 sandbox URL에서도 사용하지 않는다. custom을 테스트하려면 workspace API로 `activeSourceId`를 전환하면 된다.

같은 문제가 있는 `latest-product-news` render 함수도 동일하게 수정:

```js
// server.js:6355 근처 — homeVariant 체크 제거
render: (data, _options, slot) =>
  slot.activeSourceId === "custom-home-latest-product-news-v1"
    ? renderLatestProductNewsCustomSection(...)
    : applyHomeLowerSectionPatch(...)
```

---

#### Bug 2: `figma-*` sourceId를 workspace에서 선택 가능하지만 render path가 없다

**위치:** `llm.js:133` (sources에 존재), `server.js:6335` (render path에 없음)

`llm.js`의 workspace schema는 `figma-home-brand-showroom-v1`을 valid source로 정의한다. `POST /api/workspace/slot-source`는 이 sourceId를 받는다. 그런데 `server.js` render function에는 `figma-*` sourceId에 대한 처리가 없다.

결과: LLM이 `POST /api/workspace/slot-source { sourceId: "figma-home-brand-showroom-v1" }`를 호출하면:
- workspace는 성공 응답 반환 ✓
- `activeSourceId = "figma-home-brand-showroom-v1"` 저장 ✓
- `component-inventory` → `activeSourceId: "figma-home-brand-showroom-v1"` 반환 ✓
- 실제 render → `mobile-derived` 분기 실행 (silently wrong) ✗

**수정:**

각 slot의 render 함수에 figma source 처리 추가. 현재 figma renderer가 구현되지 않았으면 `figma-pending` 마커를 붙인 채 `mobile-derived`로 fallback:

```js
// brand-showroom render 함수 수정 예시
render: (data, _options, slot) => {
  const srcId = slot.activeSourceId;
  if (srcId === "custom-home-brand-showroom-v1") {
    return renderBrandShowroomCustomSection(data.brandShowroomProducts, srcId, resolveComponentPatch(slot.id, srcId));
  }
  // figma source: render path not yet implemented — fallback with marker
  const isFigma = srcId && srcId.startsWith("figma-");
  return applyHomeLowerSectionPatch(
    markHomeLowerReplay(
      injectTemplateImagesIntoSection(data.brandShowroomSection, data.brandShowroomProducts),
      "brand-showroom", srcId
    ),
    "brand-showroom", srcId,
    resolveComponentPatch(slot.id, srcId)
  );
  // Note: for figma variant, injectHomeLowerSectionPatch will attach data-codex-active-source-id="figma-..."
  // which is the correct marker even without a distinct figma renderer yet
}
```

즉 **figma source를 선택해도 실제 렌더는 mobile-derived 기반으로 실행**되지만, `data-codex-active-source-id`에 figma sourceId가 올바르게 표시된다. 이 자체는 "figma renderer 미구현" 상태에서 정확한 동작이다.

하지만 `pre-llm-gaps`가 현재 이 상태를 `pass`로 보고하는 것은 틀렸다. `figma-*` source가 있는 slot에서 figma renderer가 없으면 `componentGap`으로 등록해야 한다:

```js
// GET /api/workspace/pre-llm-gaps 에서 추가 체크
if (slot.activeSourceId?.startsWith("figma-") && !slot.hasFigmaRenderer) {
  gaps.push({ slotId: slot.slotId, issue: "figma_renderer_missing" });
}
```

---

#### Bug 3: `main-reflected` 상태는 정의된 acceptance 기준을 우회한다

**위치:** `docs/home-progress-log.md:86-94`

현재 Section Status에서 9개 섹션이 `main-reflected` 상태다:

```
brand-showroom, latest-product-news, smart-life, space-renewal,
subscription, missed-benefits, lg-best-care, bestshop-guide, summary-banner-2
```

이 상태는 Status Legend에 없다. 정의된 흐름은:
```
in-progress → accepted-sandbox → accepted-main
```

실제 진행된 흐름:
```
in-progress → (sandbox 준비) → main injection → main-reflected
```

`accepted-sandbox` 단계가 생략됐다.

Log 17에서 "시각 판정은 마지막에 사용자가 한 번에 진행"이라고 명시했고, 이를 근거로 메인에 먼저 반영했다. 이것이 진행 속도 측면에서는 이해가 된다.

**그러나:**

1. acceptance 전 섹션이 메인에 있으면 **사용자가 미수용 상태를 "완료된 것"으로 오해할 수 있다**
2. LLM gate는 acceptance를 기다리는데, `pre-llm-gaps = pass`로 이미 통과된 상태라면 **gate가 실제로 작동하지 않는 것**이다
3. 9개 섹션이 모두 `main-reflected`인 상태에서 LLM 작업을 시작하면, 아직 사용자가 본 적 없는 섹션에 LLM 패치가 적용될 수 있다

**요구 사항:**

`main-reflected` 섹션은 사용자가 시각 검수를 완료하기 전까지 LLM 편집 대상에서 제외해야 한다. 이미 구현된 acceptance gate가 이 섹션들을 차단하는지 확인이 필요하다.

**즉시 점검:**

```bash
# admin 화면 또는 API에서:
GET /api/workspace/pre-llm-gaps?pageId=home
# 결과의 globalGaps가 [] 이면 gate 미작동 — main-reflected 섹션이 gap으로 등록됐어야 함

GET /api/workspace/llm-editable-list?pageId=home
# 9개 main-reflected 섹션이 editable list에 포함돼 있으면 문제
```

만약 `pre-llm-gaps = pass`이고 9개 섹션이 `llm-editable-list`에 포함되어 있다면:

```js
// pre-llm-gaps 체크에 acceptance 상태 추가
function buildPreLlmGaps(pageId, workspaceData) {
  const acceptanceResults = workspaceData.acceptanceResults || [];
  const slots = getSlotRegistry(pageId); // workspace registry
  const unacceptedSlots = slots.filter((slot) => {
    const result = acceptanceResults.find((r) => r.slotId === slot.slotId && r.pageId === pageId);
    return !result || result.status !== "accepted";
  });
  if (unacceptedSlots.length > 0) {
    return {
      overallStatus: "fail",
      globalGaps: [{ issue: "visual_acceptance_pending", slotIds: unacceptedSlots.map((s) => s.slotId) }]
    };
  }
  return { overallStatus: "pass", globalGaps: [] };
}
```

---

### 22.4 수정 우선순위

| 우선순위 | 버그 | 이유 |
|----------|------|------|
| **즉시** | Bug 1: `homeVariant` bypass 제거 | LLM이 inventory를 읽고 잘못된 source에 patch 적용하는 즉각적 위험 |
| **즉시** | Bug 3: `main-reflected` acceptance gap 확인 | LLM gate가 실제로 작동하는지 검증 필요 |
| **다음 단계** | Bug 2: figma source void in render path | figma renderer가 실제로 구현될 때까지는 marker 추가로 처리 |

---

### 22.5 git 초기화 — 재확인

`git -C /mnt/c/Users/mrgbi/lge-site-analysis status` → `fatal: not a git repository` 확인됨.

이것은 Section 18에서 이미 지시했다. 재지시한다.

```bash
cd /mnt/c/Users/mrgbi/lge-site-analysis
cat > .gitignore << 'EOF'
node_modules/
data/visual/
data/reports/
data/debug/
tmp/
*.png
*.jpg
EOF

git init
git add .gitignore
git add *.js *.json web/ docs/ scripts/
git commit -m "chore: initial commit — home lower slot registry + workspace APIs in place"
```

`data/normalized/editable-prototype.json`은 workspace 상태이므로 포함 여부를 결정해야 한다. 이것은 사용자 workspace 데이터이므로 포함하는 것이 맞다.

---

### 22.6 Section 18 수정 사항

Section 18의 `18.6 Codex에게 주는 즉시 지시`에서 지정한 규칙들 중 일부가 이미 구현된 것으로 확인됐다:

| 규칙 | 상태 |
|------|------|
| 새 섹션 추가 = slot registry entry 먼저 | ✓ 이미 구현 (`llm.js` + `getHomeLowerSlotRegistry()`) |
| render 함수는 slot registry를 통해 호출 | ✓ `renderHomeLowerSlots()` 루프 구현됨 |
| `data-codex-slot` + `data-codex-source` 자동 부착 | ✓ `applyHomeLowerSectionPatch()` 또는 render 함수에서 처리 |
| git 초기화 | ✗ 아직 미완료 |

따라서 Section 18의 긴급 지시 중 코드 구조 관련 항목은 이미 이행됐다. **지금 남은 것은 Bug 1/2/3 수정과 git 초기화다.**

---

### 22.7 PM 최종 요약

**Codex는 Section 18의 구조적 요구사항을 대부분 이미 이행했다.**

`llm.js` + `getHomeLowerSlotRegistry()` + `renderHomeLowerSlots()` + workspace API 조합은 Section 18이 요구한 slot-registry-driven 렌더 구조다. Section 18이 지나치게 비판적이었다.

**하지만 3개의 실제 코드 버그가 있다.**

이 중 Bug 1 (`homeVariant` bypass)이 가장 위험하다. workspace와 render 상태가 달라지면 LLM patch가 잘못된 source에 적용된다. **Bug 1은 오늘 수정해야 한다.**

Bug 3 (`main-reflected` acceptance gap)은 LLM gate가 실제로 작동하는지를 결정한다. `pre-llm-gaps` API가 acceptance를 체크하지 않는다면 gate가 형식적으로만 존재하는 것이다.

**변경 불가 원칙:**

> `homeVariant` URL 파라미터는 즉시 render logic에서 제거한다. workspace `activeSourceId`가 유일한 source truth다. URL 파라미터로 workspace state를 우회하는 경로는 LLM이 연결되는 시스템에 존재해서는 안 된다.

### 22.8 Codex 확인 결과 — 수용/보정

문서에 남긴 3개 버그 주장 중 코드 기준 판정은 아래와 같다.

1. `Bug 1 homeVariant bypass`
   - **수용**
   - `brand-showroom` render에서 실제로 `options.homeVariant === "custom"` 우회가 남아 있었음
   - 수정 완료: workspace `activeSourceId`만 source truth로 사용

2. `Bug 2 figma source render path`
   - **부분 수용**
   - figma sourceId가 registry에 존재하지만, lower slot 대부분은 별도 figma renderer가 없음
   - 다만 현재 구현은 `data-codex-active-source-id`를 유지한 채 mobile-derived fallback으로 렌더되므로, 즉시 오류라기보다 “명시적 정책 미정”에 가깝다
   - 즉시 수정 우선순위는 `Bug 1`보다 낮다

3. `Bug 3 main-reflected acceptance gap`
   - **보정 필요**
   - `pre-llm-gaps`는 acceptance gate API가 아니다
   - 실제 gate는
     - `GET /api/workspace/final-readiness`
     - `POST /api/llm/change`
     에 이미 연결돼 있음
   - 따라서 “gate 미작동 여부”는 `pre-llm-gaps`가 아니라 `llmGateStatus`와 server-side `llm_gate_blocked`로 판정해야 한다

추가 보정:

1. `latest-product-news`는 이미 `homeVariant` 우회가 제거된 상태였다
2. `git init` 제안은 작업 제안으로는 유효하지만, 자동 실행 대상은 아님

### 22.9 Bug 2 후속 반영 — Explicit Source Resolution

`Bug 2 figma source render path`는 “실패”라기보다 “fallback 정책이 코드와 UI에 드러나지 않는 상태”였다. 이를 아래처럼 보강했다.

1. `server.js`
   - `resolveComponentSourceResolution(pageId, slotId, activeSourceId, data)`
   - component inventory에 추가:
     - `activeSourceType`
     - `sourceResolution`
     - `renderMode`
     - `resolvedRenderSourceId`
     - `resolvedRenderSourceType`
     - `sourceResolutionDetail`

2. `home` lower render metadata
   - `markHomeLowerReplay()`와 custom renderer section에 추가:
     - `data-codex-source-resolution`
     - `data-codex-resolved-render-source-id`
     - `data-codex-render-mode`

3. `llm-readiness`
   - source fallback은 `fail`로 올리지 않고 `advisories[]`에만 기록
   - 즉:
     - readiness gate는 유지
     - fallback 정보는 숨기지 않음

4. `/admin`
   - component card에 표시:
     - declared source
     - resolved render source
     - resolution state
     - resolution detail

실검증:

1. `brand-showroom` source를 `figma-home-brand-showroom-v1`로 전환
2. inventory:
   - `activeSourceId = figma-home-brand-showroom-v1`
   - `sourceResolution = fallback-mobile-derived`
   - `resolvedRenderSourceId = mobile-derived`
3. DOM:
   - `data-codex-source-resolution="fallback-mobile-derived"`
   - `data-codex-resolved-render-source-id="mobile-derived"`
4. readiness:
   - component status는 `pass`
   - advisory에 fallback 사유 노출

결론:

- `figma-*` source가 direct renderer인지 fallback인지 이제 숨겨지지 않는다.
- 따라서 `Bug 2`는 “정책 미정” 상태에서 “명시적 fallback 정책이 보이는 상태”로 정리됐다.

### 22.10 Fallback Visibility In Readiness/Admin

`Bug 2`를 실제 운영에서 놓치지 않도록 fallback을 단순 inventory 필드에서 끝내지 않고, readiness/admin 운영면에도 올렸다.

추가 집계:

1. `GET /api/workspace/pre-llm-gaps?pageId=<id>`
   - `fallbackComponentCount`
   - `advisoryComponentCount`
   - `fallbackComponents[]`

2. `GET /api/workspace/final-readiness`
   - `fallbackComponentCount`
   - `advisoryComponentCount`
   - `pages[].fallbackComponentCount`
   - `pages[].advisoryComponentCount`

3. `/admin`
   - Pages summary에 전역 fallback/advisory 수 노출
   - page row에 fallback/advisory 수 노출
   - detail의 `Pre-LLM Gaps`에 fallback component 목록 노출
   - component card에 advisory 표시

실검증:

1. `home.brand-showroom = figma-home-brand-showroom-v1`
2. `pre-llm-gaps.fallbackComponentCount = 1`
3. `final-readiness.fallbackComponentCount = 1`
4. `final-readiness.pages[home].fallbackComponentCount = 1`

정책:

- fallback은 현재 `fail` gate가 아니라 `warning/advisory`다.
- 즉 LLM gate는 계속 acceptance 기준으로 유지하되,
- 검수 전 운영면에서 fallback 사용 여부를 숨기지 않고 드러낸다.

### 22.11 Acceptance Bundle Context

acceptance를 실제 검수 도구로 쓰려면 bundle 상태만으로는 부족했다. 그래서 `acceptance-results`에 bundle별 검수 맥락을 같이 싣도록 보강했다.

추가:

1. `GET /api/workspace/acceptance-results?pageId=<id>`
   - `items[].bundleContext`
     - `componentGapCount`
     - `fallbackComponentCount`
     - `componentGaps[]`
     - `fallbackComponents[]`

2. `pageSummaries[]`
   - `componentGapCount`
   - `fallbackComponentCount`

3. `/admin`
   - `Final Acceptance Bundles` 카드에
     - `bundle gaps`
     - `fallback`
     - `fallback slots`
     - `gap slots`
     표시

실검증:

1. `home.brand-showroom = figma-home-brand-showroom-v1`
2. `home-lower-primary.bundleContext.fallbackComponentCount = 1`
3. `home.pageSummary.fallbackComponentCount = 1`

의미:

- 이제 acceptance 카드만 봐도
  - 왜 pending인지
  - 어떤 slot이 fallback인지
  - gap이 실제로 남아 있는지
  를 바로 판단할 수 있다.

### 22.12 Acceptance Priority

acceptance의 다음 검수 대상은 더 이상 단순 문서 순서가 아니다. bundle 맥락을 바탕으로 risk 우선으로 계산한다.

기준:

1. `componentGapCount`
2. `fallbackComponentCount`

추가 필드:

1. `items[].bundleContext.reviewPriority`
   - `high`
   - `medium`
   - `normal`
2. `items[].bundleContext.riskScore`
3. `pageSummaries[].maxRiskScore`

현재 정책:

- `componentGapCount > 0` → `high`
- `fallbackComponentCount > 0` → `medium`
- 둘 다 없으면 `normal`

실검증:

1. `home.brand-showroom = figma-home-brand-showroom-v1`
2. `home-lower-primary`가 `nextPendingBundle`
3. `reviewPriority = medium`
4. `riskScore = 10`

의미:

- 검수자는 이제 “맨 위부터”가 아니라 “위험도가 있는 pending bundle”부터 본다.
- `fallback`이 남아 있는 bundle이 acceptance 루프에서 먼저 드러난다.

### 22.13 Page-Level Acceptance Priority

bundle 우선순위만 risk 기준이고 page 우선순위가 그대로면 운영 흐름이 다시 어긋난다. 그래서 page 단위도 같은 기준으로 맞췄다.

반영:

1. `GET /api/workspace/final-readiness`
   - `pages[].maxRiskScore`
   - `nextActionablePageId`가 risk 기준으로 계산됨

2. `/admin`
   - page list 정렬 기준:
     1. `acceptanceStatus`
     2. `maxRiskScore`
     3. `fallbackComponentCount`
     4. `pending count`
   - page row에 `risk` 노출

실검증:

1. `home.maxRiskScore = 10`
2. 나머지 page = `0`
3. `nextActionablePageId = home`

의미:

- 이제 `bundle`과 `page`가 같은 우선순위 체계를 쓴다.
- `Go To Next Page`와 pages 패널도 실제 위험도 기준으로 움직인다.

### 22.14 Acceptance Queue

page와 bundle 우선순위만으로는 전역 검수 순서를 한 번에 보기 어렵다. 그래서 별도 acceptance queue를 추가했다.

API:

1. `GET /api/workspace/acceptance-queue?pageId=<id>`

정렬 기준:

1. `status`
   - `fail`
   - `pending`
2. `riskScore`
3. `bundleId`

반영:

1. `/admin`
   - `Final Acceptance Bundles`에 `Acceptance queue`
   - 상위 5개 bundle의
     - `status`
     - `risk`
     - `priority`
     표시

실검증:

1. `home.queueCount = 3`
2. `next.bundleId = home-lower-primary`
3. `home-lower-primary.riskScore = 10`

의미:

- acceptance 운영자는 이제 현재 page 안에서 “무엇부터 볼지”를 별도 큐로 바로 볼 수 있다.

### 22.15 Global Queue Preview

page detail에만 queue가 있으면 첫 진입 시 다시 판단이 필요하다. 그래서 `final-readiness`에 전역 queue preview를 같이 노출했다.

추가:

1. `GET /api/workspace/final-readiness`
   - `nextAcceptanceTarget`
     - queue 기준 우선
   - `acceptanceQueuePreview`
     - 상위 5개 bundle

2. `/admin`
   - Pages summary에 `queue preview`
   - `next acceptance target`
   - `Open Global Next Compare`

실검증:

1. `nextAcceptanceTarget.bundleId = home-lower-primary`
2. `acceptanceQueuePreview[0].bundleId = home-lower-primary`

의미:

- 이제 관리자 첫 화면에서 바로 다음 검수 대상을 연다.
- detail 화면에 들어가기 전에도 전역 queue를 볼 수 있다.

### 22.16 Acceptance Save Auto-Focus

acceptance 운영에서 실제 병목은 저장 후 다시 “다음에 무엇을 봐야 하는지”를 사람이 찾는 데 있었다. 이 단계가 끊기면 queue/priority를 만들어도 운영 효율이 떨어진다.

수정:

1. `/admin`
   - acceptance 저장 후 현재 page가 계속 활성 상태면
     - `next pending bundle` card로 자동 스크롤
     - compare 링크가 있으면 해당 버튼으로 focus
2. 저장 핸들러
   - 잘못된 `pageId` 참조 제거
   - `currentPageId` 기준으로 accepted 여부와 다음 page 이동 계산
3. bundle compare 링크
   - `data-acceptance-compare-link` 추가

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. 저장 후 동일 page에서 `focusNextPendingBundle()` 경로 사용
3. `currentPageId` 기준으로 다음 page / 다음 bundle 계산

의미:

- acceptance 운영자는 저장 후 다시 목록을 훑지 않아도 된다.
- 현재 page에 남아 있는 다음 검수 대상을 즉시 따라갈 수 있다.

### 22.17 Queue-To-Bundle Navigation

queue가 보여도 운영자가 다시 page 목록을 찾고 detail을 열어야 하면 흐름이 끊긴다. 그래서 acceptance queue item 자체를 navigation entry로 바꿨다.

추가:

1. `/admin`
   - `Acceptance queue` 각 item에 `Go To Bundle`
2. 새 helper
   - `navigateToBundle(pageId, bundleId)`
   - page 전환 후 target bundle card 자동 강조
3. queue item
   - compare 링크가 있으면 같은 줄에서 바로 연다

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `navigateToBundle()` 존재
3. `jump-acceptance-target-btn`가 queue item에 렌더

의미:

- acceptance queue를 보는 순간 바로 다음 검수 대상을 따라간다.
- page 목록과 detail 사이를 수동으로 왕복할 필요가 줄어든다.

### 22.18 Summary-To-Bundle Navigation

queue/detail까지 들어가지 않아도, 전역 기준 다음 검수 대상은 summary에서 바로 따라갈 수 있어야 한다. 그렇지 않으면 운영자가 첫 화면에서 한 번 더 탐색해야 한다.

추가:

1. `/admin` Pages summary
   - `Go To Next Bundle`
2. 기준
   - `finalReadinessMeta.nextAcceptanceTarget`
   - `pageId + bundleId`
3. 동작
   - target page로 이동
   - detail 렌더 후 bundle card 강조

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `jumpNextBundleBtn` 존재

의미:

- 관리자 첫 화면에서 바로 전역 기준 다음 acceptance target을 연다.
- summary -> detail -> bundle로 이어지는 흐름이 끊기지 않는다.

### 22.19 Activity-To-Bundle Navigation

acceptance 저장 이력은 운영에서 중요하지만, 단순 로그로만 보이면 다시 page/detail을 찾아가야 한다. 그래서 acceptance activity 자체를 review entry point로 바꿨다.

추가:

1. `/admin` Workspace Activity
   - filter: `all / acceptance`
2. `acceptance_result_saved` row
   - `Go To Bundle`
   - `pageId + bundleId`로 즉시 이동

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `activityFilter`, `data-activity-filter`, `activity-jump-btn` 존재

의미:

- acceptance 운영자는 최근 실패/보류 이력에서 바로 해당 bundle로 복귀할 수 있다.
- activity가 기록 저장소를 넘어 실제 재검수 entry point가 된다.

### 22.20 Summary/Fail Lists As Review Entry

page별 acceptance summary와 failed bundle 목록도 읽기 전용이면, 운영자는 다시 queue/detail을 오가야 한다. 이 둘도 review entry로 바꿔야 흐름이 닫힌다.

추가:

1. `Page acceptance summary`
   - `Go To Page`
   - `Go To Next Bundle`
2. `Current page failed bundles`
   - `Go To Bundle`
   - compare 링크 재노출
3. page별 next bundle 계산
   - `fail > pending`
   - 그 다음 `riskScore`

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `pageNextBundleMap`, `jump-page-btn` 존재

의미:

- summary/fail list도 바로 검수 진입점이 된다.
- acceptance 운영면 전체가 같은 navigation 규칙으로 맞춰졌다.

### 22.21 Recommended Order As Review Entry

`Recommended order`가 단순 참고 목록이면 운영자는 다시 다른 영역으로 이동해야 한다. 이 목록도 바로 action을 거는 entry여야 acceptance 면 전체가 일관된다.

추가:

1. `Recommended order`
   - `Go To Page`
   - `Go To Bundle`
   - compare 링크

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. recommended order 항목에 jump 버튼 렌더 확인

의미:

- acceptance 운영면의 주요 목록이 모두 동일한 navigation 규칙으로 닫혔다.
- 어떤 목록에서 시작하든 page/bundle/compare로 바로 진입한다.

### 22.22 URL-Persisted Admin Review State

acceptance 운영이 길어지면 새로고침/재진입/공유 시 현재 page와 bundle을 잃는 문제가 생긴다. 이 상태가 URL에 없으면 운영면이 다시 탐색 중심으로 돌아간다.

추가:

1. `/admin` query state
   - `pageId`
   - `bundleId`
   - `pageFilter`
   - `activityFilter`
2. helper
   - `readAdminStateFromUrl()`
   - `syncAdminStateUrl()`
3. jump/navigation/filter 변경 시 query 즉시 갱신

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `selectedBundleId`, `readAdminStateFromUrl()`, `syncAdminStateUrl()` 존재

의미:

- acceptance 운영 상태가 새로고침 후에도 유지된다.
- page/bundle deep link 자체를 공유할 수 있다.

### 22.23 Browser History For Acceptance Navigation

query state만 있고 browser history가 없으면, 뒤로가기/앞으로가기에서 운영 흐름이 깨진다. acceptance 면은 navigation이 많기 때문에 history까지 맞춰야 완결된다.

추가:

1. 주요 이동/필터 변경
   - `history.pushState`
2. `popstate`
   - `readAdminStateFromUrl()`
   - `refreshData()`
3. 적용 대상
   - page 선택
   - next page / next bundle
   - queue / activity / failed / summary jump
   - page filter / activity filter

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `syncAdminStateUrl("push")`, `window.addEventListener("popstate")` 존재

의미:

- acceptance 운영면이 브라우저 navigation과 일관되게 동작한다.
- 새로고침뿐 아니라 뒤로가기/앞으로가기까지 review state를 복원한다.

### 22.24 Bundle Query Synchronization After Save

URL에 `bundleId`를 남겨도, acceptance 저장 후 next pending bundle로 포커스만 옮기고 query는 이전 bundle을 가리키면 다시 stale state가 된다. 이건 deep link를 무너뜨리는 실제 버그다.

수정:

1. acceptance 저장 후
   - 현재 page가 accepted되면 `selectedBundleId = ""`
   - 같은 page에 `nextPendingBundleId`가 있으면 `selectedBundleId = nextPendingBundleId`
2. 위 상태를 즉시 `syncAdminStateUrl()`로 반영

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. save handler에 `selectedBundleId = nextPendingBundleId` 경로 존재

의미:

- 포커스 이동과 URL query가 같은 bundle을 가리킨다.
- 저장 직후 새로고침해도 다음 검수 대상이 유지된다.

### 22.25 Runtime Page Count Visibility

운영 중 가장 자주 헷갈리는 질문 중 하나가 “지금 사용자에게 실제로 노출되는 page family가 몇 개인가”다. 이 수치를 매번 문서나 코드에서 다시 찾으면 운영 효율이 떨어진다.

고정한 현재 기준:

1. `core pages = 6`
   - `home`
   - `support`
   - `bestshop`
   - `care-solutions`
   - `category-tvs`
   - `category-refrigerators`
2. `info pages = 2`
   - `lg-signature-info`
   - `objet-collection-story`
3. `plp pages = 2`
   - `category-tvs`
   - `category-refrigerators`
4. `pdp route = 1`
   - `/clone-product`

추가:

1. `/admin` Pages summary
   - `runtime pages`
   - `core`
   - `info`
   - `plp`
   - `pdp route`

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `runtime pages:` summary 문자열 존재

의미:

- 운영자가 현재 clone 범위를 UI에서 즉시 확인한다.
- page family/PLP/PDP 질문이 나와도 기준이 흔들리지 않는다.

### 22.26 Server-Driven Runtime Page Summary

runtime page 숫자를 admin에 하드코딩하면 이후 범위가 바뀔 때 다시 어긋난다. 이 요약은 UI가 아니라 server가 계산해야 한다.

추가:

1. `server.js`
   - `buildRuntimePageSummary(data)`
2. `/api/data`
   - `runtimePageSummary`
3. `/admin`
   - summary 숫자를 `data.runtimePageSummary`에서 읽음

현재 server 기준:

1. `corePages = 6`
2. `infoPages = 2`
3. `plpPages = 2`
4. `pdpRoutes = 1`

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `buildRuntimePageSummary`, `runtimePageSummary` 키 존재

의미:

- 운영면 숫자가 이제 server truth를 따른다.
- page 범위가 바뀌어도 UI/문서가 다시 쉽게 동기화된다.

### 22.27 Admin Detail Scope / Home Link Visibility

숫자만 보이면 다시 “구체적으로 어떤 page인가”, “home에서 실제 어디로 가는가”를 물어보게 된다. 운영면 detail에서 근거를 바로 보여줘야 질문이 다시 코드 탐색으로 돌아가지 않는다.

추가:

1. `/admin` detail
   - `Runtime Page Scope`
   - `Home Link Coverage` (`home` page only)
2. `server.js`
   - `linkCoverage.targets[]`
   - `clone-page / clone-product / external` target 샘플 포함

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `Runtime Page Scope`, `Home Link Coverage`, `linkCoverage.targets` 존재

의미:

- 운영자가 detail 화면에서 범위와 outbound link 근거를 바로 확인한다.
- “몇 페이지까지 준비됐나”, “home에서 어디로 연결되나”를 다시 코드로 추적할 필요가 줄어든다.

### 22.28 Runtime Route Catalog

숫자와 page id만으로는 여전히 “실제 route가 무엇인가”가 즉시 보이지 않는다. 운영면은 결국 id/type/route를 같이 보여줘야 한다.

추가:

1. `server.js`
   - `runtimePageSummary.routeCatalog[]`
   - 항목:
     - `core-page`
     - `info-page`
     - `plp-page`
     - `pdp-route`
2. `/admin`
   - `Runtime Page Scope`에서 `id + type + route` 표시

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `routeCatalog`, `core-page`, `pdp-route` 키 존재

의미:

- 운영자가 현재 clone 범위를 route 단위로 직접 본다.
- page family 질문이 나와도 UI에서 바로 route까지 확인 가능하다.

### 22.29 Server-Driven Page Advisories

특정 page의 known issue를 사람 기억에만 두면 acceptance 직전에 다시 빠진다. `care-solutions`의 GNB 이중 노출 같은 항목은 server truth로 고정해 운영면에 항상 보여야 한다.

추가:

1. `server.js`
   - `buildPageOperationalAdvisories()`
2. `/api/data`
   - `pageAdvisories`
3. `/admin`
   - `Page Advisories`

현재 포함:

1. `home`
   - hybrid shell 주의
2. `care-solutions`
   - `Duplicate GNB under header`
3. `category-tvs`, `category-refrigerators`
   - shared PDP route 안내

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `Duplicate GNB under header`, `Page Advisories` 존재

의미:

- `care-solutions` GNB 이중 노출은 계획 범위 안이며, acceptance 전 해결 대상임이 운영면에 고정된다.
- known issue가 질문/구두 전달이 아니라 server truth가 된다.

### 22.30 Advisory Visibility In Page List / Summary

known issue를 detail에만 두면 운영자가 page 우선순위를 잡을 때 다시 놓친다. advisory는 list/summary 레벨에서도 바로 보여야 한다.

추가:

1. `/admin` Pages summary
   - `page advisories`
   - `warning pages`
   - `error pages`
2. page row
   - advisory count
   - highest severity
3. client helper
   - `getPageAdvisoryMeta(pageId)`

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `page advisories:` / `page advisory ... severity ...` 문자열 존재

의미:

- 운영자는 detail 진입 전부터 known issue가 많은 page를 바로 본다.
- advisory가 acceptance 우선순위 판단의 일부로 작동한다.

### 22.31 Advisory Filter In Admin

advisory가 보여도 filter가 없으면 실제 운영에선 다시 수동 스캔이 필요하다. known issue가 있는 page만 바로 추려보는 기능이 있어야 한다.

추가:

1. `/admin` Pages toolbar
   - `All Advisories`
   - `Warning+`
   - `Error`
   - `Has Advisory`
2. 동작
   - acceptance 상태 filter와 advisory filter를 함께 적용
   - query state에도 유지

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `advisoryFilter`, `data-advisory-filter` 존재

의미:

- 운영자는 known issue가 있는 page만 즉시 모아서 볼 수 있다.
- acceptance 대상 스캔 비용이 더 줄어든다.

### 22.32 Server-Driven Advisory Priority

advisory를 UI에서만 계산하면 `next actionable page`와 실제 운영 우선순위가 다시 어긋난다. known issue도 readiness/priority 계산에 들어가야 한다.

추가:

1. `server.js`
   - `buildPageAdvisoryMetaMap()`
   - `pageAdvisoryCount`
   - `highestAdvisorySeverity`
   - `advisoryRiskScore`
2. `buildFinalReadinessReport()`
   - `pages[]`에 advisory meta 포함
   - `nextActionablePageId` tie-breaker에 advisory risk 반영
3. `/admin`
   - summary/page row는 server 계산값 우선 사용

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `buildPageAdvisoryMetaMap`, `advisoryRiskScore`, `pageAdvisoryCount` 존재

의미:

- known issue가 단순 표시를 넘어 실제 acceptance 우선순위에 들어간다.
- `care-solutions` 같은 문제 page가 server 기준 next target 계산에도 영향을 줄 수 있다.

### 22.33 Advisory Context In Acceptance Queue

risk score만 보이면 운영자는 다시 detail을 열어 원인을 역추적해야 한다. acceptance queue와 failed bundle 카드에도 advisory 맥락이 직접 보여야 검수 동선이 짧아진다.

추가:

1. `/admin` Acceptance queue
   - `advisory count`
   - `advisory severity`
   - `page advisories: severity:title`
2. `/admin` Current page failed bundles
   - 동일 advisory 메타 직접 노출
3. 목적
   - risk 숫자의 원인을 queue 단계에서 바로 설명
   - `care-solutions` GNB 이중 노출 같은 known issue가 검수 우선순위에서 숨지 않게 함

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `Acceptance queue`, `Current page failed bundles`, `page advisories:` 문자열 존재

의미:

- acceptance 운영은 이제 `status/risk`뿐 아니라 `known issue context`까지 queue 레벨에서 본다.
- 운영자는 detail 진입 전에도 왜 그 bundle이 먼저 검수 대상인지 이해할 수 있다.

### 22.34 Advisory Context In Summary Target

queue/detail에 advisory 맥락이 있어도 summary 상단이 여전히 risk 숫자만 보여주면 첫 진입 동선에서 다시 정보가 끊긴다. `next acceptance target`도 advisory 원인을 같이 보여야 한다.

추가:

1. `/admin` summary
   - `next acceptance target`에 advisory count / severity / risk 표시
2. `queue preview`
   - `advN` 형식으로 advisory count 표시

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `next acceptance target:` / `queue preview: ... adv` 문자열 존재

의미:

- 운영자는 첫 화면에서 바로 다음 검수 대상을 열고, 왜 그 대상이 우선인지 즉시 이해할 수 있다.

### 22.35 Page Row As Acceptance Entry

page 목록이 상태 요약만 보여주고 실제 검수 진입은 detail에서 다시 고르게 하면 동선이 한 단계 더 길다. page row 자체가 다음 bundle entry point가 되어야 한다.

추가:

1. `server.js`
   - `buildFinalReadinessReport()`
   - `pages[]`에 `nextBundleId / nextBundleStatus / nextBundleRiskScore / nextBundleCompareUrl`
2. `/admin` page row
   - `next bundle` 메타 직접 노출
   - `Go To Next Bundle`
   - `Open Compare`

실검증:

1. `node --check server.js`
2. `web/admin.html` embedded script compile `SCRIPT_OK`
3. `nextBundleId`, `Go To Next Bundle`, `next bundle ... risk` 존재

의미:

- page list가 단순 요약 목록이 아니라 바로 다음 acceptance 대상 진입점이 된다.
- detail 진입 전 한 단계를 줄여 acceptance 운영 비용을 낮춘다.

### 22.36 Summary Queue Preview As Direct Entry

상단 summary의 queue preview가 텍스트만 보여주면 운영자는 다시 queue/detail 영역으로 내려가야 한다. preview 자체가 직접 진입점이어야 한다.

추가:

1. `/admin` summary
   - `queue preview`를 action button row로 전환
2. 각 preview item
   - `bundleId`
   - `status`
   - `risk`
   - `adv`
   를 함께 표시하고 바로 `navigateToBundle(pageId, bundleId)` 호출

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `jump-summary-bundle-btn` 존재

의미:

- 운영자는 첫 화면 summary에서 곧바로 top queue bundle로 진입한다.
- acceptance 동선에서 한 번 더 스크롤/탐색하는 비용을 줄인다.

### 22.37 Valid Interactive Structure For Page Rows

page row를 `<button>`로 만들고 그 안에 다시 action button/link를 넣으면 HTML 구조가 잘못된다. 브라우저별로 click/focus 동작이 흔들릴 수 있으므로 row container와 action control을 분리해야 한다.

추가:

1. `/admin` page row
   - `<div role="button" tabindex="0" aria-pressed>`로 전환
2. keyboard entry
   - `Enter`
   - `Space`
3. 목적
   - row 선택과 inline action button을 동시에 안정적으로 사용
   - invalid nested interactive 구조 제거

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `role="button"`, `aria-pressed`, `keydown` 존재

의미:

- acceptance 운영면의 page row가 의미상/구조상 올바른 interactive surface가 된다.
- jump button과 row selection이 브라우저에서 더 일관되게 동작한다.

### 22.38 Deep Link Copy For Acceptance State

URL state를 유지해도 복사 버튼이 없으면 운영자는 현재 검수 위치를 다시 수동 복사해야 한다. acceptance 운영면은 현재 page/bundle/filter 상태를 바로 공유할 수 있어야 한다.

추가:

1. `/admin` summary
   - `Copy Current Link`
2. `/admin` detail
   - `Copy Page Link`
3. helper
   - `copyCurrentAdminLink()`
   - 포함 state: `pageId`, `bundleId`, `pageFilter`, `activityFilter`, `advisoryFilter`

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `copyCurrentAdminLink`, `Copy Current Link`, `Copy Page Link` 존재

의미:

- 운영자는 현재 검수 위치를 바로 공유/북마크/재진입할 수 있다.
- acceptance 동선이 개인 기억이 아니라 URL state로 고정된다.

### 22.39 Pass And Next Shortcut

acceptance 카드에서 가장 빈도가 높은 동작은 `pass` 저장 후 다음 bundle로 넘어가는 것이다. 매번 status select를 바꾸고 저장하는 건 불필요한 클릭이다.

추가:

1. `/admin` acceptance card
   - `Pass & Next`
2. helper
   - `saveAcceptanceDecision()`
3. 동작
   - `pass` 저장
   - 기존 auto-advance / next bundle focus 재사용

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `Pass & Next`, `pass-next-acceptance-btn`, `saveAcceptanceDecision()` 존재

의미:

- acceptance에서 가장 흔한 통과 처리 동선이 한 단계 짧아진다.
- 운영자는 status select를 다시 건드리지 않고 바로 다음 검수 대상으로 넘어간다.

### 22.40 Fail Note Presets

fail note를 필수로 강제하면 운영 품질은 좋아지지만, 자주 반복되는 사유를 매번 수동 입력하면 속도가 떨어진다. 규칙은 유지하되 preset으로 반복 입력 비용을 줄이는 것이 맞다.

추가:

1. `/admin` acceptance card preset
   - `visual mismatch`
   - `layout/spacing mismatch`
   - `fallback source still active`
   - `duplicate header/gnb`
2. 동작
   - preset 클릭 시 note 입력
   - status를 `fail`로 자동 전환

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `acceptance-note-preset-btn`, `Preset selected` 존재

의미:

- fail note 품질 규칙은 유지된다.
- 운영자는 반복되는 실패 사유를 더 빠르게 기록할 수 있다.

### 22.41 Fail And Save Shortcut

fail preset이 있어도 note를 직접 입력한 경우엔 다시 status를 `fail`로 바꾸고 저장해야 한다. note 필수 규칙은 유지하되, 수동 fail 기록 동선도 줄이는 것이 맞다.

추가:

1. `/admin` acceptance card
   - `Fail & Save`
2. 동작
   - status를 `fail`로 즉시 전환
   - 현재 note로 바로 저장
   - server의 `fail_note_required` 규칙은 그대로 유지

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `Fail & Save`, `fail-save-acceptance-btn` 존재

의미:

- fail 처리도 status select 조작 한 단계를 줄인다.
- fail note 품질 규칙은 유지하면서 수동 기록 속도를 높인다.

### 22.42 Acceptance Note Keyboard Shortcuts

acceptance note를 입력하는 동안 다시 마우스로 저장 버튼을 누르게 하면 반복 작업 비용이 크다. note 입력 중 바로 저장할 수 있는 키보드 단축이 있어야 한다.

추가:

1. `/admin` acceptance note
   - `Ctrl/Meta+Enter` → 현재 status 저장
   - `Alt+Enter` → `pass` 저장 + next 흐름
2. helper
   - `runAcceptanceSave()`

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `Ctrl/Meta+Enter`, `Alt+Enter`, `runAcceptanceSave` 존재

의미:

- acceptance note 입력과 저장이 같은 키보드 흐름 안에서 닫힌다.
- 마우스 이동 없이 더 빠르게 검수를 누적할 수 있다.

### 22.43 Focus Current Next Pending

현재 page의 `next pending bundle` 정보가 상단에 보여도 다시 카드 목록까지 스크롤해야 하면 동선이 끊긴다. 상단 정보와 실제 카드 포커스 동작이 직접 연결돼야 한다.

추가:

1. helper
   - `focusCurrentNextPendingBundle()`
2. `/admin` detail
   - `Focus Next Pending`
3. 동작
   - hidden `data-next-pending-bundle-id` marker를 읽고 해당 카드로 스크롤/포커스

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `focusCurrentNextPendingBundle`, `Focus Next Pending`, `data-next-pending-bundle-id` 존재

의미:

- 현재 page의 다음 검수 대상이 summary 정보와 실제 카드 포커스까지 한 흐름으로 연결된다.
- same-page acceptance 루프가 더 짧아진다.

### 22.44 Immediate Notice Feedback In Admin

copy/save 동작이 많아졌는데 피드백이 무음이면 운영자가 성공/실패를 다시 추정해야 한다. acceptance 운영면에는 짧은 즉시 notice가 필요하다.

추가:

1. `/admin`
   - `#adminNotice`
2. helper
   - `showAdminNotice(message, type)`
3. 현재 연결
   - `Copy Current Link`
   - `Copy Page Link`
   - `Acceptance saved`
   - `Fail note is required`
   - `Copy failed`

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `adminNotice`, `showAdminNotice`, `Acceptance saved` 존재

의미:

- 운영자는 copy/save 결과를 즉시 본다.
- acceptance 운영면이 더 이상 무음 상태 변화에 의존하지 않는다.

### 22.45 Preset Double-Click Quick Fail

fail preset을 바로 저장하게 만들면 너무 공격적이고, note 채우기만 하게 두면 여전히 한 클릭이 더 남는다. 단일 클릭과 double-click을 분리하면 안전성과 속도를 같이 잡을 수 있다.

추가:

1. `/admin` acceptance preset
   - 단일 클릭: note 채움 + status `fail`
   - double-click: note 채움 + `fail` 즉시 저장
2. 카드 안내 문구
   - `preset double-click fail & save`

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `preset double-click fail & save`, `dblclick` 존재

의미:

- 반복되는 실패 사유는 더 빠르게 기록된다.
- 단일 클릭 즉시 저장으로 인한 실수 가능성은 피한다.

### 22.46 Shift Enter For Fail Save

acceptance note 입력 중 `pass`는 키보드 단축으로 처리되는데 `fail`은 다시 버튼을 눌러야 하면 흐름이 비대칭이다. fail도 같은 note 입력 흐름 안에서 저장할 수 있어야 한다.

추가:

1. `/admin` acceptance note
   - `Shift+Enter` → `fail` 저장
2. 규칙
   - server의 `fail_note_required`는 그대로 유지
3. 카드 안내 문구 갱신

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `Shift+Enter`, `shiftKey`, `runAcceptanceSave("fail")` 존재

의미:

- note 입력에서 `pass/fail/save`가 모두 키보드 흐름 안에서 닫힌다.
- acceptance 기록 속도가 더 균형 있게 올라간다.

### 22.47 Bundle Deep Link Copy

page 단위 링크만 복사할 수 있으면 특정 acceptance bundle을 다시 열 때 한 단계가 더 필요하다. bundle 단위 deep link를 바로 복사할 수 있어야 재검수/공유가 정확해진다.

추가:

1. helper
   - `buildAdminStateUrl(pageId, bundleId)`
   - `copyAdminLinkFor(pageId, bundleId)`
2. `/admin` 버튼
   - `Copy Bundle Link`
3. 적용 위치
   - current page bundles
   - acceptance queue
   - current page failed bundles
4. notice
   - `Bundle link copied: <bundleId>`

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `Copy Bundle Link`, `copyAdminLinkFor`, `Bundle link copied` 존재

의미:

- 운영자는 특정 bundle 위치를 바로 공유/북마크/재진입한다.
- acceptance 동선의 granularity가 page가 아니라 bundle 단위까지 내려간다.

### 22.48 Consistent Bundle Copy Across Global Lists

bundle deep link copy가 일부 목록에만 있으면 운영자는 어느 영역에선 복사되고 어느 영역에선 다시 이동해야 한다. summary/recommended/queue/failed/current bundle 모두 같은 copy 동선을 가져야 한다.

추가:

1. `Page acceptance summary`
   - next bundle에 `Copy Bundle Link`
2. `Recommended order`
   - 각 bundle에 `Copy Bundle Link`
3. 목적
   - 전역 목록 어디서 보더라도 bundle deep link 복사 동선을 일관되게 유지

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `Copy Bundle Link`가 summary/recommended 영역에도 존재

의미:

- 운영자는 현재 보고 있는 목록을 바꾸지 않고 바로 bundle 링크를 복사한다.
- acceptance 운영 동선의 일관성이 더 높아진다.

### 22.49 Persistent Visual State For Selected Bundle

bundle deep link가 있어도 카드 강조가 잠깐의 focus animation에만 의존하면 재진입 후 타깃 식별이 약하다. URL state의 `bundleId`는 지속적인 시각 상태로 보여야 한다.

추가:

1. `/admin` bundle card
   - `.acceptance-selected-target`
   - `selected bundle target` 라벨
2. 동작
   - `selectedBundleId === bundle.bundleId`인 카드에 지속 highlight 적용
   - 일시적 focus animation과 별도로 유지

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `acceptance-selected-target`, `selected bundle target` 존재

의미:

- deep link / refresh / back-forward 후에도 현재 타깃 bundle이 명확하다.
- acceptance 운영의 URL state가 시각적으로도 더 강하게 고정된다.

### 22.50 Clear Bundle Target Action

bundle deep link를 고정하는 기능이 생기면, page-only 상태로 돌아가는 명시적 해제 액션도 있어야 한다. 그렇지 않으면 운영자는 bundle target을 URL/새로고침/이동으로만 간접 해제하게 된다.

추가:

1. `/admin` summary
   - `Clear Bundle Target`
2. 동작
   - `selectedBundleId` 제거
   - URL query의 `bundleId` 제거
   - page-only detail 상태로 복귀
3. notice
   - `Bundle target cleared`

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `Clear Bundle Target`, `clearBundleTargetBtn`, `Bundle target cleared` 존재

의미:

- bundle deep link의 설정/해제가 모두 명시적 UI 안에서 닫힌다.
- 운영자는 다시 page-level scanning 상태로 쉽게 복귀할 수 있다.

### 22.51 Copy Next Acceptance Target From Summary

상단 summary는 다음 검수 대상을 가장 먼저 보여주는 영역이다. 여기서 바로 deep link를 복사할 수 있어야 작업 전달/재진입이 한 단계 줄어든다.

추가:

1. `/admin` summary
   - `Copy Next Bundle Link`
2. 동작
   - `finalReadinessMeta.nextAcceptanceTarget`의 `pageId + bundleId` deep link 복사
   - notice: `Bundle link copied: <bundleId>`

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `Copy Next Bundle Link`, `copyNextBundleBtn` 존재

의미:

- 운영자는 summary에서 바로 다음 검수 대상을 복사/전달한다.
- 전역 next target 동선이 jump와 copy 모두로 닫힌다.

### 22.52 Page-Level Copy Alongside Jump

bundle-level deep link copy가 충분히 내려갔다면 page-level도 jump와 copy가 같은 밀도로 있어야 한다. 특정 page를 다시 보게 하거나 전달할 때 jump만 있고 copy가 없으면 동선이 비대칭이다.

추가:

1. `/admin` summary
   - `Copy Next Page Link`
2. page row
   - `Copy Page Link`
3. notice
   - `Page link copied: <pageId>`

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `Copy Next Page Link`, `copyNextPageBtn`, `copy-page-link-btn` 존재

의미:

- page-level도 jump와 copy가 모두 닫힌다.
- 운영자는 page를 바로 열거나, 바로 전달하거나 둘 다 같은 위치에서 처리한다.

### 22.53 Page And Bundle Copy Together In Current Bundle Card

current page bundle 카드에 bundle copy만 있고 page copy가 없으면, 같은 카드 안에서도 page-level과 bundle-level 동선이 갈라진다. 현재 bundle 카드 자체가 둘 다 제공해야 일관성이 맞다.

추가:

1. current page bundle card action
   - `Copy Page Link`
   - `Copy Bundle Link`
2. 목적
   - page-level copy / bundle-level copy를 같은 카드에서 모두 제공
   - page row / summary / detail / bundle card 간 copy 동선 일관화

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. current bundle 영역에 `Copy Page Link`, `Copy Bundle Link` 함께 존재

의미:

- 운영자는 current bundle 카드에서 page-level과 bundle-level 링크를 모두 바로 복사한다.
- acceptance 운영면의 copy 동선이 더 완전하게 맞춰진다.

### 22.54 Detail Header Controls For Selected Bundle

selected bundle target을 summary나 카드 강조로만 노출하면 detail을 중심으로 작업할 때 다시 위아래로 이동해야 한다. detail header 자체가 현재 target과 그 제어를 보여야 한다.

추가:

1. `/admin` detail header
   - `current bundle target: <bundleId>`
   - `Copy Selected Bundle Link`
   - `Focus Selected Bundle`
   - `Clear Bundle Target`
2. 목적
   - detail 기준으로도 현재 target bundle을 즉시 확인/복사/포커스/해제

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `current bundle target:`, `Copy Selected Bundle Link`, `Focus Selected Bundle` 존재

의미:

- detail 화면이 현재 bundle target의 표시와 제어까지 직접 담당한다.
- summary에 돌아가지 않고도 deep link 대상 작업을 끝낼 수 있다.

### 22.55 Activity Panel Bundle Copy

acceptance 이력이 activity에 남아도 jump만 되고 copy가 안 되면, 최근 검수 결과를 다시 전달할 때 한 단계가 더 필요하다. activity 패널도 jump와 copy가 같이 있어야 한다.

추가:

1. `/admin` Recent Activity
   - `Go To Bundle`
   - `Copy Bundle Link`
2. 대상
   - `acceptance_result_saved`

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `activity-copy-btn`, `Copy Bundle Link` 존재

의미:

- 최근 acceptance 이력에서 바로 재진입/공유가 가능하다.
- activity 패널도 운영 entry surface로 더 완전해진다.

### 22.56 Copy Next Pending From Detail

current page detail에서 `next pending bundle`은 가장 자주 이어지는 대상이다. 여기서 focus/compare만 되고 copy가 안 되면 전달/재진입에 한 단계가 더 필요하다.

추가:

1. `/admin` detail
   - `Copy Next Pending Link`
2. 동작
   - current page + next pending bundleId 기준 deep link 복사
   - notice: `Bundle link copied: <bundleId>`

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `Copy Next Pending Link`, `copyNextPendingBtn` 존재

의미:

- same-page 다음 검수 대상도 detail 안에서 바로 복사/전달된다.
- current page acceptance 루프가 더 완전하게 닫힌다.

### 22.57 Selected Bundle Compare In Detail Header

selected bundle target을 detail header에서 제어하게 만들었다면 compare도 같은 위치에서 열 수 있어야 한다. copy/focus/clear는 header에 있는데 compare만 카드에 남아 있으면 다시 한 단계가 생긴다.

추가:

1. `/admin` detail header
   - `selectedBundleDefinition`
   - `Open Selected Bundle Compare`
2. 동작
   - selected bundle의 `review.compareUrl`이 있으면 header에서 직접 오픈

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `selectedBundleDefinition`, `Open Selected Bundle Compare` 존재

의미:

- selected bundle target의 주요 제어가 detail header 한 곳에서 더 완결된다.
- deep link target 검수 동선에서 다시 카드까지 내려가는 비용을 줄인다.

### 22.58 Activity Panel Page-Level Actions

activity 패널이 bundle jump/copy만 제공하면, 최근 이력에서 page-level로 다시 보기/전달하려 할 때 동선이 비대칭이다. activity도 page와 bundle 둘 다 같은 수준으로 제공해야 한다.

추가:

1. `/admin` Recent Activity
   - `Go To Page`
   - `Copy Page Link`
   - 기존 `Go To Bundle`, `Copy Bundle Link` 유지
2. 대상
   - `acceptance_result_saved`

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `activity-page-btn`, `activity-copy-page-btn` 존재

의미:

- recent activity에서도 page-level / bundle-level 진입과 복사가 모두 가능하다.
- acceptance 이력 패널의 동선 일관성이 더 높아진다.

### 22.59 Page Row Compare Entry

page row가 jump/copy만 제공하고 compare는 detail에만 남아 있으면, 운영자는 비교 이미지를 보기 위해 다시 한 단계 내려가야 한다. page row도 compare entry가 있어야 한다.

추가:

1. helper
   - `buildPageReviewMap(visualManifest)`
   - `pageReviewMap`
2. page row action
   - `Open Page Compare`
   - `Open Next Bundle Compare`

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `buildPageReviewMap`, `Open Page Compare`, `Open Next Bundle Compare` 존재

의미:

- page row에서 jump/copy/compare가 모두 닫힌다.
- detail 진입이 꼭 필요하지 않은 운영 시나리오가 늘어난다.

### 22.60 Page Row Next Bundle Deep-Link Copy

page row에 next bundle jump와 compare는 있는데 deep-link copy가 없으면, review target을 전달하거나 재진입할 때 다시 detail이나 queue로 내려가야 한다. row 단계에서도 next bundle link를 직접 복사해야 동선이 대칭이다.

추가:

1. page row action
   - `Copy Next Bundle Link`
2. list handler
   - `pageListEl.querySelectorAll(".copy-bundle-link-btn")`
   - `copyAdminLinkFor(pageId, bundleId)` 재사용

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `Copy Next Bundle Link`, `pageListEl.querySelectorAll(".copy-bundle-link-btn")` 존재

의미:

- page row에서 jump/copy/compare가 next bundle 기준으로도 대칭을 맞춘다.
- detail 진입 없이도 review target 공유와 재진입이 가능하다.

### 22.61 Summary Next Page Compare Entry

summary 상단에 next actionable page의 jump/copy만 있고 compare가 없으면, 첫 화면에서 바로 비교 이미지를 열 수 없어서 page list나 detail로 다시 내려가야 한다. next page compare도 summary 단계에서 직접 열어야 한다.

추가:

1. summary action
   - `Open Next Page Compare`
2. 조건
   - `pageReviewMap.get(nextPageId)?.compareUrl`

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `Open Next Page Compare`, `pageReviewMap.get(nextPageId)?.compareUrl` 존재

의미:

- summary에서 next page의 jump/copy/compare가 한 줄에서 닫힌다.
- 첫 화면에서 바로 review compare로 진입할 수 있다.

### 22.62 Activity Compare Entry

activity 패널이 jump/copy만 제공하면, 최근 acceptance 이력에서 바로 시각 비교로 들어갈 수 없다. recent activity도 review entry surface이므로 compare를 같이 제공해야 한다.

추가:

1. activity acceptance action
   - `Open Page Compare`
   - `Open Bundle Compare`
2. lookup
   - `pageReviewMap`
   - activity render용 `bundleDefinitionMap`

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `Open Bundle Compare`, `pageReviewMap.get(item.detail.pageId)?.compareUrl`, `bundleDefinitionMap = new Map(...)` 존재

의미:

- recent acceptance 이력에서 page/bundle compare를 직접 연다.
- activity 패널도 review surface로 완결된다.

### 22.63 Page Acceptance Summary Compare Entry

`Page acceptance summary`가 jump만 제공하면, page 상태를 보다가도 compare를 열기 위해 detail 하위 카드나 list로 다시 내려가야 한다. summary도 page row와 같은 수준의 review action을 가져야 한다.

추가:

1. `Page acceptance summary` action
   - `Copy Page Link`
   - `Open Page Compare`
   - `Open Next Bundle Compare`
2. source
   - `pageReviewMap`
   - `pageNextBundleMap`

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `Page acceptance summary` 내 `Copy Page Link`, `Open Page Compare`, `Open Next Bundle Compare` 존재

의미:

- summary와 page row의 review action 수준이 가까워진다.
- acceptance 진입 전 중간 단계 재탐색을 줄인다.

### 22.64 Failed Bundle Page-Level Review Entry

`Current page failed bundles`가 bundle 기준 action만 제공하면, 재검수할 때 page-level compare와 page deep link를 다시 다른 영역에서 찾아야 한다. fail list도 page-level review entry를 같이 가져야 한다.

추가:

1. `Current page failed bundles` action
   - `Go To Page`
   - `Copy Page Link`
   - `Open Page Compare`
2. 유지
   - `Go To Bundle`
   - `Copy Bundle Link`
   - bundle `Open Compare`

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `Current page failed bundles` 내 `Go To Page`, `Copy Page Link`, `Open Page Compare` 존재

의미:

- fail list가 page-level / bundle-level review entry를 같이 제공한다.
- 재검수 동선에서 다른 영역으로 다시 이동할 필요를 줄인다.

### 22.65 Queue Page-Level Review Entry

`Acceptance queue`가 bundle 기준 action만 제공하면, 우선순위 높은 target을 보다가도 page-level compare와 page deep link를 다시 다른 영역에서 찾아야 한다. queue도 page-level review action을 같이 가져야 한다.

추가:

1. `Acceptance queue` action
   - `Go To Page`
   - `Copy Page Link`
   - `Open Page Compare`
2. 유지
   - `Go To Bundle`
   - `Copy Bundle Link`
   - bundle `Open Compare`

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `Acceptance queue` 내 `Go To Page`, `Copy Page Link`, `Open Page Compare` 존재

의미:

- queue가 page-level / bundle-level review entry를 같이 제공한다.
- 우선순위 높은 target을 보다가 다른 영역으로 다시 내려갈 필요를 줄인다.

### 22.66 Recommended Order Page-Level Review Entry

`Recommended order`가 bundle 기준 action만 제공하면, 정해진 검수 순서를 따라가면서도 page-level compare와 page deep link를 다시 다른 영역에서 찾아야 한다. recommended list도 page-level review action을 같이 가져야 한다.

추가:

1. `Recommended order` action
   - `Copy Page Link`
   - `Open Page Compare`
2. 유지
   - `Go To Page`
   - `Go To Bundle`
   - `Copy Bundle Link`
   - bundle `Open Compare`

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `Recommended order` 내 `Copy Page Link`, `Open Page Compare` 존재

의미:

- recommended list가 page-level / bundle-level review entry를 같이 제공한다.
- 정해진 검수 순서를 따라가며 다른 영역으로 다시 이동할 필요를 줄인다.

### 22.67 Summary Queue Preview Review Card

summary 상단의 `queue preview`가 bundle jump만 제공하면, 첫 화면에서 우선순위 높은 target을 보다가도 page copy/compare와 bundle copy/compare를 위해 다른 영역으로 내려가야 한다. preview도 mini review card 수준의 action을 가져야 한다.

추가:

1. summary `queue preview` action
   - `Go To Page`
   - `Copy Page Link`
   - `Go To Bundle`
   - `Copy Bundle Link`
   - `Open Page Compare`
   - `Open Bundle Compare`
2. summary handler
   - `jump-summary-page-btn`
   - `copy-summary-page-btn`
   - `copy-summary-bundle-btn`

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `jump-summary-page-btn`, `copy-summary-page-btn`, `copy-summary-bundle-btn`, `Open Bundle Compare` 존재

의미:

- summary 첫 화면의 queue preview가 바로 review entry surface가 된다.
- queue/detail/list로 다시 내려가는 단계를 더 줄인다.

### 22.68 Next Pending Page-Level Review Entry

`next pending bundle` 블록이 same-page focus와 bundle compare만 제공하면, current page의 다음 검수 target을 보면서도 page-level compare와 page deep link를 위해 다른 영역으로 이동해야 한다. 이 블록도 page-level review action을 같이 가져야 한다.

추가:

1. `next pending bundle` action
   - `Go To Page`
   - `Copy Page Link`
   - `Open Page Compare`
   - 기존 `Focus Next Pending`, `Copy Next Pending Link`, `Open Next Pending Compare` 유지
2. helper
   - `jumpNextPendingPageBtn`
   - `copyNextPendingPageBtn`

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `jumpNextPendingPageBtn`, `copyNextPendingPageBtn`, `Open Page Compare`, `Open Next Pending Compare` 존재

의미:

- current page 안의 다음 검수 target도 page-level / bundle-level review entry를 같이 제공한다.
- same-page acceptance 루프에서 다른 영역으로 다시 이동할 필요를 더 줄인다.

### 22.69 Detail Header Page Compare Entry

detail header에 page deep link만 있고 page compare가 없으면, detail에 진입한 뒤에도 Visual Batch 섹션으로 다시 내려가야 한다. header에서도 direct page compare를 제공해야 한다.

추가:

1. detail header action
   - `Open Page Compare`
2. 조건
   - `pageReviewMap.get(page.id)?.compareUrl`
3. id
   - `openDetailPageCompareBtn`

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `openDetailPageCompareBtn`, `Open Page Compare` 존재

의미:

- detail 진입 직후 page-level compare를 바로 연다.
- Visual Batch 섹션으로 다시 내려가는 단계를 줄인다.

### 22.70 Current Page Bundle Page Compare

`Current page bundles` 카드에 bundle compare만 있고 page compare가 없으면, 같은 카드 안에서도 page-level과 bundle-level review entry가 분리된다. current page bundle 카드도 page compare를 같이 가져야 한다.

추가:

1. `Current page bundles` action
   - `Open Page Compare`
2. 유지
   - `Copy Page Link`
   - `Copy Bundle Link`
   - bundle `Open Compare`

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `Current page bundles` 카드에 `Open Page Compare`, `data-acceptance-compare-link` 존재

의미:

- current page bundle 카드도 page-level / bundle-level review entry를 같이 제공한다.
- 같은 카드 안에서 review 진입점이 더 완결된다.

### 22.71 Visual Batch Review Copy Actions

Visual Batch 섹션의 review 링크가 `Open`만 제공하면, artifact 링크를 전달하거나 재진입할 때 URL을 다시 찾아야 한다. review 링크 묶음도 copy action을 같이 가져야 운영면답다.

변경:

1. review action
   - `Open Page Compare`
   - `Copy Compare Link`
   - `Copy Live Image Link`
   - `Copy Working Image Link`
   - `Copy Compare Image Link`
2. helper
   - `copyText(text)`
   - `.review-copy-btn`

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `review-copy-btn`, `Copy Compare Link`, `Copy Live Image Link`, `Copy Working Image Link`, `Copy Compare Image Link`, `copyText(` 존재

의미:

- Visual Batch 섹션이 open-only 링크 모음이 아니라 review artifact 운영면이 된다.
- compare/live/working/diff 링크를 바로 복사하고 전달할 수 있다.

### 22.72 Bundle Compare Label Normalization

page compare는 이미 `Open Page Compare`로 명시돼 있는데 bundle compare가 일부 영역에서 `Open Compare`로 남아 있으면, 운영면에서 대상이 모호하다. page/bundle compare 라벨을 명시적으로 분리해야 한다.

변경:

1. `Open Compare` -> `Open Bundle Compare`
2. 적용 영역
   - `Recommended order`
   - `Current page bundles`
   - `Acceptance queue`
   - `Current page failed bundles`

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. 해당 영역의 generic `Open Compare`가 `Open Bundle Compare`로 치환됨

의미:

- page compare와 bundle compare를 라벨만 보고도 즉시 구분한다.
- review action naming의 일관성이 높아진다.

### 22.73 Next Target / Pending Bundle Compare Naming

`Global Next`나 `Next Pending`이라는 표현만으로는 compare 대상이 page인지 bundle인지 즉시 드러나지 않는다. next target / next pending compare도 bundle compare임을 라벨에서 명시해야 한다.

변경:

1. `Open Global Next Compare` -> `Open Next Target Bundle Compare`
2. `Open Next Pending Compare` -> `Open Next Pending Bundle Compare`

실검증:

1. `web/admin.html` embedded script compile `SCRIPT_OK`
2. `Open Next Target Bundle Compare`, `Open Next Pending Bundle Compare` 존재

의미:

- next target / next pending review action의 대상이 라벨에서 즉시 드러난다.
- compare naming의 일관성이 더 높아진다.

### 22.74 Care Solutions Duplicate GNB Fix

`care-solutions`가 `preservePageHeader` 예외에 포함돼 있으면, clone shell header 위에 iframe 내부 captured header가 추가로 남아서 GNB가 이중 노출된다. archived HTML이 `header-wrap`/`header-top`를 포함하는 것이 확인됐으므로, 이 페이지는 preserve 대상에서 제외해야 한다.

변경:

1. `rewriteCloneHtml()`
   - `preservePageHeader = isHome || ["support", "bestshop"].includes(pageId)`
   - `care-solutions` 제거
2. advisory detail 보정
   - shell header만 남아야 한다는 기준으로 문구 갱신

실검증:

1. archived `care-solutions` HTML에서 `header-wrap`, `header-top` 존재 확인
2. `node --check server.js` 통과
3. `preservePageHeader` 예외에서 `care-solutions` 제거 확인

의미:

- `clone/care-solutions`는 shell header만 남기고 iframe 내부 captured header는 숨기는 방향으로 정리됐다.
- 최종 acceptance는 실제 browser view에서 second header block이 사라졌는지 확인하면 된다.

### 22.75 Git Upload Preparation

현재 작업 폴더는 git 저장소가 아니었다. 업로드 준비 단계에서는 generated/runtime/visual 산출물과 의존성 폴더를 제외하고, source/doc/script 중심으로 버전 관리를 시작하는 것이 맞다.

추가:

1. `.gitignore`
   - `node_modules/`
   - `tmp/`
   - `data/runtime/`
   - `data/visual/`
   - `data/debug/`
   - `data/reports/`
2. 목적
   - generated artifact를 제외하고 업로드 범위를 안정화

의미:

- git 업로드 준비가 시작됐다.
- 다음 단계는 `git init` 후 tracked candidate를 점검하는 것이다.

### 22.76 Git Repository Initialized

업로드 준비 단계에서 저장소가 git repository가 아니면 상태 추적과 staged 후보 점검이 불가능하다. `.gitignore` 기준이 정해졌다면 저장소 초기화와 기본 branch 정리가 먼저 와야 한다.

변경:

1. `git init`
2. branch rename
   - `master` -> `main`

의미:

- 업로드 준비가 실제 git workflow 단계로 들어왔다.
- 다음 단계는 staged candidate를 점검하고 필요 시 ignore 범위를 더 미세 조정하는 것이다.

### 22.77 Care Solutions Header Suppression Check

`care-solutions`에서 사용자가 본 "GNB 아래 또 다른 GNB"는 captured page header와 clone shell header가 동시에 보일 때 생기는 문제다. 이 문제는 captured 마크업 자체를 지우는 것보다 shell 기준에서 내부 header를 suppress하는 쪽이 맞다.

변경/확인:

1. `server.js`
   - `preservePageHeader` 대상에서 `care-solutions` 제외
2. `clone-content/care-solutions`
   - captured header markup는 남아 있지만 `.header-wrap`, `.header-top`은 숨김 대상으로 유지
3. advisory 유지
   - `care-solutions-duplicate-gnb`

의미:

- 이 이슈는 "captured markup 존재 여부"가 아니라 "browser view에서 second header block이 실제로 보이느냐"로 acceptance 해야 한다.
- 최종 검수 시 `care-solutions-pcmo` bundle에서 이 항목을 별도로 확인하면 된다.

### 22.78 Git Upload Prep Checklist Added

업로드 준비는 단순 `git init`로 끝나지 않는다. tracked candidate 범위와 ignore 범위를 문서로 고정해 두면 이후 commit/push 직전에 판단이 흔들리지 않는다.

추가:

1. `docs/git-upload-prep.md`

핵심:

1. 포함
   - `source`, `docs`, `scripts`, `data/raw`, `data/normalized`
2. 제외
   - `node_modules`, `tmp`, `data/runtime`, `data/visual`, `data/debug`, `data/reports`
3. 업로드 직전 확인
   - staged set
   - JS syntax
   - accidental generated file 유입 여부

의미:

- "다 끝나면 git으로 올릴 준비" 단계가 이제 문서 기준까지 고정됐다.

### 22.79 Git Upload Preflight Added

업로드 직전에는 매번 수동으로 branch, staged set, ignore 누수, JS syntax를 따로 확인할 필요가 없다. 반복되는 검사는 스크립트로 고정하는 것이 맞다.

추가:

1. `scripts/check_git_upload_prep.sh`
2. `package.json`
   - `npm run check:git-upload`

검증:

1. branch
   - `main`
2. staged count
   - `520`
3. ignored/generated path leak
   - 없음
4. syntax
   - `server.js`
   - `auth.js`
   - `llm.js`
   - 통과

의미:

- commit/push 직전 재사용 가능한 preflight가 생겼다.
- 업로드 준비 단계가 실제 실행 명령까지 닫혔다.

### 22.80 Repository README Added

git 업로드 시 `README.md`가 없으면 저장소의 목적, 현재 runtime 범위, 주요 명령이 외부에서 바로 보이지 않는다. 최소한의 프로젝트 개요는 root 문서로 고정하는 것이 맞다.

추가:

1. `README.md`

핵심:

1. 목적
   - live reference 기반 clone + LLM 편집 준비
2. runtime scope
   - core/info/PLP/PDP route
3. 주요 route
   - `/admin`
   - `/preview`
   - `/p/<pageId>`
   - `/clone/<pageId>`
4. 주요 명령
   - `npm run dev:web`
   - `npm run capture:visual-batch`
   - `npm run verify:home-links`
   - `npm run check:git-upload`

의미:

- 업로드 준비 문서가 root entry point까지 포함하게 됐다.

### 22.81 Acceptance Backlog Added

acceptance는 API/UI만 있다고 끝나지 않는다. 실제로 어떤 bundle이 남아 있고, 어떤 순서로 봐야 하며, 각 bundle에서 무엇을 주의해야 하는지가 별도 문서로 고정돼야 운영이 흔들리지 않는다.

추가:

1. `docs/acceptance-backlog.md`

핵심:

1. 현재 recorded state
   - `home-core = pass`
   - `home-lower-primary = pending`
2. 전체 bundle 8개 정리
3. recommended review order 고정
4. `care-solutions` duplicate GNB 등 review focus 고정

의미:

- 남은 acceptance를 한 번에 "쭉 진행"할 수는 있어도, 일괄 `pass` 처리하면 안 된다는 운영 기준이 문서까지 닫혔다.

### 22.82 Acceptance Current State Report Added

acceptance API는 인증이 필요한 반면, 운영자는 현재 실제 기록 상태를 빠르게 확인할 필요가 있다. runtime workspace 데이터를 기준으로 현재 acceptance 상태를 바로 뽑는 리포트 스크립트를 두는 것이 맞다.

추가:

1. `scripts/report_acceptance_status.mjs`
2. `package.json`
   - `npm run report:acceptance`
3. output
   - `docs/acceptance-current-state.md`

현재 결과:

1. workspace
   - `testuser1`
2. counts
   - `pass=1`
   - `pending=1`
   - `unreviewed=6`
3. next actionable bundle
   - `home-lower-primary`

의미:

- acceptance는 아직 거의 시작 단계다.
- 실제 남은 작업은 `home-lower-primary`부터 순서대로 bundle 검수를 채우는 것이다.

### 22.83 Care Solutions Header Check Added

`care-solutions`의 duplicate GNB 문제는 시각 acceptance 전에도 최소한 "captured header가 실제로 보이는가"를 자동으로 확인할 필요가 있다. shell suppress가 코드상으로만 존재하는지, 실제 clone page에서 먹히는지를 브라우저 기준으로 확인하는 스크립트를 두는 것이 맞다.

추가:

1. `scripts/check_care_solutions_header.mjs`
2. `package.json`
   - `npm run check:care-header`
3. output
   - `docs/care-solutions-header-check.md`

결과:

1. `pc`
   - `captureVisibleCount = 0`
2. `mo`
   - `captureVisibleCount = 0`
3. shell selectors
   - `.shell-top`
   - `.shell-bottom`
   만 visible

의미:

- `care-solutions`의 known issue는 자동 체크 기준으로는 해소 상태다.
- 최종 acceptance에서는 전체 page compare만 다시 보면 된다.

### 22.84 Acceptance Review Pack Added

남은 acceptance는 단순 bundle 이름 목록만으로는 느리다. 각 bundle마다 바로 열어야 할 compare URL과 실제 artifact 경로가 한 문서에 묶여 있어야 검수 속도가 올라간다.

추가:

1. `scripts/build_acceptance_review_pack.mjs`
2. `package.json`
   - `npm run report:acceptance-pack`
3. output
   - `docs/acceptance-review-pack.md`

핵심:

1. `home-lower-primary`, `home-lower-secondary`
   - section별 live/working/metadata 경로 정리
2. `support`, `bestshop`, `care-solutions`
   - `pc/mo` reference/working screenshot 경로 정리
3. `category-tvs`, `category-refrigerators`
   - `pc/mo` reference/working screenshot 경로 정리

의미:

- 남은 acceptance는 이제 문서 한 장으로 바로 따라갈 수 있다.
- 다음 단계는 실제 `pass/fail/pending` 기록을 채우는 운영이다.

### 22.85 Acceptance CLI Added

acceptance는 `/admin`에서만 기록할 수 있어도 되지만, 로컬 작업 흐름에서는 빠르게 현재 상태를 보거나 note를 갱신할 수 있는 CLI가 있으면 운영이 단순해진다.

추가:

1. `scripts/manage_acceptance.mjs`
2. `package.json`
   - `npm run acceptance:list`
   - `npm run acceptance:set`

검증:

1. `testuser1` 기준 bundle 목록 조회 성공
2. `home-lower-primary`
   - `status=pending`
   - `note=recheck pending`
   갱신 경로 확인

의미:

- acceptance 운영이 이제 UI와 CLI 두 경로로 닫혔다.

### 22.86 Acceptance Diff Report Added

남은 acceptance에서 무엇부터 봐야 하는지를 감으로 정하면 비효율적이다. 기존 visual artifact를 재사용해 screenshot diff 비율을 계산하면 검수 우선순위를 더 빠르게 고정할 수 있다.

추가:

1. `scripts/build_acceptance_diff_report.mjs`
2. `package.json`
   - `npm run report:acceptance-diff`
3. output
   - `docs/acceptance-diff-report.md`

핵심 결과:

1. home lower hotspot
   - `brand-showroom 32.72%`
   - `space-renewal 18.68%`
   - `latest-product-news 16.36%`
2. service pages
   - 전반적으로 `0.01% ~ 0.08%`
3. PLP
   - `category-tvs:pc 30.41%`
   - `category-refrigerators:pc 21.77%`

의미:

- 다음 acceptance 우선순위는 `home-lower-primary`와 `PLP pc`가 맞다.
- `support/bestshop/care-solutions`는 상대적으로 뒤로 미뤄도 된다.

### 22.87 Home Lower Capture Normalization Applied

기존 home lower mismatch 비율은 일부 섹션에서 실제 시각 차이보다 크게 잡혀 있었다. 원인은 live reference는 mobile section clip인데 clone 쪽은 wider shell 안의 section rect를 그대로 잡고 있었기 때문이다.

수정:

1. `scripts/capture_home_lower_sections.mjs`
2. clone URL을 `viewportProfile=mo + homeSandbox=<slot>` 기준으로 통일
3. clone capture 전 section을 `#__codex_capture_target`로 분리하고 `430px` 폭으로 강제

정규화 후 핵심 결과:

1. home lower 실제 hotspot
   - `smart-life 11.64%`
   - `subscription 7.71%`
   - `summary-banner-2 7.32%`
   - `space-renewal 6.44%`
2. 이전 과장치 해소
   - `brand-showroom 32.72% -> 2.20%`
   - `latest-product-news 16.36% -> 1.38%`
   - `space-renewal 18.68% -> 6.44%`
3. PLP 우선순위는 그대로 유지
   - `category-tvs:pc 30.41%`
   - `category-refrigerators:pc 21.77%`

의미:

- home lower acceptance 우선순위는 여전히 중요하지만, 실제 수정 대상은 `smart-life / subscription / summary-banner-2` 쪽으로 좁혀졌다.
- `brand-showroom / latest-product-news`는 capture artifact 비중이 컸고 현재는 상대적으로 안정적이다.
- 다음 구현 우선순위는 `home-lower-primary`의 남은 hotspot과 `PLP pc` 보정이다.

### 22.88 Objective Acceptance Findings Added

diff 퍼센트만으로는 무엇을 먼저 고쳐야 하는지 모호할 수 있다. 그래서 geometry metadata와 representative product metadata를 함께 읽어 구조 차이와 스타일 차이를 분리하는 보조 리포트를 추가했다.

추가:

1. `scripts/report_acceptance_objective_findings.mjs`
2. `package.json`
   - `npm run report:acceptance-objective`
3. output
   - `docs/acceptance-objective-findings.md`

핵심 결과:

1. `space-renewal`
   - mismatch `6.44%`
   - clone height가 live보다 `142.27px` 더 큼
   - 즉 구조/높이 mismatch가 실제로 남아 있다
2. `smart-life`, `subscription`, `summary-banner-2`
   - 높이 차이는 `0~1px`
   - 남은 diff는 layout spacing, image crop, typography, styling 쪽일 가능성이 높다
3. `category-tvs:pc`, `category-refrigerators:pc`
   - representative product metadata는 already match
   - 높은 diff는 grid item 위치보다 page shell, banner, filter/sort block, typography 차이 가능성이 높다

의미:

- `home-lower-primary` 내부에서도 `space-renewal`은 구조 수정, `smart-life/subscription`은 시각 보정으로 분리해서 다뤄야 한다.
- `PLP pc`는 product card grid를 다시 짜기보다 상단 shell과 filter/sort/banner 쪽부터 봐야 한다.

### 22.89 Space Renewal Structure Delta Reduced

`space-renewal`은 objective finding 기준으로 실제 구조 mismatch가 남아 있었다. raw mobile replay에 mobile row card shim을 추가해 과도한 section height를 줄였다.

변경:

1. `server.js`
   - `HomeMoListBannertype`용 replay CSS shim 추가

결과:

1. clone height
   - `758.27 -> 633`
2. live 대비 delta
   - `+142.27px -> +17px`
3. mismatch
   - `6.44% -> 6.43%`

의미:

- `space-renewal`은 여전히 구조 보정 축에 속하지만, 이전처럼 크게 붕괴된 상태는 아니다.
- 다음 수정은 gross layout 복구보다 spacing/visual tuning 쪽이 된다.

### 22.90 Clone Content Editor Chrome Gated

`clone-content` 기본 경로에 `page pill`과 chat editor chrome이 항상 주입되고 있었다. 이는 acceptance screenshot diff를 오염시키는 요소이므로 기본 경로에서는 비활성화하고 `editor=1`에서만 활성화하도록 바꿨다.

변경:

1. `server.js`
   - `rewriteCloneHtml()`에 `editorEnabled` 분기 추가
   - `sendCloneContent()`에서 query `editor=1`을 해석
   - launcher/closer listener는 null-safe로 변경

검증:

1. `/clone-content/category-tvs?viewportProfile=pc`
   - body에 `codex-page-pill`, `codex-chat-launcher`, `codex-chat-panel` 없음
2. `/clone-content/category-tvs?viewportProfile=pc&editor=1`
   - 위 3개 존재

의미:

- acceptance와 visual compare 기준 clone 화면에서 운영용 overlay를 제거했다.
- PLP diff는 여전히 높지만, 이제 원인은 오버레이가 아니라 실제 page shell/banner/filter/sort/style 차이에 더 가깝다.

### 22.91 PLP Working Capture Default Fixed

`npm run capture:plp`가 직관과 달리 `reference` capture만 갱신하고 있었다. 이 상태에서는 acceptance diff가 stale working artifact를 읽을 수 있으므로 기본 동작을 `working` capture로 바로잡았다.

변경:

1. `package.json`
   - `capture:plp` -> `node scripts/capture_plp_representatives.mjs --source working`
   - `capture:plp:reference` 추가

검증:

1. `category-tvs/pc/working.metadata.json`
   - `capturedAt = 2026-04-12T01:40:23.609Z`
2. working recapture 후 acceptance diff
   - `category-tvs:pc 30.37%`
   - `category-refrigerators:pc 21.54%`
   - `category-refrigerators:mo 20.19%`

의미:

- 이제 PLP diff는 stale working artifact가 아니라 현재 clone 상태를 기준으로 계산된다.
- recapture 이후에도 high diff가 유지되므로, 남은 문제는 capture tooling이 아니라 실제 page shell/banner/filter/sort/style mismatch다.

### 22.92 Hidden Visibility Override Narrowed

clone-content 공통 CSS가 `visibility:hidden` / `opacity:0`를 전역으로 풀고 있었다. 이는 hidden focus guard나 runtime-only hidden panel까지 노출시킬 수 있는 위험이 있어 이미지 태그로 범위를 축소했다.

변경:

1. `server.js`
   - 전역 hidden override 제거
   - 실제 이미지 태그에만 visible/opacity 보정 적용

재검증:

1. PLP working recapture 후에도 diff는 유지
   - `category-tvs:pc 30.37%`
   - `category-refrigerators:pc 21.54%`
   - `category-refrigerators:mo 20.19%`
2. home lower recapture 후에도 핵심 수치 유지
   - `smart-life 11.64%`
   - `subscription 7.78%`
   - `summary-banner-2 7.32%`

의미:

- 이 수정은 clone 안정성과 hidden node 오염 방지에는 필요했다.
- 하지만 현재 acceptance hotspot의 주원인은 아니며, 남은 큰 diff는 실제 shell/banner/filter/sort/style mismatch 쪽이다.

### 22.93 PLP Shell Capture Alignment
- `scripts/capture_plp_representatives.mjs` now uses `pc -> /clone` and `mo -> /clone-content` for working captures.
- `sendCloneShell()` now respects `view` / `viewportProfile`, so `category-*?view=pc` renders the desktop shell header instead of forcing the mobile baseline.
- Recaptured PLP working artifacts reduced PC diff sharply: `category-tvs:pc 4.24%`, `category-refrigerators:pc 4.27%`.
- `category-refrigerators:mo` remains the main PLP gap at `16.28%`.

### 22.94 Refrigerator Mobile Promo Alignment
- `category-refrigerators:mo` working clone now suppresses the top app promo banner to match the reference capture state.
- Diff reduced from `16.28%` to `4.43%`.
- Current PLP diff snapshot: `category-tvs:pc 4.24%`, `category-tvs:mo 4.30%`, `category-refrigerators:pc 4.27%`, `category-refrigerators:mo 4.43%`.

### 22.95 Home Lower Capture Stabilization
- `scripts/capture_home_lower_sections.mjs` now primes the source section, waits for image decode/load, and isolates live sections the same way as clone sections.
- Updated home-lower diff snapshot: `smart-life 9.42%`, `subscription 4.69%`, `summary-banner-2 5.13%`, `space-renewal 6.43%`.
- Remaining home-lower focus is now primarily `smart-life` and `space-renewal`.
