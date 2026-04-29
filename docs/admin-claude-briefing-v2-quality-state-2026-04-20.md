# Builder V2 품질 상태 브리핑 for Claude (2026-04-20)

## 목적

이 문서는 현재 `Builder V2`의 실제 코드 상태와 최근 파일럿 결과를 Claude에게 한 번에 설명하기 위한 브리핑이다.

요구사항:

- 현재 상태를 코드 근거로 요약
- 이미 해결된 것과 아직 병목인 것을 분리
- `Tailwind/DaisyUI` 옵션을 다시 검토할 수 있도록 현재 custom scoped CSS 경로와 비교
- Claude가 답해야 할 쟁점을 명확히 제시

---

## 1. 현재 코드 상태 요약

### 1.1 V2 파이프라인은 실제로 동작 중

현재 `Builder V2`는 오케스트레이션/엔진/마무리 경로가 분리되어 있다.

- V2 orchestration:
  - [builder-v2/orchestrator.js](/home/mrgbiryu/clonellm/builder-v2/orchestrator.js)
- V2 engine:
  - [builder-v2/engine-v2.js](/home/mrgbiryu/clonellm/builder-v2/engine-v2.js)
- V2 finalize:
  - [builder-v2/finalize.js](/home/mrgbiryu/clonellm/builder-v2/finalize.js)

`legacy adapter`는 제거되었다. 현재 V2 경로는 실제 엔진을 직접 타고 있다.

### 1.2 primitiveTree는 실제로 저장되고 사용된다

최근 파일럿 빌드 로그 기준:

- `primitive-coverage page=home total=2 withPrimitive=2 withoutPrimitive=0`
- `primitiveTargets=home.hero,home.quickmenu`

즉 `home.hero`, `home.quickmenu`는 실제로 `primitiveTree`를 가진다.

draft 확인 기준:

- `builderVersion: "v2"`
- `buildResult.report.componentComposition["home.hero"].primitiveTree` 존재
- `buildResult.report.componentComposition["home.quickmenu"].primitiveTree` 존재

### 1.3 hero/quickmenu는 실제로 V2 renderer를 탄다

현재 V2 renderer:

- [builder-v2/renderer/home.js](/home/mrgbiryu/clonellm/builder-v2/renderer/home.js)

`server.js`에서 primitive variant가 해석되면 V2 renderer를 우선 호출한다.

- hero primitive path:
  - [server.js](/home/mrgbiryu/clonellm/server.js)
- quickmenu primitive path:
  - [server.js](/home/mrgbiryu/clonellm/server.js)

실제 렌더 HTML에는 아래 클래스가 들어간다.

- `codex-v2-home-surface`
- `codex-v2-home-hero`
- `codex-v2-home-quickmenu`

즉 현재 품질 실패는 `legacy fallback`이 주원인인 상태는 아니다.

### 1.4 whole-page context는 입력에 들어간다

LLM은 원본 페이지를 DOM이 아니라 멀티모달 이미지 컨텍스트로 본다.

입력 이미지 순서:

- `clone-original-fullpage`
- `clone-target-overlay`
- `clone-target-focus`
- 그 다음 reference screenshot

관련 코드:

- [llm.js](/home/mrgbiryu/clonellm/llm.js)

---

## 2. 최근 수정 중 실제 반영된 것

### 2.1 tone fallback 보정

renderer에서 `primitiveTone`이 `neutral`이면 `recipe.tone`으로 승격하는 로직이 들어가 있다.

효과:

- `centered/stacked` 류는 `cinematic/premium`으로 자동 승격 가능
- neutral 기본값 때문에 지나치게 무채색/저대비로 가는 문제 일부 완화

### 2.2 neutral surface 강화

`neutral` surface는 이전의 거의 순백 계열에서 더 푸른 톤과 깊은 그림자/오버레이를 가지도록 강화됐다.

효과:

- 원본 LGE 흰색 페이지와의 차이를 더 쉽게 만듦
- `delta/changeStrength` 개선

### 2.3 recipe library 확장

새 레시피 파일:

- [home-recipe-library.json](/home/mrgbiryu/clonellm/data/normalized/home-recipe-library.json)

현재 수량:

- `hero 12개`
- `quickmenu 9개`

renderer는 이제 `primitiveId + variant + tone + recipeId` 기준으로 recipe를 고른다.

---

## 3. 최근 파일럿 결과

파일럿 범위:

- `home.hero + home.quickmenu`
- `full`
- `builderVersion=v2`

최근 빌드 결과:

- visual critic 1차:
  - `hierarchy=0`
  - `changeStrength=6`
  - `delta=0.205473`
  - `quality-failed`
- recovery 후:
  - `hierarchy=0`
  - `changeStrength=6`
  - `delta=0.301827`
  - `quality-failed`

해석:

- `delta`는 분명 올라갔다
- 즉 `원본과 너무 비슷하다`는 문제는 일부 개선됐다
- 하지만 `hierarchy`가 여전히 `0`
- 그래서 현재 본체 문제는 `tone`이 아니라 `상위 위계 설계`다

---

## 4. 현재 판단

### 4.1 이미 아닌 원인

아래는 현재 코드/로그 기준으로 주원인이라고 보기 어렵다.

- `primitiveTree가 없어서 legacy fallback으로 빠진다`
- `V2 renderer가 실제로 안 탄다`
- `critic 모델이 free tier라 hierarchy=0을 잘못 준다`

현재 실제 critic 모델은 `anthropic/claude-sonnet-4.6`이다.

### 4.2 현재 남은 실제 병목

현재 병목은 이 두 가지로 본다.

1. `hero/quickmenu 상위 recipe 품질`
2. `whole-page context 캡처 폭 왜곡`

특히 두 번째는 실제 캡처가 지나치게 좁게 찍히는 경우가 있어 generation/critic 모두를 왜곡할 가능성이 있다.

예:

- `222x1400`
- `190x1200`

즉 “전체를 본다”는 설계는 맞지만, 실제로 “좋은 전체 화면”을 보고 있지 않을 수 있다.

---

## 5. Tailwind / DaisyUI 옵션에 대한 현재 판단

### 5.1 현재 메인라인은 Tailwind가 아니다

현재 메인라인은 `custom scoped CSS` 기반이다.

- 실제 코드:
  - [builder-v2/renderer/home.js](/home/mrgbiryu/clonellm/builder-v2/renderer/home.js)

즉 Tailwind/DaisyUI는 아직 문서상 옵션이지, 실제 runtime에는 들어가 있지 않다.

### 5.2 왜 처음부터 Tailwind를 쓰지 않았는가

처음엔 아래 이유로 custom scoped CSS를 먼저 택했다.

- V2 전환을 빠르게 세우기 쉬웠음
- 기존 시스템과 연결 비용이 적었음
- renderer-owned surface를 먼저 만들 수 있었음
- 외부 CDN/빌드 파이프라인 의존을 피하고 싶었음

즉 `Tailwind보다 품질 우위가 검증돼서`가 아니라, `전환 비용이 더 적어서`였다.

### 5.3 지금도 custom scoped CSS를 유지해야 하는가

이건 현재 미확정이다.

현 상태에선:

- custom scoped CSS가 충분히 강한 recipe surface로 자랄 수 있다면 유지 가능
- 하지만 `hero/quickmenu` 파일럿에서 계속 `hierarchy=0`이면
  - renderer surface 자체를 재검토해야 한다
  - 그때 `Tailwind + DaisyUI recipe mapping`은 강한 옵션이 된다

중요:

- Tailwind를 쓰더라도 `LLM이 raw utility class를 직접 쓰게 하는 방식`은 원하지 않는다
- 맞는 방향은:
  - LLM은 `primitive + variant + recipe`만 고름
  - renderer가 이를 `Tailwind/DaisyUI recipe block`으로 전개

즉 비교 대상은:

- `custom scoped CSS recipe renderer`
- `Tailwind/DaisyUI recipe renderer`

---

## 6. 지금 필요한 질문

Claude에게 아래 질문에 답을 받고자 한다.

### Q1. 현재 상태 진단

현재 코드/결과를 보면, 품질 병목을 아래 둘로 보는 판단이 맞는가?

- `hero/quickmenu 상위 recipe 품질`
- `whole-page context 캡처 폭 왜곡`

이 외에 더 우선순위가 높은 병목이 있나?

### Q2. custom scoped CSS 유지 vs Tailwind/DaisyUI 비교

현재 시점에서 더 빠른 품질 상승 경로는 어느 쪽인가?

- A: 현재 `custom scoped CSS renderer`를 유지하고 hero/quickmenu recipe를 더 강하게 다듬는다
- B: `Tailwind/DaisyUI recipe renderer`를 별도 compare mode로 만들어 A/B 평가한다

### Q3. hero/quickmenu 파일럿 완료 조건

아래를 파일럿 완료 조건으로 보는 데 동의하는가?

- `primitiveTree`가 실제로 저장됨
- V2 renderer가 실제 HTML에 반영됨
- `retry=no`
- `hierarchy >= 72`
- before/after 실제 화면 비교에서 legacy보다 우수

### Q4. recipe 전략

현재 `hero 12`, `quickmenu 9` 개수는 충분하다고 보고, 이제는 `상위 2~3개 recipe 품질 강화`에 집중하는 게 맞는가?

