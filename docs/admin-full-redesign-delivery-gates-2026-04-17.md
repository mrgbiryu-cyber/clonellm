# 관리자 전면개편 단계형 완료 기준

작성일: 2026-04-17

## 목적

이 문서는 전면개편 구현이 `최소안`에서 멈추지 않도록, 각 트랙별로 아래 4단계 기준을 고정한다.

1. `착수 기준`
2. `중간 완료 기준`
3. `최종 완료 기준`
4. `테스트 통과 기준`

핵심 원칙은 단순하다.

- `최소안`은 목표가 아니라 `착수 게이트`다.
- 각 트랙은 `최종 완료 기준`이 충족되기 전까지 완료로 보지 않는다.
- `asset pipeline`은 보조 작업이 아니라 독립 트랙이다.

컴포넌트 전체 분류 기준은 아래 문서를 함께 본다.

- [관리자 컴포넌트 리빌드 대상 분류표](./admin-component-rebuild-classification-2026-04-17.md)
- [관리자 컴포넌트 리빌드 스키마 패밀리](./admin-component-rebuild-schema-families-2026-04-17.md)

---

## 1. 전체 트랙

전면개편 구현은 아래 4개 트랙으로 관리한다.

1. `컴포넌트 전면개편`
2. `구간 전면개편`
3. `페이지 전면개편`
4. `asset pipeline`

권장 순서는 아래다.

1. `컴포넌트 전면개편 + asset pipeline 착수`
2. `구간 전면개편 + asset pipeline 중간 완료`
3. `페이지 전면개편 + asset pipeline 최종 완료`
4. `통합 테스트`

---

## 2. 트랙 A — 컴포넌트 전면개편

### 2.0 범위 원칙

이 트랙의 대상은 `5개 컴포넌트`가 아니다.

실제 대상은:

- 15개 페이지에 존재하는 전면개편 후보 컴포넌트 전체

다만 구현과 검증은 아래처럼 나눈다.

- `파일럿 검증 대상`
  - renderer 구조를 먼저 검증하기 위한 선행 컴포넌트 묶음
- `1차 롤아웃 대상`
  - 홈/홈스타일/구독 메인의 핵심 전면개편 컴포넌트 묶음
- `전체 롤아웃 대상`
  - 15개 페이지 전체에서 전면개편이 필요한 컴포넌트 묶음

즉 `2개`, `5개` 같은 숫자는 전체 수량이 아니라 `게이트 통과용 검증 표본`이다.

### 2.1 착수 기준

아래가 모두 있으면 착수 가능으로 본다.

- `component composition schema` 초안
- 최소 2개 대상 컴포넌트 정의
- `component rebuild renderer` 뼈대
- patch 결과와 rebuild 결과를 구분하는 저장 포맷
- 최소 자산 연결 규칙
  - icon reference
  - image slot mapping
  - badge preset reference

### 2.2 중간 완료 기준

아래가 모두 되면 중간 완료로 본다.

- 파일럿 검증 대상 최소 2개가 rebuild renderer로 실제 미리보기 가능
- builder가 `component-rebuild-plan`을 생성하면 renderer가 그 결과를 읽어 화면에 반영
- 기존 patch preview와 전면개편 preview를 같은 화면에서 비교 가능
- rebuild 결과를 draft/version으로 저장 가능
- fallback rule 존재
  - 새 schema 일부 누락 시 patch preview로만 후퇴

### 2.3 최종 완료 기준

아래가 모두 되면 컴포넌트 전면개편 트랙 완료다.

- 파일럿 검증 대상이 아니라 `전체 롤아웃 대상` 기준으로 지원 계획과 구현 상태가 관리됨
- 1차 롤아웃 대상 최소 5개 이상 지원
- 15개 페이지 전체에 대해 `component rebuild required / patch sufficient` 분류표가 존재
- 전면개편 필요 컴포넌트는 페이지별로 누락 없이 backlog에 등록됨
- child/repeater 구조 변경 지원
- 신규 visual/icon/badge slot 연결 지원
- 버전 저장 후 재호출 시 동일 schema로 안정 복원
- 비교 화면에서 `기존 / 전면개편안` 차이를 사용자 수준에서 읽을 수 있음

### 2.4 테스트 통과 기준

- 동일 컴포넌트에 대해 `light / medium / strong / full` 모두 결과 차이가 분명함
- schema 누락, asset 누락, child 수 mismatch에서 안전하게 degrade
- version save -> reload -> compare가 유지됨
- 최소 3회 반복 실행에서 renderer crash 없음

