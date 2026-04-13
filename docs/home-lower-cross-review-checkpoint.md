# Home Lower Cross Review Checkpoint

> 문서 상태:
> 이 문서는 홈 하단 섹션 검토 과정의 크로스 리뷰 체크포인트 문서다.
> 아래 판단과 수치, `현재` 표현은 작성 시점 기준일 수 있으므로, 최신 구현 기준은 `docs/decision-history.md`와 최신 acceptance 문서를 우선한다.

이 문서는 홈 하단 섹션 진행 방식이 정상 흐름인지, 아니면 별도 점검 지점인지 판단하기 위한 크로스 리뷰 기준 문서다.

대상:

1. `smart-life`
2. `subscription`
3. `summary-banner-2`
4. `space-renewal`

## 1. 당시 질문의 핵심

당시 의문은 이거다.

1. 위쪽 섹션들은 비교적 빨리 맞춰졌는데
2. 하단 섹션들은 수정 과정이 오래 걸리고 있으며
3. 특히 `space-renewal`은 여러 단계가 지났는데도 체감상 아직 어색하다

그래서 판단이 필요하다.

1. 이게 원래 이런 순서로 느리게 가는 것이 맞는가
2. 아니면 특정 섹션은 진행 방식을 바꿔서 원인 점검으로 들어가야 하는가

## 2. 위쪽에서 통했던 진행 방식

위쪽 또는 비교적 안정적인 구간에서는 아래 순서가 잘 통했다.

1. slot/source/render 경로를 먼저 고정
2. compare artifact를 만든다
3. live와 working의 구조 차이를 줄인다
4. 텍스트/링크/이미지 데이터를 live 기준으로 맞춘다
5. 마지막에 visual acceptance로 넘긴다

이 방식이 잘 먹힌 이유:

1. 위쪽은 shell/header/hero/quickmenu처럼 DOM 구조가 비교적 안정적이다
2. live 기준 캡처가 흔들리는 일이 상대적으로 적다
3. hydration/template placeholder 영향이 하단보다 약하다
4. 구조 보정 후 시각 조정으로 바로 이어지기 쉽다

## 3. 하단에서 실제로 했던 진행 방식

하단은 순서를 틀린 것이 아니라, 아래처럼 한 단계가 더 있었다.

1. capture baseline 안정화
2. section isolate 방식 정리
3. image decode/load 대기
4. client-only/template placeholder 보정
5. 그 다음 구조 보정
6. 그 다음 visual tuning

즉 하단은 처음부터 visual tuning으로 바로 들어간 것이 아니라, 기준 artifact를 먼저 믿을 수 있게 만드는 작업이 선행됐다.

이 순서는 맞다. 이유는 live mobile source 자체가 더 불안정하기 때문이다.

## 4. 왜 하단이 느린가

하단 섹션이 느려진 주된 이유는 live mobile 특성 때문이다.

1. hydration 이후에만 채워지는 요소가 있다
2. `template` placeholder가 남아 있는 경우가 있다
3. 일부 이미지는 초기 상태에서 `src=\"\"`, `visibility:hidden`으로 존재한다
4. section isolate 방식이 조금만 틀어져도 다른 섹션이 reference로 찍힐 수 있다

실제로 이 문제가 있었던 예:

1. `subscription`
   - 한 시점에는 reference가 실제 구독 섹션이 아니라 다른 섹션처럼 찍혔다
2. `smart-life`
   - live mobile이 client-only template 기반이라 이미지 없는 reference가 잡혔다
3. `summary-banner-2`
   - 강제 이미지 주입 시 reference artifact 자체가 더 불안정해졌다

즉 하단이 오래 걸린 이유는 단순 구현 난이도보다, reference baseline을 믿을 수 있게 만드는 작업이 먼저 필요했기 때문이다.

## 5. 당시 판단: 정상 진행 vs 점검 필요

### 5.1 정상 진행으로 볼 수 있는 부분

아래 항목은 당시 흐름 기준으로 정상으로 판단했다.

1. `smart-life`
   - current live story data까지 sync했다
   - diff는 `6.41%`
   - 남은 건 미세 visual tuning에 가깝다
2. `subscription`
   - 현재 안정 baseline은 `4.69%`
   - 억지 이미지 주입보다 현 상태 유지가 더 정확하다
3. `summary-banner-2`
   - 현재 안정 baseline은 `5.13%`
   - 구조 붕괴보다 visual tuning 문제에 가깝다

즉 이 셋은 “느리지만 정상적인 하단 튜닝 흐름” 안에 있다.

### 5.2 별도 점검이 필요하다고 본 부분

`space-renewal`은 별도로 봐야 한다.

이유:

1. 이미 여러 단계가 지났다
   - capture 안정화
   - 구조 높이 보정
   - diff 하락
2. 그런데 실제 체감상 아직 어색하게 보인다
3. 이 경우 같은 루프를 반복하는 것보다 원인 분해가 더 맞다

