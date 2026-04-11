# Execution Checklist

> 먼저 읽을 기준 문서:
> `docs/project-purpose-reference.md`

## 목적
- baseline이 흔들리지 않게 현재 기준을 고정한다.
- 다음 구현 순서를 페이지군/slot/state 기준으로 정리한다.
- 비어 있는 공란과 미구현 항목을 먼저 식별한다.
- 이 프로젝트의 기준은 DOM이 아니라 고객이 실제 브라우저에서 보는 `view truth`임을 고정한다.

## 0. 고정 원칙

### 0.1 baseline URL 규칙
- `home` -> 단일 URL 규칙이 아니라 `hybrid baseline`
  - `header-zone`, `hero-zone` -> desktop-like visual truth
  - `content-zone` -> mobile-like visual truth
- `category-*` -> `https://www.lge.co.kr/m/category/*`
- 그 외 (`support`, `bestshop`, `care-solutions` 등) -> 기본 경로 유지

주의:
- URL/HTML만으로 baseline을 확정하지 않는다.
- 실제 baseline은 `Chrome + CDP + screenshot + measured rect`로 판정한다.
- route resolver는 보조 정보이고, 최종 truth는 브라우저 view다.
- 구현은 단일 responsive renderer를 먼저 만들지 않는다.
- `pc`와 `mo`는 별도 source set으로 관리한다.
- `hybrid`는 resolver용이고 실제 source는 `pc` 또는 `mo` variant를 쓴다.

### 0.2 라우팅 규칙
- working clone에서는 외부 `lge.co.kr`로 직접 나가면 안 된다.
- 모든 링크는 내부 `/clone/...` 또는 fallback/toast로 처리한다.

### 0.3 구조 원칙
- `reference/captured layer`
- `working layer`
- `slot/component layer`
를 분리한다.

### 0.4 view truth 원칙
- HTML/console parsing은 보조 수단이다.
- 최종 비교 기준은 항상:
  1. Chrome에서 실제 열린 상태
  2. screenshot
  3. measured rect / visual group
이다.
- 즉 extractor는 DOM truth가 아니라 `browser-rendered truth`를 뽑아야 한다.

### 0.5 수정 원칙
- LLM은 raw DOM을 수정하지 않는다.
- `slot/component state`만 수정한다.

---

## 1. baseline 대상 범위

### 1.0 page-group / required-state matrix
- `home`
  - 필수 상태: `default`, `gnb-*`, `hero-slide-*`
  - 기준: hybrid view truth
- `category / PLP`
  - 필수 상태: `default`, `filter-open`, `sort-open`, `tab-selected`
- `search`
  - 필수 상태: `search-open`, `suggest-open`, `result-default`, `filter-open`
- `PDP`
  - 필수 상태: `default`, `gallery-change`, `option-selected`, `price-changed`, `sticky-visible`
- `support`
  - 필수 상태: `default`, `tab-open`, `accordion-open`
- `bestshop`
  - 필수 상태: `default`, `tab-open`
- `care-solutions`
  - 필수 상태: `default`, `cta-focus`
- `brand / story`
  - 필수 상태: `default`, `hero-slide-*`, `tab-open`

추가 원칙:
- page-group은 `pc + mo`를 같은 구현 단위로 본다.
- 하나의 page-group을 닫을 때:
  - `pc baseline`
  - `mo baseline`
  - `pc fitting`
  - `mo fitting`
을 모두 끝내야 다음 page-group으로 간다.

### 1.1 Home
- `hybrid home`
- 상세 remediation 기준은 `docs/home-remediation-plan.md`를 따른다.
- 상태 기준은 route보다 `zone별 view truth`를 우선
- 상태:
  - `default`
  - GNB open states
  - hero active states

### 1.2 Category
- 대표:
  - `category-tvs`
  - `category-refrigerators`
- 상태:
  - `default`
  - filter open
  - sort open/change
  - category tab switch

