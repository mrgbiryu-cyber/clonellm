# 관리자 개입 모드별 추가 구현 범위

작성일: 2026-04-17

## 목적

이 문서는 `개입 계층 x 패치 깊이` 조합을 실제 제품 모드로 다시 잘라서,

1. 현재 바로 실행 가능한 범위
2. 지금은 계획까지만 가능한 범위
3. 추가 구현이 필요한 범위

를 분리하기 위해 작성한다.

핵심은 `요구사항 입력 스키마`와 `실행 엔진`을 같은 언어로 맞추는 것이다.

단계형 완료 기준과 게이트는 아래 문서를 기준으로 한다.

- [관리자 전면개편 단계형 완료 기준](./admin-full-redesign-delivery-gates-2026-04-17.md)
- [관리자 컴포넌트 리빌드 대상 분류표](./admin-component-rebuild-classification-2026-04-17.md)

---

## 1. 기본 개념

현재 시스템은 단일 Builder처럼 보이지만, 실제로는 아래 4개 모드로 분리해서 봐야 한다.

1. `요소 패치 모드`
2. `컴포넌트 패치 / 컴포넌트 전면개편 모드`
3. `구간 전면개편 모드`
4. `페이지 전면개편 모드`

여기에 `패치 깊이`가 올라간다.

- `light`
- `medium`
- `strong`
- `full`

즉 실제 작업 단위는 아래처럼 읽어야 한다.

- `요소 x light`
- `컴포넌트 x medium`
- `컴포넌트 x full`
- `구간 x strong`
- `페이지 x full`

---

## 2. 모드 정의

### 2.1 요소 패치 모드

목적:

- 컴포넌트 내부의 일부 요소만 수정

예:

- hero headline 교체
- quickmenu 아이콘 크기 조정
- 카드 타이틀 컬러/여백 조정

현재 상태:

- `실행 가능`

현재 엔진:

- `update_component_patch`
- `update_slot_text`
- `update_hero_field`
- `update_slot_image`

추가 구현 필요:

- 거의 없음
- 정밀 아이템 단위 patch schema 보강 정도

권장 페이지:

- PDP
- PLP
- 고객지원
- 이미 구조가 안정된 섹션

---

### 2.2 컴포넌트 패치 모드

목적:

- 하나의 컴포넌트를 구조는 유지하되 체감되게 개선

예:

- hero copy hierarchy 재정리
- quickmenu 카드 shell 정리
- best-ranking 카드 density 재조정

현재 상태:

- `실행 가능`

현재 엔진:

- 기존 patch schema 기반
- slot-level patch

추가 구현 필요:

- 컴포넌트별 patch schema 세분화
- item-level child control 확대

권장 페이지:

- 전 페이지 공통

---

### 2.3 컴포넌트 전면개편 모드

목적:

- 컴포넌트 하나를 사실상 새 시안 수준으로 다시 설계

예:

- hero 전체 레이아웃 재구성
- quickmenu를 다른 카드 시스템으로 재설계
- best-ranking을 다른 랭킹 모듈 구조로 재설계

현재 상태:

- `기획 가능 / 일부 patch 실행 가능 / 완전 렌더는 제한적`

현재 엔진이 하는 일:

- 가능한 patch는 실행
- 더 넓은 재설계는 `compositionPlan`으로 남김

부족한 것:

- `component rebuild renderer`
- `component composition schema`
- child/repeater 구조 재정의 capability
- 신규 asset slot 연결

추가 구현 범위:

1. 컴포넌트별 `rebuild schema`
2. 기존 patch와 별도인 `component composition output`
3. rebuild preview renderer
4. rebuild 결과 저장 포맷

우선 대상:

- `home.hero`
- `home.quickmenu`
- `home.best-ranking`
- `care-solutions.hero`
- `homestyle-home.hero`

주의:

- 위 5개는 `전체 컴포넌트 수`가 아니다.
- 이 목록은 renderer 구조를 검증하고 1차 전면개편 경험을 만드는 `파일럿 + 1차 롤아웃 대상`이다.
- 실제 구현 관리 단위는 `15개 페이지 전체 컴포넌트 분류표`여야 한다.

구현 웨이브:

1. `Wave 1`
  - `home.hero`
  - `home.quickmenu`
2. `Wave 2`
   - `home.best-ranking`
   - `care-solutions.hero`
   - `homestyle-home.hero`

즉 `hero`, `quickmenu`는 출발점이지 종료점이 아니다.
이 2개는 컴포넌트 전면개편 renderer의 구조를 먼저 검증하기 위한 최소 선행 대상이고,
그 다음 1차 롤아웃 5개를 지나,
최종적으로는 `15개 페이지 전체 컴포넌트 분류표`를 기준으로 확장한다.

---

### 2.4 구간 전면개편 모드

목적:

- 상단/중단/하단처럼 여러 컴포넌트를 묶어 하나의 경험 구간으로 재설계

예:

- 홈 상단 진입부 전체 재설계
- 홈 중단 상품 전환 구간 재설계
- 구독 메인 상단 가치 제안 구간 재설계

현재 상태:

- `기획 가능 / 부분 patch 실행 가능 / 구간 전체 renderer는 없음`

현재 엔진이 하는 일:

- 선택된 component 범위를 patch로 실행
- 더 넓은 구조 변경은 `section-composition-plan`으로 남김

부족한 것:

- `section group orchestration`
- `section group composition renderer`
- group-level layout rhythm schema
- section order / spacing / background cadence 재정의

추가 구현 범위:

1. `targetGroupId`별 layout template
2. group-level composition schema
3. 그룹 미리보기 renderer
4. 그룹 단위 compare / save

우선 대상:

- `home-top`
- `home-middle`
- `care-solutions-top`
- `homestyle-home-top`

---

### 2.5 페이지 전면개편 모드

목적:

- 페이지 전체 정보 구조와 시각 리듬을 새롭게 제안

예:

- 홈 전체 전면 개편
- 홈스타일 메인 전체 재설계
- 구독 메인 전체 여정 재설계

현재 상태:

- `기획 가능 / patch 가능한 범위만 실행 / full-page renderer는 없음`

현재 엔진이 하는 일:

- `page-composition-plan`으로 분기
- `assetNeeds`
- `missingCapabilities`
- 현재 patch로 가능한 최소 실행분만 생성

부족한 것:

- `page composition schema`
- full-page composition preview renderer
- section reorder / insert / suppress model
- 신규 section proposal renderer
- asset bundle 연결 체계

추가 구현 범위:

1. page-level composition spec
2. full-page preview renderer
3. section ordering and grouping engine
4. 신규 section placeholder / custom block renderer
5. page-level save/version/pin flow

우선 대상:

- `home`
- `homestyle-home`
- `care-solutions`

---

## 3. 패치 깊이별 해석 기준

### 3.1 light

정의:

- 스타일/카피 정리

적합 모드:

- 요소
- 컴포넌트 패치

구현 우선순위:

- 현재 엔진 유지

---

### 3.2 medium

정의:

- 구조 유지 + 내부 재배치

적합 모드:

- 컴포넌트 패치
- 일부 구간 패치

구현 우선순위:

- patch schema 세분화
- repeater 내부 규칙 강화

---

### 3.3 strong

정의:

- 체감될 수준의 재구성

적합 모드:

- 컴포넌트 전면개편
- 구간 전면개편

구현 우선순위:

- component rebuild plan
- section composition plan

---

### 3.4 full

정의:

- 전면 제안

적합 모드:

- 컴포넌트 전면개편
- 구간 전면개편
- 페이지 전면개편

구현 우선순위:

- composition renderer
- asset pipeline
- preview/save/pin 확장

---

## 4. 현재 엔진과 목표 엔진의 차이

현재 엔진:

- `patch-based preview builder`

목표 엔진:

- `element patch builder`
- `component rebuild builder`
- `section composition builder`
- `page composition builder`

즉 앞으로는 하나의 Builder를 키우는 게 아니라, Builder 내부를 모드별 capability로 나눠야 한다.

---

## 5. 추가 구현 백로그

### 5.1 공통

1. `executionMode`를 UI에도 노출
2. `compositionPlan / assetNeeds / missingCapabilities`를 결과 패널에 표시
3. mode별 저장 포맷 분리

### 5.2 요소 / 컴포넌트 패치

1. patch schema를 item-level까지 세분화
2. icon/text/image child control 확대

### 5.3 컴포넌트 전면개편

1. component rebuild schema
2. component rebuild renderer
3. rebuild compare view

### 5.4 구간 전면개편

1. group template registry
2. section composition schema
3. group preview renderer

### 5.5 페이지 전면개편

1. page composition schema
2. full-page preview renderer
3. 신규 section/asset 연결
4. composition version save / pin

---

## 6. 우선순위 제안

### 1차

- 요소 패치 완성도 보강
- 컴포넌트 전면개편 plan + renderer 초안

### 2차

- 구간 전면개편 renderer

### 3차

- 페이지 전면개편 renderer

이 순서가 맞는 이유는:

1. 요소/컴포넌트는 현재 엔진 위에서 확장이 가능하고
2. 구간/페이지는 새 composition layer가 필요하기 때문이다.

---

## 7. 페이지별 권장 모드

### 주로 요소 / 컴포넌트 패치

- support
- bestshop
- category-tvs
- category-refrigerators
- pdp 전부

### 컴포넌트 전면개편까지 자주 필요

- home
- homestyle-home
- care-solutions

### 구간 / 페이지 전면개편이 자주 필요

- home
- homestyle-home
- care-solutions

---

## 8. 문서 확정용 한 줄

`앞으로 Builder는 하나의 패치 도구가 아니라, 요소 패치 / 컴포넌트 전면개편 / 구간 전면개편 / 페이지 전면개편 모드로 나뉘어 확장되어야 한다.`
