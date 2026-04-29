# 관리자 요구사항 범위/패치 깊이 스키마

작성일: 2026-04-17

## 목적

이 문서는 `admin`에서 요구사항을 입력할 때, 사용자가 무엇을 얼마나 깊게 바꾸고 싶은지를 먼저 고정하기 위한 입력 스키마를 정의한다.

현재 구조는 `페이지 선택 -> 요구사항 -> 기획서 -> 빌더` 흐름은 갖고 있지만, 중간에 아래 두 축이 빠져 있다.

1. `개입 계층`
2. `패치 깊이`

이 두 값이 빠지면 Planner는 범위를 넓거나 좁게 오해할 수 있고, Builder도 안전한 국소 패치만 반복하거나 반대로 과도한 전면 개편 서술을 만들 수 있다.

---

## 1. 기본 원칙

### 원칙 A. 범위와 강도를 분리한다

요구사항은 아래 두 축으로 나뉘어야 한다.

1. `어디를 바꿀 것인가`
2. `얼마나 깊게 바꿀 것인가`

즉 `페이지 전체를 약하게 조정`할 수도 있고, `상단 구간을 강하게 재구성`할 수도 있다.

### 원칙 B. 계층 위에 패치 깊이를 태운다

실제 실행 단위는 아래처럼 읽혀야 한다.

- `요소 x 약함`
- `컴포넌트 x 중간`
- `구간 x 강함`
- `페이지 x 전면`

### 원칙 C. 고객용 문서와 실행용 입력을 분리한다

고객이 읽는 기획서에는 내부 schema 이름을 그대로 노출하지 않는다.

- 고객용 문서에는 `상단 진입부`, `핵심 혜택 구간`, `페이지 전체 구조` 같은 표현을 쓴다.
- 내부 실행 입력에서는 `targetScope`, `targetComponents`, `patchDepth` 같은 구조화 값을 유지한다.

---

## 2. 개입 계층 정의

### 2.1 요소

한 컴포넌트 내부의 요소를 조정한다.

예:

- 타이틀/서브타이틀 변경
- CTA 문구 변경
- 아이콘 크기 조정
- 카드 배경색/패딩 조정

내부 값:

- `targetScope = element`

### 2.2 컴포넌트

한 컴포넌트 하나를 통째로 다시 설계한다.

예:

- `hero` 전체 재구성
- `quickmenu` 전체 카드 시스템 재설계
- `best-ranking` 섹션의 카드 구조 재설계

내부 값:

- `targetScope = component`
- `targetComponents = ["home.hero"]` 같은 식의 명시 대상 필요

### 2.3 구간

상단 / 중단 / 하단처럼 여러 컴포넌트를 묶은 구간을 다시 설계한다.

예:

- `header-top + header-bottom + hero + quickmenu`를 상단 진입부로 묶어서 재설계
- 홈 중단 상품 전환 구간 전체 재설계

내부 값:

- `targetScope = section-group`
- `targetComponents` 또는 별도 `targetGroupId` 필요

### 2.4 페이지

해당 페이지 전체 구조와 리듬을 다시 설계한다.

예:

- 홈 전체 전면 개편
- 홈스타일 메인 전체 구조 개편
- 구독 메인 전체 여정 재설계

내부 값:

- `targetScope = page`

---

## 3. 패치 깊이 정의

### 3.1 약함

스타일/강조/문구 조정 중심.

허용 예:

- 색상
- 여백
- 타이포 위계
- CTA 존재감
- 배경 톤

적합 대상:

- PDP
- PLP
- 고객지원
- 이미 구조가 안정된 섹션

내부 값:

- `patchDepth = light`

### 3.2 중간

구조는 유지하되 내부 구성과 우선순위를 재배치한다.

허용 예:

- 카드 리듬 재조정
- 텍스트와 이미지 비중 변경
- 반복 아이템 밀도 재조정
- 컴포넌트 내부 hierarchy 변경

내부 값:

- `patchDepth = medium`

### 3.3 강함

기존 구조의 뼈대는 참고하되, 컴포넌트나 구간 단위에서 체감될 수준으로 재구성한다.

허용 예:

- hero 레이아웃 재편
- quickmenu 카드 구조 재설계
- 상단 구간 전체 리듬 변경

내부 값:

- `patchDepth = strong`

### 3.4 전면

전면 제안 시안 단계. 기존 레이아웃을 참고하되 새 구조를 제안할 수 있다.

허용 예:

- 페이지 전체 섹션 순서 재구성
- 신규 섹션 제안
- 상단/중단/하단 리듬 전체 재설계

내부 값:

- `patchDepth = full`

---

## 4. 요구사항 입력 스키마

### 4.1 필수 입력

1. `pageId`
2. `viewportProfile`
3. `interventionLayer`
4. `patchDepth`
5. `requestText`