즉 다음 단계는:

- recipe 개수 추가보다
- `hero top recipes`
- `quickmenu top recipes`
를 훨씬 더 공격적으로 재설계하는 방향이 맞는가?

### Q5. page-first 관점

현재 `hero + quickmenu` 파일럿은 맞지만, 설계는 처음부터 `page-first`로 봐야 한다고 정리해두었다.

즉:

- `hero + quickmenu`는 top-stage cluster
- 나중에 `ranking/banner/commerce/service page`로 바로 확장해야 함

이 page-first 방향에 동의하는가?

### Q6. section-family prompt contract 필요성

현재는 recipe와 renderer는 강화됐지만, 생성 지시 자체는 여전히 비교적 범용적이다.

우리는 아래 가설을 가지고 있다.

- recipe만으로는 부족할 수 있다
- `hero`와 `quickmenu`는 서로 다른 생성 계약이 필요하다
- 즉 `global prompt` 아래에 `section-family prompt contract`를 별도로 둬야 한다

예상 구조:

- `global page contract`
- `top-stage cluster contract`
- `hero generation contract`
- `quickmenu generation contract`
- 필요하면 `recipe-specific contract`

예시:

- `hero`
  - headline이 support copy보다 한 단계 이상 지배적이어야 한다
  - primary visual focal point가 먼저 읽혀야 한다
  - CTA는 support rail보다 먼저 인식되어야 한다
- `quickmenu`
  - lead entry 하나가 명확히 우세해야 한다
  - secondary entries는 scanable rhythm을 가져야 한다
  - sibling card 사이의 icon/container treatment는 일관되어야 한다

질문:

- 이 방향에 동의하는가?
- 그렇다면 지금 단계에서 `hero`, `quickmenu` 각각 어떤 contract 항목을 최소 필수로 넣는 게 맞는가?

### Q7. compare mode 필요성

현재 custom scoped CSS 경로를 유지하고 있지만, 품질 우위가 증명된 상태는 아니다.

우리는 아래를 논의 대상으로 본다.

- 같은 입력
- 같은 primitiveTree/recipe
- 같은 asset/copy 조건

으로 두 renderer를 비교하는 `compare mode`를 만든다.

- A: current custom scoped CSS renderer
- B: Tailwind/DaisyUI recipe renderer

중요:

- 한 페이지 안에 두 hero를 위아래로 같이 넣는 방식은 원하지 않는다
- 대신 별도 compare harness에서
  - A 결과 화면
  - B 결과 화면
  을 나란히 캡처/평가하는 구조를 생각한다

질문:

- 이 compare mode가 현재 시점에 유효한가?
- 아니면 아직은 custom scoped CSS 쪽을 더 밀어도 된다고 보는가?

### Q8. clone 원본 확인 방식의 충분성

현재 LLM은 원본 페이지를 DOM이 아니라 이미지 컨텍스트로 본다.

- `clone-original-fullpage`
- `clone-target-overlay`
- `clone-target-focus`
- reference screenshot

이 방식은 설계상 맞지만, 최근엔 whole-page capture 폭이 비정상적으로 좁게 나오는 문제가 있었다.

질문:

- 현재 구조에서 원본 확인 방식은 이미지 컨텍스트만으로 충분하다고 보는가?
- 아니면 section geometry / layout summary / DOM-derived structure summary 같은 추가 표면이 더 필요하다고 보는가?

---

## 7. 추가 논의 대상 요약

아래는 이번 브리핑에서 빠지면 안 되는 논의 대상이다.

1. `recipe`는 완성 템플릿이 아니라 구조적 출발점이어야 한다
2. `hero + quickmenu`는 파일럿 범위지만 설계는 `page-first`로 해야 한다
3. `hero + quickmenu`는 독립 section이 아니라 `top-stage cluster`로 봐야 한다
4. `section-family prompt contract`가 필요할 수 있다
5. `Tailwind/DaisyUI`는 즉시 갈아타기보다 `compare mode`로 검증하는 것이 맞다
6. `whole-page context` 품질이 generation/critic 모두에 직접 영향을 준다

---

## 8. 현재 제 제안

현재 제 제안은 아래 순서다.

1. `whole-page context` 캡처 폭 문제부터 수정
2. `hero` 상위 2~3개 recipe 재설계
3. `quickmenu` 상위 2~3개 recipe 재설계
4. 같은 파일럿 다시 평가
5. 그 이후에도 `hierarchy`가 안 오르면 `Tailwind/DaisyUI compare renderer`를 병렬로 만든다

즉 지금은 아직 `custom scoped CSS`를 폐기하자는 단계는 아니지만,
다음 파일럿에서도 hierarchy가 안 오르면 `renderer surface 비교`가 필요하다고 본다.

---

## 9. 관련 파일

- [builder-v2/renderer/home.js](/home/mrgbiryu/clonellm/builder-v2/renderer/home.js)
- [home-recipe-library.json](/home/mrgbiryu/clonellm/data/normalized/home-recipe-library.json)
- [llm.js](/home/mrgbiryu/clonellm/llm.js)
- [server.js](/home/mrgbiryu/clonellm/server.js)
- [admin-quality-improvement-alignment-2026-04-19.md](/home/mrgbiryu/clonellm/docs/admin-quality-improvement-alignment-2026-04-19.md)
- [admin-page-first-builder-v2-principles-2026-04-20.md](/home/mrgbiryu/clonellm/docs/admin-page-first-builder-v2-principles-2026-04-20.md)
- [admin-recipe-collection-schema-2026-04-19.md](/home/mrgbiryu/clonellm/docs/admin-recipe-collection-schema-2026-04-19.md)

---

## 10. 외부 빌더 패턴 분석: clonellm 적용 관점 (2026-04-20)

> 출처: `admin-external-builder-patterns-deepsearch-2026-04-20.md`
>
> 아래는 외부 사례(Anthropic/Claude, Figma Make, Builder.io, v0, screenshot-to-code, VisRefiner, ScreenCoder, DCGen, DaisyUI/Tailwind 운영 사례)를 clonellm 현재 구조 기준으로 분류한 결과다.

---

### 10.1 우리 시스템에 직접 적용 가능한 것 (이미 정렬됨)

아래 항목은 외부 사례에서 증명된 패턴이며, 현재 clonellm 구조와 이미 정렬되어 있다.  
즉 방향은 맞으며, 유지하면 된다.

---

#### [정렬] page-first + top-stage cluster 설계

**외부 근거**: DCGen 연구는 "전체를 먼저 보고 segment로 나눠 처리하는 방식이 complex UI에서 유리"함을 보여준다.

**우리 상태**: page-first 설계, hero+quickmenu를 top-stage cluster로 다루는 방향이 이미 설계 원칙으로 수립됨.

**판단**: 방향 유지. 단 full-page capture 품질이 전제 조건이다 (→ 10.2 참고).

---

#### [정렬] primitiveTree + recipe 기반 구조

**외부 근거**: Builder.io의 component indexing 접근법 — AI가 generic HTML을 찍는 게 아니라 renderer-owned component를 선택하게 한다. "약 70% mapping accuracy" 달성이라고 명시.

**우리 상태**: LLM은 primitive + variant + recipe를 고르고, renderer가 실제 HTML/CSS를 전개하는 구조. LLM이 raw CSS를 직접 쓰지 않는다.

**판단**: 방향 정렬. 다음 병목은 recipe 품질 자체이지, 구조 방향이 아니다.

---

#### [정렬] visual critic + recovery loop

**외부 근거**: VisRefiner 연구 — "rendered output과 target 디자인의 visual difference를 보고 self-refinement". One-shot보다 refinement 루프가 더 강하다.

**우리 상태**: visual critic (claude-sonnet-4.6) → fix loop 구조가 이미 있다.

**판단**: 방향 정렬. 단 refinement 효과는 renderer surface 품질에 직결된다. Renderer가 약하면 critic이 올바른 판단을 해도 fix 효과가 적다.

---

#### [정렬] grounding → planning → generation → critique 분리

**외부 근거**: ScreenCoder 연구 — "monolithic 1-shot보다 grounding/planning/generation 분리 multi-agent 구조가 robust".

**우리 상태**: composer → engine-v2 → detailer → visual critic 분리 구조가 이미 있다.

**판단**: 방향 정렬. 구조 자체는 연구 방향과 일치한다.

---

#### [정렬] LLM이 raw utility class를 직접 쓰지 않는 방식

**외부 근거**: Tailwind/DaisyUI 운영 사례에서 "LLM이 raw utility class를 직접 생성하는 방식은 불안정하며, renderer-owned recipe mapping이 더 안정적"이라는 커뮤니티 관점.

**우리 상태**: LLM은 primitiveId + variant + tone만 고르고, renderer가 CSS recipe를 전개함. 이미 올바른 방향.

**판단**: 유지.

---

#### [정렬] renderer-owned surface 방향 (V2 renderer hard switch)

**외부 근거**: Claude의 공개 입장 — "좋은 frontend 품질은 오케스트레이션보다 실제 렌더 surface에 크게 좌우된다." Figma Make, Builder.io 모두 component/design system context를 generation보다 먼저 강화한다.

**우리 상태**: V2 renderer hard switch가 완료됐고, legacy fallback이 제거됐다.

**판단**: 방향 정렬. 이제 renderer surface의 내용(recipe CSS 품질)을 강화하는 단계다.

