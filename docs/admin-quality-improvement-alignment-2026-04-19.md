# 품질 상승 정렬 문서 (2026-04-19)

## 목적

이 문서는 `clonellm`의 디자인 품질 상승 방향을 Codex/Claude 관점에서 정렬하기 위한 기준 문서다.

핵심 원칙:

- 목표는 `웹디자인 수준 품질`
- `기존 구조의 보수적 연장`은 목표가 아님
- 품질을 위해서라면 `Builder V2`로 구조를 교체하는 것을 허용
- 단, 방향성은 감이 아니라 `현재 코드 기준 사실` 위에서 맞춘다

---

## 현재 코드 기준 사실

### 1. 이미 된 것

- `builder-v2` 경로가 실제 메인 경로다
- `builder-v2/orchestrator.js`
- `builder-v2/engine-v2.js`
- `builder-v2/finalize.js`
- `whole-page context`, `reference/asset sufficiency gate`, `quality-primary gate`, `visual critic`, `recovery router`는 동작한다
- `primitiveTree`는 저장만 되는 상태를 넘어서, 일부 slot에서 실제 renderer 분기에 쓰이기 시작했다

현재 primitive renderer가 우선 적용되는 범위:

- `home.hero`
- `home.quickmenu`
- `home.best-ranking`
- `home.banner`

근거 파일:

- [server.js](/home/mrgbiryu/clonellm/server.js)
- [builder-v2/engine-v2.js](/home/mrgbiryu/clonellm/builder-v2/engine-v2.js)
- [builder-v2/finalize.js](/home/mrgbiryu/clonellm/builder-v2/finalize.js)
- [builder-v2/renderer/home.js](/home/mrgbiryu/clonellm/builder-v2/renderer/home.js)

### 2. 아직 안 된 것

- `primitiveTree -> HTML` 전환이 전 범위에 적용되지 않았다
- `hero + quickmenu` 파일럿 외에는 여전히 legacy class / legacy family surface가 많이 남아 있다
- `service-like page`는 page shell 신호 일부만 반영되고, 전체 primitive renderer로 넘어가진 않았다
- `quality gate`는 강해졌지만, `좋은 디자인이 자동으로 나오게 하는 상위 레시피 층`은 아직 얕다

### 3. 현재 실패의 본질

최근 `hero + quickmenu / full / v2` 빌드는 실제로 V2 경로를 탔다.

하지만 visual critic 결과는 계속:

- `hierarchy=0`
- `retry=yes`
- `quality-failed`

즉 현재 병목은:

- `파이프라인이 안 돌아서`가 아님
- `좋은 시각 결과를 강하게 만들어내는 renderer/recipe surface가 아직 부족해서`다

---

## 지금까지 맞춰진 판단

Codex/Claude 공통으로 사실상 합의된 내용:

1. `오케스트레이션 정리`만으로는 품질이 안 오른다
2. 실제 전환점은 `renderer hard switch`다
3. `primitiveTree -> HTML/CSS` 경로가 본체가 되어야 한다
4. `hero + quickmenu`를 파일럿으로 먼저 통과시키는 게 맞다
5. legacy와 새 구조를 오래 섞는 건 오히려 비용이 크다

즉 현재 메인 질문은:

`어떻게 renderer surface를 설계해야 실제 웹디자인 수준 결과가 나오는가`

이다.

---

## 현재 선택지

### 선택지 A. custom token + scoped CSS 계속 확장

현재 방향:

- `builder-v2/renderer/home.js`에서 직접 HTML/CSS를 조립
- `--codex-*`, `--v2-*` 변수 사용
- slot/component별 scoped CSS 적용

장점:

- self-contained
- 외부 CDN 의존 없음
- preview/screenshot 안정성 좋음
- 조건 분기, tone 분기가 코드에 명확히 남음

단점:

- 좋은 디자인 레시피와 CSS surface를 직접 많이 만들어야 함
- 반응형/모션/토큰 시스템을 repo 안에서 계속 확장해야 함

### 선택지 B. renderer는 유지하되 Tailwind/DaisyUI recipe mapping 채택

방향:

- LLM은 `primitive type + variant + props`만 냄
- renderer가 그걸 미리 정의된 Tailwind/DaisyUI recipe로 펼침

장점:

- utility vocabulary가 풍부함
- 반응형/spacing/typography/motion을 빠르게 확보 가능
- 레시피 생산 속도가 빨라질 수 있음

단점:

- CDN 방식이면 preview 안정성이 흔들릴 수 있음
- 로컬 정적 번들 방식으로 가져오려면 세팅이 더 필요함
- 현재 custom CSS surface와 병행 시 혼합비용이 생김

### 선택지 C. 레시피 우선형 custom renderer

방향:

- 기술 스택은 현재 custom scoped CSS 유지
- 대신 `hero`, `quickmenu` 각각에 대해 상위권 레시피 4~6개를 먼저 고정
- LLM은 자유 생성보다 `레시피 선택 + 세부 파라미터 주입`만 담당

장점:

- 현재 구조와 가장 잘 이어짐
- 품질 예측 가능성이 높음
- `first-pass quality`를 빠르게 올리기 좋음

단점:

- 레시피 설계 비용이 듦
- 범용성보다 파일럿 품질 최적화에 더 가깝다

---

## Codex 현재 권고

현 시점 권고는 `C -> A` 순서다.

즉:

1. `hero + quickmenu`에 대해
   - 고품질 레이아웃 레시피 세트 먼저 고정
   - 이 레시피를 V2 renderer에 박는다
2. 그 위에
   - 타이포
   - 자산 treatment
   - spacing rhythm
   - motion
   을 custom scoped CSS로 확장한다
3. Tailwind/DaisyUI는 필요하면 이후 가속기로 재검토한다

이유:

- 지금 필요한 건 범용 기술 선택보다 `파일럿 통과`
- 현재 병목은 `자유도 부족`보다 `좋은 상위 레이아웃 레시피 부재`

---

## Claude와 맞출 핵심 질문

아래 5개를 Claude와 맞추면 된다.

### Q1. 파일럿 우선 범위

`home.hero + home.quickmenu`만 먼저 끝까지 통과시키는 것에 동의하는가?

권고 답:

- `예`

### Q2. renderer 기술 선택

`custom scoped CSS`를 유지하며 레시피 확장을 먼저 할지,
아니면 바로 `Tailwind/DaisyUI recipe mapping`으로 갈지

Codex 권고:

- 우선 `custom scoped CSS + recipe set`

### Q3. 품질 상승의 주된 레버

무엇이 가장 효과적인가?

후보:

- 더 많은 LLM reasoning
- 더 많은 critic loop
- 더 강한 asset generation
- 더 좋은 레이아웃 recipe set

Codex 권고:

- `더 좋은 레이아웃 recipe set`

### Q4. hero/quickmenu 파일럿의 완료 조건

아래를 모두 만족해야 파일럿 완료로 본다.

- 실제 HTML이 `V2 renderer`를 탄다
- visual critic에서 `retry=no`
- `hierarchy`가 유의미하게 올라간다
- 실제 화면을 봤을 때 legacy보다 명확히 우수하다

### Q5. 이후 확장 순서

Codex 권고:

1. `hero`
2. `quickmenu`
3. `best-ranking`
4. `banner`
5. `commerce`
6. `service-like pages`

---

## 다음 실행 제안

Claude와 합의 후 바로 들어갈 실제 작업:

1. `hero recipe set 4~5개`
2. `quickmenu recipe set 4~5개`
3. `builder-v2/renderer/home.js`에 variant/recipe 체계로 반영
4. `hero + quickmenu`만 다시 빌드
5. 품질 게이트 + 실제 화면 둘 다 확인

관련 수집/운영 기준 문서:

- [admin-recipe-collection-schema-2026-04-19.md](/home/mrgbiryu/clonellm/docs/admin-recipe-collection-schema-2026-04-19.md)

이 순서로 가야 `파일럿 통과 여부`를 빠르게 판단할 수 있다.

---

## 결론

현재 V2는 방향이 맞고, 파이프라인도 많이 정리됐다.

하지만 품질을 실제로 끌어올리는 핵심은 이제:

- `오케스트레이션`
- `critic loop`

가 아니라

- `좋은 레이아웃 레시피`
- `그걸 직접 HTML/CSS로 조립하는 renderer surface`

다.

즉 Claude와 맞춰야 할 합의점은:

`기술 스택 논쟁`보다
`어떤 renderer surface와 recipe 체계로 hero + quickmenu 파일럿을 통과시킬 것인가`

이다.

추가 고정 원칙:

- [admin-page-first-builder-v2-principles-2026-04-20.md](/home/mrgbiryu/clonellm/docs/admin-page-first-builder-v2-principles-2026-04-20.md)
