# Slot Snapshot Design

Schema version: `v3`

> 문서 상태:
> 이 문서는 slot snapshot 스키마 설계 문서다.
> 아래 JSON의 빈 배열은 실제 런타임 기본값이라기보다 스키마 shape 설명용 예시다.
> 구현 시에는 최신 registry/slot 규칙과 함께 해석해야 한다.

## 목적
- DOM만 읽어서 복원하지 않고, 화면 구조를 `slot` 단위로 고정한다.
- `reference`와 `working`을 같은 기준으로 비교한다.
- 헤더/GNB/히어로/퀵메뉴를 감으로 수정하지 않도록 한다.

## 핵심 원칙
1. 페이지 전체가 아니라 `slot` 단위로 수집한다.
2. 각 slot은 `DOM 정보`, `레이아웃 의도`, `상태`를 함께 가진다.
3. `reference`는 정답지이고, `working`은 수정본이다.
4. 비교는 페이지 전체보다 slot 단위가 우선이다.
5. `zone`, `slot`, `state`, `componentType`는 고정 목록이 아니라 registry 기반으로 확장 가능해야 한다.
6. 새 구조를 바로 버리지 않고 `unknown-pattern`으로 임시 등록한 뒤 review 후 승격한다.
7. overlay / popup / floating UI는 본문과 별도 `surface`로 다룬다.
8. rule은 직접 좌표값보다 type/zone/slot 단위 상속 구조를 우선한다.
9. `pc`와 `mo`는 같은 slot을 공유하되 source/variant/validation은 별도 세트로 관리한다.

## 스키마 목표
- PoC가 아니라 운영 가능한 완성형 구조를 목표로 한다.
- 새 페이지, 새 zone, 새 overlay, 새 figma variant가 추가돼도 기존 스키마를 깨지 않고 누적 가능해야 한다.
- 한 번 만든 rule과 extractor를 home/category/PDP/support/Q&A 전체에 재사용할 수 있어야 한다.
- 동일한 slot에 대해 PC/MO source set을 누적할 수 있어야 한다.

## 최상위 모델

예시 주의:
1. 아래 JSON은 스키마 shape 설명용 샘플이다.
2. `zones`, `slots`, `states`, `groups`, `rules`, `validation`의 빈 배열은 production에서 비어 있어야 한다는 뜻이 아니다.
```json
{
  "schemaVersion": "v3",
  "pageId": "home",
  "source": "reference",
  "sourceType": "captured",
  "url": "https://www.lge.co.kr/home",
  "viewport": {
    "width": 1460,
    "height": null
  },
  "zones": [],
  "slots": [],
  "states": [],
  "groups": [],
  "rules": [],
  "validation": []
}
```

## Registry 개념

### Viewport Profile
- `pc`
- `mo`
- `hybrid` (zone resolver 전용)

원칙:
- baseline, source, variant, validation은 `viewportProfile`을 가진다.
- `slotId`와 `componentType`은 공유하지만 source와 layout은 viewport별로 분리한다.

### Zone Registry
- zone은 고정 배열이 아니라 registry로 관리한다.
- 기본 zone:
  - `header-zone`
  - `hero-zone`
  - `content-zone`
- 새로 발견되는 zone 예:
  - `sticky-zone`
  - `search-zone`
  - `support-zone`
  - `review-zone`

```json
{
  "zoneId": "header-zone",
  "zoneType": "header",
  "surfaceId": "main-surface",
  "parentZoneId": null,
  "discoverySource": "manual",
  "status": "active"
}
```

### Surface Registry
- overlay / popup / floating UI를 위한 별도 축
- 기본 surface:
  - `main-surface`
  - `overlay-surface`
  - `floating-surface`

```json
{
  "surfaceId": "overlay-surface",
  "surfaceType": "overlay"
}
```

### Slot Registry
- slot은 zone 아래에서 관리되지만 독립 id를 가진다.
- 새 slot은 언제든 registry에 추가 가능해야 한다.

```json
{
  "slotId": "quickmenu",
  "zoneId": "content-zone",
  "componentType": "quickmenu-grid",
  "containerMode": "narrow",
  "status": "captured"
}
```

