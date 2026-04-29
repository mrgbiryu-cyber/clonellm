# Recipe Workbench Notes

## 이 공간의 목적

이 폴더는 `home hero / quickmenu`를 시작으로, 이후 `ranking / banner / commerce / story / benefit / service-tabs / page-shell`까지 전체 family 레시피를 수집·보강하는 작업자가 공통으로 보는 입력 공간이다.

레시피 작업자는 아래 순서로 source를 본다.

1. `design-md-index.json`
2. `reference-url-index.json`
3. 현재 clone 원본 / whole-page context
4. 기존 recipe library

## 사용 규칙

1. `DESIGN.md` 계열은 `tone / type / spacing / component rule`을 읽기 위한 source다.
2. 실무 reference URL은 `구조 / hierarchy / rhythm / utility pattern`을 읽기 위한 source다.
3. showcase 사이트는 mood 참고용이고, practical source보다 우선하지 않는다.
4. 레시피는 `완성 템플릿`이 아니라 `구조적 출발점`으로 저장한다.
5. 상위 레시피는 `manual render ceiling`을 먼저 본다. 수동 렌더에서 위계가 안 서면 후보에서 제외한다.
6. 색상/그림자만 바꾸는 레시피는 품질 레시피로 인정하지 않는다.
7. 각 레시피는 반드시 `lead/support 관계`, `scan path`, `asset expectation`, `avoid`를 가져야 한다.

## 레시피 보강 시 기록 권장 항목

- `referenceIds`
- `sourceUrls`
- `pageRole`
- `tone`
- `layoutPattern`
- `hierarchyRule`
- `assetExpectation`
- `avoid`

## 상위 레시피 작성 원칙

1. `top recipes first`
   - family별로 먼저 2~3개의 상위 레시피를 만든 뒤, 나머지 long-tail variant를 채운다.
2. `quality before count`
   - 목표 수량보다 먼저 `첫 시선 위계`, `section role 명확성`, `page rhythm 기여도`를 본다.
3. `structure before surface`
   - 카드 수, lead 비율, 레일 구조, CTA 위치가 먼저고 tone은 그 다음이다.
4. `family continuity`
   - hero는 quickmenu와, quickmenu는 top-stage cluster와, page-shell은 전체 section 흐름과 이어져야 한다.
5. `compare trigger awareness`
   - 상위 레시피를 넣어도 품질이 안 오르면 경로 보강이 아니라 renderer surface 판정으로 넘어간다.

## 현재 우선 대상

1. `hero`
   - headline dominance
   - visual focal point
   - CTA staging
   - surface tone clarity
2. `quickmenu`
   - lead/support hierarchy
   - scanable rhythm
   - icon/container consistency
   - card density

## 전체 family 확장 대상

다음 family도 같은 방식으로 계속 확장한다.

1. `ranking`
2. `banner`
3. `commerce`
4. `story`
5. `benefit`
6. `service-tabs`
7. `page-shell`

각 family는 `family-recipe-plan.json`의 우선순위와 목표 수량을 기준으로 보강한다.
상위 레시피의 구체 설계는 `family-top-recipe-blueprints.json`을 기준으로 잡는다.

## 비고

- 현재 `getdesign-wise`, `getdesign-ferrari`는 이미 recipe library에서 적극 사용 중이다.
- 이후 새로운 `DESIGN.md` 파일이나 reference URL이 생기면, 먼저 이 폴더 인덱스에 추가하고 레시피 작업에 들어가는 것을 원칙으로 한다.
