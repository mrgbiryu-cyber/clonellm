# Home Top Asset Spec

대상:
- `home`
- top-stage (`hero`, `quickmenu`)

이 문서는 현재 실제로 문제를 일으킨 top-stage 자산에 대한 최소 spec 표본이다.

---

## hero-main

- `assetId`: `hero-main`
- `source`: `Home_Hero_PC_1760x500_20260331_153421.png`
- `role`: `promo-complete`
- `styleSummary`: `warm living-room promo banner with embedded sale headline and red deal callouts`
- `containsText`: `true`
- `textDensity`: `high`
- `visualTone`: `promo-red`
- `recommendedUse`: `현재 프로모션을 그대로 보여주는 완성 hero 배너로만 사용`
- `restrictedUse`: `새로운 hero headline/support/cta를 다시 얹는 배경으로 사용 금지`
- `notes`: `현재 authored hero와 카피 충돌을 일으킨 핵심 자산`

## hero-image-1

- `assetId`: `hero-image-1`
- `source`: `08r_20260413_162516.png`
- `role`: `promo-complete`
- `styleSummary`: `small homestyle promo badge/label asset`
- `containsText`: `true`
- `textDensity`: `medium`
- `visualTone`: `brand-accent`
- `recommendedUse`: `동일 프로모션의 보조 배지/라벨`
- `restrictedUse`: `독립 오브젝트 컷으로 재배치 금지`
- `notes`: `background/object-only로 사용하면 의미 충돌 가능`

## hero-image-2

- `assetId`: `hero-image-2`
- `source`: `homemain_hero_pc_260413_20260413_162516.png`
- `role`: `object-only`
- `styleSummary`: `brown leather sofa on neutral background`
- `containsText`: `false`
- `textDensity`: `none`
- `visualTone`: `warm-neutral`
- `recommendedUse`: `homestyle/editorial hero의 object-only foreground candidate`
- `restrictedUse`: `아이콘, quickmenu thumbnail로 사용 금지`
- `notes`: `현재 hero 군 자산 중 상대적으로 재사용 안전도가 높음`

## hero-image-3

- `assetId`: `hero-image-3`
- `source`: `04r_20260306_173744.png`
- `role`: `promo-complete`
- `styleSummary`: `campaign badge for special exhibition`
- `containsText`: `true`
- `textDensity`: `medium`
- `visualTone`: `promo-red`
- `recommendedUse`: `같은 프로모션 맥락의 보조 badge`
- `restrictedUse`: `독립적인 hero visual 요소로 사용 금지`
- `notes`: `보조 라벨 성격`

## hero-image-4

- `assetId`: `hero-image-4`
- `source`: `PC_20260306_185815.jpg`
- `role`: `promo-complete`
- `styleSummary`: `air-purifier sale banner with product and embedded campaign context`
- `containsText`: `false`
- `textDensity`: `low`
- `visualTone`: `clean-promo`
- `recommendedUse`: `동일 캠페인 hero 완성 자산 내부`
- `restrictedUse`: `새로운 copy over background용으로 사용 금지`
- `notes`: `텍스트는 적지만 프로모션 문맥이 강함`

## hero-image-5

- `assetId`: `hero-image-5`
- `source`: `가전구독r_20260206_135125.png`
- `role`: `promo-complete`
- `styleSummary`: `subscription promo badge asset`
- `containsText`: `true`
- `textDensity`: `medium`
- `visualTone`: `promo-red`
- `recommendedUse`: `가전 구독 프로모션 맥락 보조 요소`
- `restrictedUse`: `새 hero 메시지의 일반 decorative asset처럼 사용 금지`
- `notes`: `현재 hero에서 혼합 사용 시 문맥 혼선 발생 가능`

---

## quickmenu-main

- `assetId`: `quickmenu-main`
- `source`: `PC_20260408_142048.gif`
- `role`: `promo-complete`
- `styleSummary`: `subscription days promo thumbnail with embedded typography`
- `containsText`: `true`
- `textDensity`: `high`
- `visualTone`: `soft-promo`
- `recommendedUse`: `현재 구독 Days 프로모션을 그대로 보여주는 썸네일`
- `restrictedUse`: `generic icon-only asset로 사용 금지`
- `notes`: `quickmenu가 icon system처럼 보이지 않는 핵심 원인`

## quickmenu-image-1

- `assetId`: `quickmenu-image-1`
- `source`: `혜택이벤트_20251120_133323.png`
- `role`: `promo-complete`
- `styleSummary`: `gift/event promotional thumbnail`
- `containsText`: `false`
- `textDensity`: `low`
- `visualTone`: `promo-soft`
- `recommendedUse`: `혜택/이벤트 프로모션 썸네일`
- `restrictedUse`: `icon-only asset로 사용 금지`
- `notes`: `gift 아이콘처럼 보이지만 role은 promo-complete로 본다`

## quickmenu-image-2

- `assetId`: `quickmenu-image-2`
- `source`: `다품목할인_20251120_133343.png`
- `role`: `promo-complete`
- `styleSummary`: `shopping-bag discount promotional thumbnail`
- `containsText`: `false`
- `textDensity`: `low`
- `visualTone`: `promo-soft`
- `recommendedUse`: `다품목 할인 프로모션 썸네일`
- `restrictedUse`: `generic icon-only asset로 사용 금지`
- `notes`: `icon처럼 축소하면 품질이 어색함`