### 2.5 대상 분류 방식

컴포넌트 트랙은 아래 순서로 분류한다.

1. `파일럿 검증 대상`
   - renderer 구조를 가장 빨리 검증할 수 있는 컴포넌트
2. `1차 롤아웃 대상`
   - 홈/홈스타일/구독 메인의 핵심 전면개편 컴포넌트
3. `전체 롤아웃 대상`
   - 15개 페이지 전체에서 전면개편이 필요한 컴포넌트

### 2.6 현재 파일럿 검증 대상

- `home.hero`
- `home.quickmenu`

### 2.7 현재 1차 롤아웃 대상

- `home.hero`
- `home.quickmenu`
- `home.best-ranking`
- `care-solutions.hero`
- `homestyle-home.hero`

이 5개는 `전체 대상`이 아니라 `1차 롤아웃 표본`이다.

---

## 3. 트랙 B — 구간 전면개편

### 3.1 착수 기준

아래가 모두 있으면 착수 가능이다.

- `group composition schema` 초안
- `targetGroupId`별 preset 정의
- group-level layout rhythm field 정의
  - order
  - spacing
  - background cadence
  - emphasis
- 여러 컴포넌트를 한 묶음으로 렌더할 renderer skeleton

### 3.2 중간 완료 기준

- `home-top`과 `home-middle` 2개 그룹을 전면개편 미리보기 가능
- 각 그룹 내 컴포넌트 order 변경 가능
- 그룹 공통 배경/간격/리듬 반영 가능
- 그룹 단위 compare/save 가능
- component rebuild와 group renderer가 충돌하지 않음

### 3.3 최종 완료 기준

- `home-top`, `home-middle`, `care-solutions-top`, `homestyle-home-top` 지원
- 그룹 내 컴포넌트 숨김/치환/강조 지원
- 그룹 공통 visual language preset 지원
- builder가 `section-composition-plan`을 생성하면 preview에 직접 반영
- 그룹 단위 version 저장 및 재호출 안정화

### 3.4 테스트 통과 기준

- 같은 페이지에서 상단/중단/하단 다른 그룹을 각각 독립 실행 가능
- 그룹 간 renderer state 오염 없음
- 그룹 reorder 후 reload 시 결과 복원
- 최소 3개 그룹에서 강함/전면 실행 결과 검증 완료

---

## 4. 트랙 C — 페이지 전면개편

### 4.1 착수 기준

아래가 모두 있으면 착수 가능이다.

- `page composition schema` 초안
- section ordering/grouping model 정의
- 신규 section placeholder model 정의
- 페이지 전용 preview renderer skeleton
- page-level save/version/pin extension 계획

### 4.2 중간 완료 기준

- `home` 또는 `homestyle-home` 1개 페이지에서 full-page composition preview 가능
- section reorder가 실제 렌더링에 반영
- 신규 section placeholder가 화면에 노출
- suppress/hide section 동작
- 기존 patch preview와 full-page preview 전환 가능

### 4.3 최종 완료 기준

- `home`, `homestyle-home`, `care-solutions` 지원
- section reorder / insert / suppress / regroup 모두 지원
- page-level composition version 저장 가능
- pin 단계에서 full-page composition preview를 실제 대표 view 후보로 취급 가능
- composition preview와 runtime clone 적용 경계가 명확히 구분됨

### 4.4 테스트 통과 기준

- 페이지 전면개편안 저장 후 reload/pin candidate 복원
- section 수 증가/감소 상황에서 renderer 안정성 유지
- 최소 3개 페이지에서 `page x full` 실행 검증 완료
- planner -> builder -> preview -> version까지 끊김 없음

---

## 5. 트랙 D — Asset Pipeline

### 5.1 원칙

이 트랙은 `최소안으로 시작하되 최소안에서 끝내지 않는다.`

따라서 아래 3단계 완료 기준을 강제로 둔다.

- `착수 기준`
- `중간 완료 기준`
- `최종 완료 기준`

### 5.2 착수 기준

아래가 모두 있어야 renderer 개발 착수가 가능하다.

- `icon registry`
- `badge/token preset`
- `image slot mapping`
- `asset reference schema`
- asset 누락 시 fallback rule

이 단계는 어디까지나 `개발 착수용`이다.

### 5.3 중간 완료 기준

아래가 모두 있어야 component/group 테스트 가능으로 본다.

