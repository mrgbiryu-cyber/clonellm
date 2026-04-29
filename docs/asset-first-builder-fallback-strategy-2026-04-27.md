# Asset-First / Builder Fallback Strategy

작성일: 2026-04-27

## 결론

자산 확보만으로 모든 섹션을 해결하려고 하면 빈 섹션이 많거나 자산 풀이 좁은 페이지에서 결과가 반복된다. 따라서 생성 파이프라인은 아래 두 경로를 명확히 분리한다.

1. `asset-first`: 승인된 PC/MO별 자산 레지스트리에서 역할이 맞는 자산을 우선 사용한다.
2. `builder-fallback`: 적합한 자산이 없을 때 빌더가 직접 구성한다.

`builder-fallback` 내부는 다시 두 방식으로 나눈다.

1. `image-router fallback`: 이미지가 화면 임팩트의 핵심인 섹션에서 임시 이미지를 생성한다.
2. `css-composition fallback`: 텍스트, 컬러, 그리드, 카드, 배지, 도형, 타이포그래피, Tailwind 구조만으로 구성한다.

## 현재 코드 상태

- 기존 `server.js`에는 `materializeSufficiencyRecoveryVisualAssets`, `materializeGeneratedBuildAssets`, `buildGeneratedVisualPrompt`가 있어 이미지 생성형 복구의 기반은 있다.
- 이 경로는 `OPENROUTER_IMAGE_MODEL`이 설정된 strong/full patch depth 계열에서만 동작하는 성격이 강하다.
- 현재 주력인 `design-runtime-v1` 로컬 작성 경로는 `design-pipeline/author-input.js`가 자산 레지스트리를 주입하고, `design-pipeline/author-output.js`가 일부 CSS fallback을 직접 렌더링한다.
- 예: hero 배경 자산이 없으면 이미지 대신 gradient/radial 기반 배경을 렌더링한다.
- 예: quickmenu 아이콘이 없으면 기본 glyph fallback을 사용한다.
- 아직 `asset-first`, `image-router fallback`, `css-composition fallback`을 섹션별 정책으로 판단하는 공통 모듈은 없다.

## 정책 기준

### Asset-First

아래 조건을 만족하면 승인 자산을 사용한다.

- `viewportProfile`이 현재 빌드 대상과 일치한다.
- `assetUsagePolicy`의 role과 자산 role이 일치한다.
- `pageId`, `familyId`, `slotId` scope가 충돌하지 않는다.
- `approved` 또는 현재 빌드에서 허용된 `draft-generated` 상태다.
- PC 자산을 MO에서, MO 자산을 PC에서 재사용하지 않는다.

### Image-Router Fallback

아래 섹션은 적합한 자산이 없을 때 이미지 라우터를 호출할 수 있다.

- `hero`
- `visual`
- `brandBanner`
- `labelBanner`
- `brandStory`
- `marketing-area`
- `md-choice`
- `best-ranking`
- `bestProduct`
- `firstRow`
- `firstProduct`
- `review` 중 이미지 중심 후기 카드

이미지 라우터 결과물은 바로 영구 승인하지 않는다.

- 빌드 중에는 `draft-generated` 또는 `candidate`로만 사용한다.
- 저장 시에는 메타데이터와 함께 후보 자산으로 남긴다.
- 재사용 자산으로 승격하려면 별도 승인 플로우를 거친다.
- 이미지 내부 텍스트는 금지한다.
- 생성 이미지도 PC/MO viewport role 검증을 통과해야 한다.

### CSS-Composition Fallback

아래 섹션은 이미지가 없어도 CSS/Tailwind 조형으로 해결하는 것이 우선이다.

- `price`
- `option`
- `qna`
- `guides`
- `seller`
- `benefit`
- `noticeBanner`
- `detailInfo`
- `shortcut`
- `quickMenu` 중 아이콘 패밀리가 없을 때의 임시 칩 UI
- `tabs`
- `filter`
- `spec`
- `support`류 안내 섹션

이 방식은 외부 이미지 비용이 없고 안정적이지만, 화면 임팩트가 약해질 수 있다. 따라서 hero/banner/lifestyle visual에는 기본값으로 쓰지 않고, light/medium draft 또는 이미지 생성 실패 시의 안전 fallback으로 둔다.

## 의사결정 매트릭스