---

### 10.2 우리 시스템에 수정/보강이 필요한 것

아래 항목은 외부 사례에서 명확하게 나타나는 패턴이지만, 현재 clonellm에 아직 충분히 구현되지 않은 부분이다.

---

#### [수정 필요] 생성 전 strong design system context 주입

**외부 근거**: Figma Make kits — npm package + design library styles + guidelines를 generation 전에 먼저 넣는다. Claude 공개 사례 — "typography, theme, motion, background 같은 축을 명시적으로 유도하면 결과가 좋아진다." DESIGN.md 계열 커뮤니티 패턴 — aesthetic / tone / type / spacing / component rules를 structured file로 넣고, 그걸 기준으로 scaffold.

**우리 상태**: 현재 recipe는 renderer 단에서 적용된다. 그러나 LLM prompt 단에서는 section-family 계층, recipe 선택 기준, tone contract가 충분히 강하게 들어가지 않는다. `recipeId`는 LLM 출력에 전혀 없고, `surfaceTone`은 항상 neutral로 defaulting된다.

**필요한 수정**:
- builder system prompt에 `page contract → cluster contract → section contract` 계층 추가
- hero generation 지시: "lead headline이 support copy보다 한 단계 이상 지배적이어야 한다", "primary visual focal point가 먼저 읽혀야 한다"
- quickmenu generation 지시: "lead entry 하나가 명확히 우세해야 한다", "sibling card 사이 rhythm이 일관되어야 한다"
- composer prompt에 surfaceTone 선택 guidance 추가 (neutral default를 깨는 명시적 지시)

**우선순위**: 높음. 이것이 `hierarchy=0` 문제의 근원 중 하나다.

---

#### [수정 필요] section-family prompt contract 도입

**외부 근거**: Claude 공개 사례 — "targeted prompting에 매우 민감하다." 좋은 prompt + 좋은 surface가 함께 있어야 한다. Figma Make kits — generation 전에 section-level context 주입.

**우리 상태**: recipe와 renderer CSS는 강화됐지만, generation 지시는 여전히 범용적이다. hero와 quickmenu에 대한 명시적 생성 계약이 없다.

**필요한 수정**:
- `global page contract` — page role, tone cluster, top-stage 요구사항
- `top-stage cluster contract` — hero와 quickmenu의 관계, 시각적 연속성
- `hero generation contract` — 최소 항목: headline supremacy, visual focal point, CTA priority, support rail hierarchy
- `quickmenu generation contract` — 최소 항목: lead entry dominance, scanable rhythm, icon/container consistency

**우선순위**: 높음. recipe 개수보다 이 contract가 generation 품질에 더 직접 영향을 준다.

---

#### [수정 필요] whole-page capture 안정성

**외부 근거**: DCGen — "전체를 보고 segment로 나누는 방식이 유리"하지만 이는 "좋은 full-page capture"가 전제된다. 왜곡된 capture가 들어오면 divide-and-conquer 장점이 사라진다.

**우리 상태**: 캡처가 190-222px 폭으로 찍히는 경우가 있다 (정상: 760px 이상). 이 경우 split-hero가 1-column으로 collapse되어 LLM과 critic 모두 잘못된 레이아웃을 본다. 이것이 `hierarchy=0` 지속의 가장 직접적인 원인 중 하나다.

**필요한 수정 (Codex 영역)**:
- `captureUrlAsScreenshotDataUrl()`의 viewport 폭을 명시적으로 강제 (최소 1200px)
- capture 결과 폭 검증 후 비정상이면 재캡처 또는 경고 로그
- 캡처 전 페이지 로드 완료 대기 안정화

**우선순위**: 최고. 이 문제가 있는 상태에서는 recipe/renderer 품질 개선 효과가 측정 불가다.

---

#### [수정 필요] renderer surface 성숙도 (recipe CSS 강도)

**외부 근거**: VisRefiner — "refinement 효과는 renderer가 강해야 난다." Builder.io — component indexing이 70% mapping accuracy를 제공하는 것은 surface가 충분히 풍부하기 때문. Claude — "좋은 frontend 품질은 렌더 surface에 크게 좌우된다."

**우리 상태**: tone fallback 보정과 neutral surface 강화는 완료됐지만, 상위 recipe (cinematic, premium 계열)의 CSS 실제 시각 효과가 아직 LGE 원본 대비 충분히 차별화되지 않는다.

**필요한 수정**:
- hero 상위 2~3개 recipe CSS를 공격적으로 재설계 (split ratio, headline scale, contrast delta 기준)
- quickmenu 상위 2~3개 recipe CSS 강화 (lead panel dominance, card hierarchy)
- recipe CSS 변경 후 실제 before/after 화면 캡처로 검증 (capture 문제 해결 후)

**우선순위**: 높음. capture 문제 해결 직후 바로 실행.

---

#### [검토 필요] Tailwind/DaisyUI compare mode

**외부 근거**: v0 Design Mode — generation과 post-editing UX를 분리. screenshot-to-code 계열 — Tailwind를 출력 표면으로 많이 씀. DaisyUI 커뮤니티 — "renderer-owned recipe mapping이 중요"하지만 semantic surface 자체의 강점도 있음. WebZum 운영 사례 — CDN 없이 server-compiled CSS로 self-contained HTML 생성 가능.

**우리 상태**: custom scoped CSS가 현재 메인라인. 품질 우위가 검증된 상태는 아니다.

**필요한 조건과 수정 방향**:
- Tailwind/DaisyUI를 `즉시 전면 전환`하는 방식은 아니다
- 올바른 방식:
  - LLM은 primitive + variant + recipe만 고름 (현행 유지)
  - renderer가 이를 `Tailwind/DaisyUI class recipe block`으로 전개 (신규 renderer)
  - 서버에서 Tailwind CSS를 compile하거나 bundled static CSS로 제공 (CDN 아님)
- 비교 harness 구조:
  - 같은 primitiveTree + recipe + asset 조건
  - A: current custom scoped CSS renderer 결과
  - B: Tailwind/DaisyUI recipe renderer 결과
  - 한 페이지에 위아래로 놓는 방식이 아닌, 별도 캡처/평가

**발동 조건**: capture 문제 해결 + recipe CSS 강화 후에도 `hierarchy`가 지속적으로 낮으면 그때 비교 모드를 만든다. 지금은 `custom scoped CSS 경로를 먼저 밀어야` 한다.

**우선순위**: 낮음 (현재 단계). capture/contract/recipe 3개 먼저.

---

### 10.3 외부 사례 적용 요약표

| 외부 패턴 | 출처 | clonellm 상태 | 필요 액션 |
|---|---|---|---|
| page-first / divide-and-conquer | DCGen | ✅ 정렬됨 | capture 안정화가 전제 |
| primitive + recipe renderer-owned | Builder.io | ✅ 정렬됨 | recipe CSS 품질 강화 |
| visual critic + refinement loop | VisRefiner | ✅ 정렬됨 | renderer 강화 시 효과 극대화 |
| grounding → planning → generation 분리 | ScreenCoder | ✅ 정렬됨 | 유지 |
| LLM이 raw utility class 직접 쓰지 않음 | Tailwind 커뮤니티 | ✅ 정렬됨 | 유지 |
| generation 전 strong design context 주입 | Figma Make, Claude | ❌ 미흡 | section-family contract 추가 |
| section-family prompt contract | Claude targeted prompting | ❌ 없음 | hero/quickmenu contract 작성 |
| whole-page capture 안정성 | DCGen | ⚠️ 코드 수정 반영됨 | whole-page 정규화 재검증, narrow warning 확인 |
| renderer surface 성숙도 | VisRefiner, Claude | ⚠️ 보강 중 | 상위 recipe CSS 공격적 재설계 |
| compare mode / post-build visual editing | v0 Design Mode | 🔲 미구현 | capture 해결 후 조건부 검토 |
| server-compiled Tailwind (CDN-free) | WebZum 운영 사례 | 🔲 미구현 | compare mode 도입 시 함께 |

---

### 10.4 외부 패턴 분석 기반 최우선 실행 순서

외부 성공 사례를 clonellm에 대입하면, 지금 가장 빠른 품질 상승 경로는:

1. **whole-page capture 재검증** — whole-page 전용 정규화와 narrow warning은 이미 반영됐다. 이제는 실제 캡처 폭/비율이 정상인지 수동 재검증이 먼저다.
2. **section-family prompt contract 작성** — hero와 quickmenu 각각 최소 3~4개 생성 규칙. recipe CSS보다 generation 지시가 먼저다.
3. **상위 recipe CSS 공격적 재설계** — hero top 2~3개, quickmenu top 2~3개. cinematic/premium tone 시각 차별화 강화.
4. **같은 파일럿 재평가** — 위 3개 적용 후 hierarchy 재측정.
5. **hierarchy가 여전히 낮으면** → Tailwind/DaisyUI compare renderer 도입 검토.

이 순서는 외부 사례 전체가 공통적으로 가리키는 방향이기도 하다:  
`좋은 품질은 좋은 오케스트레이션만으로 나오지 않는다. 좋은 renderer surface + strong system context + 안정적 visual input의 세 축이 함께 있어야 한다.`

---

## 11. 품질 목표 기준으로 다시 본 재판정

