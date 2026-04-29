# Visual Verifier Contract (2026-04-21)

## 목적

이 문서는 새 본선에서 `Visual Verifier`가 무엇을 보고,
어떤 종류의 피드백을 만들고,
어느 단계로 되돌려 보내야 하는지를 정의한다.

핵심은 하나다.

`Visual Verifier는 품질 향상 보조 계층이며, 이전 시스템처럼 무한 루프를 만드는 hard gate가 아니다.`

상위 기준 문서:

- [Design Quality North Star](./admin-design-quality-north-star-2026-04-21.md)
- [Design Authoring Architecture](./admin-design-authoring-architecture-2026-04-21.md)
- [Authored Section HTML Package Minimal Schema](./admin-authored-section-html-package-minimal-schema-2026-04-21.md)
- [Runtime Renderer Contract](./admin-runtime-renderer-contract-2026-04-21.md)
- [Design Author Output Validation](./admin-design-author-output-validation-2026-04-21.md)

---

## 1. 한 줄 정의

`Visual Verifier`는 before/after 결과를 보고,

- 요구한 변화가 보이는지
- 브랜드 정렬이 유지되는지
- target group 안에서 의도한 개선이 읽히는지

를 확인해

- 그대로 진행할지
- 한 번만 Author에게 구체 피드백을 돌릴지
- advisory를 남기고 종료할지

를 정하는 계층이다.

---

## 2. 입력

최소 입력은 아래다.

```json
{
  "conceptPackage": {},
  "authoredSectionHtmlPackage": {},
  "visualArtifacts": {},
  "verificationContext": {}
}
```

### 2.1 conceptPackage

의미:

- 무엇을 유지하고 무엇을 바꾸려 했는지 보는 기준 문서

### 2.2 authoredSectionHtmlPackage

의미:

- 실제로 어떤 범위를 authoring 했는지 확인하기 위한 결과 문서

### 2.3 visualArtifacts

의미:

- 시각 비교를 위한 결과물

권장 필드:

- `beforeScreenshot`
- `afterScreenshot`
- `beforeHtmlReference`
- `afterHtmlReference`

### 2.4 verificationContext

의미:

- 시각 검토 문맥

권장 필드:

- `targetGroup`
- `viewportProfile`
- `verificationFocus`
- `attemptHistory`

---

## 3. 무엇을 확인하는가

Visual Verifier는 아래만 확인한다.

### 3.1 변화 체감 존재 여부

확인 내용:

- 요청한 수정이 실제로 보이는가
- before와 after가 사실상 동일하게 보이지는 않는가

### 3.2 브랜드 정렬 여부

확인 내용:

- page identity와 design policy를 크게 벗어나지 않는가
- 과도한 프로모션 톤, 파편화된 스타일 같은 금지 방향으로 흐르지 않았는가

### 3.3 정보 위계 개선 여부

확인 내용:

- 요청한 target group 안에서 메시지 우선순위가 더 명확해졌는가
- CTA, 보조 정보, 탐색 요소의 읽힘이 나아졌는가

### 3.4 범위 준수 여부

확인 내용:

- 검증 대상은 target group 안에 한정되는가
- boundary 밖 변화가 있더라도 verifier가 그걸 기준으로 재설계를 요구하지 않는가

---

## 4. 무엇을 확인하지 않는가

아래는 Visual Verifier의 역할이 아니다.

### 4.1 전달 가능성 재검증 금지

- authored html 존재 여부
- shell 침범 여부
- asset placeholder 형식

이건 `Design Author Output Validation`이 맡는다.

### 4.2 Concept Model 재실행 요구 금지

- 문제를 다시 정의하라고 돌려보내지 않는다
- scope를 다시 정하라고 돌려보내지 않는다

retry 대상은 `Design Author Model`이다.

### 4.3 무한 루프 금지

- verifier는 반복 재시도 루프를 만들지 않는다
- `maxRetryCount = 1`

