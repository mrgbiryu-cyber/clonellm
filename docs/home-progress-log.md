# Home Progress Log

> 먼저 읽을 기준 문서:
> `docs/project-purpose-reference.md`

## Purpose

이 문서는 `home` 작업의 실제 진행 상황을 누적 기록한다.

기록 목적은 3가지다.

1. 현재 메인 `/clone/home`에서 어디까지 수용 가능한지 빠르게 확인
2. 어떤 섹션이 `sandbox` 단계인지, 어떤 섹션이 `main` 반영됐는지 추적
3. Claude/Codex가 다음 작업을 시작할 때 이미 실패한 시도와 현재 활성 작업을 바로 확인

관련 기준 문서:

- `docs/project-purpose-reference.md`
- `docs/project-consolidated-status.md`
- `docs/home-remediation-plan.md`
- `docs/decision-history.md`

## Current Baseline

기준 날짜: `2026-04-11`

현재 메인 `/clone/home`에서 잠정 수용 가능한 영역:

1. `header-top`
2. `header-bottom`
3. `GNB panels`
4. `hero`
5. `quickmenu`
6. `promotion`
7. `MD's CHOICE`
8. `timedeal`
9. `best-ranking`

현재 원칙:

1. 신규 하단 섹션은 메인에 바로 넣지 않는다
2. `homeSandbox=<slot>`에서 먼저 맞춘다
3. 시각 수용 가능 후 메인 반영
4. 반영 후 `data-codex-slot` 기준 component 후보로 유지

## Active Target

현재 다음 작업 대상:

1. `brand-showroom` sandbox 구조 확인
2. `latest-product-news` sandbox 구조 확인
3. 두 섹션 모두
   - 위치
   - 폭
   - 앞/뒤 섹션 순서
   - data source
   - runtime dependency
   를 먼저 기록
4. sandbox 시각 확인 후
   - custom renderer로 갈지
   - mobile-derived section 유지로 갈지
   결정

## Status Legend

- `planned`: 아직 시작 전
- `in-progress`: sandbox 또는 코드 작업 중
- `accepted-sandbox`: sandbox에서 시각 수용
- `accepted-main`: 메인 `/clone/home` 반영 완료
- `blocked`: 원인 확인 전까지 진행 중단
- `reverted`: 시도 후 되돌림

## Section Status

| section | status | source | note |
|---|---|---|---|
| `header-top` | `accepted-main` | `pc-like` | 메인 수용 |
| `header-bottom` | `accepted-main` | `pc-like` | 메인 수용 |
| `gnb-panels` | `accepted-main` | `pc-like` | 타입별 정리 완료 |
| `hero` | `accepted-main` | `pc-like` | 현재 기준선 유지 |
| `quickmenu` | `accepted-main` | `mobile-derived` | visual truth 기준 잠금 |
| `promotion` | `accepted-main` | `mobile-derived` | quickmenu 아래 프로모션 |
| `md-choice` | `accepted-main` | `mobile-derived` | 이미지 복구 완료 |
| `timedeal` | `accepted-main` | `mobile-derived` | 2카드 + 이미지 복구 완료 |
| `best-ranking` | `accepted-main` | `custom-renderer` | sandbox 후 메인 반영 완료 |
| `brand-showroom` | `main-reflected` | `mobile-derived` | 메인 `clone-content/home`에서 mobile-derived slot 교체 반영 |
| `latest-product-news` | `main-reflected` | `mobile-derived` | 메인 `clone-content/home`에서 mobile-derived slot 교체 반영 |
| `smart-life` | `main-reflected` | `mobile-derived` | 메인 `clone-content/home`에서 mobile-derived slot 교체 반영 |
| `space-renewal` | `main-reflected` | `mobile-derived` | 메인 `clone-content/home`에 `best-ranking` 뒤 `subscription` 앞 순서로 반영 |
| `subscription` | `main-reflected` | `mobile-derived` | 메인 `clone-content/home`에서 mobile-derived slot 교체 반영 |
| `missed-benefits` | `main-reflected` | `mobile-derived` | 메인 `clone-content/home`에서 mobile-derived slot 교체 반영 |
| `lg-best-care` | `main-reflected` | `mobile-derived` | 메인 `clone-content/home`에서 mobile-derived slot 교체 반영 |
| `bestshop-guide` | `main-reflected` | `mobile-derived` | 메인 `clone-content/home`에서 mobile-derived slot 교체 반영 |
| `summary-banner-2` | `main-reflected` | `mobile-derived` | 메인 `clone-content/home`에서 `메인 하단 배너 영역` slot으로 반영 |

## Log

### 2026-04-11 01

- 홈 상단부와 중단부를 현재 메인 기준선으로 고정
- `best-ranking`을 첫 반복 가능한 하단 패턴으로 확정
- `best-ranking`은 `raw import`가 아니라 `custom renderer + actual data injection`으로 메인 반영 완료
- 하단 신규 섹션은 `sandbox -> acceptance -> main` 원칙으로만 진행하기로 합의

### 2026-04-11 02

- `project-consolidated-status.md`에 Section 13 `홈 하단 실행 협의 프로토콜` 추가
- Claude 점검 결과를 반영해 아래 3개를 구현 전 합의 조건으로 고정
  1. `data-source`는 실제 확인값만 사용
  2. 삽입 앵커는 live reference 순서와 연결
  3. anchor 미존재 시 fallback을 먼저 결정

### 2026-04-11 03

- 현재 활성 작업을 `brand-showroom`으로 지정
- 아직 코드 반영 전
- 먼저 live reference 기준 순서/폭/source/runtime을 기록한 뒤 sandbox로 들어갈 예정


### 2026-04-11 04

- `brand-showroom` mobile raw section 존재 확인
- 순서 확인: `브랜드 쇼룸 -> 최신 제품 소식 -> 슬기로운 가전생활`
- raw section에는 이미지가 없어서 placeholder/template 상태임을 확인
- 샌드박스용 `brand-showroom` section 추출 및 template 이미지 주입 경로 추가
- 현재는 sandbox에서만 확인 가능하도록 구현 진행 중


### 2026-04-11 05

- 포트 3000 기존 서버를 최신 코드로 교체
- `homeSandbox=brand-showroom` 경로를 최신 서버 기준으로 활성화
- 다음 단계는 sandbox visual 확인 후 폭/이미지/간격 보정


### 2026-04-11 06

- `brand-showroom` sandbox HTML 응답 확인
- section root: `data-codex-slot="brand-showroom"`
- mobile raw section을 사용하고 template placeholder에 대표 이미지 주입 완료
- 다음 단계: sandbox 스크린샷 기준으로 폭/간격/이미지 품질 보정


### 2026-04-11 07

- `latest-product-news` mobile raw section 존재 확인
- 제품 링크 10개에서 `og:image` 추출 완료
- sandbox용 `latest-product-news` section 추출 및 template 이미지 주입 경로 추가
- 현재 `brand-showroom`, `latest-product-news` 둘 다 sandbox 응답 경로 준비 완료


### 2026-04-11 08

- `brand-showroom`, `latest-product-news` 둘 다 `data-codex-slot` 기준 sandbox 응답 확인
- 진행 로그와 디버깅을 위해 lower-content section에 `data-codex-source` 추가
  - `md-choice`: `mobile-derived`
  - `timedeal`: `mobile-derived`
  - `best-ranking`: `custom-renderer`
  - `brand-showroom`: `mobile-derived`
  - `latest-product-news`: `mobile-derived`
- 현재 단계에서는 두 섹션 모두 메인 반영 금지
- 사용자 확인 전까지는 sandbox 응답/삽입 위치/이미지 주입 상태만 유지


### 2026-04-11 09

- `brand-showroom` sandbox 응답 기준
  - 대표 링크/타이틀 6개 주입 확인
  - template placeholder에 이미지 주입 확인
- `latest-product-news` sandbox 응답 기준
  - 대표 링크/타이틀 10개 주입 확인
  - 실제 상품 이미지 절대경로 주입 확인
- headless screenshot 자동화는 현재 환경에서 즉시 안정화되지 않아서, 이 두 섹션은 다음 사용자 확인 시 sandbox 경로로 직접 검토 예정


### 2026-04-11 10

- `home` 하단 렌더 경로에 최소 `slot registry` 구조 도입
- 대상 slot:
  - `md-choice`
  - `timedeal`
  - `best-ranking`
  - `subscription`
  - `brand-showroom`
  - `latest-product-news`
- 현재는 화면 변경이 아니라 렌더 경로 정리 단계
- 목적:
  1. 신규 하단 섹션을 분기 추가가 아니라 slot entry 추가로 다루기
  2. 나중에 `activeSourceId` 기준 source 전환이 가능한 구조로 이행
  3. `brand-showroom` 이후 섹션을 `view-first + registry-first` 원칙으로 진행


### 2026-04-11 11

- `smart-life` mobile raw section boundary 확인
  - `HomeMoListVerticaltype_list_verticaltype__...`
- 대표 스토리 4건의 `og:image` 수집 완료
- `smart-life` sandbox용 section 추출 / template 이미지 주입 경로 추가
- `homeSandbox=smart-life`로 기존 lower slot registry를 통해 렌더 가능하도록 연결
- 현재 단계는 sandbox 준비만 완료, 메인 반영 아님


### 2026-04-11 12

- `brand-showroom`에 `homeVariant=custom` variant A/B 추가
- 목적:
  1. raw/mobile-derived section과 별도로 custom card grid 실험
  2. `homeSandbox + homeVariant` 조합으로 source/variant 전환 가능성 검증
  3. LLM이 나중에 `slotId + sourceId/variant`를 바꾸는 구조의 최소 형태 확보
- 현재 메인은 unchanged
- 확인 경로:
  - 기본: `/clone/home?homeSandbox=brand-showroom`
  - custom: `/clone/home?homeSandbox=brand-showroom&homeVariant=custom`


### 2026-04-11 13

- `latest-product-news`에 `homeVariant=custom` variant A/B 추가
- 현재 구조:
  - 기본: `mobile-derived`
  - custom: `custom-renderer`
- custom variant는 실제 상품 이미지/제목 6건을 사용한 2열 카드 grid
- 목적:
  1. `brand-showroom`과 동일한 비교 방식으로 `latest-product-news`도 source/variant A/B 가능하게 만들기
  2. 메인 반영 전 sandbox에서 `mobile-derived vs custom-renderer`를 시각 판단하기
  3. 하단 slot registry가 단순 분기 집합이 아니라 실제 variant 경로를 탈 수 있는지 검증하기
