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
   - diff hotspot:
     - `smart-life 11.64%`
     - `subscription 7.71%`
     - `space-renewal 6.44%`
2. `category-tvs-pcmo`
   - 이유: `pc 30.41%`로 현재 PLP 중 가장 큰 차이
3. `category-refrigerators-pcmo`
   - 이유: `pc 21.77%`로 다음 우선순위
4. `home-lower-secondary`
   - 이유: 홈 하단 마무리 묶음이며 `summary-banner-2`와 하단 가이드 계열 차이가 남아 있음
   - diff hotspot:
     - `summary-banner-2 7.32%`
     - `bestshop-guide 5.46%`
     - `lg-best-care 4.92%`
5. `home-core`
   - 이유: 전체 home 기준 `11.89%`
6. `care-solutions-pcmo`
   - 이유: 기존 advisory 대상이었으나 현재 auto check 기준 거의 해소
   - diff:
     - `pc 0.07%`
     - `mo 0.08%`
7. `support-pcmo`
   - diff:
     - `pc 0.01%`
     - `mo 0.02%`
8. `bestshop-pcmo`
   - diff:
     - `pc 0.01%`
     - `mo 0.04%`

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
3. 자동 체크 증거
   - `docs/care-solutions-header-check.md`
   - `pc/mo` 모두 `captureVisibleCount = 0`

### Category

1. `banner/filter/sort/productGrid` 정렬
2. shared PDP route는 known advisory이므로 acceptance note와 별개로 운영상 인지
3. 현재 diff 기준으로는 `pc`가 `mo`보다 우선 검수 대상

## Acceptance Rule

1. 여러 bundle을 한 번에 `pass` 처리하지 않는다
2. 각 bundle마다 `pass / fail / pending + note`
3. `fail`이면 note 필수
4. 전체 bundle `pass` 전에는 `ready-for-llm`로 전환하지 않는다
