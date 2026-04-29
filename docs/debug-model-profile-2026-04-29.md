# Debug Model Profile (2026-04-29)

## 목적

고객여정 flow, 컨셉서 저장, Flow 저장/승인, 여정 빌드 배선이 아직 안정화되지 않은 상태에서 고급 모델을 반복 호출하지 않도록 테스트용 저가 모델 프로필을 사용한다.

## 현재 테스트 모델

- `OPENROUTER_MODEL=anthropic/claude-haiku-4.5`
- `PLANNER_MODEL=anthropic/claude-haiku-4.5`
- `BUILDER_MODEL=anthropic/claude-haiku-4.5`
- `COMPOSER_MODEL=anthropic/claude-haiku-4.5`
- `FIXER_MODEL=anthropic/claude-haiku-4.5`
- `CRITIC_MODEL=anthropic/claude-haiku-4.5`

Fallback도 같은 저가 모델로 고정한다. 디버깅 중 fallback이 pro/sonnet 계열로 넘어가면서 비용이 커지는 것을 막기 위해서다.

## 복구 대상 모델

구조 디버깅 완료 후 품질 생성/최종 비교 단계에서 아래처럼 복구한다.

```env
OPENROUTER_MODEL=anthropic/claude-sonnet-4.6
PLANNER_MODEL=anthropic/claude-sonnet-4.6
BUILDER_MODEL=anthropic/claude-sonnet-4.6
COMPOSER_MODEL=anthropic/claude-sonnet-4.6
FIXER_MODEL=anthropic/claude-sonnet-4.6
CRITIC_MODEL=anthropic/claude-sonnet-4.6
```

## 복구 조건

- `care-solutions/mo`에서 `care-subscription` 요구사항 저장이 정상 반영된다.
- 컨셉서 생성 후 plan의 `input.userInput.journeyId`와 `journeyFlow.journeyId`가 일치한다.
- Flow에 현재 페이지 `care-solutions`가 포함된다.
- Flow 저장 후 `/api/journey-flows` record가 최신 planId를 바라본다.
- 여정 빌드 시작 전 dry-run 또는 검수 리포트가 `READY`를 반환한다.

## 검수 명령

```bash
npm run report:journey-flow -- --limit 3
curl -sS http://127.0.0.1:3000/api/llm/status
```