- 현재 메인은 unchanged
- 확인 경로:
  - 기본: `/clone/home?homeSandbox=latest-product-news`
  - custom: `/clone/home?homeSandbox=latest-product-news&homeVariant=custom`


### 2026-04-11 14

- 홈 하단 작업 루프를 다시 고정
- 현재 합의:
  1. 작업리스트는 사용자가 정리한 live reference 순서로 고정
  2. 각 섹션은 먼저 mobile raw section 매핑 확인
  3. 이미지/자산/텍스트를 원문 기준으로 하나씩 확인
  4. 이미 실패한 방식과 목적 문서, Claude 피드백을 함께 반영
  5. `mobile-derived`로 충분한 섹션은 메인에서 바로 정리
  6. `custom-renderer`가 필요한 섹션만 sandbox 유지
- 이 기준으로 이후 섹션은 `brand-showroom`, `latest-product-news`, `smart-life`를 같은 pack으로 묶어 진행


### 2026-04-11 15

- 홈 완료 이후 상위 실행 순서도 고정
- 합의된 순서:
  1. 홈에서 각 화면으로 이동하는 링크 정리
  2. 각 화면 범위를 기존 히스토리 기준으로 복원
  3. `mobile / pc` 분기 먼저 판정
  4. 두 분기를 모두 브라우저와 코드 기준으로 검증
  5. 완료 후 `LLM-editable`이 아닌 항목 추출
  6. 그 항목을 slot/source/variant/component 기준 리스트로 재정리
  7. 흔들림 없는지 다시 확인한 뒤 pre-LLM foundation 완료로 판단
- 의미:
  - 홈 시각 작업은 독립 과제가 아니라 이후 전 페이지 / LLM 전환의 기준선이다


### 2026-04-11 16

- LLM 전 인터랙션 축을 별도 스케줄로 분리
- 새 기준 문서 추가:
  - `docs/interaction-implementation-plan.md`
- 핵심 결정:
  1. view fix만으로 LLM에 들어가지 않음
  2. `interaction inventory`와 baseline interaction 구현이 선행되어야 함
  3. interaction도 나중에 `LLM-editable list`로 승격해야 함
  4. `home.gnb.open`, `home.hero.carousel`, `home.quickmenu.carousel`, `home.lower.slider`, `pdp.gallery.carousel` 등이 우선 대상


### 2026-04-11 17

- 시각 판정은 마지막에 사용자가 한 번에 진행
- 그 전에는 Codex가 섹션 묶음별 screenshot compare loop로 계속 정렬
- 현재 합의:
  1. `reference screenshot vs current clone screenshot`를 섹션 묶음별로 저장/비교
  2. 차이는 `structure / style / interaction`으로 분류
  3. 기본 도구는 기존 `capture_visual_snapshots.py`, `capture_states.mjs`, `/compare/:pageId`
  4. 외부 이미지 분석 모듈은 기존 도구로 부족할 때만 제한적으로 추가


### 2026-04-11 18

- `scripts/capture_home_lower_sections.mjs` 추가
- `brand-showroom`, `latest-product-news`, `smart-life`에 대해 section 단위 compare artifact 생성
- 산출물 경로:
  - `data/visual/home-lower/brand-showroom/`
  - `data/visual/home-lower/latest-product-news/`
  - `data/visual/home-lower/smart-life/`
- 각 경로에 저장:
  1. `live-reference.png`
  2. `working.png`
  3. `metadata.json`
- 의미:
  - 홈 하단 mobile-derived pack에 대해 `reference screenshot vs current clone screenshot` 루프가 실제로 작동하기 시작함


### 2026-04-11 19

- `space-renewal` mobile lower section은 raw class import가 아니라 embedded mobile data(`메인 추천 상품 영역`) 기반으로 확정
- sandbox slot 추가: `homeSandbox=space-renewal`
- source는 현재 `custom-renderer`로 분류
- compare script에 `space-renewal` target 추가 및 selector retry/fallback 보강

### 2026-04-11 20

- `missed-benefits`, `lg-best-care`, `bestshop-guide`의 raw mobile section class 확인
- 세 섹션 모두 lower slot registry에 sandbox 경로 추가
- 현재 단계는 section boundary 확보가 목적이며, 이미지/자산 주입은 다음 단계

### 2026-04-11 21

- `brand-showroom`, `latest-product-news`, `smart-life`, `missed-benefits`, `lg-best-care`, `bestshop-guide`를 메인 `clone-content/home`에서 기존 `data-area` 자리를 기준으로 직접 교체
- 새 섹션을 footer 뒤에 끼워 넣는 방식이 아니라, 원래 메인 순서를 유지한 채 mobile-derived slot으로 전환
- 현재 메인에는 위 6개 섹션의 `data-codex-slot`이 실제로 들어온 상태

### 2026-04-11 22

- `space-renewal`은 custom renderer보다 raw mobile `HomeMoListBannertype` section이 더 정확하다고 판단
- `메인 추천 상품 영역`의 실제 raw section과 embedded data를 함께 확인
- current plan:
  1. raw mobile section 추출
  2. 이미지 주입 규칙 보정
  3. compare artifact 재생성
  4. 이후 메인 반영 여부 판단

### 2026-04-11 23

- `space-renewal`을 raw mobile `HomeMoListBannertype` 기반 `mobile-derived` slot으로 전환
- 메인 `clone-content/home`에서 `best-ranking -> space-renewal -> subscription -> brand-showroom` 순서 확인
- `subscription`도 같은 방식으로 `mobile-derived` slot으로 전환

### 2026-04-11 24

- `summary banner`는 raw mobile `메인 상단 배너 영역`, `summary banner 2`는 raw mobile `메인 하단 배너 영역`으로 매핑
- `homestyle-explore`는 독립 lower section보다는 `홈스타일` 캠페인 이름으로 읽힌 케이스일 가능성이 높다고 정리
- 현재 home lower의 실질적 남은 병목은:
  1. `summary banner 2` 자산 주입
  2. `homestyle-explore` 최종 canonical mapping
  3. interaction baseline

### 2026-04-11 25

- `summary-banner-2`를 메인 `clone-content/home`의 기존 `메인 하단 배너 영역` 자리에 직접 반영
- 메인 하단 slot 순서:
  `best-ranking -> space-renewal -> subscription -> brand-showroom -> latest-product-news -> smart-life -> summary-banner-2 -> missed-benefits -> lg-best-care -> bestshop-guide`
- compare 루프 대상을 `subscription`, `summary-banner-2`까지 확장

### 2026-04-11 26

- `home.hero.carousel` baseline interaction 구현 시작
- 기존 hero runtime에 빠져 있던 `autoplay start`, `pause/resume`, `visibilitychange` 처리를 추가
- hero root에 `data-codex-interaction-id="home.hero.carousel"` 부여
- `best-ranking`에도 최소 탭 interaction baseline 추가
  1. click/keyboard arrow로 active tab 전환
  2. root에 `data-codex-interaction-id="home.best-ranking.tabs"` 부여
- 현재 판단:
  1. `hero`는 이제 visual + baseline interaction 축이 같이 움직이기 시작함
  2. `quickmenu`, `timedeal`, lower slider는 다음 패스에서 inventory 후 추가 보강

### 2026-04-11 27

- `home.gnb.open`에도 interaction 식별자와 open state를 남기도록 정리
  1. open panel root에 `data-codex-interaction-id="home.gnb.open"`
  2. `data-codex-open-state=open/closed`
- slot measurement payload에 interaction 상태 수집 추가
  1. `hero`: active slide / slide count
  2. `best-ranking`: active category / tab count
- 의미:
  - 이제 interaction은 단순 runtime 동작이 아니라, 이후 registry/LLM 단계에서 읽을 수 있는 상태 데이터로도 남기기 시작함

### 2026-04-11 28

- `buildWorkingSlotSnapshot(home)`를 하단 slot까지 확장
- 이제 working slot snapshot에도 아래가 포함됨:
  1. `md-choice`
  2. `timedeal`
  3. `best-ranking`
  4. `space-renewal`
  5. `subscription`
  6. `brand-showroom`
  7. `latest-product-news`
  8. `smart-life`
  9. `summary-banner-2`
  10. `missed-benefits`
  11. `lg-best-care`
  12. `bestshop-guide`
- `buildWorkingInteractionSnapshot(home)`에도 baseline interaction 추가
  1. `home.hero.carousel`
  2. `home.best-ranking.tabs`
- 의미:
  - 홈 하단은 이제 단순 렌더 결과가 아니라 `slot/source/interaction` 모델에서도 추적 가능한 상태로 올라오기 시작함

### 2026-04-11 29

- `quickmenu`, `timedeal`도 interaction 식별자와 baseline snapshot에 포함
  1. `home.quickmenu.nav`
  2. `home.timedeal.cards`
- clone runtime에서 각 slot root에 `data-codex-interaction-id`를 부여
- measurement payload에도 아래 상태를 추가
  1. `quickmenu`: itemCount / rowCount / columnCount
  2. `timedeal`: visibleCardCount
- 현재 홈 interaction baseline 상태:
  1. `home.gnb.open` 구현됨
  2. `home.hero.carousel` baseline 구현됨
  3. `home.best-ranking.tabs` baseline 구현됨
  4. `home.quickmenu.nav` / `home.timedeal.cards`는 baseline state 추적 가능

### 2026-04-11 30

- `home.gnb.open` aggregate interaction snapshot 추가
- 기존 per-menu open(`gnb-product-open` 등)과 별개로,
  1. `interactionId = home.gnb.open`
  2. `mode = overlay`
  3. `menuCount = 7`
  를 working snapshot에서 직접 읽을 수 있게 정리
- overlay root 자체에도
  1. `data-codex-interaction-id="home.gnb.open"`
  2. `data-codex-open-state="closed|open"`
  를 부여

### 2026-04-11 31

- 홈 하단 major slot을 interaction snapshot에도 추가
- 현재 working interaction snapshot에는 아래가 포함됨:
  1. `home.subscription.section`
  2. `home.space-renewal.section`
  3. `home.brand-showroom.section`
  4. `home.latest-product-news.section`
  5. `home.smart-life.section`
  6. `home.summary-banner-2.section`
  7. `home.missed-benefits.section`
  8. `home.lg-best-care.section`
  9. `home.bestshop-guide.section`
- 의미:
  - 홈 하단은 이제 visual clone에만 존재하는 상태가 아니라, interaction inventory에서도 section 단위로 식별 가능해짐

### 2026-04-11 32

