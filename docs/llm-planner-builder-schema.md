# LLM Planner / Builder Schema

이 문서는 `admin` 프리뷰 워크벤치에서 사용할 `Planner LLM`과 `Builder LLM`의 역할, 입출력 스키마, 저장 구조, API 흐름을 구현 기준으로 정리한 문서다.

핵심 원칙은 아래와 같다.

1. `Planner`는 요구사항을 정리한다.
2. `Builder`는 정리된 요구사항을 실행한다.
3. `Builder`는 원문 고객 요청을 다시 해석하는 주체가 아니다.
4. 생성 결과는 `작업 버전`으로 저장되고, 필요 시 `현재 View`로 고정된다.
5. 디자인 변화율과 anti-AI 규칙은 별도 축으로 운영한다.

예시 규칙:

1. 외부 URL 예시는 실제 운영 주소처럼 오해되지 않도록 reserved domain인 `.invalid`를 사용한다.
2. JSON 예시는 가능한 한 빈 객체 `{}`나 빈 배열 `[]` 대신 실전형 샘플 값을 넣는다.
3. 아래 JSON은 설명용 샘플이며, production literal이나 하드코딩 기본값을 뜻하지 않는다.

관련 문서:

1. 디자인 도구와 anti-AI 정책은 `docs/design-tooling-strategy.md`를 기준 문서로 사용한다.

---

## 1. 역할 분리 기준

### 1.1 Planner LLM

책임:

1. 고객 요청 해석
2. 레퍼런스 URL/화면 의도 해석
3. 요구사항 구조화
4. 기획 방향 정리
5. 디자인 방향 정리
6. 우선순위/주의사항 정리

비책임:

1. 직접 patch 확정
2. slot/source 변경 적용
3. 버전 저장 실행

### 1.2 Builder LLM

책임:

1. 확정된 Planner 결과를 실제 페이지 구조에 매핑
2. 허용된 slot/source/patch 범위 안에서 시안 생성
3. 도구 호출 결과를 바탕으로 저장 가능한 버전 산출
4. 생성 근거 및 변경 요약 보고

비책임:

1. 원문 고객 요청을 처음부터 다시 해석
2. 승인되지 않은 계획으로 임의 실행
3. 시스템 밖 arbitrary full-page 재생성

---

## 2. 모델 운영 원칙

초기 운영 권장:

1. 역할은 분리한다.
2. 모델은 처음에는 같은 계열을 써도 된다.
3. 다만 시스템 프롬프트, 입력 스키마, 출력 스키마는 분리한다.

권장 운영 형태:

1. `Planner`
   - 문서 정리형
   - 상대적으로 가벼운 모델 가능
2. `Builder`
   - 도구 사용 안정성이 높은 모델 권장
   - 더 긴 컨텍스트와 구조화 출력이 중요

OpenRouter 기준 초기 권장 전략:

1. 첫 구현은 `PLANNER_MODEL`, `BUILDER_MODEL` 환경변수 분리
2. 값이 없으면 둘 다 `OPENROUTER_MODEL` fallback
3. 이후 운영 데이터가 쌓이면 역할별 모델 교체

예시:

```env
OPENROUTER_MODEL=openai/gpt-4.1-mini
PLANNER_MODEL=openai/gpt-4.1-mini
BUILDER_MODEL=openai/gpt-4.1
```

---

## 3. Planner 입력 스키마

Planner는 raw page HTML이 아니라 구조화된 페이지/요구사항 정보를 받는다.

```json
{
  "mode": "hybrid",
  "pageContext": {
    "workspacePageId": "pdp-tv-premium",
    "runtimePageId": "category-tvs",
    "pageLabel": "PDP - TV 프리미엄형",
    "pageGroup": "product-detail",
    "viewportProfile": "pc"
  },
  "workspaceContext": {
    "currentWorkingVersionId": null,
    "currentViewVersionId": null,
    "recentVersionCount": 3
  },
  "userInput": {
    "requestText": "프리미엄 OLED 느낌을 더 강조하고 혜택 메시지는 단순화해줘",
    "keyMessage": "초프리미엄, 몰입감, 공간 조화",
    "preferredDirection": "브랜드 감도 높은 다크톤",
    "avoidDirection": "과한 할인몰 느낌",
    "toneAndMood": "정제된 프리미엄",
    "referenceUrls": [
      "https://reference.example.invalid/lg-signature-oled"
    ]
  },
  "pageSummary": {
    "editableSlots": [
      "gallery",
      "summary",
      "price",
      "option",
      "sticky",
      "review",
      "qna"
    ],
    "existingComponents": [
      "pdp-tv-premium.gallery",
      "pdp-tv-premium.summary",
      "pdp-tv-premium.price"
    ],
    "currentPatchSummary": [
      {
        "componentId": "pdp-tv-premium.summary",
        "patchedKeys": ["title", "subtitle"]
      }
    ]
  }
}
```