위 10장의 정리는 `현재 구조에서 무엇을 보강할지`에 초점이 있다.  
하지만 우리 목표는 `현 구조 유지`가 아니라 `웹디자인 수준 품질 보장`이다.

따라서 아래처럼 관점을 다시 잡아야 한다.

### 11.1 핵심 원칙

- 현재 custom scoped CSS 경로를 유지하는 것은 목적이 아니다
- 목적은 `hero + quickmenu` 파일럿에서 웹디자인 수준 품질을 실제로 통과시키는 것이다
- 어떤 방식이든 그 품질을 못 만들면, 그 방식은 중단 대상이다

즉 질문은:

- `현재 구조를 얼마나 더 보강할까?`

가 아니라,

- `현재 구조가 품질 기준을 만족할 수 있는가, 없으면 언제 중단할 것인가?`

가 되어야 한다.

### 11.2 딥서치 기준으로 본 냉정한 해석

외부 사례들은 공통적으로 아래를 보여준다.

1. `좋은 renderer surface`가 없는 상태에서 오케스트레이션 보강만 해도 품질 상승은 제한적이다
2. `design system context / section contract / recipe`가 generation 전에 강하게 주입되어야 한다
3. `visual refinement`는 강한 renderer가 있을 때만 의미 있게 작동한다
4. `Tailwind / shadcn / DaisyUI / server-compiled utility surface`는 실제 운영 사례에서 품질과 생산성을 동시에 올리는 검증된 선택지다

따라서 현재 custom scoped CSS 경로는:

- `유지해야 할 기반`이 아니라
- `품질 기준을 통과하면 유지될 수 있는 후보`

로 봐야 한다.

### 11.3 현재 경로에 대한 품질-first 판정 방식

현재 custom scoped CSS + recipe renderer 경로에 대해, 아래를 `한 번의 제한된 검증 라운드`로 둔다.

필수 선행조건:

1. `whole-page capture 재검증 완료`
2. `hero generation contract`
3. `quickmenu generation contract`
4. `hero top recipes` 강화
5. `quickmenu top recipes` 강화

그 후 동일 조건으로 다시 파일럿을 평가한다.

평가 기준:

- `primitiveTree` 실제 저장
- `V2 renderer` 실제 탑승
- `critic model` 고정 (`anthropic/claude-sonnet-4.6`)
- `retry=no`
- `hierarchy >= 72`
- `실제 before/after 시각 비교에서 legacy보다 명확히 우수`

### 11.4 탈락 기준

아래 조건을 만족하면, 현 custom scoped CSS 경로는 `품질 기준 미달`로 판정한다.

- capture 재검증 완료
- section-family contract 반영 완료
- 상위 recipe 재설계 완료
- 동일 critic 기준으로 재평가했는데도
  - `hierarchy < 72` 이거나
  - `retry=yes`가 지속되거나
  - 실화면 비교에서 위계/가독성/리듬 개선이 분명하지 않은 경우

여기서 말하는 기준은 **품질-first 운영 목표**다.  
현재 런타임은 실제로 `visual critic -> visual fix -> 재평가 -> recovery router -> 재평가`를 수행한 뒤 최종 `quality-failed`로 끝난다. 즉, 문서의 탈락 기준은 "지금 런타임이 이렇게 동작한다"가 아니라 "품질 기준으로는 이 지점에서 이미 탈락 후보로 봐야 한다"는 운영 원칙이다.

즉 이 경우는:

- `recipe가 부족하다`
- `조금만 더 보강하면 된다`

로 보지 않고,

- `현재 renderer surface가 품질 목표를 만족시키지 못한다`

로 해석해야 한다.

### 11.5 그 다음 전환 기준

위 탈락 기준에 걸리면 즉시 다음 단계로 넘어간다.

- `Tailwind/DaisyUI compare renderer`를 만든다
- 같은 primitiveTree / recipe / asset / copy 조건으로
  - A: current custom scoped CSS renderer
  - B: Tailwind/DaisyUI recipe renderer
  를 비교한다
- 승자만 유지한다

중요:

- 이 비교는 `현 구조를 지키기 위한 보조 실험`이 아니다
- `품질 기준을 만족하는 renderer surface를 선택하기 위한 판정 실험`이다

### 11.6 Claude에게 추가로 확인받고 싶은 재질문

아래 질문은 기존 Q1~Q8과 별도로, 품질-first 기준을 더 명확히 하기 위한 것이다.

#### Q9. 현재 custom scoped CSS 경로에 "한 번의 제한된 기회"만 주는 기준에 동의하는가?

즉:

- capture 정상화
- section-family contract
- 상위 recipe 강화

까지 반영한 뒤에도 hierarchy가 낮으면, 그 경로는 더 이상 보강 대상이 아니라 탈락 대상으로 봐야 하는가?

#### Q10. Tailwind/DaisyUI compare mode는 "후순위 실험"이 아니라 "품질 판정용 전환 게이트"로 봐야 하는가?

즉 compare mode는:

- nice-to-have 검토가 아니라
- 현 surface 실패 시 즉시 실행해야 하는 전환 실험

으로 보는 게 맞는가?

### 11.7 현재 제 입장

현재 제 입장은 아래와 같다.

- 지금까지 custom scoped CSS 경로를 먼저 민 이유는 `전환 비용` 때문이었다
- 그러나 딥서치 결과를 품질 목표 기준으로 다시 보면,
  - 이 경로가 장기적으로 옳은지 아직 증명되지 않았다
- 따라서 지금부터는
  - `현 경로를 더 잘 만드는 것`
  보다
  - `현 경로가 품질 기준을 만족하는지 냉정하게 판정하는 것`
  이 더 중요하다

즉 이후 액션은:

1. capture/contract/recipe를 한 번 정리
2. 같은 파일럿 재검증
3. 실패 시 즉시 renderer surface compare

로 가야 한다.

### 11.8 호출 수 관점에서 본 구조 판정

현재 시스템의 또 다른 중요한 판단 기준은 `호출 수 대비 품질 상승 효율`이다.

지금 우려하는 핵심은 이것이다.

- 현재 보강 방식이 `구조를 바꾸는 것`이 아니라
- 기존 경로 위에 `critic / fix / recovery / extra prompt contract`를 계속 덧붙이는 식으로 가면
- LLM 호출 수만 늘고
- 품질은 구조적으로 거의 오르지 않을 수 있다

이 경우는 단순히 "비용이 크다"의 문제가 아니라, **구조 방향 자체가 잘못됐다는 신호**로 봐야 한다.

우리가 기대하는 정상 구조는 대략 이 수준이어야 한다.

1. `초안 생성` 1회
2. `판단 / critic` 1회
3. `재생성 또는 강한 재구성` 1회

즉 대략 `generate -> judge -> regenerate` 정도에서 끝나야 한다.

반대로 아래 현상이 지속되면 구조 실패로 본다.

- 호출 수가 계속 6~9회 이상으로 불어난다
- fix / recovery / critic만 반복되고
- 실제 `hierarchy`나 실화면 품질은 거의 오르지 않는다

이건 "조금 더 다듬으면 될 수도 있다"가 아니라,

- generation surface가 약하거나
- contract가 구조를 못 바꾸거나
- renderer가 충분히 직접적인 재구성을 수행하지 못한다

는 뜻이다.

따라서 compare mode나 renderer surface 전환은 단순 스타일 선택 실험이 아니라,  
**호출 구조를 정상화하기 위한 구조 판정 실험**이기도 하다.

즉 품질 기준과 함께 아래도 같이 본다.

- `quality-pass` 가능한가?
- `그 품질에 도달하는 호출 수가 정상 범위인가?`

현재 입장은 명확하다.

- 호출 수가 많아도 품질이 높아지지 않는다면,
- 그건 현재 경로를 더 보강해야 한다는 뜻이 아니라
- **현재 경로가 구조적으로 비효율적이므로 중단해야 한다는 뜻**이다.

---

## 12. Claude 답변 — 품질-first 관점 (2026-04-20)

> 아래는 Q1~Q10 전체에 대해, "현재 구조 보강"이 아닌 "이 구조가 품질 기준을 통과할 수 있는가"의 관점에서 답한 것이다.

---

### A1. 현재 상태 진단 — 병목은 셋이다, 둘이 아니다

문서에 제시된 두 가지 병목(recipe 품질, whole-page capture 재검증 필요)에 동의한다.  
단, **세 번째 병목**이 빠져 있다.

**visual critic의 평가 기준도 범용적이다.**

현재 critic은 hero 섹션을 평가할 때도 "hierarchy"를 generic page-level 기준으로 본다.  
즉 hero 안에서 headline이 support copy보다 2배 이상 크고, 이미지가 레이아웃을 지배하고 있어도,  
critic이 그 기준을 모르면 `hierarchy=0`을 줄 수 있다.

과거에는 whole-page 자산이 190px 안팎 폭으로 압축되는 문제가 있었고, 그 경우 split-hero가 사실상 1-column처럼 보이며 critic이 왜곡된 화면을 평가하게 된다. 현재는 whole-page 전용 정규화와 narrow warning이 반영됐으므로, 이제 필요한 것은 "여전히 왜곡이 남는가"에 대한 수동 재검증이다. 즉:

- capture 왜곡 → critic이 잘못된 레이아웃을 평가
- critic 기준 범용 → 올바른 레이아웃을 봐도 section-specific 기준이 없어 0점 가능

