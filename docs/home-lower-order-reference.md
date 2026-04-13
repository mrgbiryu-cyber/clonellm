# Home Lower Order Reference

> 먼저 읽을 기준 문서:
> `docs/project-purpose-reference.md`
>
> 문서 상태:
> 이 문서는 홈 하단 순서와 raw 매핑을 위한 참조 문서다.
> 여기의 `TBD`는 현재 기본값이 아니라, 당시 섹션 source 판단이 미확정이었음을 뜻하는 기록용 표현이다.
> 현재 구현 판단에는 `docs/home-progress-log.md`, `docs/decision-history.md`, `docs/document-placeholder-audit-2026-04-13.md`를 함께 본다.

이 문서는 `quickmenu` 아래 `footer` 전까지의 홈 하단 섹션 순서를

1. 사용자 live visual observation
2. `home.mobile.html`
3. `home.desktop.html`

기준으로 함께 묶어놓은 참조 문서다.

이 문서의 목적은:

- 다음 하단 섹션 작업에서 순서를 다시 잊지 않기
- 사용자 표현과 원문 section/class/data-area를 연결하기
- `mobile-like order`인지 `pc-like order`인지 다시 추측하지 않게 하기

---

## 1. 현재 working order

사용자 live visual observation 기준 working order:

1. `summary banner`
2. `MD's CHOICE`
3. `timedeal`
4. `best-ranking`
5. `homestyle-explore`
6. `space-renewal`
7. `subscription`
8. `brand-showroom`
9. `latest-product-news`
10. `smart-life`
11. `summary banner 2`
12. `missed-benefits`
13. `lg-best-care`
14. `bestshop-guide`
15. `footer`

이 순서는 현재 **temporary working truth**로 사용한다.

주의:
- 최종 canonical truth는 별도 ground truth capture가 필요하다.
- 하지만 현재 구현 진행에서는 이 순서를 기준 순서로 사용한다.

---

## 2. 원문 매핑 결과

### 2.1 mobile raw에서 확인된 section

| 사용자 이름 | mobile title | mobile class | mobile data-area | 판정 |
|---|---|---|---|---|
| `subscription` | `가전 구독` | `HomeMoListTabsBannertype_list_tabs_bannertype__60LWz` | `메인 가전 구독 영역` | mobile raw 확인 |
| `brand-showroom` | `브랜드 쇼룸` | `HomeMoListSquaretypeSmall_list_squaretype__9_wN5` | `메인 브랜드 쇼룸 영역` | mobile raw 확인 |
| `latest-product-news` | `최신 제품 소식` | `HomeMoListSquaretypeBig_list_squaretype_big__wWOd4` | `메인 최신 제품 소식 영역` | mobile raw 확인 |
| `smart-life` | `슬기로운 가전생활` | `HomeMoListVerticaltype_list_verticaltype__txQWx` | `메인 슬기로운 가전생활 영역` | mobile raw 확인 |
| `missed-benefits` | `놓치면 아쉬운 혜택` | `HomeMoListRectangletype_list_rectangle__LVuQv` | `메인 놓치면 아쉬운 혜택 영역` | mobile raw 확인 |
| `lg-best-care` | `LG 베스트 케어` | `HomeMoListVerticaltypeFill_list_verticaltype_fill__3OsbB` | `메인 베스트 케어 영역` | mobile raw 확인 |
| `bestshop-guide` | `베스트샵 이용 안내` | `HomeMoListVerticaltypeBgtype_list_verticaltype_bgtype__DxwUS` | `메인 베스트샵 이용안내 영역` | mobile raw 확인 |
| `space-renewal` | `LG 가전으로 완성하는 공간의 리뉴얼` | `HomeMoListBannertype_list_bannertype__BTzMs` | `메인 추천 상품 영역` | 사용자 의미 이름과 매핑 |
| `timedeal` | `LGE.COM 타임딜` | `HomeMoTimedeal_timedeal__uAwsp` | `메인 타임딜 영역` | mobile raw 확인 |

### 2.2 desktop raw에서 확인된 section

