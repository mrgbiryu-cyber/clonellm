# Page-First Builder V2 원칙 (2026-04-20)

## 목적

`hero + quickmenu` 파일럿은 국소 최적화가 아니라, `페이지 전체 설계`를 검증하는 첫 테스트여야 한다.

즉:

- 현재 구현은 `hero + quickmenu`에 집중해도
- 아키텍처 기준은 처음부터 `page-first`
- 파일럿이 통과하면 같은 원칙으로 `ranking / banner / commerce / service page`까지 바로 확장 가능해야 한다

---

## 핵심 원칙

### 1. 파일럿은 국소 실험이 아니라 상단 진입부 클러스터 검증이다

`home.hero`, `home.quickmenu`는 독립 컴포넌트가 아니라:

- first impression
- primary navigation
- visual hierarchy
- top-stage rhythm

을 같이 결정하는 `top-stage cluster`다.

따라서 파일럿 평가는 개별 섹션 품질만이 아니라:

- hero가 quickmenu와 리듬이 맞는지
- quickmenu가 hero의 주제를 깨지 않는지
- 상단 전체가 하나의 authored stage처럼 보이는지

를 같이 봐야 한다.

### 2. 페이지 전체 설계층이 먼저 있어야 한다

Builder V2는 컴포넌트 레벨 전에 아래 페이지 레벨 계약을 가져야 한다.

- `pageShellVariant`
- `topStageVariant`
- `section rhythm`
- `tone distribution`
- `asset emphasis map`
- `navigation prominence map`

즉 섹션은 페이지의 일부로만 생성되어야 한다.

### 3. section recipe는 page recipe의 하위여야 한다

레시피는 다음 순서로 적용한다.

1. `page recipe`
2. `cluster recipe`
3. `section recipe`

예:

- page recipe: `commerce-home / premium editorial mix`
- cluster recipe: `hero-led top stage`
- section recipe:
  - hero: `premium spotlight`
  - quickmenu: `lead panel`

section recipe만 단독 선택하게 하면 페이지 전체 통일성이 깨진다.

### 4. prompt도 section-only가 아니라 page-first여야 한다

생성 입력은 아래 순서여야 한다.

1. `full-page context`
2. `target overlay`
3. `focus crop`
4. `page/cluster contract`
5. `section contract`
6. `recipe contract`

즉 hero를 만들 때도:

- hero만 보지 않는다
- `이 hero가 페이지 상단 전체에서 어떤 역할인지`를 먼저 본다

### 5. 품질 판정도 page-first다

통과 조건은:

- section 자체가 좋아 보이는가
- 전체 페이지 리듬 안에서 맞는가

둘 다 충족해야 한다.

즉 앞으로는:

- `full-page critic`
- `focus-area critic`

를 함께 본다.

---

## 구현 영향

### A. 현재 파일럿 작업에 즉시 적용할 것

`hero + quickmenu` 파일럿도 아래 기준으로 본다.

- 하나의 top-stage cluster로 취급
- recipe도 묶어서 선택
- visual critic도 cluster 기준으로 해석

### B. 이후 확장 기준

파일럿 통과 후 바로 다음으로 확장해야 할 것은:

1. `best-ranking`
2. `banner`
3. `commerce`
4. `service-like pages`

단 이 확장도 개별 섹션 추가가 아니라:

- page shell
- section rhythm
- cluster composition

관점으로 진행한다.

---

## 결론

`hero + quickmenu`를 먼저 보는 것은 맞다.

하지만 그 이유는:

- 그 둘만 따로 완성하려는 것이 아니라
- `페이지 전체 설계 원칙`이 실제로 먹히는지 가장 먼저 드러나는 구간이기 때문이다.

따라서 앞으로의 Builder V2는:

- 구현은 파일럿부터
- 설계는 처음부터 page-first

로 고정한다.
