# Design Tooling Strategy

이 문서는 `admin` 프리뷰 워크벤치에서 사용할 디자인 도구와 `AI스럽지 않은 시안`을 만들기 위한 운영 기준을 정리한 문서다.

핵심 전제는 아래와 같다.

1. 이 시스템의 목적은 `최종 서비스 디자인`이 아니라 `고객 요청 프리뷰용 시안`이다.
2. 따라서 중요한 것은 자유도 축소 자체가 아니라 `브랜드 디자인을 우선한 상태에서 설득력 있는 변화`다.
3. 디자인 변화율은 사용자가 조절하되, `AI 티 방지 규칙`은 별도 축으로 유지한다.

---

## 1. 핵심 원칙

1. Builder는 `브랜드 디자인을 우선하는 preview designer-builder`다.
2. Builder는 현재 시스템 안에서 변주하되, 변화율이 허용하는 탐색 폭은 적극 활용한다.
3. 레퍼런스는 복제 기준이 아니라 `분위기 참고`다.
4. 디자인 변화율은 `얼마나 바꿀지`를 정하고, anti-AI 규칙은 `어떻게 안 바뀌어야 하는지`를 정한다.

---

## 2. Anti-AI-Look Rules

아래 규칙은 디자인 변화율과 별도로 항상 적용한다. 다만 목적은 `자유도 억제`가 아니라 `브랜드 안전선 유지`다.

### 2.1 Baseline preservation

1. 현재 페이지의 구조적 정체성을 유지한다.
2. 기존 컴포넌트 조합과 위계를 우선 사용한다.
3. 새 패턴을 발명하기보다 기존 패턴을 더 설득력 있게 정리한다.

### 2.2 Brand safety

1. 브랜드 톤을 벗어나는 과한 실험형 스타일은 금지한다.
2. 과한 glass, neon, dribbble-style hero, 장식용 그래픽 과잉 사용을 금지한다.
3. 가격/스펙/상품 사실 정보는 절대 임의 변경하지 않는다.

### 2.3 Content discipline

1. 카피는 짧고 목적 중심으로 정리한다.
2. 실제 정보 구조를 해치지 않는 선에서만 강조점을 조정한다.
3. PLP는 탐색성, PDP는 신뢰감과 명료함, Home은 첫 인상과 큐레이션 연결감을 우선한다.

### 2.4 Visual discipline

1. spacing, radius, shadow, typography는 허용된 토큰 범위 안에서만 움직인다.
2. 섹션별 강조 포인트는 1개 또는 2개만 둔다.
3. 한 화면에 스타일 언어를 여러 개 섞지 않는다.

### 2.5 Motion discipline

1. 모션은 방향성을 보강하는 수준에서만 사용한다.
2. 과한 패럴랙스, 과한 스크롤 연출, 의미 없는 bounce/elastic 효과는 피한다.
3. in-view reveal, stagger, short fade/slide 정도의 절제된 모션을 우선한다.

---

## 3. 디자인 변화율과 Anti-AI 규칙의 관계

### 3.1 디자인 변화율

1. `하`
   - 현재 화면을 거의 유지한다.
   - 카피/톤/강조점 위주로 바꾼다.
   - 레이아웃 변화는 최소화한다.
2. `중`
   - 현재 구조를 유지한다.
   - 섹션 인상과 위계를 체감되게 조정한다.
   - source 교체와 patch를 선택적으로 사용한다.
3. `상`
   - 브랜드를 벗어나지 않는 선에서 체감 변화를 분명히 만든다.
   - 핵심 슬롯의 시각 인상 변화까지 허용한다.
   - 레퍼런스 해석을 바탕으로 시각 체감을 적극적으로 만든다.

### 3.2 변화율 프로파일

변화율은 내부적으로 아래 항목을 함께 제어한다.

1. 레이아웃 변화 폭
2. 카피 변화 폭
3. source 교체 적극성
4. 모션 허용 수준
5. 강조 대비 강도

프로파일 예시:

1. `하`
   - layout shift: minimal
   - copy shift: light
   - source swap: minimal
   - motion: minimal
   - emphasis: soft
2. `중`
   - layout shift: controlled
   - copy shift: noticeable
   - source swap: selective
   - motion: subtle
   - emphasis: moderate
3. `상`
   - layout shift: assertive-within-baseline
   - copy shift: strong
   - source swap: active
   - motion: meaningful
   - emphasis: strong

### 3.3 Anti-AI 규칙

1. 변화율이 `상`이어도 brand safety는 유지한다.
2. 변화율이 `하`라도 AI 티가 나는 과장된 스타일은 금지한다.
3. 즉 변화율은 `강도`, anti-AI 규칙은 `방향 제한`이다.

---

## 4. 도구 분류 기준

디자인 도구는 두 종류로 나눈다.

1. `외부 컨셉 도구`
   - 아이데이션, 레퍼런스 탐색, 시안 방향 탐색
2. `내부 Builder 도구`
   - 실제 시스템 안에서 적용 가능한 토큰/스타일/모션 도구

외부 도구가 직접 Builder를 대체하지는 않는다.

---

## 5. 1차 디자인 도구 세트

1차는 `지금 바로 Builder의 브랜드 일관성과 시각 품질에 직접 기여하는 도구`다.

### 5.1 Style Dictionary

역할:

1. 색상, spacing, radius, typography, elevation 같은 디자인 토큰의 기준 저장소
2. page family별 theme 확장 기반
3. Builder가 임의 값 대신 허용된 토큰을 선택하도록 강제

도입 이유:

