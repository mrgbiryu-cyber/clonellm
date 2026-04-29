"""
title: LGE Builder Draft Action
author: clonellm
version: 0.1.0
required_open_webui_version: 0.6.0
requirements: requests
"""

import time
import uuid
from typing import Any, Dict, List

import requests
from pydantic import BaseModel, Field


class Action:
    class Valves(BaseModel):
        builder_base_url: str = Field(default="http://localhost:3100")
        builder_public_url: str = Field(default="")
        builder_service_token: str = Field(default="dev-openwebui-builder-token")
        default_project_id: str = Field(default="lge-openwebui-project")
        default_page_id: str = Field(default="home")
        default_viewport_profile: str = Field(default="pc")
        poll_timeout_seconds: int = Field(default=120)
        poll_interval_seconds: float = Field(default=1.0)

    def __init__(self):
        self.valves = self.Valves()

    async def action(self, body: dict, __user__=None, __event_emitter__=None, __event_call__=None):
        message = self._extract_message_text(body)
        if not message:
            return {"content": "LGE Builder: message content is empty."}

        if __event_emitter__:
            await __event_emitter__({"type": "status", "data": {"description": "Queueing LGE builder draft...", "done": False}})

        request_payload = self._build_payload(message)
        headers = self._headers(__user__)
        created = requests.post(
            f"{self.valves.builder_base_url.rstrip('/')}/api/builder/lge/v1/draft",
            json=request_payload,
            headers=headers,
            timeout=30,
        )
        created.raise_for_status()
        job_id = created.json()["jobId"]

        job = self._poll_job(job_id, headers)
        if job.get("status") != "done":
            return {"content": f"LGE Builder job did not complete: `{job_id}`"}

        try:
            requests.post(
                f"{self.valves.builder_base_url.rstrip('/')}/api/builder/lge/v1/jobs/{job_id}/ack",
                json={"stored": True, "source": "open-webui-action"},
                headers=headers,
                timeout=15,
            )
        except Exception:
            pass

        base_url = (self.valves.builder_public_url or self.valves.builder_base_url).rstrip("/")
        preview_url = f"{base_url}{job.get('previewPath', '')}"
        compare_url = f"{base_url}{job.get('comparePath', '')}"

        if __event_emitter__:
            await __event_emitter__({"type": "status", "data": {"description": "LGE builder draft is ready.", "done": True}})

        return {
            "content": (
                "## LGE Builder Draft Ready\n\n"
                f"- Job: `{job_id}`\n"
                f"- Draft: `{job.get('builderRunId', '')}`\n"
                f"- Preview: {preview_url}\n"
                f"- Compare: {compare_url}\n"
            )
        }

    def _headers(self, user: Any = None) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.valves.builder_service_token}",
            "Content-Type": "application/json",
            "X-OpenWebUI-User-Id": self._user_id(user),
            "X-OpenWebUI-Project-Id": self.valves.default_project_id,
            "X-OpenWebUI-Request-Id": f"owui-action-{uuid.uuid4()}",
        }

    def _build_payload(self, message: str) -> Dict[str, Any]:
        concept_id = f"concept-{uuid.uuid4()}"
        page_id = self.valves.default_page_id
        slots = ["hero", "quickmenu"] if page_id == "home" else ["hero"]
        components = [f"{page_id}.{slot}" for slot in slots]
        return {
            "builderApiVersion": "v1",
            "externalProjectId": self.valves.default_project_id,
            "externalConceptId": concept_id,
            "conceptThreadId": f"ct-{uuid.uuid4()}",
            "pageId": page_id,
            "viewportProfile": self.valves.default_viewport_profile,
            "conceptDocument": message,
            "conceptPackage": {
                "title": self._title_from_message(message),
                "targetGroup": {
                    "groupId": f"{page_id}-top",
                    "groupLabel": f"{page_id} top",
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
            },
            "builderOptions": {
                "rendererSurface": "tailwind",
                "designChangeLevel": "medium",
                "patchDepth": "medium",
                "interventionLayer": "section-group",
                "authorProvider": "local",
            },
        }

    def _poll_job(self, job_id: str, headers: Dict[str, str]) -> Dict[str, Any]:
        deadline = time.time() + self.valves.poll_timeout_seconds
        while time.time() < deadline:
            response = requests.get(
                f"{self.valves.builder_base_url.rstrip('/')}/api/builder/lge/v1/jobs/{job_id}",
                headers=headers,
                timeout=15,
            )
            response.raise_for_status()
            payload = response.json()
            if payload.get("status") in {"done", "failed"}:
                return payload
            time.sleep(self.valves.poll_interval_seconds)
        return {"status": "failed", "error": "poll_timeout", "jobId": job_id}

    def _extract_message_text(self, body: dict) -> str:
        messages: List[dict] = body.get("messages") or []
        if messages:
            return str(messages[-1].get("content") or "").strip()
        return str(body.get("content") or body.get("message") or "").strip()

    def _title_from_message(self, message: str) -> str:
        first_line = next((line.strip() for line in message.splitlines() if line.strip()), "")
        return first_line[:80] or "LGE Builder Concept"

    def _user_id(self, user: Any = None) -> str:
        if isinstance(user, dict):
            return str(user.get("id") or user.get("email") or user.get("name") or "openwebui-user")
        return "openwebui-user"