- `homestyle-explore`는 독립 lower section이 아니라 `hero/top promotion campaign label`로 닫음
- home lower main completion 기준에서는 제외
- 홈 링크 정책 보강 시작:
  1. 기존 archive URL 매핑 외에
  2. `PDP visual index` 기반 `href -> pageId` 역매핑을 clone runtime에 주입
  3. 캡처가 있는 상품 링크는 홈에서도 `/clone-product?...`로 연결 가능하게 확장 중

### 2026-04-11 33

- `buildWorkingInteractionSnapshot()`를 home 밖으로 확장 시작
- 현재 baseline inventory 추가:
  1. `category-*`: `plp.filter.open`, `plp.sort.open`, `plp.product-card.hover`, `pdp.gallery.carousel`, `pdp.gallery.thumbnail.sync`, `pdp.option.select`, `pdp.review.expand`, `pdp.qna.expand`
  2. `support`: `support.tab.switch`, `support.accordion.open`
  3. `bestshop`: `bestshop.shortcut.nav`
  4. `care-solutions`: `support.tab.switch`
- 의미:
  - 이제 interaction inventory는 `home` 한 페이지 실험이 아니라, 실제 LLM 전환에 필요한 page-family baseline으로 확장되기 시작함

### 2026-04-11 34

- home lower accepted slot에 `component boundary` 속성 추가 시작
  1. `data-codex-component-id`
  2. `data-codex-active-source-id`
- 현재 정책:
  - lower mobile-derived slot은 `home.<slotId>`
  - `best-ranking`은 `home.best-ranking`
- 의미:
  - accepted-main home lower section은 이제 `slot/source`뿐 아니라 `component` 단위로도 구분되기 시작함
  - 이후 LLM editable list를 만들 때 바로 재사용 가능

### 2026-04-11 35

- `working component inventory` API 추가
- 경로:
  - `/api/component-inventory?pageId=home&source=working`
- 현재 내려주는 필드:
  1. `componentId`
  2. `slotId`
  3. `activeSourceId`
  4. `containerMode`
  5. `kind`
  6. `itemCount`
  7. `interactionIds`
- 의미:
  - home은 이제 DOM 태그뿐 아니라 API 레벨에서도 `component/source/interaction`을 함께 읽을 수 있게 됨

### 2026-04-11 36

- `home` 상단 slot snapshot에도 sourceId를 명시
  1. `header-top` -> `pc-like`
  2. `header-bottom` -> `pc-like`
  3. `hero` -> `pc-like`
  4. `quickmenu` -> `mobile-derived`
- 의미:
  - component inventory에서 home 전체가 `sourceId` 기준으로 더 일관되게 읽힘

### 2026-04-11 37

- `pre-LLM readiness` API 추가
- 경로:
  - `/api/llm-readiness?pageId=home&source=working`
- 현재 체크 축:
  1. `component-id`
  2. `source-id`
  3. `interaction-links`
  4. `editable-schema`
  5. `rollback-rule`
- 현재 global gap:
  1. component-level rollback rules incomplete
  2. link coverage needs browser-state verification
  3. interaction verification schema incomplete

### 2026-04-11 38

- `component editability` catalog 추가
- 경로:
  - `/api/component-editability?pageId=home&source=working`
- 현재 home component별로 아래를 정의하기 시작함:
  1. `editableProps`
  2. `editableStyles`
  3. `editableInteractions`
- 결과:
  - `editable schema incomplete`는 global gap에서 제거
  - 이제 남은 핵심 gap은 rollback / link coverage / verification schema 쪽으로 좁혀짐

### 2026-04-11 39

- `component rollback` / `interaction verification` catalog 추가
- 경로:
  - `/api/component-rollback?pageId=home&source=working`
  - `/api/interaction-verification?pageId=home&source=working`
- 정책:
  1. rollback은 현재 `rerender-from-active-source`
  2. interaction verification은 interactionId별 check set을 문서화된 API로 제공
- 결과:
  - `component-level rollback rules incomplete` 제거
  - `interaction verification schema incomplete` 제거
  - 현재 남은 global gap은 `link coverage needs browser-state verification` 한 축으로 좁혀짐

### 2026-04-11 40

- `scripts/verify_home_link_coverage.mjs`를 `clone/home` shell이 아니라 `#clone-frame` iframe 내부 기준으로 수정
- `npm run verify:home-links` 추가
- 결과 보고서:
  - `data/reports/home-link-coverage.json`
- 현재 보고서 요약:
  1. verified slots = `12/12`
  2. `clone-product = 1`
  3. `clone-page = 0`
  4. `blocked = 126`
  5. `external = 1`

### 2026-04-11 41

- `/api/llm-readiness?pageId=home&source=working`가 실제 `home-link-coverage.json`을 읽도록 변경
- 현재 `home` readiness:
  1. `overallStatus = pass`
  2. `globalGaps = []`
  3. `linkCoverage` 요약 포함
- 의미:
  - home은 working 기준에서 `component/source/editability/rollback/interaction verification/link verification`까지 한 축으로 읽힌다

### 2026-04-11 42

- known page-family 링크 정책 추가:
  1. `bestshop.lge.co.kr/*` or `/bestshop*` -> `/clone/bestshop`
  2. `/care-solutions*`, `/category/care-solutions*` -> `/clone/care-solutions`
  3. `/support*` -> `/clone/support`
  4. `/lg-signature*` -> `/clone/lg-signature-info`
  5. `/objet-collection*` -> `/clone/objet-collection-story`
- 갱신된 home link coverage:
  1. `clone-product = 1`
  2. `clone-page = 62`
  3. `blocked = 64`
  4. `external = 1`
- 실제로 전환된 주요 slot:
  - `subscription`
  - `brand-showroom`
  - `bestshop-guide`

### 2026-04-11 43

- page-family working readiness를 pass 기준으로 올렸다.
- 현재 pass:
  1. `category-tvs`
  2. `category-refrigerators`
  3. `support`
  4. `bestshop`
  5. `care-solutions`
- 방법:
  1. existing workbench group 재사용
  2. working interaction snapshot 결합
  3. 정적 섹션은 `interaction not required`로 분리

### 2026-04-11 44

- workspace-side slot registry / source switch API 추가
- 경로:
  1. `GET /api/workspace/slot-registry?pageId=home`
  2. `GET /api/workspace/slot-variants?pageId=home&slotId=<id>`
  3. `POST /api/workspace/slot-source`
- 추가 수정:
  - `normalizeEditableData()`가 기존 `activeSourceId`를 보존하도록 수정
- 의미:
  - 이제 workspace 기준으로 slot source state를 바꾸는 최소 경로가 생겼다

### 2026-04-11 45

- home workspace slot registry 범위를 실제 accepted-main 수준으로 확장
- 추가된 slot:
  1. `best-ranking`
  2. `space-renewal`
  3. `subscription`
  4. `brand-showroom`
  5. `latest-product-news`
  6. `smart-life`
  7. `summary-banner-2`
  8. `missed-benefits`
  9. `lg-best-care`
  10. `bestshop-guide`
- 의미:
  - workspace/LLM이 다룰 수 있는 home slot registry가 현재 화면 구성과 훨씬 가까워졌다

### 2026-04-11 46

- workspace source state를 실제 `clone/home` 렌더 경로에 연결했다.
- 변경 경로:
  1. `readDataForRequest(req)`의 workspace data를 `rewriteCloneHtml()`까지 전달
  2. home 상단 slot의 `data-codex-active-source-id`를 workspace active source 기준으로 출력
  3. home lower slot registry가 workspace `activeSourceId`를 읽어 실제 render 분기를 선택
- 실제 연결된 slot:
  1. `hero`
  2. `best-ranking`
  3. `brand-showroom`
  4. `latest-product-news`
- 실제 반영 방식:
  1. `hero`
     - `custom-home-hero-v1`, `figma-home-hero-v1` 선택 시 hero control style variant 반영
  2. `best-ranking`
     - `figma-home-best-ranking-v1` 선택 시 `codex-home-best-ranking--figma` class 반영
  3. `brand-showroom`
     - `custom-home-brand-showroom-v1` 선택 시 custom renderer 반영
  4. `latest-product-news`
     - `custom-home-latest-product-news-v1` 선택 시 custom renderer 반영
- 검증 결과:
  1. workspace API에서 바꾼 `activeSourceId`가 실제 `clone-content/home` HTML에 반영됨
  2. `best-ranking`은 figma class까지 실제 반영됨

### 2026-04-11 47

- workspace-aware component inventory API 추가
- 경로:
  1. `GET /api/workspace/component-inventory?pageId=<id>`
  2. `GET /api/workspace/component-editability?pageId=<id>`
  3. `GET /api/workspace/component-rollback?pageId=<id>`
  4. `GET /api/workspace/interaction-verification?pageId=<id>`
  5. `GET /api/workspace/llm-readiness?pageId=<id>`
- 의미:
  1. 이제 authenticated workspace는 저장된 `activeSourceId`와 실제 render path를 같은 기준으로 읽을 수 있다.
  2. source switch UI와 component inventory가 서로 다른 source state를 보던 문제를 줄였다.
- 실제 검증:
  1. `hero=custom-home-hero-v1`
  2. `best-ranking=figma-home-best-ranking-v1`
  3. `brand-showroom=custom-home-brand-showroom-v1`
  상태에서
  - `/clone-content/home`
  - `/api/workspace/component-inventory?pageId=home`
  둘 다 동일한 active source를 반환함

### 2026-04-11 48

- workspace component patch/apply 최소 버전 추가
- 경로:
  1. `GET /api/workspace/component-patches?pageId=<id>`
  2. `GET /api/workspace/component-patches?pageId=<id>&componentId=<id>&sourceId=<id>`
  3. `POST /api/workspace/component-patch`
- 현재 patch/render 연결 대상:
  1. `home.best-ranking`
  2. `home.brand-showroom`
  3. `home.latest-product-news`
- 현재 patch 가능한 최소 범위:
  1. `title`
  2. `subtitle` (best-ranking)
  3. `moreLabel` (best-ranking)
  4. `styles.titleColor`
  5. `styles.subtitleColor`
  6. `styles.background`
  7. `styles.radius`
- 실제 검증:
  1. `home.best-ranking`에 title/subtitle/moreLabel/style patch 저장
  2. `home.brand-showroom`에 title/style patch 저장
  3. 저장 후 `clone-content/home`에 patch 내용이 실제 반영됨

### 2026-04-11 49

- workspace component inventory에 patch 상태 추가
- 현재 `GET /api/workspace/component-inventory?pageId=home`는 각 component에 아래 값을 포함함:
  1. `hasPatch`
  2. `patchKeys`
- 실제 검증:
  - `home.best-ranking` patched 상태에서 inventory가
    1. `activeSourceId = figma-home-best-ranking-v1`
    2. `hasPatch = true`
    3. `patchKeys = ["title", "subtitle"]`
    를 반환함