### Component Type Registry
- 예:
  - `mega-menu-with-depth2`
  - `mega-menu-simple-panel`
  - `hero-carousel`
  - `quickmenu-grid`
  - `product-card-grid`
  - `pdp-summary`
  - `floating-cta`

### State Registry
- 예:
  - `default`
  - `gnb-product-open`
  - `search-open`
  - `filter-open`
  - `option-selected`
  - `review-tab-active`

## Unknown Pattern 처리
- extractor가 새 구조를 발견하면 드롭하지 않는다.
- 아래 상태로 임시 등록한다.
  - `unknown-pattern`
  - `needs-review`
  - `provisional-zone`
  - `provisional-slot`

```json
{
  "slotId": "unknown-home-17",
  "zoneId": "provisional-zone-home-3",
  "componentType": "unknown-pattern",
  "status": "needs-review"
}
```

## 홈 기준 1차 slot
- `header-top`
- `header-bottom`
- `hero`
- `quickmenu`

## v2 설계 포인트
1. `structure`만 저장하지 않고 `layout`을 함께 저장한다.
2. GNB는 `제품/소모품` 하나가 아니라 메뉴별 열린 상태를 별도 state로 저장한다.
3. `reference`와 `working`은 같은 slot/state 포맷으로 비교한다.

## 저장 구조 예시
```json
{
  "schemaVersion": "v3",
  "pageId": "home",
  "source": "reference",
  "url": "https://www.lge.co.kr/home",
  "viewport": {
    "width": 1460,
    "height": null
  },
  "zones": [
    {
      "zoneId": "header-zone",
      "zoneType": "header",
      "surfaceId": "main-surface"
    }
  ],
  "slots": [
    {
      "slotId": "header-top",
      "kind": "header",
      "structure": "two-tier-header",
      "zoneId": "header-zone",
      "surfaceId": "main-surface",
      "componentType": "header-top-bar",
      "containerMode": "full",
      "layout": {
        "tier": 1,
        "containerRule": "full-bleed",
        "rowCountDesktop": 1,
        "align": "baseline",
        "density": "compact"
      }
    }
  ]
}
```

## 현재 추출 항목

### `header-top`
- 로고 href
- utility 아이템 종류
- 회사소개/사업자몰 링크
- `layout.tier = 1`
- `layout.containerRule = full-bleed`
- `layout.align = baseline`

### `header-bottom`
- 메인 메뉴 라벨
- 브랜드 탭 라벨
- 좌우 화살표 존재 여부
- `layout.tier = 2`
- `layout.containsBrandTabs = true`
- `layout.containsHomeStyle = true`

### `hero`
- 대표 이미지
- headline
- description
- badge
- `layout.containerRule = full-bleed`
- `layout.contentMode = split-copy-visual`

### `quickmenu`
- 항목 수
- 항목별 title/href/image
- `containerMode = narrow`
- `expectedColumnsDesktop = 5`
- `expectedRowsDesktop = 2` (10개 기준)
- `layout.containerRule = narrow-after-hero`
- `layout.iconShape = circle`
- `layout.density = compact`

## GNB state 목록
- `gnb-product-open`
- `gnb-care-open`
- `gnb-support-open`
- `gnb-benefits-open`
- `gnb-story-open`
- `gnb-bestshop-open`
- `gnb-lgai-open`

## 왜 필요한가
- quickmenu 10개가 DOM상 한 줄처럼 보여도 실제 화면은 2행처럼 배치될 수 있다.
- GNB rollover는 `default` 상태와 `open` 상태를 분리 수집해야 한다.
- 폭 문제는 페이지 전체가 아니라 slot container 기준으로 봐야 한다.
- 새 영역이 발견될 수 있으므로 zone/slot/type을 확장 가능한 registry로 관리해야 한다.
- popup, drawer, tooltip, sticky bar는 본문 slot이 아니라 `surface`와 `state`를 함께 봐야 한다.

## Rule 스키마
- 직접 x/y를 고정값으로 저장하기보다 rule을 둔다.
- 우선순위:
  1. componentType rule
  2. zone override
  3. slot override
  4. state override

