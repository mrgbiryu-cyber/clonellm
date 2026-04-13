# 현재 산출물

> 문서 상태:
> 이 문서는 초기 수집/정규화 단계의 산출물 스냅샷을 요약한 문서다.
> 여기의 상태 표현은 작성 시점 기준일 수 있으므로, 현재 구현 기준은 `docs/decision-history.md`와 최신 설계 문서를 함께 본다.

## 1. Raw 수집 결과

- `data/raw/sitemaps.json`
- `data/raw/sitemap-summary.json`
- `data/raw/seed-urls.json`
- `data/raw/archive-index.json`
- `data/raw/pages/*.html`
- `data/raw/pages/*.json`

## 2. 정규화 결과

- `data/normalized/site-document.json`
- `data/normalized/component-candidates.json`
- `data/normalized/editable-prototype.json`

## 3. 각 파일 의미

- `site-document.json`
  - 전체 페이지/섹션/자산 구조
- `component-candidates.json`
  - 페이지별 컴포넌트 후보와 분류 이유
- `editable-prototype.json`
  - 편집 UI에서 바로 다루기 쉬운 축약 버전

## 4. 스냅샷 기준 확인 상태

- 홈, 카테고리, 구독, 고객지원, 브랜드, 베스트샵 대표 페이지 12건 아카이브 완료
- 자산 메타데이터 기준 222개 연결 완료
- 로컬 자산 다운로드 진행 가능
- 제한 경로는 당시 placeholder 정책으로 처리 가능하도록 정리됨
- Playwright 기반 상태 수집은 환경 이슈로 보류 중