1. AI 티를 줄이는 가장 강한 방법은 브랜드 디자인 기준을 토큰으로 고정하는 것이다.
2. 토큰 기준이 있으면 홈/PLP/PDP의 디자인 일관성이 올라간다.

### 5.2 Open Props

역할:

1. CSS 변수 기반의 spacing, shadow, easing, gradients 등 빠른 스타일 자산 제공
2. 현 구조의 HTML/CSS 기반 렌더에 바로 연결 가능

도입 이유:

1. 무거운 프레임워크 도입 없이 시각 품질을 올릴 수 있다.
2. Builder가 선택 가능한 스타일 표면을 빠르게 구성할 수 있다.

### 5.3 Motion

역할:

1. 절제된 reveal, stagger, in-view motion 제공
2. 정적인 AI 결과물이 주는 뻣뻣함 감소

도입 이유:

1. Home, PLP, PDP 모두에서 과하지 않은 체감 품질 개선이 가능하다.
2. GSAP보다 가볍고 현재 구조에 붙이기 쉽다.

### 5.4 1차 세트 요약

1. `Style Dictionary` = 규칙 고정
2. `Open Props` = 토큰화된 스타일 표면
3. `Motion` = 절제된 모션

---

## 6. 2차 디자인 도구 세트

2차는 `표현력과 탐색 폭을 넓히는 도구`다. 당장 없어도 핵심 Builder 품질은 유지 가능하다.

### 6.1 GSAP

역할:

1. 더 정교한 타임라인과 인터랙션
2. 프리미엄 홈/캠페인형 연출 강화

2차인 이유:

1. 현재 우선순위는 고급 연출보다 baseline-preserving 품질이다.
2. 과한 연출은 오히려 AI 티를 늘릴 수 있다.

### 6.2 Konva

역할:

1. 디자인 보드, 캔버스 편집, 오버레이 편집
2. admin 내부의 시각 편집 UI 확장

2차인 이유:

1. 현재 시스템의 핵심은 코드/slot 기반 preview generation이지, 캔버스 편집기가 아니다.

### 6.3 External concept tools

후보:

1. Google Stitch
2. Figma Make
3. Relume Style Guide Builder

2차인 이유:

1. 컨셉 탐색에는 강하지만 우리 Builder의 직접 실행 도구는 아니다.
2. 실제 시스템 적용은 내부 Builder가 담당해야 한다.

---

## 7. 외부 도구의 위치

### 7.1 Google Stitch

권장 위치:

1. 고충실도 컨셉 탐색기
2. 외부 레퍼런스 보강 도구

장점:

1. 빠른 아이데이션
2. 다양한 방향 시안 탐색

주의:

1. 결과를 그대로 복제 기준으로 삼으면 AI 티가 강해질 수 있다.

### 7.2 Figma Make

권장 위치:

1. 디자인 시스템/라이브러리 기반 시안 참고 도구
2. 내부 디자인 언어가 정리된 뒤 연동 가치가 커진다.

장점:

1. Figma library와 custom rules를 먹이는 흐름이 있어 온브랜드 제어에 유리하다.

### 7.3 Relume Style Guide Builder

권장 위치:

1. 홈/마케팅 페이지용 온브랜드 스타일 가이드 참고 도구
2. 초기 고객 승인용 스타일 콘셉트 탐색

장점:

1. 빠른 스타일 가이드/타이포/컬러 방향 탐색

주의:

1. PLP/PDP를 세밀하게 제어하는 Builder의 중심 엔진으로 보기는 어렵다.

---

## 8. Builder가 디자인을 잘하게 하는 방식

핵심은 `좋은 모델 1개`가 아니라 `브랜드 기준 + 변화율 프로파일 + 최소 안전선`이다.

### 8.1 규칙 기반 생성

1. Planner가 방향을 정리한다.
2. Builder는 허용된 slot/source/patch 안에서만 움직인다.
3. 토큰 시스템이 브랜드 기준을 고정하고 변화율 프로파일이 탐색 폭을 정한다.

### 8.2 페이지 유형별 원칙

1. Home
   - 첫 인상
   - 브랜드 감도
   - 하단 큐레이션 연결감
2. PLP
   - 탐색성
   - 카드 밀도
   - 필터/정렬 가독성
3. PDP
   - 신뢰감
   - 요약/가격/구매 영역의 명료함
   - 사실 정보 보존

### 8.3 Critic 단계 필요

향후 추가 권장:

1. Builder 결과 뒤에 `design critic` 평가 단계
2. 평가 항목:
   - AI 티 과잉 여부
   - 브랜드 이탈 여부
   - 페이지 유형 적합성
   - 정보 구조 손상 여부

---

## 9. 현재 권장 도입 순서

1. Builder에 브랜드 우선 + 변화율 프로파일을 프롬프트와 server context에 반영
2. `Style Dictionary` 도입
3. `Open Props` 도입
4. `Motion` 도입
5. 이후 `GSAP` 또는 외부 컨셉 도구 연동 검토

---

## 10. 현재 확정안

1. 디자인 변화율과 anti-AI 규칙은 별도 축으로 운영한다.
2. Builder는 자유도 억제보다 브랜드 우선을 기준으로 움직인다.
3. 변화율은 단순 `하/중/상`이 아니라 내부 변화율 프로파일로 해석한다.
4. 1차 디자인 도구 세트는:
   - `Style Dictionary`
   - `Open Props`
   - `Motion`
5. 2차 디자인 도구 세트는:
   - `GSAP`
   - `Konva`
   - `Google Stitch`
   - `Figma Make`
   - `Relume Style Guide Builder`
6. 외부 도구는 컨셉 탐색용이고, 실제 적용은 내부 Builder가 담당한다.