### 1.3 PDP
- 원칙: SKU별이 아니라 `카테고리별 대표 상세 템플릿`
- 상태:
  - gallery change
  - option change
  - purchase type change
  - price change
  - sticky CTA

### 1.4 Other
- `support`
- `bestshop`
- `care-solutions`
- 브랜드/스토리 대표 페이지

### 1.5 대표 URL 선정 규칙
- 대표 샘플 URL은 수동 목록보다 `자동 추출`을 우선한다.
- PLP:
  - 카테고리 진입 후 첫 줄 상품 전부를 대표 샘플로 잡는다.
- PDP:
  - 각 카테고리 PLP 첫 줄의 상품 전부를 대표 상세 샘플로 잡는다.
- 사용자는 자동 추출 결과에서 누락/우선순위만 확인한다.

---

## 2. slot 기준

### 2.1 Home 필수 slot
- `header-top`
- `header-bottom`
- `hero`
- `quickmenu`
- `first-content-block`
- `timedeal`
- `md-choice`

### 2.2 Category 필수 slot
- `header-top`
- `header-bottom`
- `category-tabs`
- `filter-bar`
- `sort-bar`
- `product-grid`
- `category-banner`

### 2.3 PDP 필수 slot
- `header-top`
- `header-bottom`
- `product-gallery`
- `product-summary`
- `price-box`
- `option-selector`
- `sticky-purchase`

---

## 3. interaction inventory

### 3.1 Home
- `gnb-product-open`
- `gnb-care-open`
- `gnb-support-open`
- `gnb-benefits-open`
- `gnb-story-open`
- `gnb-bestshop-open`
- `gnb-lgai-open`
- `hero-slide-1`
- `hero-slide-2`
- `hero-slide-3`

### 3.2 Category
- `category-tab-switch`
- `filter-open`
- `filter-chip-selected`
- `filter-reset`
- `sort-open`
- `sort-option-changed`
- `product-card-hover`

### 3.3 PDP
- `gallery-thumb-change`
- `color-option-changed`
- `capacity-option-changed`
- `purchase-type-changed`
- `price-default`
- `price-after-option-change`
- `price-after-purchase-type-change`
- `sticky-cta-visible`
- `compare-toggle`
- `wishlist-toggle`

---

## 4. data / storage checklist

### 4.1 baseline / reference
- [x] page별 baseline URL resolver 고정
- [ ] `pc` baseline screenshot 저장
- [ ] `mo` baseline screenshot 저장
- [ ] live visual baseline screenshot 저장
- [ ] state별 baseline screenshot 저장
- [ ] zone별 baseline screenshot 저장
- [ ] zone별 rect / group metadata 저장
- [x] reference slot snapshot 저장
- [x] reference interaction snapshot 저장

### 4.2 working
- [ ] working clone route 유지
- [ ] internal-only routing 유지
- [ ] `pc` working screenshot 저장
- [ ] `mo` working screenshot 저장
- [ ] shell measurement 저장
- [ ] clone-content measurement 저장

### 4.3 coverage
- [x] `pageStatus`
- [x] `slot status`
- [x] `state status`
- [x] `interaction coverage`
- [ ] `page group coverage summary`
- [ ] `validation severity summary`

---

## 5. visual alignment checklist

### 5.1 측정 기준
- [x] compare canvas 고정
- [x] live screenshot baseline
- [x] slot measurement
- [ ] group measurement
- [ ] zone measurement
- [ ] `pc/mo` 별도 validation
- [ ] slot layout v3
  - `containerWidth`
  - `containerHeight`
  - `x/y`
  - `itemRects`
  - `rowGroups`
  - `gap`
  - `padding`

### 5.2 home
- [ ] `header-top` desktop-like visual baseline 정렬
- [ ] `header-bottom` desktop-like visual baseline 정렬
- [ ] `hero` desktop-like visual baseline 정렬
- [ ] `quickmenu` mobile-like visual baseline 정렬
- [ ] `quickmenu 이하 공통 좁은 폭` 규칙 정렬