따라서 병목은:

1. `whole-page capture 재검증` — 최고 우선순위, 코드 수정이 이미 들어갔으므로 실제 자산 폭과 비율이 정상인지 다시 확인해야 한다
2. `section-family prompt contract 부재` — generation 지시가 범용적
3. `visual critic 평가 기준 범용` — hero/quickmenu 전용 hierarchy 기준이 없음
4. `renderer surface recipe CSS 강도 미흡` — 보강 중이지만 아직 원본 대비 차별화 부족

**recipe 품질은 4번이다.** 1~3을 먼저 해결해야 4번이 측정 가능해진다.

---

### A2. custom scoped CSS vs Tailwind/DaisyUI — 지금은 A, 단 한 번만

현재 시점에서는 **A(custom scoped CSS 경로)를 먼저 간다.**

이유:

- capture/contract/critic 3개를 먼저 고쳐야 진짜 품질 신호가 나온다
- 그 신호 없이 renderer를 바꾸면 무엇이 문제인지 알 수 없다
- Tailwind/DaisyUI renderer를 만드는 비용도 클 수 있다 — 먼저 정확한 측정부터

단, 이것은 **"A를 더 신뢰해서"가 아니라 "측정 먼저"** 때문이다.  
A가 품질 기준을 한 번이라도 통과하지 못하면, 그 결과는 B 비교의 발동 조건이 된다.

---

### A3. 파일럿 완료 조건 — 동의, 단 critic 기준 항목 추가 필요

제시된 조건(`primitiveTree 저장`, `V2 renderer`, `retry=no`, `hierarchy >= 72`, `before/after 시각 우수`)에 동의한다.

단, 아래 조건을 **전제 조건**으로 먼저 명시해야 한다:

- whole-page 정규화 이후 캡처 자산이 비정상적 narrow 상태가 아닌지 확인 (`narrow-assets` 경고 없음, 폭이 충분한지 수동 확인)
- critic에게 section-specific 기준이 주입됐는지 확인 (hero contract가 critic prompt에 포함)

이 두 전제가 없으면 `hierarchy >= 72`가 실제 품질을 반영하는지 알 수 없다.

또한 `retry=no` 기준은 **품질-first 운영 목표**로는 맞지만, 현재 런타임은 이 기준을 즉시 실패로 처리하지 않는다.  
현재 V2 finalize 경로는 `visual critic -> visual fix -> 재평가 -> recovery router -> 재평가`를 수행한 뒤에야 최종 `quality-failed` 또는 통과로 끝난다.  
따라서 문서상 `retry=no`는 "현재 코드가 이미 이렇게 동작한다"는 설명이 아니라, "최종적으로 지향해야 할 stricter pass 기준"으로 읽어야 한다.

---

### A4. recipe 전략 — 개수보다 generation 지시가 먼저다

현재 `hero 12개, quickmenu 9개` 수량은 충분하다. 이 판단에 동의한다.

하지만 더 중요한 사실:

**recipe CSS가 아무리 강해도 LLM이 neutral surfaceTone으로 primitiveTree를 출력하면 recipe가 제대로 적용되지 않는다.**

현재 `synthesizePrimitiveTreeForComponent()`는 항상 `surfaceTone: "neutral"`을 설정한다.  
LLM이 tone을 명시하지 않으면 항상 neutral이 된다. recipe.tone 승격이 들어갔지만 이것은 renderer 단의 보정이다.

진짜 수정 순서:

1. **composer prompt**에 surfaceTone 선택 지시 추가 → LLM이 neutral 이외를 적극 선택하게
2. **builder system prompt**에 hero/quickmenu 위계 규칙 추가 → 생성 단에서 hierarchy를 만들게
3. **그 다음** recipe CSS 품질 강화

즉 recipe 수를 늘리는 게 아니라, recipe가 실제로 적용될 수 있도록 generation 지시를 먼저 바꾸는 것이다.

---

### A5. page-first 관점 — 동의, 그리고 critic도 page-first여야 한다

page-first 방향에 완전히 동의한다.

추가:

critic도 hero+quickmenu를 **클러스터로 평가**해야 한다.  
현재 critic은 각 섹션을 독립적으로 평가하는 것으로 보인다.  
하지만 hero의 hierarchy는 quickmenu와의 관계에서도 나온다.  
이후 critic prompt에 `top-stage cluster 평가 기준`을 추가해야 한다.

---

### A6. section-family prompt contract — 반드시 필요, 최소 항목은 이것이다

이 방향에 동의한다. 현재 가장 저평가된 수정 항목이다.

**hero generation contract 최소 필수 항목:**

1. `surfaceTone`은 cinematic/premium/editorial 중 하나를 명시적으로 선택해야 한다. neutral은 허용하지 않는다 (단, 명확한 이유가 있는 경우 제외)
2. lead headline의 font-size는 support copy의 최소 2.5배 이상이어야 한다
3. lead visual(이미지/영상)은 레이아웃의 50% 이상을 차지해야 한다
4. CTA는 support rail보다 시각적으로 먼저 읽혀야 한다 (배치 상단 or 강한 contrast)
5. SplitHero 기준: lead column 비율은 1.5fr 이상이어야 한다 (1:1 금지)

**quickmenu generation contract 최소 필수 항목:**

1. lead entry 하나는 secondary entry보다 명확히 크거나 강한 contrast를 가져야 한다
2. secondary entry 사이의 icon/container treatment는 동일한 리듬이어야 한다
3. entry label은 utility-only(단순 동사) 금지, context word 포함
4. card 사이 spacing은 최소 12px 이상, grid는 최소 3열 이상

이 contract를 builder system prompt에 넣는 것과, critic prompt에 평가 기준으로 넣는 것 모두 필요하다.

---

### A7. compare mode — 후순위 실험이 아니라 품질 판정 게이트

**이 인식이 맞다.** compare mode는 nice-to-have가 아니다.

현재 커스텀 CSS 경로가 위 전제조건(capture + contract + recipe)을 반영한 뒤에도 실패하면, 그 결과는 하나의 결론이다:

> custom scoped CSS는 LGE ecommerce 클론 품질 기준에서 renderer surface로서 충분하지 않다.

그 결론이 나오는 즉시 compare mode를 실행한다. "조금 더 다듬으면 될지 모른다"는 판단은 하지 않는다.  
왜냐하면 이미 여러 라운드를 거쳤기 때문이다.

compare mode의 올바른 구조:
- 같은 primitiveTree + recipe + asset + copy
- A: current custom scoped CSS renderer
- B: Tailwind/DaisyUI recipe renderer (LLM은 primitive+variant+recipe만 고름, renderer가 class block으로 전개)
- 동일 critic 기준으로 별도 평가
- 승자만 이후 파일럿에 사용

---

### A8. 이미지 컨텍스트만으로 충분한가 — capture가 정상이면 충분, 단 critic에는 보조 정보 필요

원본 확인을 이미지로 하는 방식은 설계상 맞다. DOM 파싱보다 multimodal이 더 자연스럽다.

단, 두 가지 보완이 필요하다:

1. **capture 전 viewport 강제** — `captureUrlAsScreenshotDataUrl()`에서 viewport 최소 1200px 강제 적용  
   이미지 자체가 정상이면 이미지만으로 충분히 generation 가능

2. **critic에 section geometry 보조 주입** — critic prompt에 아래를 텍스트로 함께 제공:
   - 캡처 시 viewport 폭 (`captureWidth: 1440px`)
   - hero 섹션의 viewport 대비 비율 (`heroAreaPct: 42%`)
   - 평가 대상 recipe 이름 및 expected tone

이렇게 하면 critic이 "이 레이아웃은 1440px에서 split-hero cinematic이어야 한다"는 기준을 가지고 hierarchy를 평가할 수 있다.  
현재는 이 기준이 없어서 critic이 임의로 해석할 여지가 있다.

---

### A9. custom scoped CSS에 한 번의 기회만 — 동의

동의한다. 단 "한 번의 기회"의 조건을 명확히 해야 한다.

**이 한 번은 아래 5개가 모두 갖춰진 상태의 평가여야 한다:**

1. whole-page 정규화 이후 캡처 자산 폭/비율이 정상인지 로그와 실제 자산으로 확인
2. hero generation contract (최소 5항목) builder prompt 적용
3. quickmenu generation contract (최소 4항목) builder prompt 적용
4. hero top 2~3 recipe CSS 공격적 재설계
5. critic에 section-specific 평가 기준 주입

이 5개 중 하나라도 빠진 상태의 파일럿 결과는 "custom scoped CSS 실패"가 아니라 "미완성 조건의 실패"다.  
반대로 이 5개가 모두 들어간 상태에서 실패하면, 그것은 renderer surface 실패다.

---

### A10. compare mode는 품질 판정 전환 게이트 — 동의

동의한다. 표현도 이것이 맞다.

"compare mode"라는 명칭보다 **"renderer surface 판정 실험"**이 더 정확하다.  
이 실험의 목적은 두 renderer 중 "더 좋아 보이는 것"을 고르는 게 아니라,  
"품질 기준을 만족하는 renderer surface가 존재하는가"를 확인하는 것이다.

