# 레시피 수집 스키마와 운영 원칙 (2026-04-19)

## 목적

이 문서는 `hero`, `quickmenu`를 시작으로 Builder V2의 품질을 끌어올리기 위한
`recipe library`의 수집 기준과 운영 원칙을 정의한다.

핵심 전제:

- 레시피는 `완성 템플릿`이 아니다
- 레시피는 `강한 구조적 출발점`이다
- 레시피는 품질을 고정하는 대신, `나쁜 결과를 줄이는 prior`로 사용한다
- 다양성은 `recipe + tone + asset treatment + emphasis` 조합으로 확보한다

---

## 왜 필요한가

현재 코드 기준으로 확인된 사실:

- `primitiveTree`는 실제로 저장된다
- `home.hero`, `home.quickmenu`는 V2 renderer를 실제로 탄다
- 하지만 visual critic은 여전히 `hierarchy=0`을 반복한다

즉 현재 병목은:

- `primitiveTree가 없어서`가 아니다
- `V2 renderer가 안 타서`도 아니다
- `좋은 상위 레이아웃 레시피가 아직 부족해서`다

따라서 다음 단계는:

- reference 수집
- recipe 구조화
- renderer 반영

을 체계화하는 것이다.

---

## 레시피의 정의

레시피는 아래 네 층을 묶은 `구조 패턴`이다.

1. `layout pattern`
- split
- centered
- stacked
- panel
- strip
- ribbon
- grid

2. `hierarchy rule`
- headline dominance
- supporting copy density
- CTA prominence
- supporting card rhythm

3. `asset treatment`
- hero visual dominance
- icon shell type
- image crop rule
- card thumbnail behavior

4. `tone mapping`
- premium
- editorial
- neutral
- cinematic
- service-trust

즉 레시피는 `픽셀 완성본`이 아니라:

- 어떤 구조를 쓸지
- 무엇을 가장 크게 보이게 할지
- 어떤 자산 처리를 할지

를 정한 `재사용 가능한 상위 패턴`이다.

---

## 수집 단위

레시피는 아래 축으로 수집/태깅한다.

### 1. 역할 축

- `pageRole`
  - commerce-home
  - service-landing
  - editorial-promo
  - campaign-top

- `componentRole`
  - hero
  - quickmenu
  - ranking
  - banner
  - commerce-story

### 2. 표현 축

- `tone`
  - premium
  - editorial
  - neutral
  - cinematic
  - service-trust

- `density`
  - airy
  - balanced
  - packed

- `emphasis`
  - headline-first
  - visual-first
  - utility-first
  - mixed

### 3. 패턴 축

- `layoutPattern`
  - split-hero
  - centered-hero
  - stacked-hero
  - lead-panel
  - editorial-strip
  - utility-grid

- `assetPattern`
  - dominant-visual
  - supporting-thumbs
  - icon-led
  - badge-led

---

## 수집 스키마

레시피 수집 결과는 최소 아래 필드를 가져야 한다.

```json
{
  "recipeId": "hero-premium-spotlight-v1",
  "targetComponent": "home.hero",
  "sourceClass": "component-pattern",
  "referenceIds": ["getdesign-wise", "getdesign-ferrari"],
  "pageRole": "commerce-home",
  "tone": "premium",
  "layoutPattern": "split-hero",
  "density": "airy",
  "emphasis": "visual-first",
  "assetExpectation": {
    "heroImage": "required",
    "supportCards": "optional",
    "iconFamily": "none"
  },
  "hierarchyRule": {
    "headlineTier": "dominant",
    "ctaTier": "primary-inline",
    "supportTier": "secondary-cards"
  },
  "primitiveMapping": {
    "primitiveId": "SplitHero",
    "variant": "premium-stage"
  },
  "rendererRecipeId": "home-hero-premium-spotlight",
  "avoid": [
    "flat utility card tone",
    "equal-weight title and support copy",
    "small image with oversized text block"
  ]
}
```

---

## 품질 가드레일