- 의미:
  - 프론트는 이제 `source switch + patch 존재 여부 + patch key`를 한 번에 읽을 수 있다.

### 2026-04-11 50

- non-home workspace registry 확장
- 추가 pageId:
  1. `support`
  2. `bestshop`
  3. `care-solutions`
  4. `category-tvs`
  5. `category-refrigerators`
- 구현:
  1. `llm.js`에 page-family default slot registry 추가
  2. `auth.js`에서 기존 workspace도 `normalizeEditableData()`를 거치도록 수정
  3. `server.js`에 working group selector 기반 generic slot annotation 추가

### 2026-04-11 51

- non-home generic patch/render 실제 검증
- 확인 완료:
  1. `support.mainService`
     - `figma-support-mainService-v1`
     - title/subtitle/style patch가 `clone-content/support`에 실제 반영됨
  2. `bestshop.hero`
     - `figma-bestshop-hero-v1`
     - style/subtitle patch가 `clone-content/bestshop`에 실제 반영됨
  3. `care-solutions.hero`
     - `figma-care-solutions-hero-v1`
     - style/subtitle patch가 `clone-content/care-solutions`에 실제 반영됨
  4. `category-tvs.banner`
     - `figma-category-tvs-banner-v1`
     - workspace inventory와 clone HTML의 active source 일치 확인

- 현재 해석:
  1. home에서 닫은 `slot-source -> component-patch -> render -> inventory` 최소 루프가 page-family로 확장됐다.
  2. category는 우선 `banner`만 render-bound이고, `productGrid/firstRow/firstProduct`는 다음 단계다.

### 2026-04-11 52

- workspace patch schema 노출 및 sanitization 추가
- 반영 API:
  1. `GET /api/workspace/component-editability?pageId=<id>`
  2. `POST /api/workspace/component-patch`
- 추가 동작:
  1. 각 component가 `patchSchema`를 내려줌
  2. 저장 시 허용되지 않은 root/style key는 제거됨
- 실제 검증:
  1. `support.mainService`에 `unknownRoot`, `styles.unknownColor`를 포함해 patch 전송
  2. 응답 patch에서 해당 키들이 제거됨
  3. sanitized patch만 `clone-content/support` HTML에 실제 반영됨

### 2026-04-11 53

- page-family generic patch schema를 slot 구조 기준으로 축소/정리
- 이유:
  1. `support.notice`
  2. `care-solutions.tabs`
  3. `care-solutions.ranking`
  4. `care-solutions.benefit`
  는 모두 `title/subtitle` 2필드 모델로 보기 어려웠음
- 반영:
  1. `support.notice` -> `visibility`, `background`, `radius`만 허용
  2. `care-solutions.tabs` -> `visibility`, `background`, `radius`만 허용
  3. `care-solutions.ranking` -> `title` + style 일부만 허용
  4. `care-solutions.benefit` -> `title` + style 일부만 허용
- 해석:
  1. generic patch는 “모든 slot에 같은 schema”가 아니라 “실제 DOM 의미와 맞는 schema”만 노출하는 방향으로 전환됐다.

### 2026-04-11 54

- page-family safe slot 실제 patch/apply 재검증
- 확인 완료:
  1. `bestshop.review`
     - `figma-bestshop-review-v1`
     - title/subtitle patch가 `clone-content/bestshop`에 실제 반영됨
  2. `care-solutions.benefit`
     - `figma-care-solutions-benefit-v1`
     - title patch가 `clone-content/care-solutions`에 실제 반영됨
  3. `care-solutions.careBanner`
     - `figma-care-solutions-careBanner-v1`
     - title/subtitle patch가 `clone-content/care-solutions`에 실제 반영됨
  4. `category-refrigerators.banner`
     - `figma-category-refrigerators-banner-v1`
     - active source 및 component boundary가 `clone-content/category-refrigerators`에 실제 반영됨

- 현재 해석:
  1. `home`에서 닫은 source switch / patch / render / inventory 루프가
  2. `bestshop`, `care-solutions`, `category-refrigerators`까지 실질적으로 확장됐다.

### 2026-04-11 55

- `pre-LLM gap` API 추가
- 반영 API:
  1. `GET /api/workspace/pre-llm-gaps?pageId=<id>`
- 반환:
  1. `overallStatus`
  2. `globalGaps`
  3. `componentGapCount`
  4. warning/fail component 목록
- 실제 확인:
  1. `home`
  2. `support`
  3. `bestshop`
  4. `care-solutions`
  5. `category-tvs`
  6. `category-refrigerators`
  모두 `pass`, `componentGapCount=0`

- 해석:
  1. 현재 accepted page-family 기준으로는 pre-LLM 구조 gap이 더 이상 남지 않는다.
  2. 다음 병목은 구조가 아니라 최종 visual batch와 프론트 편집 UI 연결이다.

### 2026-04-11 56

- `web/admin.html` 확장
- 현재 admin 화면에서 바로 확인/조작 가능:
  1. `workspace component inventory`
  2. `slot source switch`
  3. `component patch load/apply`
  4. `pre-LLM gap` 표시
  5. `/clone/:pageId` iframe preview
- 의미:
  1. API만 있는 상태를 넘어서
  2. 브라우저 프론트에서 `source -> patch -> preview` 루프를 직접 다룰 수 있는 진입점이 생겼다.

### 2026-04-11 57

- visual batch runner 추가
- 반영:
  1. `scripts/capture_visual_batch.mjs`
  2. `npm run capture:visual-batch`
  3. `GET /api/visual-batch-summary`
- 목적:
  1. `home`
  2. `home-lower`
  3. `service-pages`
  4. `plp`
  artifact를 최종 visual acceptance 전에 한 번에 갱신하기 위함

- 추가 보정:
  1. `capture_home_lower_sections.mjs`에 명시적 종료 추가
  2. batch runner에는 timeout 추가
  3. `admin`은 summary가 생기면 visual batch 상태를 표시하도록 연결

### 2026-04-11 58

- visual review manifest 추가
- 반영 API:
  1. `GET /api/visual-review-manifest`
- 포함:
  1. `home` compare/live/working
  2. `home-lower` slot별 live/working/metadata
  3. `servicePages` compare + pc/mo artifact
  4. `plpPages` compare + pc/mo artifact
- `admin`은 현재 선택한 page 기준으로 compare/review 링크를 바로 노출하도록 확장

### 2026-04-11 59

- `LLM editable list` API 추가
- 반영 API:
  1. `GET /api/workspace/llm-editable-list?pageId=<id>`
- 실제 확인된 count:
  1. `home` → `16`
  2. `support` → `4`
  3. `bestshop` → `4`
  4. `care-solutions` → `5`
  5. `category-tvs` → `10`
  6. `category-refrigerators` → `10`

- 의미:
  1. 이제 pre-LLM `pass/fail`만이 아니라
  2. 실제로 LLM이 바로 편집 가능한 component 목록까지 page 기준으로 조회할 수 있다.

### 2026-04-11 60

- `final acceptance runbook` 추가
- 문서:
  1. `docs/final-acceptance-runbook.md`
- 운영 UI:
  1. `/admin`의 `Final Acceptance Bundles`
  2. 전체 recommended order 표시
  3. 현재 page 관련 bundle 표시

- 의미:
  1. 마지막 visual acceptance가 고정된 bundle 순서로 진행된다.
  2. 문서 / API / admin이 같은 acceptance 기준을 공유한다.

### 2026-04-11 61

- `final readiness` API 추가
- 반영 API:
  1. `GET /api/workspace/final-readiness`
- 현재 값:
  1. `overallStatus = ready-for-acceptance`
  2. `visualBatchStatus = pass`
  3. `acceptanceBundleCount = 8`
  4. `failingPages = []`

- 의미:
  1. 이제 acceptance 직전 상태를 한 API로 읽을 수 있다.
  2. `/admin` 상단 meta도 이 값을 기준으로 표시한다.

### 2026-04-11 62

- workspace acceptance 결과 저장 경로 추가
- 반영 API:
  1. `GET /api/workspace/acceptance-results?pageId=<id>`
  2. `POST /api/workspace/acceptance-result`
- `admin`의 `Final Acceptance Bundles`에서 bundle별
  1. `pending/pass/fail`
  2. 메모
  를 직접 저장 가능
- `final-readiness`에 acceptance 진행률 집계 추가
- 실제 저장 검증:
  1. `home-core -> pass`
  2. note: `auto verification`
  3. 저장 후 결과 재조회 정상

### 2026-04-11 63

- acceptance 결과 API에 진행 요약 추가
- 추가 반환:
  1. `overallStatus`
  2. `pageSummaries[]`
  3. `nextPendingBundle`
- `/admin`은 현재 page 기준
  1. acceptance pass/fail/pending count
  2. next pending bundle
  을 함께 표시

### 2026-04-11 64

- `final-readiness`에 acceptance 기반 LLM gate 추가
- 추가 반환:
  1. `llmGateStatus`
  2. `pages[].acceptanceStatus`
  3. `pages[].acceptanceCounts`
- 현재 기준:
  1. 전체 acceptance bundle이 모두 `pass` 되기 전까지
  2. `llmGateStatus = blocked-by-acceptance`
- `/admin`은 상단 meta에 `llm gate`를 같이 표시

### 2026-04-11 65

- `/admin` Pages 패널에 acceptance 필터 추가
- 필터:
  1. `all`
  2. `pending`
  3. `fail`
  4. `accepted`
- 페이지 리스트는 acceptance 상태와 pending 수 기준으로 정렬되고,
  필터로 바로 좁혀 볼 수 있게 됨

### 2026-04-11 66

- `/admin` detail의 acceptance 영역 시각 강조 추가
- 반영:
  1. bundle status별 배경/테두리 강조
  2. `Open Next Pending Compare`
  3. `Current page failed bundles` 목록
- 의미:
  1. pending/fail bundle을 detail 안에서 바로 우선 처리할 수 있다.

### 2026-04-11 67

- acceptance 저장 후 auto-advance UX 추가
- 현재 page의 bundle이 모두 `pass`가 되면
  `/admin`은 다음 `needs-review/in-progress` page로 이동 가능
- 의미:
  1. acceptance 운영이 page 단위로 끊기지 않고 계속 이어진다.

### 2026-04-11 68

- acceptance 운영 규칙 강화
- `fail` 저장 시
  1. client에서 note 필수
  2. server에서도 `fail_note_required`로 강제
- 의미:
  1. 이유 없는 fail 상태 저장을 막는다.

### 2026-04-11 69

