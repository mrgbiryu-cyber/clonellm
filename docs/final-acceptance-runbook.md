먼저 읽을 기준 문서: `docs/project-purpose-reference.md`

# Final Acceptance Runbook

## 목적
- 마지막 visual acceptance를 감으로 하지 않고 고정된 묶음 순서로 진행한다.
- 기준은 항상 live reference browser view다.
- 이 문서는 `final acceptance bundle`의 실제 실행 순서 문서다.

## 사전 조건
1. `npm run capture:visual-batch` 완료
2. `/api/visual-batch-summary`가 `pass`
3. `/api/workspace/pre-llm-gaps?pageId=<id>`가 accepted page-family에서 `pass`
4. `/admin`에서 source switch / patch / preview가 정상 동작
5. `/api/workspace/final-readiness`에서 `llmGateStatus = blocked-by-acceptance` 또는 `ready-for-llm` 확인 가능

## 확인 순서
1. `home-core`
2. `home-lower-primary`
3. `home-lower-secondary`
4. `support-pcmo`
5. `bestshop-pcmo`
6. `care-solutions-pcmo`
7. `category-tvs-pcmo`
8. `category-refrigerators-pcmo`

## 저장 규칙
1. 각 bundle 확인이 끝나면 `/admin -> Final Acceptance Bundles`에서 결과를 저장한다.
2. 저장 값은 반드시 아래 중 하나로 고정한다.
   - `pass`
   - `fail`
   - `pending`
3. 차이가 있으면 note에 남긴다.
4. `fail`은 note 없이 저장하면 안 된다.
5. 다음 bundle은 `/admin`의 `next pending bundle` 기준으로 진행한다.
6. 모든 bundle이 `pass`가 되기 전까지 `llmGateStatus`는 `blocked-by-acceptance` 상태를 유지해야 한다.
7. `fail`로 저장된 bundle은 `/admin`의 `Current page failed bundles`에서 다시 확인한다.
8. `next pending bundle`에 compare 링크가 있으면 `Open Next Pending Compare`로 바로 연다.
9. 현재 page의 bundle이 모두 `pass`가 되면 `/admin`은 다음 actionable page로 자동 이동할 수 있다.

## Bundle별 확인 항목
### 1. `home-core`
- `header-top`
- `header-bottom`
- `hero`
- `quickmenu`
- `md-choice`
- `timedeal`
- `best-ranking`

체크
- `order-check`
- `width-check`
- `title-rhythm-check`
- `image-fit-check`
- `interaction-verification-check`
- `accepted-main-regression-check`

### 2. `home-lower-primary`
- `space-renewal`
- `subscription`
- `brand-showroom`
- `latest-product-news`
- `smart-life`

체크
- `order-check`
- `width-check`
- `card-size-check`
- `background-layer-check`
- `image-fit-check`

### 3. `home-lower-secondary`
- `summary-banner-2`
- `missed-benefits`
- `lg-best-care`
- `bestshop-guide`

체크
- `order-check`
- `title-rhythm-check`
- `background-layer-check`
- `link-check`

### 4. `support-pcmo`
- `mainService`
- `notice`
- `tipsBanner`
- `bestcare`

체크
- `source-switch-check`
- `patch-apply-check`
- `interaction-verification-check`
- `component-boundary-check`

### 5. `bestshop-pcmo`
- `hero`
- `shortcut`
- `review`

체크
- `source-switch-check`
- `patch-apply-check`
- `component-boundary-check`

### 6. `care-solutions-pcmo`
- `hero`
- `ranking`
- `benefit`
- `tabs`
- `careBanner`

체크
- `source-switch-check`
- `patch-apply-check`
- `interaction-verification-check`
- `component-boundary-check`

### 7. `category-tvs-pcmo`
- `banner`
- `filter`
- `sort`
- `productGrid`

체크
- `source-switch-check`
- `patch-apply-check`
- `link-check`
- `component-boundary-check`

### 8. `category-refrigerators-pcmo`
- `banner`
- `filter`
- `sort`
- `productGrid`

체크
- `source-switch-check`
- `patch-apply-check`
- `link-check`
- `component-boundary-check`

## 운영 기준
- bundle 단위로만 pass/fail 판단
- 중간 drift가 보이면 해당 bundle만 다시 capture
- accepted bundle은 다음 bundle 진행 전에 regression만 확인
- 마지막 판정은 API가 아니라 실제 브라우저 시각 비교로 결정

## 관련 API
- `/api/visual-batch-summary`
- `/api/visual-review-manifest`
- `/api/final-acceptance-bundles`
- `/api/workspace/pre-llm-gaps?pageId=<id>`
- `/api/workspace/llm-editable-list?pageId=<id>`
