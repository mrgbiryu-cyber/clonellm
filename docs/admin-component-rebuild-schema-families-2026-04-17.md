# 관리자 컴포넌트 리빌드 스키마 패밀리

작성일: 2026-04-17

## 목적

이 문서는 `component rebuild core`를 슬롯별 하드코딩이 아니라 공통 `schema family`로 묶기 위해 작성한다.

핵심은 아래다.

- renderer는 `58개 core`를 개별 규칙으로 만들지 않는다.
- 먼저 공통 패밀리를 만든 뒤, 각 core 컴포넌트를 해당 패밀리에 매핑한다.
- 이후 renderer 구현은 `패밀리별 renderer + 패밀리별 field contract`로 진행한다.

원본 매핑 데이터는 아래 파일을 기준으로 한다.

- [component-rebuild-schema-catalog.json](/home/mrgbiryu/clonellm/data/normalized/component-rebuild-schema-catalog.json)

---

## 1. 현재 공통 패밀리

현재 1차 설계 기준 패밀리는 `9개`다.

1. `hero-carousel-composition`
2. `icon-link-grid-composition`
3. `commerce-card-grid-composition`
4. `ranking-list-composition`
5. `image-banner-strip-composition`
6. `service-benefit-hub-composition`
7. `pdp-summary-stack-composition`
8. `pdp-sticky-buybox-composition`
9. `editorial-visual-story-composition`

---

## 2. 패밀리별 해석

### 2.1 `hero-carousel-composition`

대상:

- `home.hero`
- `bestshop.hero`
- `care-solutions.hero`

용도:

- 상단 대표 비주얼과 핵심 메시지의 1차 인상을 재구성

핵심 block:

- `badge`
- `headline`
- `support`
- `visual`
- `action`
- `nav`

### 2.2 `icon-link-grid-composition`

대상:

- `home.quickmenu`
- `bestshop.shortcut`
- `care-solutions.tabs`
- `homestyle-home.quickMenu`

용도:

- 아이콘/링크 중심 빠른 진입 허브 재구성

핵심 block:

- `intro`
- `iconGrid`
- `support`
- `action`

### 2.3 `commerce-card-grid-composition`

대상:

- `home.md-choice`
- `home.timedeal`
- `home.marketing-area`
- `home.subscription`
- `home.space-renewal`
- `home.brand-showroom`
- `home.latest-product-news`
- `home.smart-life`
- `home.missed-benefits`
- `home.lg-best-care`
- `home.bestshop-guide`
- `homestyle-pdp.bestProduct`

용도:

- 커머스/서비스 카드 반복 영역의 shell, 밀도, 위계 재설계

핵심 block:

- `intro`
- `cardGrid`
- `support`
- `action`

### 2.4 `ranking-list-composition`

대상:

- `home.best-ranking`
- `care-solutions.ranking`

용도:

- 랭킹/추천 리스트의 순위 표현과 카드 리듬 재설계

핵심 block:

- `intro`
- `tabRow`
- `rankList`
- `support`
- `action`

### 2.5 `image-banner-strip-composition`

대상:

- `home.summary-banner-2`
- `support.tipsBanner`
- `bestshop.brandBanner`
- `care-solutions.careBanner`
- `homestyle-home.labelBanner`
- `category-tvs.banner`
- `category-refrigerators.banner`

용도:

- 배너/스트립형 모듈의 카피-비주얼 관계 재설계

핵심 block:

- `headline`
- `support`
- `visual`
- `action`

### 2.6 `service-benefit-hub-composition`

대상:

- `support.mainService`
- `support.bestcare`
- `care-solutions.benefit`

용도:

- 서비스 가치 전달과 혜택 큐레이션 허브 재구성

핵심 block:

- `intro`
- `benefitGrid`
- `trustCue`
- `action`

### 2.7 `pdp-summary-stack-composition`

대상:

- PDP 계열 `summary` 전부

용도:

- 가치 제안, 혜택, 배지, 구매 유도 위계 재설계

핵심 block:

- `badge`
- `title`
- `support`
- `benefitRow`
- `action`

### 2.8 `pdp-sticky-buybox-composition`

대상:

- PDP 계열 `sticky` 전부

용도:

- 가격/혜택/구매 CTA의 전환 흐름 재설계

핵심 block:

- `price`
- `benefit`
- `action`
- `support`

### 2.9 `editorial-visual-story-composition`

대상:

- `care-solutions-pdp.visual`
- `homestyle-home.brandStory`

용도:

- 비주얼 주도 스토리텔링 모듈 재설계

핵심 block:

- `headline`
- `story`
- `visual`
- `action`

---

## 3. 구현 원칙

### 3.1 먼저 패밀리 renderer

renderer는 먼저 `패밀리 단위`로 만든다.

예:

- `renderHeroCarouselComposition`
- `renderIconLinkGridComposition`
- `renderCommerceCardGridComposition`

### 3.2 그 다음 패밀리별 variant

같은 패밀리 안에서도 slot 성격 차이가 크면 `variant`로 분기한다.

예:

- `commerce-card-grid`
  - home curation variant
  - service card variant
  - editorial card variant

### 3.3 slot별 하드코딩은 마지막

slot별 예외는 허용하되, 공통 renderer와 variant로 커버되지 않는 경우에만 둔다.

---

## 4. 다음 단계

다음 구현 단계는 아래 순서가 맞다.

1. `hero-carousel-composition`
2. `icon-link-grid-composition`
3. `ranking-list-composition`
4. `image-banner-strip-composition`
5. `service-benefit-hub-composition`
6. `pdp-summary-stack-composition`
7. `pdp-sticky-buybox-composition`
8. `editorial-visual-story-composition`
9. `commerce-card-grid-composition`

이 순서는 난이도보다 `검증 효율` 기준이다.

- `hero`, `quickmenu`로 구조 검증
- 그 다음 `best-ranking`, `banner`, `benefit hub`로 반복형 검증
- 마지막에 `commerce-card-grid` 대군을 흡수
