# Home Remediation Plan

> 문서 상태:
> 이 문서는 `home` 복구/정렬 작업의 기준 계획 문서다.
> 다만 일부 표현은 당시 remediation 단계의 용어를 유지하고 있으므로, 현재 제품 구조와 역할 분리는 `docs/decision-history.md`, `docs/admin-preview-workbench-structure.md`, `docs/llm-planner-builder-schema.md`를 함께 본다.

## 목적
- `home`을 LLM 이전 최우선 기준 페이지로 다시 닫는다.
- `home`의 문제를 `구조`, `스타일`, `인터랙션`으로 분리해서 관리한다.
- `workbench -> clone 수정 -> replay` 루프를 홈에서 먼저 안정화한다.
- 임시 overlay나 ad hoc CSS가 아니라 재사용 가능한 규칙으로 홈을 정리한다.

## 판단 요약
`home`은 backend foundation 관점에서는 많이 올라와 있지만, visual acceptance 관점에서는 아직 미완료다.

요약하면:
1. baseline/source/slot 구조는 존재한다.
2. captured-first 방향은 유지되고 있다.
3. 하지만 실제 화면은 다음 문제가 섞여 있다.
   - captured fidelity 부족
   - open-state override CSS 과다
   - hero/하단 interaction 부재
   - lower content group 정의 부족
   - temporary visual patch 시도 흔적

즉 `home`의 핵심 문제는:
- reference를 재현하는 규칙 세트가 아직 충분히 닫히지 않았다는 점이다.

---

## 고정 원칙

### 1. view truth 우선
- `home`의 기준은 raw HTML이 아니라 브라우저에서 실제 보이는 결과다.
- 홈은 `hybrid` 기준을 명시적으로 따른다.
  - `header-top`, `header-bottom`, `GNB open`, `hero` = `pc` view truth
  - `quickmenu`, `quickmenu-below`, `lower-content` = `mo` view truth
- 판단 기준:
  1. reference screenshot
  2. working screenshot
  3. measured rect
  4. group check

### 2. ad hoc overlay 금지
- `홈스타일` 칩, 우측 프로모션 카드처럼 reference에 있는 요소를 임시 fixed/floating overlay로 맞추지 않는다.
- 홈 상단은 반드시 `header-bottom` / `GNB` 구조 안에서 재현해야 한다.

### 3. captured-first 유지
- `captured` baseline은 유지한다.
- 수정은 `custom` / `figma-derived` variant 또는 clone rendering rule에서만 한다.
- `captured` 원본 자체를 훼손하지 않는다.

### 3.1 수정 금지 범위
- fixed/floating overlay로 reference 요소를 흉내 내지 않는다.
- global CSS 강제 삽입으로 특정 home 요소만 임시 보정하지 않는다.
- captured DOM 원본 자체를 ad hoc으로 덮어쓰지 않는다.
- workbench check 없이 visual-only patch를 바로 누적하지 않는다.

### 4. 문제를 세 종류로 분리
모든 home 이슈는 아래 중 하나로만 분류한다.
1. `structure`
   - DOM/group/anchor/state 문제
2. `style`
   - spacing/font/color/border/size 문제
3. `interaction`
   - slide/open/hover/indicator/state transition 문제

### 5. 수정 순서 고정
- 상단 공통 구조부터 닫는다.
- 상단이 닫히기 전에는 하단 visual tuning을 확장하지 않는다.

순서:
1. `header-top`
2. `header-bottom`
3. `GNB open panel` 전체 1depth
4. `hero`
5. `quickmenu`
6. `quickmenu-below`
7. `lower-content`

---

## Home Scope Breakdown

## Reference State Lock

각 영역은 아래 reference state를 기준으로만 비교한다.

1. `header-top`
- state: `default`
- viewportProfile: `pc`

2. `header-bottom`
- state: `default`
- viewportProfile: `pc`

3. `GNB open panel`
- state set:
  - `gnb-product-open`
  - `gnb-care-open`
  - `gnb-support-open`
  - `gnb-benefits-open`
  - `gnb-story-open`
  - `gnb-bestshop-open`
  - `gnb-lgai-open`
- viewportProfile: `pc`

4. `hero`
- state: `hero default reference slide`
- viewportProfile: `pc`

5. `quickmenu`
- state: `default`
- viewportProfile: `mo`

6. `quickmenu-below`
- state: `default`
- viewportProfile: `mo`

7. `lower-content`
- state: `default`
- viewportProfile: `mo`

## Workbench / Artifact Contract