### 4.4 runtime 수정 유도 금지

- runtime이 더 예쁘게 보정하라고 요구하지 않는다
- authored html을 후처리로 다듬는 경로를 만들지 않는다

---

## 5. 출력

최소 출력은 아래다.

```json
{
  "verificationSummary": {},
  "retryInstruction": {},
  "advisory": [],
  "attemptRecord": {}
}
```

### 5.1 verificationSummary

의미:

- 이번 결과를 한 줄로 정리한 판단 요약

권장 필드:

- `overallFinding`
- `qualityDirection`
- `changeVisibility`

좋은 예:

```json
{
  "overallFinding": "요청한 상단 위계 개선은 보이지만 hero CTA의 집중도가 아직 약하다",
  "qualityDirection": "브랜드 톤은 유지되며 변화 체감도 존재한다",
  "changeVisibility": "before 대비 hero headline과 quickmenu 리듬 변화가 보인다"
}
```

### 5.2 retryInstruction

의미:

- Author에게 한 번만 되돌려 보낼 구체 피드백

권장 필드:

- `shouldRetry`
- `instructionText`
- `targetAreas`

주의:

- vague한 평가는 금지
- “더 고급스럽게”보다 “headline 우선순위를 더 올리고 quickmenu 대비를 낮춰라”처럼 구체적이어야 한다

### 5.3 advisory

의미:

- retry를 더 하지 않더라도 남겨둘 참고 메모

예:

- 변화는 충분하지만 quickmenu 라벨 리듬은 다음 iteration에서 다듬을 수 있음
- 현재 시안은 브랜드 정렬은 맞으나 CTA 응집력이 약함

### 5.4 attemptRecord

의미:

- 이번 검증이 몇 번째 시도인지와 종료 조건 기록

권장 필드:

- `attemptCount`
- `retryIssued`
- `retryExhausted`
- `exitReason`

---

## 6. retry 규칙

### 6.1 retry 대상

retry 대상은 `Design Author Model`이다.

금지:

- Concept Model로 되돌리기
- Runtime Renderer가 임의 보정하기

### 6.2 max retry

`maxRetryCount = 1`

의미:

- 첫 결과에서 품질 보완이 필요하면 한 번만 Author에게 구체 instruction을 돌린다
- 두 번째에도 완벽하지 않더라도 더 이상 루프를 만들지 않는다

### 6.3 retry exhausted 처리

`onRetryExhausted = advisory-pass`

의미:

- retry를 모두 쓴 뒤에도 치명적 전달 문제는 없으면 흐름을 통과시킨다
- 대신 advisory에 남긴다

주의:

- 이 계층은 본선 blocking gate가 아니다
- 차단은 앞선 validation/safety 계층에서 끝나야 한다

---

## 7. 좋은 피드백과 나쁜 피드백

### 7.1 좋은 피드백

- `hero headline이 여전히 혜택 카피에 묻힌다. headline 줄 수를 줄이고 CTA를 하나로 압축하라`
- `quickmenu가 hero보다 과하게 강하게 읽힌다. 라벨 대비를 낮추고 여백을 늘려 hero 보조 역할로 후퇴시켜라`

### 7.2 나쁜 피드백

- `더 고급스럽게`
- `좀 더 세련되게`
- `Apple처럼`

이유:

- Author가 바로 실행할 수 없는 피드백은 retry instruction이 아니다

---

## 8. 구현 가드레일

코드로 옮길 때 아래를 금지한다.

- 수치 점수 기반 hard gate
- retry count 확장
- compare rerun 루프 부활
- verifier 결과를 runtime 분기 키로 사용

Visual Verifier는 `quality assistant`이지 `pipeline owner`가 아니다.

---

## 9. 한 줄 기준

`Visual Verifier는 before/after를 보고 Author에게 한 번만 구체 피드백을 돌릴 수 있지만, 다시 무한 루프나 hard gate의 중심이 되어서는 안 된다.`