```json
{
  "ruleId": "mega-menu-simple-panel.padding.v1",
  "ruleType": "layout",
  "target": {
    "componentType": "mega-menu-simple-panel",
    "zoneId": "header-zone",
    "slotId": "gnb-panel"
  },
  "inheritsFrom": "mega-menu.base.v1",
  "values": {
    "leftPadding": 40,
    "topPadding": 24,
    "titleGap": 18
  }
}
```

## Visual Token 스키마
- 위치만이 아니라 시각 토큰도 rule로 관리한다.
- layout rule과 분리해서 저장한다.

```json
{
  "ruleId": "mega-menu.visual.v1",
  "ruleType": "visual-token",
  "target": {
    "componentType": "mega-menu-with-depth2",
    "slotId": "gnb-panel"
  },
  "values": {
    "fontSize": 14,
    "fontWeight": 400,
    "lineHeight": 22,
    "color": "#111111",
    "backgroundColor": "#ffffff",
    "borderColor": "rgba(17,24,39,0.08)",
    "shadow": "0 18px 40px rgba(17,24,39,0.12)",
    "radius": 0,
    "iconSize": 20
  }
}
```

## Validation 스키마
- 수정은 pass/fail과 replay를 전제로 한다.

```json
{
  "validationId": "home.gnb-product-open.gnb-panel",
  "schemaVersion": "v3",
  "pageId": "home",
  "stateId": "gnb-product-open",
  "slotId": "gnb-panel",
  "checks": [
    { "name": "openStateValid", "status": "pass" },
    { "name": "panelRootVisible", "status": "pass" },
    { "name": "depth2StripHeight", "status": "fail", "detail": "reference=53 working=28" }
  ]
}
```

## Registry Output Contract

### Page Registry
```json
{
  "pageId": "home",
  "pageGroup": "home",
  "schemaVersion": "v3",
  "baselineMode": "hybrid",
  "supportedViewports": ["pc", "mo"],
  "status": "captured",
  "requiredStates": [
    "default",
    "gnb-product-open"
  ]
}
```

### Slot Registry
```json
{
  "slotId": "quickmenu",
  "pageId": "home",
  "viewportProfile": "pc",
  "zoneId": "content-zone",
  "surfaceId": "main-surface",
  "componentType": "quickmenu-grid",
  "status": "captured",
  "activeSourceId": "captured-home-quickmenu-pc",
  "variantIds": [
    "captured-home-quickmenu-pc",
    "captured-home-quickmenu-mo",
    "custom-home-quickmenu-pc-v1",
    "custom-home-quickmenu-mo-v1"
  ],
  "createdFrom": "extractor",
  "approvalStatus": "validated"
}
```

### Source / Variant Registry
```json
{
  "sourceId": "captured-home-quickmenu-pc",
  "slotId": "quickmenu",
  "sourceType": "captured",
  "viewportProfile": "pc",
  "rendererType": "iframe-fragment",
  "schemaVersion": "v3",
  "status": "active",
  "createdFrom": "capture-pipeline",
  "figmaNodeId": null
}
```

## Source Lifecycle
- `draft`
- `validated`
- `active`
- `deprecated`
- `rolled-back`

원칙:
- 승격 / 보류 / 롤백은 자동이 아니라 사용자 명시 액션으로 처리한다.
- UI에 버튼을 둔다:
  - `Promote`
  - `Hold`
  - `Rollback`

예:
```json
{
  "sourceId": "custom-home-quickmenu-pc-v1",
  "status": "draft",
  "allowedActions": ["Promote", "Hold", "Rollback"]
}
```

### PC / MO Variant Set
```json
{
  "slotId": "quickmenu",
  "variantSets": {
    "pc": [
      "captured-home-quickmenu-pc",
      "custom-home-quickmenu-pc-v1",
      "figma-home-quickmenu-pc-v1"
    ],
    "mo": [
      "captured-home-quickmenu-mo",
      "custom-home-quickmenu-mo-v1",
      "figma-home-quickmenu-mo-v1"
    ]
  }
}
```

원칙:
- renderer를 하나로 우겨 맞추지 않는다.
- PC/MO는 source set을 분리하고, replay와 validation도 각각 수행한다.

