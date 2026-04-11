# Interaction Inventory

## 목적
- 시각 baseline만 맞추는 것이 아니라, 실제 사용자 인터랙션까지 baseline/working 기준으로 비교한다.
- LLM이 나중에 수정할 대상을 `HTML`이 아니라 `interaction state` 단위로 제한한다.
- 페이지군별로 어떤 상태를 반드시 수집해야 하는지 빠지지 않게 관리한다.

## 원칙
1. 인터랙션은 `page -> slot -> state -> trigger -> result` 구조로 관리한다.
2. 단순 hover/click뿐 아니라 `선택 후 값 변화`도 상태로 본다.
3. `가격`, `옵션`, `정렬`, `필터`, `탭`, `drawer`, `sticky CTA`는 별도 state로 저장한다.
4. baseline과 working은 같은 interaction id를 가져야 한다.

## 공통 Interaction Model
```json
{
  "pageId": "home",
  "slotId": "header-bottom",
  "interactionId": "gnb-product-open",
  "kind": "menu-open",
  "trigger": {
    "type": "hover",
    "selector": "[data-shell-dropdown='제품/소모품']"
  },
  "result": {
    "panelVisible": true,
    "activeTab": "TV/오디오"
  },
  "coverageStatus": "captured"
}
```

## 홈(`m/home`) 필수 인터랙션

### Header
- `logo-home-nav`
- `header-search-open`
- `header-cart-nav`

### Hero
- `hero-slide-1 ... hero-slide-n`
- 현재는 live baseline 기준 slide 전부 수집

### Quickmenu
- `quickmenu-default`
- `quickmenu-nav-1 ... quickmenu-nav-10`

## PLP(Category) 필수 인터랙션

### Category Header / Tabs
- `category-tab-default`
- `category-tab-switch`

### Filter / Sort
- `filter-open`
- `filter-chip-selected`
- `filter-reset`
- `sort-open`
- `sort-option-changed`

### Product Grid
- `product-card-hover`
- `pagination-next` 또는 infinite load 상태

## PDP(Product Detail) 필수 인터랙션

### Gallery
- `gallery-thumb-change`
- `gallery-zoom-open` 또는 확대 계열

### Option / Variant
- `color-option-changed`
- `capacity-option-changed`
- `purchase-type-changed`

### Price / Benefit
- `price-default`
- `price-after-option-change`
- `price-after-purchase-type-change`
- `coupon-layer-open` (해당 시)

### Purchase Box
- `sticky-cta-visible`
- `compare-toggle`
- `wishlist-toggle`

## Support / Bestshop / Care Solution

### Support
- `support-gnb-open`
- `support-category-switch`

### Bestshop
- `bestshop-main-tab`
- `bestshop-map-or-store-tab`

### Care Solutions
- `care-main-tab`
- `care-benefit-card-switch`

## Coverage 상태 정의
- `captured`: baseline state와 working state 모두 존재
- `partial`: baseline 또는 working 중 하나만 존재
- `missing`: 상태 정의 또는 수집 자체가 없음
- `replaced`: custom interaction runtime으로 대체
- `figma-derived`: Figma 기반 component interaction으로 대체

## 현재 구현 상태
- 구현됨:
  - `home(m/home)` 기준
    - `logo-home-nav`
    - `header-search-open`
    - `header-cart-nav`
    - `hero-slide-*`
    - `quickmenu-default`
    - `quickmenu-nav-*`
- 아직 미구현:
  - `m/home` 메뉴 drawer / panel interaction
  - category filter/sort/tab
  - PDP 옵션/가격 변경
  - quickmenu 이후 하단 섹션 state
  - support/bestshop/care 상세 interaction

## 다음 단계
1. `home(m/home)` interaction coverage API 연결
2. `category-tvs`, `category-refrigerators`에 filter/sort interaction 추가
3. 카테고리별 대표 PDP 템플릿에 option/price interaction 추가
