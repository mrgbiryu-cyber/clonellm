# First Runtime Slice (2026-04-22)

## 목적

이 문서는 새 본선으로 실제 한 번 서빙할 첫 구현 slice의 범위를 고정한다.

핵심은 하나다.

`첫 slice의 목표는 많은 페이지를 커버하는 것이 아니라, Authored Section HTML Package가 Runtime Renderer를 통해 실제 before/after와 draft 저장까지 닫히는 최소 경로를 만드는 것이다.`

상위 기준 문서:

- [Implementation Readiness](./admin-implementation-readiness-2026-04-22.md)
- [Current Code Conflict Audit](./admin-current-code-conflict-audit-2026-04-22.md)
- [Runtime Renderer Contract](./admin-runtime-renderer-contract-2026-04-21.md)
- [Authored Section HTML Package Minimal Schema](./admin-authored-section-html-package-minimal-schema-2026-04-21.md)

---

## 1. 첫 slice 정의

첫 slice는 아래 다섯 개가 한 번 연결되는 경로다.

1. `Authored Section HTML Package` 입력
2. `referencePageShell` 확보
3. boundary 안 삽입
4. before/after 생성
5. draft 저장

여기서 중요한 건:

- 첫 slice는 디자인 생성기 전체 구현이 아니다
- 첫 slice는 새 runtime delivery 경로 구현이다

---

## 2. 첫 slice 범위

### 2.1 포함

- authored html package 입력 어댑터
- shell html 로딩
- boundary 안의 section 교체
- asset placeholder 치환
- sanitize
- before/after html 생성
- draft 저장

### 2.2 제외

- 15개 페이지 전체 대응
- page type별 세부 분기
- 기존 inject/reinject 함수 재사용 확장
- legacy patch/componentComposition 생성
- critic/recovery 루프

---

## 3. 첫 slice의 성공 조건

아래가 성립하면 첫 slice는 성공이다.

1. authored html package만으로 after html이 생성된다
2. runtime이 html을 다시 쓰지 않는다
3. asset placeholder가 실제 URL 또는 현재 자산으로 치환된다
4. before/after를 compare용으로 저장/참조할 수 있다
5. legacy patch/template/family가 정본으로 쓰이지 않는다

---

## 4. 첫 slice의 비목표

아래는 첫 slice에서 일부러 하지 않는다.

- 가장 예쁜 시안을 만드는 것
- 모든 page type을 동시에 닫는 것
- 기존 clone 조립 로직을 개선하는 것
- 기존 draft store 전체를 교체하는 것

즉 첫 slice는 `quality-maximization`이 아니라 `new-mainline-proof`다.

---

## 5. 최소 구현 구조

```text
Authored Section HTML Package
  -> Runtime Input Adapter
  -> Reference Page Shell Loader
  -> Boundary Resolver
  -> HTML Inserter
  -> Asset Placeholder Resolver
  -> Sanitizer
  -> Before/After Builder
  -> Draft Save Adapter
```

주의:

- 이 경로에 `operations`
- `componentComposition`
- `template/family/preset`
- `patch merge`

가 끼면 첫 slice 목적이 흐려진다.

---

## 6. draft 저장 원칙

첫 slice의 draft 저장은 아래 원칙을 따른다.

1. 정본은 `Authored Section HTML Package`
2. before/after 참조가 같이 저장돼야 한다
3. legacy store adapter가 필요하더라도 정본을 훼손하지 않는다
4. runtime이 html을 다시 조합한 결과를 정본처럼 저장하지 않는다

---

## 7. compare 원칙

첫 slice의 compare는 단순해야 한다.

- before: 원본 shell 기준
- after: authored html 적용 결과

비교 화면은:

- 구조 결정기 아님
- runtime 분기기 아님
- retry 조건 생성기 아님

오직 확인 채널이다.

---

## 8. 첫 slice 이후에만 열릴 것

첫 slice가 닫힌 뒤에만 다음을 연다.

- visual verifier 연결
- design author retry 1회
- page type 확장
- multi-group authoring

---

## 9. 한 줄 기준

`첫 runtime slice는 legacy patch/template 경로를 더 똑똑하게 만드는 구현이 아니라, Authored Section HTML Package가 그대로 서빙되는 첫 본선 증명이다.`