각 영역은 최소 아래 산출물을 보고 판단한다.

1. `clone/home`
- 최종 사용자가 보는 working 화면

2. `workbench/home`
- home 전체 reference / working / focus area

3. `workbench/gnb`
- GNB open-state 전용 비교

4. 필수 아티팩트
- `reference screenshot`
- `working screenshot`
- `measured rect`
- `group checks`
- `focus area metadata`

## Artifact Snapshot

바로 확인 가능한 산출물은 아래와 같다.

### URLs
- `http://localhost:3000/clone/home`
- `http://localhost:3000/workbench/home`
- `http://localhost:3000/workbench/gnb?pageId=home&menu=제품/소모품`
- `http://localhost:3000/api/home-workbench`

### Files
- `data/visual/home/live-reference.png`
- `data/visual/home/reference-replay.png`
- `data/visual/home/working.png`
- `data/visual/home/compare.png`
- `data/visual/home/metadata.json`

## Open Implementation Gaps

문서가 아니라 구현 쪽에서 아직 남아 있는 홈 gap은 아래와 같다.

1. `hero default reference slide`의 정확한 기준 인덱스 고정
2. `header-top/header-bottom/hero/quickmenu/quickmenu-below`를 각각 독립 group check로 뽑는 extractor 고도화
3. home 영역별 `blocker / warning / cosmetic` severity 세분화
4. `lower-content`를 실제 section 단위로 더 분해

## A. Header Top

### 범위
- 로고
- 우측 아이콘 영역
- `회사소개`
- `사업자몰`

### reference state
- `default`
- viewportProfile: `pc`

### groups
- `logo`
- `utility-icons`
- `corp-links`

### 주요 문제
1. 로고 크기/베이스라인이 reference와 다르다.
2. 우측 아이콘 간격과 정렬이 다르다.
3. `회사소개 / 사업자몰`의 폰트, 간격, 높이가 다르다.
4. 전체 top row의 시각 밀도가 reference보다 다르다.

### 분류
- 주로 `style`
- 일부 `structure` (captured header에 얹힌 override 영향)

### rule candidates
- `headerTop.logo.height`
- `headerTop.logo.baseline`
- `headerTop.utility.iconSize`
- `headerTop.utility.gap`
- `headerTop.corpLinks.gap`
- `headerTop.row.height`

### 종료 기준
1. 로고 높이/위치가 reference와 시각적으로 일치한다.
2. 우측 아이콘 spacing과 baseline이 일치한다.
3. `회사소개 / 사업자몰`의 행 높이와 간격이 일치한다.
4. overlay/fake chip이 없이 top row가 자연스럽게 일치한다.
5. backend 기준으로 invalid group이 없다.

---

## B. Header Bottom

### 범위
- 1depth 메뉴 전체
- `홈스타일`
- 브랜드 탭/보조 영역
- 높이/spacing/typography

### reference state
- `default`
- viewportProfile: `pc`

### groups
- `depth1-nav`
- `homestyle-chip`
- `promo-side`

### 주요 문제
1. 1depth 메뉴의 높이, 간격, 타이포가 다르다.
2. `홈스타일`이 원래 구조 안이 아니라 임시 방식으로 흔들렸었다.
3. 우측 보조 영역(브랜드/프로모션) 디자인과 위치가 다르다.

### 분류
- `structure`
- `style`

### rule candidates
- `headerBottom.row.height`
- `headerBottom.depth1.gap`
- `headerBottom.depth1.lineHeight`
- `headerBottom.homestyleChip.padding`
- `headerBottom.promoSide.width`
- `headerBottom.promoSide.offset`

### 종료 기준
1. 1depth 메뉴 줄 높이와 간격이 reference와 맞는다.
2. `홈스타일`이 실제 header-bottom 구조 안에서 자연스럽게 표현된다.
3. 우측 보조 영역이 fake overlay 없이 reference와 유사하게 보인다.
4. `header-bottom` alone screenshot이 reference와 크게 다르지 않다.
5. backend 기준으로 invalid group이 없다.

---

## C. GNB Open Panel

### 범위
- 모든 1depth 메뉴 open state
- `제품/소모품`
- `가전 구독`
- `고객지원`
- `혜택/이벤트`
- `스토리`
- `베스트샵`
- `LG AI`
- 우측 이미지/배너 영역

### reference state
- 각 1depth open state
- viewportProfile: `pc`

### groups
- `panel-root`
- `top-strip`
- `depth2-tabs`
- `depth3-columns`
- `right-promo`