- `/admin` Pages 패널에 acceptance summary bar 추가
- 표시:
  1. `overall acceptance pass / total`
  2. `llm gate`
  3. `next actionable page`
  4. completion progress bar
- 의미:
  1. acceptance 운영 상태를 페이지 리스트 영역에서 바로 읽을 수 있다.

### 2026-04-11 70

- server가 `final-readiness.nextActionablePageId`를 직접 반환
- `/admin`은 이 값을 우선 사용
- `llmGateStatus !== ready-for-llm`일 때
  1. `Apply with OpenRouter` 버튼 비활성화
  2. status에 `LLM blocked` 표시
- 의미:
  1. acceptance 완료 전 LLM 변경이 UI에서 직접 차단된다.

### 2026-04-11 71

- `final-readiness`에 전역 `nextAcceptanceTarget` 추가
- `/admin` Pages 패널 상단에서
  1. 다음 acceptance bundle
  2. compare 바로가기
  를 노출
- 의미:
  1. 현재 page를 보지 않아도 전역 다음 검수 대상을 바로 열 수 있다.

### 2026-04-11 72

- `POST /api/llm/change`에 server-side gate 추가
- `llmGateStatus !== ready-for-llm`이면
  1. `error = llm_gate_blocked`
  2. `nextActionablePageId`
  3. `nextAcceptanceTarget`
  를 반환하고 요청 거부
- `/admin` summary bar에는 `Go To Next Page` 버튼 추가

### 2026-04-11 73

- acceptance 저장 시 activity log 이벤트 추가
- event type:
  1. `acceptance_result_saved`
- detail:
  1. `bundleId`
  2. `pageId`
  3. `status`
  4. `note`
- 의미:
  1. acceptance 변경 내역이 workspace activity에서 bundle 단위로 추적된다.

### 2026-04-11 74

- 문서에 추가된 bug note를 코드 기준으로 재검토
- 결과:
  1. `Bug 1 homeVariant bypass` → 실제 버그, 수정 완료
  2. `Bug 2 figma source render path` → 부분 수용
  3. `Bug 3 main-reflected acceptance gap` → gate 대상 API를 잘못 짚은 것으로 보정
- 실제 수정:
  1. `brand-showroom` render에서 `homeVariant=custom` 우회 제거

### 2026-04-11 75

- `figma/custom source`가 실제 renderer인지 fallback인지 코드에서 명시적으로 계산하도록 보강
- 추가 필드:
  1. `sourceResolution`
  2. `resolvedRenderSourceId`
  3. `resolvedRenderSourceType`
  4. `sourceResolutionDetail`
- 적용 위치:
  1. `/api/workspace/component-inventory`
  2. `/api/workspace/llm-readiness`
  3. home lower section DOM metadata
  4. `/admin` component card
- 검증:
  1. `brand-showroom = figma-home-brand-showroom-v1`
  2. inventory 결과 `fallback-mobile-derived`
  3. DOM 결과 `data-codex-source-resolution=\"fallback-mobile-derived\"`
  4. readiness는 `pass` 유지, advisory로만 노출

### 2026-04-11 76

- fallback/advisory 집계를 readiness와 admin 운영면에 추가
- 추가 집계:
  1. `pre-llm-gaps.fallbackComponentCount`
  2. `pre-llm-gaps.advisoryComponentCount`
  3. `final-readiness.fallbackComponentCount`
  4. `final-readiness.advisoryComponentCount`
  5. `final-readiness.pages[].fallbackComponentCount`
- `/admin` 반영:
  1. pages summary에 전역 fallback/advisory count 표시
  2. page row에 fallback/advisory count 표시
  3. detail의 `Pre-LLM Gaps`에 fallback component 목록 표시
  4. activity panel에서 `acceptance_result_saved` 강조
- 실검증:
  1. `home.brand-showroom`을 figma source로 전환
  2. `pre-llm-gaps`에서 fallback `1`
  3. `final-readiness`에서 fallback `1`

### 2026-04-11 77

- acceptance 결과 API에 bundle별 검수 맥락 추가
- `GET /api/workspace/acceptance-results?pageId=<id>`
  - 각 item에 `bundleContext` 포함:
    1. `componentGapCount`
    2. `fallbackComponentCount`
    3. `componentGaps[]`
    4. `fallbackComponents[]`
- `pageSummaries[]`에도 누적:
  1. `componentGapCount`
  2. `fallbackComponentCount`
- `/admin`의 `Final Acceptance Bundles` 카드에 표시:
  1. `bundle gaps`
  2. `fallback`
  3. `fallback slots`
  4. `gap slots`
- 실검증:
  1. `home-lower-primary.bundleContext.fallbackComponentCount = 1`
  2. `home.pageSummary.fallbackComponentCount = 1`

### 2026-04-11 78

- acceptance `nextPendingBundle` 선정 로직을 단순 순서에서 risk 우선으로 변경
- 기준:
  1. `componentGapCount`
  2. `fallbackComponentCount`
- 추가 필드:
  1. `bundleContext.reviewPriority`
  2. `bundleContext.riskScore`
  3. `pageSummaries[].maxRiskScore`
- `/admin` 반영:
  1. page acceptance summary에 `max risk`
  2. bundle 카드에 `priority`
- 실검증:
  1. `brand-showroom` fallback 상태에서
  2. `home-lower-primary`가 `nextPendingBundle`
  3. `reviewPriority = medium`
  4. `riskScore = 10`

### 2026-04-11 79

- page 단위 acceptance 우선순위도 risk 기준으로 정렬
- 반영:
  1. `final-readiness.nextActionablePageId`
  2. `/admin` page list sort
  3. `/admin` fallback/advisory/risk 표시
- page 정렬 기준:
  1. `acceptanceStatus`
  2. `maxRiskScore`
  3. `fallbackComponentCount`
  4. `pending count`
- 실검증:
  1. `home.maxRiskScore = 10`
  2. 나머지 page는 `0`
  3. `nextActionablePageId = home`

### 2026-04-11 80

- 전역 acceptance queue 추가
- 새 API:
  1. `GET /api/workspace/acceptance-queue?pageId=<id>`
- 정렬 기준:
  1. `status` (`fail` 우선)
  2. `riskScore`
  3. `bundleId`
- `/admin` 반영:
  1. `Final Acceptance Bundles` 섹션에 `Acceptance queue`
  2. 상위 5개 bundle의 `risk / priority` 노출
- 실검증:
  1. `queueCount = 3` (`home`)
  2. `next.bundleId = home-lower-primary`
  3. top queue에서 `home-lower-primary`가 risk `10`으로 1순위

### 2026-04-11 81

- `final-readiness`에 전역 queue preview 연결
- 추가:
  1. `nextAcceptanceTarget`가 queue 기준을 우선 사용
  2. `acceptanceQueuePreview` 상위 5개
- `/admin` Pages summary에 표시:
  1. `queue preview`
  2. `next acceptance target`
  3. global compare 버튼
- 실검증:
  1. `nextAcceptanceTarget.bundleId = home-lower-primary`
  2. `acceptanceQueuePreview[0].bundleId = home-lower-primary`

### 2026-04-11 82

- `/admin` acceptance 저장 후 다음 검수 대상으로 자동 유도 흐름 보강
- 수정:
  1. 저장 핸들러의 `pageId` 오참조 제거
  2. 현재 detail page 기준 `currentPageId`로 accepted 판정/다음 page 이동 계산
  3. 같은 page에 머무는 경우 다음 pending bundle card로 자동 스크롤
  4. 다음 pending bundle에 compare 링크가 있으면 해당 버튼으로 focus 이동
- DOM 보강:
  1. bundle compare 링크에 `data-acceptance-compare-link`
  2. next pending marker 유지
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `focusNextPendingBundle()` 경로와 `currentPageId` 참조 존재 확인

### 2026-04-11 83

- `/admin` acceptance queue에서 page/bundle 직접 이동 추가
- 추가:
  1. `navigateToBundle(pageId, bundleId)`
  2. queue item마다 `Go To Bundle`
  3. page 전환 후 target bundle card 자동 강조
- 목적:
  1. queue를 본 뒤 다시 page 목록을 찾는 단계 제거
  2. risk 높은 bundle을 바로 detail로 따라가게 함
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `jump-acceptance-target-btn` / `navigateToBundle()` 존재 확인

### 2026-04-11 84

- `/admin` 상단 summary에도 `Go To Next Bundle` 추가
- 기준:
  1. `finalReadinessMeta.nextAcceptanceTarget`
  2. `pageId + bundleId`를 같이 사용
- 동작:
  1. 전역 next acceptance target을 바로 연다
  2. 해당 page detail 렌더 후 bundle card를 강조한다
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `jumpNextBundleBtn` 존재 확인

### 2026-04-11 85

- `Workspace Activity`를 acceptance 운영면으로 보강
- 추가:
  1. activity filter: `all / acceptance`
  2. `acceptance_result_saved` 이벤트 row에서 `Go To Bundle`
- 동작:
  1. acceptance 이벤트만 따로 본다
  2. 이벤트 row에서 해당 `pageId + bundleId` detail로 즉시 이동
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `activityFilter`, `data-activity-filter`, `activity-jump-btn` 존재 확인

### 2026-04-11 86

- `Current page failed bundles`와 `Page acceptance summary`도 jump entry로 전환
- 추가:
  1. page summary row에 `Go To Page`
  2. page summary row에 `Go To Next Bundle`
  3. current failed bundle row에 `Go To Bundle`
  4. failed bundle compare 링크 재노출
- 계산:
  1. page별 `next bundle`은 `fail > pending`, 그 다음 `riskScore` 우선
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `pageNextBundleMap`, `jump-page-btn` 존재 확인

### 2026-04-11 87

- `Recommended order`도 read-only 목록에서 jump entry로 전환
- 추가:
  1. `Go To Page`
  2. `Go To Bundle`
  3. compare 링크 재노출
- 의미:
  1. acceptance 운영면의 모든 주요 목록이 동일한 navigation 규칙을 사용
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. recommended order 항목에 jump 버튼 렌더 확인

### 2026-04-11 88

- `/admin` 상태를 URL query로 고정
- 추가:
  1. `pageId`
  2. `bundleId`
  3. `pageFilter`
  4. `activityFilter`
- 동작:
  1. 새로고침 후에도 현재 page/bundle 유지
  2. jump 후 해당 bundle 강조 상태 유지
  3. 필터 상태도 query로 같이 남음
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `readAdminStateFromUrl()` / `syncAdminStateUrl()` / `selectedBundleId` 존재 확인

### 2026-04-11 89

