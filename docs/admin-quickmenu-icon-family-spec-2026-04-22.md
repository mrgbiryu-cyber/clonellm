# Quickmenu Icon Family Spec

대상:
- `home`
- `quickmenu`

목적:
- quickmenu를 `promo-complete` 썸네일이 아니라 `icon-only family`로 재구성하기 위한 최소 명세
- 아이콘을 하나씩 따로 고르는 것이 아니라, 한 패밀리로 생성/수집/검증하기 위한 기준 고정

---

## 1. 원칙

- quickmenu는 `텍스트 + 아이콘`의 탐색 시스템이다.
- quickmenu는 `프로모션 썸네일 모음`처럼 보여서는 안 된다.
- 각 아이콘은 개별 품질보다 `family consistency`를 우선한다.
- 하나의 quickmenu 세트는 `batch-consistent`여야 한다.
- 서로 다른 출처의 SVG를 임의 조합해서 쓰지 않는다.

---

## 2. Required Family Contract

```json
{
  "familyId": "home-quickmenu-line-v1",
  "role": "icon-only",
  "section": "home.quickmenu",
  "memberCount": 9,
  "memberLabels": [
    "구독 Days",
    "혜택/이벤트",
    "웨딩&이사",
    "다품목 할인",
    "라이브",
    "카드혜택",
    "가전 구독",
    "소모품",
    "SALE 홈스타일"
  ],
  "styleSpec": {
    "viewport": "28x28",
    "strokeWeight": "1.75px-2px",
    "cornerStyle": "rounded",
    "fillMode": "outline-first",
    "visualDensity": "medium",
    "backgroundUsage": "none",
    "palette": ["#111111"]
  },
  "generationMode": "batch-consistent"
}
```

---

## 3. Visual Rules

### 3.1 stroke

- 선 두께는 모든 아이콘에서 거의 동일해야 한다.
- 가늘고 날카로운 선과 두껍고 둔한 선이 섞이면 안 된다.
- 기준:
  - desktop 표시 기준 `1.75px ~ 2px`

### 3.2 geometry

- 모든 아이콘은 같은 기준 박스에 들어와야 한다.
- 기준 박스:
  - `28x28 viewport`
- 실제 시각 무게는 박스 안에서 비슷해야 한다.
- 어떤 아이콘만 지나치게 크거나 작아 보이면 안 된다.

### 3.3 corner and path language

- 라운드 코너 사용 시 전체 아이콘에 일관되게 적용
- 직선 위주/곡선 위주 성격이 섞이지 않도록 유지
- 지나치게 세밀한 내부 디테일 금지

### 3.4 color

- 기본은 단색 line icon
- 기준:
  - `#111111`
- 강조색이 필요해도 기본 family에는 넣지 않는다
- quickmenu 시각 리듬은 색보다 레이아웃과 라벨이 담당한다

### 3.5 no background card

- 아이콘 자체에 배경 원/배지/썸네일 카드 이미지를 넣지 않는다
- background shape가 필요하면 runtime/CSS가 처리하고, asset 자체는 icon-only로 유지

---

## 4. Semantic Mapping

각 quickmenu 항목은 아래 의미 축으로 매핑한다.

| label | semantic intent | icon direction |
| --- | --- | --- |
| `구독 Days` | recurring subscription offer | calendar / repeat / subscription mark |
| `혜택/이벤트` | benefits and event hub | gift / spark / coupon |
| `웨딩&이사` | move / setup / new-home package | home / box / truck-lite |
| `다품목 할인` | bundle discount | stacked items / tag / basket |
| `라이브` | live commerce | play / broadcast / live badge |
| `카드혜택` | card promotion | card / chip / benefit mark |
| `가전 구독` | appliance subscription | appliance + recurring marker |
| `소모품` | consumables / parts | droplet / filter / package |
| `SALE 홈스타일` | curated sale / home styling | chair / sofa / home deco |

주의:
- semantic intent는 참고용이다.
- final icon drawing은 label literal 묘사가 아니라 family style 안에서 해석한다.

---

## 5. Validation Rules

다음이면 실패다.

- `promo-complete` 자산을 quickmenu icon처럼 사용
- PNG/WEBP 썸네일을 축소해서 아이콘처럼 사용
- 한 세트 안에 서로 다른 style language의 SVG가 혼합
- 일부 아이콘만 채움형, 일부 아이콘만 outline형
- 일부 아이콘만 지나치게 세밀하거나 브랜드 로고에 가까움
- 일부 아이콘만 원형 badge/background를 자체 포함

---

## 6. Allowed Supply Paths

### A. Existing family import

- 이미 존재하는 일관된 line-icon family를 가져온다
- 조건:
  - 최소 9개 항목 대응 가능
  - viewport / stroke / weight 일관성 확보

### B. Batch generation

- 한 번에 9개를 같은 style spec으로 생성한다
- 개별 생성 후 섞지 않는다

### C. Hybrid refinement

- base family를 만들고 일부 항목만 같은 규칙으로 보강한다
- 이 경우도 최종 family consistency 검증을 통과해야 한다

---

## 7. Not Allowed

- 항목별로 unrelated svg를 하나씩 찾아 섞는 방식
- quickmenu-image-1~5 같은 기존 promo thumbnail 재사용
- 아이콘 부족을 이유로 텍스트만 넣고 image slot을 대충 남기는 방식
- 아이콘 대신 브랜드 로고/SNS 로고를 넣는 방식

---

## 8. Immediate Next Step

1. `home.quickmenu.icon` family를 실제 데이터 구조로 등록
2. 공급 경로를 아래 중 하나로 결정
   - `existing family import`
   - `batch generation`
3. Author input에는 개별 자산 대신 `familyId + memberLabels + styleSpec`를 넘긴다
4. Validation은 개별 URL보다 `family consistency`를 먼저 본다
