# Structure Extraction Plan

## 목적
- 페이지별 DOM을 수동으로 맞추지 않고, 공통 구조를 추출해서 재사용한다.
- `reference`와 `working`의 차이를 감이 아니라 구조/상태/레이아웃 기준으로 본다.
- 이후 `captured`, `custom`, `figma-derived`를 같은 slot 체계 안에서 교체 가능하게 만든다.
- 새로 발견되는 zone/slot/pattern을 드롭하지 않고 누적 가능한 완성형 구조를 만든다.
- 기준 truth를 HTML source가 아니라 실제 브라우저 렌더 결과로 고정한다.

## 최우선 기준
- 이 프로젝트의 기준은 코드 구현보다 `view judgment`다.
- 고객이 브라우저에서 보고 비교하고 수정 판단을 하는 것이 목적이다.
- 따라서 extractor는 DOM source를 읽는 도구가 아니라, `Chrome + CDP`로 실제 열린 상태와 렌더 결과를 읽는 도구여야 한다.

우선순위:
1. browser-rendered screenshot
2. measured rect / group bounds
3. state validity
4. DOM / HTML structure

## 현재 확인된 문제

### 1. 경로 문제가 아니라 `open state` 문제
- `home`의 `clone-content`에는 실제로 아래 DOM이 존재한다.
  - `header-top`
  - `header-bottom`
  - `CommonPcGnb_item__ooPqg`
  - `CommonPcGnb_nav_cate__KkLVL`
- 즉 GNB 소스가 없는 것이 아니라, 열림 상태를 만드는 조건이 부족하다.

### 2. GNB는 메뉴별 문제가 아니라 `공통 gate` 문제
- `제품/소모품`만 안 열리는 것이 아니라, 하단 GNB 라인 전체가 같은 방식으로 안 열린다.
- 이는 메뉴 데이터보다 다음 공통 조건이 복제되지 않았다는 뜻이다.
  - 상위 `li` open class
  - `aria-expanded`
  - panel root visibility
  - 2depth/3depth active 상태

### 3. `home`은 hybrid baseline
- `header-zone`, `hero-zone`: desktop-like
- `content-zone`: mobile-like
- 따라서 page-wide 한 벌로 보면 계속 틀린다.

### 4. URL resolver는 truth가 아니라 힌트
- `route`는 baseline 후보를 찾는 데는 유효하다.
- 하지만 일부 영역은 같은 페이지 안에서도 desktop-like / mobile-like가 섞여 있다.
- 따라서 최종 baseline 판정은 URL이 아니라 `zone별 screenshot + rect`로 해야 한다.

## 추출해야 할 것

### A. Route Resolver
페이지군별 baseline URL 규칙을 구조적으로 보관한다.

예:
- `home.visual = /m/home`
- `home.structural = /home`
- `category-*.visual = /m/category/*`
- `support.visual = /support`

필드:
- `pageId`
- `visualUrl`
- `structuralUrl`
- `mode`

추가 원칙:
- route resolver는 `candidate baseline`을 정하는 용도다.
- 실제 적용은 zone별 browser truth와 workbench 결과로 확정한다.

### B. Slot Extractor
페이지 전체가 아니라 slot 단위로 추출한다.

추가 원칙:
- slot은 고정 배열이 아니라 registry로 저장한다.
- extractor가 새로운 패턴을 만나면 `unknown-pattern`으로 provisional 등록한다.
- 동일한 새 패턴이 반복되면 `componentType`으로 승격한다.

필수 slot:
- `header-top`
- `header-bottom`
- `hero`
- `quickmenu`
- `timedeal`
- `md-choice`
- `category-tabs`
- `filter-bar`
- `sort-bar`
- `product-grid`
- `product-gallery`
- `product-summary`
- `price-box`
- `sticky-purchase`
- `search-panel`
- `search-suggest`
- `review-list`
- `qna-list`
- `floating-cta`
- `modal-sheet`

필드:
- `slotId`
- `componentType`
- `containerMode`
- `zoneId`
- `sourceUrl`
- `surfaceId`
- `status`

### C. State Extractor
닫힘/열림/선택 상태를 별도로 수집한다.

필수 state:
- `default`
- `gnb-product-open`
- `gnb-care-open`
- `gnb-support-open`
- `gnb-benefits-open`
- `gnb-story-open`
- `gnb-bestshop-open`
- `gnb-lgai-open`
- `hero-slide-*`
- `filter-open`
- `sort-open`
- `option-selected`
- `price-changed`
- `search-open`
- `review-tab-open`
- `qna-tab-open`
- `sticky-visible`
- `drawer-open`

필드:
- `stateId`
- `triggerType`
- `triggerTarget`
- `result`
- `surfaceId`

### D. Layout Extractor
DOM 구조만이 아니라 실제 배치 값을 저장한다.

필드:
- `viewportWidth`
- `containerX`
- `containerY`
- `containerWidth`
- `containerHeight`
- `rowCount`
- `columnCount`
- `gap`
- `padding`
- `itemRects`
- `anchorRect`
- `visualGroups`

추가 원칙:
- 측정값은 HTML static parse가 아니라 브라우저에서 열린 상태 기준으로 읽는다.
- group rect는 screenshot과 같은 viewport/canvas 기준이어야 한다.