- `/admin` browser history 대응 추가
- 변경:
  1. 주요 navigation/filter 변경 시 `history.pushState`
  2. `popstate`에서 URL state를 다시 읽고 `refreshData()`
- 대상:
  1. page row click
  2. next page / next bundle
  3. queue jump / activity jump / bundle jump
  4. page filter
  5. activity filter
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `syncAdminStateUrl(\"push\")`, `window.addEventListener(\"popstate\")` 존재 확인

### 2026-04-11 90

- acceptance 저장 후 `bundleId` query가 stale하게 남던 흐름 수정
- 변경:
  1. 저장 후 현재 page가 accepted되면 `selectedBundleId` 초기화
  2. 같은 page에 `nextPendingBundleId`가 있으면 `selectedBundleId`를 그 값으로 갱신
  3. 위 상태를 즉시 URL에 반영
- 목적:
  1. 포커스 이동과 URL 상태를 일치시킴
  2. 저장 직후 새로고침해도 같은 next bundle을 다시 열게 함
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. save handler에서 `selectedBundleId = nextPendingBundleId` 경로 확인

### 2026-04-11 91

- `/admin` Pages summary에 현재 runtime page 범위 숫자 고정
- 현재 기준:
  1. `core pages = 6`
  2. `info pages = 2`
  3. `plp pages = 2`
  4. `pdp route = 1`
- 목적:
  1. 운영 중 “총 몇 페이지/PLP/PDP가 준비됐는가”를 UI에서 바로 확인
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `runtime pages:` 요약 문자열 존재 확인

### 2026-04-11 92

- runtime page 숫자 요약을 UI 하드코딩에서 server 계산값으로 전환
- 추가:
  1. `buildRuntimePageSummary(data)` in `server.js`
  2. `/api/data` 응답에 `runtimePageSummary`
- `/admin` 변경:
  1. summary 숫자를 `data.runtimePageSummary`에서 읽음
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `buildRuntimePageSummary`, `runtimePageSummary` 키 존재 확인

### 2026-04-11 93

- `/admin` detail에 범위/링크 근거 직접 노출
- 추가:
  1. `Runtime Page Scope`
  2. `Home Link Coverage` (`home` page 한정)
- server 확장:
  1. `linkCoverage.targets[]` 추가
  2. `clone-page / clone-product / external` target 샘플 노출
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `Runtime Page Scope`, `Home Link Coverage`, `linkCoverage.targets` 문자열 존재 확인

### 2026-04-11 94

- runtime page 범위를 route catalog 형태로 확장
- server:
  1. `runtimePageSummary.routeCatalog[]`
  2. type: `core-page`, `info-page`, `plp-page`, `pdp-route`
- `/admin`:
  1. `Runtime Page Scope`에서 id + type + route 직접 노출
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `routeCatalog`, `core-page`, `pdp-route` 존재 확인

### 2026-04-11 95

- page별 known issue를 server truth로 고정
- 추가:
  1. `buildPageOperationalAdvisories()`
  2. `/api/data -> pageAdvisories`
  3. `/admin` detail -> `Page Advisories`
- 현재 포함:
  1. `home` hybrid shell 주의
  2. `care-solutions` GNB 이중 노출 경고
  3. `category-*` shared PDP route 안내
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `Duplicate GNB under header`, `Page Advisories` 존재 확인

### 2026-04-11 96

- page advisory를 detail 전용이 아니라 list/summary에도 반영
- 추가:
  1. `getPageAdvisoryMeta(pageId)`
  2. summary의 `page advisories / warning pages / error pages`
  3. page row의 `page advisory count / severity`
- 목적:
  1. detail에 들어가기 전부터 known issue가 보이게 함
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `page advisories:` / `page advisory ... severity ...` 문자열 존재 확인

### 2026-04-11 97

- advisory를 실제 페이지 탐색 필터로 확장
- 추가:
  1. `advisoryFilter`
  2. `All Advisories`
  3. `Warning+`
  4. `Error`
  5. `Has Advisory`
- 동작:
  1. acceptance 상태 filter와 advisory filter를 함께 적용
  2. URL query에도 advisory filter 상태 유지
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `advisoryFilter`, `data-advisory-filter` 존재 확인

### 2026-04-11 98

- advisory 우선순위를 client 표시가 아니라 server readiness 계산에 반영
- 추가:
  1. `buildPageAdvisoryMetaMap()`
  2. `pageAdvisoryCount`
  3. `highestAdvisorySeverity`
  4. `advisoryRiskScore`
- 반영:
  1. `final-readiness.pages[]`
  2. `nextActionablePageId` 정렬 tie-breaker
  3. `/admin` summary/page row는 server 값 우선 사용
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `buildPageAdvisoryMetaMap`, `advisoryRiskScore`, `pageAdvisoryCount` 존재 확인

### 2026-04-11 99

- acceptance queue / failed bundle 카드에 advisory 맥락을 직접 노출
- `/admin` 추가:
  1. queue item의 `advisory count / severity`
  2. `page advisories: severity:title`
  3. failed bundle에도 동일 advisory 메타 표시
- 목적:
  1. risk 숫자만이 아니라 왜 먼저 봐야 하는 bundle인지 즉시 보이게 함
  2. `care-solutions` 같은 known issue가 queue 레벨에서도 숨지 않게 함
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `Acceptance queue`, `Current page failed bundles`, `page advisories:` 문자열 존재 확인

### 2026-04-11 100

- `/admin` 상단 summary의 `next acceptance target`에도 advisory 맥락을 추가
- 추가:
  1. target advisory count / severity
  2. target risk score
  3. queue preview에 `advN` 표기
- 목적:
  1. 첫 화면에서 바로 왜 이 bundle이 다음 검수 대상인지 이해할 수 있게 함
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `next acceptance target:` / `queue preview: ... adv` 문자열 존재 확인

### 2026-04-11 101

- page row 자체를 acceptance entry point로 확장
- server:
  1. `final-readiness.pages[]`에 `nextBundleId / nextBundleStatus / nextBundleRiskScore / nextBundleCompareUrl` 추가
- `/admin`:
  1. page row에 `next bundle` 메타 직접 노출
  2. `Go To Next Bundle`
  3. `Open Compare`
- 목적:
  1. page 선택 -> detail -> bundle 선택의 한 단계를 줄임
- 실검증:
  1. `node --check server.js`
  2. `web/admin.html` script compile `SCRIPT_OK`
  3. `nextBundleId`, `Go To Next Bundle`, `next bundle ... risk` 존재 확인

### 2026-04-11 102

- `/admin` 상단 `queue preview`를 텍스트에서 직접 이동 버튼으로 전환
- 추가:
  1. `jump-summary-bundle-btn`
  2. preview item 클릭 시 `navigateToBundle(pageId, bundleId)`
- 목적:
  1. summary에서 바로 top queue bundle로 들어가게 해 detail/queue 재탐색을 줄임
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `jump-summary-bundle-btn` 존재 확인

### 2026-04-11 103

- `/admin` page row HTML 구조 정상화
- 변경:
  1. row container를 `<button>`에서 `<div role="button" tabindex="0">`로 전환
  2. nested button/link와의 충돌 제거
  3. `Enter` / `Space` keyboard entry 추가
- 목적:
  1. invalid nested interactive HTML 제거
  2. page row + inline action button 동작을 브라우저에서 안정화
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `role="button"`, `aria-pressed`, `keydown` 존재 확인

### 2026-04-11 104

- `/admin` deep link copy 추가
- 추가:
  1. summary `Copy Current Link`
  2. detail `Copy Page Link`
  3. `copyCurrentAdminLink()` helper
- 포함 상태:
  1. `pageId`
  2. `bundleId`
  3. `pageFilter`
  4. `activityFilter`
  5. `advisoryFilter`
- 목적:
  1. 현재 검수 위치를 바로 공유/재진입할 수 있게 함
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `copyCurrentAdminLink`, `Copy Current Link`, `Copy Page Link` 존재 확인

### 2026-04-11 105

- acceptance 카드에 `Pass & Next` 단축 액션 추가
- 추가:
  1. `saveAcceptanceDecision()` 공용 helper
  2. `pass-next-acceptance-btn`
- 동작:
  1. status를 바로 `pass`로 저장
  2. 기존 auto-advance / next bundle focus 흐름 재사용
- 목적:
  1. 가장 자주 쓰는 검수 동작에서 status select 변경 한 단계를 제거
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `Pass & Next`, `pass-next-acceptance-btn`, `saveAcceptanceDecision()` 존재 확인

### 2026-04-11 106

- acceptance fail note preset 추가
- preset:
  1. `visual mismatch`
  2. `layout/spacing mismatch`
  3. `fallback source still active`
  4. `duplicate header/gnb`
- 동작:
  1. preset 클릭 시 note 채움
  2. status를 `fail`로 자동 전환
- 목적:
  1. fail note 필수 규칙은 유지하면서 반복 입력 비용을 줄임
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `acceptance-note-preset-btn`, `Preset selected` 존재 확인

### 2026-04-11 107

- acceptance 카드에 `Fail & Save` 단축 액션 추가
- 동작:
  1. status를 `fail`로 즉시 전환
  2. 현재 note로 바로 저장
  3. fail note 필수 규칙은 그대로 유지
- 목적:
  1. note를 수동 입력한 경우 status select 조작 한 단계를 제거
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `Fail & Save`, `fail-save-acceptance-btn` 존재 확인

### 2026-04-11 108

- acceptance note keyboard shortcut 추가
- 추가:
  1. `Ctrl/Meta+Enter` 현재 status 저장
  2. `Alt+Enter` `pass` 저장 + next 흐름
  3. `runAcceptanceSave()` helper
- 목적:
  1. note 입력 중 마우스 이동 없이 저장/통과 처리
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `Ctrl/Meta+Enter`, `Alt+Enter`, `runAcceptanceSave` 존재 확인

### 2026-04-11 109

- current page `next pending bundle`에 직접 포커스 액션 추가
- 추가:
  1. `focusCurrentNextPendingBundle()`
  2. `Focus Next Pending` 버튼
- 목적:
  1. detail 상단 정보에서 바로 해당 bundle 카드로 점프하게 함
  2. hidden marker 기반 next bundle 포커스 경로를 사용자 액션과 연결
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `focusCurrentNextPendingBundle`, `Focus Next Pending`, `data-next-pending-bundle-id` 존재 확인

### 2026-04-11 110

- `/admin` 상단 notice 추가
- helper:
  1. `showAdminNotice(message, type)`
- 현재 연결:
  1. `Copy Current Link`
  2. `Copy Page Link`
  3. `Acceptance saved`
  4. `Fail note is required`
  5. `Copy failed`