필수 필드:

1. `pageContext.workspacePageId`
2. `pageContext.pageGroup`
3. `pageContext.viewportProfile`
4. `userInput.requestText` 또는 `userInput.referenceUrls`

입력 모드:

1. `direct`
2. `reference`
3. `hybrid`

---

## 4. Planner 출력 스키마

Planner 출력은 사용자가 수정 가능한 `기획 정리본`이어야 한다.

```json
{
  "summary": "TV 프리미엄형 PDP를 초프리미엄 감성 중심으로 재정리하는 안입니다.",
  "requirementPlan": {
    "title": "PDP - TV 프리미엄형 초프리미엄 시안",
    "requestSummary": [
      "혜택 문구는 줄이고 프리미엄 메시지를 강화한다.",
      "브랜드 감도와 공간 조화를 강조한다."
    ],
    "planningDirection": [
      "상단 summary에서 제품 가치 설명을 먼저 강화한다.",
      "price/benefit 영역은 정보량을 줄이고 핵심 혜택만 남긴다."
    ],
    "designDirection": [
      "다크 배경과 큰 이미지 비중을 활용한다.",
      "텍스트는 짧고 강한 헤드라인 중심으로 정리한다."
    ],
    "priority": [
      {
        "rank": 1,
        "target": "summary",
        "reason": "첫인상과 메시지 전달의 중심 영역"
      },
      {
        "rank": 2,
        "target": "gallery",
        "reason": "프리미엄 감도를 만드는 핵심 비주얼"
      }
    ],
    "guardrails": [
      "할인몰 톤으로 보이는 과도한 혜택 강조 금지",
      "기존 제품 정보의 사실 관계는 임의 변경 금지"
    ],
    "referenceNotes": [
      {
        "url": "https://reference.example.invalid/lg-signature-oled",
        "takeaways": [
          "이미지 비중이 크고 타이포가 간결하다"
        ]
      }
    ],
    "builderBrief": {
      "objective": "프리미엄 브랜드 감도 강화",
      "mustKeep": [
        "제품 핵심 정보 구조",
        "기존 PDP 기본 슬롯 구조"
      ],
      "mustChange": [
        "summary 카피 톤",
        "gallery 첫 화면 인상",
        "price 영역 정보 우선순위"
      ],
      "suggestedFocusSlots": [
        "gallery",
        "summary",
        "price",
        "sticky"
      ]
    }
  }
}
```

Planner 출력 필수 필드:

1. `summary`
2. `requirementPlan.title`
3. `requirementPlan.requestSummary`
4. `requirementPlan.planningDirection`
5. `requirementPlan.designDirection`
6. `requirementPlan.priority`
7. `requirementPlan.guardrails`
8. `requirementPlan.builderBrief`

원칙:

1. Planner 결과는 UI에서 바로 수정 가능해야 한다.
2. Builder는 원칙적으로 `builderBrief`와 수정된 `requirementPlan` 전체를 입력으로 받는다.

---

## 5. Builder 입력 스키마

Builder는 승인된 Planner 결과와 시스템 컨텍스트를 함께 받는다.

