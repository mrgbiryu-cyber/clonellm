# Recipe Workbench Inputs

이 폴더는 `hero / quickmenu / ranking / banner / commerce / story / benefit / service-tabs / page-shell` 전반의 레시피 수집·보강 작업용 입력 공간이다.

목적:

- 서브 에이전트가 레시피를 추가/보강할 때 참조할 입력을 한 곳에 모은다
- `DESIGN.md` 계열 자산과 실제 reference URL을 분리된 형태로 제공한다
- 레시피 작업자는 이 폴더만 보고도 source를 파악할 수 있게 한다

구성:

- [design-md-index.json](/home/mrgbiryu/clonellm/data/recipe-workbench/design-md-index.json)
  - 로컬/원격 `DESIGN.md` 계열 자산 인덱스
- [reference-url-index.json](/home/mrgbiryu/clonellm/data/recipe-workbench/reference-url-index.json)
  - 실제 레퍼런스 URL 인덱스
- [family-recipe-plan.json](/home/mrgbiryu/clonellm/data/recipe-workbench/family-recipe-plan.json)
  - family별 목표 수량, 우선순위, 상위 레시피 후보, 품질 게이트 포인트
- [family-top-recipe-blueprints.json](/home/mrgbiryu/clonellm/data/recipe-workbench/family-top-recipe-blueprints.json)
  - family별 상위 레시피 blueprint와 품질 목적, 구조 규칙, 회피 항목
- [reference-workbench-notes.md](/home/mrgbiryu/clonellm/data/recipe-workbench/reference-workbench-notes.md)
  - 사용 규칙과 주의사항

원칙:

1. 여기 있는 reference는 `직접 복제용`이 아니라 `recipe 수집용`이다.
2. 레시피는 완성 HTML 저장소가 아니라 `구조적 출발점`이어야 한다.
3. reference는 page role / tone / pattern / hierarchy 관점으로 분해해서 읽는다.
4. 새 레시피를 추가할 때는 가능한 한 `referenceIds` 또는 `sourceUrls`를 남긴다.
5. 서브 에이전트는 family 단위로 독립적으로 작업할 수 있어야 한다.
6. `hero + quickmenu`만이 아니라 이후 family 전반으로 바로 확장 가능한 형태로 정리한다.
7. 수량을 채우기 전에 `상위 레시피(top recipes)`를 먼저 작성하고 수동 렌더 상한선을 확인한다.
8. 레시피는 색/장식 변경이 아니라 `위계 / 리듬 / page role`을 실제로 개선해야 한다.
9. 구조적 우위가 없는 filler recipe는 추가하지 않는다.