- 목적:
  1. copy/save 계열 동작의 성공/실패 피드백을 즉시 노출
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `adminNotice`, `showAdminNotice`, `Acceptance saved` 존재 확인

### 2026-04-11 111

- acceptance fail preset에 double-click quick save 추가
- 동작:
  1. 단일 클릭: note 채움 + status `fail`
  2. double-click: note 채움 + `fail` 즉시 저장
- 카드 안내 문구도 갱신
- 목적:
  1. 반복되는 실패 사유를 더 적은 클릭으로 기록
  2. 단일 클릭 자동 저장의 실수 가능성은 피함
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `preset double-click fail & save`, `dblclick` 존재 확인

### 2026-04-11 112

- acceptance note에 `Shift+Enter` fail save 단축 추가
- 동작:
  1. status를 `fail`로 전환
  2. 현재 note로 바로 저장
  3. server의 fail note 규칙은 그대로 적용
- 카드 shortcut 안내 문구 갱신
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `Shift+Enter`, `shiftKey`, `runAcceptanceSave("fail")` 존재 확인

### 2026-04-11 113

- bundle 단위 deep link copy 추가
- helper:
  1. `buildAdminStateUrl(pageId, bundleId)`
  2. `copyAdminLinkFor(pageId, bundleId)`
- 추가 위치:
  1. current page bundles
  2. acceptance queue
  3. current page failed bundles
- notice:
  1. `Bundle link copied: <bundleId>`
- 목적:
  1. 특정 bundle 재검수 링크를 바로 공유/재진입할 수 있게 함
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `Copy Bundle Link`, `copyAdminLinkFor`, `Bundle link copied` 존재 확인

### 2026-04-11 114

- `Copy Bundle Link` 적용 범위를 전역 목록까지 확장
- 추가 위치:
  1. `Page acceptance summary`의 next bundle
  2. `Recommended order`
- 목적:
  1. summary/recommended list에서도 바로 bundle deep link를 복사하게 함
  2. queue/failed/current bundle과 동선을 일관되게 맞춤
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `Copy Bundle Link`가 summary/recommended 영역에도 존재 확인

### 2026-04-11 115

- deep link target bundle persistent highlight 추가
- 추가:
  1. `.acceptance-selected-target`
  2. `selected bundle target` 라벨
- 동작:
  1. `selectedBundleId`와 같은 bundle 카드에 지속 강조 적용
  2. 기존 일시적 focus animation과 별도로 유지됨
- 목적:
  1. 새로고침/재진입 시 어떤 bundle이 URL target인지 계속 보이게 함
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `acceptance-selected-target`, `selected bundle target` 존재 확인

### 2026-04-11 116

- selected bundle deep link 해제 액션 추가
- `/admin` summary:
  1. `Clear Bundle Target`
- 동작:
  1. `selectedBundleId` 제거
  2. URL query에서 `bundleId` 제거
  3. page-only detail 상태로 복귀
- notice:
  1. `Bundle target cleared`
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `Clear Bundle Target`, `clearBundleTargetBtn`, `Bundle target cleared` 존재 확인

### 2026-04-11 117

- summary `next acceptance target`에 direct copy 추가
- `/admin` summary:
  1. `Copy Next Bundle Link`
- 동작:
  1. `finalReadinessMeta.nextAcceptanceTarget`의 `pageId + bundleId` deep link 복사
  2. notice: `Bundle link copied: <bundleId>`
- 목적:
  1. 상단 summary에서 바로 다음 검수 대상을 공유/전달할 수 있게 함
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `Copy Next Bundle Link`, `copyNextBundleBtn` 존재 확인

### 2026-04-11 118

- page-level deep link copy를 summary/list까지 확장
- 추가:
  1. summary `Copy Next Page Link`
  2. page row `Copy Page Link`
- notice:
  1. `Page link copied: <pageId>`
- 목적:
  1. page jump와 page copy 동선을 같은 밀도로 맞춤
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `Copy Next Page Link`, `copyNextPageBtn`, `copy-page-link-btn` 존재 확인

### 2026-04-11 119

- current page bundle 카드에도 page-level copy 추가
- 추가:
  1. current page bundle action에 `Copy Page Link`
- 목적:
  1. current bundle 카드가 page-level copy / bundle-level copy를 같이 제공하게 함
  2. page row / summary / detail / bundle card 간 동선 비대칭 제거
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. current bundle 영역에 `Copy Page Link`, `Copy Bundle Link` 함께 존재 확인

### 2026-04-11 120

- detail header에 current selected bundle target 제어 추가
- 추가:
  1. `current bundle target: <bundleId>`
  2. `Copy Selected Bundle Link`
  3. `Focus Selected Bundle`
  4. `Clear Bundle Target`
- 목적:
  1. detail 기준으로도 현재 target bundle을 명확히 보이게 함
  2. summary에 가지 않고 detail 안에서 target 제어를 끝내게 함
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `current bundle target:`, `Copy Selected Bundle Link`, `Focus Selected Bundle` 존재 확인

### 2026-04-11 121

- activity 패널 acceptance 이벤트에도 bundle deep link copy 추가
- `/admin` Recent Activity:
  1. `Go To Bundle`
  2. `Copy Bundle Link`
- 대상:
  1. `acceptance_result_saved`
- 목적:
  1. 최근 검수 이력에서 바로 재진입/공유가 되게 함
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `activity-copy-btn`, `Copy Bundle Link` 존재 확인

### 2026-04-11 122

- detail `next pending bundle`에도 deep link copy 추가
- 추가:
  1. `Copy Next Pending Link`
- 동작:
  1. current page + next pending bundleId 기준 deep link 복사
  2. notice: `Bundle link copied: <bundleId>`
- 목적:
  1. same-page 다음 검수 대상을 바로 전달/재진입하게 함
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `Copy Next Pending Link`, `copyNextPendingBtn` 존재 확인

### 2026-04-11 123

- detail header에 selected bundle compare shortcut 추가
- 추가:
  1. `selectedBundleDefinition`
  2. `Open Selected Bundle Compare`
- 동작:
  1. selected bundle에 compare URL이 있으면 detail header에서 직접 오픈
- 목적:
  1. selected bundle을 잡은 뒤 카드까지 다시 내려가지 않게 함
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `selectedBundleDefinition`, `Open Selected Bundle Compare` 존재 확인

### 2026-04-11 124

- activity 패널 acceptance 이벤트에 page-level action 추가
- `/admin` Recent Activity:
  1. `Go To Page`
  2. `Copy Page Link`
  3. 기존 `Go To Bundle`, `Copy Bundle Link` 유지
- 대상:
  1. `acceptance_result_saved`
- 목적:
  1. 최근 이력에서도 page-level / bundle-level 진입과 복사를 같이 제공
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `activity-page-btn`, `activity-copy-page-btn` 존재 확인

### 2026-04-11 125

- page row에서 direct compare 진입 추가
- 추가:
  1. `buildPageReviewMap(visualManifest)`
  2. `pageReviewMap`
  3. page row `Open Page Compare`
  4. page row `Open Next Bundle Compare`
- 목적:
  1. compare를 보기 위해 detail까지 내려가는 한 단계를 제거
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `buildPageReviewMap`, `Open Page Compare`, `Open Next Bundle Compare` 존재 확인

### 2026-04-11 126

- page row에 next bundle deep-link copy 추가
- 추가:
  1. `Copy Next Bundle Link`
  2. `pageListEl.querySelectorAll(".copy-bundle-link-btn")`
- 동작:
  1. page row에서 `nextBundleId`가 있으면 바로 bundle deep link 복사
- 목적:
  1. page row의 jump/compare에 맞춰 deep-link copy도 같은 수준으로 맞춤
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `Copy Next Bundle Link`, `pageListEl.querySelectorAll(".copy-bundle-link-btn")` 존재 확인

### 2026-04-11 127

- summary 상단에 next actionable page compare 진입 추가
- 추가:
  1. `Open Next Page Compare`
  2. `pageReviewMap.get(nextPageId)?.compareUrl`
- 목적:
  1. 첫 화면 summary에서 바로 다음 page compare를 열게 함
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `Open Next Page Compare`, `pageReviewMap.get(nextPageId)?.compareUrl` 존재 확인

### 2026-04-11 128

- activity 패널 acceptance 이벤트에 compare entry 추가
- 추가:
  1. `Open Page Compare`
  2. `Open Bundle Compare`
  3. `bundleDefinitionMap`를 activity render에서도 사용
- 목적:
  1. 최근 acceptance 이력에서 바로 page/bundle compare로 진입하게 함
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `Open Bundle Compare`, `pageReviewMap.get(item.detail.pageId)?.compareUrl`, `bundleDefinitionMap = new Map(...)` 존재 확인

### 2026-04-12 001

- `Page acceptance summary` 액션을 page row 수준으로 확장
- 추가:
  1. `Copy Page Link`
  2. `Open Page Compare`
  3. `Open Next Bundle Compare`
- 목적:
  1. summary에서도 page/bundle review 진입을 바로 닫음
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `Page acceptance summary` 내 `Copy Page Link`, `Open Page Compare`, `Open Next Bundle Compare` 존재 확인

### 2026-04-12 002

- `Current page failed bundles`를 page-level review entry로 확장
- 추가:
  1. `Go To Page`
  2. `Copy Page Link`
  3. `Open Page Compare`
- 목적:
  1. 실패 bundle 재검수 시 page-level compare/jump/copy를 바로 제공
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `Current page failed bundles` 내 `Go To Page`, `Copy Page Link`, `Open Page Compare` 존재 확인

### 2026-04-12 003

- `Acceptance queue`를 page-level review entry로 확장
- 추가:
  1. `Go To Page`
  2. `Copy Page Link`
  3. `Open Page Compare`
- 목적:
  1. queue에서 page/bundle review entry를 같이 제공
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `Acceptance queue` 내 `Go To Page`, `Copy Page Link`, `Open Page Compare` 존재 확인

### 2026-04-12 004

- `Recommended order`를 page-level review entry로 확장
- 추가:
  1. `Copy Page Link`
  2. `Open Page Compare`
- 목적:
  1. recommended 목록에서도 page/bundle review 진입을 바로 닫음
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `Recommended order` 내 `Copy Page Link`, `Open Page Compare` 존재 확인

### 2026-04-12 005

- summary `queue preview`를 review 카드 수준으로 확장
- 추가:
  1. `Go To Page`
  2. `Copy Page Link`
  3. `Copy Bundle Link`
  4. `Open Page Compare`
  5. `Open Bundle Compare`
- helper:
  1. `jump-summary-page-btn`
  2. `copy-summary-page-btn`
  3. `copy-summary-bundle-btn`