| 사용자 이름 | desktop title | desktop class | desktop data-area | 판정 |
|---|---|---|---|---|
| `subscription` | `가전 구독` | `HomePcListTabsBannertype_list_tabs_bannertype__KDksU` | `메인 가전 구독 영역` | desktop raw 확인 |
| `brand-showroom` | `브랜드 쇼룸` | `HomePcListSquaretype_list_squaretype__8kIvS` | `메인 브랜드 쇼룸 영역` | desktop raw 확인 |
| `latest-product-news` | `최신 제품 소식` | `HomePcListSquaretypeScroll_list_squaretype_scroll__lHu27` | `메인 최신 제품 소식 영역` | desktop raw 확인 |
| `smart-life` | `슬기로운 가전생활` | `HomePcListSquaretype_list_squaretype__8kIvS` | `메인 슬기로운 가전생활 영역` | desktop raw 확인 |
| `missed-benefits` | `놓치면 아쉬운 혜택` | `HomePcListRectangletype_list_rectangle__Vb3FG` | `메인 놓치면 아쉬운 혜택 영역` | desktop raw 확인 |
| `lg-best-care` | `LG 베스트 케어` | `HomePcListBannerRectangletype_list_banner_rectangle__2rqPh` | `메인 베스트 케어 영역` | desktop raw 확인 |
| `bestshop-guide` | `베스트샵 이용 안내` | `HomePcListBannerHorizontype_list_banner_horizon__DY4ZD` | `메인 베스트샵 이용안내 영역` | desktop raw 확인 |
| `space-renewal` | `LG 가전으로 완성하는 공간의 리뉴얼` | `HomePcListBannertype_list_bannertype__WExA2` | `메인 추천 상품 영역` | 사용자 의미 이름과 매핑 |
| `timedeal` | `LGE.COM 타임딜` | `HomePcTimedeal_timedeal__49pl0` | `메인 타임딜 영역` | desktop raw 확인 |

---

## 3. 아직 정확한 raw title로 안 잡히지 않은 항목

아래는 사용자 표현은 있지만, raw title 문자열로는 정확히 안 잡힌다.

1. `summary banner`
2. `best-ranking`
3. `homestyle-explore`
4. `summary banner 2`

현재 해석:

### 3.1 `best-ranking`

- 현재 프로젝트에서는 `custom-renderer`
- raw title 문자열로는 직접 안 잡힘
- runtime/skeleton 성격이 강하다고 본다

### 3.2 `summary banner`, `summary banner 2`

- 사용자가 본 시각 구조 이름
- raw title 문자열보다는 배너형 block/추천형 block일 가능성이 높음
- 실제 구현에서는 exact title보다 위치/형태 기준으로 잡아야 한다
- 현재 raw 매핑:
  - `summary banner` -> `메인 상단 배너 영역` (`HomeMoBannerPromotion_banner_promotion__...`)
  - `summary banner 2` -> `메인 하단 배너 영역` (`HomeMoBannerPromotion_banner_promotion__...`)

### 3.3 `homestyle-explore`

- 사용자가 본 의미 이름
- 현재 raw에서 exact title 문자열로는 미확인
- 현재 가장 유력한 매핑:
  - hero 2번 캠페인 `All New 세일 홈스타일 특가 최대 82% 할인`
  - 또는 `메인 상단 배너 영역` 1번 슬라이드 `한샘, 시몬스, 일룸 등 최대 82% 브랜드 특가`
- 즉 독립 lower section이라기보다 `홈스타일` 캠페인 이름이 시각적으로 읽힌 경우일 가능성이 높다
- 현재 canonical 처리:
  - `independent lower slot`으로 구현하지 않음
  - `home` lower 작업 순서에서도 별도 section 반영 대상으로 취급하지 않음
  - final visual acceptance에서는 `hero/top promotion campaign label` 관점으로만 확인

---

## 4. 현재 판단

지금 기준으로는:

1. `header / GNB / hero`
   - `pc-like`

2. `quickmenu` 이하 하단
   - **순서 기준은 mobile-like**

