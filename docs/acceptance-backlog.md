# Acceptance Backlog

최종 `ready-for-llm` 전환 전 남은 acceptance bundle 정리 문서다.

## Recorded State

현재 runtime에 실제 기록된 acceptance 결과는 아래 수준이다.

1. `home-core`
   - `pass`
   - note: `auto verification`
2. `home-lower-primary`
   - `pending`
   - note: `recheck pending`

즉, 실질적으로 남은 acceptance는 거의 전체 bundle 기준으로 다시 진행해야 한다.

## Bundle List

1. `home-core`
   - page: `home`
   - compare: `/compare/home`
   - items:
     - `header-top`
     - `header-bottom`
     - `hero`
     - `quickmenu`
     - `md-choice`
     - `timedeal`
     - `best-ranking`
2. `home-lower-primary`
   - page: `home`
   - compare: `/compare/home`
   - items:
     - `space-renewal`
     - `subscription`
     - `brand-showroom`
     - `latest-product-news`
     - `smart-life`
3. `home-lower-secondary`
   - page: `home`
   - compare: `/compare/home`
   - items:
     - `summary-banner-2`
     - `missed-benefits`
     - `lg-best-care`
     - `bestshop-guide`
4. `support-pcmo`
   - page: `support`
   - compare: `/compare/support`
   - items:
     - `mainService`
     - `notice`
     - `tipsBanner`
     - `bestcare`
5. `bestshop-pcmo`
   - page: `bestshop`
   - compare: `/compare/bestshop`
   - items:
     - `hero`
     - `shortcut`
     - `review`
6. `care-solutions-pcmo`
   - page: `care-solutions`
   - compare: `/compare/care-solutions`
   - items:
     - `hero`
     - `ranking`
     - `benefit`
     - `tabs`
     - `careBanner`
7. `category-tvs-pcmo`
   - page: `category-tvs`
   - compare: `/compare/category-tvs`
   - items:
     - `banner`
     - `filter`
     - `sort`
     - `productGrid`
8. `category-refrigerators-pcmo`
   - page: `category-refrigerators`
   - compare: `/compare/category-refrigerators`
   - items:
     - `banner`
     - `filter`
     - `sort`
     - `productGrid`

## Recommended Review Order

1. `home-lower-primary`
   - 이유: 홈 하단 핵심 섹션 묶음이며 진행 기록도 `pending`
2. `home-lower-secondary`
   - 이유: 홈 하단 마무리 묶음
3. `care-solutions-pcmo`
   - 이유: `Duplicate GNB under header` advisory
4. `home-core`
   - 이유: 이미 `pass` 기록은 있으나 home shell 전체 기준으로 최종 재확인 가치가 큼
5. `support-pcmo`
6. `bestshop-pcmo`
7. `category-tvs-pcmo`
8. `category-refrigerators-pcmo`

## Review Focus

### Home

1. `home-core`
   - hybrid shell
   - `header/GNB/hero`와 `quickmenu 이하` 연결감
2. `home-lower-primary`
   - `brand-showroom`
   - `latest-product-news`
   - `smart-life`
   - `space-renewal`
   - `subscription`
3. `home-lower-secondary`
   - 하단 배너/혜택/가이드 묶음의 순서, 간격, 폭

### Care Solutions

1. shell header 아래 second header block 비노출
2. `hero/ranking/benefit/tabs/careBanner` 묶음의 pc/mo compare

### Category

1. `banner/filter/sort/productGrid` 정렬
2. shared PDP route는 known advisory이므로 acceptance note와 별개로 운영상 인지

## Acceptance Rule

1. 여러 bundle을 한 번에 `pass` 처리하지 않는다
2. 각 bundle마다 `pass / fail / pending + note`
3. `fail`이면 note 필수
4. 전체 bundle `pass` 전에는 `ready-for-llm`로 전환하지 않는다
