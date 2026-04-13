# Admin PLP PDP Target Catalog

이 문서는 `admin`에서 시안 대상 페이지로 노출할 `PLP / PDP` 기준 목록을 확정한 문서다.

목적은 단순히 현재 라우트가 존재하는지 확인하는 것이 아니라, `고객 요청 시안`을 만들 때 어떤 대표 페이지를 선택 대상으로 보여줄지 고정하는 것이다.

---

## 1. 확정 원칙

### 1.1 최상위 대상 분류

`admin`의 시안 대상 페이지는 최소 아래 3분류를 반드시 포함한다.

1. `홈`
2. `PLP`
3. `PDP`

### 1.2 PLP 노출 원칙

PLP는 현재 운영 중인 대표 카테고리 페이지를 기준으로 노출한다.

원칙:

1. `pageId` 기준으로 하나의 논리 페이지로 본다.
2. 내부적으로는 `pc / mo` 양쪽 뷰포트를 지원한다.
3. admin 목록에서는 뷰포트별로 따로 늘어놓지 않는다.

### 1.3 PDP 노출 원칙

PDP는 현재처럼 `/clone-product` 단일 라우트만 사용자에게 드러내지 않는다.

원칙:

1. `대표 case` 단위로 노출한다.
2. 구조 차이나 시안 의미가 없는 중복 상품은 제외한다.
3. admin 목록에서는 사람이 이해할 수 있는 `케이스명`으로 보여준다.
4. 내부적으로는 대표 `href`와 `pageId`를 매핑해서 `/clone-product`로 연결한다.

---

## 2. 현재 데이터 확인 결과

현재 시스템에는 아래 데이터가 이미 존재한다.

1. PLP 대표군:
   - `data/normalized/plp-groups/index.json`
   - `data/normalized/workbench-targets/index.json`
2. PDP 대표군:
   - `data/normalized/pdp-groups/index.json`
   - `data/normalized/representative-pdps/index.json`
   - `data/normalized/workbench-targets/index.json`

즉 `PLP / PDP 데이터가 없는 것`이 아니라, `admin 시안 대상 목록으로 아직 승격되지 않은 상태`로 본다.

---

## 3. 확정된 PLP 목록

admin에서 노출할 PLP는 아래 2개로 확정한다.

### 3.1 TV 카테고리

- 사용자 노출명: `PLP - TV 카테고리`
- 내부 pageId: `category-tvs`
- pageGroup: `category`
- 기준 URL:
  - PC: `https://www.lge.co.kr/category/tvs`
  - MO: `https://www.lge.co.kr/m/category/tvs`

### 3.2 냉장고 카테고리

- 사용자 노출명: `PLP - 냉장고 카테고리`
- 내부 pageId: `category-refrigerators`
- pageGroup: `category`
- 기준 URL:
  - PC: `https://www.lge.co.kr/category/refrigerators`
  - MO: `https://www.lge.co.kr/m/category/refrigerators`

---

## 4. 확정된 PDP 대표 케이스

TV와 냉장고는 현재 수집된 대표 PDP 중에서 `시안 관점에서 구분 의미가 있는 케이스`만 노출한다.

### 4.1 TV PDP 대표 케이스

#### A. 일반형 TV PDP

- 사용자 노출명: `PDP - TV 일반형`
- 내부 targetId 제안: `pdp-tv-general`
- 연결 pageId: `category-tvs`
- 대표 href: `https://www.lge.co.kr/tvs/32lq635bkna-stand`
- 선정 이유:
  - 일반 LED TV 계열
  - 프리미엄 OLED와 성격이 분명히 다름
  - 시안 방향 비교용 기준 케이스로 적합

#### B. 프리미엄 TV PDP

- 사용자 노출명: `PDP - TV 프리미엄형`
- 내부 targetId 제안: `pdp-tv-premium`
- 연결 pageId: `category-tvs`
- 대표 href: `https://www.lge.co.kr/tvs/oled97g5kna-stand`
- 선정 이유:
  - 프리미엄 OLED 계열
  - 고가/프리미엄 제품 레이아웃과 메시지 톤을 보기 좋음

#### 제외 케이스

- `https://www.lge.co.kr/tvs/vc23ga`