```json
{
  "pageContext": {
    "workspacePageId": "pdp-tv-premium",
    "runtimePageId": "category-tvs",
    "pageLabel": "PDP - TV 프리미엄형",
    "pageGroup": "product-detail",
    "viewportProfile": "pc"
  },
  "approvedPlan": {
    "title": "PDP - TV 프리미엄형 초프리미엄 시안",
    "requestSummary": [
      "혜택 노출을 줄이고 프리미엄 메시지를 전면에 둔다."
    ],
    "planningDirection": [
      "summary를 브랜드 메시지 중심으로 재정렬한다.",
      "sticky와 price는 정보량을 줄이고 핵심 CTA만 남긴다."
    ],
    "designDirection": [
      "대형 이미지와 짧은 헤드라인 중심의 다크톤 PDP로 정리한다."
    ],
    "priority": [
      {
        "rank": 1,
        "target": "summary",
        "reason": "메시지 전달의 시작점"
      },
      {
        "rank": 2,
        "target": "gallery",
        "reason": "프리미엄 인상을 만드는 핵심"
      }
    ],
    "guardrails": [
      "사실 기반 가격/스펙 정보는 유지",
      "할인몰형 카피 톤 금지"
    ],
    "builderBrief": {
      "objective": "프리미엄 브랜드 감도 강화",
      "mustKeep": [
        "기존 PDP 기본 정보 구조",
        "주요 CTA 동선"
      ],
      "mustChange": [
        "summary 메시지 톤",
        "gallery 첫 화면 인상",
        "price/benefit 우선순위"
      ],
      "suggestedFocusSlots": ["gallery", "summary", "price", "sticky"]
    }
  },
  "systemContext": {
    "slotRegistry": {
      "pageId": "pdp-tv-premium",
      "slots": [
        { "slotId": "gallery", "activeSourceId": "captured-pdp-gallery-v1" },
        { "slotId": "summary", "activeSourceId": "custom-pdp-summary-v1" },
        { "slotId": "price", "activeSourceId": "captured-pdp-price-v1" }
      ]
    },
    "editableComponents": [
      {
        "componentId": "pdp-tv-premium.summary",
        "slotId": "summary",
        "patchSchema": {
          "rootKeys": ["title", "subtitle", "badge"],
          "styleKeys": ["color", "backgroundColor"]
        }
      },
      {
        "componentId": "pdp-tv-premium.price",
        "slotId": "price",
        "patchSchema": {
          "rootKeys": ["title", "subtitle"],
          "styleKeys": ["color"]
        }
      }
    ],
    "patchSchemaMap": {
      "pdp-tv-premium.summary": {
        "rootKeys": ["title", "subtitle", "badge"],
        "styleKeys": ["color", "backgroundColor"]
      }
    },
    "currentPatches": [
      {
        "componentId": "pdp-tv-premium.summary",
        "sourceId": "custom-pdp-summary-v1",
        "patch": {
          "title": "기존 저장된 프리미엄 타이틀"
        }
      }
    ],
    "designToolContext": {
      "availableTools": [
        "slot_source_switch",
        "component_patch",
        "reference_capture_summary"
      ]
    }
  },
  "generationOptions": {
    "intensity": "balanced",
    "createNewVersion": true,
    "versionLabelHint": "premium-dark-v1"
  }
}
```

필수 필드:

1. `pageContext.workspacePageId`
2. `approvedPlan`
3. `systemContext.slotRegistry`
4. `systemContext.editableComponents`

생성 강도 권장값:

1. `conservative`
2. `balanced`
3. `bold`

---

## 6. Builder 출력 스키마

Builder 출력은 `계획 기반 실행 결과`여야 한다.

```json
{
  "summary": "summary와 gallery 중심으로 프리미엄 톤 시안을 생성했습니다.",
  "buildResult": {
    "proposedVersionLabel": "pdp-tv-premium_premium-dark-v1",
    "changedTargets": [
      {
        "slotId": "summary",
        "componentId": "pdp-tv-premium.summary",
        "changeType": "component_patch"
      },
      {
        "slotId": "gallery",
        "componentId": "pdp-tv-premium.gallery",
        "changeType": "source_switch"
      }
    ],
    "operations": [
      {
        "action": "update_slot_text",
        "pageId": "pdp-tv-premium",
        "slotId": "summary",
        "field": "title",
        "value": "공간을 압도하는 OLED의 깊이"
      }
    ],
    "report": {
      "whatChanged": [
        "summary headline tone을 프리미엄 중심으로 조정",
        "gallery 첫 인상 소스를 더 감도 높은 방향으로 전환"
      ],
      "whyChanged": [
        "Planner의 초프리미엄 방향과 할인 억제 가드레일을 반영"
      ],
      "assumptions": [
        "실제 가격/스펙 데이터는 유지"
      ],
      "guardrailCheck": [
        {
          "rule": "fact_preservation",
          "status": "pass"
        }
      ]
    }
  }
}
```

Builder 출력 필수 필드:

1. `summary`
2. `buildResult.proposedVersionLabel`
3. `buildResult.changedTargets`
4. `buildResult.operations`
5. `buildResult.report`

원칙:

1. `operations`는 현재 `llm.js`가 사용하는 structured operation 포맷과 최대한 호환되게 유지한다.
2. 저장 전 단계에서는 `draft result`로 볼 수 있다.
3. 저장이 완료되면 별도 `versionId`가 부여된다.

