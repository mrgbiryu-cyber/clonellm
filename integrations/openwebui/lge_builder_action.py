"""
title: LGE Builder Draft Action
author: clonellm
version: 0.1.0
required_open_webui_version: 0.6.0
"""

import base64
import asyncio
import contextvars
import hashlib
import json
import os
import re
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlsplit

import requests
from pydantic import BaseModel, Field


CONCEPT_THREAD_ID_RE = re.compile(
    r"^ct-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
FRONTMATTER_KEY_RE = re.compile(r"^([A-Za-z0-9_.-]+)\s*:\s*(.*)$")
FENCED_YAML_FRONTMATTER_RE = re.compile(
    r"```(?:yaml|yml)?\s*\n---\s*\n(?P<yaml>.*?)(?:\n---|\n\.\.\.)\s*\n```",
    re.IGNORECASE | re.DOTALL,
)
FENCED_JSON_RE = re.compile(r"```(?:json)?\s*\n(?P<json>\{.*?\})\s*\n```", re.IGNORECASE | re.DOTALL)
URL_RE = re.compile(r"https?://[^\s<>)\"']+", re.IGNORECASE)
REQUIREMENT_LINE_RE = re.compile(r"^\s*(?:[-*]\s*)?(?P<key>[A-Za-z가-힣0-9 _/-]+)\s*[:=]\s*(?P<value>.+?)\s*$")
OPENWEBUI_REASONING_DETAILS_RE = re.compile(
    r"<details\b[^>]*\btype=[\"']?reasoning[\"']?[^>]*>.*?</details>",
    re.IGNORECASE | re.DOTALL,
)
GENERIC_REASONING_DETAILS_RE = re.compile(
    r"<details\b[^>]*>\s*<summary\b[^>]*>[^<]*(?:reasoning|thought|추론|사고)[^<]*</summary>.*?</details>",
    re.IGNORECASE | re.DOTALL,
)
THINK_BLOCK_RE = re.compile(r"<think\b[^>]*>.*?</think>", re.IGNORECASE | re.DOTALL)
CODE_FENCE_RE = re.compile(r"```(?P<lang>[A-Za-z0-9_-]*)\s*\n(?P<body>.*?)\n```", re.DOTALL)
REASONING_WORD_RE = re.compile(r"(reasoning|thought|chain[-\s]?of[-\s]?thought|internal\s+prompt|trace|추론)", re.IGNORECASE)
ATLAS_CONCEPT_DOCUMENT_MARKER_RE = re.compile(
    r"<!--\s*(?:ATLAS_CONCEPT_DOCUMENT_B64|ACD):([A-Za-z0-9_=\-]+)\s*-->",
    re.IGNORECASE,
)
ATLAS_CONCEPT_DOCUMENT_REF_RE = re.compile(
    r"<!--\s*ACD_REF:([A-Za-z0-9_.-]+)\s*-->",
    re.IGNORECASE,
)
ATLAS_REQUIREMENT_STATE_RE = re.compile(
    r"<!--\s*ARS:(?P<json>\{.*?\})\s*-->",
    re.IGNORECASE | re.DOTALL,
)
ATLAS_PRIVATE_MARKER_RE = re.compile(
    r"\n?<!--\s*(?:ACD_REF:[A-Za-z0-9_.-]+|ARS:\{.*?\}|ATLAS_CONCEPT_DOCUMENT_B64:[A-Za-z0-9_=\-]+|ACD:[A-Za-z0-9_=\-]+)\s*-->\n?",
    re.IGNORECASE | re.DOTALL,
)
ATLAS_ACTION_RESULT_BLOCK_RE = re.compile(
    r"\n*(?:(?:<!--\s*ATLAS_ACTION_RESULT_START\s*-->\s*)?#{1,3}\s*최근 Action 결과\s*\n\n)?#{1,3}\s*(?:컨셉서|빠른\s*컨셉|빌드|Atlas\s+Concept).*?<!--\s*ATLAS_ACTION_RESULT_END\s*-->\n*",
    re.IGNORECASE | re.DOTALL,
)
CONCEPT_JOB_INDEX_MAX_LINES = 1000
CONCEPT_JOB_INDEX_COMPACT_BYTES = 2 * 1024 * 1024
ATLAS_TRANSIENT_ACTION_PROGRESS_RE = re.compile(
    r"\n*##\s*(?:컨셉서\s*생성\s*중|컨셉서를\s*작성하고\s*있습니다|빌드\s*진행\s*중)\s*\n\n.*?(?=\n##\s|\n---\s*$|\Z)",
    re.IGNORECASE | re.DOTALL,
)
CONFIRM_BUILD_INTENT_RE = re.compile(
    r"^\s*(확정|진행|빌드해줘|빌드\s*해줘|이걸로\s*빌드|이\s*컨셉서로\s*(진행|빌드)|이대로\s*(진행|빌드)|go|proceed|build)\s*[.!。]?\s*$",
    re.IGNORECASE,
)
LGE_DESIGN_INTENT_RE = re.compile(
    r"(lge|lg전자|엘지|디자인|요구사항|개선|페이지|고객\s*여정|고객여정|여정|배너|hero|quickmenu|pdp|"
    r"구독|혜택|전환|정보\s*구조|ux|ui|시안|컨셉|아틀라스)",
    re.IGNORECASE,
)
JOURNEY_INTENT_RE = re.compile(
    r"(고객\s*여정|고객여정|\b여정\b|funnel|journey|여러\s*페이지|multi[-\s]?page|page\s*flow|"
    r"home\s+to\s+pdp|category\s+to\s+pdp|landing\s+to\s+purchase)",
    re.IGNORECASE,
)
USER_TARGET_RESOLUTION_NOTE = (
    "사용자는 `lge.co.kr 메인`, `모바일 메인`, `냉장고 카테고리`, `제품 상세`, `PDP`처럼 말할 수 있습니다. "
    "향후 Action 앞단에는 `resolve_user_target()` 계층을 두고 사용자 표현을 normalized intent로 바꾼 뒤 "
    "내부 pageId, slots, viewportProfile로 변환해 preflight에 넘겨야 합니다."
)
ACTION_BODY_CONTEXT = contextvars.ContextVar("atlas_action_body_context", default={})
DRAFT_WATCH_TASKS: Dict[str, asyncio.Task] = {}
REQUIREMENT_STATE_STATUSES = {
    "collecting",
    "ready_for_concept",
    "concept_ready",
    "revision_requested",
    "build_ready",
    "built",
}
BUILDABLE_SLOTS_BY_PAGE = {
    "home": [
        "brand-showroom",
        "hero",
        "latest-product-news",
        "md-choice",
        "quickmenu",
        "space-renewal",
        "subscription",
        "timedeal",
    ],
    "category-refrigerators": ["banner"],
    "category-tvs": ["banner"],
}


class Action:
    class Valves(BaseModel):
        builder_base_url: str = Field(default="http://127.0.0.1:3000")
        builder_public_url: str = Field(default="http://34.27.99.82:3000")
        builder_service_token: str = Field(default="dev-openwebui-builder-token")
        default_project_id: str = Field(default="lge-openwebui-project")
        default_page_id: str = Field(default="home")
        default_viewport_profile: str = Field(default="pc")
        concept_preview_provider: str = Field(default="openrouter")
        design_author_model: str = Field(default="anthropic/claude-sonnet-4.6")
        poll_timeout_seconds: int = Field(default=600)
        poll_interval_seconds: float = Field(default=1.0)

    def __init__(self):
        self.valves = self.Valves()

    async def action(self, body: dict, __user__=None, __event_emitter__=None, __event_call__=None):
        ACTION_BODY_CONTEXT.set(self._action_context_from_body(body, __user__))
        self._debug_action_context("start", body)
        await self._emit_status(__event_emitter__, "요구사항을 접수했습니다.", done=False, stage="queued")
        message = self._extract_message_text(body)
        frontmatter, markdown_body = self._split_frontmatter(message)
        requirement_state = self._extract_requirement_state(body, message)
        requirement_source_message = self._extract_requirement_source_text(body, message)
        sanitized_message = self._sanitize_requirement_text(message, max_chars=12000)
        concept_source_message = requirement_source_message or sanitized_message
        previous_user_message = self._nearest_previous_user_message(body)
        history_stage = self._resolve_atlas_history_stage(body, selected_message=message)
        if history_stage:
            self._debug_action_note(
                "history_stage_resolved",
                stage=str(history_stage.get("stage") or ""),
                requirement_status=(
                    self._normalize_requirement_state(history_stage.get("requirement_state") or {}).get("status")
                    if isinstance(history_stage.get("requirement_state"), dict)
                    else ""
                ),
                concept_ref=(
                    str(self._normalize_requirement_state(history_stage.get("requirement_state") or {}).get("conceptDocumentRef") or "")
                    if isinstance(history_stage.get("requirement_state"), dict)
                    else ""
                ),
                source_message_id=str(history_stage.get("message_id") or ""),
            )
            if history_stage.get("stage") == "built_complete":
                content = self._atlas_thread_built_complete_message()
                await self._emit_message(__event_emitter__, content)
                await self._emit_status(__event_emitter__, "이 아틀라스 작업은 이미 빌드 완료 상태입니다.", done=True, stage="built")
                return {
                    "content": content.strip(),
                    "route": "built_complete",
                    "blocked": True,
                    "draftQueued": False,
                    "conceptPreviewQueued": False,
                }
            history_state = history_stage.get("requirement_state")
            if isinstance(history_state, dict):
                current_status = self._normalize_requirement_state(requirement_state or {}).get("status") if requirement_state else ""
                history_status = self._normalize_requirement_state(history_state).get("status")
                if history_status in {"concept_ready", "build_ready"} or not requirement_state or current_status == "collecting":
                    requirement_state = history_state
                    history_message = str(history_stage.get("message") or "").strip()
                    if history_message:
                        requirement_source_message = history_message
                        concept_source_message = history_message
        self._debug_action_note(
            "state_resolved",
            requirement_status=(self._normalize_requirement_state(requirement_state).get("status") if requirement_state else ""),
            concept_ref=(
                str(self._normalize_requirement_state(requirement_state).get("conceptDocumentRef") or "")
                if requirement_state
                else ""
            ),
            confirm_intent=(
                self._is_confirm_build_intent(message)
                or self._is_confirm_build_intent(previous_user_message)
                or self._is_confirm_build_intent(concept_source_message)
            ),
        )
        structured_requirement_draft = None if requirement_state else self._extract_structured_requirement_draft(body, concept_source_message)
        if not message.strip() and not concept_source_message.strip() and not structured_requirement_draft and not requirement_state:
            content = (
                "\n\n아틀라스 빌더를 실행할 메시지 본문을 찾지 못했습니다. "
                "먼저 `#아틀라스`로 요구사항을 정리하고, 생성된 컨셉서 메시지에서 다시 실행해주세요."
            )
            await self._emit_message(__event_emitter__, content)
            await self._emit_status(__event_emitter__, "요구사항을 찾지 못했습니다.", done=True)
            return {"content": content.strip(), "route": "intake", "blocked": True}

        normalized_requirement_state = self._normalize_requirement_state(requirement_state or {}) if requirement_state else {}
        if normalized_requirement_state.get("status") in {"concept_ready", "build_ready"}:
            state_route = await self._route_requirement_state(
                requirement_state=normalized_requirement_state,
                message=concept_source_message,
                user=__user__,
                emitter=__event_emitter__,
                confirm_intent=True,
            )
            if state_route:
                return state_route

        if (
            self._is_confirm_build_intent(message)
            or self._is_confirm_build_intent(previous_user_message)
            or self._is_confirm_build_intent(concept_source_message)
        ):
            previous_concept_document = self._find_previous_concept_document(body)
            if not previous_concept_document:
                content = self._missing_previous_concept_message()
                await self._emit_message(__event_emitter__, content)
                await self._emit_status(__event_emitter__, "이전에 생성한 컨셉서를 찾지 못했습니다.", done=True)
                return {
                    "content": content.strip(),
                    "route": "missing_previous_concept",
                    "blocked": True,
                    "reasonCode": "missing_previous_concept",
                }
            ready_concept_document = self._mark_concept_document_builder_ready(previous_concept_document)
            return await self._run_final_build_route(ready_concept_document, __user__, __event_emitter__)

        if requirement_state:
            state_route = await self._route_requirement_state(
                requirement_state=requirement_state,
                message=concept_source_message,
                user=__user__,
                emitter=__event_emitter__,
                confirm_intent=(
                    self._is_confirm_build_intent(message)
                    or self._is_confirm_build_intent(previous_user_message)
                    or self._is_confirm_build_intent(concept_source_message)
                ),
            )
            if state_route:
                return state_route

        if structured_requirement_draft:
            concept_preview_payload = self._concept_preview_payload(
                message=concept_source_message,
                frontmatter=frontmatter,
                structured_requirement_draft=structured_requirement_draft,
            )
            if concept_preview_payload:
                return await self._run_concept_preview_route(
                    concept_preview_payload,
                    __user__,
                    __event_emitter__,
                )

        route_message = message if frontmatter else concept_source_message
        early_route = self._early_route(frontmatter, markdown_body, route_message)
        if early_route:
            content = early_route["content"]
            await self._emit_message(__event_emitter__, content)
            await self._emit_status(__event_emitter__, "요구사항 검토가 필요합니다.", done=True)
            return {
                "content": content.strip(),
                "route": early_route["route"],
                "blocked": True,
                **early_route.get("metadata", {}),
            }

        concept_preview_payload = self._concept_preview_payload(
            message=concept_source_message,
            frontmatter=frontmatter,
            structured_requirement_draft=structured_requirement_draft,
        )
        if concept_preview_payload:
            return await self._run_concept_preview_route(
                concept_preview_payload,
                __user__,
                __event_emitter__,
            )

        return await self._run_final_build_route(message, __user__, __event_emitter__)

    async def _run_final_build_route(self, message: str, user: Any = None, emitter: Any = None) -> Dict[str, Any]:
        self._debug_action_note("final_build_start", concept_chars=len(str(message or "")))
        concept_errors = self._builder_ready_errors(message)
        if concept_errors:
            self._debug_action_note("final_build_blocked", errors=concept_errors)
            content = self._builder_ready_blocked_message(concept_errors)
            await self._emit_message(emitter, content)
            await self._emit_status(emitter, "LGE builder draft was not queued.", done=True)
            return {"content": content.strip(), "route": "local_guard", "blocked": True, "errors": concept_errors}

        try:
            request_payload = self._build_payload(message)
            headers = self._headers(user, request_payload.get("externalProjectId"))
            existing_job_id = self._find_latest_draft_job_id(request_payload)
            if existing_job_id:
                try:
                    job = self._fetch_draft_job(existing_job_id, headers)
                    self._debug_action_note(
                        "draft_job_revisited",
                        job_id=existing_job_id,
                        status=str(job.get("status") or ""),
                    )
                    if job.get("status") == "done":
                        return await self._return_draft_job_done(job, request_payload, headers, {}, emitter)
                    if job.get("status") == "failed":
                        return await self._return_draft_job_failed(job, existing_job_id, emitter)
                    self._ensure_draft_job_watcher(existing_job_id, request_payload, headers, {}, emitter)
                    return await self._return_draft_job_running(job, emitter, resumed=True)
                except Exception as exc:
                    self._debug_action_note("draft_job_revisit_failed", job_id=existing_job_id, error=f"{type(exc).__name__}: {exc}")
            await self._emit_message(
                emitter,
                (
                    "\n\n## 빌드 진행 중\n\n"
                    "컨셉서를 기준으로 draft build를 실행하고 있습니다. "
                    "완료되면 원본 보기, 작업물 보기, 비교하기 링크로 이 메시지를 자동 갱신합니다.\n"
                ),
            )
            await self._emit_status(emitter, "빌드 가능 여부를 확인하고 있습니다.", done=False)
            preflight = self._preflight(request_payload, headers)
            self._debug_action_note(
                "preflight_done",
                ok=preflight.get("ok"),
                route=preflight.get("route"),
                reasonCode=preflight.get("reasonCode"),
            )
            if not preflight.get("ok") or preflight.get("route") != "build":
                content = self._feasibility_report_message(preflight)
                await self._emit_message(emitter, content)
                await self._emit_status(emitter, "빌드를 시작하지 않았습니다.", done=True)
                return {
                    "content": content.strip(),
                    "route": "feasibility",
                    "blocked": True,
                    "preflight": preflight,
                }

            self._apply_preflight_buildable(request_payload, preflight)
            await self._emit_status(emitter, "빌드를 시작하고 있습니다.", done=False)
            created = requests.post(
                f"{self.valves.builder_base_url.rstrip('/')}/api/builder/lge/v1/draft",
                json=request_payload,
                headers=headers,
                timeout=30,
            )
            created.raise_for_status()
            job_id = created.json()["jobId"]
            self._append_draft_job_record(job_id, request_payload)
            self._debug_action_note("draft_job_created", job_id=job_id)
            try:
                job = self._fetch_draft_job(job_id, headers)
            except Exception:
                job = {"status": "running", "jobId": job_id}
            if job.get("status") == "done":
                return await self._return_draft_job_done(job, request_payload, headers, preflight, emitter)
            if job.get("status") == "failed":
                return await self._return_draft_job_failed(job, job_id, emitter)
            self._ensure_draft_job_watcher(job_id, request_payload, headers, preflight, emitter)
            return await self._return_draft_job_running(job, emitter, resumed=False)
        except Exception as exc:
            self._debug_action_note("final_build_error", error=f"{type(exc).__name__}: {exc}")
            content = f"\n\n빌드 실행 중 오류가 발생했습니다: `{type(exc).__name__}: {exc}`"
            await self._emit_message(emitter, content)
            await self._emit_status(emitter, "빌드에 실패했습니다.", done=True)
            return {"content": content.strip()}

    async def _return_draft_job_done(
        self,
        job: Dict[str, Any],
        request_payload: Dict[str, Any],
        headers: Dict[str, str],
        preflight: Dict[str, Any],
        emitter: Any,
    ) -> Dict[str, Any]:
        content, artifact_metadata = self._draft_job_done_result(job, request_payload, headers)
        await self._emit_message(emitter, content)
        await self._emit_status(emitter, "빌드가 완료되었습니다.", done=True)
        return {
            "content": content.strip(),
            "route": "build",
            "preflight": preflight,
            "artifact_metadata": artifact_metadata,
            "metadata": {"lgeBuilderArtifact": artifact_metadata},
        }

    def _draft_job_done_result(
        self,
        job: Dict[str, Any],
        request_payload: Dict[str, Any],
        headers: Dict[str, str],
    ) -> Tuple[str, Dict[str, Any]]:
        job_id = str(job.get("jobId") or job.get("id") or "").strip()
        self._debug_action_note("draft_job_done", job_id=job_id, status=job.get("status"))
        preview_url = self._builder_public_link(job.get("previewPath", ""))
        compare_url = self._builder_public_link(job.get("comparePath", ""))
        original_url = self._append_query_param(preview_url, "snapshotState", "before")
        work_url = self._append_query_param(preview_url, "snapshotState", "after")
        artifact_metadata = self._build_artifact_metadata(job, request_payload, preview_url, compare_url)

        try:
            requests.post(
                f"{self.valves.builder_base_url.rstrip('/')}/api/builder/lge/v1/jobs/{job_id}/ack",
                json={"stored": True, "source": "open-webui-action", "artifactMetadata": artifact_metadata},
                headers=headers,
                timeout=15,
            )
        except Exception:
            pass

        content = (
            "\n\n## 빌드 완료\n\n"
            "컨셉서를 기준으로 draft build가 완료되었습니다. 아래 링크에서 결과를 확인하세요.\n\n"
            f"- [원본 보기]({original_url})\n"
            f"- [작업물 보기]({work_url})\n"
            f"- [비교하기]({compare_url})\n"
            f"- [미리보기]({preview_url})\n"
        )
        return content, artifact_metadata

    async def _return_draft_job_failed(self, job: Dict[str, Any], job_id: str, emitter: Any) -> Dict[str, Any]:
        content = self._draft_job_failed_content(job, job_id)
        await self._emit_message(emitter, content)
        await self._emit_status(emitter, "빌드에 실패했습니다.", done=True)
        return {"content": content.strip(), "route": "build_failed", "job": job}

    def _draft_job_failed_content(self, job: Dict[str, Any], job_id: str) -> str:
        error_message = str(job.get("detail") or job.get("error") or "원인을 알 수 없는 draft build 실패").strip()
        return (
            "\n\n## 빌드 실패\n\n"
            "컨셉서는 보존되어 있지만 draft build가 완료되지 않았습니다.\n\n"
            f"- Job: `{job_id}`\n"
            f"- 원인: `{error_message}`\n"
        )

    def _draft_job_timeout_content(self, job_id: str) -> str:
        return (
            "\n\n## 빌드 지연\n\n"
            "빌드가 제한 시간 안에 완료되지 않았습니다. 컨셉서와 job은 보존되어 있으며, "
            "backend 작업은 계속 진행 중일 수 있습니다.\n\n"
            f"- Job: `{job_id}`\n"
            "- 상태: `timeout`\n\n"
            "잠시 후 같은 메시지의 Action을 다시 실행하면 완료 여부를 다시 확인합니다.\n"
        )

    async def _return_draft_job_running(self, job: Dict[str, Any], emitter: Any, resumed: bool = False) -> Dict[str, Any]:
        job_id = str(job.get("jobId") or job.get("id") or "").strip()
        content = (
            "\n\n## 빌드 진행 중\n\n"
            f"{'빌드 상태를 확인했습니다.' if resumed else '빌드를 시작했습니다.'} "
            "결과 생성에는 시간이 걸릴 수 있습니다.\n\n"
            f"- Job: `{job_id}`\n"
            "- 아직 최종 링크는 준비되지 않았습니다.\n\n"
            "이 화면을 떠나도 작업은 backend에서 계속 진행됩니다. 완료, 실패, 타임아웃이 확인되면 "
            "이 메시지가 자동으로 갱신됩니다.\n"
        )
        await self._emit_message(emitter, content)
        await self._emit_status(emitter, "빌드가 진행 중입니다.", done=False, stage="running", route="build")
        return {
            "content": content.strip(),
            "route": "build_running",
            "draftQueued": True,
            "metadata": {"draftJobId": job_id, "draftJobStatus": job.get("status")},
        }

    def _append_query_param(self, url: str, key: str, value: str) -> str:
        source = str(url or "").strip()
        if not source:
            return ""
        separator = "&" if "?" in source else "?"
        return f"{source}{separator}{key}={value}"

    async def _emit_status(self, emitter: Any, description: str, done: bool = False, **extra: Any) -> None:
        if not emitter:
            return
        data = {"description": description, "done": done}
        data.update(extra)
        await emitter({"type": "status", "data": data})

    async def _emit_message(self, emitter: Any, content: str) -> None:
        visible_content = self._strip_private_markers(content)
        if emitter and visible_content.strip():
            await emitter({"type": "message", "data": {"content": visible_content}})
        if not self._is_transient_action_progress(content):
            self._schedule_persistent_message_append(content)

    async def _emit_replace(self, emitter: Any, content: str) -> None:
        visible_content = self._strip_private_markers(content)
        if emitter and visible_content.strip():
            await emitter({"type": "replace", "data": {"content": visible_content}})
        if visible_content.strip():
            self._schedule_persistent_message_replace(content)

    async def _emit_notification(self, emitter: Any, content: str, level: str = "info") -> None:
        if emitter and str(content or "").strip():
            await emitter({"type": "notification", "data": {"type": level, "content": str(content).strip()}})

    def _strip_private_markers(self, content: str) -> str:
        value = str(content or "")
        value = ATLAS_PRIVATE_MARKER_RE.sub("\n", value)
        value = re.sub(r"<!--\s*ATLAS_ACTION_RESULT_(?:START|END)\s*-->", "", value, flags=re.IGNORECASE)
        return re.sub(r"\n{3,}", "\n\n", value).rstrip() + ("\n" if value.endswith("\n") else "")

    def _strip_action_result_blocks(self, content: str) -> str:
        return ATLAS_ACTION_RESULT_BLOCK_RE.sub("\n", str(content or ""))

    def _strip_transient_action_progress(self, content: str) -> str:
        return re.sub(r"\n{3,}", "\n\n", ATLAS_TRANSIENT_ACTION_PROGRESS_RE.sub("\n", str(content or ""))).strip()

    def _is_transient_action_progress(self, content: str) -> bool:
        value = self._strip_private_markers(content).strip()
        return bool(re.match(r"^##\s*(?:컨셉서\s*생성\s*중|컨셉서를\s*작성하고\s*있습니다|빌드\s*진행\s*중)\b", value, re.IGNORECASE))

    def _should_pin_action_result(self, content: str) -> bool:
        value = self._strip_private_markers(content).strip()
        if not value:
            return False
        return bool(
            value.startswith("## 빌드")
            or value.startswith("## 컨셉서")
            or value.startswith("## 빠른 컨셉")
            or value.startswith("# 빌드")
            or value.startswith("# 컨셉서")
            or value.startswith("# 빠른 컨셉")
        )

    def _merge_persistent_action_content(self, existing: str, visible_content: str) -> str:
        existing_text = self._strip_transient_action_progress(
            ATLAS_ACTION_RESULT_BLOCK_RE.sub("\n", str(existing or ""))
        )
        visible_text = self._strip_private_markers(visible_content).strip()
        if not visible_text:
            return existing_text
        if not self._should_pin_action_result(visible_text):
            if visible_text in existing_text:
                return existing_text
            return f"{existing_text}\n{visible_text}" if existing_text else visible_text
        pinned = (
            f"{visible_text}\n"
            "<!-- ATLAS_ACTION_RESULT_END -->"
        )
        return pinned

    def _action_context_from_body(self, body: Any, user: Any = None) -> Dict[str, Any]:
        data = body if isinstance(body, dict) else {}
        user_data = user if isinstance(user, dict) else {}
        return {
            "chat_id": str(data.get("chat_id") or data.get("chatId") or "").strip(),
            "message_id": str(data.get("id") or data.get("message_id") or data.get("messageId") or "").strip(),
            "session_id": str(data.get("session_id") or data.get("sessionId") or "").strip(),
            "user_id": str(user_data.get("id") or data.get("user_id") or data.get("userId") or "").strip(),
            "model": str(data.get("model") or "").strip(),
            "keys": sorted([str(key) for key in data.keys()]),
        }

    def _debug_action_context(self, phase: str, body: Any) -> None:
        try:
            context = self._action_context_from_body(body)
            self._debug_action_note(phase, **context)
        except Exception:
            pass

    def _debug_action_note(self, phase: str, **data: Any) -> None:
        try:
            context = ACTION_BODY_CONTEXT.get({})
            if not isinstance(context, dict):
                context = {}
            log_path = os.environ.get("ATLAS_ACTION_DEBUG_LOG", "/home/mrgbiryu/open-webui-data/atlas-action-debug.log")
            with open(log_path, "a", encoding="utf-8") as handle:
                handle.write(
                    json.dumps(
                        {
                            "ts": int(time.time()),
                            "phase": phase,
                            **context,
                            **data,
                        },
                        ensure_ascii=False,
                    )
                    + "\n"
                )
        except Exception:
            pass

    def _schedule_persistent_message_append(self, content: str) -> None:
        if not str(content or "").strip():
            return
        context = ACTION_BODY_CONTEXT.get({})
        if not isinstance(context, dict) or not context.get("chat_id") or not context.get("message_id"):
            return
        try:
            asyncio.get_running_loop().create_task(
                self._delayed_persistent_message_append(dict(context), str(content))
            )
        except Exception:
            pass

    def _schedule_persistent_message_replace(self, content: str) -> None:
        if not str(content or "").strip():
            return
        context = ACTION_BODY_CONTEXT.get({})
        if not isinstance(context, dict) or not context.get("chat_id") or not context.get("message_id"):
            return
        try:
            asyncio.get_running_loop().create_task(
                self._delayed_persistent_message_replace(dict(context), str(content))
            )
        except Exception:
            pass

    async def _delayed_persistent_message_replace(self, context: Dict[str, Any], content: str) -> None:
        await asyncio.sleep(0.2)
        chat_id = str(context.get("chat_id") or "").strip()
        message_id = str(context.get("message_id") or "").strip()
        if not chat_id or not message_id or not content.strip():
            return
        try:
            from open_webui.models.chats import Chats

            visible_content = self._strip_private_markers(content).strip()
            if not visible_content:
                return
            chat_model = await Chats.get_chat_by_id(chat_id)
            if chat_model is None:
                return
            chat = dict(chat_model.chat or {})
            history = dict(chat.get("history") or {})
            messages_map = dict(history.get("messages") or {})
            target_id = message_id
            if target_id not in messages_map:
                current_id = str(history.get("currentId") or "").strip()
                if current_id in messages_map:
                    target_id = current_id
            message = messages_map.get(target_id)
            if not isinstance(message, dict):
                return
            message["content"] = visible_content
            messages_map[target_id] = message
            history["messages"] = messages_map
            history["currentId"] = target_id
            chat["history"] = history
            list_messages = chat.get("messages")
            if isinstance(list_messages, list):
                for item in list_messages:
                    if isinstance(item, dict) and item.get("id") == target_id:
                        item["content"] = visible_content
                        break
                chat["messages"] = list_messages
            await Chats.update_chat_by_id(chat_id, chat)
        except Exception as exc:
            try:
                log_path = os.environ.get("ATLAS_ACTION_DEBUG_LOG", "/home/mrgbiryu/open-webui-data/atlas-action-debug.log")
                with open(log_path, "a", encoding="utf-8") as handle:
                    handle.write(
                        json.dumps(
                            {
                                "ts": int(time.time()),
                                "phase": "persistent_replace_failed",
                                "chat_id": chat_id,
                                "message_id": message_id,
                                "error": f"{type(exc).__name__}: {exc}",
                            },
                            ensure_ascii=False,
                        )
                        + "\n"
                    )
            except Exception:
                pass

    async def _delayed_persistent_message_append(self, context: Dict[str, Any], content: str) -> None:
        # Open WebUI saves the client chat shortly after an Action returns. A short
        # delay avoids the client overwriting the server-side event append.
        await asyncio.sleep(1.5)
        chat_id = str(context.get("chat_id") or "").strip()
        message_id = str(context.get("message_id") or "").strip()
        if not chat_id or not message_id or not content.strip():
            return
        try:
            from open_webui.models.chats import Chats

            visible_content = self._strip_private_markers(content)
            requirement_state = self._extract_requirement_state_from_text(content) or {}
            concept_ref = self._concept_document_ref_from_text(content)
            chat_model = await Chats.get_chat_by_id(chat_id)
            if chat_model is None:
                return
            chat = dict(chat_model.chat or {})
            history = dict(chat.get("history") or {})
            messages_map = dict(history.get("messages") or {})
            target_id = message_id
            if target_id not in messages_map:
                current_id = str(history.get("currentId") or "").strip()
                if current_id in messages_map:
                    target_id = current_id
            message = messages_map.get(target_id)
            if not isinstance(message, dict):
                return
            existing = str(message.get("content") or "")
            message["content"] = self._merge_persistent_action_content(existing, visible_content)
            metadata = message.get("metadata") if isinstance(message.get("metadata"), dict) else {}
            if concept_ref:
                metadata["conceptDocumentRef"] = concept_ref
            if requirement_state:
                metadata["requirementState"] = requirement_state
            atlas_meta = metadata.get("atlas") if isinstance(metadata.get("atlas"), dict) else {}
            if concept_ref:
                atlas_meta["conceptDocumentRef"] = concept_ref
            if requirement_state:
                atlas_meta["requirementState"] = requirement_state
            if atlas_meta:
                metadata["atlas"] = atlas_meta
            if metadata:
                message["metadata"] = metadata
            messages_map[target_id] = message
            history["messages"] = messages_map
            history["currentId"] = target_id
            chat["history"] = history

            list_messages = chat.get("messages")
            if isinstance(list_messages, list):
                for item in list_messages:
                    if isinstance(item, dict) and item.get("id") == target_id:
                        item["content"] = message["content"]
                        if metadata:
                            item["metadata"] = metadata
                        break
                chat["messages"] = list_messages

            await Chats.update_chat_by_id(chat_id, chat)
        except Exception as exc:
            try:
                log_path = os.environ.get("ATLAS_ACTION_DEBUG_LOG", "/home/mrgbiryu/open-webui-data/atlas-action-debug.log")
                with open(log_path, "a", encoding="utf-8") as handle:
                    handle.write(
                        json.dumps(
                            {
                                "ts": int(time.time()),
                                "phase": "persistent_append_failed",
                                "chat_id": chat_id,
                                "message_id": message_id,
                                "error": f"{type(exc).__name__}: {exc}",
                            },
                            ensure_ascii=False,
                        )
                        + "\n"
                    )
            except Exception:
                pass

    def _headers(self, user: Any = None, project_id: Any = None) -> Dict[str, str]:
        resolved_project_id = str(project_id or self.valves.default_project_id).strip() or self.valves.default_project_id
        return {
            "Authorization": f"Bearer {self.valves.builder_service_token}",
            "Content-Type": "application/json",
            "X-OpenWebUI-User-Id": self._user_id(user),
            "X-OpenWebUI-Project-Id": resolved_project_id,
            "X-OpenWebUI-Request-Id": f"owui-action-{uuid.uuid4()}",
        }

    def _preflight(self, request_payload: Dict[str, Any], headers: Dict[str, str]) -> Dict[str, Any]:
        response = requests.post(
            f"{self.valves.builder_base_url.rstrip('/')}/api/builder/lge/v1/preflight",
            json=request_payload,
            headers=headers,
            timeout=30,
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            return {
                "ok": False,
                "route": "feasibility",
                "reasonCode": "concept_too_vague",
                "message": "Builder preflight returned an invalid response.",
                "missing": [],
                "unsupported": [],
            }
        return payload

    def _apply_preflight_buildable(self, request_payload: Dict[str, Any], preflight: Dict[str, Any]) -> None:
        buildable = preflight.get("buildable") if isinstance(preflight.get("buildable"), dict) else {}
        slots = buildable.get("slots") if isinstance(buildable.get("slots"), list) else []
        components = buildable.get("componentIds") if isinstance(buildable.get("componentIds"), list) else []
        concept_package = request_payload.get("conceptPackage") if isinstance(request_payload.get("conceptPackage"), dict) else {}
        target_group = concept_package.get("targetGroup") if isinstance(concept_package.get("targetGroup"), dict) else {}
        if slots:
            target_group["slotIds"] = [str(item).strip() for item in slots if str(item).strip()]
        if components:
            target_group["componentIds"] = [str(item).strip() for item in components if str(item).strip()]
        concept_package["targetGroup"] = target_group
        request_payload["conceptPackage"] = concept_package

    async def _run_concept_preview_route(
        self,
        concept_preview_payload: Dict[str, Any],
        user: Any,
        emitter: Any,
    ) -> Dict[str, Any]:
        readiness = self._validate_requirement_draft_readiness(
            concept_preview_payload.get("requirementDraft") if isinstance(concept_preview_payload.get("requirementDraft"), dict) else {}
        )
        if not readiness.get("ok"):
            content = self._requirement_readiness_message(readiness)
            await self._emit_message(emitter, content)
            await self._emit_status(
                emitter,
                "컨셉서를 만들기 전에 요구사항 보완이 필요합니다.",
                done=True,
                stage="need_more_requirements",
                route="requirement_readiness",
            )
            return {
                "content": content.strip(),
                "route": "requirement_readiness",
                "blocked": True,
                "draftQueued": False,
                "conceptPreviewQueued": False,
                "reasonCode": "requirement_not_ready",
                "missing": readiness.get("missing", []),
                "ambiguous": readiness.get("ambiguous", []),
            }
        headers = self._headers(user, self._concept_preview_project_id(concept_preview_payload))
        provider_label = self._concept_preview_provider_label(
            concept_preview_payload.get("requirementDraft") if isinstance(concept_preview_payload.get("requirementDraft"), dict) else {}
        )
        existing_job_id = self._find_latest_concept_job_id(concept_preview_payload)
        if existing_job_id:
            try:
                job = self._fetch_concept_job(existing_job_id, headers)
                self._debug_action_note(
                    "concept_job_revisited",
                    job_id=existing_job_id,
                    status=str(job.get("status") or ""),
                    stage=str(job.get("stage") or ""),
                )
                if job.get("status") == "done":
                    return await self._return_concept_preview_done(job, emitter)
                if job.get("status") == "failed":
                    content = self._concept_preview_failed_message(job)
                    await self._emit_message(emitter, content)
                    await self._emit_status(
                        emitter,
                        "컨셉서를 만들지 못했습니다.",
                        done=True,
                        stage="failed",
                        route="concept_preview",
                    )
                    return {
                        "content": content.strip(),
                        "route": "concept_preview",
                        "blocked": True,
                        "draftQueued": False,
                        "conceptPreview": job,
                    }
                return await self._return_concept_preview_running(job, provider_label, emitter, resumed=True)
            except Exception as exc:
                self._debug_action_note("concept_job_revisit_failed", job_id=existing_job_id, error=f"{type(exc).__name__}: {exc}")

        try:
            await self._emit_status(
                emitter,
                f"{provider_label}을 작성하고 있습니다.",
                done=False,
                stage="queued",
                route="concept_preview",
            )
            created = requests.post(
                f"{self.valves.builder_base_url.rstrip('/')}/api/builder/lge/v1/concept-preview",
                json=concept_preview_payload,
                headers=headers,
                timeout=30,
            )
            created.raise_for_status()
            created_payload = created.json()
            job_id = str(created_payload.get("jobId") or "").strip()
            if not job_id:
                raise RuntimeError("concept-preview response did not include jobId")
            self._append_concept_job_record(job_id, concept_preview_payload)
            self._debug_action_note("concept_job_created", job_id=job_id)
            try:
                job = self._fetch_concept_job(job_id, headers)
            except Exception:
                job = {
                    "status": "running",
                    "stage": "queued",
                    "jobId": job_id,
                    "percent": created_payload.get("percent"),
                }
            if job.get("status") == "done":
                return await self._return_concept_preview_done(job, emitter)
            if job.get("status") == "failed":
                content = self._concept_preview_failed_message(job)
                await self._emit_message(emitter, content)
                await self._emit_status(
                    emitter,
                    "컨셉서를 만들지 못했습니다.",
                    done=True,
                    stage="failed",
                    route="concept_preview",
                )
                return {
                    "content": content.strip(),
                    "route": "concept_preview",
                    "blocked": True,
                    "draftQueued": False,
                    "conceptPreview": job,
                }
            return await self._return_concept_preview_running(job, provider_label, emitter, resumed=False)
        except Exception as exc:
            content = f"\n\n컨셉서 생성 중 오류가 발생했습니다: `{type(exc).__name__}: {exc}`"
            await self._emit_message(emitter, content)
            await self._emit_status(
                emitter,
                "컨셉서를 만들지 못했습니다.",
                done=True,
                stage="failed",
                route="concept_preview",
            )
            return {"content": content.strip(), "route": "concept_preview", "blocked": True, "draftQueued": False}

    async def _return_concept_preview_running(
        self,
        job: Dict[str, Any],
        provider_label: str,
        emitter: Any,
        resumed: bool = False,
    ) -> Dict[str, Any]:
        stage = str(job.get("stage") or job.get("status") or "queued").strip()
        percent = job.get("percent")
        content = self._concept_preview_running_message(job, provider_label, resumed=resumed)
        await self._emit_message(emitter, content)
        await self._emit_status(
            emitter,
            self._concept_stage_description(stage),
            done=False,
            stage=stage,
            route="concept_preview",
            percent=percent,
        )
        return {
            "content": content.strip(),
            "route": "concept_preview",
            "blocked": True,
            "draftQueued": False,
            "conceptPreviewQueued": True,
            "concept_preview": job,
            "metadata": {
                "conceptJobId": job.get("jobId") or job.get("id"),
                "conceptJobStatus": job.get("status"),
                "conceptJobStage": stage,
                "conceptJobPercent": percent,
            },
        }

    async def _return_concept_preview_done(self, job: Dict[str, Any], emitter: Any) -> Dict[str, Any]:
        self._debug_action_note(
            "concept_job_done",
            job_id=str(job.get("jobId") or job.get("id") or ""),
            status=str(job.get("status") or ""),
            stage=str(job.get("stage") or ""),
        )
        content = self._concept_preview_done_message(job)
        concept_document_ref = str(job.get("_conceptDocumentRef") or self._concept_document_ref_from_text(content) or "")
        requirement_state = job.get("_requirementState") if isinstance(job.get("_requirementState"), dict) else {}
        if not requirement_state:
            requirement_state = self._extract_requirement_state_from_text(content) or {}
        await self._emit_message(emitter, content)
        await self._emit_status(
            emitter,
            "컨셉서가 준비되었습니다.",
            done=True,
            stage="done",
            route="concept_preview",
        )
        return {
            "content": content.strip(),
            "route": "concept_preview",
            "blocked": True,
            "draftQueued": False,
            "concept_preview": job,
            "requirement_state": requirement_state,
            "metadata": {
                "requirementDraft": job.get("requirementDraft"),
                "conceptDocument": job.get("conceptDocument"),
                "conceptDisplayMarkdown": job.get("conceptDisplayMarkdown"),
                "conceptJobId": job.get("jobId") or job.get("id"),
                "conceptDocumentRef": concept_document_ref,
                "requirementState": requirement_state,
                "plannerProvider": job.get("plannerProvider"),
                "conceptAuthorModel": job.get("conceptAuthorModel"),
            },
        }

    def _build_payload(self, message: str) -> Dict[str, Any]:
        frontmatter, markdown_body = self._split_frontmatter(message)
        project_id = self._string_setting(frontmatter, "projectId", "externalProjectId", default=self.valves.default_project_id)
        external_requirement_id = self._string_setting(frontmatter, "externalRequirementId", "requirementId", default="")
        requirement_id = self._string_setting(frontmatter, "requirementId", "externalRequirementId", default="")
        concept_id = self._string_setting(frontmatter, "conceptId", "externalConceptId", default=f"concept-{uuid.uuid4()}")
        concept_group_id = self._string_setting(frontmatter, "conceptGroupId", default="")
        concept_thread_id = self._concept_thread_id(
            self._string_setting(frontmatter, "conceptThreadId", "threadId", default="")
        )
        page_id = self._string_setting(frontmatter, "pageId", "page", default=self.valves.default_page_id)
        viewport_profile = self._viewport_profile(
            self._string_setting(frontmatter, "viewportProfile", "viewport", default=self.valves.default_viewport_profile)
        )
        target_group = self._target_group(frontmatter, page_id)
        target_scope = self._string_setting(frontmatter, "targetScope", default="").strip().lower()
        if not target_scope:
            target_scope = "page" if str(target_group["groupId"]).endswith("-all") else ""
        slots = self._list_setting(frontmatter, "slots", "slotIds", "targetSlots")
        if not slots:
            if not (target_scope == "page" or str(target_group["groupId"]).endswith("-all")):
                slots = ["hero", "quickmenu"] if page_id == "home" else ["hero"]
        components = self._list_setting(frontmatter, "componentIds", "components", "targetComponents")
        if not components and target_scope != "page":
            components = [f"{page_id}.{slot}" for slot in slots]
        if not target_scope:
            target_scope = "components" if components else "page"
        return {
            "builderApiVersion": "v1",
            "externalProjectId": project_id,
            "externalRequirementId": external_requirement_id,
            "requirementId": requirement_id,
            "externalConceptId": concept_id,
            "conceptGroupId": concept_group_id,
            "conceptThreadId": concept_thread_id,
            "conceptJobId": self._string_setting(frontmatter, "conceptJobId", "concept_job_id", default=""),
            "pageId": page_id,
            "viewportProfile": viewport_profile,
            "conceptDocument": message,
            "conceptPackage": {
                "title": self._concept_title(frontmatter, markdown_body, message),
                "targetGroup": {
                    "groupId": target_group["groupId"],
                    "groupLabel": target_group["groupLabel"],
                    "slotIds": slots,
                    "componentIds": components,
                },
                "designPolicy": {
                    "mustKeep": ["Preserve Tailwind runtime parity", "Preserve LGE asset role guardrails"],
                    "mustChange": ["Improve first-screen hierarchy based on the selected concept"],
                    "guardrails": [
                        "Do not reuse promo-complete assets as new hero backgrounds",
                        "Quickmenu must keep icon-only family consistency",
                    ],
                },
                "source": {
                    "format": "yaml-frontmatter+markdown" if frontmatter else "plain-markdown",
                    "frontmatter": frontmatter,
                },
            },
            "builderOptions": {
                "rendererSurface": self._string_setting(frontmatter, "rendererSurface", default="tailwind"),
                "designChangeLevel": self._string_setting(frontmatter, "designChangeLevel", default="medium"),
                "patchDepth": self._string_setting(frontmatter, "patchDepth", default="medium"),
                "interventionLayer": self._string_setting(frontmatter, "interventionLayer", default="section-group"),
                "targetScope": target_scope,
                "authorProvider": self._final_build_author_provider(),
                "authorModel": self._design_author_model(),
                "designAuthorModel": self._design_author_model(),
                "bypassDesignModelProfile": True,
            },
        }

    def _build_artifact_metadata(
        self,
        job: Dict[str, Any],
        request_payload: Dict[str, Any],
        preview_url: str,
        compare_url: str,
    ) -> Dict[str, Any]:
        target_group = request_payload.get("conceptPackage", {}).get("targetGroup") or {}
        builder_artifact = job.get("artifact") if isinstance(job.get("artifact"), dict) else {}
        artifact_record = job.get("artifactRecord") if isinstance(job.get("artifactRecord"), dict) else None
        if artifact_record is None and isinstance(builder_artifact.get("artifactRecord"), dict):
            artifact_record = builder_artifact.get("artifactRecord")
        if artifact_record is None:
            artifact_record = {}
        return {
            "schema": "openwebui-lge-builder-artifact-v1",
            "status": "ready",
            "source": "open-webui-action",
            "wrapperFor": "clonellm-builder-artifact-record",
            "canonicalStorage": {
                "target": "artifactRecord",
                "path": "artifact_metadata.artifactRecord",
                "sourcePath": "job.artifactRecord",
            },
            "jobId": str(job.get("jobId") or ""),
            "projectId": request_payload.get("externalProjectId", ""),
            "externalProjectId": request_payload.get("externalProjectId", ""),
            "externalRequirementId": request_payload.get("externalRequirementId", ""),
            "requirementId": request_payload.get("requirementId", ""),
            "conceptId": request_payload.get("externalConceptId", ""),
            "externalConceptId": request_payload.get("externalConceptId", ""),
            "conceptGroupId": request_payload.get("conceptGroupId", ""),
            "conceptThreadId": request_payload.get("conceptThreadId", ""),
            "pageId": request_payload.get("pageId", ""),
            "viewportProfile": request_payload.get("viewportProfile", ""),
            "targetGroup": target_group,
            "conceptDocument": request_payload.get("conceptDocument", ""),
            "conceptPackage": request_payload.get("conceptPackage", {}),
            "builderOptions": request_payload.get("builderOptions", {}),
            "builderRunId": str(job.get("builderRunId") or ""),
            "previewUrl": preview_url,
            "compareUrl": compare_url,
            "previewPath": str(job.get("previewPath") or ""),
            "comparePath": str(job.get("comparePath") or ""),
            "builderPublicUrl": (self.valves.builder_public_url or self.valves.builder_base_url).rstrip("/"),
            "completedAt": str(job.get("completedAt") or ""),
            "artifactRecord": artifact_record,
            "artifact": builder_artifact,
            "authoredSectionMarkdownDocument": builder_artifact.get("authoredSectionMarkdownDocument"),
            "authoredSectionHtmlPackage": builder_artifact.get("authoredSectionHtmlPackage"),
            "snapshotData": builder_artifact.get("snapshotData"),
            "validation": builder_artifact.get("validation"),
            "runtimeAdvisory": builder_artifact.get("runtimeAdvisory"),
            "externalOwner": job.get("externalOwner"),
        }

    def _draft_watch_key(self, job_id: str) -> str:
        context = ACTION_BODY_CONTEXT.get({})
        if not isinstance(context, dict):
            context = {}
        return "|".join(
            [
                str(context.get("chat_id") or ""),
                str(context.get("message_id") or ""),
                str(context.get("user_id") or ""),
                str(job_id or ""),
            ]
        )

    def _ensure_draft_job_watcher(
        self,
        job_id: str,
        request_payload: Dict[str, Any],
        headers: Dict[str, str],
        preflight: Dict[str, Any],
        emitter: Any,
    ) -> bool:
        normalized_job_id = str(job_id or "").strip()
        if not normalized_job_id or not emitter:
            return False
        key = self._draft_watch_key(normalized_job_id)
        existing = DRAFT_WATCH_TASKS.get(key)
        if existing and not existing.done():
            return False
        context = ACTION_BODY_CONTEXT.get({})
        if not isinstance(context, dict):
            context = {}
        try:
            task = asyncio.get_running_loop().create_task(
                self._watch_draft_job(
                    normalized_job_id,
                    dict(request_payload or {}),
                    dict(headers or {}),
                    dict(preflight or {}),
                    emitter,
                    dict(context),
                )
            )
            DRAFT_WATCH_TASKS[key] = task

            def _clear_watch_task(done_task: asyncio.Task) -> None:
                DRAFT_WATCH_TASKS.pop(key, None)
                try:
                    done_task.result()
                except Exception as exc:
                    self._debug_action_note(
                        "draft_watch_task_error",
                        job_id=normalized_job_id,
                        error=f"{type(exc).__name__}: {exc}",
                    )

            task.add_done_callback(_clear_watch_task)
            self._debug_action_note("draft_watch_started", job_id=normalized_job_id)
            return True
        except Exception as exc:
            self._debug_action_note("draft_watch_start_failed", job_id=normalized_job_id, error=f"{type(exc).__name__}: {exc}")
            return False

    async def _watch_draft_job(
        self,
        job_id: str,
        request_payload: Dict[str, Any],
        headers: Dict[str, str],
        preflight: Dict[str, Any],
        emitter: Any,
        context: Dict[str, Any],
    ) -> None:
        token = ACTION_BODY_CONTEXT.set(context or {})
        deadline = time.time() + max(5, int(self.valves.poll_timeout_seconds or 300))
        interval = max(0.5, float(self.valves.poll_interval_seconds or 1.0))
        last_status_emit_at = 0.0
        try:
            while time.time() < deadline:
                try:
                    job = await asyncio.to_thread(self._fetch_draft_job, job_id, headers)
                except Exception as exc:
                    self._debug_action_note("draft_watch_fetch_failed", job_id=job_id, error=f"{type(exc).__name__}: {exc}")
                    await asyncio.sleep(min(interval * 2, 5))
                    continue

                status = str(job.get("status") or "running").strip().lower()
                if status == "done":
                    content, artifact_metadata = await asyncio.to_thread(
                        self._draft_job_done_result,
                        job,
                        request_payload,
                        headers,
                    )
                    await self._emit_replace(emitter, content)
                    await self._emit_status(
                        emitter,
                        "빌드가 완료되었습니다.",
                        done=True,
                        stage="done",
                        route="build",
                        jobId=job_id,
                    )
                    await self._emit_notification(emitter, "빌드가 완료되었습니다.", level="success")
                    self._debug_action_note(
                        "draft_watch_done",
                        job_id=job_id,
                        artifact_record_id=str((artifact_metadata or {}).get("artifactRecord", {}).get("recordId") or ""),
                    )
                    return
                if status == "failed":
                    content = self._draft_job_failed_content(job, job_id)
                    await self._emit_replace(emitter, content)
                    await self._emit_status(
                        emitter,
                        "빌드에 실패했습니다.",
                        done=True,
                        stage="failed",
                        route="build",
                        jobId=job_id,
                    )
                    await self._emit_notification(emitter, "빌드에 실패했습니다.", level="error")
                    self._debug_action_note("draft_watch_failed", job_id=job_id)
                    return

                now = time.time()
                if now - last_status_emit_at >= 8:
                    await self._emit_status(
                        emitter,
                        "빌드가 진행 중입니다.",
                        done=False,
                        stage=status or "running",
                        route="build",
                        jobId=job_id,
                    )
                    last_status_emit_at = now
                await asyncio.sleep(interval)

            content = self._draft_job_timeout_content(job_id)
            await self._emit_replace(emitter, content)
            await self._emit_status(
                emitter,
                "빌드 완료 확인 시간이 초과되었습니다.",
                done=True,
                stage="timeout",
                route="build",
                jobId=job_id,
            )
            await self._emit_notification(emitter, "빌드 완료 확인 시간이 초과되었습니다.", level="warning")
            self._debug_action_note("draft_watch_timeout", job_id=job_id)
        finally:
            ACTION_BODY_CONTEXT.reset(token)

    def _poll_job(self, job_id: str, headers: Dict[str, str]) -> Dict[str, Any]:
        deadline = time.time() + self.valves.poll_timeout_seconds
        transient_errors = 0
        while time.time() < deadline:
            try:
                response = requests.get(
                    f"{self.valves.builder_base_url.rstrip('/')}/api/builder/lge/v1/jobs/{job_id}",
                    headers=headers,
                    timeout=15,
                )
                if response.status_code in {502, 503, 504}:
                    transient_errors += 1
                    time.sleep(min(self.valves.poll_interval_seconds * max(1, transient_errors), 5))
                    continue
                response.raise_for_status()
            except requests.RequestException as error:
                transient_errors += 1
                if transient_errors <= 5 and time.time() < deadline:
                    time.sleep(min(self.valves.poll_interval_seconds * transient_errors, 5))
                    continue
                raise error
            payload = response.json()
            if payload.get("status") in {"done", "failed"}:
                return payload
            time.sleep(self.valves.poll_interval_seconds)
        return {"status": "failed", "error": "poll_timeout", "jobId": job_id}

    def _fetch_draft_job(self, job_id: str, headers: Dict[str, str]) -> Dict[str, Any]:
        response = requests.get(
            f"{self.valves.builder_base_url.rstrip('/')}/api/builder/lge/v1/jobs/{job_id}",
            headers=headers,
            timeout=15,
        )
        response.raise_for_status()
        payload = response.json()
        return payload if isinstance(payload, dict) else {"status": "failed", "error": "invalid_draft_job_response", "jobId": job_id}

    def _draft_payload_hash(self, payload: Dict[str, Any]) -> str:
        try:
            source = json.dumps(payload or {}, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        except Exception:
            source = str(payload or "")
        return hashlib.sha256(source.encode("utf-8")).hexdigest()

    def _append_draft_job_record(self, job_id: str, payload: Dict[str, Any]) -> None:
        normalized_job_id = str(job_id or "").strip()
        if not normalized_job_id:
            return
        try:
            context = ACTION_BODY_CONTEXT.get({})
            if not isinstance(context, dict):
                context = {}
            record = {
                "type": "draft_job",
                "jobId": normalized_job_id,
                "createdAt": int(time.time()),
                "chatId": str(context.get("chat_id") or "").strip(),
                "messageId": str(context.get("message_id") or "").strip(),
                "userId": str(context.get("user_id") or "").strip(),
                "model": str(context.get("model") or "").strip(),
                "payloadHash": self._draft_payload_hash(payload),
            }
            index_path = os.path.join(self._concept_job_storage_dir(), "draft-jobs.jsonl")
            with open(index_path, "a", encoding="utf-8") as handle:
                handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
        except Exception:
            pass

    def _find_latest_draft_job_id(self, payload: Dict[str, Any]) -> str:
        try:
            context = ACTION_BODY_CONTEXT.get({})
            if not isinstance(context, dict):
                context = {}
            chat_id = str(context.get("chat_id") or "").strip()
            message_id = str(context.get("message_id") or "").strip()
            user_id = str(context.get("user_id") or "").strip()
            payload_hash = self._draft_payload_hash(payload)
            index_path = os.path.join(self._concept_job_storage_dir(), "draft-jobs.jsonl")
            with open(index_path, "r", encoding="utf-8") as handle:
                lines = handle.readlines()
            now = int(time.time())
            for raw_line in reversed(lines[-1000:]):
                try:
                    record = json.loads(raw_line)
                except Exception:
                    continue
                if record.get("type") != "draft_job":
                    continue
                created_at = int(record.get("createdAt") or 0)
                if created_at and now - created_at > 21600:
                    continue
                record_chat_id = str(record.get("chatId") or "").strip()
                record_message_id = str(record.get("messageId") or "").strip()
                record_user_id = str(record.get("userId") or "").strip()
                if chat_id and record_chat_id and record_chat_id != chat_id:
                    continue
                if message_id and record_message_id and record_message_id != message_id:
                    continue
                if user_id and record_user_id and record_user_id != user_id:
                    continue
                if not chat_id and not message_id and str(record.get("payloadHash") or "") != payload_hash:
                    continue
                job_id = str(record.get("jobId") or "").strip()
                if job_id:
                    return job_id
        except Exception:
            return ""
        return ""

    async def _poll_concept_job(self, job_id: str, headers: Dict[str, str], emitter: Any) -> Dict[str, Any]:
        deadline = time.time() + self.valves.poll_timeout_seconds
        last_stage = ""
        last_heartbeat_at = 0.0
        while time.time() < deadline:
            response = requests.get(
                f"{self.valves.builder_base_url.rstrip('/')}/api/builder/lge/v1/concept-jobs/{job_id}",
                headers=headers,
                timeout=15,
            )
            response.raise_for_status()
            payload = response.json()
            stage = str(payload.get("stage") or payload.get("status") or "").strip() or "running"
            percent = payload.get("percent")
            now = time.time()
            should_emit_heartbeat = stage != last_stage or now - last_heartbeat_at >= 8
            if should_emit_heartbeat:
                await self._emit_status(
                    emitter,
                    self._concept_stage_description(stage),
                    done=False,
                    stage=stage,
                    route="concept_preview",
                    percent=percent,
                )
                last_stage = stage
                last_heartbeat_at = now
            if payload.get("status") in {"done", "failed"}:
                return payload
            await asyncio.sleep(self.valves.poll_interval_seconds)
        return {
            "status": "failed",
            "stage": "failed",
            "error": "concept_preview_poll_timeout",
            "jobId": job_id,
        }

    def _fetch_concept_job(self, job_id: str, headers: Dict[str, str]) -> Dict[str, Any]:
        response = requests.get(
            f"{self.valves.builder_base_url.rstrip('/')}/api/builder/lge/v1/concept-jobs/{job_id}",
            headers=headers,
            timeout=15,
        )
        response.raise_for_status()
        payload = response.json()
        return payload if isinstance(payload, dict) else {"status": "failed", "error": "invalid_concept_job_response", "jobId": job_id}

    def _concept_job_storage_dir(self) -> str:
        storage_dir = os.path.join(os.environ.get("DATA_DIR") or "/home/mrgbiryu/open-webui-data", "atlas-concepts")
        os.makedirs(storage_dir, exist_ok=True)
        return storage_dir

    def _concept_payload_hash(self, payload: Dict[str, Any]) -> str:
        try:
            source = json.dumps(payload or {}, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        except Exception:
            source = str(payload or "")
        return hashlib.sha256(source.encode("utf-8")).hexdigest()

    def _compact_concept_job_index(self, index_path: str) -> None:
        try:
            if not os.path.exists(index_path):
                return
            if os.path.getsize(index_path) < CONCEPT_JOB_INDEX_COMPACT_BYTES:
                return
            with open(index_path, "r", encoding="utf-8") as handle:
                lines = handle.readlines()
            compacted = lines[-CONCEPT_JOB_INDEX_MAX_LINES:]
            tmp_path = f"{index_path}.tmp"
            with open(tmp_path, "w", encoding="utf-8") as handle:
                handle.writelines(compacted)
            os.replace(tmp_path, index_path)
        except Exception:
            pass

    def _append_concept_job_record(self, job_id: str, payload: Dict[str, Any]) -> None:
        normalized_job_id = str(job_id or "").strip()
        if not normalized_job_id:
            return
        try:
            context = ACTION_BODY_CONTEXT.get({})
            if not isinstance(context, dict):
                context = {}
            record = {
                "type": "concept_job",
                "jobId": normalized_job_id,
                "createdAt": int(time.time()),
                "chatId": str(context.get("chat_id") or "").strip(),
                "messageId": str(context.get("message_id") or "").strip(),
                "userId": str(context.get("user_id") or "").strip(),
                "model": str(context.get("model") or "").strip(),
                "payloadHash": self._concept_payload_hash(payload),
            }
            index_path = os.path.join(self._concept_job_storage_dir(), "concept-jobs.jsonl")
            self._compact_concept_job_index(index_path)
            with open(index_path, "a", encoding="utf-8") as handle:
                handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
        except Exception:
            pass

    def _find_latest_concept_job_id(self, payload: Dict[str, Any]) -> str:
        try:
            context = ACTION_BODY_CONTEXT.get({})
            if not isinstance(context, dict):
                context = {}
            chat_id = str(context.get("chat_id") or "").strip()
            message_id = str(context.get("message_id") or "").strip()
            user_id = str(context.get("user_id") or "").strip()
            payload_hash = self._concept_payload_hash(payload)
            index_path = os.path.join(self._concept_job_storage_dir(), "concept-jobs.jsonl")
            with open(index_path, "r", encoding="utf-8") as handle:
                lines = handle.readlines()
            now = int(time.time())
            for raw_line in reversed(lines[-1000:]):
                try:
                    record = json.loads(raw_line)
                except Exception:
                    continue
                if record.get("type") != "concept_job":
                    continue
                created_at = int(record.get("createdAt") or 0)
                if created_at and now - created_at > 21600:
                    continue
                record_chat_id = str(record.get("chatId") or "").strip()
                record_message_id = str(record.get("messageId") or "").strip()
                record_user_id = str(record.get("userId") or "").strip()
                if chat_id and record_chat_id and record_chat_id != chat_id:
                    continue
                if message_id and record_message_id and record_message_id != message_id:
                    continue
                if user_id and record_user_id and record_user_id != user_id:
                    continue
                if not chat_id and not message_id and str(record.get("payloadHash") or "") != payload_hash:
                    continue
                job_id = str(record.get("jobId") or "").strip()
                if job_id:
                    return job_id
        except Exception:
            return ""
        return ""

    def _concept_preview_running_message(self, job: Dict[str, Any], provider_label: str, resumed: bool = False) -> str:
        stage = str(job.get("stage") or job.get("status") or "queued").strip() or "queued"
        percent = job.get("percent")
        percent_text = f" ({percent}%)" if percent not in (None, "") else ""
        lead = "컨셉서 생성 상태를 확인했습니다." if resumed else "컨셉서 생성을 시작했습니다."
        return (
            "\n\n## 컨셉서 생성 중\n\n"
            f"{lead} {provider_label}이 요구사항을 바탕으로 컨셉서를 작성하고 있습니다.\n\n"
            f"- 현재 단계: {self._concept_stage_description(stage)}{percent_text}\n"
            "- 아직 빌드는 실행하지 않았습니다.\n\n"
            "완료까지 시간이 걸릴 수 있습니다. 다른 화면으로 이동해도 backend 작업은 계속 진행됩니다. "
            "잠시 후 이 assistant 메시지의 `LGE Builder Draft Action`을 다시 누르면 완료 여부를 확인하고, "
            "완료된 경우 컨셉서를 이 채팅에 표시합니다.\n"
        )

    def _concept_stage_description(self, stage: str) -> str:
        return {
            "queued": "요구사항을 접수했습니다.",
            "resolving_target": "대상 화면을 확인하고 있습니다.",
            "analyzing_references": "레퍼런스를 분석하고 있습니다.",
            "generating_concept": "컨셉서를 작성하고 있습니다.",
            "formatting_concept_document": "검토본을 정리하고 있습니다.",
            "done": "컨셉서가 준비되었습니다.",
            "failed": "컨셉서를 만들지 못했습니다.",
        }.get(str(stage or "").strip(), "컨셉서를 준비하고 있습니다.")

    def _concept_preview_provider(self) -> str:
        value = str(getattr(self.valves, "concept_preview_provider", "local") or "local").strip().lower()
        if value in {"openrouter", "sonnet", "llm"}:
            return "openrouter"
        return "local"

    def _design_author_model(self) -> str:
        value = str(getattr(self.valves, "design_author_model", "") or "").strip()
        return value or "anthropic/claude-sonnet-4.6"

    def _final_build_author_provider(self) -> str:
        # During low-cost UI smoke, concept_preview_provider=local must keep the
        # final draft path off paid OpenRouter models as well.
        return "openrouter" if self._concept_preview_provider() == "openrouter" else "local"

    def _concept_preview_provider_label(self, requirement_draft: Dict[str, Any]) -> str:
        provider = str(requirement_draft.get("builderProvider") or self._concept_preview_provider()).strip().lower()
        if provider in {"openrouter", "sonnet", "llm"}:
            return "컨셉서 생성"
        return "빠른 초안"

    def _early_route(self, frontmatter: Dict[str, Any], markdown_body: str, message: str) -> Dict[str, Any]:
        if not frontmatter:
            fenced_frontmatter = self._extract_fenced_frontmatter(message)
            if fenced_frontmatter:
                return {
                    "route": "frontmatter_format_error",
                    "content": self._fenced_frontmatter_message(fenced_frontmatter),
                    "metadata": {"reasonCode": "frontmatter_must_be_top_level"},
                }
            if self._has_journey_intent(message):
                return {
                    "route": "journey_intake",
                    "content": self._journey_intake_message(),
                    "metadata": {"reasonCode": "customer_journey_or_multipage"},
                }
            if self._looks_like_lge_design_intent(message) or self._extract_reference_urls(message):
                return {}
            return {
                "route": "intake",
                "content": (
                    "\n\nLGE Builder Draft Action은 일반 대화 메시지에서는 빌드하지 않습니다.\n"
                    "`#아틀라스`로 LGE 디자인 요구사항을 정리한 뒤 실행해주세요.\n"
                    "요구사항에는 대상 화면이 메인/카테고리/PLP/제품상세/PDP 중 무엇인지, "
                    "PC인지 모바일인지, 그리고 바꿀 화면 영역을 포함해주세요.\n"
                ),
                "metadata": {"reasonCode": "unrelated_message"},
            }

        if self._truthy_setting(frontmatter, "atlasMode", "atlas") and self._falsey_setting(frontmatter, "builderReady"):
            return {
                "route": "concept_review",
                "content": (
                    "\n\n이 메시지는 아틀라스 컨셉서 초안입니다.\n"
                    "아직 `builderReady:false` 상태라 빌드하지 않습니다.\n"
                    "검토 후 확정하려면 대상 화면, PC/모바일 기준, 변경할 화면 영역, "
                    "변경/유지/금지 조건을 보완하고 `builderReady:true`로 확정해주세요.\n"
                ),
                "metadata": {"reasonCode": "builder_not_ready"},
            }

        if self._truthy_setting(frontmatter, "builderReady") and self._has_journey_intent(markdown_body or message):
            return {
                "route": "journey_intake",
                "content": self._journey_intake_message(),
                "metadata": {"reasonCode": "customer_journey_or_multipage"},
            }

        return {}

    async def _route_requirement_state(
        self,
        requirement_state: Dict[str, Any],
        message: str,
        user: Any,
        emitter: Any,
        confirm_intent: bool = False,
    ) -> Dict[str, Any]:
        state = self._normalize_requirement_state(requirement_state)
        status = str(state.get("status") or "").strip().lower()
        if status == "collecting":
            readiness = {
                "ok": False,
                "missing": state.get("missing", []),
                "ambiguous": state.get("ambiguous", []),
            }
            content = self._requirement_readiness_message(readiness)
            await self._emit_message(emitter, content)
            await self._emit_status(
                emitter,
                "요구사항을 더 수집해야 합니다.",
                done=True,
                stage="collecting",
                route="requirement_state",
            )
            return {
                "content": content.strip(),
                "route": "requirement_state_collecting",
                "blocked": True,
                "draftQueued": False,
                "conceptPreviewQueued": False,
                "requirement_state": state,
                "missing": state.get("missing", []),
                "ambiguous": state.get("ambiguous", []),
            }

        if status == "concept_ready":
            concept_document = self._concept_document_from_requirement_state(state)
            if not concept_document:
                content = self._missing_previous_concept_message()
                await self._emit_message(emitter, content)
                await self._emit_status(emitter, "이전에 생성한 컨셉서를 찾지 못했습니다.", done=True)
                return {
                    "content": content.strip(),
                    "route": "missing_previous_concept",
                    "blocked": True,
                    "reasonCode": "missing_previous_concept",
                    "requirement_state": state,
                }
            self._debug_action_note(
                "concept_ready_build",
                concept_ref=str(state.get("conceptDocumentRef") or ""),
                concept_job_id=str(state.get("conceptJobId") or ""),
            )
            await self._emit_status(
                emitter,
                "컨셉서를 확정하고 빌드를 시작합니다.",
                done=False,
                stage="concept_ready",
                route="requirement_state",
            )
            return await self._run_final_build_route(
                self._mark_concept_document_builder_ready(concept_document, concept_job_id=str(state.get("conceptJobId") or "")),
                user,
                emitter,
            )

        if status == "build_ready":
            concept_document = self._concept_document_from_requirement_state(state)
            if not concept_document:
                content = self._missing_previous_concept_message()
                await self._emit_message(emitter, content)
                await self._emit_status(emitter, "이전에 생성한 컨셉서를 찾지 못했습니다.", done=True)
                return {
                    "content": content.strip(),
                    "route": "missing_previous_concept",
                    "blocked": True,
                    "reasonCode": "missing_previous_concept",
                    "requirement_state": state,
                }
            self._debug_action_note(
                "build_ready_build",
                concept_ref=str(state.get("conceptDocumentRef") or ""),
                concept_job_id=str(state.get("conceptJobId") or ""),
            )
            return await self._run_final_build_route(
                self._mark_concept_document_builder_ready(concept_document, concept_job_id=str(state.get("conceptJobId") or "")),
                user,
                emitter,
            )

        if status == "built":
            content = "\n\n이미 빌드 완료 상태입니다. 새 수정이 필요하면 요구사항을 변경해 컨셉서를 다시 생성해주세요."
            await self._emit_message(emitter, content)
            await self._emit_status(emitter, "이미 빌드 완료 상태입니다.", done=True, stage="built", route="requirement_state")
            return {
                "content": content.strip(),
                "route": "built",
                "blocked": True,
                "requirement_state": state,
            }

        if status in {"ready_for_concept", "revision_requested"}:
            concept_preview_payload = {
                "requirementDraft": self._normalize_requirement_draft(
                    self._requirement_draft_from_requirement_state(state, message),
                    message,
                )
            }
            return await self._run_concept_preview_route(concept_preview_payload, user, emitter)

        return {}

    def _concept_preview_payload(
        self,
        message: str,
        frontmatter: Dict[str, Any],
        structured_requirement_draft: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        if self._truthy_setting(frontmatter, "builderReady"):
            return {}
        if self._falsey_setting(frontmatter, "builderReady"):
            return {}

        if structured_requirement_draft:
            requirement_draft = self._requirement_draft_from_structured_requirement(structured_requirement_draft, message)
        elif frontmatter and not self._truthy_setting(frontmatter, "builderReady"):
            requirement_draft = self._requirement_draft_from_frontmatter(frontmatter, message)
        elif self._looks_like_lge_design_intent(message) or self._extract_reference_urls(message):
            requirement_draft = self._requirement_draft_from_message(message)
        else:
            return {}

        if not requirement_draft:
            return {}
        return {"requirementDraft": self._normalize_requirement_draft(requirement_draft, message)}

    def _extract_requirement_state(self, body: Any, selected_message: str = "") -> Optional[Dict[str, Any]]:
        found = self._extract_requirement_state_from_text(selected_message)
        if found:
            return found
        found = self._selected_message_db_requirement_state(body)
        if found:
            return found
        found = self._selected_message_metadata_requirement_state(body)
        if found:
            return found
        found = self._nearest_requirement_state(body)
        if found:
            return found
        if isinstance(body, dict):
            shallow = {key: value for key, value in body.items() if key not in {"history", "messages"}}
            found = self._find_requirement_state_value(shallow)
        else:
            found = self._find_requirement_state_value(body)
        if found:
            return found
        return None

    def _resolve_atlas_history_stage(self, body: Any, selected_message: str = "") -> Optional[Dict[str, Any]]:
        messages = self._selected_chat_messages(body)
        if not messages:
            return None
        last_atlas_index = -1
        for index, item in enumerate(messages):
            if str(item.get("role") or "").strip().lower() == "user" and re.search(r"#\s*아틀라스", str(item.get("text") or ""), re.IGNORECASE):
                last_atlas_index = index
        window = messages[last_atlas_index:] if last_atlas_index >= 0 else messages[-12:]
        if not window:
            return None

        for item in reversed(window):
            text = str(item.get("text") or "")
            if self._is_atlas_build_complete_text(text):
                return {
                    "stage": "built_complete",
                    "message": text,
                    "message_id": item.get("id") or "",
                }

        latest_collecting: Optional[Dict[str, Any]] = None
        latest_ready: Optional[Dict[str, Any]] = None
        for item in reversed(window):
            text = str(item.get("text") or "")
            state = self._extract_requirement_state_from_text(text)
            if not state:
                metadata = item.get("metadata") if isinstance(item.get("metadata"), dict) else None
                state = self._find_requirement_state_value(metadata)
            if not state:
                continue
            normalized = self._normalize_requirement_state(state)
            status = normalized.get("status")
            if status in {"concept_ready", "build_ready"}:
                return {
                    "stage": status,
                    "requirement_state": normalized,
                    "message": text,
                    "message_id": item.get("id") or "",
                }
            if status in {"ready_for_concept", "revision_requested"} and latest_ready is None:
                latest_ready = {
                    "stage": status,
                    "requirement_state": normalized,
                    "message": text,
                    "message_id": item.get("id") or "",
                }
            elif status == "collecting" and latest_collecting is None:
                latest_collecting = {
                    "stage": "collecting",
                    "requirement_state": normalized,
                    "message": text,
                    "message_id": item.get("id") or "",
                }
        if latest_ready:
            return latest_ready
        if latest_collecting:
            return latest_collecting
        return None

    def _selected_chat_messages(self, body: Any) -> List[Dict[str, Any]]:
        if not isinstance(body, dict):
            return []
        chat_id = str(body.get("chat_id") or body.get("chatId") or "").strip()
        message_id = str(body.get("message_id") or body.get("messageId") or body.get("id") or "").strip()
        if not chat_id:
            context = ACTION_BODY_CONTEXT.get({})
            if isinstance(context, dict):
                chat_id = str(context.get("chat_id") or "").strip()
                message_id = message_id or str(context.get("message_id") or "").strip()
        messages_map: Dict[str, Any] = {}
        if chat_id:
            try:
                import sqlite3

                db_path = os.path.join(os.environ.get("DATA_DIR") or "/home/mrgbiryu/open-webui-data", "webui.db")
                con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
                row = con.execute("SELECT chat FROM chat WHERE id=?", (chat_id,)).fetchone()
                con.close()
                if row:
                    chat = json.loads(row[0] or "{}")
                    history = chat.get("history") if isinstance(chat.get("history"), dict) else {}
                    if isinstance(history.get("messages"), dict):
                        messages_map = dict(history.get("messages") or {})
            except Exception as exc:
                self._debug_action_note("selected_chat_messages_db_failed", error=f"{type(exc).__name__}: {exc}")
        if not messages_map:
            history = body.get("history") if isinstance(body.get("history"), dict) else {}
            if isinstance(history.get("messages"), dict):
                messages_map = dict(history.get("messages") or {})
        if messages_map:
            if message_id and message_id in messages_map:
                chain: List[Dict[str, Any]] = []
                current = messages_map.get(message_id)
                visited = set()
                while isinstance(current, dict):
                    current_id = str(current.get("id") or "").strip()
                    if current_id:
                        if current_id in visited:
                            break
                        visited.add(current_id)
                    chain.append(current)
                    parent_id = str(current.get("parentId") or current.get("parent_id") or "").strip()
                    if not parent_id:
                        break
                    current = messages_map.get(parent_id)
                if chain:
                    return [self._chat_message_summary(item) for item in reversed(chain)]
            ordered = sorted(messages_map.values(), key=self._message_sort_key)
            return [self._chat_message_summary(item) for item in ordered]

        messages = body.get("messages")
        if isinstance(messages, dict):
            messages = list(messages.values())
        if isinstance(messages, list):
            selected_index = len(messages)
            if message_id:
                for index, item in enumerate(messages):
                    if isinstance(item, dict) and str(item.get("id") or item.get("message_id") or "").strip() == message_id:
                        selected_index = index + 1
                        break
            return [self._chat_message_summary(item) for item in messages[:selected_index] if isinstance(item, dict)]
        return []

    def _chat_message_summary(self, item: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "id": str(item.get("id") or item.get("message_id") or "").strip(),
            "role": str(item.get("role") or "").strip().lower(),
            "timestamp": self._message_sort_key(item),
            "text": self._text_from_value(item),
            "metadata": item.get("metadata") if isinstance(item.get("metadata"), dict) else {},
        }

    def _message_sort_key(self, item: Any) -> float:
        if not isinstance(item, dict):
            return 0.0
        for key in ("timestamp", "createdAt", "updatedAt"):
            try:
                value = item.get(key)
                if value not in (None, ""):
                    return float(value)
            except Exception:
                continue
        return 0.0

    def _is_atlas_build_complete_text(self, text: str) -> bool:
        value = str(text or "")
        if not value:
            return False
        if "## 빌드 완료" in value and ("runtime-draft" in value or "runtime-compare" in value):
            return True
        if "LGE Builder Draft Ready" in value and "runtime-draft" in value:
            return True
        state = self._extract_requirement_state_from_text(value)
        if state and self._normalize_requirement_state(state).get("status") == "built":
            return True
        return False

    def _selected_message_db_requirement_state(self, body: Any) -> Optional[Dict[str, Any]]:
        if not isinstance(body, dict):
            return None
        chat_id = str(body.get("chat_id") or body.get("chatId") or "").strip()
        message_id = str(body.get("message_id") or body.get("messageId") or body.get("id") or "").strip()
        if not chat_id:
            context = ACTION_BODY_CONTEXT.get({})
            if isinstance(context, dict):
                chat_id = str(context.get("chat_id") or "").strip()
                message_id = message_id or str(context.get("message_id") or "").strip()
        if not chat_id or not message_id:
            return None
        try:
            import sqlite3

            db_path = os.path.join(os.environ.get("DATA_DIR") or "/home/mrgbiryu/open-webui-data", "webui.db")
            con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
            row = con.execute("SELECT chat FROM chat WHERE id=?", (chat_id,)).fetchone()
            con.close()
            if not row:
                return None
            chat = json.loads(row[0] or "{}")
            history = chat.get("history") if isinstance(chat.get("history"), dict) else {}
            messages = history.get("messages") if isinstance(history.get("messages"), dict) else {}
            message = messages.get(message_id)
            if isinstance(message, dict):
                text = self._text_from_value(message)
                if text:
                    found = self._extract_requirement_state_from_text(text)
                    if found:
                        return found
                metadata = message.get("metadata") if isinstance(message.get("metadata"), dict) else None
                found = self._find_requirement_state_value(metadata)
                if found:
                    return found
                found = self._find_requirement_state_value({key: value for key, value in message.items() if key not in {"content", "text"}})
                if found:
                    return found
            return None
        except Exception as exc:
            self._debug_action_note("db_requirement_state_failed", error=f"{type(exc).__name__}: {exc}")
            return None

    def _selected_message_metadata_requirement_state(self, body: Any) -> Optional[Dict[str, Any]]:
        if not isinstance(body, dict):
            return None
        message_id = str(body.get("message_id") or body.get("messageId") or body.get("id") or "").strip()
        if not message_id:
            return None
        history = body.get("history") if isinstance(body.get("history"), dict) else {}
        history_messages = history.get("messages") if isinstance(history.get("messages"), dict) else {}
        candidates: List[Any] = []
        if message_id and message_id in history_messages:
            candidates.append(history_messages.get(message_id))
        messages = body.get("messages")
        if isinstance(messages, dict):
            messages = list(messages.values())
        if isinstance(messages, list):
            for item in messages:
                if isinstance(item, dict) and str(item.get("id") or item.get("message_id") or "").strip() == message_id:
                    candidates.append(item)
        for candidate in candidates:
            if not isinstance(candidate, dict):
                continue
            metadata = candidate.get("metadata") if isinstance(candidate.get("metadata"), dict) else None
            found = self._find_requirement_state_value(metadata)
            if found:
                return found
            sidecar = {key: value for key, value in candidate.items() if key not in {"content", "text"}}
            found = self._find_requirement_state_value(sidecar)
            if found:
                return found
        return None

    def _nearest_requirement_state(self, body: Any) -> Optional[Dict[str, Any]]:
        if not isinstance(body, dict):
            return None
        message_id = str(body.get("message_id") or body.get("messageId") or body.get("id") or "").strip()
        history = body.get("history") if isinstance(body.get("history"), dict) else {}
        history_messages = history.get("messages") if isinstance(history.get("messages"), dict) else {}
        if message_id and history_messages:
            current = history_messages.get(message_id)
            visited = set()
            while isinstance(current, dict):
                current_id = str(current.get("id") or "").strip()
                if current_id:
                    if current_id in visited:
                        break
                    visited.add(current_id)
                metadata = current.get("metadata") if isinstance(current.get("metadata"), dict) else None
                found = self._find_requirement_state_value(metadata)
                if found:
                    return found
                text = self._text_from_value(current)
                if text:
                    found = self._extract_requirement_state_from_text(text)
                    if found:
                        return found
                parent_id = str(current.get("parentId") or current.get("parent_id") or "").strip()
                if not parent_id:
                    break
                current = history_messages.get(parent_id)

        messages = body.get("messages")
        if isinstance(messages, dict):
            messages = list(messages.values())
        if isinstance(messages, list):
            selected_index = len(messages)
            if message_id:
                for index, item in enumerate(messages):
                    if isinstance(item, dict) and str(item.get("id") or item.get("message_id") or "").strip() == message_id:
                        selected_index = index + 1
                        break
            for item in reversed(messages[:selected_index]):
                if not isinstance(item, dict):
                    continue
                metadata = item.get("metadata") if isinstance(item.get("metadata"), dict) else None
                found = self._find_requirement_state_value(metadata)
                if found:
                    return found
                text = self._text_from_value(item)
                if text:
                    found = self._extract_requirement_state_from_text(text)
                    if found:
                        return found
                if found:
                    return found
        return None

    def _find_requirement_state_value(self, value: Any) -> Optional[Dict[str, Any]]:
        if isinstance(value, dict):
            for key in ("requirementState", "requirement_state", "요구사항상태", "요구사항 상태"):
                candidate = value.get(key)
                if isinstance(candidate, dict):
                    return dict(candidate)
            if self._looks_like_requirement_state_dict(value):
                return dict(value)
            for key in ("metadata", "data", "payload", "extra", "concept_preview", "conceptPreview"):
                nested = value.get(key)
                found = self._find_requirement_state_value(nested)
                if found:
                    return found
            text = self._text_from_value(value)
            if text:
                found = self._extract_requirement_state_from_text(text)
                if found:
                    return found
            for nested in value.values():
                if isinstance(nested, (dict, list)):
                    found = self._find_requirement_state_value(nested)
                    if found:
                        return found
        if isinstance(value, list):
            for item in reversed(value):
                found = self._find_requirement_state_value(item)
                if found:
                    return found
        if isinstance(value, str) and len(value) <= 30000:
            return self._extract_requirement_state_from_text(value)
        return None

    def _extract_requirement_state_from_text(self, text: str) -> Optional[Dict[str, Any]]:
        raw_source = str(text or "").strip()
        if not raw_source:
            return None
        marker_match = ATLAS_REQUIREMENT_STATE_RE.search(raw_source)
        if marker_match:
            try:
                parsed = json.loads(marker_match.group("json"))
                if isinstance(parsed, dict):
                    return parsed
            except Exception:
                pass

        source = self._strip_action_result_blocks(raw_source).strip()
        if not source:
            return None

        for candidate in [source, *[match.group("json") for match in FENCED_JSON_RE.finditer(source)]]:
            try:
                parsed = json.loads(candidate)
            except Exception:
                continue
            found = self._find_requirement_state_value(parsed)
            if found:
                return found

        for match in CODE_FENCE_RE.finditer(source):
            lang = str(match.group("lang") or "").strip().lower()
            if lang and lang not in {"yaml", "yml", "json", "markdown", "md"}:
                continue
            body = str(match.group("body") or "").strip()
            if not body:
                continue
            if lang == "json":
                try:
                    parsed = json.loads(body)
                except Exception:
                    parsed = None
                found = self._find_requirement_state_value(parsed)
                if found:
                    return found
            parsed_yaml = self._parse_simple_yaml(body)
            found = self._state_from_yaml_like_dict(parsed_yaml)
            if found:
                return found

        parsed_yaml = self._parse_simple_yaml(source)
        found = self._state_from_yaml_like_dict(parsed_yaml)
        if found:
            return found

        block = self._extract_requirement_state_plain_block(source)
        if block:
            return block
        return None

    def _state_from_yaml_like_dict(self, value: Any) -> Optional[Dict[str, Any]]:
        if not isinstance(value, dict):
            return None
        for key in ("requirementState", "requirement_state", "요구사항상태", "요구사항 상태"):
            candidate = value.get(key)
            if isinstance(candidate, dict):
                return dict(candidate)
        if self._looks_like_requirement_state_dict(value):
            return dict(value)
        return None

    def _extract_requirement_state_plain_block(self, text: str) -> Optional[Dict[str, Any]]:
        lines = str(text or "").splitlines()
        start = 0
        for index, raw_line in enumerate(lines):
            if re.search(r"(requirement\s*state|요구사항\s*상태)", raw_line, re.IGNORECASE):
                start = index + 1
                break
        parsed: Dict[str, Any] = {}
        for raw_line in lines[start:]:
            line = raw_line.strip().strip("|").strip()
            if not line:
                if parsed:
                    break
                continue
            if "|" in line and ":" not in line and "=" not in line:
                cells = [cell.strip() for cell in line.split("|") if cell.strip()]
                if len(cells) >= 2:
                    key = self._normalize_requirement_state_key(cells[0])
                    if key:
                        parsed[key] = cells[1]
                continue
            segments = re.split(r",\s*(?=[A-Za-z가-힣0-9 _/-]+\s*[:=])", line)
            for segment in segments:
                match = REQUIREMENT_LINE_RE.match(segment.strip())
                if not match:
                    continue
                key = self._normalize_requirement_state_key(match.group("key"))
                if key:
                    parsed[key] = match.group("value").strip()
        return parsed if self._looks_like_requirement_state_dict(parsed) else None

    def _looks_like_requirement_state_dict(self, value: Dict[str, Any]) -> bool:
        if not isinstance(value, dict):
            return False
        normalized_keys = {self._normalize_requirement_state_key(key) for key in value.keys()}
        state_keys = {
            "requirementId",
            "version",
            "status",
            "screen",
            "viewport",
            "scope",
            "targetArea",
            "request",
            "purpose",
            "tone",
            "changeLevel",
            "keep",
            "avoid",
            "refs",
            "missing",
            "ambiguous",
            "sourceTurns",
            "conceptDocumentRef",
            "conceptJobId",
        }
        return "status" in normalized_keys and bool(normalized_keys & state_keys)

    def _normalize_requirement_state_key(self, key: Any) -> str:
        value = re.sub(r"\s+", " ", str(key or "").strip().lower().replace("_", " ").replace("-", " "))
        collapsed = value.replace(" ", "")
        state_aliases = {
            "requirementId": {"requirementid", "requirement id", "요구사항id", "요구사항 id"},
            "version": {"version", "버전"},
            "status": {"status", "상태"},
            "missing": {"missing", "누락", "부족", "부족한 항목", "부족항목", "부족한 필수값", "부족한 필수 값", "부족한 필수 항목", "부족필수값"},
            "ambiguous": {"ambiguous", "중의성", "모호", "확인 필요", "확인필요", "확인 필요 항목", "확인필요항목"},
            "sourceTurns": {"sourceturns", "source turns", "출처턴", "source"},
            "conceptDocumentRef": {"conceptdocumentref", "concept document ref", "conceptref", "컨셉서참조", "컨셉서 ref"},
            "conceptJobId": {"conceptjobid", "concept job id", "conceptjob", "컨셉jobid", "컨셉 job id"},
        }
        for canonical, names in state_aliases.items():
            normalized_names = {name.lower() for name in names} | {name.lower().replace(" ", "") for name in names}
            if value in normalized_names or collapsed in normalized_names:
                return canonical
        return self._normalize_requirement_key(key)

    def _normalize_requirement_state(self, source: Dict[str, Any]) -> Dict[str, Any]:
        normalized: Dict[str, Any] = {}
        for key, value in dict(source or {}).items():
            canonical = self._normalize_requirement_state_key(key)
            if canonical:
                normalized[canonical] = value
        status = re.sub(r"[\s-]+", "_", str(normalized.get("status") or "collecting").strip().lower())
        status_aliases = {
            "ready_for_build": "build_ready",
            "buildready": "build_ready",
            "build_ready": "build_ready",
            "ready_to_build": "build_ready",
            "ready_to_draft": "build_ready",
            "draft_ready": "build_ready",
            "빌드준비": "build_ready",
            "빌드_준비": "build_ready",
            "빌드가능": "build_ready",
            "컨셉준비": "concept_ready",
            "컨셉_준비": "concept_ready",
            "conceptready": "concept_ready",
            "ready": "ready_for_concept",
            "ready_for_preview": "ready_for_concept",
            "concept_preview_ready": "ready_for_concept",
        }
        status = status_aliases.get(status, status)
        if status not in REQUIREMENT_STATE_STATUSES:
            status = "collecting"
        normalized["status"] = status
        normalized["missing"] = self._normalize_missing_requirements(normalized.get("missing"))
        normalized["ambiguous"] = self._list_value(normalized.get("ambiguous"))
        if normalized["status"] == "ready_for_concept":
            normalized["missing"] = [item for item in normalized["missing"] if item in {"screen", "viewport", "scope", "request"}]
        if normalized["status"] == "collecting":
            core_present = all(str(normalized.get(key) or "").strip() for key in ("screen", "viewport", "scope", "request"))
            core_missing = [item for item in normalized["missing"] if item in {"screen", "viewport", "scope", "request"}]
            if core_present and not core_missing and not normalized["ambiguous"]:
                normalized["status"] = "ready_for_concept"
                normalized["missing"] = []
        normalized["sourceTurns"] = self._list_value(normalized.get("sourceTurns"))
        return normalized

    def _normalize_missing_requirements(self, value: Any) -> List[str]:
        normalized: List[str] = []
        for item in self._list_value(value):
            canonical = self._normalize_requirement_key(item)
            if canonical in {"screen", "viewport", "scope", "request"}:
                normalized.append(canonical)
                continue
            collapsed = re.sub(r"\s+", "", str(item or "").strip().lower())
            if collapsed in {"대상화면", "화면", "페이지"}:
                normalized.append("screen")
            elif collapsed in {"범위", "작업범위"}:
                normalized.append("scope")
            elif collapsed in {"요청", "요구", "요구사항", "개선요청", "요구사항구체화"}:
                normalized.append("request")
            elif collapsed in {"pcmo", "pc/mo", "피씨모바일", "모바일pc", "모바일피씨"}:
                normalized.append("viewport")
            elif canonical in {"purpose", "tone", "changeLevel", "keep", "avoid", "refs", "targetArea"}:
                continue
            else:
                normalized.append(str(item).strip())
        return list(dict.fromkeys(item for item in normalized if item))

    def _list_value(self, value: Any) -> List[str]:
        if value is None:
            return []
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip() and not self._is_empty_requirement_value(item)]
        text = str(value or "").strip()
        if not text or self._is_empty_requirement_value(text):
            return []
        return [item.strip() for item in re.split(r"[\n,;]+", text) if item.strip() and not self._is_empty_requirement_value(item)]

    def _default_slots_for_page(self, page_id: str) -> List[str]:
        normalized = str(page_id or "").strip()
        slots = BUILDABLE_SLOTS_BY_PAGE.get(normalized)
        if slots:
            return list(slots)
        return ["hero"] if normalized else []

    def _extract_structured_requirement_draft(self, body: Any, message: str = "") -> Optional[Dict[str, Any]]:
        found = self._find_requirement_draft_value(body)
        if found:
            return found
        text = str(message or "").strip()
        if not text:
            return None
        for candidate in [text, *[match.group("json") for match in FENCED_JSON_RE.finditer(text)]]:
            try:
                parsed = json.loads(candidate)
            except Exception:
                continue
            found = self._find_requirement_draft_value(parsed)
            if found:
                return found
        found = self._extract_requirement_format_from_text(text)
        if found:
            return found
        return None

    def _find_requirement_draft_value(self, value: Any) -> Optional[Dict[str, Any]]:
        if isinstance(value, dict):
            for key in ("requirementDraft", "requirement_draft"):
                candidate = value.get(key)
                if isinstance(candidate, dict):
                    return dict(candidate)
            for key in ("requirements", "requirement", "요구사항", "요구사항정리", "atlasRequirement", "atlas_requirement"):
                candidate = value.get(key)
                if isinstance(candidate, dict) and self._looks_like_requirement_format_dict(candidate):
                    return dict(candidate)
            if self._looks_like_requirement_draft_dict(value):
                return dict(value)
            if self._looks_like_requirement_format_dict(value):
                return dict(value)
            for nested in value.values():
                found = self._find_requirement_draft_value(nested)
                if found:
                    return found
        if isinstance(value, list):
            for item in value:
                found = self._find_requirement_draft_value(item)
                if found:
                    return found
        if isinstance(value, str) and len(value) <= 20000:
            found = self._extract_requirement_format_from_text(value)
            if found:
                return found
        return None

    def _looks_like_requirement_draft_dict(self, value: Dict[str, Any]) -> bool:
        keys = set(value.keys())
        draft_keys = {
            "mode",
            "changeLevel",
            "interventionLayer",
            "patchDepth",
            "rendererSurface",
            "builderProvider",
            "journeyMode",
            "scopePreset",
            "targetScope",
            "targetComponents",
            "targetGroupId",
            "title",
            "message",
            "background",
            "direction",
            "tone",
            "avoid",
            "refs",
            "pageId",
            "viewportProfile",
        }
        return bool(keys & draft_keys) and ("message" in keys or "title" in keys or "refs" in keys or "targetComponents" in keys)

    def _looks_like_requirement_format_dict(self, value: Dict[str, Any]) -> bool:
        normalized_keys = {self._normalize_requirement_key(key) for key in value.keys()}
        format_keys = {"screen", "viewport", "scope", "targetArea", "request", "purpose", "changeLevel", "tone", "keep", "avoid", "refs"}
        return len(normalized_keys & format_keys) >= 2 and bool(normalized_keys & {"screen", "viewport", "scope", "request"})

    def _extract_requirement_format_from_text(self, text: str) -> Optional[Dict[str, Any]]:
        source = self._sanitize_requirement_text(text, max_chars=6000)
        if not source:
            return None
        parsed: Dict[str, Any] = {}
        for raw_line in source.splitlines():
            line = raw_line.strip().strip("|").strip()
            if not line:
                continue
            if "|" in line and ":" not in line and "=" not in line:
                cells = [cell.strip() for cell in line.split("|") if cell.strip()]
                if len(cells) >= 2:
                    key = self._normalize_requirement_key(cells[0])
                    if key:
                        parsed[key] = cells[1]
                    continue
            segments = re.split(r",\s*(?=[A-Za-z가-힣0-9 _/-]+\s*[:=])", line)
            for segment in segments:
                match = REQUIREMENT_LINE_RE.match(segment.strip())
                if not match:
                    continue
                key = self._normalize_requirement_key(match.group("key"))
                if not key:
                    continue
                parsed[key] = match.group("value").strip()
        if not self._looks_like_requirement_format_dict(parsed):
            return None
        parsed["_sourceFormat"] = "user_requirement_format"
        return parsed

    def _normalize_requirement_key(self, key: Any) -> str:
        value = re.sub(r"\s+", " ", str(key or "").strip().lower().replace("_", " ").replace("-", " "))
        aliases = {
            "screen": {"screen", "화면", "대상 화면", "대상화면", "page", "페이지"},
            "viewport": {"viewport", "화면 기준", "화면기준", "기기", "디바이스", "device", "뷰포트"},
            "scope": {"scope", "범위", "range", "작업 범위", "작업범위"},
            "targetArea": {"targetarea", "target area", "영역", "대상 영역", "대상영역", "변경 영역", "변경영역", "타겟 영역", "타겟영역"},
            "request": {"request", "요청", "요구", "요구사항", "개선 요청", "개선요청", "what"},
            "purpose": {"purpose", "목적", "goal", "목표"},
            "changeLevel": {"changelevel", "change level", "변경 강도", "변경강도", "수준", "강도"},
            "tone": {"tone", "톤", "무드", "분위기", "mood"},
            "keep": {"keep", "유지", "유지할 것", "유지할것", "must keep", "preserve"},
            "avoid": {"avoid", "금지", "피할 것", "피할것", "제외", "must avoid"},
            "refs": {"refs", "ref", "reference", "references", "referenceurls", "reference urls", "레퍼런스", "참고", "url", "urls"},
        }
        collapsed = value.replace(" ", "")
        for canonical, names in aliases.items():
            normalized_names = {name.lower() for name in names} | {name.lower().replace(" ", "") for name in names}
            if value in normalized_names or collapsed in normalized_names:
                return canonical
        return ""

    def _requirement_draft_from_structured_requirement(self, source: Dict[str, Any], message: str) -> Dict[str, Any]:
        if not self._looks_like_requirement_format_dict(source):
            return dict(source or {})

        normalized = self._canonical_requirement_format(source)
        combined_text = "\n".join(
            str(normalized.get(key) or "").strip()
            for key in ("screen", "viewport", "scope", "targetArea", "request", "purpose", "tone", "keep", "avoid")
            if str(normalized.get(key) or "").strip()
        )
        target = self._resolve_requirement_format_target(normalized, combined_text)
        refs = normalized.get("refs") or self._extract_reference_urls(message)
        if isinstance(refs, str):
            refs = self._extract_reference_urls(refs) or [item.strip() for item in re.split(r"[\n,]", refs) if item.strip()]
        keep_text = self._join_requirement_value(normalized.get("keep"))
        avoid_text = self._join_requirement_value(normalized.get("avoid"))
        purpose_text = self._join_requirement_value(normalized.get("purpose"))
        tone_text = self._join_requirement_value(normalized.get("tone"))
        request_text = self._sanitize_requirement_text(
            self._join_requirement_value(normalized.get("request")) or self._plain_requirement_text(message),
            max_chars=3000,
        )
        direction_parts = [request_text, purpose_text, tone_text]
        if keep_text:
            direction_parts.append(f"유지: {keep_text}")
        if avoid_text:
            direction_parts.append(f"금지: {avoid_text}")
        return {
            "mode": "hybrid",
            "changeLevel": self._normalize_change_level(normalized.get("changeLevel")) or self._change_level_from_text(combined_text) or "medium",
            "interventionLayer": "page" if target["targetScope"] == "page" else "section-group",
            "patchDepth": self._normalize_change_level(normalized.get("changeLevel")) or "medium",
            "rendererSurface": "tailwind",
            "builderProvider": self._concept_preview_provider(),
            "journeyMode": "page",
            "journeyId": "",
            "journeyDiscoveryMode": "none",
            "scopePreset": target["targetGroupId"],
            "targetScope": target["targetScope"],
            "targetSlots": target.get("targetSlots", []),
            "targetComponents": target["targetComponents"],
            "targetGroupId": target["targetGroupId"],
            "targetGroupLabel": target["targetGroupLabel"],
            "title": self._title_from_message(request_text or combined_text or "Atlas 컨셉서 초안"),
            "message": request_text,
            "background": purpose_text,
            "direction": self._sanitize_requirement_text("\n".join(part for part in direction_parts if part), max_chars=3000),
            "tone": tone_text,
            "avoid": avoid_text,
            "refs": [str(item).strip() for item in refs if str(item).strip()],
            "pageId": target["pageId"],
            "viewportProfile": target["viewportProfile"],
            "_missingRequirements": target.get("missing", []),
            "_ambiguousRequirements": target.get("ambiguous", []),
            "_sourceRequirementFormat": normalized,
        }

    def _requirement_draft_from_requirement_state(self, state: Dict[str, Any], message: str) -> Dict[str, Any]:
        normalized_state = self._normalize_requirement_state(state)
        draft = self._requirement_draft_from_structured_requirement(normalized_state, message)
        if not isinstance(draft, dict):
            draft = {}
        requirement_id = str(normalized_state.get("requirementId") or "").strip()
        if requirement_id:
            draft["requirementId"] = requirement_id
        draft["_requirementState"] = normalized_state
        draft["_missingRequirements"] = normalized_state.get("missing", [])
        draft["_ambiguousRequirements"] = normalized_state.get("ambiguous", [])
        return draft

    def _canonical_requirement_format(self, source: Dict[str, Any]) -> Dict[str, Any]:
        normalized: Dict[str, Any] = {}
        for key, value in dict(source or {}).items():
            canonical = self._normalize_requirement_key(key)
            if canonical:
                normalized[canonical] = value
        return normalized

    def _join_requirement_value(self, value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, list):
            return ", ".join(str(item).strip() for item in value if str(item).strip() and not self._is_empty_requirement_value(item))
        text = str(value).strip()
        return "" if self._is_empty_requirement_value(text) else text

    def _is_empty_requirement_value(self, value: Any) -> bool:
        text = re.sub(r"\s+", "", str(value or "").strip().lower())
        return text in {
            "",
            "-",
            "미정",
            "없음",
            "없다",
            "해당없음",
            "해당없다",
            "없습니다",
            "없어요",
            "n/a",
            "na",
            "none",
            "null",
            "notset",
            "unknown",
        }

    def _normalize_change_level(self, value: Any) -> str:
        text = str(value or "").strip().lower()
        if not text:
            return ""
        if text in {"low", "medium", "high"}:
            return text
        if re.search(r"(낮|소폭|가볍|약|light)", text, re.IGNORECASE):
            return "low"
        if re.search(r"(높|강|전면|대대|full|strong|high)", text, re.IGNORECASE):
            return "high"
        if re.search(r"(중간|보통|medium|적당)", text, re.IGNORECASE):
            return "medium"
        return ""

    def _resolve_requirement_format_target(self, requirement: Dict[str, Any], combined_text: str) -> Dict[str, Any]:
        screen = self._join_requirement_value(requirement.get("screen"))
        viewport = self._join_requirement_value(requirement.get("viewport"))
        scope = self._join_requirement_value(requirement.get("scope"))
        target_area = self._join_requirement_value(requirement.get("targetArea"))
        page_id, page_missing, page_ambiguous = self._page_id_from_screen(screen)
        viewport_profile, viewport_missing, viewport_ambiguous = self._viewport_from_requirement(viewport)
        scope_result = self._scope_from_requirement(page_id, scope, target_area, combined_text)
        missing = []
        ambiguous = []
        if page_missing:
            missing.append(page_missing)
        if viewport_missing:
            missing.append(viewport_missing)
        if scope_result.get("missing"):
            missing.extend(scope_result["missing"])
        if page_ambiguous:
            ambiguous.append(page_ambiguous)
        if viewport_ambiguous:
            ambiguous.append(viewport_ambiguous)
        if scope_result.get("ambiguous"):
            ambiguous.extend(scope_result["ambiguous"])
        return {
            "pageId": page_id,
            "viewportProfile": viewport_profile,
            "targetScope": scope_result["targetScope"],
            "targetSlots": scope_result.get("targetSlots", []),
            "targetComponents": scope_result["targetComponents"],
            "targetGroupId": scope_result["targetGroupId"],
            "targetGroupLabel": scope_result["targetGroupLabel"],
            "missing": missing,
            "ambiguous": ambiguous,
        }

    def _page_id_from_screen(self, screen: str) -> Tuple[str, str, str]:
        text = str(screen or "").strip()
        if not text:
            return "", "screen", ""
        if re.search(r"(메인|홈|lge\.co\.kr|home)", text, re.IGNORECASE):
            return "home", "", ""
        if re.search(r"(냉장고).*(카테고리|plp)|refrigerator\s+(category|plp)", text, re.IGNORECASE):
            return "category-refrigerators", "", ""
        if re.search(r"(tv|티비).*(카테고리|plp)|television\s+(category|plp)", text, re.IGNORECASE):
            return "category-tvs", "", ""
        if re.search(r"(카테고리|plp)", text, re.IGNORECASE):
            return "", "", "카테고리는 냉장고/TV 등 어떤 카테고리인지 필요합니다."
        if re.search(r"(pdp|제품\s*상세|제품상세|상세)", text, re.IGNORECASE):
            return "", "", "제품상세/PDP는 제품군과 세부 후보가 필요합니다."
        return "", "screen", ""

    def _viewport_from_requirement(self, viewport: str) -> Tuple[str, str, str]:
        text = str(viewport or "").strip()
        if not text:
            return "", "viewport", ""
        if re.search(r"(모바일|\bmo\b|mobile)", text, re.IGNORECASE):
            return "mo", "", ""
        if re.search(r"(\bpc\b|데스크탑|desktop|웹)", text, re.IGNORECASE):
            return "pc", "", ""
        if re.search(r"(태블릿|tablet|\bta\b)", text, re.IGNORECASE):
            return "", "", "태블릿은 현재 빌드 대상이 아니라 feasibility 대상입니다. PC 또는 모바일을 선택해주세요."
        return "", "viewport", ""

    def _scope_from_requirement(self, page_id: str, scope: str, target_area: str, combined_text: str) -> Dict[str, Any]:
        scope_text = str(scope or "").strip()
        area_text = str(target_area or "").strip()
        search_text = " ".join([scope_text, area_text, str(combined_text or "")])
        if not scope_text:
            return {
                "targetScope": "page",
                "targetSlots": self._default_slots_for_page(page_id),
                "targetComponents": [],
                "targetGroupId": f"{page_id or 'target'}-all",
                "targetGroupLabel": "전체 페이지",
                "missing": ["scope"],
                "ambiguous": [],
            }
        if re.search(
            r"(전체\s*페이지|페이지\s*전체|전체\s*메인|메인\s*전체|메인\s*페이지\s*전체|메인페이지\s*전체|"
            r"전체\s*홈|홈\s*전체|page\s*wide|full)",
            search_text,
            re.IGNORECASE,
        ):
            label = "메인 전체" if page_id == "home" else "전체 페이지"
            return {
                "targetScope": "page",
                "targetSlots": self._default_slots_for_page(page_id),
                "targetComponents": [],
                "targetGroupId": "home-all" if page_id == "home" else f"{page_id or 'target'}-all",
                "targetGroupLabel": label,
                "missing": [],
                "ambiguous": [],
            }
        components: List[str] = []
        if page_id == "home":
            if re.search(r"(히어로|hero|첫\s*화면|상단\s*배너)", search_text, re.IGNORECASE):
                components.append("home.hero")
            if re.search(r"(퀵\s*메뉴|퀵메뉴|quick\s*menu|quickmenu|바로가기)", search_text, re.IGNORECASE):
                components.append("home.quickmenu")
            components = list(dict.fromkeys(components))
            if components:
                return {
                    "targetScope": "components",
                    "targetSlots": [component.split(".", 1)[1] for component in components if "." in component],
                    "targetComponents": components,
                    "targetGroupId": "home-top",
                    "targetGroupLabel": "메인 상단",
                    "missing": [],
                    "ambiguous": [],
                }
        return {
            "targetScope": "page",
            "targetSlots": self._default_slots_for_page(page_id),
            "targetComponents": [],
            "targetGroupId": f"{page_id or 'target'}-top",
            "targetGroupLabel": "상단 영역",
            "missing": [],
            "ambiguous": ["바꿀 화면 영역을 더 구체화해야 합니다. 예: 첫 화면, 상단 배너, 바로가기/퀵메뉴, 제품 리스트."],
        }

    def _requirement_draft_from_frontmatter(self, frontmatter: Dict[str, Any], message: str) -> Dict[str, Any]:
        page_id = self._string_setting(frontmatter, "pageId", "page", default=self.valves.default_page_id)
        target_scope = self._string_setting(frontmatter, "targetScope", default="").strip().lower()
        slots = self._list_setting(frontmatter, "slots", "slotIds", "targetSlots")
        components = self._list_setting(frontmatter, "componentIds", "components", "targetComponents")
        if not components and slots and target_scope != "page":
            components = [f"{page_id}.{slot}" for slot in slots]
        target_group = self._target_group(frontmatter, page_id)
        if not target_scope:
            target_scope = "page" if str(target_group["groupId"]).endswith("-all") else ("components" if components else "page")
        if not slots and target_scope == "page":
            slots = self._default_slots_for_page(page_id)
        return {
            "mode": self._string_setting(frontmatter, "mode", default="hybrid"),
            "changeLevel": self._string_setting(frontmatter, "designChangeLevel", "changeLevel", default="medium"),
            "interventionLayer": self._string_setting(frontmatter, "interventionLayer", default="section-group"),
            "patchDepth": self._string_setting(frontmatter, "patchDepth", default="medium"),
            "rendererSurface": self._string_setting(frontmatter, "rendererSurface", default="tailwind"),
            "builderProvider": self._string_setting(frontmatter, "builderProvider", "plannerProvider", default=self._concept_preview_provider()),
            "scopePreset": self._string_setting(frontmatter, "scopePreset", default=target_group["groupId"]),
            "targetScope": target_scope,
            "targetSlots": slots,
            "targetComponents": components,
            "targetGroupId": target_group["groupId"],
            "targetGroupLabel": target_group["groupLabel"],
            "title": self._concept_title(frontmatter, "", message),
            "message": self._string_setting(frontmatter, "message", "requestText", default=self._plain_requirement_text(message)),
            "background": self._string_setting(frontmatter, "background", default=""),
            "direction": self._string_setting(frontmatter, "direction", "preferredDirection", default=""),
            "tone": self._string_setting(frontmatter, "tone", "toneAndMood", default=""),
            "avoid": self._string_setting(frontmatter, "avoid", "avoidDirection", default=""),
            "refs": self._list_setting(frontmatter, "refs", "referenceUrls"),
            "pageId": page_id,
            "viewportProfile": self._string_setting(frontmatter, "viewportProfile", "viewport", default=self.valves.default_viewport_profile),
        }

    def _requirement_draft_from_message(self, message: str) -> Dict[str, Any]:
        clean_message = self._sanitize_requirement_text(self._plain_requirement_text(message), max_chars=6000)
        target = self._resolve_user_target_hint(clean_message)
        refs = self._extract_reference_urls(clean_message)
        page_id = target["pageId"]
        components = [f"{page_id}.{slot}" for slot in target["slots"] if page_id and str(slot).strip()]
        change_level = self._change_level_from_text(clean_message) or "medium"
        tone = self._tone_from_text(clean_message)
        target_scope = "components" if components else "page"
        return {
            "mode": "hybrid",
            "changeLevel": change_level,
            "interventionLayer": "section-group" if components else "page",
            "patchDepth": change_level,
            "rendererSurface": "tailwind",
            "builderProvider": self._concept_preview_provider(),
            "journeyMode": "page",
            "journeyId": "",
            "journeyDiscoveryMode": "none",
            "scopePreset": target["targetGroupId"],
            "targetScope": target_scope,
            "targetSlots": target.get("slots", []),
            "targetComponents": components,
            "targetGroupId": target["targetGroupId"],
            "targetGroupLabel": target["targetGroupLabel"],
            "title": self._title_from_message(clean_message),
            "message": clean_message,
            "background": "",
            "direction": clean_message,
            "tone": tone,
            "avoid": "",
            "refs": refs,
            "pageId": page_id,
            "viewportProfile": target["viewportProfile"],
            "_missingRequirements": target.get("missing", []),
            "_ambiguousRequirements": target.get("ambiguous", []),
        }

    def _normalize_requirement_draft(self, draft: Dict[str, Any], message: str = "") -> Dict[str, Any]:
        source = dict(draft or {})
        sanitized_message = self._sanitize_requirement_text(message, max_chars=6000)
        structured_format = isinstance(source.get("_sourceRequirementFormat"), dict)
        target = self._resolve_user_target_hint(sanitized_message or json.dumps(source, ensure_ascii=False))
        page_id = str(source.get("pageId") or source.get("page") or ("" if structured_format else target["pageId"]) or self.valves.default_page_id).strip()
        viewport_profile = str(source.get("viewportProfile") or source.get("viewport") or ("" if structured_format else target["viewportProfile"]) or self.valves.default_viewport_profile).strip()
        target_components = source.get("targetComponents") or source.get("componentIds") or source.get("components") or []
        if not isinstance(target_components, list):
            target_components = [item.strip() for item in str(target_components).split(",") if item.strip()]
        target_slots = source.get("targetSlots") or source.get("slots") or source.get("slotIds") or []
        if not isinstance(target_slots, list):
            target_slots = [item.strip() for item in str(target_slots).split(",") if item.strip()]
        target_scope = str(source.get("targetScope") or ("components" if target_components else "page")).strip() or "page"
        if not target_slots and target_scope == "page":
            target_slots = self._default_slots_for_page(page_id)
        if not target_components and not structured_format and target_scope != "page":
            slots = target_slots or target["slots"]
            target_components = [f"{page_id}.{slot}" for slot in slots if str(slot).strip()]
        refs = source.get("refs") if "refs" in source else source.get("referenceUrls", [])
        if isinstance(refs, str):
            refs = self._extract_reference_urls(refs) or [item.strip() for item in refs.splitlines() if item.strip()]
        if not refs:
            refs = self._extract_reference_urls(sanitized_message)
        title = self._sanitize_requirement_text(
            str(source.get("title") or source.get("keyMessage") or self._title_from_message(sanitized_message) or "Atlas 컨셉서 초안"),
            max_chars=160,
        )
        request_message = self._sanitize_requirement_text(
            str(source.get("message") or source.get("requestText") or self._plain_requirement_text(sanitized_message) or title),
            max_chars=6000,
        )
        direction = self._sanitize_requirement_text(
            str(source.get("direction") or source.get("preferredDirection") or request_message),
            max_chars=3000,
        )
        return {
            "mode": str(source.get("mode") or "hybrid").strip() or "hybrid",
            "changeLevel": str(source.get("changeLevel") or source.get("designChangeLevel") or "medium").strip() or "medium",
            "interventionLayer": str(source.get("interventionLayer") or ("section-group" if target_components else "page")).strip() or "section-group",
            "patchDepth": str(source.get("patchDepth") or "medium").strip() or "medium",
            "rendererSurface": str(source.get("rendererSurface") or "tailwind").strip() or "tailwind",
            "builderProvider": str(source.get("builderProvider") or source.get("plannerProvider") or self._concept_preview_provider()).strip() or self._concept_preview_provider(),
            "journeyMode": str(source.get("journeyMode") or ("strategy" if source.get("journeyId") else "page")).strip() or "page",
            "journeyId": str(source.get("journeyId") or "").strip(),
            "journeyDiscoveryMode": str(source.get("journeyDiscoveryMode") or ("strategy-input" if source.get("journeyId") else "none")).strip() or "none",
            "scopePreset": str(source.get("scopePreset") or source.get("targetGroupId") or target["targetGroupId"]).strip(),
            "targetScope": target_scope,
            "targetSlots": [str(item).strip() for item in target_slots if str(item).strip()],
            "targetComponents": [str(item).strip() for item in target_components if str(item).strip()],
            "targetGroupId": str(source.get("targetGroupId") or target["targetGroupId"]).strip(),
            "targetGroupLabel": str(source.get("targetGroupLabel") or target["targetGroupLabel"]).strip(),
            "title": title,
            "message": request_message,
            "background": self._sanitize_requirement_text(str(source.get("background") or ""), max_chars=2000),
            "direction": direction,
            "tone": self._sanitize_requirement_text(str(source.get("tone") or source.get("toneAndMood") or ""), max_chars=1000),
            "avoid": self._sanitize_requirement_text(str(source.get("avoid") or source.get("avoidDirection") or ""), max_chars=1000),
            "refs": [str(item).strip() for item in refs if str(item).strip()],
            "pageId": page_id,
            "viewportProfile": viewport_profile,
            "requirementId": str(source.get("requirementId") or "").strip(),
            "_missingRequirements": source.get("_missingRequirements") if isinstance(source.get("_missingRequirements"), list) else [],
            "_ambiguousRequirements": source.get("_ambiguousRequirements") if isinstance(source.get("_ambiguousRequirements"), list) else [],
            "_sourceRequirementFormat": source.get("_sourceRequirementFormat") if isinstance(source.get("_sourceRequirementFormat"), dict) else None,
            "_requirementState": source.get("_requirementState") if isinstance(source.get("_requirementState"), dict) else None,
        }

    def _resolve_user_target_hint(self, message: str) -> Dict[str, Any]:
        text = str(message or "").lower()
        page_id = self.valves.default_page_id
        missing: List[str] = []
        ambiguous: List[str] = []
        if re.search(r"(냉장고\s*(카테고리|plp)|refrigerator\s+category)", text, re.IGNORECASE):
            page_id = "category-refrigerators"
        elif re.search(r"(tv\s*(카테고리|plp)|티비\s*카테고리|television\s+category)", text, re.IGNORECASE):
            page_id = "category-tvs"
        elif re.search(r"(카테고리|plp)", text, re.IGNORECASE):
            page_id = ""
            ambiguous.append("카테고리는 냉장고/TV 등 어떤 카테고리인지 필요합니다.")
        elif re.search(r"(pdp|제품\s*상세|제품상세)", text, re.IGNORECASE):
            page_id = ""
            ambiguous.append("제품상세/PDP는 제품군과 세부 후보가 필요합니다.")
        elif re.search(r"(메인|홈|lge\.co\.kr|home)", text, re.IGNORECASE):
            page_id = "home"
        else:
            missing.append("screen")
        viewport_profile = self.valves.default_viewport_profile
        if re.search(r"(모바일|\bmo\b|mobile)", text, re.IGNORECASE):
            viewport_profile = "mo"
        elif re.search(r"(\bpc\b|데스크탑|desktop|웹)", text, re.IGNORECASE):
            viewport_profile = "pc"
        elif re.search(r"(태블릿|tablet|\bta\b)", text, re.IGNORECASE):
            viewport_profile = ""
            ambiguous.append("태블릿은 현재 빌드 대상이 아니라 feasibility 대상입니다. PC 또는 모바일을 선택해주세요.")
        else:
            missing.append("viewport")
        if page_id == "home":
            if re.search(
                r"(전체\s*메인|메인\s*전체|메인\s*페이지\s*전체|메인페이지\s*전체|페이지\s*전체|"
                r"full\s*home|전체\s*홈|홈\s*전체|전체\s*페이지)",
                text,
                re.IGNORECASE,
            ):
                slots = []
                target_group_id = "home-all"
                target_group_label = "메인 전체"
            else:
                slots = ["hero", "quickmenu"]
                target_group_id = "home-top"
                target_group_label = "메인 상단"
        else:
            slots = ["hero"]
            target_group_id = f"{page_id}-top"
            target_group_label = "상단 영역"
        return {
            "pageId": page_id,
            "viewportProfile": viewport_profile,
            "slots": slots,
            "targetGroupId": target_group_id,
            "targetGroupLabel": target_group_label,
            "missing": missing,
            "ambiguous": ambiguous,
        }

    def _plain_requirement_text(self, message: str) -> str:
        text = str(message or "").strip()
        text = re.sub(r"^#\s*아틀라스\s*", "", text, flags=re.IGNORECASE).strip()
        return text

    def strip_openwebui_reasoning_details(self, text: str) -> str:
        value = OPENWEBUI_REASONING_DETAILS_RE.sub("", str(text or ""))
        value = GENERIC_REASONING_DETAILS_RE.sub("", value)
        return value

    def strip_reasoning_blocks(self, text: str) -> str:
        value = self.strip_openwebui_reasoning_details(text)
        value = THINK_BLOCK_RE.sub("", value)
        lines = []
        skipping = False
        for raw_line in value.splitlines():
            line = raw_line.strip()
            if re.match(r"^(thought|reasoning|chain[-\s]?of[-\s]?thought|internal\s+trace)\s*:", line, re.IGNORECASE):
                skipping = True
                continue
            if skipping and (not line or re.match(r"^#{1,4}\s+", line)):
                skipping = False
            if not skipping:
                lines.append(raw_line)
        return "\n".join(lines)

    def strip_large_code_debug_blocks(self, text: str) -> str:
        def replace(match: Any) -> str:
            lang = str(match.group("lang") or "").strip().lower()
            body = str(match.group("body") or "")
            lowered = body.lower()
            is_debug = (
                len(body) > 1200
                or lang in {"yaml", "yml", "json", "trace", "debug", "log"}
                or "buildermarkdown" in lowered
                or "designspecmarkdown" in lowered
                or "requirementplan" in lowered
                or "atlasmode" in lowered
                or "builderready" in lowered
                or REASONING_WORD_RE.search(body)
            )
            return "\n" if is_debug else match.group(0)

        return CODE_FENCE_RE.sub(replace, str(text or ""))

    def _sanitize_requirement_text(self, text: str, max_chars: int = 6000) -> str:
        value = self.strip_reasoning_blocks(text)
        value = self.strip_large_code_debug_blocks(value)
        value = re.sub(r"</?(details|summary)\b[^>]*>", "", value, flags=re.IGNORECASE)
        value = re.sub(r"\n{3,}", "\n\n", value).strip()
        if REASONING_WORD_RE.search(value[:500]):
            value = REASONING_WORD_RE.sub("", value)
        if max_chars > 0 and len(value) > max_chars:
            value = value[:max_chars].rstrip()
        return value

    def _extract_reference_urls(self, message: str) -> List[str]:
        return [item.rstrip(".,)") for item in URL_RE.findall(str(message or ""))]

    def _concept_preview_project_id(self, payload: Dict[str, Any]) -> str:
        draft = payload.get("requirementDraft") if isinstance(payload.get("requirementDraft"), dict) else {}
        return str(draft.get("projectId") or draft.get("externalProjectId") or self.valves.default_project_id)

    def _concept_preview_done_message(self, job: Dict[str, Any]) -> str:
        requirement_draft = job.get("requirementDraft") if isinstance(job.get("requirementDraft"), dict) else {}
        requirement_plan = job.get("requirementPlan") if isinstance(job.get("requirementPlan"), dict) else {}
        concept_document = str(job.get("conceptDocument") or "")
        planner_provider = str(job.get("plannerProvider") or requirement_draft.get("plannerProvider") or requirement_draft.get("builderProvider") or "local").strip().lower()
        is_local_preview = planner_provider == "local"
        lead = (
            "빠른 검토용 초안이 준비되었습니다. 아직 빌드는 실행하지 않았습니다."
            if is_local_preview
            else
            "컨셉서가 준비되었습니다. 아직 빌드는 실행하지 않았습니다."
        )
        concept_display = self._repair_display_markdown(str(job.get("conceptDisplayMarkdown") or "").strip())
        concept_summary = self._format_concept_display_for_chat(concept_display or self._visible_concept_summary(concept_document))
        concept_ref = self._store_concept_document(concept_document)
        requirement_state = self._requirement_state_from_concept_preview_job(job, requirement_draft, concept_ref)
        job["_conceptDocumentRef"] = concept_ref
        job["_requirementState"] = requirement_state
        return (
            "\n\n# 컨셉서 검토본\n\n"
            f"{lead}\n\n"
            f"{concept_summary}\n"
            "\n\n---\n\n"
            "## 다음 행동\n\n"
            "- 수정 요청: 바꿀 방향을 자연어로 다시 말하면 requirementDraft를 갱신해 컨셉서를 다시 만듭니다.\n"
            "- 확정: `이걸로 빌드`, `확정`, `진행`, `빌드해줘` 중 하나를 말한 뒤 Action을 다시 실행합니다.\n"
        )

    def _requirement_state_from_concept_preview_job(
        self,
        job: Dict[str, Any],
        requirement_draft: Dict[str, Any],
        concept_ref: str,
    ) -> Dict[str, Any]:
        draft = requirement_draft if isinstance(requirement_draft, dict) else {}
        source_state = draft.get("_requirementState") if isinstance(draft.get("_requirementState"), dict) else {}
        state = self._normalize_requirement_state(source_state) if source_state else {}
        source_format = draft.get("_sourceRequirementFormat") if isinstance(draft.get("_sourceRequirementFormat"), dict) else {}
        state.update({
            "requirementId": state.get("requirementId") or draft.get("requirementId") or "",
            "version": state.get("version") or 1,
            "status": "concept_ready",
            "screen": state.get("screen") or source_format.get("screen") or self._screen_label(draft.get("pageId")),
            "viewport": state.get("viewport") or source_format.get("viewport") or self._viewport_label(draft.get("viewportProfile")),
            "scope": state.get("scope") or source_format.get("scope") or self._human_scope_label(draft),
            "targetArea": state.get("targetArea") or source_format.get("targetArea") or "",
            "request": state.get("request") or source_format.get("request") or draft.get("message") or "",
            "purpose": state.get("purpose") or source_format.get("purpose") or draft.get("background") or "",
            "tone": state.get("tone") or source_format.get("tone") or draft.get("tone") or "",
            "changeLevel": state.get("changeLevel") or source_format.get("changeLevel") or draft.get("changeLevel") or "",
            "keep": state.get("keep") or source_format.get("keep") or "",
            "avoid": state.get("avoid") or source_format.get("avoid") or draft.get("avoid") or "",
            "refs": state.get("refs") or source_format.get("refs") or draft.get("refs") or [],
            "missing": [],
            "ambiguous": [],
            "sourceTurns": state.get("sourceTurns") or [],
            "conceptDocumentRef": concept_ref,
            "conceptJobId": str(job.get("jobId") or job.get("id") or state.get("conceptJobId") or ""),
            "completedAt": str(job.get("completedAt") or ""),
        })
        return state

    def _concept_preview_summary_lines(self, requirement_draft: Dict[str, Any], requirement_plan: Dict[str, Any]) -> str:
        draft = requirement_draft if isinstance(requirement_draft, dict) else {}
        message = str(draft.get("message") or "").strip()
        direction = str(draft.get("direction") or draft.get("tone") or "").strip()
        avoid = str(draft.get("avoid") or "").strip()
        change = str(draft.get("changeLevel") or draft.get("designChangeLevel") or "").strip()
        tone = str(draft.get("tone") or "").strip()
        lines = [
            f"- 대상: {self._screen_label(draft.get('pageId'))} / {self._viewport_label(draft.get('viewportProfile'))}",
            f"- 범위: {self._human_scope_label(draft)}",
            f"- 요청: {(message or direction or tone)[:180]}",
            f"- 방향: {(tone or direction or message)[:180]}",
            f"- 변경 강도: {change or 'medium'}",
        ]
        constraint = self._extract_constraint_summary(message + " " + avoid)
        if constraint:
            lines.append(f"- 제약: {constraint}")
        return "\n".join(lines[:6])

    def _screen_label(self, page_id: Any) -> str:
        value = str(page_id or "").strip()
        return {
            "home": "메인",
            "category-refrigerators": "냉장고 카테고리/PLP",
            "category-tvs": "TV 카테고리/PLP",
        }.get(value, "대상 화면")

    def _viewport_label(self, viewport_profile: Any) -> str:
        value = str(viewport_profile or "").strip().lower()
        return {"pc": "PC", "mo": "모바일", "ta": "태블릿 후보"}.get(value, "화면 기준")

    def _human_scope_label(self, draft: Dict[str, Any]) -> str:
        label = str(draft.get("targetGroupLabel") or "").strip()
        if label and not re.search(r"\b(home|category|pdp|hero|quickmenu)\.", label, re.IGNORECASE):
            return label
        return "사용자가 지정한 화면 범위"

    def _extract_named_fragment(self, text: str, labels: List[str]) -> str:
        for label in labels:
            pattern = re.compile(rf"{re.escape(label)}\s*=\s*([^,\\n]+)", re.IGNORECASE)
            match = pattern.search(str(text or ""))
            if match:
                return match.group(1).strip()[:140]
        return ""

    def _extract_constraint_summary(self, text: str) -> str:
        value = str(text or "").strip()
        matches = re.findall(
            r"([^.\n]*(?:유지|금지|제외|벗어나|하지\s*않|말아|피하|avoid|keep|preserve)[^.\n]*)",
            value,
            flags=re.IGNORECASE,
        )
        summary = " / ".join(item.strip(" -:;,.") for item in matches if item.strip())
        return summary[:180]

    def _validate_requirement_draft_readiness(self, requirement_draft: Dict[str, Any]) -> Dict[str, Any]:
        draft = requirement_draft if isinstance(requirement_draft, dict) else {}
        text = " ".join(
            json.dumps(draft.get(key), ensure_ascii=False) if isinstance(draft.get(key), list) else str(draft.get(key) or "")
            for key in (
                "title",
                "message",
                "background",
                "direction",
                "tone",
                "avoid",
                "pageId",
                "viewportProfile",
                "changeLevel",
                "designChangeLevel",
                "patchDepth",
                "targetGroupId",
                "targetGroupLabel",
                "targetComponents",
            )
        )
        missing: List[str] = self._normalize_missing_requirements(draft.get("_missingRequirements")) if isinstance(draft.get("_missingRequirements"), list) else []
        ambiguous: List[str] = [str(item).strip() for item in draft.get("_ambiguousRequirements", []) if str(item).strip()] if isinstance(draft.get("_ambiguousRequirements"), list) else []
        page_ok = bool(str(draft.get("pageId") or "").strip())
        viewport_ok = str(draft.get("viewportProfile") or "").strip().lower() in {"pc", "mo"}
        target_scope_value = str(draft.get("targetScope") or "").strip().lower()
        scope_ok = bool(str(draft.get("targetGroupLabel") or draft.get("targetGroupId") or "").strip()) and target_scope_value in {"page", "components"}
        request_ok = bool(str(draft.get("message") or draft.get("requestText") or "").strip())
        if not page_ok:
            missing.append("screen")
        if not viewport_ok:
            missing.append("viewport")
        if not scope_ok:
            missing.append("scope")
        if not request_ok:
            missing.append("request")
        missing = list(dict.fromkeys(missing))
        ambiguous = list(dict.fromkeys(ambiguous))
        return {
            "ok": not missing and not ambiguous,
            "missing": missing,
            "ambiguous": ambiguous,
            "hasPurpose": bool(str(draft.get("background") or "").strip()) or bool(re.search(r"(목적|목표|purpose|goal)", text, re.IGNORECASE)),
            "hasTone": bool(str(draft.get("tone") or "").strip()),
            "hasChangeLevel": bool(str(draft.get("changeLevel") or draft.get("designChangeLevel") or "").strip()),
            "hasKeepAvoid": bool(str(draft.get("avoid") or "").strip()) or bool(re.search(r"(유지|keep|preserve|금지|avoid)", text, re.IGNORECASE)),
        }

    def _requirement_readiness_message(self, readiness: Dict[str, Any]) -> str:
        missing = readiness.get("missing") if isinstance(readiness.get("missing"), list) else []
        ambiguous = readiness.get("ambiguous") if isinstance(readiness.get("ambiguous"), list) else []
        missing_text = ", ".join(missing) if missing else "요구사항 구체화"
        ambiguous_text = "\n".join(f"- {item}" for item in ambiguous)
        ambiguous_block = f"### 확인이 필요한 항목\n\n{ambiguous_text}\n\n" if ambiguous_text else ""
        return (
            "\n\n## 컨셉서 생성 전에 필수 정보가 더 필요합니다\n\n"
            "컨셉서 생성을 막는 필수값은 대상 화면, viewport, 범위, 요청 내용입니다. "
            "목적, 톤, 변경 강도, 유지/금지 조건은 있으면 참고 정보로 전달하고 없으면 기본값으로 진행합니다.\n"
            f"- 부족한 필수 항목: {missing_text}\n\n"
            f"{ambiguous_block}"
            "아래처럼 한 줄로 보완해주세요.\n\n"
            "`화면=메인, 범위=전체 메인, viewport=모바일, 요청=프리미엄한 느낌으로 개선`\n"
        )

    def _visible_concept_summary(self, concept_document: str) -> str:
        text = self._strip_frontmatter(str(concept_document or ""))
        concept_display_section = self._extract_markdown_section(text, "Concept Display Markdown")
        if concept_display_section:
            return self._repair_display_markdown(concept_display_section)
        builder_section = self._extract_markdown_section(text, "Builder Markdown")
        design_section = self._extract_markdown_section(text, "Design Spec Markdown")
        source = builder_section or design_section or text
        visible_document = self._customer_visible_concept_markdown(builder_section)
        if visible_document:
            return visible_document
        title = self._first_markdown_heading(source) or self._first_markdown_heading(text) or "컨셉 검토본"
        keep_items = self._extract_bullets_under_heading(source, ["유지할 것", "Keep"], limit=3)
        change_items = self._extract_bullets_under_heading(source, ["반드시 바꿀 것", "바꿀 것", "Change"], limit=4)
        concept_items = self._extract_bullets_under_heading(source, ["선택 컨셉", "핵심 방향", "North Star"], limit=3)
        if not concept_items:
            concept_items = self._extract_bullets_under_heading(design_section, ["North Star"], limit=3)

        sections: List[str] = [f"**{title[:120]}**"]
        if concept_items:
            sections.append("\n**핵심 방향**")
            sections.extend(f"- {item}" for item in concept_items)
        if change_items:
            sections.append("\n**바꿀 것**")
            sections.extend(f"- {item}" for item in change_items)
        if keep_items:
            sections.append("\n**유지할 것**")
            sections.extend(f"- {item}" for item in keep_items)
        if len(sections) == 1:
            fallback_lines = [
                line.lstrip("#").strip()
                for line in text.splitlines()
                if line.strip()
                and not line.strip().startswith(("---", ">"))
                and not re.match(r"^#{1,4}\s*(Builder Markdown|Viewport Contract|Builder Instructions|Section Blueprints|Design Spec|Design Spec Markdown|Requirement Draft|Reference URLs|원 요구사항)\b", line.strip(), re.IGNORECASE)
            ]
            sections.extend(f"- {line[:220]}" for line in fallback_lines[:5])
        return "\n".join(sections[:18]).strip()

    def _repair_display_markdown(self, text: str) -> str:
        value = str(text or "").replace("\r\n", "\n").replace("\r", "\n").strip()
        if not value:
            return ""
        line_count = len(value.splitlines())
        heading_count = len(re.findall(r"#{1,6}\s+", value))
        if line_count <= max(3, heading_count):
            value = re.sub(r"[ \t]+(#{1,6})[ \t]+", r"\n\n\1 ", value)
            value = re.sub(r"[ \t]+---(?=\s|$)", "\n\n---\n\n", value)
            value = re.sub(r"[ \t]+-\s+(?=\*\*|[가-힣A-Za-z0-9])", "\n- ", value)
        known_headings = [
            "## 이 페이지가 해야 하는 일",
            "## 왜 지금 럭셔리 톤인가",
            "## 변하지 않아야 할 것들",
            "## 무엇을 바꿀 것인가",
            "## 페이지 구간별 방향",
            "## 컬러 및 비주얼 방향",
            "## 이 개편이 고객에게 주는 것",
            "### 1. 타이포그래피 위계 전면 재설계",
            "### 2. 히어로 영역 시네마틱 스테이지 구조 적용",
            "### 3. 커머스·혜택 카드 밀도 및 배지 스타일 통일",
            "### 4. 전체 섹션 배경 컬러 리듬 재정비",
            "### 상단 진입 영역 (헤더 + 히어로 + 퀵메뉴)",
            "### 커머스 핵심 구간 (MD 추천 · 타임딜 · 베스트 랭킹)",
            "### 브랜드 스토리 구간 (브랜드 쇼룸 · 최신 뉴스 · 스마트라이프)",
            "### 하단 서비스·신뢰 구간 (구독 · 마케팅 · 베스트케어 · 베스트샵)",
        ]
        for heading in known_headings:
            value = re.sub(rf"(^|\n){re.escape(heading)}[ \t]+", rf"\1{heading}\n\n", value)
        repaired_lines: List[str] = []
        heading_body_re = re.compile(
            r"^(#{1,6}\s+(?:\d+\.\s+)?[^\n.!?。]{4,60}?)(\s+(?:LG전자|현재|아무리|첫|중단|전체|고객|이번|이\s+구간|전환|럭셔리|시네마틱|컬러|타이포|히어로|커머스|상단|에디토리얼|페이지).*)$"
        )
        for raw_line in value.splitlines():
            line = raw_line.rstrip()
            match = heading_body_re.match(line) if re.match(r"^#{1,6}\s+", line) and len(line) >= 80 else None
            if match:
                repaired_lines.extend([match.group(1).rstrip(), "", match.group(2).strip()])
            else:
                repaired_lines.append(line)
        value = "\n".join(repaired_lines)
        value = self._repair_common_display_markdown_breaks(value)
        value = re.sub(r"\n{3,}", "\n\n", value).strip()
        return value

    def _repair_common_display_markdown_breaks(self, text: str) -> str:
        value = str(text or "")
        value = re.sub(
            r"^(###\s*상단\s*진입부\s*—\s*헤더\s*&)\n\n(히어로\s*&\s*퀵메뉴)\s+",
            r"\1 \2\n\n",
            value,
            flags=re.MULTILINE,
        )
        value = re.sub(
            r"^(###\s*하단\s*서비스·정보\s*구간\s*—\s*구독\s*·\s*마케팅\s*·\s*케어\s*·\s*베스트샵\s*안내)\s+(배지·칩·레이블\s+등\s+보조\s+UI\s+요소)",
            r"\1\n\n\2",
            value,
            flags=re.MULTILINE,
        )
        value = re.sub(
            r"^(##\s*이\s*제안이)\n\n(고객에게\s*주는\s*가치)\s+",
            r"\1 \2\n\n",
            value,
            flags=re.MULTILINE,
        )
        value = re.sub(
            r"(고객\s+모두를\s+수용하는\s+구조)\s+(이번\s+제안은)",
            r"\1\n\n\2",
            value,
        )
        value = re.sub(r"\n{3,}", "\n\n", value)
        return value

    def _format_concept_display_for_chat(self, text: str) -> str:
        value = self._repair_display_markdown(str(text or ""))
        if not value:
            return ""
        lines: List[str] = []
        for raw_line in value.splitlines():
            line = raw_line.rstrip()
            if re.match(r"^#{1,5}\s+", line):
                lines.append("#" + line)
            elif re.match(r"^#{6}\s+", line):
                lines.append(line)
            else:
                lines.append(line)
        return "\n".join(lines).strip()

    def _customer_visible_concept_markdown(self, builder_section: str) -> str:
        source = str(builder_section or "").strip()
        if not source:
            return ""
        lines: List[str] = []
        skipping_internal = False
        for raw_line in source.splitlines():
            stripped = raw_line.strip()
            if re.match(r"^#{1,4}\s*빌더\s*실행\s*범위\s*$", stripped, re.IGNORECASE):
                skipping_internal = True
                continue
            if skipping_internal and re.match(r"^#{1,4}\s+", stripped):
                skipping_internal = False
            if skipping_internal:
                continue
            if re.search(r"\b(pageId|viewportProfile|targetGroupId|targetScope|targetComponents|componentIds|slotIds)\s*:", stripped):
                continue
            lines.append(raw_line)
        text = "\n".join(lines).strip()
        if not text:
            return ""
        max_chars = 20000
        if len(text) > max_chars:
            text = text[:max_chars].rstrip() + "\n\n_컨셉서가 길어 일부만 표시했습니다. 원문은 빌드 확정용 참조에 보존되어 있습니다._"
        return text

    def _extract_markdown_section(self, text: str, heading: str) -> str:
        pattern = re.compile(rf"^##\s+{re.escape(heading)}\s*$", re.IGNORECASE | re.MULTILINE)
        match = pattern.search(str(text or ""))
        if not match:
            return ""
        rest = str(text or "")[match.end():]
        stop_headings = {
            "Concept Display Markdown": ["Builder Markdown", "Design Spec Markdown"],
            "Builder Markdown": ["Design Spec Markdown"],
            "Design Spec Markdown": ["Viewport Contract", "Builder Instructions", "Section Blueprints"],
        }.get(heading, [])
        next_match = None
        for stop_heading in stop_headings:
            candidate = re.search(rf"^##\s+{re.escape(stop_heading)}\s*$", rest, re.IGNORECASE | re.MULTILINE)
            if candidate and (next_match is None or candidate.start() < next_match.start()):
                next_match = candidate
        return rest[: next_match.start()].strip() if next_match else rest.strip()

    def _first_markdown_heading(self, text: str) -> str:
        for raw_line in str(text or "").splitlines():
            line = raw_line.strip()
            if re.match(r"^#{1,3}\s+", line):
                value = re.sub(r"^#{1,3}\s+", "", line).strip()
                if value and not re.search(r"(Builder Markdown|Design Spec|Viewport Contract|Section Blueprints)", value, re.IGNORECASE):
                    return value
        return ""

    def _extract_bullets_under_heading(self, text: str, headings: List[str], limit: int = 4) -> List[str]:
        lines = str(text or "").splitlines()
        for index, raw_line in enumerate(lines):
            line = raw_line.strip()
            if not any(re.match(rf"^#{{1,4}}\s*{re.escape(heading)}\s*$", line, re.IGNORECASE) for heading in headings):
                continue
            items: List[str] = []
            for candidate in lines[index + 1:]:
                value = candidate.strip()
                if re.match(r"^#{1,4}\s+\S", value):
                    break
                bullet = re.sub(r"^[-*]\s+", "", value).strip()
                if not bullet:
                    continue
                if bullet in {"-", "—"}:
                    continue
                if re.search(r"(viewportProfile|viewportMode|assetVariantPolicy|pageId|targetGroupId|componentIds)", bullet, re.IGNORECASE):
                    continue
                items.append(bullet[:220])
                if len(items) >= limit:
                    return items
            return items
        return []

    def _strip_frontmatter(self, text: str) -> str:
        value = str(text or "")
        if not value.startswith("---"):
            return value
        lines = value.splitlines()
        for index in range(1, len(lines)):
            if lines[index].strip() in {"---", "..."}:
                return "\n".join(lines[index + 1 :]).strip()
        return value

    def _encode_concept_document_marker(self, concept_document: str) -> str:
        concept_id = self._store_concept_document(concept_document)
        if concept_id:
            return self._concept_document_ref_marker(concept_id)
        return ""

    def _store_concept_document(self, concept_document: str) -> str:
        try:
            concept_id = f"acd-{uuid.uuid4().hex}"
            storage_dir = self._concept_job_storage_dir()
            path = os.path.join(storage_dir, f"{concept_id}.md")
            with open(path, "w", encoding="utf-8") as handle:
                handle.write(str(concept_document or ""))
            self._append_concept_document_record(concept_id)
            return concept_id
        except Exception:
            return ""

    def _append_concept_document_record(self, concept_id: str) -> None:
        normalized = re.sub(r"[^A-Za-z0-9_.-]", "", str(concept_id or ""))
        if not normalized:
            return
        try:
            context = ACTION_BODY_CONTEXT.get({})
            if not isinstance(context, dict):
                context = {}
            record = {
                "type": "concept_document",
                "conceptId": normalized,
                "createdAt": int(time.time()),
                "chatId": str(context.get("chat_id") or "").strip(),
                "messageId": str(context.get("message_id") or "").strip(),
                "userId": str(context.get("user_id") or "").strip(),
                "model": str(context.get("model") or "").strip(),
                "source": "lge_builder_action",
            }
            index_path = os.path.join(self._concept_job_storage_dir(), "index.jsonl")
            with open(index_path, "a", encoding="utf-8") as handle:
                handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
        except Exception:
            pass

    def _concept_document_ref_marker(self, concept_id: str) -> str:
        normalized = re.sub(r"[^A-Za-z0-9_.-]", "", str(concept_id or ""))
        return f"<!--ACD_REF:{normalized}-->" if normalized else ""

    def _decode_concept_document_marker(self, text: str) -> str:
        ref_match = ATLAS_CONCEPT_DOCUMENT_REF_RE.search(str(text or ""))
        if ref_match:
            concept_id = re.sub(r"[^A-Za-z0-9_.-]", "", ref_match.group(1))
            if concept_id:
                return self._load_concept_document_ref(concept_id)
        match = ATLAS_CONCEPT_DOCUMENT_MARKER_RE.search(str(text or ""))
        if not match:
            return ""
        try:
            return base64.urlsafe_b64decode(match.group(1).encode("ascii")).decode("utf-8")
        except Exception:
            return ""

    def _concept_document_ref_from_text(self, text: str) -> str:
        ref_match = ATLAS_CONCEPT_DOCUMENT_REF_RE.search(str(text or ""))
        if ref_match:
            return re.sub(r"[^A-Za-z0-9_.-]", "", ref_match.group(1))
        state = self._extract_requirement_state_from_text(text)
        if isinstance(state, dict):
            return re.sub(r"[^A-Za-z0-9_.-]", "", str(state.get("conceptDocumentRef") or ""))
        return ""

    def _load_concept_document_ref(self, concept_id: str) -> str:
        normalized = re.sub(r"[^A-Za-z0-9_.-]", "", str(concept_id or ""))
        if not normalized:
            return ""
        storage_dir = os.path.join(os.environ.get("DATA_DIR") or "/home/mrgbiryu/open-webui-data", "atlas-concepts")
        path = os.path.join(storage_dir, f"{normalized}.md")
        try:
            with open(path, "r", encoding="utf-8") as handle:
                return handle.read()
        except Exception:
            return ""

    def _concept_document_from_requirement_state(self, state: Dict[str, Any]) -> str:
        if not isinstance(state, dict):
            return ""
        ref = str(state.get("conceptDocumentRef") or "").strip()
        if ref:
            return self._load_concept_document_ref(ref)
        return ""

    def _requirement_state_marker(self, state: Dict[str, Any]) -> str:
        compact = {
            key: value
            for key, value in dict(state or {}).items()
            if key in {"requirementId", "version", "status", "screen", "viewport", "scope", "targetArea", "request", "conceptDocumentRef", "conceptJobId", "missing", "ambiguous"}
            and value not in (None, "", [], {})
        }
        if not compact:
            return ""
        try:
            return f"<!--ARS:{json.dumps(compact, ensure_ascii=False, separators=(',', ':'))}-->"
        except Exception:
            return ""

    def _concept_preview_failed_message(self, job: Dict[str, Any]) -> str:
        return (
            "\n\n## Atlas Concept Preview Failed\n\n"
            "컨셉서 생성이 완료되지 않아 draft build를 실행하지 않았습니다.\n\n"
            f"- status: `{job.get('status', 'failed')}`\n"
            f"- stage: `{job.get('stage', '')}`\n"
            f"- error: `{job.get('error', '')}`\n"
            f"- detail: `{job.get('detail', '')}`\n"
        )

    def _looks_like_lge_design_intent(self, message: str) -> bool:
        return bool(LGE_DESIGN_INTENT_RE.search(str(message or "")))

    def _change_level_from_text(self, text: str) -> str:
        value = str(text or "")
        if re.search(r"(high|하이|높게|높은|강하게|크게|전면|대대적|고급\s*수준)", value, re.IGNORECASE):
            return "high"
        if re.search(r"(low|낮게|가볍게|소폭|약하게)", value, re.IGNORECASE):
            return "low"
        if re.search(r"(medium|중간|적당|보통)", value, re.IGNORECASE):
            return "medium"
        return ""

    def _tone_from_text(self, text: str) -> str:
        value = str(text or "")
        tones = []
        for pattern, label in [
            (r"(프리미엄|premium)", "프리미엄"),
            (r"(럭셔리|luxury|고급)", "럭셔리/고급"),
            (r"(미니멀|minimal)", "미니멀"),
            (r"(신뢰|trust)", "신뢰감"),
            (r"(캠페인|campaign)", "캠페인"),
        ]:
            if re.search(pattern, value, re.IGNORECASE):
                tones.append(label)
        return ", ".join(dict.fromkeys(tones))

    def _has_journey_intent(self, message: str) -> bool:
        return bool(JOURNEY_INTENT_RE.search(str(message or "")))

    def _falsey_setting(self, source: Dict[str, Any], *keys: str) -> bool:
        for key in keys:
            value = source.get(key)
            if isinstance(value, bool):
                return value is False
            normalized = str(value or "").strip().lower()
            if normalized in {"false", "no", "n", "0", "off"}:
                return True
        return False

    def _journey_intake_message(self) -> str:
        return (
            "\n\n이 요청은 단일 섹션 빌드가 아니라 고객여정/멀티페이지 설계 가능성이 있습니다.\n"
            "먼저 대상 페이지 목록과 각 페이지별 목표를 나눠야 합니다.\n"
            "예: 메인 → 카테고리/PLP → 제품상세/PDP 흐름에서 각 화면의 목표와 전환 역할을 분리해주세요.\n"
        )

    def _fenced_frontmatter_message(self, fenced_frontmatter: Dict[str, Any]) -> str:
        ready_state = "true" if self._truthy_setting(fenced_frontmatter, "builderReady") else "false"
        return (
            "\n\n## 아틀라스 컨셉서 형식을 다시 정리해야 합니다\n\n"
            "컨셉서 YAML frontmatter는 메시지 최상단에 있어야 합니다. "
            "현재 메시지는 제목이나 설명 뒤의 fenced code block 안에 YAML이 있어 Action이 빌드 입력으로 사용하지 않습니다.\n\n"
            "올바른 형식:\n\n"
            "```markdown\n"
            "---\n"
            "atlasMode: true\n"
            f"builderReady: {ready_state}\n"
            "projectId: ...\n"
            "pageId: ...\n"
            "viewportProfile: pc\n"
            "targetGroupId: ...\n"
            "slots: [...]\n"
            "designChangeLevel: medium\n"
            "---\n"
            "# 컨셉서 제목\n"
            "컨셉서 본문...\n"
            "```\n\n"
            "`builderReady:false` 초안이면 검토 후 최상단 frontmatter 형식으로 다시 확정해주세요. "
            "`builderReady:true`여도 최상단 frontmatter가 아니면 draft build를 호출하지 않습니다.\n"
        )

    def _feasibility_report_message(self, preflight: Dict[str, Any]) -> str:
        reason_code = str(preflight.get("reasonCode") or "concept_too_vague")
        message = str(preflight.get("message") or "Builder preflight rejected this request.")
        unsupported = preflight.get("unsupported") if isinstance(preflight.get("unsupported"), list) else []
        missing = preflight.get("missing") if isinstance(preflight.get("missing"), list) else []
        alternatives = self._feasibility_alternatives(preflight)
        return (
            "\n\n## LGE Builder Feasibility Report\n\n"
            f"- reasonCode: `{reason_code}`\n"
            f"- message: {message}\n"
            "\n### unsupported\n\n"
            "```json\n"
            f"{json.dumps(unsupported, ensure_ascii=False, indent=2)}\n"
            "```\n"
            "\n### missing\n\n"
            "```json\n"
            f"{json.dumps(missing, ensure_ascii=False, indent=2)}\n"
            "```\n"
            "\n### 가능한 대안\n\n"
            f"{alternatives}\n"
        )

    def _feasibility_alternatives(self, preflight: Dict[str, Any]) -> str:
        reason_code = str(preflight.get("reasonCode") or "").strip()
        supported = preflight.get("supported") if isinstance(preflight.get("supported"), dict) else {}
        if reason_code == "unsupported_viewport":
            return "- PC/데스크탑/웹 또는 모바일/MO 중 어느 화면 기준인지 다시 지정해주세요. 현재 태블릿은 빌드 대상이 아닙니다."
        if reason_code == "unsupported_page":
            return (
                "- 대상 화면을 사용자 표현으로 다시 지정해주세요: 메인, 냉장고 카테고리/PLP, TV 카테고리/PLP, "
                "냉장고 제품상세/PDP, TV 제품상세/PDP 중 하나가 필요합니다. "
                "제품상세/PDP는 일반형/글라스/노크온 또는 일반형/프리미엄처럼 세부 후보 확인이 필요할 수 있습니다."
            )
        if reason_code == "unsupported_section":
            return "- 대상 화면 안에서 바꿀 영역을 다시 지정해주세요. 예: 상단 히어로, 바로가기/퀵메뉴, 카테고리 배너, 제품 요약, 구매 고정 영역."
        if reason_code == "unsupported_component":
            return "- 내부 componentId를 직접 쓰기보다 대상 화면과 변경 영역을 사용자 표현으로 다시 정리한 뒤 컨셉서를 재생성해주세요."
        if reason_code in {"missing_asset_policy", "asset_policy_violation"}:
            return "- 상단 무대/히어로는 배경 또는 오브젝트 자산, 바로가기/탭/퀵메뉴는 아이콘 전용 자산처럼 역할을 나눠 다시 정리해주세요."
        if reason_code == "missing_source_snapshot":
            return "- 현재 캡처/런타임 기준 화면이 있는 메인/카테고리/제품상세 범위로 줄이거나, 필요한 화면 캡처 준비가 먼저 필요합니다."
        return "- 대상 화면, PC/모바일 기준, 바꿀 화면 영역, 변경 강도, 변경/유지/금지 조건을 보완한 뒤 다시 실행해주세요."

    def _builder_ready_errors(self, message: str) -> List[str]:
        frontmatter, markdown_body = self._split_frontmatter(message)
        errors: List[str] = []
        if not frontmatter:
            return [
                "YAML frontmatter가 없습니다.",
                "`atlasMode: true`와 `builderReady: true`가 있는 아틀라스 컨셉서 메시지에서 실행해야 합니다.",
            ]
        if not self._truthy_setting(frontmatter, "atlasMode", "atlas"):
            errors.append("`atlasMode: true`가 없습니다.")
        if not self._truthy_setting(frontmatter, "builderReady"):
            errors.append("`builderReady: true`가 없습니다.")
        if not self._string_setting(frontmatter, "projectId", "externalProjectId", default=""):
            errors.append("프로젝트 또는 요구사항 묶음을 식별할 값이 필요합니다.")
        if not self._string_setting(frontmatter, "pageId", "page", default=""):
            errors.append("대상 화면이 메인/카테고리/PLP/제품상세/PDP 중 무엇인지 필요합니다.")
        viewport_profile = self._string_setting(frontmatter, "viewportProfile", "viewport", default="")
        if not viewport_profile:
            errors.append("PC/데스크탑/웹 기준인지 모바일/MO 기준인지 필요합니다.")
        elif str(viewport_profile).strip().lower() not in {"pc", "mo", "ta"}:
            errors.append("화면 기준은 PC/데스크탑/웹 또는 모바일/MO 중 하나로 정리해야 합니다. 태블릿은 현재 예약값입니다.")
        design_change_level = self._string_setting(frontmatter, "designChangeLevel", default="")
        if not design_change_level:
            errors.append("변경 강도 또는 범위가 필요합니다. 예: 낮음/중간/높음.")
        elif str(design_change_level).strip().lower() not in {"low", "medium", "high"}:
            errors.append("변경 강도는 낮음/중간/높음 중 하나로 정리해야 합니다.")
        if not self._has_target_group(frontmatter):
            errors.append("대상 화면 안에서 어떤 영역 묶음을 바꿀지 필요합니다.")
        target_scope = str(self._string_setting(frontmatter, "targetScope", default="") or "").strip().lower()
        intervention_layer = str(self._string_setting(frontmatter, "interventionLayer", default="") or "").strip().lower()
        target_group_id = str(self._string_setting(frontmatter, "targetGroupId", "groupId", default="") or "").strip().lower()
        is_page_scope = target_scope == "page" or intervention_layer == "page" or target_group_id.endswith("-all")
        if (
            not is_page_scope
            and not self._list_setting(frontmatter, "slots", "slotIds", "targetSlots")
            and not self._list_setting(frontmatter, "componentIds", "components", "targetComponents")
        ):
            errors.append("바꿀 화면 영역이 필요합니다. 예: 상단 히어로, 바로가기/퀵메뉴, 배너, 제품 요약.")
        if len(str(markdown_body or "").strip()) < 40:
            errors.append("컨셉서 본문이 너무 짧습니다.")
        return errors

    def _builder_ready_blocked_message(self, errors: List[str]) -> str:
        error_lines = "\n".join(f"- {error}" for error in errors)
        return (
            "\n\n## 아틀라스 빌드가 시작되지 않았습니다\n\n"
            "이 메시지는 아직 빌드 가능한 아틀라스 컨셉서가 아닙니다.\n\n"
            f"{error_lines}\n\n"
            "먼저 `#아틀라스`로 요구사항을 정리하고 컨셉서를 만든 뒤, "
            "그 컨셉서 메시지에서 `LGE Builder Draft Action`을 실행해주세요.\n"
            "사용자는 `lge.co.kr 메인`, `모바일 메인`, `냉장고 카테고리/PLP`, "
            "`제품상세/PDP`처럼 표현해도 되며, 내부 ID 변환은 Atlas parser/Action resolver 계층에서 처리해야 합니다.\n"
        )

    def _extract_message_text(self, body: dict) -> str:
        if not isinstance(body, dict):
            return self._text_from_value(body)

        message_id = str(body.get("message_id") or body.get("messageId") or body.get("id") or "").strip()
        history = body.get("history") if isinstance(body.get("history"), dict) else {}
        history_messages = history.get("messages") if isinstance(history.get("messages"), dict) else {}
        if message_id and message_id in history_messages:
            text = self._text_from_value(history_messages[message_id])
            if text:
                return text

        for key in ("message", "content", "selected_message", "selectedMessage"):
            text = self._text_from_value(body.get(key))
            if text:
                return text

        for key in ("data", "payload"):
            nested = body.get(key)
            if isinstance(nested, dict):
                text = self._extract_message_text(nested)
                if text:
                    return text

        messages = body.get("messages") or []
        if isinstance(messages, dict):
            messages = list(messages.values())
        if isinstance(messages, list):
            for item in reversed(messages):
                text = self._text_from_value(item)
                if text:
                    return text

        return ""

    def _extract_requirement_source_text(self, body: Any, selected_message: str = "") -> str:
        user_messages = self._previous_user_messages(body)
        if user_messages:
            relevant_messages = self._atlas_thread_user_messages(user_messages)
            cleaned_messages: List[str] = []
            for item in relevant_messages:
                text = self._sanitize_requirement_text(item, max_chars=1500)
                if not text or self._is_conversation_control_intent(text):
                    continue
                cleaned_messages.append(text)
            if cleaned_messages:
                return self._sanitize_requirement_text(
                    "\n".join(f"사용자 요구 {index + 1}: {text}" for index, text in enumerate(cleaned_messages)),
                    max_chars=6000,
                )
        return self._sanitize_requirement_text(selected_message, max_chars=6000)

    def _is_confirm_build_intent(self, text: str) -> bool:
        value = self._sanitize_requirement_text(text, max_chars=200).strip()
        return bool(CONFIRM_BUILD_INTENT_RE.match(value))

    def _find_previous_concept_document(self, body: Any) -> str:
        if not isinstance(body, dict):
            return ""
        message_id = str(body.get("message_id") or body.get("messageId") or body.get("id") or "").strip()
        history = body.get("history") if isinstance(body.get("history"), dict) else {}
        history_messages = history.get("messages") if isinstance(history.get("messages"), dict) else {}
        if message_id and history_messages:
            current = history_messages.get(message_id)
            visited = set()
            while isinstance(current, dict):
                current_id = str(current.get("id") or "").strip()
                if current_id:
                    if current_id in visited:
                        break
                    visited.add(current_id)
                parent_id = str(current.get("parentId") or current.get("parent_id") or "").strip()
                if not parent_id:
                    break
                parent = history_messages.get(parent_id)
                concept_document = self._concept_document_from_value(parent)
                if concept_document:
                    return concept_document
                current = parent

        messages = body.get("messages")
        if isinstance(messages, dict):
            messages = list(messages.values())
        if isinstance(messages, list):
            selected_index = len(messages)
            if message_id:
                for index, item in enumerate(messages):
                    if isinstance(item, dict) and str(item.get("id") or item.get("message_id") or "").strip() == message_id:
                        selected_index = index + 1
                        break
            for item in reversed(messages[:selected_index]):
                concept_document = self._concept_document_from_value(item)
                if concept_document:
                    return concept_document

        for key in ("data", "payload"):
            nested = body.get(key)
            if isinstance(nested, dict):
                concept_document = self._find_previous_concept_document(nested)
                if concept_document:
                    return concept_document
        concept_document = self._find_previous_concept_document_from_db(body)
        if concept_document:
            return concept_document
        concept_document = self._find_previous_concept_document_from_index(body)
        if concept_document:
            return concept_document
        return ""

    def _find_previous_concept_document_from_index(self, body: Dict[str, Any]) -> str:
        chat_id = str(body.get("chat_id") or body.get("chatId") or "").strip()
        user_id = str(body.get("user_id") or body.get("userId") or "").strip()
        if not chat_id:
            context = ACTION_BODY_CONTEXT.get({})
            if isinstance(context, dict):
                chat_id = str(context.get("chat_id") or context.get("chatId") or "").strip()
                user_id = user_id or str(context.get("user_id") or context.get("userId") or "").strip()
        else:
            context = ACTION_BODY_CONTEXT.get({})
            if isinstance(context, dict):
                user_id = user_id or str(context.get("user_id") or context.get("userId") or "").strip()
        storage_dir = os.path.join(os.environ.get("DATA_DIR") or "/home/mrgbiryu/open-webui-data", "atlas-concepts")
        index_path = os.path.join(storage_dir, "index.jsonl")
        try:
            with open(index_path, "r", encoding="utf-8") as handle:
                lines = handle.readlines()
            now = int(time.time())
            for raw_line in reversed(lines[-500:]):
                try:
                    record = json.loads(raw_line)
                except Exception:
                    continue
                record_chat_id = str(record.get("chatId") or "").strip()
                record_user_id = str(record.get("userId") or "").strip()
                if chat_id and record_chat_id and record_chat_id != chat_id:
                    continue
                if chat_id and not record_chat_id:
                    pass
                elif chat_id and record_chat_id == chat_id:
                    pass
                elif user_id and record_user_id and record_user_id == user_id:
                    pass
                elif not chat_id and not user_id:
                    pass
                else:
                    continue
                created_at = int(record.get("createdAt") or 0)
                if created_at and now - created_at > 1800:
                    continue
                concept_id = re.sub(r"[^A-Za-z0-9_.-]", "", str(record.get("conceptId") or ""))
                if not concept_id:
                    continue
                concept_document = self._load_concept_document_ref(concept_id)
                if concept_document:
                    return concept_document
        except Exception:
            return ""
        return ""

    def _find_previous_concept_document_from_db(self, body: Dict[str, Any]) -> str:
        chat_id = str(body.get("chat_id") or body.get("chatId") or "").strip()
        message_id = str(body.get("message_id") or body.get("messageId") or body.get("id") or "").strip()
        if not chat_id:
            context = ACTION_BODY_CONTEXT.get({})
            if isinstance(context, dict):
                chat_id = str(context.get("chat_id") or "").strip()
                message_id = message_id or str(context.get("message_id") or "").strip()
        if not chat_id:
            return ""
        try:
            import sqlite3

            db_path = os.path.join(os.environ.get("DATA_DIR") or "/home/mrgbiryu/open-webui-data", "webui.db")
            con = sqlite3.connect(db_path)
            row = con.execute("SELECT chat FROM chat WHERE id=?", (chat_id,)).fetchone()
            con.close()
            if not row:
                return ""
            chat = json.loads(row[0] or "{}")
            history = chat.get("history") if isinstance(chat.get("history"), dict) else {}
            messages = history.get("messages") if isinstance(history.get("messages"), dict) else {}
            ordered_candidates: List[Any] = []
            if message_id and message_id in messages:
                current = messages.get(message_id)
                visited = set()
                while isinstance(current, dict):
                    current_id = str(current.get("id") or "").strip()
                    if current_id:
                        if current_id in visited:
                            break
                        visited.add(current_id)
                    ordered_candidates.append(current)
                    parent_id = str(current.get("parentId") or current.get("parent_id") or "").strip()
                    if not parent_id:
                        break
                    current = messages.get(parent_id)
            ordered_candidates.extend(reversed(list(messages.values())))
            for candidate in ordered_candidates:
                concept_document = self._concept_document_from_value(candidate)
                if concept_document:
                    return concept_document
        except Exception:
            return ""
        return ""

    def _concept_document_from_value(self, value: Any) -> str:
        if isinstance(value, dict):
            state = self._find_requirement_state_value(value)
            concept_document = self._concept_document_from_requirement_state(self._normalize_requirement_state(state)) if state else ""
            if concept_document:
                return concept_document
            for key in ("conceptDocument", "concept_document"):
                candidate = value.get(key)
                if isinstance(candidate, str) and candidate.strip():
                    return candidate
            for key in ("metadata", "concept_preview", "conceptPreview"):
                nested = value.get(key)
                if isinstance(nested, dict):
                    found = self._concept_document_from_value(nested)
                    if found:
                        return found
        return self._concept_document_from_text(self._text_from_value(value))

    def _concept_document_from_text(self, text: str) -> str:
        marker_document = self._decode_concept_document_marker(text)
        if marker_document:
            return marker_document
        state = self._extract_requirement_state_from_text(text)
        state_document = self._concept_document_from_requirement_state(self._normalize_requirement_state(state)) if state else ""
        if state_document:
            return state_document
        value = str(text or "").strip()
        frontmatter, _ = self._split_frontmatter(value)
        if frontmatter and self._truthy_setting(frontmatter, "atlasMode", "atlas"):
            return value
        for match in CODE_FENCE_RE.finditer(value):
            body = str(match.group("body") or "").strip()
            frontmatter, _ = self._split_frontmatter(body)
            if frontmatter and self._truthy_setting(frontmatter, "atlasMode", "atlas"):
                return body
        return ""

    def _mark_concept_document_builder_ready(self, concept_document: str, concept_job_id: str = "") -> str:
        text = str(concept_document or "").strip()
        normalized_concept_job_id = re.sub(r"[^A-Za-z0-9_.-]", "", str(concept_job_id or ""))
        concept_job_line = f"conceptJobId: {json.dumps(normalized_concept_job_id, ensure_ascii=False)}\n" if normalized_concept_job_id else ""
        if not text.startswith("---"):
            return (
                "---\n"
                "atlasMode: true\n"
                "builderReady: true\n"
                f"projectId: {json.dumps(self.valves.default_project_id, ensure_ascii=False)}\n"
                f"pageId: {json.dumps(self.valves.default_page_id, ensure_ascii=False)}\n"
                f"viewportProfile: {json.dumps(self.valves.default_viewport_profile, ensure_ascii=False)}\n"
                f"{concept_job_line}"
                "targetGroupId: \"home-top\"\n"
                "slots: [\"hero\", \"quickmenu\"]\n"
                "designChangeLevel: \"medium\"\n"
                "---\n"
                f"{text}\n"
            )
        lines = text.splitlines()
        end_index = -1
        for index in range(1, len(lines)):
            if lines[index].strip() in {"---", "..."}:
                end_index = index
                break
        if end_index < 0:
            return text
        yaml_lines = lines[1:end_index]
        body_lines = lines[end_index + 1 :]
        seen = set()
        next_yaml: List[str] = []
        builder_ready_written = False
        status_written = False
        for line in yaml_lines:
            key_match = FRONTMATTER_KEY_RE.match(line.strip())
            key = key_match.group(1) if key_match else ""
            if key:
                seen.add(key)
            if key == "builderReady":
                next_yaml.append("builderReady: true")
                builder_ready_written = True
            elif key == "status":
                next_yaml.append('status: "ready"')
                status_written = True
            else:
                next_yaml.append(line)
        if not builder_ready_written:
            next_yaml.insert(0, "builderReady: true")
        if "atlasMode" not in seen:
            next_yaml.insert(0, "atlasMode: true")
        if "projectId" not in seen and "externalProjectId" not in seen:
            next_yaml.append(f"projectId: {json.dumps(self.valves.default_project_id, ensure_ascii=False)}")
        if normalized_concept_job_id and "conceptJobId" not in seen and "concept_job_id" not in seen:
            next_yaml.append(f"conceptJobId: {json.dumps(normalized_concept_job_id, ensure_ascii=False)}")
        if not status_written and "status" not in seen:
            next_yaml.append('status: "ready"')
        return "\n".join(["---", *next_yaml, "---", *body_lines]).strip() + "\n"

    def _missing_previous_concept_message(self) -> str:
        return (
            "\n\n## 이전 컨셉서를 찾지 못했습니다\n\n"
            "확정할 컨셉서 원본이 대화 기록에서 발견되지 않아 빌드를 시작하지 않았습니다.\n"
            "먼저 Action으로 컨셉서를 생성한 뒤, 그 다음 메시지에서 `확정`, `이걸로 빌드`, `진행`, `빌드해줘`라고 요청해주세요.\n"
        )

    def _atlas_thread_built_complete_message(self) -> str:
        return (
            "\n\n## 아틀라스 작업 완료\n\n"
            "이 대화의 아틀라스 작업은 이미 빌드까지 완료되었습니다. "
            "같은 컨셉서를 다시 빌드하지 않습니다.\n\n"
            "새 작업이나 다른 방향의 수정이 필요하면 새 요구사항을 `#아틀라스`로 다시 시작해주세요.\n"
        )

    def _nearest_previous_user_message(self, body: Any) -> str:
        if not isinstance(body, dict):
            return ""
        message_id = str(body.get("message_id") or body.get("messageId") or body.get("id") or "").strip()
        history = body.get("history") if isinstance(body.get("history"), dict) else {}
        history_messages = history.get("messages") if isinstance(history.get("messages"), dict) else {}
        if message_id and history_messages:
            current = history_messages.get(message_id)
            visited = set()
            while isinstance(current, dict):
                current_id = str(current.get("id") or "").strip()
                if current_id:
                    if current_id in visited:
                        break
                    visited.add(current_id)
                role = str(current.get("role") or "").strip().lower()
                if role == "user":
                    text = self._text_from_value(current)
                    if text:
                        return text
                parent_id = str(current.get("parentId") or current.get("parent_id") or "").strip()
                if not parent_id:
                    break
                current = history_messages.get(parent_id)

        messages = body.get("messages")
        if isinstance(messages, dict):
            messages = list(messages.values())
        if isinstance(messages, list):
            selected_index = len(messages)
            if message_id:
                for index, item in enumerate(messages):
                    if isinstance(item, dict) and str(item.get("id") or item.get("message_id") or "").strip() == message_id:
                        selected_index = index
                        break
            for item in reversed(messages[:selected_index]):
                if isinstance(item, dict) and str(item.get("role") or "").strip().lower() == "user":
                    text = self._text_from_value(item)
                    if text:
                        return text

        for key in ("data", "payload"):
            nested = body.get(key)
            if isinstance(nested, dict):
                text = self._nearest_previous_user_message(nested)
                if text:
                    return text
        return ""

    def _previous_user_messages(self, body: Any) -> List[str]:
        if not isinstance(body, dict):
            return []
        message_id = str(body.get("message_id") or body.get("messageId") or body.get("id") or "").strip()
        history = body.get("history") if isinstance(body.get("history"), dict) else {}
        history_messages = history.get("messages") if isinstance(history.get("messages"), dict) else {}
        if message_id and history_messages:
            current = history_messages.get(message_id)
            collected: List[str] = []
            visited = set()
            while isinstance(current, dict):
                current_id = str(current.get("id") or "").strip()
                if current_id:
                    if current_id in visited:
                        break
                    visited.add(current_id)
                role = str(current.get("role") or "").strip().lower()
                if role == "user":
                    text = self._text_from_value(current)
                    if text:
                        collected.append(text)
                parent_id = str(current.get("parentId") or current.get("parent_id") or "").strip()
                if not parent_id:
                    break
                current = history_messages.get(parent_id)
            if collected:
                return list(reversed(collected))

        messages = body.get("messages")
        if isinstance(messages, dict):
            messages = list(messages.values())
        if isinstance(messages, list):
            selected_index = len(messages)
            if message_id:
                for index, item in enumerate(messages):
                    if isinstance(item, dict) and str(item.get("id") or item.get("message_id") or "").strip() == message_id:
                        selected_index = index
                        break
            collected = []
            for item in messages[:selected_index]:
                if isinstance(item, dict) and str(item.get("role") or "").strip().lower() == "user":
                    text = self._text_from_value(item)
                    if text:
                        collected.append(text)
            if collected:
                return collected

        for key in ("data", "payload"):
            nested = body.get(key)
            if isinstance(nested, dict):
                collected = self._previous_user_messages(nested)
                if collected:
                    return collected
        return []

    def _atlas_thread_user_messages(self, messages: List[str]) -> List[str]:
        cleaned = [str(item or "").strip() for item in messages if str(item or "").strip()]
        if not cleaned:
            return []
        start_index = 0
        for index, text in enumerate(cleaned):
            if re.search(r"#\s*아틀라스", text, re.IGNORECASE):
                start_index = index
        return cleaned[start_index:][-8:]

    def _is_conversation_control_intent(self, text: str) -> bool:
        value = self._sanitize_requirement_text(text, max_chars=200).strip()
        if not value:
            return True
        if self._is_confirm_build_intent(value):
            return True
        return bool(
            re.match(
                r"^\s*(초안\s*만들어\s*줘|초안\s*작성|컨셉서\s*(만들어|작성|생성)\s*줘?|이\s*설정으로\s*컨셉서|action\s*실행)\s*[.!。]?\s*$",
                value,
                re.IGNORECASE,
            )
        )

    def _text_from_value(self, value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, str):
            return value
        if isinstance(value, (int, float, bool)):
            return str(value)
        if isinstance(value, list):
            parts = [self._text_from_value(item).strip() for item in value]
            return "\n".join(part for part in parts if part).strip()
        if isinstance(value, dict):
            for key in ("content", "text", "markdown", "value"):
                text = self._text_from_value(value.get(key))
                if text:
                    return text
        return ""

    def _title_from_message(self, message: str) -> str:
        first_line = next((line.strip() for line in message.splitlines() if line.strip()), "")
        return first_line[:80] or "LGE Builder Concept"

    def _split_frontmatter(self, message: str) -> Tuple[Dict[str, Any], str]:
        text = str(message or "")
        if text.startswith("\ufeff"):
            text = text[1:]
        lines = text.splitlines(keepends=True)
        if not lines or lines[0].strip() != "---":
            return {}, text
        for index in range(1, len(lines)):
            if lines[index].strip() in {"---", "..."}:
                yaml_text = "".join(lines[1:index])
                markdown_body = "".join(lines[index + 1 :])
                return self._parse_simple_yaml(yaml_text), markdown_body
        return {}, text

    def _extract_fenced_frontmatter(self, message: str) -> Dict[str, Any]:
        match = FENCED_YAML_FRONTMATTER_RE.search(str(message or ""))
        if not match:
            return {}
        parsed = self._parse_simple_yaml(match.group("yaml") or "")
        if self._truthy_setting(parsed, "atlasMode", "atlas") or self._truthy_setting(parsed, "builderReady") or self._falsey_setting(parsed, "builderReady"):
            return parsed
        return {}

    def _parse_simple_yaml(self, yaml_text: str) -> Dict[str, Any]:
        data: Dict[str, Any] = {}
        lines = str(yaml_text or "").splitlines()
        index = 0
        while index < len(lines):
            raw_line = lines[index]
            stripped = raw_line.strip()
            if not stripped or stripped.startswith("#") or raw_line[:1].isspace():
                index += 1
                continue
            match = FRONTMATTER_KEY_RE.match(stripped)
            if not match:
                index += 1
                continue
            key = match.group(1)
            raw_value = match.group(2).strip()
            if raw_value:
                data[key] = self._parse_yaml_value(raw_value)
                index += 1
                continue
            block: List[str] = []
            index += 1
            while index < len(lines):
                next_raw = lines[index]
                next_stripped = next_raw.strip()
                if next_stripped and not next_raw[:1].isspace():
                    break
                block.append(next_raw)
                index += 1
            data[key] = self._parse_yaml_block(block)
        return data

    def _parse_yaml_block(self, lines: List[str]) -> Any:
        meaningful = [line.strip() for line in lines if line.strip() and not line.strip().startswith("#")]
        if not meaningful:
            return ""
        if all(line.startswith("- ") for line in meaningful):
            return [self._parse_yaml_value(line[2:].strip()) for line in meaningful]
        mapping: Dict[str, Any] = {}
        for line in meaningful:
            match = FRONTMATTER_KEY_RE.match(line)
            if match:
                mapping[match.group(1)] = self._parse_yaml_value(match.group(2).strip())
        return mapping if mapping else "\n".join(meaningful)

    def _parse_yaml_value(self, raw_value: str) -> Any:
        value = self._strip_yaml_comment(str(raw_value or "").strip())
        if not value:
            return ""
        if value[:1] in {"'", '"'} and value[-1:] == value[:1]:
            return value[1:-1]
        lowered = value.lower()
        if lowered in {"true", "false"}:
            return lowered == "true"
        if lowered in {"null", "none", "~"}:
            return None
        if value.startswith("[") and value.endswith("]"):
            inner = value[1:-1].strip()
            if not inner:
                return []
            return [self._parse_yaml_value(item.strip()) for item in self._split_inline_list(inner)]
        if value.startswith("{") and value.endswith("}"):
            return self._parse_inline_mapping(value[1:-1].strip())
        return value

    def _parse_inline_mapping(self, inner: str) -> Dict[str, Any]:
        mapping: Dict[str, Any] = {}
        for item in self._split_inline_list(inner):
            if ":" not in item:
                continue
            key, value = item.split(":", 1)
            normalized_key = key.strip().strip("'\"")
            if normalized_key:
                mapping[normalized_key] = self._parse_yaml_value(value.strip())
        return mapping

    def _split_inline_list(self, value: str) -> List[str]:
        items: List[str] = []
        current = []
        quote = ""
        for char in value:
            if char in {"'", '"'}:
                quote = "" if quote == char else (char if not quote else quote)
            if char == "," and not quote:
                items.append("".join(current).strip())
                current = []
                continue
            current.append(char)
        items.append("".join(current).strip())
        return [item for item in items if item]

    def _strip_yaml_comment(self, value: str) -> str:
        quote = ""
        for index, char in enumerate(value):
            if char in {"'", '"'}:
                quote = "" if quote == char else (char if not quote else quote)
            if char == "#" and not quote and (index == 0 or value[index - 1].isspace()):
                return value[:index].strip()
        return value

    def _concept_title(self, frontmatter: Dict[str, Any], markdown_body: str, original_message: str) -> str:
        title = self._string_setting(frontmatter, "title", "conceptTitle", "name", default="")
        if title:
            return title[:120]
        for line in str(markdown_body or "").splitlines():
            stripped = line.strip()
            if stripped.startswith("#"):
                return stripped.lstrip("#").strip()[:120] or "LGE Builder Concept"
            if stripped:
                return stripped[:120]
        return self._title_from_message(original_message)

    def _target_group(self, frontmatter: Dict[str, Any], page_id: str) -> Dict[str, str]:
        raw_target_group = frontmatter.get("targetGroup")
        if isinstance(raw_target_group, dict):
            group_id = self._string_setting(raw_target_group, "groupId", "id", default="")
            group_label = self._string_setting(raw_target_group, "groupLabel", "label", "name", default="")
        else:
            group_id = self._string_setting(frontmatter, "targetGroupId", "groupId", default="")
            group_label = self._string_setting(frontmatter, "targetGroupLabel", "groupLabel", default="")
            if not group_id and raw_target_group is not None:
                group_id = str(raw_target_group).strip()
        if not group_id:
            group_id = f"{page_id}-top"
        if not group_label:
            group_label = group_id.replace("-", " ")
        return {"groupId": group_id, "groupLabel": group_label}

    def _string_setting(self, source: Dict[str, Any], *keys: str, default: str = "") -> str:
        for key in keys:
            value = source.get(key)
            if value is None:
                continue
            if isinstance(value, (list, dict)):
                continue
            normalized = str(value).strip()
            if normalized:
                return normalized
        return default

    def _truthy_setting(self, source: Dict[str, Any], *keys: str) -> bool:
        for key in keys:
            value = source.get(key)
            if isinstance(value, bool):
                return value
            normalized = str(value or "").strip().lower()
            if normalized in {"true", "yes", "y", "1", "on", "atlas", "아틀라스"}:
                return True
        return False

    def _has_target_group(self, source: Dict[str, Any]) -> bool:
        raw_target_group = source.get("targetGroup")
        if isinstance(raw_target_group, dict):
            return bool(self._string_setting(raw_target_group, "groupId", "id", default=""))
        if raw_target_group is not None and str(raw_target_group).strip():
            return True
        return bool(self._string_setting(source, "targetGroupId", "groupId", default=""))

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

    def _concept_thread_id(self, value: str) -> str:
        normalized = str(value or "").strip()
        if CONCEPT_THREAD_ID_RE.match(normalized):
            return normalized
        return f"ct-{uuid.uuid4()}"

    def _viewport_profile(self, value: str) -> str:
        normalized = str(value or "").strip().lower()
        if normalized in {"pc", "mo", "ta"}:
            return normalized
        fallback = str(self.valves.default_viewport_profile or "pc").strip().lower()
        return fallback if fallback in {"pc", "mo", "ta"} else "pc"

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

    def _user_id(self, user: Any = None) -> str:
        if isinstance(user, dict):
            return str(user.get("id") or user.get("email") or user.get("name") or "openwebui-user")
        return "openwebui-user"