만약 B(Tailwind/DaisyUI)도 실패한다면, 그것은 renderer surface 문제가 아니라 generation 품질 문제다.  
즉 그때는 section-family contract와 composer prompt를 더 강하게 다시 보는 단계로 돌아가야 한다.

### A11. 호출 수가 많아지는데 품질이 안 오르면 구조 실패로 봐야 하는가

동의한다. 이 기준은 품질-first 관점에서 매우 중요하다.

`generate -> judge -> regenerate` 정도에서 끝나지 않고,

- composer
- detailer
- fix
- visual critic
- visual fix
- recovery fix
- recovery critic

처럼 계속 호출 수만 늘어나는데도 `hierarchy`가 오르지 않는다면,  
그건 파이프라인이 정교하다는 뜻이 아니라 **구조적으로 직접적인 재구성을 못 하고 있다는 뜻**이다.

즉 호출 수 증가는 아래 두 경우에만 정당화된다.

1. 실제 품질 점수가 뚜렷하게 오른다
2. 그 증가가 일시적이고, 안정화 후에는 다시 2~3회 수준으로 줄어든다

반대로 현재처럼:

- 호출 수는 많고
- delta만 조금 늘고
- hierarchy는 계속 0

이면, 이것은 fix/recovery 루프를 더 붙일 이유가 아니라 renderer surface와 generation contract를 다시 봐야 한다는 증거다.

따라서 이 브리핑의 판정 기준에는 아래를 명시적으로 추가하는 것이 맞다.

- `호출 수가 구조적으로 정상화되는가`
- `품질 상승이 호출 수 증가에 비례하는가`

만약 아니면, 그 경로는 `비용 문제`가 아니라 `구조 실패`다.

---

### 12.1 결론 요약

| 항목 | 판정 | 비고 |
|---|---|---|
| whole-page capture 재검증 | 최고 우선순위 확인 항목 | 코드 수정 반영 후 실제 자산 폭/비율이 정상인지 다시 검증 필요 |
| section-family contract | 높음, capture 직후 | generation 지시 없이 recipe CSS만 강화는 반쪽짜리 |
| critic 평가 기준 보강 | 높음, contract와 동시 | hero hierarchy를 0점으로 잘못 줄 위험 차단 |
| renderer recipe CSS 강화 | 높음, 3번 다음 | composer surfaceTone 지시 먼저, 그 다음 CSS |
| compare mode | 조건부 즉시 실행 | 위 조건 모두 반영 후 파일럿 실패 시 바로 발동 |
| 호출 구조 정상화 | 상시 판정 기준 | generate → judge → regenerate 수준으로 수렴해야 함 |

**"현재 구조를 더 잘 만들자"가 아니라 "지금 구조가 품질을 통과하는지 한 번 냉정하게 판정한다."**  
이것이 지금 시점의 올바른 프레임이다.

---

## 13. 품질 관점 재검토 — 아무도 묻지 않은 질문 (2026-04-20)

지금까지의 모든 분석은 critic 점수, 호출 수, recipe 개수, prompt contract 공간 안에서 이루어졌다.  
그런데 아래 질문이 빠져 있다.

> **"현재 renderer가 최선의 조건에서 만든 hero 출력물을, 실제 브라우저에서 눈으로 본 적이 있는가?"**

없다. 이것이 지금 품질 논의의 가장 큰 빈 칸이다.

---

### 13.1 현재 우리가 모르는 것

- critic이 `hierarchy=0`을 주는 게 "renderer가 나쁜 출력을 만들어서"인지,  
  아니면 "왜곡된 whole-page 화면을 보여줘서"인지 **구분되지 않는다**
- 즉 renderer surface의 실제 품질 상한선을 **측정한 적이 없다**
- 모든 LLM 호출, fix loop, recovery는 이 상한선을 모르는 채로 돌고 있다

---

### 13.2 fix loop의 구조적 천장

fix LLM은 primitiveTree를 수정한다.  
renderer는 그 primitiveTree를 CSS recipe block으로 전개한다.

**핵심 문제: recipe CSS가 같으면 primitiveTree가 달라져도 renderer output의 상한선은 같다.**

예:
- fix LLM: "hero variant를 premium-stage로, tone을 cinematic으로 설정해라"
- renderer: `hero-cinematic-stage-v1` recipe CSS를 적용
- 하지만 그 CSS가 시각적으로 약한 수준이라면, 몇 번을 고쳐도 같은 상한선이다

이것이 "호출 수는 늘어나는데 hierarchy가 오르지 않는다"의 진짜 구조 이유다.  
fix loop는 CSS 상한선을 넘을 수 없다. 상한선을 높이려면 recipe CSS 자체를 바꿔야 한다.

---

### 13.3 수동 렌더러 검증이 반드시 선행되어야 한다

품질-first 관점에서 아래 순서가 맞다.

**1단계: whole-page capture 재검증 (Codex 영역)**

whole-page 전용 정규화와 narrow warning은 이미 들어갔다.  
이제 필요한 것은 실제 자산이 충분한 폭을 유지하는지, 수동 상한선 확인에 쓸 수 있을 정도로 정상 캡처되는지 재검증하는 것이다.

**2단계: 수동 렌더러 출력 확인 (즉시 가능)**

다음 두 recipe를 1440px 환경에서 직접 렌더링하고 브라우저에서 눈으로 본다.

- `hero-cinematic-stage-v1` (SplitHero, cinematic, premium-stage)
- `quickmenu-membership-priority-panel-v1` (QuickmenuPanel, premium, panel)

확인 항목:
- headline이 실제로 지배적으로 크게 보이는가?
- lead 이미지/컬러 영역이 레이아웃을 주도하는가?
- quickmenu lead card가 secondary card와 명확히 구분되는가?
- 전체적으로 "LGE 원본과 다른, 의도적으로 설계된 레이아웃"으로 보이는가?

**판단 기준**:

| 수동 확인 결과 | 다음 액션 |
|---|---|
| 시각적으로 충분히 좋다 | 문제는 generation/critic. contract + critic 기준 먼저. |
| 시각적으로 약하거나 원본과 별로 다르지 않다 | 문제는 renderer surface. compare mode 즉시. |

이 판단 없이 LLM 호출을 더 붙이는 것은, 상한선을 모른 채 최적화하는 것이다.

---

### 13.4 이 관점이 기존 판정 기준에 추가되어야 하는 이유

기존 판정 기준(섹션 11.3):
- capture 정상화
- generation contract
- recipe 강화
- critic 기준
- 파일럿 재평가

이것은 모두 맞다. 하지만 **renderer CSS 상한선을 확인하지 않은 채 진행하면**, 위 5개를 다 해도 다음 상황이 생길 수 있다:

- generation contract를 강하게 넣었더니 LLM이 올바른 primitiveTree를 출력함
- renderer가 그 primitiveTree를 받아서 CSS를 전개하는데, 그 CSS가 원래부터 시각적으로 약함
- critic이 1440px 화면을 정상적으로 보고 평가했지만, 그 출력물 자체가 hierarchy=40 수준임
- 5개 조건을 다 반영했는데 `hierarchy >= 72`에 못 미침

이 경우는 "generation contract가 부족한가?", "recipe CSS를 더 강화해야 하나?"로 해석될 수 있다.  
하지만 실제 원인은 **renderer CSS recipe의 시각적 상한선이 60 미만**인 것이다.

수동 확인이 먼저 있었다면, 이 경우를 훨씬 빠르게 잡을 수 있다.

---

### 13.5 업데이트된 최우선 실행 순서

| 순서 | 액션 | 담당 | 판단 기준 |
|---|---|---|---|
| 0 | **whole-page capture 재검증** | Codex | whole-page 정규화 결과와 narrow warning, 실제 자산 폭 확인 |
| 1 | **수동 렌더러 출력 확인** | Claude/Codex | 상한선 파악. "충분히 좋다" vs "약하다" |
| 2A | **수동 출력이 약하면 즉시 renderer surface compare** | Codex+Claude | recipe 추가 보강보다 surface 판정이 우선 |
| 2B | **수동 출력이 충분히 좋으면 contract + critic 기준 보강** | Claude | generation/critic 문제로 판단 |
| 3 | **상위 recipe CSS 재설계** | Claude | 2B 경로에서만 진행 |
| 4 | **파일럿 재평가** | Codex | 선행조건 충족 상태에서만 의미 있음 |
| 5 | **실패 시 compare mode** | Codex+Claude | 2B 경로에서만 이후 발동 |

**핵심은 1번이다.** 수동 렌더 출력이 이미 약하면, contract/critic/recipe를 계속 덧붙이는 것은 wrong problem을 solving하는 것이다.

### 13.6 품질-first 운영 원칙으로 다시 정리

이 문서의 최종 운영 원칙은 아래다.

1. `현재 custom scoped CSS 경로`는 기본값이 아니다. 품질을 통과하면 남고, 아니면 버려지는 후보일 뿐이다.
2. `수동 렌더 상한선 확인`은 prompt/critic/refinement보다 앞선다.
3. 수동 렌더 결과가 약하면:
   - recipe를 더 늘리지 않는다
   - fix loop를 더 붙이지 않는다
   - compare mode를 앞당긴다
4. `contract + critic 보강`은 수동 렌더 상한선이 괜찮을 때만 의미가 있다.
5. 호출 수가 `generate -> judge -> regenerate` 수준으로 수렴하지 않으면 그 경로는 구조 실패 후보다.