---

## 7. API 분리안

현재는 `POST /api/llm/change` 하나로 끝나지만, 목표 구조는 아래처럼 나누는 것이다.

### 7.1 Planner API

`POST /api/llm/plan`

request:

```json
{
  "mode": "hybrid",
  "pageId": "pdp-tv-premium",
  "viewportProfile": "pc",
  "requestText": "프리미엄 톤 강화",
  "keyMessage": "초프리미엄",
  "preferredDirection": "정제된 다크톤",
  "avoidDirection": "할인몰 느낌",
  "toneAndMood": "브랜드 감도 중심",
  "referenceUrls": [
    "https://reference.example.invalid/lg-signature-oled"
  ]
}
```

response:

```json
{
  "summary": "요구사항 정리 완료",
  "planId": "plan_01",
  "requirementPlan": {
    "title": "PDP - TV 프리미엄형 초프리미엄 시안",
    "requestSummary": [
      "혜택 문구는 최소화하고 프리미엄 메시지를 강화한다."
    ],
    "planningDirection": [
      "summary와 gallery를 우선 강화한다."
    ],
    "designDirection": [
      "다크톤, 큰 이미지, 짧은 카피 중심으로 구성한다."
    ],
    "priority": [
      {
        "rank": 1,
        "target": "summary",
        "reason": "첫 메시지 전달 영역"
      }
    ],
    "guardrails": [
      "사실 정보 임의 변경 금지"
    ],
    "builderBrief": {
      "objective": "프리미엄 브랜드 감도 강화",
      "mustKeep": ["제품 기본 정보 구조"],
      "mustChange": ["summary 카피 톤"],
      "suggestedFocusSlots": ["summary", "gallery"]
    }
  }
}
```

### 7.2 Builder API

`POST /api/llm/build`

request:

```json
{
  "pageId": "pdp-tv-premium",
  "viewportProfile": "pc",
  "planId": "plan_01",
  "approvedPlan": {
    "title": "PDP - TV 프리미엄형 초프리미엄 시안",
    "requestSummary": [
      "혜택 문구 최소화"
    ],
    "planningDirection": [
      "summary와 gallery 중심 재구성"
    ],
    "designDirection": [
      "프리미엄 다크톤"
    ],
    "priority": [
      {
        "rank": 1,
        "target": "summary",
        "reason": "메시지 중심"
      }
    ],
    "guardrails": [
      "스펙/가격 사실 유지"
    ],
    "builderBrief": {
      "objective": "브랜드 감도 강화",
      "mustKeep": ["기존 CTA 구조"],
      "mustChange": ["summary 카피", "gallery 인상"],
      "suggestedFocusSlots": ["summary", "gallery", "price"]
    }
  },
  "intensity": "balanced",
  "versionLabelHint": "premium-dark-v1"
}
```

response:

```json
{
  "summary": "시안 생성 완료",
  "draftBuildId": "build_01",
  "buildResult": {
    "proposedVersionLabel": "pdp-tv-premium_premium-dark-v1",
    "changedTargets": [
      {
        "slotId": "summary",
        "componentId": "pdp-tv-premium.summary",
        "changeType": "component_patch"
      }
    ],
    "operations": [
      {
        "action": "update_slot_text",
        "pageId": "pdp-tv-premium",
        "slotId": "summary",
        "field": "title",
        "value": "공간을 압도하는 OLED의 깊이"
      }
    ],
    "report": {
      "whatChanged": [
        "summary 타이틀을 프리미엄 중심으로 재작성"
      ],
      "whyChanged": [
        "Planner의 프리미엄 방향과 guardrail 반영"
      ],
      "assumptions": [
        "가격/스펙은 유지"
      ]
    }
  }
}
```

### 7.3 Version Save API

`POST /api/workspace/version-save`

request:

```json
{
  "pageId": "pdp-tv-premium",
  "planId": "plan_01",
  "draftBuildId": "build_01",
  "versionLabel": "pdp-tv-premium_premium-dark-v1"
}
```

response:

```json
{
  "ok": true,
  "versionId": "ver_01",
  "versionLabel": "pdp-tv-premium_premium-dark-v1"
}
```

### 7.4 View Pin API

`POST /api/workspace/view-pin`

request:

```json
{
  "pageId": "pdp-tv-premium",
  "versionId": "ver_01"
}
```

response:

```json
{
  "ok": true,
  "pageId": "pdp-tv-premium",
  "pinnedVersionId": "ver_01"
}
```

