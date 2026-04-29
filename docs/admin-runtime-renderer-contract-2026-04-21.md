# Runtime Renderer Contract (2026-04-21)

## 목적

이 문서는 새 본선에서 `Runtime Renderer`가 정확히 무엇을 받고,
무엇을 만들며,
어디까지 책임지고,
어디서 멈춰야 하는지를 고정한다.

핵심은 하나다.

`Runtime Renderer는 디자인을 결정하지 않는다. Authored HTML을 안전하게 전달하고 서빙한다.`

상위 기준 문서:

- [Design Quality North Star](./admin-design-quality-north-star-2026-04-21.md)
- [Markdown-First Authoring Flow](./admin-markdown-first-authoring-flow-2026-04-22.md)
- [Schema Guardrail](./admin-schema-guardrail-2026-04-21.md)
- [Design Authoring Architecture](./admin-design-authoring-architecture-2026-04-21.md)
- [Authored Section HTML Package Minimal Schema](./admin-authored-section-html-package-minimal-schema-2026-04-21.md)

---

## 1. 한 줄 정의

`Runtime Renderer`는 `Authored Section HTML Package`를 받아

- boundary 안에 삽입하고
- asset placeholder를 치환하고
- sanitize한 뒤
- before/after 결과와 draft 저장물을 만든다.

그 외의 디자인 판단은 하지 않는다.

추가 기준:

- 상위 LLM 출력은 Markdown authored document일 수 있다
- Runtime Renderer는 그 문서를 서빙용 최소 형식으로 projection할 수 있다
- 이 projection은 디자인 판단이 아니라 delivery adapter 역할이다

---

## 2. 입력

Runtime Renderer의 최소 입력은 아래다.

```json
{
  "authoredSectionHtmlPackage": {},
  "referencePageShell": {},
  "runtimeContext": {}
}
```

### 2.1 authoredSectionHtmlPackage

의미:

- Design Author LLM이 작성한 실제 section HTML 결과

필수:

- `pageId`
- `viewportProfile`
- `targetGroup`
- `sections`

### 2.2 referencePageShell

의미:

- 현재 페이지에서 유지해야 하는 shell 정보

권장 필드:

- `pageId`
- `viewportProfile`
- `rawShellHtml`
- `sectionBoundaryMap`
- `shellMetadata`

주의:

- 이 입력은 디자인 결정을 위한 것이 아니라 삽입 위치를 찾기 위한 것이다.
- shell이 authored HTML의 구조를 재결정하면 안 된다.

### 2.3 runtimeContext

의미:

- 서빙과 저장에 필요한 최소 런타임 문맥

권장 필드:

- `draftIdentity`
- `assetResolutionContext`
- `sanitizePolicy`
- `snapshotRequest`

좋은 예:

```json
{
  "draftIdentity": {
    "pageId": "home",
    "viewportProfile": "pc"
  },
  "assetResolutionContext": {
    "availableAssets": [],
    "currentPageAssetMap": {}
  },
  "sanitizePolicy": {
    "removeScripts": true,
    "blockExternalInlineJs": true
  },
  "snapshotRequest": {
    "needBefore": true,
    "needAfter": true
  }
}
```

주의:

- `sanitizePolicy`는 디자인을 제한하는 gate가 아니라 보안/서빙 정책이다.

---

## 3. 출력

Runtime Renderer의 출력은 아래다.

```json
{
  "beforeHtml": "",
  "afterHtml": "",
  "draftBuild": {},
  "advisory": []
}
```

### 3.1 beforeHtml

의미:

- authored 결과가 적용되기 전의 기준 HTML

### 3.2 afterHtml

의미:

- authored 결과가 적용된 후의 HTML

### 3.3 draftBuild

의미:

- 저장 가능한 draft 결과

필수 최소 필드:

- `summary`
- `pageId`
- `viewportProfile`
- `authoredSectionHtmlPackage`
- `renderedHtmlReference`
- `advisory`

### 3.4 advisory

의미:

- 서빙 과정에서 발생한 주의 메모

예:

- asset slot 일부가 fallback asset으로 치환됨
- sanitize 과정에서 금지 태그 제거
- shell boundary가 추정 기준으로 적용됨

주의:

- advisory는 retry 명령이 아니다
- 품질 판정은 Visual Verifier가 맡는다

---

## 4. Runtime Renderer가 하는 일

Runtime Renderer는 아래만 한다.

### 4.1 boundary 확인

- `targetGroup.boundary`를 읽고 적용 범위를 정한다

### 4.2 authored HTML 삽입

- `sections[*].html`을 해당 boundary 안에 삽입한다

### 4.3 asset placeholder 치환

- `data-asset-slot` 또는 `assetPlaceholders`를 실제 asset으로 연결한다

