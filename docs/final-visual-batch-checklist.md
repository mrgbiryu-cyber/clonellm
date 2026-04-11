먼저 읽을 기준 문서: `docs/project-purpose-reference.md`

# Final Visual Batch Checklist

## 목적
- 마지막 수동 visual acceptance 전에 reference/working artifact를 같은 루프로 갱신한다.
- 판단 기준은 live browser view다.
- 이 문서는 batch artifact와 최종 수동 점검 사이의 체크셋이다.

## Batch 명령
- `npm run capture:visual-batch`

## Batch 산출물
- `data/visual/batch-summary.json`
- `data/visual/home/*`
- `data/visual/home-lower/*`
- `data/visual/service-pages/index.json`
- `data/visual/plp/index.json`

## 홈 체크
1. `header-top`
2. `header-bottom`
3. `hero`
4. `quickmenu`
5. `md-choice`
6. `timedeal`
7. `best-ranking`
8. `space-renewal`
9. `subscription`
10. `brand-showroom`
11. `latest-product-news`
12. `smart-life`
13. `summary-banner-2`
14. `missed-benefits`
15. `lg-best-care`
16. `bestshop-guide`

항목별 확인
- `order-check`
- `width-check`
- `title-rhythm-check`
- `card-size-check`
- `image-fit-check`
- `background-layer-check`
- `text-color-check`
- `accepted-main-regression-check`

## 서비스/카테고리 체크
### support
- `mainService`
- `notice`
- `tipsBanner`
- `bestcare`

### bestshop
- `hero`
- `shortcut`
- `review`

### care-solutions
- `hero`
- `ranking`
- `benefit`
- `tabs`
- `careBanner`

### category
- `category-tvs.banner`
- `category-refrigerators.banner`

항목별 확인
- `source-switch-check`
- `patch-apply-check`
- `interaction-verification-check`
- `link-check`
- `component-boundary-check`

## 최종 acceptance 전 조건
1. `/api/workspace/pre-llm-gaps?pageId=<id>`가 accepted page-family에서 `pass`
2. `/admin`에서 source switch와 patch apply가 preview에 반영됨
3. visual batch artifact가 최신 생성 시각으로 갱신됨
4. 마지막 수동 비교는 live reference 기준으로만 판단