### 4.2 조건부 입력

- `targetComponents`
  - `컴포넌트` 또는 `요소` 계층일 때 필수
- `targetGroupId`
  - `구간` 계층일 때 권장
- `keyMessage`
- `preferredDirection`
- `avoidDirection`
- `toneAndMood`
- `referenceUrls`

### 4.3 제안 JSON shape

```json
{
  "pageId": "home",
  "viewportProfile": "pc",
  "interventionLayer": "section-group",
  "patchDepth": "strong",
  "targetScope": "section-group",
  "targetGroupId": "home-top",
  "targetComponents": [
    "home.header-top",
    "home.header-bottom",
    "home.hero",
    "home.quickmenu"
  ],
  "requestText": "상단 진입부 전체를 고객 여정 중심으로 다시 설계하고 싶다.",
  "keyMessage": "첫 화면에서 구매 전환과 브랜드 신뢰가 동시에 읽혀야 한다.",
  "preferredDirection": "정돈된 프리미엄 커머스 허브",
  "avoidDirection": "할인몰처럼 보이는 과한 프로모션 톤",
  "toneAndMood": "신뢰감 있고 밀도 높은 프리미엄 톤"
}
```

---

## 5. Planner 해석 기준

Planner는 아래 순서로 요구사항을 해석해야 한다.

1. `pageIdentity`
2. `interventionLayer`
3. `patchDepth`
4. `targetScope / targetComponents / targetGroupId`
5. `requestText`

즉 `무엇을 바꾸고 싶은가`보다 먼저 `어느 계층을 어느 강도로 바꿀 것인가`를 읽어야 한다.

Planner는 아래를 따라야 한다.

- `요소 x 약함`
  - 국소 수정 기획으로 제한
- `컴포넌트 x 중간/강함`
  - 해당 컴포넌트 재구성 중심
- `구간 x 강함`
  - 구간 단위 리듬/위계 재설계
- `페이지 x 전면`
  - 페이지 전면 제안 문서 생성

---

## 6. Builder 해석 기준

Builder는 Planner 문서를 읽기 전에, 먼저 `개입 계층`과 `패치 깊이`를 보고 허용 실행 범위를 줄여야 한다.

### 요소

- 기존 patch schema 내에서만 움직인다.
- 주로 `update_component_patch`, `update_slot_text`, `update_slot_image` 사용

### 컴포넌트

- 하나의 slot/component를 중심으로 재구성
- component 단위 전면 패치 capability가 별도로 필요할 수 있다

### 구간

- 여러 slot을 묶어 일관된 rhythm으로 수정
- group-level orchestration 필요

### 페이지

- 현재 patch builder만으로는 부족할 수 있다
- page composition builder 또는 full-page proposal builder가 별도 필요하다

---

## 7. 페이지 분류 기준

현재 기준으로는 페이지별 기본 권장 계층이 다르다.

### 주로 `요소 ~ 컴포넌트`

- PDP 계열
- PLP 계열
- 고객지원

### 주로 `구간 ~ 페이지`

- 홈
- 홈스타일 메인
- 구독 메인

즉 후자 3개는 처음부터 `page / full` 또는 최소 `section-group / strong`까지 허용해야 한다.

---

## 8. 추가 자산 기준

패치 깊이가 `강함` 또는 `전면`으로 올라가면, markdown 문서만으로는 부족할 수 있다.

추가 자산 필요 후보:

- 아이콘 세트
- hero / banner용 신규 비주얼
- 카드용 신규 썸네일
- 배지 / 랭크 그래픽
- 구간별 배경 텍스처 또는 그래픽 모티프

따라서 `patchDepth = strong | full` 일 때는 아래 체크가 함께 있어야 한다.

- `requiresAdditionalAssets`
- `assetNeeds`

예:

```json
{
  "requiresAdditionalAssets": true,
  "assetNeeds": [
    "quickmenu icon set refresh",
    "hero campaign image",
    "ranking badge graphics"
  ]
}
```

---

## 9. 현재 admin 상태와의 차이

현재 `/admin`은 사실상 아래로 고정돼 있다.

- `targetScope = page`
- `targetComponents = []`
- `designChangeLevel`만 사용

즉:

1. 개입 계층 선택 UI가 없다.
2. 컴포넌트 선택 단위가 없다.
3. 구간 선택 단위가 없다.
4. 패치 깊이와 개입 계층이 분리되지 않았다.

이는 현재 UX에서 보완해야 할 핵심 누락 항목이다.

---

## 10. 문서 확정용 한 줄

`요구사항 입력은 페이지 선택 뒤에 반드시 개입 계층과 패치 깊이를 먼저 고르고, 그 위에 요구사항을 얹는 구조로 바꿔야 한다.`