### 주요 문제
1. open-state는 backend 기준 많이 맞췄지만 visual fidelity가 낮다.
2. `with-depth2`와 `simple-panel` 타입 차이가 아직 충분히 닫히지 않았다.
3. 우측 이미지/배너 영역이 reference와 다르다.
4. hover/active emphasis와 3depth visible state가 완전히 같지 않다.

### 분류
- `structure`
- `style`
- `interaction`

### 타입 구분
1. `mega-menu with depth2`
   - 예: `제품/소모품`
2. `simple-panel`
   - 예: `고객지원`, `혜택/이벤트`, `스토리`, `베스트샵`, `LG AI`

### rule candidates
- `gnb.panel.top`
- `gnb.panel.leftPadding`
- `gnb.topStrip.height`
- `gnb.depth2.gap`
- `gnb.depth2.activeStyle`
- `gnb.depth3.visibleCount`
- `gnb.rightPromo.width`
- `gnb.simplePanel.titleOffset`

### 종료 기준
1. 1depth 전체 open-state가 workbench에서 valid하다.
2. panel root / top strip / depth2 / visible depth3가 reference와 일치한다.
3. simple-panel 메뉴도 잘림/여백/타이포가 맞다.
4. 우측 이미지/배너 영역이 reference와 유사하게 보인다.
5. hover 시 active state가 reference와 같은 패턴으로 바뀐다.
6. backend 기준으로 blocker group이 없다.

---

## D. Hero

### 범위
- 기본 hero slide
- 우측 하단 indicator
- slide state
- 텍스트 위치 / 이미지 구도 / 높이

### reference state
- `hero default reference slide`
- viewportProfile: `pc`

### groups
- `hero-media`
- `hero-copy`
- `hero-indicator`

### 주요 문제
1. hero 크기/높이가 reference와 다르다.
2. 현재는 raw swiper를 정적으로 고정한 상태라서 layout은 일부 맞지만 interaction이 없다.
3. 우측 하단 indicator가 layout 차이에 영향을 줄 가능성이 있다.
4. 텍스트 구도와 이미지 크롭이 다르다.

### 분류
- `structure`
- `interaction`
- `style`

### rule candidates
- `hero.height`
- `hero.media.crop`
- `hero.copy.maxWidth`
- `hero.copy.offset`
- `hero.indicator.bottomOffset`
- `hero.indicator.activeState`

### 종료 기준
1. hero 기본 높이와 크롭이 reference와 맞다.
2. 기본 active slide가 reference 기준과 일치한다.
3. indicator 위치/크기/상태가 맞다.
4. slide interaction이 최소 baseline 수준으로 동작한다.
5. backend 기준으로 invalid state가 없다.

---

## E. Quickmenu

### 범위
- 2줄 quickmenu 카드
- 아이콘
- 외곽선/테두리
- card size
- 하단 summary banner
- indicator

### reference state
- `default`
- viewportProfile: `mo`

### groups
- `icon-grid`
- `menu-card`
- `summary-banner`
- `indicator`

### 주요 문제
1. 아이콘 크기와 카드 외곽선이 reference와 다르다.
2. quickmenu 카드 이미지/썸네일 비율이 다르다.
3. summary banner 폭과 비율이 다르다.
4. indicator가 reference와 다르다.

### 분류
- `style`
- `structure`
- 일부 `interaction`

### rule candidates
- `quickmenu.icon.size`
- `quickmenu.card.outline`
- `quickmenu.card.width`
- `quickmenu.card.imageRatio`
- `quickmenu.summaryBanner.width`
- `quickmenu.indicator.offset`

### 종료 기준
1. quickmenu의 카드 크기와 icon size가 맞다.
2. 외곽선/outline 처리와 카드 이미지가 맞다.
3. summary banner 폭과 위치가 맞다.
4. quickmenu area alone screenshot이 reference와 유사하다.
5. backend 기준으로 invalid group이 없다.

---

## F. Quickmenu Below

### 범위
- quickmenu 직하단 첫 블록
- summary/banner형 컴포넌트
- slide형 블록의 폭/active state
- `LGE.COM 타임딜`
- `MD's CHOICE`

### reference state
- `default`
- viewportProfile: `mo`

### groups
- `summary-banner-zone`
- `md-choice`
- `timedeal`
- `first-lower-slider`

### 주요 문제
1. 슬라이드가 제대로 동작하지 않아 개별 이미지 폭이 다르다.
2. 타임딜은 구조 일부는 들어왔지만 디자인이 아직 다르다.
3. 첫 하단 블록들의 rhythm과 spacing이 reference와 다르다.