- 주요 컴포넌트용 icon set 연결
- hero/banner 대표 visual set
- badge style set
- 카드/리스트용 thumbnail preset
- asset override와 fallback 동시 지원

### 5.4 최종 완료 기준

아래가 모두 되면 asset pipeline 완료다.

- 페이지군별 visual set
  - home
  - homestyle-home
  - care-solutions
- 구간별 art direction preset
- icon/badge/thumbnail/hero visual 운영 규칙 문서화
- 신규 asset upload/reference 흐름 정의
- renderer와 builder가 같은 asset id 체계를 사용

### 5.5 테스트 통과 기준

- asset 누락 시 fallback이 깨지지 않음
- 동일 composition이 reload 후 같은 asset을 재사용
- 페이지/구간/컴포넌트 모드 모두 asset reference가 일관됨
- 최소 3개 페이지에서 visual asset 교체 시나리오 검증 완료

### 5.6 자산 보강 스케줄

asset pipeline은 `시작만 최소형`으로 두고, 아래 웨이브를 모두 지나야 완료로 본다.

#### Wave 1. 착수 자산

목적:

- renderer 개발을 막지 않도록 starter 자산 체계를 연다.

범위:

- icon registry
- badge preset
- hero visual starter set
- thumbnail preset starter set
- asset reference schema
- fallback rule

#### Wave 2. 컴포넌트 전면개편용 자산

목적:

- component rebuild를 실제 미리보기 수준까지 끌어올린다.

범위:

- `home.hero`, `home.quickmenu`, `home.best-ranking` 전용 자산 세트
- `care-solutions.hero`, `homestyle-home.hero` 전용 자산 세트
- component별 badge/icon/thumbnail override
- component별 visual tone preset

#### Wave 3. 구간 전면개편용 자산

목적:

- 상단/중단/하단을 하나의 art direction으로 읽히게 만든다.

범위:

- group art direction preset
- 공통 background cadence preset
- group-level icon/badge consistency rules
- hero와 하위 카드 간 visual bridge asset

#### Wave 4. 페이지 전면개편용 자산

목적:

- 페이지 전체가 임시 목업이 아니라 실제 제안 시안처럼 보이게 만든다.

범위:

- page family visual set
- 신규 section placeholder visual set
- page-level art direction preset
- upload/reference 운영 규칙

원칙:

- Wave 1에서 멈추면 `착수만 한 상태`다.
- Wave 2가 되어야 component rebuild 품질을 평가할 수 있다.
- Wave 3가 되어야 section redesign 품질을 평가할 수 있다.
- Wave 4가 되어야 page redesign 품질을 평가할 수 있다.

---

## 6. 단계별 게이트

### Gate 1. 컴포넌트 전면개편 착수 승인

필수:

- 트랙 A 착수 기준 충족
- 트랙 D 착수 기준 충족

### Gate 2. 구간 전면개편 착수 승인

필수:

- 트랙 A 중간 완료 기준 충족
- 트랙 D 중간 완료 기준 충족

### Gate 3. 페이지 전면개편 착수 승인

필수:

- 트랙 B 중간 완료 기준 충족
- 트랙 D 중간 완료 기준 충족

### Gate 4. 전체 통합 테스트 승인

필수:

- 트랙 A 최종 완료 기준 충족
- 트랙 B 최종 완료 기준 충족
- 트랙 C 최종 완료 기준 충족
- 트랙 D 최종 완료 기준 충족

---

## 7. 완료 판정 원칙

아래는 완료로 인정하지 않는다.

- 최소 schema만 있음
- renderer skeleton만 있음
- 문서상 `가능`하다고만 적힘
- asset mapping 없이 fallback만 존재
- preview는 되지만 save/version/reload가 안 됨

아래가 되어야 완료다.

- planner 입력이 builder/renderer까지 이어짐
- 실제 preview가 보임
- version 저장 후 복원됨
- asset reference가 끊기지 않음
- 반복 테스트를 통과함

---

## 8. 현재 권장 실행 순서

1. `component composition schema + renderer`
2. `asset pipeline 착수 기준` 동시 충족
3. `hero`, `quickmenu`로 component rebuild 실제 미리보기
4. `home.best-ranking`, `care-solutions.hero`, `homestyle-home.hero`까지 component rebuild 확장
5. `group composition schema + renderer`
6. `home-top`, `home-middle` 구간 전면개편 미리보기
7. `page composition schema + renderer`
8. `home`, `homestyle-home`, `care-solutions` 전체 전면개편 미리보기
9. version/pin까지 포함한 통합 테스트
