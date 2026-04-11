# Interaction Implementation Plan

> 먼저 읽을 기준 문서:
> `docs/project-purpose-reference.md`

이 문서는 LLM 전 단계에서 반드시 닫아야 하는 인터랙션 구현 축을 정리한다.

목적은 세 가지다.

1. 현재 빠져 있는 인터랙션을 화면 단위가 아니라 `interaction unit` 단위로 정의한다.
2. 구현 스케줄과 검증 방식을 고정한다.
3. 나중에 LLM이 인터랙션도 `slot/source/variant`처럼 수정할 수 있도록 `LLM-editable interaction` 기준을 만든다.

---

## 1. 기본 원칙

1. 인터랙션도 최종 기준은 `live reference browser view`다.
2. 인터랙션은 `구조`, `스타일`, `상태 전이`를 분리해서 본다.
3. 인터랙션은 `section/slot`에 종속된 `interaction unit`으로 등록한다.
4. 신규 인터랙션은 메인에 바로 넣지 않고, 가능한 경우 sandbox 또는 isolated replay로 먼저 검증한다.
5. LLM 전에는 최소 baseline interaction을 닫고, LLM 이후에는 patch 가능한 형태로 승격한다.

---

## 2. 우선 구현 대상

### 2.1 Home

1. `home.gnb.open`
   - 1depth open
   - 2depth active underline
   - 3depth visible state
   - panel switch

2. `home.hero.carousel`
   - active slide
   - next/prev
   - indicator sync
   - auto rotate / pause

3. `home.quickmenu.carousel`
   - item width after init
   - active page
   - indicator

4. `home.timedeal.carousel`
   - 2-card viewport
   - active index
   - swipe/slide state

5. `home.lower.slider`
   - `latest-product-news`
   - `smart-life`
   - 향후 하단 slider형 섹션들

### 2.2 PLP

1. `plp.filter.open`
2. `plp.sort.open`
3. `plp.banner.carousel`
4. `plp.product-card.hover`

### 2.3 PDP

1. `pdp.gallery.carousel`
2. `pdp.gallery.thumbnail.sync`
3. `pdp.option.select`
4. `pdp.sticky.buybox`
5. `pdp.review.expand`
6. `pdp.qna.expand`

### 2.4 Support / Search

1. `support.tab.switch`
2. `support.accordion.open`
3. `search.filter.open`
4. `search.sort.open`

---

## 3. 구현 방식

### 3.1 interaction inventory 먼저 작성

각 인터랙션마다 아래를 먼저 기록한다.

1. `interactionId`
2. `pageId`
3. `slotId`
4. `viewportProfile`
5. `triggerType`
   - `hover`
   - `click`
   - `focus`
   - `swipe`
   - `timer`
6. `stateBefore`
7. `stateAfter`
8. `visibleProof`
   - screenshot / rect / aria / class

### 3.2 controller를 분리

인터랙션 구현은 가능한 한 아래 구조를 따른다.

1. `state detector`
2. `trigger controller`
3. `render updater`
4. `verification step`

즉:
- DOM patch만 하지 않는다
- trigger와 state verification을 같이 구현한다

### 3.3 baseline 먼저

모든 인터랙션을 완벽 재현하려 하지 않는다.

우선 순위:

1. 사용자가 눈으로 바로 느끼는 baseline interaction
2. active/visible state
3. indicator sync
4. 자동재생/세부 애니메이션

### 3.4 accepted-main 보호

accepted-main을 가진 홈/페이지에서는:

1. 메인을 흔드는 인터랙션 패치는 작은 단위로만 반영
2. 새로운 인터랙션은 sandbox / isolated variant 우선
3. 회귀 시 즉시 롤백

### 3.5 시각 비교 루프를 기본 절차로 사용

인터랙션 구현 전/후에는 아래 비교 루프를 기본으로 사용한다.

1. `live reference screenshot` 확보
2. 현재 `clone` screenshot 확보
3. 같은 viewport / 같은 state / 같은 section 범위로 비교
4. 차이를 `structure / style / interaction` 중 하나로 분류
5. 수정 후 다시 screenshot 비교

현재 도구:

1. `scripts/capture_visual_snapshots.py`
2. `scripts/capture_states.mjs`
3. `/compare/:pageId`
4. 기존 `data/visual/*` 산출물

원칙:

1. 먼저 기존 도구를 재사용한다.
2. 정말 부족할 때만 외부 의존성을 추가한다.
3. 외부 의존성 추가가 필요하면 목적을 명확히 제한한다.
   - 예: pixel diff, section crop, annotation overlay

현재 판단:

- 아직은 기존 screenshot/capture 도구로 충분히 진행 가능하다.
- 외부 이미지 분석 모듈은 `기존 캡처 + compare`만으로 section 판정이 불충분할 때만 추가한다.

---

## 4. 섹션별 체크리스트

### 4.1 GNB