### E. Group Extractor
반복 구조를 그룹으로 묶는다.

예:
- GNB 2depth 탭 그룹
- GNB 3depth 컬럼 그룹
- quickmenu item 그룹
- product card 그룹
- hero slide 그룹
- review item 그룹
- Q&A item 그룹
- suggest keyword 그룹
- floating action 그룹

필드:
- `groupId`
- `role`
- `itemIds`
- `repeated`
- `provisional`

### F. Zone / Surface Extractor
본문 외 overlay/floating UI도 추출 축으로 관리한다.

기본 zone:
- `header-zone`
- `hero-zone`
- `content-zone`

추가 가능 zone:
- `sticky-zone`
- `search-zone`
- `review-zone`
- `qna-zone`
- `support-zone`

기본 surface:
- `main-surface`
- `overlay-surface`
- `floating-surface`

필드:
- `zoneId`
- `zoneType`
- `surfaceId`
- `parentZoneId`
- `discoverySource`

## GNB 전용 구조 모델

### 목표
GNB를 메뉴별로 하나씩 수정하지 않고, `mega-menu`라는 공통 컴포넌트로 정의한다.

### 추출 항목
- `menuLine`
  - 1depth 메뉴 목록
- `panelRoot`
  - 흰 패널 루트
- `depth2Tabs`
  - `TV/오디오`, `PC/모니터` 같은 가로 탭
- `depth3Columns`
  - 실제 하위 컬럼들
- `promoArea`
  - 배너/링크/해시태그

### 필요한 상태
- `rootVisible`
- `activeDepth1`
- `activeDepth2`
- `visibleDepth3Group`

### 현재 missing
- `panelRootVisible` gate
- `depth2Tabs`와 `depth3Columns` 연결 규칙
- 공통 `open-state` 상위 조건

## Compare에서 봐야 할 것

### 1. Route pass/fail
- baseline URL이 맞는가

주의:
- route pass는 시작 조건일 뿐, 최종 통과 기준이 아니다.
- route가 맞아도 zone visual truth가 다르면 fail이다.

### 2. Slot pass/fail
- slot이 존재하는가
- container width/height가 맞는가

### 3. State pass/fail
- 같은 state에서 비교 중인가
- `default`와 `gnb-open`이 섞이지 않았는가

### 4. Group pass/fail
- quickmenu item count
- GNB depth2 tab count
- GNB depth3 column count
- product card count

### 5. Gate pass/fail
- panel root visible
- active tab visible
- active content visible

### 6. Pattern pass/fail
- known componentType로 분류되었는가
- unknown-pattern이 review queue로 들어갔는가

### 7. Replay pass/fail
- 새 rule 적용 후 기존 page/state에도 재적용되었는가
- 기존에 pass였던 항목이 regression 없이 유지되는가

### 8. View truth pass/fail
- screenshot 기준으로 실제 보이는 구성이 맞는가
- rect/group 기준으로 위치와 크기가 맞는가
- DOM은 맞지만 시각이 다르면 fail이다

## 바로 필요한 개선

### 1. GNB Open-State Extractor
원본에서 닫힘 상태와 열린 상태를 비교해, 아래를 추출한다.
- 어떤 노드가 panel root인지
- 어떤 class/attribute가 바뀌는지
- 어떤 tab이 active가 되는지
- 어떤 content group이 visible이 되는지

원칙:
- synthetic hover/click 이후 `openStateValid`를 통과하지 못하면 invalid로 본다
- workbench 비교는 invalid state를 절대 기준값으로 쓰지 않는다

### 2. Quickmenu Layout Grouper
quickmenu는 단순 item count가 아니라 아래를 추출해야 한다.
- 좁은 컨테이너 폭
- row grouping
- icon/text bounds

### 3. PDP Summary Grouper
대표 상세 구조를 slot/group으로 추출한다.
- gallery
- summary
- price box
- option selector
- sticky purchase

### 4. Unknown Pattern Registrar
새 패턴이 발견되면 아래를 자동 생성한다.
- provisional zone
- provisional slot
- unknown-pattern componentType
- review 대상 기록

### 5. Rule Extractor / Replayer
한 번 발견된 차이를 개별 페이지 수정이 아니라 rule로 승격하고,
기존 page/state 전체에 다시 렌더해서 regression 여부를 확인한다.

## 구현 순서

1. `home`
   - `header-top`
   - `header-bottom`
   - `hero`
   - `quickmenu`
   - `gnb-*` states

2. `category-*`
   - tabs
   - filter
   - sort
   - product grid

3. `pdp-*`
   - gallery
   - summary
   - price
   - option
   - sticky CTA

4. `support/care/bestshop/brand`

5. `search/review/qna/sticky/floating`

## 결론
- 지금 필요한 건 더 많은 CSS 보정이 아니다.
- `route -> zone -> surface -> slot -> state -> group -> layout -> gate`를 추출하는 시스템이다.
- 이 구조가 있어야 이후 `captured`, `custom`, `figma-derived`, `LLM-edited`를 같은 slot에서 비교/교체할 수 있다.
- 완성형 목표를 위해 `unknown-pattern`, `rule replay`, `validation replay`, `schema versioning`이 같이 들어가야 한다.
- 그리고 모든 기준의 최종 truth는 DOM source가 아니라 browser-rendered view여야 한다.
