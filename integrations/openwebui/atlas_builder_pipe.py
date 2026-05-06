"""
title: CNS Atlas
author: clonellm
version: 0.2.0
required_open_webui_version: 0.9.2
"""

import json
import os
import re
import asyncio
import hashlib
import threading
import time
import uuid
from typing import Any, Dict, Generator, List
from urllib.parse import urlsplit

import requests
from pydantic import BaseModel, Field


BUILD_INTENT_RE = re.compile(
    r"(빌드\s*(를|을)?\s*(해줘|시작|실행|해|진행)|build\s*(now|it|this)|이대로\s*빌드|draft\s*build)",
    re.IGNORECASE,
)
CONCEPT_INTENT_RE = re.compile(
    r"(컨셉서\s*(작성|생성|만들|써)|작성해줘|생성해줘|만들어줘|이대로\s*(작성|진행)|진행해줘|좋아\s*진행)",
    re.IGNORECASE,
)


class Pipe:
    class Valves(BaseModel):
        openrouter_api_key: str = Field(default="")
        openrouter_model: str = Field(default="anthropic/claude-sonnet-4.6")
        normal_chat_model: str = Field(default="openai/gpt-5.4-mini")
        concept_provider: str = Field(default="openrouter")
        builder_base_url: str = Field(default="http://127.0.0.1:3100")
        builder_public_url: str = Field(default="http://34.27.99.82:3000")
        builder_service_token: str = Field(default="dev-openwebui-builder-token")
        design_author_model: str = Field(default="anthropic/claude-sonnet-4.6")
        draft_author_provider: str = Field(default="openrouter")
        poll_timeout_seconds: int = Field(default=1800)
        poll_interval_seconds: float = Field(default=2.0)
        poll_request_timeout_seconds: int = Field(default=60)
        poll_max_transient_errors: int = Field(default=30)
        data_dir: str = Field(default="/home/mrgbiryu/open-webui-data")
        default_project_id: str = Field(default="lge-openwebui-project")
        temperature: float = Field(default=0.45)
        max_tokens: int = Field(default=12000)
        normal_chat_max_tokens: int = Field(default=4096)

    def __init__(self) -> None:
        self.valves = self.Valves()

    def pipe(
        self,
        body: Dict[str, Any],
        __metadata__: Any = None,
        __chat_id__: str = None,
        __message_id__: str = None,
        __user__: Any = None,
        __event_emitter__: Any = None,
    ) -> Generator[str, None, None]:
        messages = body.get("messages") if isinstance(body, dict) else []
        messages = messages if isinstance(messages, list) else []
        context = self._context_from_metadata(__metadata__, __chat_id__, __message_id__, __user__)
        latest_user = self._latest_user_text(messages)
        task_response = self._openwebui_task_response(latest_user, messages)
        if task_response:
            yield task_response
            return
        if self._looks_like_atlas_exit(latest_user):
            yield "아틀라스 모드를 종료했습니다. 일반 대화는 그대로 이어가고, 새 빌더 작업은 `#아틀라스`로 다시 시작하세요."
            return
        if not self._is_atlas_mode_active(messages):
            yield from self._stream_normal_chat(body, messages)
            return
        requirement_text = self._collect_requirement_text(messages)
        target = self._resolve_target(requirement_text)

        if self._looks_like_build_intent(latest_user):
            yield from self._run_draft_build_from_latest_concept(context, __event_emitter__)
            return

        if target.get("missing"):
            yield self._requirement_state_message(target, ready=False)
            return

        if not self._looks_like_concept_intent(latest_user):
            yield self._requirement_state_message(target, ready=True)
            return

        yield self._concept_intro_message(target)
        yield from self._stream_concept(requirement_text, target, context)

    def _latest_user_text(self, messages: List[Dict[str, Any]]) -> str:
        for message in reversed(messages):
            if isinstance(message, dict) and str(message.get("role") or "").lower() == "user":
                return self._message_to_text(message.get("content"))
        return ""

    def _collect_requirement_text(self, messages: List[Dict[str, Any]]) -> str:
        chunks: List[str] = []
        atlas_started = False
        last_state: Dict[str, str] = {}
        latest_user = self._latest_user_text(messages)
        for message in messages:
            if not isinstance(message, dict):
                continue
            role = str(message.get("role") or "").lower()
            text = self._message_to_text(message.get("content"))
            if role == "user" and self._contains_atlas_trigger(text):
                atlas_started = True
                chunks = []
                text = self._strip_atlas_trigger(text)
            if role == "assistant":
                state = self._parse_requirement_table(text)
                if state:
                    last_state = self._merge_requirement_state(last_state, state)
                    if atlas_started:
                        chunks.append(self._state_to_requirement_text(last_state))
                continue
            if not atlas_started and not last_state:
                continue
            if role == "user":
                if self._is_openwebui_task_prompt(text):
                    continue
                if self._looks_like_build_intent(text) or self._looks_like_concept_intent(text):
                    continue
                if text.strip():
                    chunks.append(text.strip())
        if self._looks_like_concept_intent(latest_user) and last_state:
            return self._state_to_requirement_text(last_state)
        if last_state and latest_user and not self._looks_like_build_intent(latest_user) and not self._looks_like_concept_intent(latest_user):
            latest_clean = self._strip_atlas_trigger(latest_user)
            if latest_clean and latest_clean not in self._state_to_requirement_text(last_state):
                return "\n".join([self._state_to_requirement_text(last_state), latest_clean]).strip()
            return self._state_to_requirement_text(last_state)
        if chunks:
            return "\n".join(chunks).strip()
        return self._strip_atlas_trigger(self._latest_user_text(messages))

    def _contains_atlas_trigger(self, text: str) -> bool:
        return bool(re.search(r"#\s*(아틀라스|atlas)", str(text or ""), re.IGNORECASE))

    def _strip_atlas_trigger(self, text: str) -> str:
        return re.sub(r"#\s*(아틀라스|atlas)", "", str(text or ""), flags=re.IGNORECASE).strip()

    def _looks_like_atlas_exit(self, text: str) -> bool:
        return bool(re.search(r"#\s*(종료|일반대화|exit|normal)", str(text or ""), re.IGNORECASE))

    def _is_atlas_mode_active(self, messages: List[Dict[str, Any]]) -> bool:
        active = False
        for message in messages if isinstance(messages, list) else []:
            if not isinstance(message, dict):
                continue
            if str(message.get("role") or "").lower() != "user":
                continue
            text = self._message_to_text(message.get("content"))
            if self._looks_like_atlas_exit(text):
                active = False
                continue
            if self._contains_atlas_trigger(text):
                active = True
        return active

    def _message_to_text(self, value: Any) -> str:
        if isinstance(value, str):
            return value
        if isinstance(value, list):
            parts: List[str] = []
            for item in value:
                if isinstance(item, dict):
                    text = item.get("text") or item.get("content")
                    if isinstance(text, str):
                        parts.append(text)
            return "\n".join(parts)
        return str(value or "")

    def _parse_requirement_table(self, text: str) -> Dict[str, str]:
        state: Dict[str, str] = {}
        for raw_line in str(text or "").splitlines():
            line = raw_line.strip()
            if not (line.startswith("|") and line.endswith("|")):
                continue
            cells = [cell.strip() for cell in line.strip("|").split("|")]
            if len(cells) < 2 or cells[0] in {"---", "필수 항목", "항목"}:
                continue
            key = cells[0]
            value = cells[1]
            if key in {"화면", "viewport", "범위", "요청"} and value and value != "미정":
                state[key] = value
        return state

    def _merge_requirement_state(self, current: Dict[str, str], update: Dict[str, str]) -> Dict[str, str]:
        merged = dict(current or {})
        for key, value in (update or {}).items():
            text = str(value or "").strip()
            if not text or text == "미정":
                continue
            if key == "요청" and merged.get(key):
                previous = str(merged.get(key) or "").strip()
                if text != previous and text not in previous and previous not in text:
                    merged[key] = f"{previous}\n{text}"
                else:
                    merged[key] = previous if len(previous) >= len(text) else text
            else:
                merged[key] = text
        return merged

    def _state_to_requirement_text(self, state: Dict[str, str]) -> str:
        return ", ".join(
            item
            for item in [
                state.get("화면", ""),
                state.get("viewport", ""),
                state.get("범위", ""),
                state.get("요청", ""),
            ]
            if item
        )

    def _resolve_target(self, text: str) -> Dict[str, Any]:
        value = str(text or "")
        target: Dict[str, Any] = {
            "projectId": self.valves.default_project_id,
            "screen": "",
            "pageId": "",
            "viewport": "",
            "viewportProfile": "",
            "scope": "",
            "targetScope": "",
            "targetGroupId": "",
            "targetGroupLabel": "",
            "slots": [],
            "componentIds": [],
            "designChangeLevel": self._change_level_from_text(value),
            "request": self._compact(value, 1400),
            "missing": [],
        }

        if re.search(r"(메인|홈|home|lge\.co\.kr|첫\s*화면)", value, re.IGNORECASE):
            target.update({"screen": "lge.co.kr 메인", "pageId": "home"})
        elif re.search(r"(냉장고).*(카테고리|plp)", value, re.IGNORECASE):
            target.update({"screen": "냉장고 카테고리", "pageId": "category-refrigerators"})
        elif re.search(r"(tv|티비|텔레비전).*(카테고리|plp)", value, re.IGNORECASE):
            target.update({"screen": "TV 카테고리", "pageId": "category-tvs"})

        if re.search(r"(모바일|mobile|\bmo\b)", value, re.IGNORECASE):
            target.update({"viewport": "모바일", "viewportProfile": "mo"})
        elif re.search(r"(\bpc\b|데스크탑|desktop|웹)", value, re.IGNORECASE):
            target.update({"viewport": "PC", "viewportProfile": "pc"})

        if re.search(r"(전체|전면|페이지\s*전체|전체\s*페이지|메인\s*전체)", value, re.IGNORECASE):
            target.update(
                {
                    "scope": "전체 페이지",
                    "targetScope": "page",
                    "targetGroupId": f"{target.get('pageId') or 'home'}-all",
                    "targetGroupLabel": "전체 페이지",
                }
            )
        elif re.search(r"(첫\s*화면|상단|히어로|hero|퀵메뉴|quick|바로가기)", value, re.IGNORECASE):
            slots = ["hero"]
            if re.search(r"(퀵메뉴|quick|바로가기)", value, re.IGNORECASE):
                slots.append("quickmenu")
            page_id = target.get("pageId") or "home"
            target.update(
                {
                    "scope": "상단 영역",
                    "targetScope": "components",
                    "targetGroupId": "home-top",
                    "targetGroupLabel": "메인 상단",
                    "slots": slots,
                    "componentIds": [f"{page_id}.{slot}" for slot in slots],
                }
            )

        if not target["pageId"]:
            target["missing"].append("화면")
        if not target["viewportProfile"]:
            target["missing"].append("viewport")
        if not target["targetScope"]:
            target["missing"].append("범위")
        if len(re.sub(r"\s+", "", value)) < 12:
            target["missing"].append("요청")
        return target

    def _requirement_state_message(self, target: Dict[str, Any], ready: bool) -> str:
        missing = ", ".join(dict.fromkeys(target.get("missing") or [])) if target.get("missing") else "없음"
        confirm = (
            "\n이 요구사항으로 컨셉서를 작성할 수 있습니다. 수정할 내용이 있으면 이어서 말하고, "
            "진행하려면 `컨셉서 작성해줘`라고 입력하세요."
            if ready
            else "\n부족한 값을 자연어로 이어서 말해 주세요. 예: `모바일, 메인 전체, 럭셔리 톤으로 타이포와 레이아웃 개선`"
        )
        return (
            "요구사항을 정리했습니다.\n\n"
            "| 필수 항목 | 값 |\n"
            "| --- | --- |\n"
            f"| 상태 | {'ready_for_concept' if ready else 'collecting'} |\n"
            f"| 화면 | {target.get('screen') or '미정'} |\n"
            f"| viewport | {target.get('viewport') or '미정'} |\n"
            f"| 범위 | {target.get('scope') or '미정'} |\n"
            f"| 요청 | {target.get('request') or '미정'} |\n"
            f"| 부족한 필수값 | {missing} |\n"
            "| 확인 필요 | 없음 |\n\n"
            "추가로 반영할 수 있는 요구사항 예: 변경 강도, 유지할 요소, 금지할 방향, 참고 레퍼런스.\n"
            f"{confirm}"
        )

    def _concept_intro_message(self, target: Dict[str, Any]) -> str:
        provider = self._concept_provider()
        model_label = "테스트 작성기" if provider == "local" else self.valves.openrouter_model
        return (
            "컨셉서를 작성합니다.\n\n"
            f"- 작성 모델: {model_label}\n"
            f"- 대상: {target.get('screen')} / {target.get('viewport')}\n"
            f"- 범위: {target.get('scope')}\n\n"
            "---\n\n"
        )

    def _stream_concept(self, request_text: str, target: Dict[str, Any], context: Dict[str, str]) -> Generator[str, None, None]:
        if self._concept_provider() == "local":
            yield from self._stream_local_concept(request_text, target, context)
            return
        yield from self._stream_openrouter_concept(request_text, target, context)

    def _stream_local_concept(self, request_text: str, target: Dict[str, Any], context: Dict[str, str]) -> Generator[str, None, None]:
        concept = (
            f"## {target.get('screen')} {target.get('viewport')} — 검토용 컨셉서\n\n"
            "### 이 페이지가 해야 하는 일\n\n"
            f"{target.get('screen')}은 사용자가 처음 마주하는 브랜드 경험의 기준점입니다. "
            f"이번 요청은 `{target.get('request')}`를 중심으로 화면의 인상과 탐색 흐름을 정돈하는 작업입니다.\n\n"
            "### 왜 바꾸는가\n\n"
            "현재 화면의 기능적 구조는 유지하되, 타이포그래피와 레이아웃의 리듬을 조정하면 더 정제된 브랜드 인상을 줄 수 있습니다.\n\n"
            "### 무엇을 지키고 무엇을 바꾸는가\n\n"
            "- LG 아이덴티티와 공식 사이트로서의 신뢰감은 유지합니다.\n"
            "- 상품명, 가격, 스펙 같은 사실 정보는 임의로 바꾸지 않습니다.\n"
            "- 사용자가 요청한 톤과 범위 안에서 시각 위계와 여백을 개선합니다.\n\n"
            "### 주요 구간별 개선 방향\n\n"
            f"- 대상 범위: {target.get('scope')}\n"
            "- 카피, 여백, 카드 밀도, CTA의 위계를 정리합니다.\n"
            "- 모바일에서는 1열 흐름과 터치 가능한 간격을 우선합니다.\n\n"
            "### 고객에게 주는 가치\n\n"
            "사용자는 같은 정보를 보더라도 더 차분하고 프리미엄한 브랜드 경험으로 받아들이게 됩니다.\n"
        )
        for chunk in self._chunk_text(concept, 90):
            yield chunk
            time.sleep(0.01)
        concept_document = self._concept_document(concept, target, concept_model="local-test-concept-writer")
        concept_ref = self._store_concept_document(concept_document, target, request_text, context)
        if concept_ref:
            yield "\n\n---\n\n컨셉서 원문을 저장했습니다. 빌드하려면 `빌드해줘`라고 말하세요."

    def _stream_openrouter_concept(self, request_text: str, target: Dict[str, Any], context: Dict[str, str]) -> Generator[str, None, None]:
        api_key = self.valves.openrouter_api_key or os.environ.get("OPENROUTER_API_KEY", "")
        if not api_key:
            yield "OpenRouter API key가 설정되지 않아 컨셉서를 작성할 수 없습니다."
            return

        streamed_parts: List[str] = []
        payload = {
            "model": self.valves.openrouter_model,
            "stream": True,
            "temperature": self.valves.temperature,
            "max_tokens": self.valves.max_tokens,
            "messages": [
                {"role": "system", "content": self._system_prompt()},
                {"role": "user", "content": self._user_prompt(request_text, target)},
            ],
        }
        try:
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://34.27.99.82:3000",
                    "X-Title": "CNS Atlas OpenWebUI Pipe",
                },
                json=payload,
                stream=True,
                timeout=(20, 600),
            )
            response.raise_for_status()
            response.encoding = "utf-8"
            for raw_line in response.iter_lines(decode_unicode=False):
                if not raw_line:
                    continue
                line = raw_line.decode("utf-8", errors="replace").strip()
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                except Exception:
                    continue
                delta = ((chunk.get("choices") or [{}])[0].get("delta") or {}).get("content")
                text = self._delta_to_text(delta)
                if text:
                    streamed_parts.append(text)
                    yield text
        except Exception as exc:
            yield f"\n\n컨셉서 작성 중 오류가 발생했습니다: {exc}\n"
            return

        concept_markdown = "".join(streamed_parts).strip()
        if not concept_markdown:
            return
        concept_document = self._concept_document(concept_markdown, target, concept_model=self.valves.openrouter_model)
        concept_ref = self._store_concept_document(concept_document, target, request_text, context)
        if concept_ref:
            yield "\n\n---\n\n컨셉서 원문을 저장했습니다. 빌드하려면 `빌드해줘`라고 말하세요."

    def _stream_normal_chat(self, body: Dict[str, Any], messages: List[Dict[str, Any]]) -> Generator[str, None, None]:
        api_key = self.valves.openrouter_api_key or os.environ.get("OPENROUTER_API_KEY", "")
        if not api_key:
            yield "OpenRouter API key가 설정되지 않았습니다. 아틀라스 빌더 작업은 `#아틀라스`로 시작하세요."
            return

        normalized_messages = [
            message
            for message in (messages if isinstance(messages, list) else [])
            if isinstance(message, dict) and not self._is_openwebui_task_prompt(self._message_to_text(message.get("content")))
        ]
        payload = {
            "model": self._normal_chat_model(),
            "stream": True,
            "temperature": self.valves.temperature,
            "max_tokens": self._normal_chat_max_tokens(),
            "messages": normalized_messages or [{"role": "user", "content": self._latest_user_text(messages)}],
        }
        try:
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": (self.valves.builder_public_url or "http://34.27.99.82:3000"),
                    "X-Title": "CNS Atlas OpenWebUI Pipe",
                },
                json=payload,
                stream=True,
                timeout=(20, 600),
            )
            response.raise_for_status()
            response.encoding = "utf-8"
            for raw_line in response.iter_lines(decode_unicode=False):
                if not raw_line:
                    continue
                line = raw_line.decode("utf-8", errors="replace").strip()
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                except Exception:
                    continue
                delta = ((chunk.get("choices") or [{}])[0].get("delta") or {}).get("content")
                text = self._delta_to_text(delta)
                if text:
                    yield text
        except Exception as exc:
            yield f"\n일반 대화 처리 중 오류가 발생했습니다: {type(exc).__name__}: {exc}"

    def _system_prompt(self) -> str:
        return (
            "당신은 CNS Atlas의 LGE 디지털 경험 컨셉서 작성 모델이다. "
            "사용자의 요구사항을 바탕으로 LGE 공식 사이트 개선 컨셉서를 한국어 Markdown으로 직접 작성한다. "
            "답변은 작업 로그나 상담 안내가 아니라 사용자가 바로 검토할 수 있는 완성도 높은 컨셉서 본문이어야 한다. "
            "고급 UX/브랜드 디자이너처럼 문제 정의, 방향성, 시각 시스템, 화면 흐름, 보존 조건, 기대 효과를 설득력 있게 전개한다. "
            "형식은 자유롭게 구성하되 읽기 쉬운 제목, 표, 목록, 짧은 문단을 사용하고, 필요한 경우 디자인 키워드나 팔레트는 표로 정리한다. "
            "YAML, JSON, 코드블록, 내부 ID, Builder API 설명, 진행 로그, 클릭 안내는 노출하지 않는다. "
            "사용자가 제공하지 않은 날짜, 연도, 버전명, 캠페인명은 임의로 만들지 않는다. "
            "필수 원칙은 최소한으로만 적용한다: LG 아이덴티티 보존, 사실 기반 상품/가격/스펙 임의 변경 금지, 공식 사이트의 신뢰감 유지. "
            "나머지는 과도하게 제한하지 말고 사용자의 의도에 맞춰 풍부하게 제안한다."
        )

    def _user_prompt(self, request_text: str, target: Dict[str, Any]) -> str:
        return (
            "아래 요구사항으로 검토용 컨셉서를 작성해 주세요.\n"
            "이 문서는 이후 빌드의 원문 기준이 되므로, 요약본이 아니라 충분히 구체적인 제안서로 작성해 주세요.\n\n"
            f"- 대상 화면: {target.get('screen')}\n"
            f"- viewport: {target.get('viewport')}\n"
            f"- 범위: {target.get('scope')}\n"
            f"- 변경 강도: {target.get('designChangeLevel')}\n"
            f"- 원 요구사항: {request_text}\n\n"
            "권장 방향:\n"
            "- 첫 화면에서 사용자가 어떤 브랜드 인상을 받아야 하는지 선명하게 정의하세요.\n"
            "- 왜 이 개선이 필요한지, 현재 경험의 약점과 개선 후 기대 경험을 설명하세요.\n"
            "- 타이포그래피, 여백, 레이아웃, 이미지/배경, CTA, 섹션 리듬을 구체적으로 제안하세요.\n"
            "- 페이지 전체 범위라면 상단, 커머스/탐색, 브랜드/에디토리얼, 서비스/정보 구간을 자연스럽게 나눠 설명하세요.\n"
            "- LG 아이덴티티와 공식 사이트 신뢰감을 유지하면서도 사용자가 요청한 톤을 어떻게 구현할지 적으세요.\n"
            "- 컨셉서는 자유로운 Markdown 문서로 작성하세요. 고정 양식을 기계적으로 채우지 마세요."
        )

    def _concept_document(self, concept_markdown: str, target: Dict[str, Any], concept_model: str) -> str:
        frontmatter = {
            "atlasMode": True,
            "builderReady": False,
            "status": "review",
            "conceptJobId": self._new_concept_job_id(),
            "projectId": target.get("projectId") or self.valves.default_project_id,
            "pageId": target.get("pageId"),
            "viewportProfile": target.get("viewportProfile"),
            "targetScope": target.get("targetScope"),
            "targetGroupId": target.get("targetGroupId"),
            "targetGroupLabel": target.get("targetGroupLabel"),
            "slots": target.get("slots") or [],
            "componentIds": target.get("componentIds") or [],
            "designChangeLevel": target.get("designChangeLevel") or "medium",
            "interventionLayer": "page" if target.get("targetScope") == "page" else "section-group",
            "patchDepth": target.get("designChangeLevel") or "medium",
            "rendererSurface": "tailwind",
            "builderProvider": self._draft_author_provider(),
            "plannerProvider": "openrouter",
            "conceptAuthorModel": concept_model,
        }
        lines = ["---"]
        for key, value in frontmatter.items():
            if isinstance(value, bool):
                rendered = "true" if value else "false"
            elif isinstance(value, list):
                rendered = json.dumps(value, ensure_ascii=False)
            else:
                rendered = json.dumps(value, ensure_ascii=False)
            lines.append(f"{key}: {rendered}")
        lines.extend(["---", "", concept_markdown.strip(), ""])
        return "\n".join(lines)

    def _new_concept_job_id(self) -> str:
        return f"builder-concept-job-{int(time.time() * 1000)}-{uuid.uuid4().hex[:8]}"

    def _store_concept_document(
        self,
        concept_document: str,
        target: Dict[str, Any],
        request_text: str,
        context: Dict[str, str],
    ) -> str:
        try:
            concept_id = f"acd-{uuid.uuid4().hex}"
            storage_dir = os.path.join(self.valves.data_dir or "/home/mrgbiryu/open-webui-data", "atlas-concepts")
            os.makedirs(storage_dir, exist_ok=True)
            path = os.path.join(storage_dir, f"{concept_id}.md")
            with open(path, "w", encoding="utf-8") as handle:
                handle.write(concept_document)
            frontmatter, _ = self._split_frontmatter(concept_document)
            concept_job_id = self._string_setting(frontmatter, "conceptJobId", "concept_job_id", default="")
            record = {
                "type": "concept_document",
                "conceptId": concept_id,
                "conceptJobId": concept_job_id,
                "createdAt": int(time.time()),
                "chatId": context.get("chatId") or "",
                "messageId": context.get("messageId") or "",
                "userId": context.get("userId") or "",
                "screen": target.get("screen") or "",
                "viewport": target.get("viewport") or "",
                "scope": target.get("scope") or "",
                "request": self._compact(request_text, 1200),
                "pageId": target.get("pageId") or "",
                "viewportProfile": target.get("viewportProfile") or "",
                "targetScope": target.get("targetScope") or "",
                "targetGroupId": target.get("targetGroupId") or "",
                "source": "cns_atlas_pipe",
            }
            prebuild_registration = self._register_concept_prebuild(concept_document, {**record, "conceptId": concept_id}, context)
            if prebuild_registration:
                record["prebuildRegistration"] = {
                    "ok": bool(prebuild_registration.get("ok")),
                    "jobId": prebuild_registration.get("jobId") or concept_job_id,
                    "status": prebuild_registration.get("status") or "",
                    "error": prebuild_registration.get("error") or "",
                }
            self._append_concept_index(storage_dir, record)
            return concept_id
        except Exception:
            return ""

    def _append_concept_index(self, storage_dir: str, record: Dict[str, Any]) -> None:
        try:
            path = os.path.join(storage_dir, "index.jsonl")
            with open(path, "a", encoding="utf-8") as handle:
                handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
        except Exception:
            pass

    def _register_concept_prebuild(self, concept_document: str, concept_record: Dict[str, Any], context: Dict[str, str]) -> Dict[str, Any]:
        try:
            payload = self._build_draft_payload(concept_document, concept_record)
            headers = self._builder_headers(context, payload.get("externalProjectId"))
            preflight = self._preflight_draft(payload, headers)
            if not preflight.get("ok") or preflight.get("route") != "build":
                return {
                    "ok": False,
                    "error": str(preflight.get("reasonCode") or "concept_register_preflight_blocked"),
                }
            self._apply_preflight_buildable(payload, preflight)
            response = requests.post(
                f"{self.valves.builder_base_url.rstrip('/')}/api/builder/lge/v1/concept-register",
                json=payload,
                headers=headers,
                timeout=30,
            )
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict):
                return {"ok": False, "error": "invalid_concept_register_response"}
            job_id = str(data.get("jobId") or payload.get("conceptJobId") or "").strip()
            if job_id:
                self._append_concept_job_record(job_id, context, str(concept_record.get("conceptId") or ""), self._payload_hash(payload), data)
            return data
        except Exception as exc:
            return {"ok": False, "error": f"{type(exc).__name__}: {exc}"}

    def _run_draft_build_from_latest_concept(self, context: Dict[str, str], event_emitter: Any = None) -> Generator[str, None, None]:
        concept = self._load_latest_concept_document(context)
        if not concept:
            yield (
                "아직 이 채팅에서 저장된 컨셉서를 찾지 못했습니다.\n\n"
                "먼저 요구사항을 정리한 뒤 `컨셉서 작성해줘`라고 말해 컨셉서를 생성하세요."
            )
            return

        concept_document = self._mark_concept_document_builder_ready(concept.get("document") or "")
        if not concept_document:
            yield "저장된 컨셉서 원문을 빌드 가능한 형식으로 읽지 못했습니다. 컨셉서를 다시 생성해 주세요."
            return

        try:
            payload = self._build_draft_payload(concept_document, concept)
            headers = self._builder_headers(context, payload.get("externalProjectId"))
            existing = self._latest_pipe_build_event(context, concept)
            if existing and str(existing.get("status") or "").lower() in {"queued", "preflight", "running"}:
                job_id = str(existing.get("jobId") or "").strip()
                yield (
                    "빌드 진행 중\n\n"
                    "이미 이 컨셉서 기준의 빌드가 진행 중입니다. 완료되면 이 메시지에 결과 링크를 표시합니다.\n\n"
                    + (f"- Job: `{job_id}`\n" if job_id else "")
                )
                return

            self._start_background_draft_build(concept, concept_document, payload, headers, context, event_emitter)
            yield (
                "빌드 진행 중\n\n"
                "컨셉서를 기준으로 draft build를 시작했습니다. 이 창의 연결이 끊겨도 backend 작업은 계속 진행됩니다. "
                "완료되면 가능한 경우 이 메시지에 결과 링크를 추가합니다.\n"
            )
        except Exception as exc:
            yield f"빌드 실행 중 오류가 발생했습니다: `{type(exc).__name__}: {exc}`"

    def _start_background_draft_build(
        self,
        concept: Dict[str, Any],
        concept_document: str,
        payload: Dict[str, Any],
        headers: Dict[str, str],
        context: Dict[str, str],
        event_emitter: Any = None,
    ) -> None:
        concept_id = str(concept.get("conceptId") or "").strip()
        payload_hash = self._payload_hash(payload)
        self._append_pipe_build_event(
            {
                "type": "pipe_draft_build",
                "status": "queued",
                "createdAt": int(time.time()),
                "chatId": context.get("chatId") or "",
                "messageId": context.get("messageId") or "",
                "userId": context.get("userId") or "",
                "conceptId": concept_id,
                "payloadHash": payload_hash,
            }
        )

        def runner() -> None:
            job_id = ""
            try:
                self._emit_status_sync(
                    event_emitter,
                    "빌드 가능 여부를 확인하고 있습니다.",
                    done=False,
                    stage="preflight",
                    route="build",
                )
                self._append_pipe_build_event(
                    {
                        "type": "pipe_draft_build",
                        "status": "preflight",
                        "createdAt": int(time.time()),
                        "chatId": context.get("chatId") or "",
                        "messageId": context.get("messageId") or "",
                        "userId": context.get("userId") or "",
                        "conceptId": concept_id,
                        "payloadHash": payload_hash,
                    }
                )
                preflight = self._preflight_draft(payload, headers)
                if not preflight.get("ok") or preflight.get("route") != "build":
                    content = self._preflight_block_message(preflight)
                    self._append_pipe_build_event(
                        {
                            "type": "pipe_draft_build",
                            "status": "blocked",
                            "createdAt": int(time.time()),
                            "chatId": context.get("chatId") or "",
                            "messageId": context.get("messageId") or "",
                            "userId": context.get("userId") or "",
                            "conceptId": concept_id,
                            "payloadHash": payload_hash,
                            "reasonCode": preflight.get("reasonCode") or "",
                        }
                    )
                    self._emit_message_sync(event_emitter, content)
                    self._emit_status_sync(event_emitter, "빌드를 시작하지 않았습니다.", done=True, stage="blocked", route="build")
                    return
                self._apply_preflight_buildable(payload, preflight)

                self._emit_status_sync(event_emitter, "draft build를 시작하고 있습니다.", done=False, stage="queued", route="build")
                created = requests.post(
                    f"{self.valves.builder_base_url.rstrip('/')}/api/builder/lge/v1/draft",
                    json=payload,
                    headers=headers,
                    timeout=30,
                )
                created.raise_for_status()
                job_id = str((created.json() or {}).get("jobId") or "").strip()
                if not job_id:
                    raise RuntimeError("draft jobId missing")
                self._append_draft_job_record(job_id, context, concept_id, payload_hash)
                self._append_pipe_build_event(
                    {
                        "type": "pipe_draft_build",
                        "status": "running",
                        "createdAt": int(time.time()),
                        "chatId": context.get("chatId") or "",
                        "messageId": context.get("messageId") or "",
                        "userId": context.get("userId") or "",
                        "conceptId": concept_id,
                        "payloadHash": payload_hash,
                        "jobId": job_id,
                    }
                )
                self._emit_status_sync(event_emitter, "빌드가 진행 중입니다.", done=False, stage="running", route="build", jobId=job_id)
                final_job = self._poll_draft_job_blocking(job_id, headers, event_emitter)
                status = str(final_job.get("status") or "").lower()
                if status == "done":
                    content = self._draft_done_message(final_job, payload, headers)
                    self._append_pipe_build_event(
                        {
                            "type": "pipe_draft_build",
                            "status": "done",
                            "createdAt": int(time.time()),
                            "chatId": context.get("chatId") or "",
                            "messageId": context.get("messageId") or "",
                            "userId": context.get("userId") or "",
                            "conceptId": concept_id,
                            "payloadHash": payload_hash,
                            "jobId": job_id,
                            "draftBuildId": final_job.get("draftBuildId") or final_job.get("builderRunId") or "",
                        }
                    )
                    self._emit_message_sync(event_emitter, content)
                    self._emit_notification_sync(event_emitter, "빌드가 완료되었습니다.", level="success")
                    self._emit_status_sync(event_emitter, "빌드가 완료되었습니다.", done=True, stage="done", route="build", jobId=job_id)
                    return
                if status == "failed":
                    content = self._draft_failed_message(final_job, job_id)
                    self._append_pipe_build_event(
                        {
                            "type": "pipe_draft_build",
                            "status": "failed",
                            "createdAt": int(time.time()),
                            "chatId": context.get("chatId") or "",
                            "messageId": context.get("messageId") or "",
                            "userId": context.get("userId") or "",
                            "conceptId": concept_id,
                            "payloadHash": payload_hash,
                            "jobId": job_id,
                            "error": final_job.get("error") or final_job.get("detail") or "",
                        }
                    )
                    self._emit_message_sync(event_emitter, content)
                    self._emit_notification_sync(event_emitter, "빌드에 실패했습니다.", level="error")
                    self._emit_status_sync(event_emitter, "빌드에 실패했습니다.", done=True, stage="failed", route="build", jobId=job_id)
                    return
                content = self._draft_timeout_message(job_id)
                self._append_pipe_build_event(
                    {
                        "type": "pipe_draft_build",
                        "status": "timeout",
                        "createdAt": int(time.time()),
                        "chatId": context.get("chatId") or "",
                        "messageId": context.get("messageId") or "",
                        "userId": context.get("userId") or "",
                        "conceptId": concept_id,
                        "payloadHash": payload_hash,
                        "jobId": job_id,
                    }
                )
                self._emit_message_sync(event_emitter, content)
                self._emit_status_sync(event_emitter, "빌드 완료 확인 시간이 초과되었습니다.", done=True, stage="timeout", route="build", jobId=job_id)
            except Exception as exc:
                content = f"\n\n## 빌드 실패\n\n빌드 실행 중 오류가 발생했습니다.\n\n- 원인: `{type(exc).__name__}: {exc}`\n"
                self._append_pipe_build_event(
                    {
                        "type": "pipe_draft_build",
                        "status": "failed",
                        "createdAt": int(time.time()),
                        "chatId": context.get("chatId") or "",
                        "messageId": context.get("messageId") or "",
                        "userId": context.get("userId") or "",
                        "conceptId": concept_id,
                        "payloadHash": payload_hash,
                        "jobId": job_id,
                        "error": f"{type(exc).__name__}: {exc}",
                    }
                )
                self._emit_message_sync(event_emitter, content)
                self._emit_status_sync(event_emitter, "빌드에 실패했습니다.", done=True, stage="failed", route="build", jobId=job_id)

        thread = threading.Thread(target=runner, name=f"atlas-draft-build-{uuid.uuid4().hex[:8]}", daemon=True)
        thread.start()

    def _load_latest_concept_document(self, context: Dict[str, str]) -> Dict[str, Any]:
        storage_dir = os.path.join(self.valves.data_dir or "/home/mrgbiryu/open-webui-data", "atlas-concepts")
        index_path = os.path.join(storage_dir, "index.jsonl")
        if not os.path.exists(index_path):
            return {}
        chat_id = str((context or {}).get("chatId") or "").strip()
        user_id = str((context or {}).get("userId") or "").strip()
        records: List[Dict[str, Any]] = []
        try:
            with open(index_path, "r", encoding="utf-8") as handle:
                for line in handle:
                    try:
                        record = json.loads(line)
                    except Exception:
                        continue
                    if isinstance(record, dict) and record.get("type") == "concept_document":
                        records.append(record)
        except Exception:
            return {}

        def score(record: Dict[str, Any]) -> int:
            value = int(record.get("createdAt") or 0)
            if chat_id and str(record.get("chatId") or "") == chat_id:
                value += 10_000_000_000
            if user_id and str(record.get("userId") or "") == user_id:
                value += 1_000_000_000
            return value

        for record in sorted(records, key=score, reverse=True):
            concept_id = str(record.get("conceptId") or "").strip()
            if not concept_id:
                continue
            path = os.path.join(storage_dir, f"{concept_id}.md")
            try:
                with open(path, "r", encoding="utf-8") as handle:
                    document = handle.read()
            except Exception:
                continue
            if document.strip():
                result = dict(record)
                result["document"] = document
                return result
        return {}

    def _mark_concept_document_builder_ready(self, document: str) -> str:
        text = str(document or "").strip()
        frontmatter, markdown_body = self._split_frontmatter(text)
        if not frontmatter:
            return ""
        frontmatter["atlasMode"] = True
        frontmatter["builderReady"] = True
        frontmatter["status"] = "build_ready"
        lines = ["---"]
        for key, value in frontmatter.items():
            lines.append(f"{key}: {self._render_yaml_value(value)}")
        lines.extend(["---", "", markdown_body.strip(), ""])
        return "\n".join(lines)

    def _build_draft_payload(self, concept_document: str, concept_record: Dict[str, Any]) -> Dict[str, Any]:
        frontmatter, markdown_body = self._split_frontmatter(concept_document)
        page_id = self._string_setting(frontmatter, "pageId", "page", default=concept_record.get("pageId") or "home")
        viewport_profile = self._viewport_profile(
            self._string_setting(frontmatter, "viewportProfile", "viewport", default=concept_record.get("viewportProfile") or "pc")
        )
        target_scope = self._string_setting(frontmatter, "targetScope", default=concept_record.get("targetScope") or "").strip().lower()
        target_group_id = self._string_setting(frontmatter, "targetGroupId", "groupId", default=concept_record.get("targetGroupId") or "")
        if not target_scope and target_group_id.endswith("-all"):
            target_scope = "page"
        slots = self._list_setting(frontmatter, "slots", "slotIds", "targetSlots")
        if not slots and target_scope != "page":
            slots = ["hero", "quickmenu"]
        component_ids = self._list_setting(frontmatter, "componentIds", "components", "targetComponents")
        if not component_ids and target_scope != "page":
            component_ids = [f"{page_id}.{slot}" for slot in slots]
        if not target_scope:
            target_scope = "components" if component_ids else "page"
        if not target_group_id:
            target_group_id = f"{page_id}-all" if target_scope == "page" else f"{page_id}-top"
        target_group_label = self._string_setting(frontmatter, "targetGroupLabel", "groupLabel", default=concept_record.get("scope") or target_group_id)
        project_id = self._string_setting(frontmatter, "projectId", "externalProjectId", default=self.valves.default_project_id)
        concept_id = self._string_setting(frontmatter, "conceptId", "externalConceptId", default=concept_record.get("conceptId") or f"concept-{uuid.uuid4()}")
        concept_job_id = self._string_setting(frontmatter, "conceptJobId", "concept_job_id", default=concept_record.get("conceptJobId") or "")
        design_change_level = self._string_setting(frontmatter, "designChangeLevel", default="medium")
        title = self._concept_title(frontmatter, markdown_body, concept_document)
        return {
            "builderApiVersion": "v1",
            "externalProjectId": project_id,
            "externalConceptId": concept_id,
            "conceptThreadId": f"ct-{uuid.uuid4()}",
            "conceptJobId": concept_job_id,
            "pageId": page_id,
            "viewportProfile": viewport_profile,
            "conceptDocument": concept_document,
            "conceptPackage": {
                "title": title,
                "targetGroup": {
                    "groupId": target_group_id,
                    "groupLabel": target_group_label,
                    "slotIds": slots,
                    "componentIds": component_ids,
                },
                "designPolicy": {
                    "mustKeep": ["Preserve Tailwind runtime parity", "Preserve LGE asset role guardrails"],
                    "mustChange": ["Improve hierarchy and visual quality based on the selected concept"],
                    "guardrails": [
                        "Do not reuse promo-complete assets as new hero backgrounds",
                        "Quickmenu must keep icon-only family consistency",
                    ],
                },
                "source": {"format": "yaml-frontmatter+markdown", "frontmatter": frontmatter},
            },
            "builderOptions": {
                "rendererSurface": self._string_setting(frontmatter, "rendererSurface", default="tailwind"),
                "designChangeLevel": design_change_level,
                "patchDepth": self._string_setting(frontmatter, "patchDepth", default=design_change_level),
                "interventionLayer": self._string_setting(
                    frontmatter,
                    "interventionLayer",
                    default="page" if target_scope == "page" else "section-group",
                ),
                "targetScope": target_scope,
                "authorProvider": self._draft_author_provider(),
                "authorModel": self._design_author_model(),
                "designAuthorModel": self._design_author_model(),
                "conceptJobId": concept_job_id,
                "bypassDesignModelProfile": True,
            },
        }

    def _builder_headers(self, context: Dict[str, str], project_id: Any = "") -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.valves.builder_service_token}",
            "Content-Type": "application/json",
            "X-OpenWebUI-User-Id": str((context or {}).get("userId") or "openwebui-user"),
            "X-OpenWebUI-Project-Id": str(project_id or self.valves.default_project_id),
            "X-OpenWebUI-Request-Id": f"owui-pipe-build-{uuid.uuid4()}",
        }

    def _preflight_draft(self, payload: Dict[str, Any], headers: Dict[str, str]) -> Dict[str, Any]:
        response = requests.post(
            f"{self.valves.builder_base_url.rstrip('/')}/api/builder/lge/v1/preflight",
            json=payload,
            headers=headers,
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
        return data if isinstance(data, dict) else {"ok": False, "route": "feasibility", "reasonCode": "invalid_preflight"}

    def _apply_preflight_buildable(self, payload: Dict[str, Any], preflight: Dict[str, Any]) -> None:
        buildable = preflight.get("buildable") if isinstance(preflight.get("buildable"), dict) else {}
        slots = buildable.get("slots") if isinstance(buildable.get("slots"), list) else []
        components = buildable.get("componentIds") if isinstance(buildable.get("componentIds"), list) else []
        concept_package = payload.get("conceptPackage") if isinstance(payload.get("conceptPackage"), dict) else {}
        target_group = concept_package.get("targetGroup") if isinstance(concept_package.get("targetGroup"), dict) else {}
        if slots:
            target_group["slotIds"] = [str(item).strip() for item in slots if str(item).strip()]
        if components:
            target_group["componentIds"] = [str(item).strip() for item in components if str(item).strip()]
        concept_package["targetGroup"] = target_group
        payload["conceptPackage"] = concept_package

    def _poll_draft_job(self, job_id: str, headers: Dict[str, str]) -> Generator[str, None, Dict[str, Any]]:
        deadline = time.time() + max(10, int(self.valves.poll_timeout_seconds or 600))
        interval = max(1.0, float(self.valves.poll_interval_seconds or 2.0))
        request_timeout = max(10, int(self.valves.poll_request_timeout_seconds or 60))
        max_transient_errors = max(1, int(self.valves.poll_max_transient_errors or 30))
        last_report = 0.0
        transient_errors = 0
        last_error = ""
        while time.time() < deadline:
            try:
                response = requests.get(
                    f"{self.valves.builder_base_url.rstrip('/')}/api/builder/lge/v1/jobs/{job_id}",
                    headers=headers,
                    timeout=request_timeout,
                )
                response.raise_for_status()
                job = response.json()
                transient_errors = 0
            except Exception as exc:
                transient_errors += 1
                last_error = f"{type(exc).__name__}: {exc}"
                if transient_errors > max_transient_errors and time.time() + request_timeout >= deadline:
                    final_job = self._fetch_draft_job_once(job_id, headers, request_timeout)
                    if str(final_job.get("status") or "").lower() in {"done", "failed"}:
                        return final_job
                    return {"status": "failed", "jobId": job_id, "error": last_error}
                time.sleep(min(interval * transient_errors, 10))
                continue
            if not isinstance(job, dict):
                job = {"status": "running", "jobId": job_id}
            status = str(job.get("status") or "running").lower()
            if status in {"done", "failed"}:
                return job
            now = time.time()
            if now - last_report >= 10:
                yield "빌드가 진행 중입니다. 작업물 생성에는 시간이 걸릴 수 있습니다.\n\n"
                last_report = now
            time.sleep(interval)
        final_job = self._fetch_draft_job_once(job_id, headers, request_timeout)
        if str(final_job.get("status") or "").lower() in {"done", "failed"}:
            return final_job
        return {"status": "timeout", "jobId": job_id, "error": last_error}

    def _poll_draft_job_blocking(self, job_id: str, headers: Dict[str, str], event_emitter: Any = None) -> Dict[str, Any]:
        deadline = time.time() + max(10, int(self.valves.poll_timeout_seconds or 600))
        interval = max(1.0, float(self.valves.poll_interval_seconds or 2.0))
        request_timeout = max(10, int(self.valves.poll_request_timeout_seconds or 60))
        max_transient_errors = max(1, int(self.valves.poll_max_transient_errors or 30))
        last_report = 0.0
        transient_errors = 0
        last_error = ""
        while time.time() < deadline:
            try:
                response = requests.get(
                    f"{self.valves.builder_base_url.rstrip('/')}/api/builder/lge/v1/jobs/{job_id}",
                    headers=headers,
                    timeout=request_timeout,
                )
                response.raise_for_status()
                job = response.json()
                transient_errors = 0
            except Exception as exc:
                transient_errors += 1
                last_error = f"{type(exc).__name__}: {exc}"
                if transient_errors > max_transient_errors and time.time() + request_timeout >= deadline:
                    final_job = self._fetch_draft_job_once(job_id, headers, request_timeout)
                    if str(final_job.get("status") or "").lower() in {"done", "failed"}:
                        return final_job
                    return {"status": "failed", "jobId": job_id, "error": last_error}
                if time.time() - last_report >= 30:
                    self._emit_status_sync(
                        event_emitter,
                        "빌드는 계속 진행 중입니다. 서버 응답이 느려져 완료 상태를 기다리고 있습니다.",
                        done=False,
                        stage="running",
                        route="build",
                        jobId=job_id,
                    )
                    last_report = time.time()
                time.sleep(min(interval * transient_errors, 10))
                continue
            if not isinstance(job, dict):
                job = {"status": "running", "jobId": job_id}
            status = str(job.get("status") or "running").lower()
            if status in {"done", "failed"}:
                return job
            now = time.time()
            if now - last_report >= 10:
                self._emit_status_sync(
                    event_emitter,
                    "빌드가 진행 중입니다. 작업물 생성에는 시간이 걸릴 수 있습니다.",
                    done=False,
                    stage="running",
                    route="build",
                    jobId=job_id,
                )
                last_report = now
            time.sleep(interval)
        final_job = self._fetch_draft_job_once(job_id, headers, request_timeout)
        if str(final_job.get("status") or "").lower() in {"done", "failed"}:
            return final_job
        return {"status": "timeout", "jobId": job_id, "error": last_error}

    def _fetch_draft_job_once(self, job_id: str, headers: Dict[str, str], timeout_seconds: int = 60) -> Dict[str, Any]:
        try:
            response = requests.get(
                f"{self.valves.builder_base_url.rstrip('/')}/api/builder/lge/v1/jobs/{job_id}",
                headers=headers,
                timeout=max(10, int(timeout_seconds or 60)),
            )
            response.raise_for_status()
            data = response.json()
            return data if isinstance(data, dict) else {"status": "running", "jobId": job_id}
        except Exception as exc:
            return {"status": "running", "jobId": job_id, "pollError": f"{type(exc).__name__}: {exc}"}

    def _payload_hash(self, payload: Dict[str, Any]) -> str:
        try:
            return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
        except Exception:
            return hashlib.sha256(str(payload or {}).encode("utf-8")).hexdigest()

    def _atlas_storage_dir(self) -> str:
        return os.path.join(self.valves.data_dir or "/home/mrgbiryu/open-webui-data", "atlas-concepts")

    def _append_jsonl(self, file_name: str, record: Dict[str, Any]) -> None:
        try:
            storage_dir = self._atlas_storage_dir()
            os.makedirs(storage_dir, exist_ok=True)
            path = os.path.join(storage_dir, file_name)
            with open(path, "a", encoding="utf-8") as handle:
                handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
        except Exception:
            pass

    def _append_pipe_build_event(self, record: Dict[str, Any]) -> None:
        self._append_jsonl("pipe-build-events.jsonl", record)

    def _append_draft_job_record(self, job_id: str, context: Dict[str, str], concept_id: str, payload_hash: str) -> None:
        record = {
            "type": "draft_job",
            "jobId": str(job_id or "").strip(),
            "createdAt": int(time.time()),
            "chatId": context.get("chatId") or "",
            "messageId": context.get("messageId") or "",
            "userId": context.get("userId") or "",
            "model": "atlas-builder",
            "conceptId": concept_id,
            "payloadHash": payload_hash,
            "source": "cns_atlas_pipe",
        }
        self._append_jsonl("draft-jobs.jsonl", record)

    def _append_concept_job_record(
        self,
        job_id: str,
        context: Dict[str, str],
        concept_id: str,
        payload_hash: str,
        response: Dict[str, Any],
    ) -> None:
        record = {
            "type": "concept_job",
            "jobId": str(job_id or "").strip(),
            "createdAt": int(time.time()),
            "chatId": context.get("chatId") or "",
            "messageId": context.get("messageId") or "",
            "userId": context.get("userId") or "",
            "model": self._design_author_model(),
            "conceptId": concept_id,
            "payloadHash": payload_hash,
            "status": str(response.get("status") or "").strip(),
            "prebuildStatus": str((response.get("prebuild") or {}).get("status") or "").strip() if isinstance(response.get("prebuild"), dict) else "",
            "source": "cns_atlas_pipe",
        }
        self._append_jsonl("concept-jobs.jsonl", record)

    def _latest_pipe_build_event(self, context: Dict[str, str], concept: Dict[str, Any]) -> Dict[str, Any]:
        storage_dir = self._atlas_storage_dir()
        path = os.path.join(storage_dir, "pipe-build-events.jsonl")
        if not os.path.exists(path):
            return {}
        chat_id = str((context or {}).get("chatId") or "").strip()
        user_id = str((context or {}).get("userId") or "").strip()
        concept_id = str((concept or {}).get("conceptId") or "").strip()
        latest: Dict[str, Any] = {}
        try:
            with open(path, "r", encoding="utf-8") as handle:
                for line in handle:
                    try:
                        record = json.loads(line)
                    except Exception:
                        continue
                    if not isinstance(record, dict):
                        continue
                    if concept_id and str(record.get("conceptId") or "") != concept_id:
                        continue
                    if chat_id and str(record.get("chatId") or "") != chat_id:
                        continue
                    if user_id and str(record.get("userId") or "") != user_id:
                        continue
                    if int(record.get("createdAt") or 0) > int(latest.get("createdAt") or 0):
                        latest = record
        except Exception:
            return {}
        if latest and int(time.time()) - int(latest.get("createdAt") or 0) > 60 * 60:
            return {}
        return latest

    def _emit_status_sync(self, event_emitter: Any, description: str, done: bool = False, **extra: Any) -> None:
        if not event_emitter:
            return
        data = {"description": str(description or "").strip(), "done": bool(done)}
        data.update({key: value for key, value in extra.items() if value is not None})
        self._run_emitter_sync(event_emitter, {"type": "status", "data": data})

    def _emit_message_sync(self, event_emitter: Any, content: str) -> None:
        if not event_emitter or not str(content or "").strip():
            return
        self._run_emitter_sync(event_emitter, {"type": "message", "data": {"content": str(content)}})

    def _emit_notification_sync(self, event_emitter: Any, content: str, level: str = "info") -> None:
        if not event_emitter or not str(content or "").strip():
            return
        self._run_emitter_sync(event_emitter, {"type": "notification", "data": {"type": level, "content": str(content).strip()}})

    def _run_emitter_sync(self, event_emitter: Any, event: Dict[str, Any]) -> None:
        try:
            asyncio.run(event_emitter(event))
        except RuntimeError:
            try:
                loop = asyncio.new_event_loop()
                try:
                    loop.run_until_complete(event_emitter(event))
                finally:
                    loop.close()
            except Exception:
                pass
        except Exception:
            pass

    def _draft_done_message(self, job: Dict[str, Any], payload: Dict[str, Any], headers: Dict[str, str]) -> str:
        job_id = str(job.get("jobId") or job.get("id") or "").strip()
        preview_url = self._builder_public_link(job.get("previewPath", ""))
        compare_url = self._builder_public_link(job.get("comparePath", ""))
        original_url = self._append_query_param(preview_url, "snapshotState", "before")
        work_url = self._append_query_param(preview_url, "snapshotState", "after")
        try:
            requests.post(
                f"{self.valves.builder_base_url.rstrip('/')}/api/builder/lge/v1/jobs/{job_id}/ack",
                json={"stored": True, "source": "open-webui-pipe"},
                headers=headers,
                timeout=15,
            )
        except Exception:
            pass
        return (
            "\n\n## 빌드 완료\n\n"
            "컨셉서를 기준으로 draft build가 완료되었습니다.\n\n"
            f"- [작업물 보기]({work_url})\n"
            f"- [비교하기]({compare_url})\n"
            f"- [원본 보기]({original_url})\n"
            "\n이 아틀라스 작업이 완료되었습니다. 일반 대화로 돌아가려면 `#종료`를 입력하거나 새 채팅을 시작하세요. "
            "같은 채팅에서 새 작업은 `#아틀라스`로 다시 시작하세요.\n"
        )

    def _draft_failed_message(self, job: Dict[str, Any], job_id: str) -> str:
        reason = str(job.get("detail") or job.get("error") or "원인을 알 수 없는 draft build 실패").strip()
        return (
            "\n\n## 빌드 실패\n\n"
            "컨셉서는 보존되어 있지만 draft build가 완료되지 않았습니다.\n\n"
            f"- Job: `{job_id}`\n"
            f"- 원인: `{reason}`\n"
        )

    def _draft_timeout_message(self, job_id: str) -> str:
        return (
            "\n\n## 빌드 지연\n\n"
            "제한 시간 안에 완료 상태를 받지 못했습니다. backend 작업은 계속 진행 중일 수 있습니다.\n\n"
            f"- Job: `{job_id}`\n"
        )

    def _preflight_block_message(self, preflight: Dict[str, Any]) -> str:
        reason = str(preflight.get("reasonCode") or "not_buildable")
        message = str(preflight.get("message") or "현재 조건으로는 빌드를 시작할 수 없습니다.")
        return f"\n\n## 빌드 전 확인 필요\n\n{message}\n\n- reasonCode: `{reason}`\n"

    def _split_frontmatter(self, document: str) -> List[Any]:
        text = str(document or "")
        if text.startswith("\ufeff"):
            text = text[1:]
        lines = text.splitlines(keepends=True)
        if not lines or lines[0].strip() != "---":
            return [{}, text]
        for index in range(1, len(lines)):
            if lines[index].strip() in {"---", "..."}:
                return [self._parse_simple_yaml("".join(lines[1:index])), "".join(lines[index + 1 :])]
        return [{}, text]

    def _parse_simple_yaml(self, yaml_text: str) -> Dict[str, Any]:
        data: Dict[str, Any] = {}
        for raw_line in str(yaml_text or "").splitlines():
            stripped = raw_line.strip()
            if not stripped or stripped.startswith("#") or ":" not in stripped:
                continue
            key, raw_value = stripped.split(":", 1)
            key = key.strip()
            if key:
                data[key] = self._parse_yaml_value(raw_value.strip())
        return data

    def _parse_yaml_value(self, value: str) -> Any:
        text = str(value or "").strip()
        if not text:
            return ""
        try:
            return json.loads(text)
        except Exception:
            pass
        lowered = text.lower()
        if lowered in {"true", "false"}:
            return lowered == "true"
        if lowered in {"null", "none", "~"}:
            return None
        if text.startswith("[") and text.endswith("]"):
            inner = text[1:-1].strip()
            if not inner:
                return []
            return [self._parse_yaml_value(item.strip()) for item in inner.split(",")]
        return text.strip("'\"")

    def _render_yaml_value(self, value: Any) -> str:
        if isinstance(value, bool):
            return "true" if value else "false"
        return json.dumps(value, ensure_ascii=False)

    def _concept_title(self, frontmatter: Dict[str, Any], markdown_body: str, fallback: str) -> str:
        title = self._string_setting(frontmatter, "title", "conceptTitle", "name", default="")
        if title:
            return title[:120]
        for line in str(markdown_body or "").splitlines():
            stripped = line.strip()
            if stripped.startswith("#"):
                return stripped.lstrip("#").strip()[:120] or "LGE Builder Concept"
            if stripped:
                return stripped[:120]
        return self._compact(fallback, 80) or "LGE Builder Concept"

    def _string_setting(self, source: Dict[str, Any], *keys: str, default: Any = "") -> str:
        for key in keys:
            value = source.get(key)
            if value is None or isinstance(value, (list, dict)):
                continue
            text = str(value).strip()
            if text:
                return text
        return str(default or "").strip()

    def _list_setting(self, source: Dict[str, Any], *keys: str) -> List[str]:
        for key in keys:
            value = source.get(key)
            if value is None:
                continue
            if isinstance(value, list):
                items = [str(item).strip() for item in value if str(item).strip()]
            else:
                items = [item.strip() for item in str(value).split(",") if item.strip()]
            if items:
                return items
        return []

    def _default_slots_for_page(self, page_id: str) -> List[str]:
        if str(page_id or "").strip() == "home":
            return [
                "hero",
                "quickmenu",
                "timedeal",
                "md-choice",
                "best-ranking",
                "latest-product-news",
                "smart-life",
                "brand-showroom",
                "lg-best-care",
                "subscription",
                "space-renewal",
                "missed-benefits",
                "summary-banner-2",
                "bestshop-guide",
            ]
        return ["hero"] if str(page_id or "").strip() else []

    def _viewport_profile(self, value: str) -> str:
        normalized = str(value or "").strip().lower()
        if normalized in {"pc", "mo", "ta"}:
            return normalized
        if normalized in {"mobile", "모바일"}:
            return "mo"
        return "pc"

    def _draft_author_provider(self) -> str:
        value = str(self.valves.draft_author_provider or "openrouter").strip().lower()
        return value if value in {"local", "openrouter", "sonnet", "llm"} else "openrouter"

    def _design_author_model(self) -> str:
        return str(self.valves.design_author_model or self.valves.openrouter_model or "anthropic/claude-sonnet-4.6").strip()

    def _normal_chat_model(self) -> str:
        return str(
            os.environ.get("OPENROUTER_NORMAL_CHAT_MODEL", "")
            or self.valves.normal_chat_model
            or "openai/gpt-5.4-mini"
        ).strip()

    def _normal_chat_max_tokens(self) -> int:
        configured = int(os.environ.get("OPENROUTER_NORMAL_CHAT_MAX_TOKENS", "0") or 0)
        if configured > 0:
            return configured
        value = int(self.valves.normal_chat_max_tokens or 4096)
        return max(512, min(12000, value))

    def _builder_public_link(self, path_or_url: Any) -> str:
        base_url = (self.valves.builder_public_url or self.valves.builder_base_url).rstrip("/")
        path = str(path_or_url or "").strip()
        if not path:
            return base_url
        if path.startswith("http://") or path.startswith("https://"):
            parsed = urlsplit(path)
            path = parsed.path or "/"
            if parsed.query:
                path = f"{path}?{parsed.query}"
            if parsed.fragment:
                path = f"{path}#{parsed.fragment}"
        if not path.startswith("/"):
            path = f"/{path}"
        return f"{base_url}{path}"

    def _append_query_param(self, url: str, key: str, value: str) -> str:
        source = str(url or "").strip()
        if not source:
            return ""
        return f"{source}{'&' if '?' in source else '?'}{key}={value}"

    def _context_from_metadata(
        self,
        metadata: Any,
        chat_id: str = None,
        message_id: str = None,
        user: Any = None,
    ) -> Dict[str, str]:
        data = metadata if isinstance(metadata, dict) else {}
        user_data = user if isinstance(user, dict) else {}
        return {
            "chatId": str(chat_id or data.get("chat_id") or data.get("chatId") or "").strip(),
            "messageId": str(message_id or data.get("message_id") or data.get("messageId") or "").strip(),
            "userId": str(user_data.get("id") or data.get("user_id") or data.get("userId") or "").strip(),
        }

    def _concept_provider(self) -> str:
        return "openrouter" if str(self.valves.concept_provider or "").strip().lower() == "openrouter" else "local"

    def _looks_like_concept_intent(self, text: str) -> bool:
        return bool(CONCEPT_INTENT_RE.search(str(text or "")))

    def _looks_like_build_intent(self, text: str) -> bool:
        return bool(BUILD_INTENT_RE.search(str(text or "")))

    def _is_openwebui_task_prompt(self, text: str) -> bool:
        return str(text or "").strip().startswith("### Task:")

    def _openwebui_task_response(self, text: str, messages: List[Dict[str, Any]] = None) -> str:
        value = str(text or "").strip()
        if not self._is_openwebui_task_prompt(value):
            return ""
        lower = value.lower()
        atlas_mode = self._is_atlas_mode_active(messages or []) or "#아틀라스" in value or "#atlas" in lower
        if "title" in lower:
            return json.dumps({"title": "CNS Atlas 작업" if atlas_mode else ""}, ensure_ascii=False)
        if "tags" in lower:
            return json.dumps({"tags": ["LGE", "Atlas", "Builder"] if atlas_mode else []}, ensure_ascii=False)
        if "follow-up" in lower or "follow_ups" in lower:
            if not atlas_mode:
                return json.dumps({"follow_ups": []}, ensure_ascii=False)
            return json.dumps(
                {
                    "follow_ups": [
                        "이 요구사항으로 컨셉서를 작성해줘.",
                        "컨셉서에서 톤을 더 절제된 방향으로 수정해줘.",
                        "이 컨셉서로 빌드를 진행하려면 어떻게 하면 돼?",
                    ]
                },
                ensure_ascii=False,
            )
        return json.dumps({"result": ""}, ensure_ascii=False)

    def _change_level_from_text(self, text: str) -> str:
        if re.search(r"(high|강하게|대대적|전면|전체적으로|모두|재배치|크게)", text, re.IGNORECASE):
            return "high"
        if re.search(r"(low|소폭|가볍게|약하게)", text, re.IGNORECASE):
            return "low"
        return "medium"

    def _delta_to_text(self, delta: Any) -> str:
        if isinstance(delta, str):
            return delta
        if isinstance(delta, list):
            parts: List[str] = []
            for item in delta:
                if isinstance(item, dict):
                    text = item.get("text") or item.get("content")
                    if isinstance(text, str):
                        parts.append(text)
                elif isinstance(item, str):
                    parts.append(item)
            return "".join(parts)
        return ""

    def _chunk_text(self, text: str, size: int) -> Generator[str, None, None]:
        value = str(text or "")
        for index in range(0, len(value), max(1, size)):
            yield value[index : index + size]

    def _compact(self, text: str, limit: int) -> str:
        value = re.sub(r"\s+", " ", str(text or "")).strip()
        if len(value) <= limit:
            return value
        return value[: limit - 1].rstrip() + "…"
