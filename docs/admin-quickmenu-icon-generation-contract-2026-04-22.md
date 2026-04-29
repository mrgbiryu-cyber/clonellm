# Quickmenu Icon Generation Contract

대상:
- `home.quickmenu`

목적:
- quickmenu를 고정 자산 세트가 아니라 `리디자인마다 새 family를 생성할 수 있는 시스템`으로 정의
- 다만 한 리디자인 안에서는 `family consistency`를 유지
- 생성 방향성과 품질을 단계별로 확인할 수 있는 체크포인트 제공

---

## 1. North Star

quickmenu는 다음 둘을 동시에 만족해야 한다.

1. `매 리디자인마다 새 시각 톤을 가질 수 있다`
2. `한 리디자인 안에서는 하나의 icon family처럼 보여야 한다`

즉 시스템은 `같은 SVG 재사용기`가 아니라 `family generator`여야 한다.

---

## 2. What Stays Fixed

고정해야 하는 것은 결과 파일이 아니라 아래 계약이다.

- `role = icon-only`
- `batch-consistent generation`
- `same viewport`
- `same stroke language`
- `same corner language`
- `same density`
- `no promo-complete reuse`
- `no text embedded in icon`
- `no background thumbnail look`

---

## 3. What Can Change Per Redesign

리디자인마다 바뀌어도 되는 것:

- line tone
  - thin / medium
- geometry mood
  - geometric / soft-rounded / appliance-technical
- visual warmth
  - neutral / warm / crisp
- emphasis style
  - calm / premium / energetic
- label-to-icon proportion
- spacing around icon in runtime card

즉 매번 바뀌는 것은 `family style`, 고정되는 것은 `family integrity`다.

---

## 4. Input Contract

### 4.1 required input

- `Requirement Markdown`
- `Concept Markdown`
- `quickmenu icon family spec`
- `memberLabels`
- `style direction summary`

### 4.2 style direction summary

이건 이번 리디자인의 컨셉에서 파생되는 열린 서술형 입력이다.

예:
- `premium appliance editorial line icons with rounded ends and restrained visual weight`
- `soft mono outline icons with warmer curvature and home-lifestyle friendliness`
- `clean technical line family with sharper geometry and tighter interior spacing`

### 4.3 semantic member labels

최소 대상:
- `구독 Days`
- `혜택/이벤트`
- `웨딩&이사`
- `다품목 할인`
- `라이브`
- `카드혜택`
- `가전 구독`
- `소모품`
- `SALE 홈스타일`

주의:
- label은 literal drawing 지시가 아니다
- semantic anchor로만 사용

---

## 5. Output Contract

출력은 개별 아이콘 9개보다 `하나의 family package`로 본다.

```json
{
  "familyId": "home-quickmenu-line-v1-redesign-a",
  "role": "icon-only",
  "memberCount": 9,
  "styleSummary": "soft rounded mono outline with premium appliance restraint",
  "members": [
    { "label": "구독 Days", "assetId": "..." },
    { "label": "혜택/이벤트", "assetId": "..." },
    { "label": "웨딩&이사", "assetId": "..." },
    { "label": "다품목 할인", "assetId": "..." },
    { "label": "라이브", "assetId": "..." },
    { "label": "카드혜택", "assetId": "..." },
    { "label": "가전 구독", "assetId": "..." },
    { "label": "소모품", "assetId": "..." },
    { "label": "SALE 홈스타일", "assetId": "..." }
  ]
}
```

중요:
- output의 진실은 `family`
- 개별 asset은 family 하위 멤버일 뿐이다

---

## 6. Generation Modes

### A. batch generation

- 한 번의 요청으로 9개를 같은 family로 생성
- 가장 이상적

### B. seeded family generation

- 공통 style seed / style summary를 유지하며 멤버를 순차 생성
- batch가 어려울 때 허용
- 최종 consistency validation 필수

### C. imported family

- 이미 존재하는 icon set을 family spec에 맞게 등록
- 단일 SVG 모음이 아니라 실제 family consistency를 만족해야 함

---

## 7. Validation Gates

### 7.1 role gate

실패:
- `promo-complete` 자산 재사용
- PNG/WEBP 썸네일을 아이콘처럼 축소 사용
- 텍스트 포함 자산 사용

### 7.2 family consistency gate

실패:
- 일부만 fill, 일부만 outline
- stroke weight 차이가 큼
- corner language가 섞임
- viewport 기준이 다름
- 어떤 아이콘만 지나치게 세밀하거나 크기감이 다름

### 7.3 semantic adequacy gate

실패:
- label과 아이콘 의미가 완전히 어긋남
- 동일한 glyph를 거의 복붙해 여러 label에 사용

### 7.4 runtime fit gate

실패:
- 28x28 기준에서 흐릿하거나 지나치게 복잡함
- quickmenu card 안에서 text보다 과하게 무겁거나 너무 약함

---

## 8. Direction Checkpoints

품질 이전에 먼저 보는 것:

1. `system direction`
- 이번 결과가 새로운 family를 만들 수 있는 구조인가
- 아니면 다시 고정 자산 선택기로 돌아갔는가

2. `role correctness`
- quickmenu가 icon system으로 읽히는가
- promo thumbnail처럼 읽히는가

3. `family integrity`
- 9개가 한 세트처럼 보이는가

4. `design fit`
- 이번 컨셉의 tone과 맞는가

5. `runtime clarity`
- 실제 `/admin` preview에서 아이콘과 라벨이 탐색 요소로 분명히 읽히는가

---

## 9. Method for Ongoing Checks

수정 방향성은 아래 순서로 확인한다.

1. `generation contract`가 레거시 고정 자산 선택기로 퇴행하지 않았는지 본다
2. `family output`이 role spec을 지키는지 본다
3. `runtime preview`에서 실제 quickmenu가 탐색 시스템으로 읽히는지 본다
4. 그 다음에만 미적 품질을 본다

즉:
- 먼저 구조
- 그 다음 역할
- 그 다음 일관성
- 마지막에 미감

---

## 10. Immediate Next Step

1. `home.quickmenu.icon`을 개별 asset이 아니라 `family asset` 타입으로 추가
2. 생성 또는 import 시 `family package` 단위 저장 지원
3. Author input에는 개별 quickmenu image 대신
   - `familyId`
   - `memberLabels`
   - `styleSummary`
   - `role=icon-only`
   를 전달
4. `/admin` 품질 체크 시 quickmenu는 `family integrity`부터 본다