즉 이제부터는:

- `현 경로를 좀 더 보강해보자`

가 아니라,

- `현 경로가 품질 기준을 통과할 상한선이 있는지 먼저 확인하고, 없으면 즉시 다른 surface와 비교한다`

가 기본 원칙이다.

---

## 14. 현재 LLM 시각 입력 구조와 rerun 병목 (2026-04-20)

최근 코드/로그 재점검 기준으로, 지금 시스템에서 **실제 화면을 직접 보는 모델**과 **다시 만드는 모델**은 분리돼 있다.

### 14.1 누가 무엇을 보는가

- `Planner`
  - 사용자 요청, 페이지 요약, whole-page lite 정도만 본다.
  - 계획 단계에서는 강한 reference screenshot이 중심이 아니다.
- `Composer`
  - whole-page context, curated reference, page identity, section-family contract, primitive/schema 제약을 본다.
  - 즉 "어떤 방향으로 바꿀지"는 비교적 잘 본다.
- `Detailer / Builder`
  - composer 결과, designSpec, sectionBlueprints, editable surface, whole-page context, reference를 본다.
  - 하지만 **자기 결과물인 failed after render는 못 본다.**
- `Structural Critic`
  - LLM이 아니다. 코드 기반 구조 점검이다.
- `Fixer`
  - 실제 screenshot을 못 보고 critic의 텍스트 요약만 본다.
  - 즉 "왜 화면이 어색한지"를 시각적으로 재판단하지 못한다.
- `Visual Critic`
  - before / after / reference screenshot을 직접 받는 유일한 모델이다.

핵심 결론:

> 지금은 `실화면을 보는 눈`은 critic 쪽에만 있고, `다시 만드는 손`은 그 눈을 직접 공유받지 못한다.

### 14.2 지금 구조가 품질을 깎는 이유

현재 compare path는 이전보다 짧아졌지만, 여전히 아래 손실이 남아 있다.

1. `rerun generator`가 failed after screenshot을 직접 못 본다
   - critic findings 텍스트만 보고 다시 생성한다.
   - 이 구조에선 고급 모델의 강점인 시각 균형, 리듬, 밀도 조절이 rerun 단계에서 끊긴다.
2. `text-only fixer`는 visual 품질 문제에 부적합하다
   - hierarchy, density, rhythm, brand fit 같은 문제는 텍스트 지시만으로 안정적으로 고치기 어렵다.
3. `append-fix`가 아니라 `fresh rerun`으로 줄였더라도,
   - rerun이 failed after를 못 보면 여전히 critic의 번역본만 따르는 구조다.

따라서 compare / quality-first 경로의 목표 구조는 아래여야 한다.

- `Draft Generation 1회`
- `Visual Critic 1회`
- 필요 시 `Fresh Rerun 1회`
  - 이 rerun은 반드시
    - `before`
    - `failed after`
    - `reference`
    - `whole-page context`
    - `critic findings`
    를 함께 본다
- `Visual Critic 1회`

### 14.3 text-only fixer의 역할 축소

품질-first 기준에서 text-only fixer는 아래로 축소하는 것이 맞다.

- 실행 오류
- JSON/schema 정규화
- 명백한 governance 위반

반대로 아래는 fixer 대상이 아니라 **fresh rerun 대상**이다.

- `hierarchy`
- `changeStrength`
- `density`
- `rhythm`
- `brand fit`
- `layout balance`

즉 visual 품질 보정은 fixer가 아니라 멀티모달 rerun builder가 맡아야 한다.

---

## 15. 프롬프트/컨텍스트 크기 재검토 (2026-04-20)

현재 builder 경로의 prompt/context는 품질-first 기준에서도 **과한 편**이다.

### 15.1 왜 과한가

한 호출에 다음이 동시에 많이 겹친다.

- `approvedPlan`
- `sectionBlueprints`
- `editable surface`
- `component/schema catalog`
- `primitive catalog`
- `style presets`
- `section-family contracts`
- `whole-page/reference 설명`

이렇게 되면:

- 느려진다
- 비용이 커진다
- 모델이 safe average로 수렴하기 쉽다
- 중요한 시각 신호보다 주변 계약/설명에 attention이 분산된다

### 15.2 단계별 최소 유효 컨텍스트

품질-first 기준에서 이상적인 단계별 컨텍스트는 이 정도여야 한다.

#### Planner

- 사용자 요청
- 페이지 요약
- whole-page lite

#### Composer

- whole-page
- curated reference 1~3장
- page / cluster / section contract
- 선택 가능한 primitive / recipe shortlist

#### Detailer

- composer 결과
- target component executable surface
- 필요한 제약만

#### Visual Critic

- before
- after
- reference

#### Compare Rerun Builder

- before
- failed after
- reference
- whole-page context
- critic findings
- target contract

### 15.3 줄여야 하는 것

- 큰 `editableComponents` 전체 덤프
- 안 쓰는 family/schema 전체 catalog
- plan/report/history 중복 설명
- reference를 너무 많이 넣는 것
- 같은 규칙을 여러 문단으로 반복하는 설명

한 줄 결론:

> 디자인 품질은 "더 많은 문장"보다 "더 강한 시각 기준 + 더 적은 고품질 컨텍스트"가 더 잘 먹힌다.

---

## 16. 현재 수정 우선순위 업데이트 (2026-04-20)

사용자 기준과 최신 코드/실험 결과를 합치면, 지금 우선순위는 아래처럼 정리된다.

### 16.1 즉시 해결

1. **V2 after 서빙 경계 완전 분리**
   - `builder`만 분리돼서는 안 되고, `/clone-content/...&snapshotState=after`도 legacy surface로 다시 떨어지면 안 된다.
   - `primitiveTree` 또는 `builderVersion=v2`인 draft는 composition/V2 renderer를 우선 타야 한다.
2. **compare rerun 멀티모달화**
   - rerun builder가 failed after screenshot을 직접 보게 한다.
3. **prompt/context 축소**
   - stage별 최소 유효 컨텍스트만 남긴다.

### 16.2 compare path 운영 원칙

- `draft 1회`
- `judge 1회`
- 필요 시 `fresh rerun 1회`
- 종료

그리고 아래는 compare 기본 경로에서 제외한다.

- `visual fix`
- `recovery router`
- 기본 `image-gen`
- 다회 patch append

이미지 생성은 아래 경우에만 붙인다.

- `sufficiency gate`가 자산 부족을 명시
- critic가 자산 부족을 직접 지적

### 16.3 custom surface에 대한 현재 판정

현재 custom scoped CSS 경로는 더 이상 "조금만 더 보강하면 될 수도 있는 기본값"이 아니다.

정확한 현재 판정:

- 호출 구조를 줄여도 품질이 안 오른다
- section-family contract를 넣어도 `hierarchy`가 안 오른다
- V2 renderer가 실제로 타더라도 여전히 surface 상한선이 낮을 가능성이 높다

따라서 custom surface는:

- `품질을 통과하면 남고`
- `통과 못 하면 버려지는 후보`

로 본다.

### 16.4 Tailwind / DaisyUI compare 진입 조건

다음 중 하나라도 만족하면 compare renderer를 바로 만든다.

1. rerender 경계가 정리된 뒤에도 custom surface가 실제 화면 품질에서 약함
2. compare rerun 멀티모달화 후에도 `hierarchy`가 유의미하게 안 오름
3. 호출 구조가 `generate -> judge -> rerun` 수준으로 줄어도 결과가 약함

즉 Tailwind/DaisyUI compare는 후순위 장식이 아니라, **renderer surface 판정 실험**이다.

### 16.5 최종 원칙

> 품질을 만족하지 못하는 방식을 "현재 구조니까" 유지하는 것은 장기적으로 손해다.

그래서 앞으로의 모든 수정은 아래 질문 하나로 거른다.

> **이 수정이 품질을 직접 올리는가, 아니면 현재 구조를 더 오래 끌기 위한 덧붙이기인가?**

후자라면 하지 않는다.

---

## 17. 디자인 시스템 성숙도 관점 재판정 (2026-04-20)

딥서치와 현재 코드 상태를 같이 보면, 현재 구조는 **디자인 시스템의 재료는 상당히 있지만 운영 방식은 아직 renderer-first**다.

즉:

- `section-family contract`
- `primitive catalog`
- `style token preset`
- `identity envelope`

같은 내부 규약은 이미 존재한다.

하지만 이것이 아직:

- 디자인 툴(Figma)
- 코드 컴포넌트
- 스토리/문서
- 시각 회귀 테스트
- 접근성 검증
- 버전/폐기 규칙

까지 이어지는 **공용 source of truth**는 아니다.

한 줄 판정:

> 현재는 "디자인 시스템 위에서 동작하는 AI 빌더"라기보다,  
> "내부 renderer 규약을 참고해 렌더하는 고급 빌더"에 더 가깝다.

### 17.1 지금 있는 것

현재 코드 기준으로는 아래가 이미 있다.

- `section-family contracts`
  - [section-family-contracts.json](/home/mrgbiryu/clonellm/data/normalized/section-family-contracts.json)
- `style runtime token presets`
  - [style-runtime-token-presets.json](/home/mrgbiryu/clonellm/data/normalized/style-runtime-token-presets.json)