### 5.3 category
- [ ] category tabs 정렬
- [ ] filter/sort bar 정렬
- [ ] product grid 정렬

### 5.4 pdp
- [ ] gallery 정렬
- [ ] summary/price 영역 정렬
- [ ] sticky CTA 정렬

---

## 6. clone / shell checklist

### 6.1 shell
- [ ] baseline route 배지 또는 상태 표시
- [x] internal link interception
- [x] clone iframe 유지
- [x] coverage 표시

### 6.2 shell GNB
- [ ] hybrid home 기준 실제 GNB 구조 재정의
- [ ] 메뉴별 drawer/panel open 방식 고정
- [ ] panel close policy 안정화
- [ ] 메뉴별 panel content baseline 확보

---

## 7. component replacement checklist

### 7.1 slot model
- [ ] `source: captured | figma-derived | custom`
- [ ] `viewportProfile: pc | mo`
- [ ] `activeSourceId`
- [ ] `variantIds`
- [ ] `visible`
- [ ] `order`
- [ ] `layout`
- [ ] `props`
- [ ] `approvalStatus`
- [ ] `createdFrom`

### 7.2 replacement UI
- [ ] slot별 현재 source 표시
- [ ] captured -> figma-derived 교체
- [ ] captured -> custom 교체
- [ ] before / after 비교

---

## 8. LLM checklist

### 8.1 현재 상태
- [x] OpenRouter env 연결 골격
- [x] 기본 LLM request endpoint
- [ ] 실제 slot state editor 연결
- [ ] URL-driven reference intake
- [ ] natural-language-only intake
- [ ] workbench selection intake
- [ ] `plan / patch / report` output contract

### 8.2 LLM 수정 대상
- [ ] text
- [ ] order
- [ ] visible
- [ ] layout props
- [ ] interaction props
- [ ] component variant 생성
- [ ] source switch (`captured` 제외)
- [ ] token patch
- [ ] scoped CSS patch

### 8.3 LLM 적용 규칙
- [ ] captured baseline direct edit 금지
- [ ] custom / figma-derived variant만 수정 가능
- [ ] `viewportProfile: pc | mo` 필수
- [ ] global arbitrary CSS 금지
- [ ] approval before apply
- [ ] replay after apply

### 8.4 LLM report
- [ ] 변경 요약 생성
- [ ] 구성 사유 생성
- [ ] reference 근거 기록
- [ ] 영향 slot / rule 기록
- [ ] replay 결과 기록

---

## 8.5 Minimal Auth / Workspace checklist

- [ ] 최소 로그인 화면
- [ ] 세션 유지
- [ ] `shared default`와 `user workspace` 분리
- [ ] 계정별 작업 이력 저장
- [ ] 계정별 LLM 사용량 저장
- [ ] 새 계정은 공용 default 화면으로 시작
- [ ] 복잡한 권한 체계는 아직 도입하지 않음

---

## 9. 현재 비어 있는 공란

### 9.1 가장 큰 공란
1. category mobile baseline 수집 없음
2. PDP 템플릿 baseline 정의 없음
3. page group coverage summary 없음

### 9.2 구조상 불안정한 부분
1. shell GNB는 아직 browser-rendered truth보다 공통 renderer 보정이 우선돼 있음
2. quickmenu 이하 공통 폭 규칙이 visual baseline 수준으로 수치화되지 않음
3. home은 hybrid인데 문서/작업 일부가 아직 단일 mobile 기준처럼 남아 있음

### 9.3 수집 범위 공란
1. category 대표 페이지 2개만 목표로 잡혔고 아직 baseline 확보 안 됨
2. PDP 템플릿 목록이 아직 정의되지 않음
3. support/bestshop/care page baseline state가 아직 없음