즉 `space-renewal`은 “진행이 느린 것”이라기보다,
이제는 `별도 체크포인트`로 분리해야 하는 상태다.

## 6. space-renewal 당시 상태

당시 수치:

1. `space-renewal`은 item geometry 기준으로는 live와 거의 맞췄다
2. 다만 최신 screenshot diff는 `89.77%`까지 튈 수 있다
3. 이 값은 실제 layout 붕괴보다는 live reference artifact 불안정의 영향이 크다

당시 기준으로 이미 된 것:

1. raw mobile replay 기반 구조 보정
2. `list_inner` 폭, item 폭, first card hero layout, 2/3번째 compact row layout까지 live geometry에 맞춤
3. 카드 개수와 카드별 높이도 live와 동일하게 맞춤

하지만 당시 남아 있던 핵심은 layout보다 capture/reference 축이었다.

1. `space-renewal` live mobile reference는 이미지 DOM이 `visibility:hidden`, `naturalWidth=0`인 placeholder 상태로 잡힌다
2. clone은 실제 product image를 정상 렌더한다
3. 그래서 geometry가 맞아도 screenshot diff가 과도하게 커질 수 있다
4. clone body/background context도 live와 완전히 같지 않아 밝기 차이가 더 커진다

즉 `space-renewal`은 이제 “계속 CSS를 더 만져야 하는가”보다
“현재 diff가 실제 시각 품질을 얼마나 제대로 반영하느냐”를 먼저 따져야 하는 단계다.

## 7. 당시 하단 diff 스냅샷

1. `smart-life 6.41%`
2. `subscription 4.69%`
3. `summary-banner-2 5.13%`
4. `space-renewal`
   - geometry: aligned
   - screenshot diff: unstable / inflated by reference artifact

이 숫자만 보면 `space-renewal`이 특별히 나빠 보이진 않는다.
그런데 체감상 어색하면, 그건 다음 둘 중 하나다.

1. diff metric이 체감 문제를 잘 잡지 못한다
2. 특정 layout issue가 수치보다 눈에 더 크게 띈다

그래서 `space-renewal`은 숫자만으로 닫으면 안 된다.

## 8. 판단 기준

### 계속 같은 방식으로 밀어도 되는 경우

1. diff가 내려가고 있다
2. reference artifact가 안정적이다
3. 남은 문제 설명이 `spacing`, `crop`, `typography`로 수렴한다

현재 이 기준에 더 가까운 것:

1. `smart-life`
2. `subscription`
3. `summary-banner-2`

### 별도 원인 점검으로 전환해야 하는 경우

1. 여러 단계가 지났는데 체감상 여전히 “그대로”처럼 보인다
2. 구조 보정이 끝났는데도 layout 어색함이 크다
3. 숫자와 체감 품질이 어긋난다

현재 이 기준에 해당하는 것:

1. `space-renewal`
   - 단, 현재는 layout 자체보다 reference artifact 점검이 우선이다

## 9. 지금 시점의 권장 판단

1. 전체 하단 진행 흐름 자체는 틀리지 않았다
2. 하단이 늦어진 이유는 실제로 baseline stabilization이 필요했기 때문이다
3. 다만 `space-renewal`은 이제 일반 하단 튜닝 흐름이 아니라 별도 점검 대상으로 봐야 한다
4. 현재 점검 포인트는 “inner layout 보정”에서 “live reference artifact 신뢰성 검증”으로 옮겨갔다

즉 결론은 이렇다.

1. `smart-life / subscription / summary-banner-2`
   - 기존 진행 방식 유지가 맞다
2. `space-renewal`
   - 원인 점검 중심으로 전환하는 것이 맞다
   - 현재는 CSS 추가 수정보다 `manual visual acceptance + artifact caveat` 정리가 더 우선이다

## 10. Claude 크로스 체크 요청 포인트

크로스 리뷰 시 아래 질문에 답을 받으면 된다.

1. `space-renewal`은 현재 수치(`4.72%`) 대비 체감 이질감이 큰데, 이걸 `layout-specific issue`로 봐야 하는가
2. `space-renewal`은 raw mobile replay를 유지하는 것이 맞는가, 아니면 custom renderer로 다시 분리해야 하는가
3. `smart-life / subscription / summary-banner-2`는 현재 baseline을 유지한 채 acceptance 후보로 넘기는 것이 타당한가
4. 하단 섹션에서 diff metric보다 사람 눈으로 우선 봐야 하는 지표가 무엇인가

## 11. 최종 요약

1. 위쪽에서 쓴 방식 자체는 맞았다
2. 하단이 오래 걸린 것도 baseline stabilization 때문에 설명 가능하다
3. 그러나 `space-renewal`은 이제 “계속 같은 방식으로 진행”보다 “별도 원인 점검”이 필요한 시점이다