- 목적:
  1. summary 첫 화면에서도 queue item별 page/bundle review 진입을 바로 닫음
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `jump-summary-page-btn`, `copy-summary-page-btn`, `copy-summary-bundle-btn`, `Open Bundle Compare` 존재 확인

### 2026-04-12 006

- `next pending bundle` 블록을 page-level review entry로 확장
- 추가:
  1. `Go To Page`
  2. `Copy Page Link`
  3. `Open Page Compare`
- helper:
  1. `jumpNextPendingPageBtn`
  2. `copyNextPendingPageBtn`
- 목적:
  1. current page의 다음 검수 target에서도 page/bundle review 진입을 바로 닫음
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `jumpNextPendingPageBtn`, `copyNextPendingPageBtn`, `Open Page Compare`, `Open Next Pending Compare` 존재 확인

### 2026-04-12 007

- detail header에 direct page compare 추가
- 추가:
  1. `openDetailPageCompareBtn`
  2. `Open Page Compare`
- 조건:
  1. `pageReviewMap.get(page.id)?.compareUrl`
- 목적:
  1. detail 진입 직후 바로 page compare를 열게 함
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `openDetailPageCompareBtn`, `Open Page Compare` 존재 확인

### 2026-04-12 008

- `Current page bundles`에 page compare 추가
- 추가:
  1. `Open Page Compare`
- 조건:
  1. `pageReviewMap.get(bundle.pageId)?.compareUrl`
- 목적:
  1. current page bundle 카드에서도 page-level / bundle-level review entry를 같이 제공
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `Current page bundles` 카드에 `Open Page Compare`, `data-acceptance-compare-link` 존재 확인

### 2026-04-12 009

- Visual Batch review 링크 묶음에 copy action 추가
- 변경:
  1. `Open Compare` -> `Open Page Compare`
  2. `Copy Compare Link`
  3. `Copy Live Image Link`
  4. `Copy Working Image Link`
  5. `Copy Compare Image Link`
- helper:
  1. `copyText(text)`
  2. `review-copy-btn`
- 목적:
  1. review artifact 링크를 바로 복사/전달/재진입하게 함
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `review-copy-btn`, `Copy Compare Link`, `Copy Live Image Link`, `Copy Working Image Link`, `Copy Compare Image Link`, `copyText(` 존재 확인

### 2026-04-12 010

- bundle compare 라벨 통일
- 변경:
  1. `Open Compare` -> `Open Bundle Compare`
- 적용:
  1. `Recommended order`
  2. `Current page bundles`
  3. `Acceptance queue`
  4. `Current page failed bundles`
- 목적:
  1. page compare / bundle compare 라벨을 명시적으로 분리
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. 남은 generic `Open Compare`가 위 영역에서 `Open Bundle Compare`로 치환된 것 확인

### 2026-04-12 011

- next target / next pending compare 라벨 명시화
- 변경:
  1. `Open Global Next Compare` -> `Open Next Target Bundle Compare`
  2. `Open Next Pending Compare` -> `Open Next Pending Bundle Compare`
- 목적:
  1. next target / next pending compare가 bundle compare임을 라벨에서 바로 드러냄
- 실검증:
  1. `web/admin.html` script compile `SCRIPT_OK`
  2. `Open Next Target Bundle Compare`, `Open Next Pending Bundle Compare` 존재 확인

### 2026-04-12 012

- `care-solutions` 이중 GNB known issue에 코드 수정 반영
- 변경:
  1. `rewriteCloneHtml()`의 `preservePageHeader` 예외에서 `care-solutions` 제거
  2. `care-solutions-duplicate-gnb` advisory 문구를 현재 코드 기준으로 보정
- 근거:
  1. archived `care-solutions` HTML은 `header-wrap`, `header-top`를 포함
  2. 기존에는 `care-solutions`가 page header preserve 예외에 들어 있어 iframe 내부 header가 숨겨지지 않았음
- 실검증:
  1. `node --check server.js` 통과
  2. `preservePageHeader = isHome || ["support", "bestshop"].includes(pageId)` 확인

### 2026-04-12 013

- git 업로드 준비 시작
- 추가:
  1. `.gitignore`
- ignore 기준:
  1. `node_modules/`
  2. `tmp/`
  3. `data/runtime/`
  4. `data/visual/`
  5. `data/debug/`
  6. `data/reports/`
- 목적:
  1. generated/runtime/visual 산출물을 제외하고 source/doc/script 중심으로 정리

### 2026-04-12 014

- git 저장소 초기화 및 branch 정리
- 변경:
  1. `git init`
  2. branch `main`
- 상태:
  1. `.gitignore` 기준으로 generated/runtime/visual 산출물 제외
  2. source/doc/script/data(raw+normalized) 업로드 후보 유지

### 2026-04-12 015

- `care-solutions` duplicate GNB 경로 점검
- 확인:
  1. `rewriteCloneHtml()`의 `preservePageHeader` 대상에서 `care-solutions` 제외
  2. `clone-content/care-solutions`에는 captured header 마크업이 남아 있어도 `.header-wrap`, `.header-top`은 숨김 대상으로 유지
  3. 운영 advisory는 "shell header만 남아야 한다" 기준으로 고정
- 의미:
  1. 이 이슈는 구조상 제거가 아니라 shell suppress 기준으로 검수하는 항목이다
  2. 최종 acceptance에서는 browser view에서 second header block 비노출만 확인하면 된다

### 2026-04-12 016

- git 업로드 준비 체크리스트 문서화
- 추가:
  1. `docs/git-upload-prep.md`
- 내용:
  1. 현재 tracked candidate 범위
  2. ignore 범위
  3. 업로드 전 검토 포인트
  4. commit/push 직전 확인 포인트

### 2026-04-12 017

- git upload preflight 스크립트 추가 및 실행 검증
- 추가:
  1. `scripts/check_git_upload_prep.sh`
  2. `npm run check:git-upload`
- 확인:
  1. branch `main`
  2. staged count `520`
  3. ignored/generated path staged 누수 없음
  4. `server.js`, `auth.js`, `llm.js` syntax check 통과

### 2026-04-12 018

- repository `README.md` 추가
- 내용:
  1. 프로젝트 목적
  2. runtime page scope
  3. 주요 route
  4. 핵심 명령
  5. data include/exclude 정책

### 2026-04-12 019

- acceptance backlog 문서 추가
- 추가:
  1. `docs/acceptance-backlog.md`
- 내용:
  1. 현재 recorded acceptance 상태
  2. 8개 bundle 정의
  3. recommended review order
  4. bundle별 review focus

### 2026-04-12 020

- acceptance current state 리포트 스크립트 추가
- 추가:
  1. `scripts/report_acceptance_status.mjs`
  2. `npm run report:acceptance`
  3. `docs/acceptance-current-state.md`
- 현재 결과:
  1. workspace `testuser1`
  2. `pass=1`
  3. `pending=1`
  4. `unreviewed=6`
  5. next actionable bundle = `home-lower-primary`

### 2026-04-12 021

- `care-solutions` duplicate header 자동 체크 추가
- 추가:
  1. `scripts/check_care_solutions_header.mjs`
  2. `npm run check:care-header`
  3. `docs/care-solutions-header-check.md`
- 결과:
  1. `pc` `captureVisibleCount=0`
  2. `mo` `captureVisibleCount=0`
  3. shell header만 visible

### 2026-04-12 022

- acceptance review pack 스크립트 추가
- 추가:
  1. `scripts/build_acceptance_review_pack.mjs`
  2. `npm run report:acceptance-pack`
  3. `docs/acceptance-review-pack.md`
- 결과:
  1. 8개 bundle의 compare URL 정리
  2. home lower section artifact 경로 정리
  3. service/plp pc/mo screenshot 경로 정리
  4. 현재 recorded acceptance 상태와 함께 검수 진입점 고정

### 2026-04-12 023

- acceptance CLI 추가
- 추가:
  1. `scripts/manage_acceptance.mjs`
  2. `npm run acceptance:list`
  3. `npm run acceptance:set`
- 검증:
  1. `testuser1` 기준 bundle 목록 조회
  2. `home-lower-primary -> pending` note 갱신 경로 확인

### 2026-04-12 024

- acceptance diff report 추가
- 추가:
  1. `scripts/build_acceptance_diff_report.mjs`
  2. `npm run report:acceptance-diff`
  3. `docs/acceptance-diff-report.md`
- 핵심 결과:
  1. home lower hotspot
     - `brand-showroom 32.72%`
     - `space-renewal 18.68%`
     - `latest-product-news 16.36%`
  2. service page diff는 매우 낮음
  3. PLP는 `pc` 쪽 우선 검수 필요

### 2026-04-12 025

- home lower compare 캡처를 `mobile section isolate` 기준으로 정규화
- 변경:
  1. `scripts/capture_home_lower_sections.mjs`
  2. clone capture를 `viewportProfile=mo + homeSandbox=<slot>` 기준으로 통일
  3. clone section을 `#__codex_capture_target`로 분리해 `430px` 폭으로 캡처
- 의미:
  1. 이전 home lower diff는 desktop shell 폭이 섞여 과장된 값이 있었다
  2. 이제 live mobile section과 clone mobile section을 같은 폭 기준으로 비교한다
- 정규화 후 핵심 결과:
  1. 개선:
     - `brand-showroom 32.72% -> 2.20%`
     - `latest-product-news 16.36% -> 1.38%`
     - `space-renewal 18.68% -> 6.44%`
  2. 실제 home lower hotspot:
     - `smart-life 11.64%`
     - `subscription 7.71%`
     - `summary-banner-2 7.32%`
  3. PLP 우선순위는 유지:
     - `category-tvs:pc 30.41%`
     - `category-refrigerators:pc 21.77%`

### 2026-04-12 026

- objective acceptance finding 리포트 추가
- 추가:
  1. `scripts/report_acceptance_objective_findings.mjs`
  2. `npm run report:acceptance-objective`
  3. `docs/acceptance-objective-findings.md`
- 핵심 결과:
  1. `space-renewal`
     - mismatch `6.44%`
     - clone height가 live보다 `142.27px` 더 큼
     - 즉 시각 차이 이전에 구조/높이 보정이 우선
  2. `smart-life`, `subscription`, `summary-banner-2`
     - 높이 차이는 `0~1px`
     - 남은 diff는 spacing, image crop, text rhythm, styling 쪽일 가능성이 큼
  3. `category-tvs:pc`, `category-refrigerators:pc`
     - representative product rect/text는 live와 동일
     - 큰 diff는 product grid geometry보다 shell/banner/filter/sort/typography 쪽일 가능성이 큼