- `primitive composition catalog`
  - [primitive-composition-catalog.json](/home/mrgbiryu/clonellm/data/normalized/primitive-composition-catalog.json)
- builder 입력으로 이 세 가지를 싣는 server context
  - [server.js](/home/mrgbiryu/clonellm/server.js)

즉 지금 시스템은 아무 규약 없이 자유 HTML/CSS를 찍는 구조는 아니다.

### 17.2 지금 없는 것

하지만 아래는 아직 없다.

1. **Source of Truth**
   - 토큰이 DTCG/Figma variables/collections/modes와 연결된 표준 자산이 아님
   - 현재는 builder용 internal preset shelf에 가깝다

2. **Design ↔ Code Component 연결**
   - primitive catalog가 실제 code component / figma component / story id와 1:1로 연결되지 않음
   - 아직 registry가 아니라 renderer 전략표에 가깝다

3. **Story / Baseline / Regression 체계**
   - Storybook / Chromatic / a11y baseline이 없음
   - 현재는 whole-page visual critic이 거의 유일한 품질 게이트다

4. **State / Mode / Responsive / A11y 계약**
   - 현재 token/contract는 `surfaceTone`, `density`, `hierarchyEmphasis` 중심
   - 아직 `hover`, `focus`, `disabled`, `loading`, `empty`, `error`, `mobile/tablet/desktop`, `ARIA/keyboard`까지 올라가지 않음

5. **Version / Deprecation 규칙**
   - 어떤 token / primitive / recipe가 언제 추가/폐기되는지 추적하는 체계가 없음

### 17.3 이 관점에서 현재 품질 병목을 다시 보면

이 성숙도 관점은 지금 품질 문제와도 직접 연결된다.

#### 병목 1. generator와 critic의 시각 비대칭

- `Visual Critic`만 before / after / reference를 실제로 본다
- `Rerun Builder`는 failed after를 직접 못 보고 findings 텍스트만 받는다

즉 시스템이 "디자인 시스템처럼" 보이기 전에, AI loop 자체도 아직 비대칭이다.

#### 병목 2. renderer-first 운영

현재 primitive와 token은 존재하지만,

- component registry
- story baseline
- accessibility state
- regression harness

가 없기 때문에, 결국 품질 판단이 다시 renderer surface와 whole-page critic에 과하게 집중된다.

#### 병목 3. prompt 보조 자료 중심 운영

현재 token / primitive / contract는 주로 **프롬프트 보조 자료**로 쓰인다.

하지만 진짜 디자인 시스템이라면,

- build-time source of truth
- runtime component contract
- docs/story/test baseline

까지 같은 계보로 이어져야 한다.

### 17.4 이 분석이 현재 우선순위에 미치는 영향

이 분석은 "지금 당장 Storybook부터 붙이자"는 뜻은 아니다.

오히려 우선순위를 더 명확하게 만든다.

#### 단기

- `hero/quickmenu` 파일럿에서
  - primitive
  - real renderer
  - compare rerun
  - actual served after
  의 경계를 먼저 완전히 정리
- rerun builder를 멀티모달로 바꿔 failed after를 직접 보게 한다

#### 중기

- token preset을 DTCG/Figma variables/modes에 가까운 graph로 끌어올린다
- primitive를 `real component registry`로 만든다
  - figma component
  - code component
  - story id
  - allowed props/states
  - AI allowed operations

#### 장기

- Storybook / Chromatic / a11y baseline을 붙인다
- whole-page critic 단독이 아니라 story baseline 기반 품질 게이트로 간다

### 17.5 최종 판정

이 분석을 품질-first 기준으로 다시 요약하면:

- 현재 구조는 "디자인 시스템을 흉내 내는 고급 렌더러"에 가깝다
- 아직 "디자인 시스템 위에 올라탄 AI 빌더"는 아니다
- 하지만 이건 방향이 틀렸다는 뜻이 아니라,
  - 지금 당장 필요한 단기 수정
  - 중기 구조 승격
  - 장기 시스템화
  를 분리해서 봐야 한다는 뜻이다

그래서 현재 단계의 올바른 질문은:

> **지금 당장 디자인 시스템 전체를 만들 것인가?**

가 아니라

> **현재 품질 병목을 푸는 데 필요한 최소 구조를 먼저 고치고,  
> 그 다음 이걸 진짜 source-of-truth 기반 시스템으로 승격시킬 것인가?**

이다.

이 문서의 현재 답은 후자다.

---

## 18. Tailwind / shadcn / Storybook / Code Connect 비교 결론 (2026-04-20)

딥서치와 현재 코드 검토를 함께 보면, 현재 구조와 Tailwind/shadcn/Storybook 계열은 **서로 다른 강점**을 가진다.

### 18.1 외부 구조의 강점

#### Tailwind

- utility-first라서 스타일이 마크업 표면에 직접 드러난다
- state / breakpoint / theme variable이 같은 표면에서 같이 다뤄진다
- AI가 "어디를 어떻게 바꿨는지"를 읽고 수정하기 쉽다

#### shadcn/ui

- open code
- composition
- distribution
- AI-ready

즉 LLM이 읽을 수 있는 실제 컴포넌트 코드와 공통 인터페이스가 있다.

#### Storybook

- component/page isolation
- single source of truth
- 자동 문서화
- visual test
- accessibility test

즉 AI가 "실제로 동작하는 컴포넌트 패턴"을 검색하고 재사용하기 좋다.

#### Figma Code Connect

- 디자인 컴포넌트와 코드 컴포넌트를 직접 연결
- Dev Mode / MCP에 더 정확한 구현 문맥을 제공

즉 design-to-code mapping이 prompt 보조자료가 아니라 실제 시스템 자산이 된다.

### 18.2 현재 clonellm 구조의 강점

현재 구조도 없는 것은 아니다. 오히려 아래는 강점이다.

- `section-family contract`
- `primitive catalog`
- `style token preset`
- `page / cluster / section` 계층적 의미 제어
- family/cluster 단위의 **restaging** 지향

즉 현재 구조는:

- 단순 authoring 시스템이 아니라
- 페이지 전체 의미를 보고
- 상위 레벨 재연출을 시도하는 구조

라는 장점이 있다.

### 18.3 현재 구조의 약점

하지만 AI 작성/수정 관점에서는 약점이 크다.

1. 실제 출력 표면이 AI가 직접 다루는 코드 표면이 아니다
   - token / contract / primitive는 프롬프트용 해석 계층에 더 가깝다
   - after 화면은 visual critic만 직접 본다

2. rerun builder가 failed after를 직접 못 본다
   - critic findings 텍스트만 받고 다시 만든다

3. component-level reproducibility가 약하다
   - Storybook / Chromatic / component baseline이 없다

4. design-to-code 연결이 약하다
   - Figma Code Connect 같은 직접 연결이 없다

즉 현재 구조는:

- 잘 맞으면 크게 restage할 수 있지만
- 일반적인 authoring 성능 / 재현성 / 회귀 안정성은 약하다

### 18.4 현재 시점의 거친 비교 판정

#### Tailwind + shadcn + Storybook + Code Connect

- AI 작성 속도: 높음
- 재현성: 높음
- 회귀 안정성: 높음
- component 단위 authoring: 강함
- page 전체 restaging: 상대적으로 약함

#### 현재 clonellm 구조

- 상위 의미 제어: 강함
- page / cluster restaging: 강함
- AI 직접 수정성: 약함
- 재현성: 약함
- 회귀 안정성: 약함

한 줄 요약:

> 현재 구조는 "AI가 쉽게 잘 쓰는 구조"라기보다  
> "AI가 크게 재디자인을 시도하는 구조"다.

### 18.5 지금 시점의 최선 방향: 둘 중 하나를 버리는 게 아니라 합친다

이 비교 결과는 "Tailwind로 갈아탄다 vs 현재 구조를 유지한다"의 이분법으로 보면 안 된다.

가장 현실적인 방향은 아래 하이브리드다.

1. **상위 의미 제어는 유지**
   - `family`
   - `primitive`
   - `contract`
   - `identity envelope`

2. **실제 출력 표면은 더 직접적인 구조로 교체**
   - Tailwind utility surface
   - shadcn/ui 스타일의 explicit component API
   - renderer-owned recipe mapping

3. **Story baseline 추가**
   - Storybook
   - visual baseline
   - accessibility baseline

4. **rerun builder 멀티모달화**
   - failed after를 직접 보게

5. **design-to-code mapping 추가**
   - Code Connect 식 연결 또는 그에 준하는 internal mapping

### 18.6 이 비교가 현재 구현 우선순위에 주는 의미

이 비교 결과를 현재 품질-first 기준으로 해석하면:

- `current custom scoped CSS`를 계속 밀 이유는 더 약해졌다
- 하지만 `family / primitive / contract` 자체를 버릴 이유는 없다
- 따라서 다음 renderer compare는:
  - `상위 의미 제어는 그대로 두고`
  - `출력 표면만 Tailwind/shadcn형으로 바꿔 비교`
  하는 구조가 맞다

즉 앞으로의 목표는:

> **renderer surface는 AI가 잘 쓰는 쪽으로 바꾸고,  
> 의미 제어 계층은 현재 시스템의 강점을 유지한다**

이다.

이것이 현재 시점의 가장 현실적인 하이브리드 방향이다.