### 4.4 sanitize

- 스크립트, 위험 속성, 금지된 외부 주입 요소를 제거한다

### 4.5 before/after 생성

- 비교 가능한 기준 HTML과 결과 HTML을 만든다

### 4.6 draft 저장 준비

- 저장 가능한 draft payload를 만든다

---

## 5. Runtime Renderer가 하지 않는 일

아래는 금지다.

### 5.1 authored HTML 재작성 금지

- section 구조 다시 쓰기 금지
- Tailwind class 다시 결정 금지
- wrapper/layout 재조립 금지

### 5.2 content -> html 재조합 금지

- `sections[*].content`를 읽어 `html`을 다시 만들지 않는다
- `content`는 provenance 기록이며 `html`이 정본이다

### 5.3 template/family 환원 금지

- authored HTML을 template/family/preset으로 분해하지 않는다

### 5.4 디자인 판단 금지

- 더 예쁘게 보이도록 보정 금지
- hierarchy를 runtime이 다시 판단 금지
- brand tone을 runtime이 다시 정정 금지

### 5.5 실행 범위 승격 금지

- `element`를 `full`처럼 처리 금지
- `copy-only`를 `layout-only`로 확장 금지
- component 수정 요청을 page 수정으로 확대 금지

---

## 6. asset placeholder 계약

Runtime Renderer는 asset을 아래 원칙으로 처리한다.

### 6.1 재사용 우선

- 현재 페이지에서 추출된 asset이 있으면 우선 재사용

### 6.2 임의 URL 생성 금지

- runtime이 새 이미지 URL을 임의 생성하지 않는다

### 6.3 placeholder 치환

예:

```html
<img data-asset-slot="hero-main" alt="LG 오브제컬렉션 냉장고 메인 이미지" />
```

처리:

- `hero-main`에 대응하는 실제 asset 탐색
- 찾으면 `src` 치환
- 못 찾으면 advisory 기록 후 fallback asset 정책 적용

### 6.4 fallback asset 정책

주의:

- fallback은 schema 계약이 아니라 runtime 운영 정책이다
- 본선 품질을 결정하는 구조가 되어서는 안 된다

즉 runtime 문서에는 “fallback이 있을 수 있다”만 기록하고,
그 fallback이 authored output 구조를 바꾸게 해서는 안 된다.

---

## 7. sanitize 범위

sanitize는 아래만 한다.

- `<script>` 제거
- 위험한 inline event 제거
- 금지된 외부 JS 주입 제거
- shell 경계를 넘는 위험 마크업 차단

sanitize가 하지 않는 것:

- 문장 고치기
- spacing/class 미세 조정
- 카피 순서 변경
- CTA 재명명

즉 sanitize는 보안/운영 안정성 계층이지 디자인 후처리 계층이 아니다.

---

## 8. before/after 생성 규칙

### 8.1 before

- 현재 기준 shell + 원본 section 상태

### 8.2 after

- 현재 기준 shell + authored section 상태

### 8.3 비교 보조 정보

Runtime은 비교를 위해 아래를 함께 남길 수 있다.

- boundary summary
- inserted section list
- asset replacement summary

주의:

- 비교 데이터는 검증 보조 정보다
- 실행 범위나 디자인 판단을 다시 정의하지 않는다

---

## 9. 좋은 예 / 나쁜 예

### 9.1 좋은 예

```json
{
  "beforeHtml": "<html>...</html>",
  "afterHtml": "<html>...</html>",
  "draftBuild": {
    "pageId": "home",
    "viewportProfile": "pc",
    "summary": "상단 진입부 authored HTML 적용 결과",
    "authoredSectionHtmlPackage": {},
    "renderedHtmlReference": {
      "before": "stored-before-ref",
      "after": "stored-after-ref"
    },
    "advisory": []
  }
}
```

### 9.2 나쁜 예

```json
{
  "runtimeResult": {
    "resolvedTemplate": "hero-editorial-v1",
    "normalizedLayoutMode": "split-left",
    "rewrittenHeadline": "..."
  }
}
```

이유:

- runtime이 다시 디자인 판단을 가져간다
- authored HTML을 본선 정본으로 쓰지 않는다

---

## 10. 구현 착수 시 체크

Runtime Renderer 구현 전 확인:

1. 이 로직이 HTML delivery인가
2. 아니면 디자인 authoring을 다시 하고 있는가
3. 이 로직이 authored HTML을 있는 그대로 전달하는가
4. 아니면 template/family/preset으로 환원하려 하는가

3이 `아니오`이고 4가 `예`이면 구현하지 않는다.

---

## 11. 한 줄 기준

`Runtime Renderer는 authored HTML을 안전하게 적용하고 서빙하는 계층이며, 디자인 판단을 다시 가져가면 안 된다.`