---

## 8. 저장 구조 초안

현재 `workspace.workHistory`는 `summary + recordedAt` 수준이다.

시안 워크벤치로 가려면 아래 저장 구조가 추가로 필요하다.

### 8.1 requirement plans

```json
{
  "id": "plan_01",
  "pageId": "pdp-tv-premium",
  "viewportProfile": "pc",
  "mode": "hybrid",
  "status": "draft",
  "input": {
    "requestText": "프리미엄 톤 강화",
    "referenceUrls": [
      "https://reference.example.invalid/lg-signature-oled"
    ]
  },
  "output": {
    "title": "PDP - TV 프리미엄형 초프리미엄 시안",
    "priorityTargets": ["summary", "gallery", "price"]
  },
  "createdAt": "2026-04-13T12:00:00.000Z",
  "updatedAt": "2026-04-13T12:05:00.000Z"
}
```

### 8.2 draft builds

```json
{
  "id": "build_01",
  "pageId": "pdp-tv-premium",
  "viewportProfile": "pc",
  "planId": "plan_01",
  "status": "draft",
  "operations": [
    {
      "action": "update_slot_text",
      "pageId": "pdp-tv-premium",
      "slotId": "summary",
      "field": "title",
      "value": "공간을 압도하는 OLED의 깊이"
    }
  ],
  "report": {
    "whatChanged": [
      "summary headline 조정"
    ],
    "whyChanged": [
      "프리미엄 메시지 강화"
    ]
  },
  "snapshotData": {
    "changedComponentIds": ["pdp-tv-premium.summary"],
    "previewUrl": "/clone-product?pageId=pdp-tv-premium&viewportProfile=pc"
  },
  "createdAt": "2026-04-13T12:10:00.000Z"
}
```

### 8.3 saved versions

```json
{
  "id": "ver_01",
  "pageId": "pdp-tv-premium",
  "viewportProfile": "pc",
  "versionLabel": "pdp-tv-premium_premium-dark-v1",
  "planId": "plan_01",
  "buildId": "build_01",
  "summary": "초프리미엄 다크톤 시안",
  "snapshotData": {
    "changedComponentIds": ["pdp-tv-premium.summary", "pdp-tv-premium.gallery"],
    "previewUrl": "/clone-product?pageId=pdp-tv-premium&viewportProfile=pc"
  },
  "createdAt": "2026-04-13T12:12:00.000Z",
  "createdBy": "user_x"
}
```

### 8.4 pinned view map

```json
{
  "pageId": "pdp-tv-premium",
  "versionId": "ver_01",
  "pinnedAt": "2026-04-13T12:13:00.000Z"
}
```

---

## 9. admin 화면 연결 기준

### 9.1 요구사항 정리 섹션

버튼:

1. `AI로 요구사항 정리`
2. `정리본 저장`
3. `정리본 다시 불러오기`

상태:

1. `작성 중`
2. `정리 완료`
3. `사용자 수정됨`
4. `Builder 실행 가능`

### 9.2 시안 생성 섹션

버튼:

1. `AI로 시안 만들기`
2. `다른 안으로 다시 생성`
3. `새 버전 저장`
4. `현재 View로 고정`

상태:

1. `정리본 필요`
2. `생성 중`
3. `임시 생성 완료`
4. `버전 저장 완료`
5. `현재 View`

### 9.3 시안 버전 이력

이력 항목은 최소 아래를 포함한다.

1. `versionLabel`
2. `summary`
3. `createdAt`
4. `plan title`
5. `현재 View` 여부

---

## 10. 현재 코드와의 연결 전략

현재 구현:

1. `POST /api/llm/change`
2. `llm.js` 단일 프롬프트
3. 응답 구조:
   - `summary`
   - `operations`
4. 즉시 workspace 저장

권장 전환 순서:

1. 1단계
   - 기존 `/api/llm/change`는 유지
   - 내부적으로 `Builder`의 최소 버전으로 간주
2. 2단계
   - `POST /api/llm/plan` 추가
   - Planner 결과 저장 구조 추가
3. 3단계
   - `POST /api/llm/build` 추가
   - Builder가 승인된 Planner 결과를 받도록 전환
4. 4단계
   - `version-save`, `view-pin` 추가
   - clone은 pinned version만 노출
5. 5단계
   - 기존 `/api/llm/change`는 내부 호환용 또는 관리자용 fallback으로 축소

---

## 11. Planner / Builder 도구 세트