레시피는 품질을 높이기 위한 수단이지, 결과를 획일화하는 장치가 되면 안 된다.

다음 가드레일을 같이 둔다.

### 1. 고정 템플릿 금지

- 레시피는 `정적 HTML`을 저장하지 않는다
- 레시피는 `primitive + hierarchy + asset treatment + tone rule`만 저장한다

### 2. 조합 구조 유지

아래를 분리해서 적용한다.

- `layout recipe`
- `tone preset`
- `asset treatment`
- `content emphasis`

이 4개를 분리해야 한 레시피에서도 여러 결과가 나온다.

### 3. escape hatch 허용

다음 경우는 새 레시피 추가나 experimental branch를 허용한다.

- 기존 recipe set으로 reference fit이 낮을 때
- critic이 반복적으로 `hierarchy=0`을 주는데 현재 recipe가 다 비슷할 때
- 페이지 역할이 기존 분류에 잘 안 들어갈 때

### 4. recipe 수 최소 기준

파일럿 기준 최소 보유 수:

- `hero`: 10개 이상
- `quickmenu`: 8개 이상

즉 2~3개 레시피로 운영하지 않는다.

---

## 초기 수집 우선순위

### Phase 1. hero

최소 우선군:

- premium spotlight
- editorial split
- centered campaign
- stacked story
- cinematic stage

### Phase 2. quickmenu

최소 우선군:

- utility grid
- lead panel
- editorial strip
- service tabs
- premium chip grid

---

## renderer 연결 규칙

수집된 레시피는 그대로 LLM에 노출하지 않고, renderer-owned mapping으로 연결한다.

즉:

- LLM은 `recipeId` 또는 `primitiveId + variant`를 선택
- renderer는 해당 레시피를
  - HTML structure
  - scoped CSS
  - asset fallback treatment
  로 전개

중요:

- LLM이 raw HTML/CSS를 직접 결정하지 않는다
- renderer가 최종 surface를 소유한다

---

## 이미지 없음 fallback 규칙

현재 품질을 깎는 큰 원인 중 하나가 `plain fallback`이다.

예:

- `visual`
- `card`
- `01`

같은 placeholder는 visual critic에서 위계 실패를 유도한다.

따라서 각 레시피는 `imageMissingTreatment`를 가져야 한다.

예:

- premium hero:
  - gradient stage + glass overlay + oversized eyebrow
- editorial hero:
  - framed color block + supporting quote band
- quickmenu:
  - icon badge shell + tone chip + lead-card numeral treatment

즉 fallback도 레시피의 일부여야 한다.

---

## 품질/다양성 판정 기준

레시피가 좋은지 여부는 아래 둘을 같이 봐야 한다.

### 품질

- hierarchy가 실제로 오른다
- CTA prominence가 분명하다
- visual focus가 생긴다
- quickmenu density가 평평하지 않다

### 다양성

- 결과가 같은 구조로 수렴하지 않는다
- tone이 바뀌면 실제 마크업/비주얼 리듬도 바뀐다
- asset treatment가 달라질 때 구성 차이도 생긴다

즉:

- `quality만 높고 다 비슷하면 실패`
- `다양하기만 하고 완성도가 낮아도 실패`

---

## 다음 실행

1. `hero recipe collection` 초안 작성
2. `quickmenu recipe collection` 초안 작성
3. V2 renderer에서 `recipeId -> HTML/CSS` 매핑 추가
4. `hero + quickmenu / full / v2` 파일럿 재검증

---

## 결론

레시피 기반 접근은 품질과 다양성을 해칠 수도 있다.

하지만 아래를 지키면 오히려 둘을 같이 올릴 수 있다.

- 레시피를 `완성 템플릿`으로 저장하지 말 것
- 레시피를 `구조적 출발점`으로만 사용할 것
- `tone / asset / emphasis`를 분리 조합할 것
- fallback visual treatment까지 recipe에 포함할 것

즉 레시피는 다양성을 죽이는 장치가 아니라,
`좋은 결과가 나올 확률을 높이는 구조적 prior`로 써야 한다.
