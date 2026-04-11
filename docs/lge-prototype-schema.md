# LG전자 쇼핑몰 프로토타입 공통 스키마 초안

## 1. 목적

LG전자 쇼핑몰의 URL 분석 결과와 향후 Figma Page 변경안을 동일한 구조로 다루기 위한 공통 스키마 초안입니다.

## 2. 상위 구조

```ts
type SiteDocument = {
  siteId: string;
  source: "crawl";
  pages: PageSpec[];
  components: ComponentSpec[];
  componentInstances: ComponentInstanceSpec[];
  assets: AssetSpec[];
};
```

## 3. 페이지 구조

```ts
type PageSpec = {
  id: string;
  url: string;
  crawlStatus: "captured" | "restricted" | "placeholder";
  pageGroup:
    | "home"
    | "category"
    | "product-detail"
    | "care-solution"
    | "brand"
    | "support"
    | "bestshop";
  title: string;
  sections: SectionSpec[];
  overlays?: OverlaySpec[];
  responsive: ResponsiveSpec;
};
```

## 4. 섹션 구조

```ts
type SectionSpec = {
  id: string;
  name: string;
  componentType: string;
  instanceId: string;
  visible: boolean;
  order: number;
  props: Record<string, unknown>;
  assetIds?: string[];
  interactions?: InteractionSpec[];
};
```

## 5. 컴포넌트 레지스트리

```ts
type ComponentSpec = {
  type: string;
  category:
    | "layout"
    | "navigation"
    | "commerce"
    | "content"
    | "support"
    | "promotion";
  editableProps: string[];
  variants?: string[];
};
```

예상 초기 컴포넌트 타입:

- `global-header`
- `global-footer`
- `hero-banner`
- `promo-carousel`
- `category-nav`
- `product-card-grid`
- `product-summary`
- `price-benefit-panel`
- `filter-sort-bar`
- `review-highlight`
- `cta-banner`
- `support-shortcuts`
- `modal-popup`
- `overlay-banner`
- `restricted-page-placeholder`

## 6. 컴포넌트 인스턴스

```ts
type ComponentInstanceSpec = {
  id: string;
  type: string;
  sourcePageId: string;
  props: Record<string, unknown>;
  variant?: string;
  visible: boolean;
  sourceState?: "default" | "popup-open" | "dropdown-open" | "tab-selected";
};
```

## 7. 자산 구조

```ts
type AssetSpec = {
  id: string;
  kind: "image" | "icon" | "background" | "video-poster";
  sourceUrl: string;
  localPath?: string;
  sourcePageId: string;
};
```

## 8. 오버레이 구조

```ts
type OverlaySpec = {
  id: string;
  kind: "modal" | "popup" | "drawer" | "tooltip";
  triggerSource?: string;
  componentType: string;
  props: Record<string, unknown>;
  assetIds?: string[];
};
```

## 9. 인터랙션 구조

```ts
type InteractionSpec = {
  trigger:
    | "click"
    | "change"
    | "toggle"
    | "select"
    | "slide";
  action:
    | "navigate"
    | "open-modal"
    | "open-popup"
    | "toggle-visibility"
    | "update-value"
    | "replace-section";
  targetId?: string;
  payload?: Record<string, unknown>;
};
```

## 10. 반응형 구조

```ts
type ResponsiveSpec = {
  desktop: LayoutSpec;
  mobile: LayoutSpec;
};

type LayoutSpec = {
  columns?: number;
  direction?: "row" | "column";
  stack?: boolean;
  hiddenSections?: string[];
};
```

## 11. 향후 변경 입력 연결 방식

- 텍스트 변경 요청: 기존 `PageSpec.sections`에 대한 추가/삭제/교체 계획 생성
- Figma Page 변경 요청: 신규 `SectionSpec` 또는 `ComponentSpec` 후보 생성
- 최종 반영: `ComponentInstanceSpec` 추가 또는 수정

## 12. 수집 정책 반영 항목

1. 페이지는 기본 상태뿐 아니라 팝업/모달 상태까지 별도 저장한다.
2. 이미지와 배너는 원본 리소스를 가능한 한 보존하여 `AssetSpec`으로 저장한다.
3. 크롤링 제한 페이지는 `restricted-page-placeholder` 컴포넌트로 처리한다.
4. 향후 편집기는 페이지 섹션과 오버레이를 모두 수정 대상으로 다룬다.

## 13. 핵심 원칙

1. URL 분석 결과와 Figma 변경안은 동일 스키마로 수렴한다.
2. 페이지는 섹션의 조합으로만 표현한다.
3. 반복 사용 가능한 블록은 모두 컴포넌트 타입으로 승격한다.
4. 변경은 전체 재생성이 아니라 인스턴스 수준 수정으로 처리한다.
