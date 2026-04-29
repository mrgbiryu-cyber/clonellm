# Asset Spec Schema

## 목적

이 문서는 자산 파일 목록이 아니라, 각 자산이 `어떤 역할로만 사용 가능한지`를 설명하는 최소 명세 포맷을 정의한다.

핵심 원칙:

- 자산 spec은 LLM의 자유도를 과도하게 제한하기 위한 enum 시스템이 아니다.
- 자산 spec은 `잘못된 역할 재사용`을 막기 위한 최소 guardrail이다.
- 자산 spec은 파일 관리보다 `role / style / restricted use`에 초점을 둔다.

## 최소 schema

```md
assetId:
source:
role:
styleSummary:
containsText:
textDensity:
visualTone:
recommendedUse:
restrictedUse:
notes:
```

## 필드 설명

### assetId
- 시스템 내부에서 자산을 구분하는 식별자
- 예: `hero-main`, `quickmenu-image-1`

### source
- 실제 원본 URL 또는 내부 경로

### role
- 자산의 허용 역할
- 현재 허용 역할:
  - `background-only`
  - `object-only`
  - `icon-only`
  - `reference-only`
  - `promo-complete`

### styleSummary
- 사람이 읽는 한 줄 시각 요약
- 예:
  - `warm neutral living-room scene`
  - `thin black outline service icon`
  - `sale banner with embedded red promotional headline`

### containsText
- 자산 안에 이미 텍스트가 시각적으로 포함돼 있는지
- `true | false`

### textDensity
- 텍스트 개입 정도
- 권장 값:
  - `none`
  - `low`
  - `medium`
  - `high`

### visualTone
- 자산의 전반 톤
- 예:
  - `warm-neutral`
  - `promo-red`
  - `minimal-outline`
  - `editorial-soft`

### recommendedUse
- 이 자산을 어떤 경우에 쓰면 맞는지
- 자유 서술형

### restrictedUse
- 이 자산을 어떤 방식으로 쓰면 안 되는지
- 자유 서술형

### notes
- 추가 메모
- 생성 자산 대체 가능성, role ambiguity, 향후 분리 필요 여부 등

## 예시

```md
assetId: hero-main
source: https://.../Home_Hero_PC_1760x500_20260331_153421.png
role: promo-complete
styleSummary: warm living-room promo banner with embedded sale headline
containsText: true
textDensity: high
visualTone: promo-red
recommendedUse: 동일 프로모션을 그대로 보여주는 hero 완성 배너로만 사용
restrictedUse: 새로운 hero headline/cta를 다시 얹는 배경으로 사용 금지
notes: background-only로 오인 사용하면 카피 충돌 발생
```

## 운영 원칙

### 허용
- role이 맞는 자산을 Design Author의 참고/재료로 제공
- styleSummary와 restrictedUse를 함께 전달

### 금지
- `promo-complete`를 `background-only`로 오인 사용
- `promo-complete`를 `icon-only`처럼 축소 재사용
- spec이 없는 자산을 임의로 본선 사용

## 도입 순서

1. `hero`, `quickmenu` 자산부터 spec 작성
2. 잘못된 재사용이 잦은 자산부터 restricted registry로 승격
3. 이후에만 다른 section으로 확대

## 결론

지금 필요한 건 “자산을 많이 모으는 것”이 아니라, `자산 역할과 금지 사용을 설명하는 간단한 명세서`다.