제외 이유:

1. TV 카테고리 안에 잡혀 있지만 액세서리 성격이 강함
2. 대표 TV PDP 시안 케이스로 보기엔 성격이 다름
3. 초기 admin 대표 목록에는 올리지 않는다

### 4.2 냉장고 PDP 대표 케이스

#### A. 냉장고 일반 매직스페이스형

- 사용자 노출명: `PDP - 냉장고 일반형`
- 내부 targetId 제안: `pdp-refrigerator-general`
- 연결 pageId: `category-refrigerators`
- 대표 href: `https://www.lge.co.kr/refrigerators/t873mee111`
- 선정 이유:
  - 냉장고 PDP의 기본 비교 기준으로 보기 좋음

#### B. 냉장고 노크온형

- 사용자 노출명: `PDP - 냉장고 노크온형`
- 내부 targetId 제안: `pdp-refrigerator-knockon`
- 연결 pageId: `category-refrigerators`
- 대표 href: `https://www.lge.co.kr/refrigerators/t875mee412`
- 선정 이유:
  - 노크온 특성이 있어 제품 메시지와 시안 차별화 포인트가 분명함

#### C. 냉장고 글라스형

- 사용자 노출명: `PDP - 냉장고 글라스형`
- 내부 targetId 제안: `pdp-refrigerator-glass`
- 연결 pageId: `category-refrigerators`
- 대표 href: `https://www.lge.co.kr/refrigerators/h875gbb111`
- 선정 이유:
  - 도어 재질과 프리미엄 인상이 달라 시안 비교 의미가 있음

---

## 5. admin 목록 노출 방식

admin의 페이지 선택 목록에서는 아래 순서로 노출한다.

1. `홈 - 메인`
2. `PLP - TV 카테고리`
3. `PLP - 냉장고 카테고리`
4. `PDP - TV 일반형`
5. `PDP - TV 프리미엄형`
6. `PDP - 냉장고 일반형`
7. `PDP - 냉장고 노크온형`
8. `PDP - 냉장고 글라스형`

필요 시 아래는 2차 추가 대상으로 본다.

1. `support`
2. `bestshop`
3. `care-solutions`

즉 시안 워크벤치의 중심 목록은 우선 `홈 + 대표 PLP + 대표 PDP`로 재편한다.

---

## 6. 내부 연결 원칙

### 6.1 PLP

PLP는 기존 pageId 기반 clone 라우트를 사용한다.

- `category-tvs` -> `/clone/category-tvs`
- `category-refrigerators` -> `/clone/category-refrigerators`

### 6.2 PDP

PDP는 현재 공유 라우트를 유지하되, admin에서는 `케이스형 대상`으로 보여준다.

연결 형식:

- `/clone-product?pageId=<category-page-id>&href=<representative-pdp-url>`

예시:

- `PDP - TV 일반형`
  - `/clone-product?pageId=category-tvs&href=https%3A%2F%2Fwww.lge.co.kr%2Ftvs%2F32lq635bkna-stand`
- `PDP - 냉장고 노크온형`
  - `/clone-product?pageId=category-refrigerators&href=https%3A%2F%2Fwww.lge.co.kr%2Frefrigerators%2Ft875mee412`

---

## 7. 구현 전 체크포인트

이 기준으로 구현에 들어가기 전에 아래 4가지를 만족해야 한다.

1. admin 셀렉트 목록에 위 8개 대상이 노출돼야 한다.
2. PDP 선택 시 내부적으로 공유 PDP 라우트로 연결돼야 한다.
3. PDP도 `기획/시안 작업` 대상처럼 취급돼야 한다.
4. 이후 `slot registry`와 `component editability`도 PDP에 맞춰 확장돼야 한다.

---

## 8. 현재 결론

지금 단계의 확정안은 아래와 같다.

1. PLP는 `TV`, `냉장고` 2개를 1차 확정한다.
2. PDP는 `TV 2개`, `냉장고 3개` 대표 케이스를 1차 확정한다.
3. TV 액세서리형 `vc23ga`는 대표 PDP 목록에서 제외한다.
4. admin의 핵심 시안 대상 목록은 `홈 + PLP + PDP 대표 케이스` 중심으로 재편한다.