## quickmenu-image-3

- `assetId`: `quickmenu-image-3`
- `source`: `라이브_20251120_133405.png`
- `role`: `promo-complete`
- `styleSummary`: `live promo thumbnail`
- `containsText`: `false`
- `textDensity`: `low`
- `visualTone`: `promo-soft`
- `recommendedUse`: `라이브 프로모션 썸네일`
- `restrictedUse`: `generic icon-only asset로 사용 금지`
- `notes`: `role mismatch 시 아이콘 체계가 무너짐`

## quickmenu-image-4

- `assetId`: `quickmenu-image-4`
- `source`: `카드혜택_20251120_133423.png`
- `role`: `promo-complete`
- `styleSummary`: `card benefit promotional thumbnail`
- `containsText`: `false`
- `textDensity`: `low`
- `visualTone`: `promo-soft`
- `recommendedUse`: `카드혜택 프로모션 썸네일`
- `restrictedUse`: `generic icon-only asset로 사용 금지`
- `notes`: `icon-only 대체 자산 필요`

## quickmenu-image-5

- `assetId`: `quickmenu-image-5`
- `source`: `가전구독_20250826_165534.png`
- `role`: `promo-complete`
- `styleSummary`: `subscription promotional thumbnail`
- `containsText`: `false`
- `textDensity`: `low`
- `visualTone`: `promo-soft`
- `recommendedUse`: `가전 구독 프로모션 썸네일`
- `restrictedUse`: `generic icon-only asset로 사용 금지`
- `notes`: `현재 quickmenu role과 충돌`

---

## top-stage 결론

### 현재 허용 가능한 자산

- `hero-image-2`
  - 상대적으로 `object-only`에 가까움

### 현재 금지해야 하는 자산 사용

- `hero-main` 위에 새로운 hero headline/CTA 재오버레이
- `quickmenu-*` 자산을 icon-only로 사용하는 것

### 현재 필요한 대체 공급

1. `hero`
- `background-only`
- `object-only`

2. `quickmenu`
- `icon-only`

## 다음 단계

1. quickmenu용 icon-only 최소 세트 확보
2. hero용 text-free background 또는 object-only 후보 분리
3. 이후 image generation 모듈은 `background-only/object-only` 보강용으로만 검토

---

## quickmenu icon-only 후보 감사

현재 raw asset을 실제 SVG 내용까지 열어본 결과, `아이콘처럼 보이는 파일이 있다`와 `quickmenu에 바로 쓸 수 있는 icon-only 패밀리가 있다`는 다르다.

### 기존 raw asset에서 확인된 후보

- `home__0e543daa3aa8__047.svg`
  - YouTube형 재생 버튼/비디오 프레임
  - `icon-only` 형식은 맞지만 quickmenu 8종 공통 패밀리로는 부적합
- `home__0e543daa3aa8__048.svg`
  - Instagram형 카메라 outline
  - `icon-only` 형식은 맞지만 quickmenu 카테고리 체계와 무관
- `home__0e543daa3aa8__049.svg`
  - Facebook형 로고 outline
  - `icon-only` 형식은 맞지만 quickmenu용 아님
- `home__0e543daa3aa8__050.svg`
  - News/brand type이 섞인 복합 아이콘
  - 순수 `icon-only`라기보다 의미가 고정된 브랜드/뉴스 로고
- `home__0e543daa3aa8__051.svg`
  - 말풍선형/브랜드 혼합 아이콘
  - 단독 아이콘으로는 가능하지만 패밀리 일관성 부족
- `home__0e543daa3aa8__052.svg`
  - b 형태 브랜드/기능 아이콘
  - 시각 언어는 맞지만 quickmenu 전용 세트로 보기 어려움

### 지원/기타 페이지 SVG 확인 결과

- `support__6a063c9bf960__001.svg`
  - 단순 close/X 아이콘
  - UI control icon이지 quickmenu navigation icon 아님
- `support__6a063c9bf960__043.svg`
  - 프로모션 완성 배너 성격
  - `promo-complete`
- `support__6a063c9bf960__044.svg`, `045.svg`, `046.svg`
  - 로고/워드마크 계열
  - `icon-only`가 아니라 brand mark

### 판단

- 기존 raw asset 안에 `SVG`는 있다.
- 하지만 현재 quickmenu에 필요한 것은 단일 SVG 몇 개가 아니라:
  - 선 두께
  - 코너 라운드
  - 채움/비채움 방식
  - 28x28 또는 32x32 기준 박스
  - 시각 무게
가 일관된 `icon-only family`다.
- 현재 발견된 SVG들은 대부분
  - 로고
  - SNS
  - UI control
  - 프로모션 완성 자산
에 가깝다.

### 결론

- `기존 raw asset 재사용만으로 quickmenu icon-only 세트를 해결하기는 어렵다.`
- 즉 다음 공급 전략은 아래 둘 중 하나다.
  1. quickmenu 전용 `icon-only family`를 새로 만든다
  2. 이미 존재하는 일관된 icon family를 외부/reference에서 가져와 role spec에 맞게 등록한다

### 최소 필요한 quickmenu icon 대상

- `구독 Days`
- `혜택/이벤트`
- `웨딩&이사`
- `다품목 할인`
- `라이브`
- `카드혜택`
- `가전 구독`
- `소모품`
- `SALE 홈스타일`