1. `open-state-check`
2. `depth2-active-check`
3. `depth3-visible-check`
4. `panel-position-check`
5. `panel-type-check`
6. `right-promo-check`
7. `hover-transition-check`

### 4.2 Hero

1. `active-slide-check`
2. `indicator-sync-check`
3. `next-prev-check`
4. `auto-rotate-check`
5. `pause-on-interaction-check`
6. `text-image-sync-check`

### 4.3 Slider / Carousel 계열

1. `item-width-check`
2. `visible-count-check`
3. `active-index-check`
4. `clipping-check`
5. `indicator-check`
6. `swipe-or-nav-check`

### 4.4 Expand / Accordion 계열

1. `collapsed-state-check`
2. `expanded-state-check`
3. `height-transition-check`
4. `aria-expanded-check`
5. `content-visibility-check`

---

## 5. LLM-editable interaction 기준

인터랙션도 LLM이 수정 가능하려면 아래 필드가 있어야 한다.

1. `interactionId`
2. `slotId`
3. `activeSourceId`
4. `triggerType`
5. `stateSchema`
6. `timingSchema`
7. `controlSchema`
8. `verificationSchema`

예:

```json
{
  "interactionId": "home.hero.carousel",
  "slotId": "hero",
  "activeSourceId": "pc-like",
  "triggerType": "timer+click",
  "stateSchema": {
    "activeIndex": "number",
    "paused": "boolean"
  },
  "timingSchema": {
    "intervalMs": "number",
    "transitionMs": "number"
  },
  "controlSchema": {
    "showIndicator": "boolean",
    "showPrevNext": "boolean"
  },
  "verificationSchema": {
    "indicatorSync": "boolean",
    "slideVisibleCount": "number"
  }
}
```

### 5.1 LLM이 수정할 수 있는 범위

1. autoplay on/off
2. interval / transition duration
3. indicator visibility
4. active style token
5. hover / click trigger policy
6. default active index

### 5.2 LLM이 직접 건드리면 안 되는 범위

1. 임의 DOM 탐색 selector 전체 교체
2. 전역 이벤트 리스너 구조 파괴
3. 검증 없는 timer 삽입
4. accepted-main을 직접 깨는 interaction source 교체

---

## 6. 스케줄

### Phase I1. Interaction Inventory

1. Home interaction inventory 작성
2. PLP/PDP/support/search interaction inventory 작성
3. `interactionId` naming freeze

Exit:

- 주요 페이지군에 `interaction inventory`가 존재

### Phase I2. Baseline Interaction Implementation

1. `home.gnb.open`
2. `home.hero.carousel`
   - status: `in_progress`
   - current baseline:
     1. prev/next
     2. indicator sync
     3. autoplay start
     4. hover/focus pause-resume
3. `home.quickmenu.carousel`
4. `pdp.gallery.carousel`
5. `pdp.option.select`
6. `support.accordion.open`

Exit:

- 사용자 기준 핵심 인터랙션 baseline pass

### Phase I2.5. Section Screenshot Compare Loop

1. 섹션 묶음별 `reference screenshot` 저장
2. 동일 섹션의 현재 `clone screenshot` 저장
3. `reference vs clone` 비교를 섹션 단위로 기록
4. 차이를 다음 구현 턴의 입력으로 사용

대상 묶음 예:

1. `home` 상단
2. `home` 하단 mobile-derived pack
3. `home` custom-renderer pack
4. `PLP`
5. `PDP`

Exit:

1. 각 섹션 묶음에 대해 비교 screenshot이 존재
2. 차이 분류가 `structure/style/interaction`으로 기록됨

### Phase I3. Interaction Verification

1. browser 시각 확인
2. state verification
3. accepted-main 회귀 점검
4. `interaction pass/fail` 기록

Exit:

- 핵심 interaction blocker = 0

### Phase I4. Interaction Componentization

1. interaction unit을 slot/variant에 연결
2. `interaction registry` 작성
3. `activeInteractionSourceId` 또는 동등 구조 검토

Exit:

- 인터랙션이 코드 분기가 아니라 registry 데이터로 식별 가능

### Phase I5. LLM-editable Interaction Preparation

1. interaction patch schema 작성
2. interaction editable list 작성
3. workspace에서 interaction draft 저장 경로 추가
4. replay / rollback 규칙 추가

Exit:

- 인터랙션도 `LLM-editable list`에 포함됨

---

## 7. 완료 조건

LLM 전에는 아래가 모두 필요하다.

1. 핵심 page family의 baseline interaction이 실제 브라우저에서 동작
2. interaction inventory가 문서/코드 기준으로 존재
3. interaction unit이 slot/component와 연결됨
4. interaction replay / rollback이 가능
5. interaction editable list가 작성됨
6. 핵심 section 묶음별 reference/clone screenshot 비교 기록이 존재

이 조건이 닫혀야 `view fix only`에서 `LLM-editable system`으로 넘어간다.