### State Registry
```json
{
  "stateId": "gnb-product-open",
  "pageId": "home",
  "viewportProfile": "pc",
  "surfaceId": "overlay-surface",
  "triggerType": "hover+click",
  "triggerTarget": "제품/소모품",
  "status": "captured"
}
```

## Validation Severity
- `blocker`
  - open-state invalid
  - panel root missing
  - wrong source route
  - broken interaction
- `warning`
  - wrong spacing
  - wrong group alignment
  - wrong container width
- `cosmetic`
  - font-weight mismatch
  - color mismatch
  - icon rendering nuance

원칙:
- `blocker`가 하나라도 남으면 다음 페이지군으로 넘어가지 않는다.
- `warning`은 누적 가능하지만 replay에서 감소 추세여야 한다.
- `cosmetic`은 LLM/Figma 이전 단계에서 정리 대상으로 남길 수 있다.

## Validation Tolerance
- 기본 원칙: 최종 기준은 screenshot 완전 매칭
- 실무상 1차 자동 판정은 아래처럼 둔다.

1. `layout`
   - 우선 `px` 기준
   - 이유: 동일 viewport/canvas에서 비교하기 때문
2. `ratio`
   - viewport가 달라지는 비교에서만 보조로 사용
3. `visual diff`
   - anti-aliasing / 폰트 렌더 차이 제외 후 판단

기본 권장값:
- `blocker`: 핵심 group 위치 차이 `> 4px`
- `warning`: `2px ~ 4px`
- `cosmetic`: `<= 2px` 또는 anti-aliasing 수준

이 값은 운영 중 조정 가능하지만, 현재 승인된 시작 기준은 px 우선이다.

## Review Queue Contract
- unknown-pattern 또는 신규 source는 review queue에 들어간다.

저장 필드:
```json
{
  "reviewId": "review-home-unknown-17",
  "pageId": "home",
  "viewportProfile": "pc",
  "zoneId": "provisional-zone-home-3",
  "slotId": "unknown-home-17",
  "candidateType": "unknown-pattern",
  "status": "needs-review",
  "artifactIds": [
    "reference-image",
    "working-image",
    "meta-json"
  ]
}
```

원칙:
- 알 수 없는 경우는 버리지 않고 후보군으로 뺀다.
- 사용자가 확인 후:
  - 새 type으로 승격
  - 기존 type에 병합
  - 폐기
중 하나를 선택한다.

## Workbench Output Contract
Workbench는 아래 산출물을 남긴다.

```json
{
  "pageId": "home",
  "viewportProfile": "pc",
  "stateId": "gnb-product-open",
  "zoneId": "header-zone",
  "slotId": "gnb-panel",
  "artifacts": {
    "referenceImage": "reference.png",
    "workingImage": "working.png",
    "diffImage": "diff.png",
    "meta": "meta.json"
  },
  "checks": [
    { "name": "openStateValid", "status": "pass", "severity": "blocker" }
  ],
  "ruleCandidates": [
    "mega-menu-simple-panel.padding.v1"
  ]
}
```

즉 workbench는 단순 비교 화면이 아니라:
- 비교 결과
- 검증 결과
- rule 후보
를 extractor와 rule engine으로 넘기는 계약이다.

## 다음 단계
1. slot별 `layout` 수치(`container width`, `gap`, `item bounds`)를 더 추가한다
2. 메뉴별 GNB state를 reference/working 모두 비교한다
3. `/compare/:pageId`에서 slot별 구조 diff 뿐 아니라 layout diff를 보여준다
4. unknown-pattern을 registry에 임시 등록하고 review flow를 만든다
5. overlay/floating surface를 first-class로 추가한다
6. rule inheritance와 validation replay를 구현한다
7. PC/MO source set과 validation replay를 분리 구현한다

## Coverage 상태
- `captured`: baseline(reference)과 working slot/state가 모두 있음
- `partial`: archive 또는 working은 있으나 baseline이나 일부 slot/state가 비어 있음
- `missing`: baseline도 없고 working/archive도 없음
- `replaced`: 향후 captured 대신 custom component를 적용한 상태
- `figma-derived`: 향후 Figma 기반 component를 적용한 상태

현재 구현은 `captured / partial / missing`을 우선 사용한다.