Planner와 Builder는 같은 LLM 계열을 쓸 수 있어도, 실제로 붙는 도구 세트는 분리해서 본다.

### 11.1 Planner 1차 필수 도구

아래 항목은 후순위가 아니라 Planner 품질을 결정하는 핵심 도구 세트다.

1. `Reference URL Fetch`
   - 사용자가 입력한 외부 URL을 직접 읽는다.
2. `Browser Render`
   - HTML 원문이 아니라 실제 렌더된 결과를 기준으로 본다.
3. `Reference Capture`
   - 전체/주요 영역 스크린샷과 viewport별 캡처를 만든다.
4. `Structure Extractor`
   - hero, card, CTA, summary, product area 등 주요 구조를 추출한다.
5. `Reference Summarizer`
   - 레퍼런스의 핵심 특징과 가져올 요소를 요약한다.
6. `Slot Matcher`
   - 레퍼런스 구조를 우리 slot/component 체계에 대응한다.
7. `Guardrail Checker`
   - 허용 범위 밖의 해석이나 금지된 변경 방향을 차단한다.

### 11.2 Builder 1차 필수 도구

1. `Slot Registry Reader`
2. `Editable Component Inventory`
3. `Patch Schema Validator`
4. `Patch Apply`
5. `Preview Render`
6. `Version Save`
7. `View Pin`

### 11.3 후순위 도구

이 항목들은 있으면 좋지만, 1차 필수 도구 세트가 먼저다.

1. `External Search`
   - 사용자가 레퍼런스 탐색 자체를 요청한 경우
2. `Multi-reference Compare`
3. `Design Token Recommender`
4. `Motion Suggestion`

### 11.4 권한 정책

도구 권한도 역할에 맞춰 나눈다.

1. `Reference Access`
   - 사용자가 직접 제공한 URL만 열람 가능
2. `Search Access`
   - 명시적으로 레퍼런스 탐색이 필요할 때만 허용
3. `Build Access`
   - 내부 slot/patch/version/view pin만 수행

---

## 12. 구현 체크리스트

1. `PLANNER_MODEL`, `BUILDER_MODEL` 환경변수 추가
2. Planner system prompt / user prompt 분리
3. Builder system prompt / user prompt 분리
4. requirement plan 저장 구조 추가
5. draft build 저장 구조 추가
6. saved version / pinned view 저장 구조 추가
7. admin UI에 Planner 편집 폼 추가
8. admin UI에 Builder 실행과 버전 저장 흐름 추가
9. 작업 이력 UI를 `workspace 저장 로그`에서 `버전 이력` 중심으로 전환
10. clone 렌더가 pinned version을 읽도록 연결

---

## 13. 구현 우선순위

현재 기준의 실제 구현 순서는 아래와 같다.

1. `workspace 저장 구조 확장`
   - requirement plans
   - draft builds
   - saved versions
   - pinned view
2. `Planner 핵심 도구 파이프라인`
   - Reference URL Fetch
   - Browser Render
   - Reference Capture
   - Structure Extractor
   - Reference Summarizer
   - Slot Matcher
   - Guardrail Checker
3. `Planner API 구현`
   - `/api/llm/plan`
4. `admin 요구사항 정리 UI 개편`
   - 직접 작성 / 레퍼런스 / 혼합 입력
   - Planner 결과 편집/승인
5. `Builder 핵심 도구 파이프라인`
   - Slot Registry Reader
   - Editable Component Inventory
   - Patch Schema Validator
   - Patch Apply
   - Preview Render
   - Version Save
   - View Pin
6. `Builder API 구현`
   - `/api/llm/build`
7. `admin 시안 생성 / 저장 / View 고정 UI 연결`
8. `시안 버전 이력 구조 개편`
9. `clone 렌더의 pinned view 연결 고도화`
10. `기존 /api/llm/change` 축소 및 호환 정리
11. `고급 탐색/추천 도구`
   - External Search
   - Multi-reference Compare
   - Design Token Recommender
   - Motion Suggestion

---

## 14. 결정 사항

이 문서 기준으로 확정하는 내용은 아래와 같다.

1. Planner와 Builder는 분리한다.
2. Builder는 승인된 Planner 결과를 기준으로 실행한다.
3. 작업 결과는 `draft build -> saved version -> pinned view` 순서로 관리한다.
4. clone 페이지의 최종 노출 기준은 page별 `pinned view`다.
5. Planner 도구 세트는 후순위가 아니라 1차 필수 구현 범위다.
