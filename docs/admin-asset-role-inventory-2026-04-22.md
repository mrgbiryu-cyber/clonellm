# Asset Role Inventory

## 목적

이 문서는 `자산을 많이 모으는 것`이 아니라, 현재 이미 가지고 있는 입력을 `어떤 역할로만 써야 하는지`를 정리하기 위한 문서다.

핵심 원칙:

- 자산 라이브러리가 본선이 아니다.
- 자산의 `role`과 `사용 금지 규칙`이 본선이다.
- 완성 프로모션 배너를 다른 역할로 재사용하면 디자인 품질이 급격히 무너진다.
- 역할이 맞지 않는 자산은 “있지만 쓰지 않는 것”이 맞다.

## 현재 이미 있는 입력

현재 시스템에는 이미 아래 입력이 있다.

1. 요구사항 / 컨셉 Markdown
- `builderMarkdown`
- `designSpecMarkdown`
- 사용자 요구사항 원문

2. 레퍼런스 입력
- 사용자 입력 `referenceUrls`
- 내부 `data/reference-live`
- 내부 `data/reference-samples`
- 내부 `data/design-md`

3. 클론 기반 원본 입력
- 현재 페이지 shell HTML
- current section HTML
- current text outline
- current page asset map

4. runtime에서 실제 확인 가능한 자산
- `/asset-proxy?...`
- `renderedHtmlReference.afterHtml`
- draft report의 `resolvedAssets`

## Role taxonomy

현재 자산은 아래 role로만 분류한다.

### 1. background-only

정의:
- 텍스트를 다시 얹어도 되는 배경 컷
- 제품/공간/오브젝트 중심
- 기존 카피가 시각 중심을 장악하지 않는 자산

허용:
- hero 배경
- section background
- editorial backdrop

금지:
- 이미 headline/가격/혜택 문구가 강하게 들어간 자산

### 2. object-only

정의:
- 배경 위에 다시 배치 가능한 제품 컷/오브젝트 컷
- 소파, TV, 냉장고, 오브젝트 묶음 등

허용:
- hero foreground
- editorial collage
- supporting visual

금지:
- 이미 프로모션 문맥이 고정된 완성 배너 일부

### 3. icon-only

정의:
- quickmenu, service-entry, feature-grid에 넣을 수 있는 아이콘
- 텍스트 없이 역할만 전달하는 시각 요소

허용:
- line icon
- glyph
- simple badge
- monochrome / dual-tone icon

금지:
- 프로모션 썸네일
- 텍스트가 포함된 작은 배너
- 카피가 자산 안에 박힌 이미지

### 4. reference-only

정의:
- 직접 렌더 자산으로 쓰지 않고, 시각 방향 참고로만 쓰는 입력

예:
- full-page screenshot
- section crop
- competitor/banner reference
- design md example

### 5. promo-complete

정의:
- 이미 카피, 혜택 문구, 배지, 장식 요소가 완성된 프로모션 자산

규칙:
- `재오버레이 금지`
- `icon 대체 사용 금지`
- `background-only로 오인 사용 금지`

허용:
- 같은 문맥, 같은 역할, 같은 메시지에서 “그대로 보여주는 경우”만

## 현재 home top-stage 기준 분류

아래는 현재 `runtime-draft-1776869834964` 기준으로 실제 확인된 자산의 1차 분류다.

### hero

#### hero-main
- source:
  - `Home_Hero_PC_1760x500_20260331_153421.png`
- 현재 상태:
  - 이미지 안에 이미 `All New 세일` 같은 강한 프로모션 카피가 포함됨
- 판정:
  - `promo-complete`
- 결론:
  - 현재처럼 새로운 headline을 다시 얹는 방식은 금지하는 것이 맞다
  - role을 유지한 “그대로 사용”이 아니면 재사용하지 않는다

### quickmenu

#### quickmenu-main
- source:
  - `PC_20260408_142048.gif`
- 관찰:
  - `구독 Days`처럼 이미 문맥이 들어간 시각 자산
- 판정:
  - `promo-complete` 또는 최대 `restricted icon-like`
- 결론:
  - 진짜 icon-only로 보기 어렵다

#### quickmenu-image-1
- source:
  - `혜택이벤트_20251120_133323.png`
- 판정:
  - `promo-complete`

#### quickmenu-image-2
- source:
  - `다품목할인_20251120_133343.png`
- 판정:
  - `promo-complete`

#### quickmenu-image-3
- source:
  - `라이브_20251120_133405.png`
- 판정:
  - `promo-complete`

#### quickmenu-image-4
- source:
  - `카드혜택_20251120_133423.png`
- 판정:
  - `promo-complete`

#### quickmenu-image-5
- source:
  - `가전구독_20250826_165534.png`
- 판정:
  - `promo-complete`

### 현재 quickmenu 결론

현재 quickmenu에 들어간 자산들은 대부분 `icon-only`가 아니다.

즉:
- quickmenu용 아이콘으로 재사용하면 안 된다
- 현재처럼 텍스트 아래 원형/정사각 아이콘처럼 쓰면 품질이 어색해지는 게 정상이다

## 지금 바로 자산화할 수 있는 것

대규모 라이브러리 구축 전에, 아래만 먼저 만들면 된다.

### 1. reference-only 세트
- 레퍼런스 URL full screenshot
- target section crop
- 같은 역할의 우수 사례 crop

목적:
- Author input의 시각 방향 참고

### 2. restricted asset registry
- `promo-complete` 목록
- 재오버레이 금지 목록

목적:
- 잘못된 재사용 차단

### 3. icon-only 최소 세트
- quickmenu 전용 line/glyph icon
- 텍스트 없는 SVG/PNG

목적:
- 현재 quickmenu의 가장 큰 품질 문제 해결

### 4. background-only 후보 세트
- 텍스트가 없는 제품/공간 컷
- 또는 텍스트 제거 후 배경으로만 쓸 수 있는 컷

목적:
- hero에서 `promo-complete` 의존도 줄이기

## 운영 원칙

### Author/Builder에 허용할 것
- `background-only`
- `object-only`
- `icon-only`
- `reference-only`

### Author/Builder에 금지할 것
- `promo-complete` 자산 위에 새로운 headline/cta를 다시 얹는 것
- `promo-complete`를 quickmenu icon으로 축소 재사용하는 것
- role이 불명확한 자산을 임의로 다른 역할에 쓰는 것

## 다음 단계

1. `promo-complete` 금지 규칙을 author input/runtime validation에 반영
2. quickmenu용 `icon-only` 최소 세트 확보
3. hero용 `background-only` 후보 확보
4. reference URLs를 `reference-only` screenshot/crop으로 수집
5. 이후에만 image generation 모듈을 `background-only` / `object-only` 보강용으로 붙인다

## 결론

지금은 자산이 부족해서 문제가 아니라, `역할이 다른 자산을 잘못 재사용`해서 문제가 생긴다.

따라서 지금 정답은:

- 자산을 많이 쌓는 것보다
- `role taxonomy + restricted registry`를 먼저 고정하는 것

이다.
