# Runtime Audit Triage

Date: `2026-04-12`

기준 문서:

1. [runtime-visual-audit-2026-04-12.md](/mnt/c/users/mrgbi/lge-site-analysis/docs/runtime-visual-audit-2026-04-12.md)
2. [project-consolidated-status.md](/mnt/c/users/mrgbi/lge-site-analysis/docs/project-consolidated-status.md)
3. 현재 로컬 runtime 응답

이 문서는 `runtime audit`가 현재 진행 중인 visual/acceptance 흐름과 어디서 만나고, 어디서 분리되는지 정리한다.

## 1. 결론

`runtime audit`는 무시하면 안 된다. 다만 현재 진행 중인 `visual acceptance`와는 별도 축이다.

정리:

1. visual track
   - home lower
   - PLP visual
   - acceptance
2. runtime track
   - `/api/data`
   - `/api/clone-page`
   - `/clone-content/*`
   - preview/admin/runtime summary 정합성

즉 둘은 충돌 관계가 아니라 병렬 점검 축이다.

## 2. 현재 audit 항목 판정

### 2.1 `editable-prototype.json`이 사실상 `home`만 가진다

판정: **아직 유효**

현재 실제 상태:

1. `data/normalized/editable-prototype.json`
2. `pages.length === 1`
3. page id는 `home`만 존재

의미:

1. `/api/clone-page`
2. `/api/data`
3. preview/editor의 metadata 계층

은 여전히 single-page data model에 더 가깝다.

이건 visual 이슈가 아니라 runtime data coverage 이슈다.

### 2.2 `/api/clone-page`가 대부분 `page_not_found`

판정: **아직 유효**

현재 응답:

1. `home` → `200`
2. `support` → `404 page_not_found`
3. `bestshop` → `404 page_not_found`
4. `care-solutions` → `404 page_not_found`
5. `category-tvs` → `404 page_not_found`
6. `category-refrigerators` → `404 page_not_found`

의미:

metadata API는 여전히 home 중심이다.

### 2.3 `/clone-content/*`는 일부 page family가 실제로 동작한다

판정: **부분만 유효**

현재 응답:

1. `/clone-content/home` → `200`
2. `/clone-content/support` → `200`
3. `/clone-content/bestshop` → `200`
4. `/clone-content/care-solutions` → `200`
5. `/clone-content/category-tvs` → `200`
6. `/clone-content/category-refrigerators` → `200`
7. `/clone-content/lg-signature-info` → `200`
8. `/clone-content/objet-collection-story` → `200`

즉 service/PLP clone-content뿐 아니라 info page 계열도 현재 지원된다.

### 2.4 `runtimePageSummary`가 실제 지원 범위를 과장한다

판정: **초기에는 유효했지만 현재는 해소**

현재 `/api/data`의 `runtimePageSummary`는:

1. `corePages = ["home","support","bestshop","care-solutions"]`
2. `infoPages = ["lg-signature-info","objet-collection-story"]`
3. `plpPages = ["category-tvs","category-refrigerators"]`
4. `routeCatalog`는 실제 clone-content 지원 범위를 기준으로 계산된다

이전 문제:

1. `support/bestshop/care-solutions`는 실제 clone-content가 되는데 summary core에 빠져 있었다
2. `lg-signature-info/objet-collection-story`는 summary에 나오지만 실제 clone-content는 `404`였다

현재 상태:

1. summary와 실제 runtime route는 이제 일치한다
2. 남은 핵심은 `/api/clone-page` metadata 계층이 여전히 home 중심이라는 점이다

### 2.5 `web/clone.html`이 section `visible`을 무시한다

판정: **유효, 즉시 수정 가능**

현재 코드에서는:

1. `page.sections`
2. `sort(...)`
3. `map(renderSectionBlock)`

만 하고 `visible !== false` 필터가 없었다.

이건 metadata clone page 관점의 명확한 UI bug다.

이번 턴에 수정:

1. hidden section은 `web/clone.html`에서 렌더하지 않게 변경

## 3. visual 진행 방향과 충돌하는가

판정: **직접 충돌하지 않는다**

이유:

1. 현재 visual acceptance는 대부분 `/clone-content/*`와 compare artifact 기준으로 진행한다
2. runtime audit는 `/api/data`, `/api/clone-page`, preview/admin metadata 계층을 본다

따라서:

1. home lower visual tuning
2. PLP visual acceptance

는 그대로 진행 가능하다.

다만 아래는 parallel로 정리해야 한다.

1. metadata API 정합성
2. runtime summary 정확도
3. info page route 지원 여부

## 4. 지금 바로 참고할 가치가 큰 항목

### 바로 반영해야 하는 것

1. `web/clone.html` visible filter
2. `/api/clone-page`와 runtime multi-page metadata의 불일치

### visual 흐름에는 참고만 하면 되는 것

1. `editable-prototype.json` single-page 상태
2. `/api/clone-page` home-only 상태

이 둘은 acceptance를 막는 문제라기보다, 이후 runtime 정합성 작업 범위를 정해준다.

## 5. 계획 점검 결과

### 유지할 계획

1. `space-renewal` 원인 점검 및 width fix
2. home lower acceptance
3. PLP acceptance

### 추가할 계획

1. runtime track A
   - `web/clone.html` visible filter
   - `runtimePageSummary` 정합성 보정
2. runtime track B
   - `/api/clone-page` 다중 페이지 metadata 확대 또는
   - 지원 범위를 문서/API에서 더 명시적으로 축소
3. info page 계열
   - 실제 지원할지
   - summary/link 정책에서 제외할지

## 6. 권장 우선순위

1. visual track 유지
   - `space-renewal`
   - acceptance
2. runtime track의 저위험 수정 즉시 반영
   - `web/clone.html`
3. runtime summary / clone metadata 계층은 별도 배치로 정리

## 7. 최종 판단

`runtime audit`는 현재 방향을 뒤집는 문서가 아니다.

대신:

1. visual 진행은 유지
2. runtime 정합성은 별도 축으로 병렬 처리

가 맞다.

즉 이 문서는 “우리가 잘못 가고 있다”가 아니라,
“visual 외에 runtime 정합성 부채가 아직 남아 있다”는 신호로 받아들이면 된다.