| 상황 | 1차 선택 | 2차 선택 | 비고 |
| --- | --- | --- | --- |
| 승인된 역할 자산이 충분함 | asset-first | 없음 | 가장 안정적 |
| hero/banner 자산 없음 | image-router fallback | css-composition fallback | strong/full 빌드에서 우선 적용 |
| commerce 카드 이미지 없음 | css-composition fallback | image-router fallback | 제품 왜곡 위험 때문에 CSS 우선 |
| quickmenu/icon 자산 없음 | icon/image-router fallback | glyph/CSS chips | 아이콘 패밀리 단위 생성 필요 |
| price/option/review/qna | css-composition fallback | 없음 | 이미지 생성 불필요 |
| 이미지 라우터 실패 | css-composition fallback | unresolved marker | 렌더링은 깨지지 않아야 함 |

## 필요한 코드 변경

1. `data/normalized/asset-fallback-policies.json` 추가

섹션/슬롯별 fallback 정책을 데이터로 분리한다.

```json
{
  "hero": {
    "preferred": "asset-first",
    "fallback": "image-router",
    "finalFallback": "css-composition",
    "requiresViewportMatch": true,
    "allowGeneratedTextInImage": false
  }
}
```

2. `design-pipeline/asset-fallback-policy.js` 추가

현재 section, pageId, viewportProfile, assetUsagePolicy, assetRegistry 상태를 보고 fallback mode를 결정한다.

3. `design-pipeline/author-input.js` 확장

각 section packet에 아래 필드를 추가한다.

```json
{
  "assetFallbackPolicy": {
    "mode": "asset-first|image-router|css-composition",
    "reason": "missing_approved_background_asset",
    "allowedGeneratedAssetRoles": ["background-only"],
    "finalFallback": "css-composition"
  }
}
```

4. `design-pipeline/author-llm.js` 프롬프트 확장

LLM에게 아래 규칙을 명시한다.

- asset-first면 등록된 자산 ID만 사용한다.
- image-router fallback이면 placeholder를 직접 HTML에 박지 말고 생성 요청 메타만 남긴다.
- css-composition fallback이면 이미지 없이 Tailwind/CSS 구조로 완성한다.
- 어떤 경우에도 검증되지 않은 외부 URL이나 PC/MO가 맞지 않는 자산을 쓰지 않는다.

5. 이미지 라우터 추상화

기존 OpenRouter 고정 호출을 그대로 확장하지 말고 provider-neutral wrapper를 둔다.

후보 구조:

- `design-pipeline/image-router.js`
- provider: `openrouter`, `openai`, `atlas`, `local-disabled`
- input: prompt, viewportProfile, role, aspectRatio, noText flag
- output: generatedAssetId, localPath, metadata, safetyStatus

6. validation 확장

최종 HTML 검증에서 아래를 허용한다.

- 승인 자산
- 현재 빌드에서 생성되어 metadata 검증을 통과한 `draft-generated` 자산

아래는 계속 차단한다.

- 역할 불일치 자산
- PC/MO 불일치 자산
- 출처 불명 이미지 URL
- 이미지 내부 텍스트가 필요한 식으로 생성된 hero/banner

7. Admin 표시

빌드 결과의 섹션별 자산 상태를 보여준다.

- `approved asset used`
- `draft generated image`
- `css fallback`
- `unresolved`

## 적용 순서

1. fallback policy 데이터와 결정 모듈을 먼저 추가한다.
2. `author-input`에 section별 fallback packet을 넣는다.
3. `author-llm`에 fallback 작성 규칙을 추가한다.
4. CSS fallback만 먼저 전체 16개 페이지에 적용해 렌더링 안정성을 확보한다.
5. hero/banner/visual 중심으로 image-router fallback을 제한적으로 연결한다.
6. 생성 이미지를 Admin에서 후보 자산으로 확인하고 승인/폐기할 수 있게 한다.

## 중요한 원칙

자산화와 fallback은 경쟁 관계가 아니다. 자산화는 재사용 가능한 품질을 높이는 경로이고, fallback은 자산이 부족해도 화면이 비거나 반복되지 않게 하는 안전망이다. 최종적으로는 fallback으로 생성된 좋은 결과를 후보 자산으로 승격시켜 다시 asset-first 풀을 키우는 순환 구조가 되어야 한다.