### 9.4 운영 규칙 공란
1. 새 rule 발견 시 replay 대상 범위가 아직 자동화되지 않음
2. validation severity 집계가 없음
3. group 단위 visual diff가 아직 부족함
4. unknown-pattern review queue가 아직 UI/저장 기준으로 닫히지 않음
5. `pc/mo` cross-viewport replay 기준이 아직 구현되지 않음

---

## 10. 다음 순서

### Phase 1
- [ ] `home` hybrid slot snapshot 정리
- [ ] `home` hybrid interaction snapshot 정리
- [ ] `home` coverage를 hybrid 기준으로 `captured`로 유지/검증
- [ ] `home / pc + mo` 동시 validation

### Phase 2
- [ ] `home` visual alignment
  - `header-top`
  - `header-bottom`
  - `hero`
  - `quickmenu`

### Phase 3
- [ ] `category-tvs`
- [ ] `category-refrigerators`
baseline + slot + interaction + visual alignment
- [ ] 각 category는 `pc + mo`를 함께 완료

### Phase 4
- [ ] 카테고리별 PDP 대표 템플릿 정의
- [ ] PDP baseline + interaction 수집
- [ ] PDP도 `pc + mo`를 함께 완료

### Phase 5
- [ ] support / bestshop / care-solutions / brand representative baseline

### Phase 6
- [ ] slot replacement
- [ ] Figma-derived source
- [ ] LLM slot-state editing

---

## 11. validation severity

- `blocker`
  - open-state invalid
  - wrong baseline route / zone
  - panel root missing
  - broken interaction
- `warning`
  - container width mismatch
  - padding / spacing mismatch
  - wrong group alignment
- `cosmetic`
  - color / font-weight / icon nuance mismatch

원칙:
- `blocker`가 하나라도 있으면 다음 page-group으로 넘어가지 않음
- `warning`은 replay에서 감소 추세여야 함
- `cosmetic`은 Figma/LLM 전 단계에서 누적 가능

### 11.1 시작 허용 오차
- 이 프로젝트의 최종 기준은 screenshot 완전 매칭이다.
- 다만 자동 판정 시작값은 아래처럼 고정한다.
  - `blocker > 4px`
  - `warning 2px ~ 4px`
  - `cosmetic <= 2px`
- 동일 viewport/canvas 비교에서는 `px`를 우선 기준으로 사용한다.

---

## 12. replay contract

### 12.1 새 rule 추가 시 기본 replay 범위
- `home / pc`
  - `default`
  - `gnb-product-open`
  - `gnb-support-open`
- `home / mo`
  - `default`
  - `quickmenu-default`
- `category / pc`
  - 대표 2개
  - `default`, `filter-open`, `sort-open`
- `category / mo`
  - 대표 2개
  - `default`, `filter-open`, `sort-open`
- `PDP / pc`
  - 대표 템플릿 전부
  - `default`, `option-selected`, `price-changed`
- `PDP / mo`
  - 대표 템플릿 전부
  - `default`, `option-selected`, `price-changed`
- `support / pc`
  - `default`, `tab-open`
- `support / mo`
  - `default`, `tab-open`

### 12.2 replay 통과 기준
- `blocker = 0`
- 기존 pass 항목 regression 없음
- 새 rule 대상 항목 fail 감소 확인

### 12.3 replay 실패 시
- rule을 provisional로 되돌림
- 영향받는 page / zone / slot / state를 기록
- 개별 CSS hotfix 금지

---

## 13. 진행 전 체크
- [ ] 기준 baseline URL이 페이지별 resolver와 일치하는가
- [ ] live screenshot baseline이 현재 실제 화면과 같은가
- [ ] reference slot snapshot이 baseline URL과 같은 DOM 기준인가
- [ ] working clone이 internal-only routing을 유지하는가
- [ ] coverage status가 실제 상태를 과장하지 않는가
