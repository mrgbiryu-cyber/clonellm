# 관리자 컴포넌트 리빌드 대상 분류표

작성일: 2026-04-17

## 목적

이 문서는 `컴포넌트 리빌더를 어디까지 만들어야 하는가`를 15개 타깃 기준으로 분류하기 위해 작성한다.

핵심은 아래 3가지다.

1. `component rebuild core`
   - 컴포넌트 전면개편이 실제로 필요하고, 별도 component rebuild renderer가 있어야 하는 대상
2. `patch sufficient`
   - 현재 patch builder 확장으로도 충분히 커버 가능한 대상
3. `higher-layer first`
   - 컴포넌트 자체보다 `group/page composition`에서 먼저 다뤄야 하는 대상

주의:

- 이 표의 기준 단위는 `15개 admin target`이다.
- 즉 `home-pc`와 `home-ta`는 같은 `home` 기반이라도 target이 다르므로 별도 행으로 둔다.
- `5개` 같은 숫자는 전체 대상 수가 아니라 `파일럿/1차 롤아웃 표본`일 뿐이고, 실제 전체 대상은 이 분류표를 기준으로 본다.

---

## 1. 대상 규모

- 전체 target 수: `15`
- 전체 target-component entry 수: `107`
- 이 중 `component rebuild core`는 `58`
- `patch sufficient`는 `37`
- `higher-layer first`는 `12`

이 숫자는 1차 설계 기준이다.
이후 실제 renderer 구현과 테스트 중 일부는 상향/하향 조정될 수 있다.

---

## 2. 분류 기준

| 분류 | 의미 | 예시 |
|---|---|---|
| `component rebuild core` | patch만으로는 전면개편 설득력이 부족하고, 별도 component composition schema + renderer가 필요한 대상 | hero, quickmenu, ranking, benefit hub |
| `patch sufficient` | 현재 patch surface 확장으로 충분히 커버 가능하거나, 리빌더 우선순위가 낮은 대상 | notice, review, qna, price |
| `higher-layer first` | 컴포넌트 단품보다 구간/페이지 리듬 재구성이 먼저여야 하는 대상 | productGrid, firstRow, firstProduct |

---

## 3. 페이지별 분류표

| Target | 구성 수 | Component Rebuild Core | Patch Sufficient | Higher-Layer First |
|---|---:|---|---|---|
| `home-pc` | 17 | `hero`, `quickmenu`, `md-choice`, `timedeal`, `best-ranking`, `marketing-area`, `subscription`, `space-renewal`, `brand-showroom`, `latest-product-news`, `smart-life`, `summary-banner-2`, `missed-benefits`, `lg-best-care`, `bestshop-guide` | `header-top`, `header-bottom` | - |
| `home-ta` | 17 | `hero`, `quickmenu`, `md-choice`, `timedeal`, `best-ranking`, `marketing-area`, `subscription`, `space-renewal`, `brand-showroom`, `latest-product-news`, `smart-life`, `summary-banner-2`, `missed-benefits`, `lg-best-care`, `bestshop-guide` | `header-top`, `header-bottom` | - |
| `support` | 4 | `mainService`, `tipsBanner`, `bestcare` | `notice` | - |
| `bestshop` | 4 | `hero`, `shortcut`, `brandBanner` | `review` | - |
| `care-solutions` | 5 | `hero`, `ranking`, `benefit`, `tabs`, `careBanner` | - | - |
| `care-solutions-pdp` | 4 | `visual` | `detailInfo`, `noticeBanner`, `reviewInfo` | - |
| `homestyle-home` | 3 | `quickMenu`, `labelBanner`, `brandStory` | - | - |
| `homestyle-pdp` | 6 | `bestProduct` | `detailInfo`, `review`, `qna`, `guides`, `seller` | - |
| `category-tvs` | 6 | `banner` | `filter`, `sort` | `productGrid`, `firstRow`, `firstProduct` |
| `category-refrigerators` | 6 | `banner` | `filter`, `sort` | `productGrid`, `firstRow`, `firstProduct` |
| `pdp-tv-general` | 7 | `summary`, `sticky` | `gallery`, `price`, `option`, `review`, `qna` | - |
| `pdp-tv-premium` | 7 | `summary`, `sticky` | `gallery`, `price`, `option`, `review`, `qna` | - |
| `pdp-refrigerator-general` | 7 | `summary`, `sticky` | `gallery`, `price`, `option`, `review`, `qna` | - |
| `pdp-refrigerator-knockon` | 7 | `summary`, `sticky` | `gallery`, `price`, `option`, `review`, `qna` | - |
| `pdp-refrigerator-glass` | 7 | `summary`, `sticky` | `gallery`, `price`, `option`, `review`, `qna` | - |

---

## 4. 해석

### 4.1 홈 계열

`home-pc`, `home-ta`, `homestyle-home`, `care-solutions`는 전면개편 수요가 높아서 `component rebuild core` 비중이 크다.

즉 이 페이지군은:

- 컴포넌트 리빌더가 실제로 많이 필요하고
- 이후 `group/page composition`도 같이 올라가야 한다.

### 4.2 서비스/지원 계열

`support`, `bestshop`, `care-solutions-pdp`, `homestyle-pdp`는 혼합형이다.

- 상단 진입부나 핵심 설명 모듈은 rebuild가 필요할 수 있고
- 나머지는 patch sufficient로 남는 비중이 높다.

### 4.3 PLP 계열

`category-*`는 전면개편의 핵심이 단일 컴포넌트보다 `리스트 리듬`과 `상단/배너 조합`에 있다.

그래서:

- `banner`는 component rebuild core
- `filter`, `sort`는 patch sufficient
- `productGrid`, `firstRow`, `firstProduct`는 `higher-layer first`

로 본다.

### 4.4 PDP 계열

PDP는 전체적으로 구조가 안정돼 있어서 대부분 patch sufficient다.

다만:

- `summary`
- `sticky`

는 구매 전환 경험에 직접 연결되므로 component rebuild core로 본다.

---

## 5. 구현 우선순위

### 5.1 파일럿 검증 대상

- `home.hero`
- `home.quickmenu`

### 5.2 1차 롤아웃 대상

- `home.hero`
- `home.quickmenu`
- `home.best-ranking`
- `care-solutions.hero`
- `homestyle-home.brandStory`

### 5.3 전체 롤아웃 대상

이 문서의 `component rebuild core` 전체를 대상으로 한다.

즉 최종 목표는:

- `58개 target-component entry`

를 component rebuild 지원 범위로 관리하는 것이다.

---

## 6. 다음 단계

다음 단계는 아래 순서로 진행한다.

1. `component rebuild core`에 대해 공통 schema field family 정의
2. `파일럿 검증 대상` renderer 구현
3. `1차 롤아웃 대상` renderer 확장
4. `higher-layer first` 대상은 group/page composition backlog로 이동
5. target별 테스트 매트릭스 작성

공통 schema family 기준은 아래 문서를 본다.

- [관리자 컴포넌트 리빌드 스키마 패밀리](./admin-component-rebuild-schema-families-2026-04-17.md)
