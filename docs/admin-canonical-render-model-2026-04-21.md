# Canonical Render Model (2026-04-21)

## 목적

이 문서는 새 파이프라인에서 `patch`가 아니라 `render model`을 canonical로 삼기 위한 필드 구조를 정의한다.

핵심 원칙:

- canonical path는 제한적인 patch path가 아니다.
- canonical model은 `target group` 안을 새 구조로 다시 그릴 수 있어야 한다.
- `operations`는 canonical 출력이 아니라 하위 호환 브리지다.

---

## 1. 최상위 구조

```json
{
  "pageId": "home",
  "viewportProfile": "pc",
  "rendererSurface": "tailwind",
  "renderIntent": {},
  "targetGroup": {},
  "sections": []
}
```

필수 의미:

- `pageId`: 어떤 페이지인지
- `viewportProfile`: 어떤 뷰포트인지
- `rendererSurface`: 어떤 렌더러 표면을 탈지
- `renderIntent`: 이번 시안의 상위 시각 의도
- `targetGroup`: 어디까지 바꾸는지에 대한 boundary
- `sections`: 실제로 다시 그릴 section composition

---

## 2. Render Intent

```json
{
  "modelVersion": "canonical-render-model.v1",
  "designChangeLevel": "medium",
  "compositionMode": "target-group-recompose",
  "selectedConceptId": "concept-1",
  "selectedConceptLabel": "정제된 센터 레이아웃",
  "layoutDirection": "centered-stage",
  "themeTone": "light-neutral",
  "northStar": [],
  "guardrails": [],
  "toolAccess": {}
}
```

이 계층은 “무엇을 그릴지”보다 “어떤 원리로 그릴지”를 담는다.

즉 `titleSize=56` 같은 값보다

- 어떤 컨셉인지
- 어떤 레이아웃 방향인지
- 어떤 톤인지
- 어떤 금지선이 있는지

를 직접 기록한다.

---

## 3. Target Group Boundary

```json
{
  "groupId": "top-stage",
  "groupLabel": "Top Stage Cluster",
  "componentIds": ["home.hero", "home.quickmenu"],
  "slotIds": ["hero", "quickmenu"],
  "layoutIntent": [],
  "boundary": {
    "mode": "replace-inside-group",
    "preserveOutsideGroup": true,
    "entrySlotId": "hero",
    "exitSlotId": "quickmenu"
  }
}
```

`targetGroup`은 slot 묶음이 아니라 교체 경계다.

즉 canonical path는

- 그룹 밖은 유지
- 그룹 안은 새 composition으로 재구성

을 명시해야 한다.

---

## 4. Section Composition

```json
{
  "slotId": "hero",
  "componentId": "home.hero",
  "familyId": "hero-carousel-composition",
  "templateId": "local-hero-premium-center",
  "priority": "primary",
  "layout": {},
  "tone": {},
  "typography": {},
  "assets": {},
  "content": {},
  "constraints": {},
  "primitiveTree": {},
  "patch": {}
}
```

여기서 `primitiveTree`와 `patch`는 renderer bridge이고, 실제 canonical 의미는 나머지 spec에 있다.

### 4.1 layout

- `sectionRole`
- `layoutMode`
- `containerMode`
- `hierarchy`
- `density`
- `alignment`
- `rhythm`

### 4.2 tone

- `surfaceTone`
- `emphasisTone`
- `contrastMode`
- `accentTone`
- `badgeTone`

### 4.3 typography

- `headlinePreset`
- `bodyPreset`
- `eyebrowPreset`
- `ctaPreset`

### 4.4 assets

- `visualRole`
- `visualPolicy`
- `iconPolicy`
- `assetPlan`

### 4.5 content

- `objective`
- `primaryMessage`
- `supportMessage`
- `keep`
- `change`
- `ctaLabels`

### 4.6 constraints

- `preserve`
- `avoid`
- `guardrails`

---

## 5. 설계 원칙

### 5.1 canonical은 patch보다 상위여야 한다

canonical model이 patch와 같은 수준이면 표현력이 너무 약하다.

따라서 canonical은 최소한 아래를 직접 말할 수 있어야 한다.

- `editorial-split hero`
- `brand-grid quickmenu`
- `purchase-stack summary`
- `sticky-buybox action zone`

### 5.2 operations는 adapter다

`replace_component_template`
`update_component_patch`

같은 operation은 저장/호환/legacy bridge 용도로만 사용한다.

메인 판단은 `renderIntent + section composition spec`에서 끝나야 한다.

### 5.3 renderer는 canonical model만 본다

최종 목표는 renderer가

- planner 산출물
- critic 결과
- legacy operation 해석

이 아니라 canonical render model 하나만 보고 결과를 만들게 하는 것이다.

---

## 6. 현재 적용 상태

현재 `design-pipeline/clone-model.js`는 아래를 수용하도록 확장했다.

- `renderIntent`
- `targetGroup.boundary`
- `section.layout`
- `section.tone`
- `section.typography`
- `section.assets`
- `section.content`
- `section.constraints`

`design-pipeline/build-local.js`도 이 구조를 채우도록 보강했다.

즉 지금부터는 local path가 단순 patch preview가 아니라, `canonical render model`을 실제로 생산하는 경로가 된다.