3. 다만 구현은 섹션마다 다를 수 있다
   - `mobile-derived`
   - `custom-renderer`
   - `per-section verification required`

즉:

- 순서는 mobile-like
- 구현 source는 섹션별로 다르다

---

## 5. 현재 작업 기준

다음 하단 섹션 작업에서는 아래 순서로 판단한다.

1. 사용자 working order 기준 위치 확인
2. 이 문서의 mobile/desktop raw mapping 확인
3. `mobile-derived`로 충분한지 판단
4. 부족하면 `custom-renderer`
5. 항상 `sandbox -> acceptance -> main`

현재 우선순위:

1. `brand-showroom`
2. `latest-product-news`
3. `smart-life`

---

## 6. 섹션 진행 체크 태그

이 섹션은 **실제 작업 히스토리에서 틀렸던 항목들**을 기준으로 만든 체크리스트다.

하단 섹션을 하나 진행할 때마다, 아래 태그를 최소 한 번씩 확인하고 넘어간다.

### 6.1 공통 체크 태그

| 태그 | 의미 | 왜 필요한가 |
|---|---|---|
| `order-check` | 현재 섹션이 live reference 순서에서 맞는 위치에 있는지 | `best-ranking 뒤`처럼 임시 anchor로 가다 순서가 흔들린 적이 있음 |
| `anchor-check` | 삽입 anchor가 실제 앞/뒤 섹션 기준으로 맞는지 | raw skeleton anchor와 live 순서가 엇갈린 적이 있음 |
| `source-check` | `mobile-derived / custom-renderer / per-section verification required` 판정이 맞는지 | `pc raw`와 `mo raw`가 섞여 계속 흔들렸음 |
| `slot-check` | `data-codex-slot`, `data-codex-source`가 정확히 붙는지 | 나중에 LLM이 slot/source 기준으로 수정해야 함 |
| `single-instance-check` | 섹션이 중복 삽입되지 않았는지 | sandbox/main 전환 때 같은 섹션이 두 번 나온 적이 있음 |
| `footer-leak-check` | footer 아래 hidden chunk/S:* 조각이 새어나오지 않는지 | 홈 하단에서 실제로 크게 실패했던 항목 |
| `link-check` | 링크가 live reference 의도와 clone routing 정책에 맞는지 | 홈 완료 후 각 화면 연결의 출발점이 됨 |

### 6.2 시각/레이아웃 체크 태그

| 태그 | 의미 | 실제 히스토리 |
|---|---|---|
| `width-check` | 섹션 전체 폭이 앞뒤 섹션과 자연스럽게 이어지는지 | `best-ranking`과 하단 섹션들에서 폭이 과하게 커졌음 |
| `gap-check` | 제목, 서브타이틀, 카드 간격이 live와 크게 다르지 않은지 | 제목만 맞고 리듬이 깨진 경우가 많았음 |
| `title-rhythm-check` | 제목/서브타이틀 위치와 baseline이 맞는지 | `best-ranking`, `GNB`, `banner-panel`에서 반복적으로 틀림 |
| `card-size-check` | 카드 높이/너비/행 구성이 live와 크게 다르지 않은지 | `timedeal`, `best-ranking`, `brand-showroom`에서 필요했음 |
| `image-fit-check` | 제품 이미지가 영역에 맞게 들어오는지 (`contain/cover`, padding 포함) | `timedeal`, `latest-product-news`에서 실제로 틀렸음 |
| `background-layer-check` | 이미지 뒤 보조 배경판/톤이 빠지지 않았는지 | `latest-product-news`에서 사용자가 직접 지적 |
| `text-color-check` | 제목/서브텍스트/가격 색이 원문과 크게 다르지 않은지 | `best-ranking`에서 가격/서브텍스트 색을 따로 맞췄음 |
| `badge-check` | 배지/칩의 위치, 색, 외곽선, 케이스가 맞는지 | `best-ranking`에서 여러 번 조정함 |
| `rank-check` | 랭킹 번호/아이콘 위치와 종류가 맞는지 | `best-ranking`에서 숫자/이미지/색상 여러 번 실패 |

