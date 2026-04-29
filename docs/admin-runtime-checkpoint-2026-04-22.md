# Runtime Checkpoint (2026-04-22)

## 목적

이 문서는 현재까지의 디자인 런타임 작업 상태를 한 번에 복원할 수 있도록,
히스토리 요약, 핵심 문서 링크, 스크린샷, 롤백 자료를 묶어 둔 체크포인트 인덱스다.

기준 git HEAD:

- `37b643f`

현재 핵심 plan / build:

- `planId`: `d43b47c4-87c3-405b-a303-69b60c1b7777`
- `stable build`: `runtime-draft-1776875630802`
- `latest verified build`: `runtime-draft-1776875630802`

## 현재 상태 요약

- `design-runtime-v1` 경로가 본선이다.
- `after` / section preview / compare 모두 Tailwind 환경에서 렌더된다.
- `hero`는 잘못된 작은 라벨 이미지를 배경으로 쓰지 않도록 asset-role policy가 적용됐다.
- `quickmenu`는 promo 썸네일 재사용 대신 `icon family` 구조로 옮기는 중이다.
- `designChangeLevel`은 실제 Author 출력 범위에 반영되며, `medium = stable` 기준선이다.

## 핵심 문서

아키텍처 / 계약:

- [Design Authoring Architecture](./admin-design-authoring-architecture-2026-04-21.md)
- [Markdown-First Authoring Flow](./admin-markdown-first-authoring-flow-2026-04-22.md)
- [Runtime Renderer Contract](./admin-runtime-renderer-contract-2026-04-21.md)
- [Concept Package Minimal Schema](./admin-concept-package-minimal-schema-2026-04-21.md)
- [Authored Section HTML Package Minimal Schema](./admin-authored-section-html-package-minimal-schema-2026-04-21.md)

디버깅 / 검증 방법:

- [Preservation / Interference Debug Method](./admin-preservation-interference-debug-method-2026-04-22.md)
- [Preservation / Interference Audit Checklist](./admin-preservation-interference-audit-checklist-2026-04-22.md)
- [Autonomous TODO](./admin-autonomous-todo-2026-04-21.md)

자산 / 정책:

- [Asset Role Inventory](./admin-asset-role-inventory-2026-04-22.md)
- [Asset Spec Schema](./admin-asset-spec-schema-2026-04-22.md)
- [Home Top Asset Spec](./admin-home-top-asset-spec-2026-04-22.md)
- [Asset Role Policy Rollout](./admin-asset-role-policy-rollout-2026-04-22.md)
- [Quickmenu Icon Family Spec](./admin-quickmenu-icon-family-spec-2026-04-22.md)
- [Quickmenu Icon Generation Contract](./admin-quickmenu-icon-generation-contract-2026-04-22.md)

항상 먼저 볼 가드레일:

- [Design Runtime Guardrails (2026-04-22)](./admin-design-runtime-guardrails-2026-04-22.md)

## 스크린샷 스냅샷

스냅샷 폴더:

- [2026-04-22-design-runtime-checkpoint](./snapshots/2026-04-22-design-runtime-checkpoint)

주요 화면:

- [admin_home.png](./snapshots/2026-04-22-design-runtime-checkpoint/admin_home.png)
- [admin_current_actual.png](./snapshots/2026-04-22-design-runtime-checkpoint/admin_current_actual.png)
- [runtime_section_preview.png](./snapshots/2026-04-22-design-runtime-checkpoint/runtime_section_preview.png)
- [runtime_preview_after_tailwind.png](./snapshots/2026-04-22-design-runtime-checkpoint/runtime_preview_after_tailwind.png)
- [runtime_full_after.png](./snapshots/2026-04-22-design-runtime-checkpoint/runtime_full_after.png)
- [runtime_compare.png](./snapshots/2026-04-22-design-runtime-checkpoint/runtime_compare.png)
- [runtime_compare_after_tailwind.png](./snapshots/2026-04-22-design-runtime-checkpoint/runtime_compare_after_tailwind.png)

## 롤백 자료

이 체크포인트에는 아래 자료가 같이 저장되어 있다.

- [checkpoint-head.txt](./snapshots/2026-04-22-design-runtime-checkpoint/checkpoint-head.txt)
- [checkpoint-git-status.txt](./snapshots/2026-04-22-design-runtime-checkpoint/checkpoint-git-status.txt)
- [checkpoint-git-diff-stat.txt](./snapshots/2026-04-22-design-runtime-checkpoint/checkpoint-git-diff-stat.txt)
- [checkpoint-working-tree.patch](./snapshots/2026-04-22-design-runtime-checkpoint/checkpoint-working-tree.patch)
- [checkpoint-untracked-files.txt](./snapshots/2026-04-22-design-runtime-checkpoint/checkpoint-untracked-files.txt)
- [checkpoint-untracked-files.tar.gz](./snapshots/2026-04-22-design-runtime-checkpoint/checkpoint-untracked-files.tar.gz)

## 복원 방법

현재 저장 방식은 `commit/tag`가 아니라 `HEAD + working tree patch + untracked archive` 기준이다.

1. 저장된 기준 commit으로 새 복원 브랜치를 만든다.

```bash
git checkout -b restore-2026-04-22 37b643f
```

2. tracked 변경을 패치로 복원한다.

```bash
git apply --index docs/snapshots/2026-04-22-design-runtime-checkpoint/checkpoint-working-tree.patch
```

3. untracked 파일을 아카이브에서 복원한다.

```bash
tar -xzf docs/snapshots/2026-04-22-design-runtime-checkpoint/checkpoint-untracked-files.tar.gz
```

4. 필요하면 스냅샷 문서를 기준으로 관련 설계 문서와 화면 캡처를 다시 확인한다.

## 비고

- 이 체크포인트는 현재 작업 상태를 보존하기 위한 문서/패치 묶음이다.
- 이후 별도 정리 시점에 commit을 새로 남기더라도, 이 문서는 중간 상태 복원 인덱스로 유지한다.