### 분류
- `interaction`
- `style`
- `structure`

### rule candidates
- `quickmenuBelow.slider.itemWidth`
- `quickmenuBelow.slider.activeIndex`
- `timedeal.card.style`
- `mdChoice.card.style`
- `quickmenuBelow.sectionGap`

### 종료 기준
1. slide형 블록의 item width가 reference와 맞다.
2. 타임딜 디자인이 reference와 유사하다.
3. MD/타임딜/첫 하단 블록 간 spacing rhythm이 맞다.
4. backend 기준으로 invalid group이 없다.

---

## G. Lower Content

### 범위
- quickmenu 아래 나머지 홈 섹션 전반

### reference state
- `default`
- viewportProfile: `mo`

### groups
- `remaining-lower-sections`
- `section-order`
- `section-rhythm`

### 주요 문제
1. reference와 블록 구조 자체가 다른 섹션이 남아 있다.
2. section order / spacing / rhythm이 다르다.
3. 일부는 아직 placeholder replacement 단계에서 막 벗어난 상태다.

### 분류
- `structure`
- `style`
- `interaction`

### rule candidates
- `lowerContent.sectionOrder`
- `lowerContent.sectionGap`
- `lowerContent.sliderState`

### 종료 기준
1. 주요 섹션 order가 reference와 맞다.
2. section rhythm이 reference와 크게 어긋나지 않는다.
3. placeholder/skeleton 흔적이 없다.
4. backend 기준으로 blocker group이 없다.

---

## 작업 방식

### Step 1. reference 고정
각 영역마다 reference를 먼저 고정한다.
- screenshot
- rect
- group metadata
- interaction state

### Step 2. working 비교
- workbench에서 영역별 mismatch를 읽는다.
- mismatch를 `structure/style/interaction` 중 하나로 분류한다.

### Step 3. rule로 승격
- `header-bottom.height`
- `gnb.panel.leftPadding`
- `hero.indicator.position`
처럼 rule 이름으로 승격한다.

### Step 4. replay
- 수정 후 `home` 전체를 다시 replay한다.
- 새 rule은 home 내부 관련 상태 전부에 재적용한다.

### Step 5. visual acceptance
- 사용자가 실제 clone/home와 workbench를 보고 판단한다.
- backend pass여도 visual fail이면 미완료로 유지한다.

---

## Home Acceptance Gate

LLM 전 기준으로 `home`은 아래가 모두 충족돼야 한다.

1. `header-top` visual pass
2. `header-bottom` visual pass
3. `GNB open panel` all 1depth visual pass
4. `hero` visual + interaction baseline pass
5. `quickmenu` visual pass
6. `quickmenu-below` visual pass
7. lower content 주요 섹션이 reference와 정합

추가 조건:
- temporary overlay 없음
- placeholder/skeleton 없음
- workbench에서 invalid state 없음
- `groupChecks` 기준 blocker = 0
- `missing required group` = 0
- 사용자가 `home`을 기준 페이지로 인정 가능

## User Visual Acceptance Checklist

사용자는 아래 항목을 보고 `pass / fail / needs-fix`로 판단한다.

1. `header-top`
- 로고 크기와 위치가 같은가
- 우측 아이콘 간격이 같은가
- `회사소개 / 사업자몰`의 밀도와 정렬이 같은가

2. `header-bottom`
- 1depth 메뉴 줄 높이와 타이포가 같은가
- `홈스타일`이 자연스럽게 같은 위치에 있는가
- 우측 보조 영역이 overlay처럼 뜨지 않는가

3. `GNB open panel`
- 1depth를 열었을 때 패널 시각이 같은가
- 우측 이미지/배너가 같은가
- simple-panel 메뉴도 잘리지 않는가

4. `hero`
- 기본 slide가 같은가
- 우하단 indicator가 같은가
- 이미지 크롭과 텍스트 구도가 같은가

5. `quickmenu`
- 아이콘 크기와 outline이 같은가
- summary banner 폭이 같은가
- 카드 비율이 같은가

6. `quickmenu-below`
- 타임딜/MD 카드 디자인이 같은가
- 슬라이드형 블록 폭이 같은가

7. `lower-content`
- 섹션 순서가 같은가
- 하단 rhythm이 크게 다르지 않은가

---

## 당장 다음 우선순위
1. `header-top` fidelity
2. `header-bottom` fidelity
3. `GNB open panel` all 1depth
4. `hero`
5. `quickmenu`
6. `quickmenu-below`

즉 다음 home 작업은 반드시 상단부터 다시 닫는다.