### 6.3 자산/데이터 체크 태그

| 태그 | 의미 | 실제 히스토리 |
|---|---|---|
| `asset-path-check` | 상대경로가 아니라 실제 보여야 하는 절대경로/올바른 자산 필드를 쓰는지 | 이미지 `src=\"\"`, 잘못된 `medium01`, share-default 이슈가 있었음 |
| `template-injection-check` | template placeholder에 실제 이미지가 주입됐는지 | `brand-showroom`, `latest-product-news`, `smart-life`에서 필요 |
| `product-data-check` | 상품명/모델명/가격/태그가 실제 데이터로 채워졌는지 | `best-ranking`, `timedeal`에서 blank/fallback이 발생했음 |
| `count-check` | 카드 수/탭 수/아이템 수가 기대 범위와 맞는지 | `timedeal` 2카드, `best-ranking` 4건처럼 수량이 핵심인 섹션이 있었음 |

### 6.4 상태/회귀 체크 태그

| 태그 | 의미 | 실제 히스토리 |
|---|---|---|
| `accepted-main-regression-check` | 이미 맞춘 상단~`best-ranking` 구간이 깨지지 않았는지 | 하단 실험 중 메인 기준선이 흔들린 적이 있음 |
| `sandbox-scope-check` | sandbox에서만 바뀌어야 할 게 메인에 번지지 않았는지 | `homeVariant`, `homeSandbox` 분기에서 실제 문제 있었음 |
| `cache-check` | 캐시 때문에 이전 화면이 보이는지 아닌지 확인했는지 | `no-store`를 따로 넣어야 했던 이력이 있음 |
| `server-check` | 서버가 실제 최신 코드로 떠 있는지 | 포트 점유/떨어짐/이전 프로세스 이슈가 반복됨 |

---

## 7. 섹션별 최소 체크셋

모든 태그를 매번 다 보는 대신, 섹션 타입에 따라 아래 최소 체크셋을 먼저 통과시킨다.

### 7.1 `mobile-derived` 기본형

대상:

- `brand-showroom`
- `latest-product-news`
- `smart-life`
- `missed-benefits`
- `lg-best-care`
- `bestshop-guide`

최소 체크:

1. `order-check`
2. `anchor-check`
3. `source-check`
4. `width-check`
5. `image-fit-check`
6. `asset-path-check`
7. `template-injection-check`
8. `accepted-main-regression-check`

### 7.2 `custom-renderer` 특수형

대상:

- `best-ranking`
- 향후 raw import가 안 맞는 섹션

최소 체크:

1. `order-check`
2. `anchor-check`
3. `slot-check`
4. `width-check`
5. `title-rhythm-check`
6. `card-size-check`
7. `badge-check`
8. `rank-check`
9. `text-color-check`
10. `product-data-check`
11. `accepted-main-regression-check`

### 7.3 배너/정보형

대상:

- `summary banner`
- `summary banner 2`
- `space-renewal`
- `homestyle-explore`

최소 체크:

1. `order-check`
2. `anchor-check`
3. `width-check`
4. `title-rhythm-check`
5. `background-layer-check`
6. `link-check`
7. `accepted-main-regression-check`

---

## 8. 현재 작업에 바로 적용할 체크 지점

### 8.1 `brand-showroom`

우선 체크:

1. `order-check`
2. `width-check`
3. `template-injection-check`
4. `asset-path-check`
5. `accepted-main-regression-check`

### 8.2 `latest-product-news`

우선 체크:

1. `order-check`
2. `width-check`
3. `asset-path-check`
4. `image-fit-check`
5. `background-layer-check`
6. `accepted-main-regression-check`

### 8.3 `smart-life`

우선 체크:

1. `order-check`
2. `width-check`
3. `template-injection-check`
4. `asset-path-check`
5. `accepted-main-regression-check`

---

## 9. 연결 문서

1. `docs/project-purpose-reference.md`
2. `docs/project-consolidated-status.md`
3. `docs/home-progress-log.md`
