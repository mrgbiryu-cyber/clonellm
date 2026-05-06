import fs from "node:fs";
import crypto from "node:crypto";
import process from "node:process";

const BASE_URL = String(process.env.OPENWEBUI_BUILDER_BASE_URL || "http://localhost:3100").replace(/\/+$/, "");
const TOKEN = String(process.env.OPENWEBUI_BUILDER_SERVICE_TOKEN || "dev-openwebui-builder-token");
const SAMPLE_PATH = String(process.env.OPENWEBUI_BUILDER_SAMPLE || "data/normalized/sample-openwebui-builder-request-v1.json");

function requestHeaders(extra = {}) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
    "X-OpenWebUI-User-Id": "owui-smoke-user",
    "X-OpenWebUI-Project-Id": "owui-smoke-project",
    "X-OpenWebUI-Request-Id": `owui-smoke-${Date.now()}`,
    ...extra,
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }
  if (!response.ok) throw new Error(`HTTP ${response.status} ${url}: ${JSON.stringify(payload).slice(0, 1000)}`);
  return payload;
}

async function waitForJob(jobId) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < 120000) {
    try {
      const job = await requestJson(`${BASE_URL}/api/builder/lge/v1/jobs/${encodeURIComponent(jobId)}`, {
        headers: requestHeaders(),
      });
      if (job.status === "done") return job;
      if (job.status === "failed") throw new Error(`Builder job failed: ${JSON.stringify(job).slice(0, 2000)}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for job: ${jobId}${lastError ? `; last poll error: ${lastError.message}` : ""}`);
}

async function waitForConceptJob(jobId) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < 60000) {
    try {
      const job = await requestJson(`${BASE_URL}/api/builder/lge/v1/concept-jobs/${encodeURIComponent(jobId)}`, {
        headers: requestHeaders(),
      });
      if (job.status === "done") return job;
      if (job.status === "failed") throw new Error(`Concept job failed: ${JSON.stringify(job).slice(0, 2000)}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for concept job: ${jobId}${lastError ? `; last poll error: ${lastError.message}` : ""}`);
}

async function checkHtml(url, label) {
  const response = await fetch(url);
  const text = await response.text();
  if (!response.ok) throw new Error(`${label} failed HTTP ${response.status}: ${text.slice(0, 500)}`);
  if (!text.includes("<html") && !text.includes("<!doctype")) throw new Error(`${label} did not return HTML`);
  return { status: response.status, bytes: Buffer.byteLength(text) };
}

function assertPresent(value, path) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing required artifact field: ${path}`);
  }
}

function checkArtifactRecord(job, samplePayload = {}) {
  assertPresent(job.artifact, "artifact");
  assertPresent(job.artifactRecord, "artifactRecord");
  assertPresent(job.artifact.artifactRecord, "artifact.artifactRecord");
  assertPresent(job.artifact.metadata, "artifact.metadata");
  assertPresent(job.artifact.links, "artifact.links");
  assertPresent(job.artifact.storage, "artifact.storage");

  const record = job.artifactRecord;
  const embeddedRecord = job.artifact.artifactRecord;
  const metadata = job.artifact.metadata;
  const sourceTrace = record.sourceTrace || {};
  if (record.schemaVersion !== "openwebui-builder-artifact-v1") {
    throw new Error(`Unexpected artifactRecord.schemaVersion: ${record.schemaVersion}`);
  }
  if (record.artifactType !== "lge-builder-draft") {
    throw new Error(`Unexpected artifactRecord.artifactType: ${record.artifactType}`);
  }
  [
    ["artifactRecord.artifactId", record.artifactId],
    ["artifactRecord.builderJobId", record.builderJobId],
    ["artifactRecord.draftBuildId", record.draftBuildId],
    ["artifactRecord.pageId", record.pageId],
    ["artifactRecord.viewportProfile", record.viewportProfile],
    ["artifactRecord.links.previewPath", record.links?.previewPath],
    ["artifactRecord.links.comparePath", record.links?.comparePath],
    ["artifactRecord.storage.recommendedRecordKey", record.storage?.recommendedRecordKey],
    ["artifactRecord.sourceTrace", record.sourceTrace],
    ["artifactRecord.sourceTrace.source", sourceTrace.source],
    ["artifactRecord.sourceTrace.builderJobId", sourceTrace.builderJobId],
    ["artifactRecord.sourceTrace.draftBuildId", sourceTrace.draftBuildId],
    ["artifactRecord.sourceTrace.snapshotTracePath", sourceTrace.snapshotTracePath],
    ["artifact.sourceTrace", job.artifact.sourceTrace],
    ["artifact.metadata.artifactId", metadata.artifactId],
    ["artifact.metadata.draftBuildId", metadata.draftBuildId],
    ["artifact.links.previewPath", job.artifact.links?.previewPath],
    ["artifact.links.comparePath", job.artifact.links?.comparePath],
  ].forEach(([path, value]) => assertPresent(value, path));
  if (record.builderJobId !== job.jobId) throw new Error("artifactRecord.builderJobId does not match jobId");
  if (record.draftBuildId !== job.builderRunId) throw new Error("artifactRecord.draftBuildId does not match builderRunId");
  if (record.links.previewPath !== job.previewPath) throw new Error("artifactRecord.links.previewPath does not match previewPath");
  if (record.links.comparePath !== job.comparePath) throw new Error("artifactRecord.links.comparePath does not match comparePath");
  if (embeddedRecord.artifactId !== record.artifactId) throw new Error("embedded artifactRecord.artifactId mismatch");
  if (metadata.artifactId !== record.artifactId) throw new Error("artifact.metadata.artifactId mismatch");
  if (sourceTrace.source !== "clonellm-builder-api-v1") throw new Error("artifactRecord.sourceTrace.source mismatch");
  if (sourceTrace.conceptDocumentPreserved !== true) throw new Error("artifactRecord.sourceTrace.conceptDocumentPreserved must be true");
  const expectedConceptHash = crypto.createHash("sha256").update(String(samplePayload.conceptDocument || "").replace(/\r\n/g, "\n").trim()).digest("hex");
  if (sourceTrace.conceptDocumentSha256 !== expectedConceptHash) {
    throw new Error("artifactRecord.sourceTrace.conceptDocumentSha256 does not match submitted conceptDocument");
  }
  if (sourceTrace.builderJobId !== job.jobId) throw new Error("artifactRecord.sourceTrace.builderJobId does not match jobId");
  if (sourceTrace.draftBuildId !== job.builderRunId) throw new Error("artifactRecord.sourceTrace.draftBuildId does not match builderRunId");
  if (sourceTrace.snapshotTracePath !== "artifact.snapshotData.authoringStageTrace") {
    throw new Error("artifactRecord.sourceTrace.snapshotTracePath mismatch");
  }
  if (job.artifact.sourceTrace?.draftBuildId !== sourceTrace.draftBuildId) {
    throw new Error("artifact.sourceTrace.draftBuildId does not match artifactRecord.sourceTrace");
  }
  if (samplePayload.externalRequirementId && sourceTrace.externalRequirementId !== samplePayload.externalRequirementId) {
    throw new Error("artifactRecord.sourceTrace.externalRequirementId does not match sample payload");
  }
  if (samplePayload.conceptGroupId && sourceTrace.conceptGroupId !== samplePayload.conceptGroupId) {
    throw new Error("artifactRecord.sourceTrace.conceptGroupId does not match sample payload");
  }
  return {
    artifactId: record.artifactId,
    schemaVersion: record.schemaVersion,
    draftBuildId: record.draftBuildId,
    pageId: record.pageId,
    viewportProfile: record.viewportProfile,
    sourceTrace: {
      source: sourceTrace.source,
      conceptDocumentPreserved: sourceTrace.conceptDocumentPreserved,
      externalRequirementId: sourceTrace.externalRequirementId,
      conceptGroupId: sourceTrace.conceptGroupId,
    },
    recommendedRecordKey: record.storage.recommendedRecordKey,
  };
}

function clonePayload(payload) {
  return JSON.parse(JSON.stringify(payload));
}

function withBuilderMarkdownSections(payload) {
  const next = clonePayload(payload);
  next.conceptDocument = [
    String(next.conceptDocument || "").trim(),
    "",
    "## Concept Display Markdown",
    "",
    "Customer-facing concept display section preserved for smoke verification.",
    "This visible concept text must not replace the full conceptDocument during build.",
    "",
    "## Builder Markdown",
    "",
    "Hero premium builder section preserved for smoke verification.",
    "Quickmenu hierarchy remains scoped to the selected components.",
    "",
    "## Design Spec Markdown",
    "",
    "Design spec section preserved for smoke verification.",
    "Use premium campaign hierarchy while preserving asset-role guardrails.",
  ].join("\n");
  return next;
}

async function checkPreflightCase(label, payload, expected) {
  const preflight = await requestJson(`${BASE_URL}/api/builder/lge/v1/preflight`, {
    method: "POST",
    headers: requestHeaders(),
    body: JSON.stringify(payload),
  });
  if (preflight.ok !== expected.ok) {
    throw new Error(`${label} preflight ok mismatch: expected ${expected.ok}, got ${preflight.ok}`);
  }
  if (preflight.reasonCode !== expected.reasonCode) {
    throw new Error(`${label} preflight reasonCode mismatch: expected ${expected.reasonCode}, got ${preflight.reasonCode}`);
  }
  if (expected.route && preflight.route !== expected.route) {
    throw new Error(`${label} preflight route mismatch: expected ${expected.route}, got ${preflight.route}`);
  }
  if (!preflight.buildable || typeof preflight.buildable !== "object") {
    throw new Error(`${label} preflight missing buildable scope`);
  }
  if (!Array.isArray(preflight.missing)) {
    throw new Error(`${label} preflight missing must be an array`);
  }
  if (!Array.isArray(preflight.unsupported)) {
    throw new Error(`${label} preflight unsupported must be an array`);
  }
  return preflight;
}

async function checkPreflight(samplePayload) {
  const valid = await checkPreflightCase("valid home pc", samplePayload, {
    ok: true,
    route: "build",
    reasonCode: "ok",
  });
  const validSlots = valid.buildable.slots || [];
  const validComponents = valid.buildable.componentIds || [];
  if (valid.buildable.pageId !== "home") throw new Error("valid preflight pageId mismatch");
  if (valid.buildable.viewportProfile !== "pc") throw new Error("valid preflight viewportProfile mismatch");
  if (!validSlots.includes("hero") || !validSlots.includes("quickmenu")) {
    throw new Error(`valid preflight slots missing expected home scope: ${validSlots.join(",")}`);
  }
  if (!validComponents.includes("home.hero") || !validComponents.includes("home.quickmenu")) {
    throw new Error(`valid preflight components missing expected home scope: ${validComponents.join(",")}`);
  }

  const unsupportedPage = clonePayload(samplePayload);
  unsupportedPage.pageId = "unsupported-page";
  unsupportedPage.conceptPackage.targetGroup.componentIds = ["unsupported-page.hero"];
  await checkPreflightCase("unsupported page", unsupportedPage, {
    ok: false,
    route: "feasibility",
    reasonCode: "unsupported_page",
  });

  const tabletViewport = clonePayload(samplePayload);
  tabletViewport.viewportProfile = "ta";
  const ta = await checkPreflightCase("ta viewport", tabletViewport, {
    ok: false,
    route: "feasibility",
    reasonCode: "unsupported_viewport",
  });
  if (!ta.unsupported.some((item) => item.field === "viewportProfile" && item.value === "ta")) {
    throw new Error("ta preflight did not include unsupported viewport detail");
  }

  const unsupportedSlot = clonePayload(samplePayload);
  unsupportedSlot.conceptPackage.targetGroup.slotIds = ["hero", "unsupported-slot"];
  unsupportedSlot.conceptPackage.targetGroup.componentIds = ["home.hero", "home.unsupported-slot"];
  await checkPreflightCase("unsupported slot", unsupportedSlot, {
    ok: false,
    route: "feasibility",
    reasonCode: "unsupported_section",
  });

  return {
    valid: {
      ok: valid.ok,
      route: valid.route,
      reasonCode: valid.reasonCode,
      buildable: valid.buildable,
    },
    unsupportedPage: "unsupported_page",
    tabletViewport: "unsupported_viewport",
    unsupportedSlot: "unsupported_section",
  };
}

async function checkConceptPreviewCase(label, payload, expected = {}) {
  const created = await requestJson(`${BASE_URL}/api/builder/lge/v1/concept-preview`, {
    method: "POST",
    headers: requestHeaders(),
    body: JSON.stringify(payload),
  });
  if (created.status !== "queued") throw new Error(`${label} concept-preview expected queued, got ${created.status}`);
  if (!created.pollUrl || !created.jobId) throw new Error(`${label} concept-preview missing poll contract`);
  const job = await waitForConceptJob(created.jobId);
  [
    ["requirementDraft", job.requirementDraft],
    ["requirementPlan", job.requirementPlan],
    ["conceptDisplayMarkdown", job.conceptDisplayMarkdown],
    ["builderMarkdown", job.builderMarkdown],
    ["designSpecMarkdown", job.designSpecMarkdown],
    ["conceptDocument", job.conceptDocument],
    ["plannerProvider", job.plannerProvider],
    ["completedAt", job.completedAt],
  ].forEach(([path, value]) => assertPresent(value, `${label}.${path}`));
  if (!job.conceptDocument.includes("builderReady: false")) {
    throw new Error(`${label} conceptDocument must stay review-only with builderReady:false`);
  }
  if (!job.conceptDocument.includes("## Builder Markdown") || !job.conceptDocument.includes("## Design Spec Markdown")) {
    throw new Error(`${label} conceptDocument missing markdown sections`);
  }
  if (!job.conceptDocument.includes("## Concept Display Markdown")) {
    throw new Error(`${label} conceptDocument missing user-facing concept display section`);
  }
  if (!job.conceptTrace?.hashes?.conceptDocument) {
    throw new Error(`${label} concept trace hash missing`);
  }
  if (expected.pageId && job.requirementDraft.pageId !== expected.pageId) {
    throw new Error(`${label} requirementDraft.pageId mismatch`);
  }
  if (expected.viewportProfile && job.requirementDraft.viewportProfile !== expected.viewportProfile) {
    throw new Error(`${label} requirementDraft.viewportProfile mismatch`);
  }
  if (expected.referenceUrl && !job.conceptDocument.includes(expected.referenceUrl)) {
    throw new Error(`${label} conceptDocument did not preserve reference URL`);
  }
  return {
    jobId: created.jobId,
    pageId: job.requirementDraft.pageId,
    viewportProfile: job.requirementDraft.viewportProfile,
    plannerProvider: job.plannerProvider,
    conceptDisplayBytes: Buffer.byteLength(job.conceptDisplayMarkdown),
    conceptDocumentBytes: Buffer.byteLength(job.conceptDocument),
  };
}

async function checkConceptPreview() {
  const requirementOnly = await checkConceptPreviewCase("requirement only", {
    requirementDraft: {
      builderProvider: "local",
      pageId: "home",
      viewportProfile: "pc",
      title: "프리미엄 메인 첫 화면",
      message: "메인 첫 화면을 프리미엄 가전 캠페인 느낌으로 정리",
      direction: "히어로와 바로가기의 정보 위계를 강화",
      targetGroupId: "home-top",
      targetGroupLabel: "메인 상단",
      targetComponents: ["home.hero", "home.quickmenu"],
      patchDepth: "medium",
    },
  }, { pageId: "home", viewportProfile: "pc" });

  const referenceOnly = await checkConceptPreviewCase("reference only", {
    requirementDraft: {
      builderProvider: "local",
      pageId: "home",
      viewportProfile: "pc",
      refs: ["https://www.lge.co.kr/"],
      targetGroupId: "home-top",
      targetComponents: ["home.hero", "home.quickmenu"],
    },
  }, { pageId: "home", viewportProfile: "pc", referenceUrl: "https://www.lge.co.kr/" });

  const requirementAndReference = await checkConceptPreviewCase("requirement and reference", {
    pageId: "home",
    viewportProfile: "pc",
    builderProvider: "local",
    requestText: "프리미엄 캠페인 톤으로 첫 화면 개선",
    preferredDirection: "큰 제품 이미지와 명확한 CTA",
    referenceUrls: ["https://www.lge.co.kr/"],
    targetGroupId: "home-top",
    targetComponents: ["home.hero", "home.quickmenu"],
  }, { pageId: "home", viewportProfile: "pc", referenceUrl: "https://www.lge.co.kr/" });

  const mobileHomeTop = await checkConceptPreviewCase("home mo home-top", {
    requirementDraft: {
      builderProvider: "local",
      pageId: "home",
      viewportProfile: "mo",
      title: "모바일 메인 상단 정리",
      message: "모바일 첫 화면에서 캠페인 메시지와 바로가기를 명확히 보이게 정리",
      targetGroupId: "home-top",
      targetGroupLabel: "모바일 메인 상단",
      slots: ["hero", "quickmenu"],
      patchDepth: "medium",
    },
  }, { pageId: "home", viewportProfile: "mo" });

  return {
    requirementOnly,
    referenceOnly,
    requirementAndReference,
    mobileHomeTop,
  };
}

async function createDraftAndWait(payload) {
  const created = await requestJson(`${BASE_URL}/api/builder/lge/v1/draft`, {
    method: "POST",
    headers: requestHeaders(),
    body: JSON.stringify(payload),
  });
  if (created.status !== "queued") throw new Error(`Expected queued job, got: ${created.status}`);
  return waitForJob(created.jobId);
}

async function hydrateJobArtifact(job) {
  if (job?.artifact?.snapshotData) return job;
  const detailPath = job?.artifact?.detailPath || `/api/builder/lge/v1/jobs/${encodeURIComponent(job.jobId)}/artifact`;
  const detail = await requestJson(`${BASE_URL}${detailPath}`, {
    headers: requestHeaders(),
  });
  if (!detail.artifact?.snapshotData) {
    throw new Error(`Hydrated artifact detail missing snapshotData for ${job.jobId}`);
  }
  return {
    ...job,
    artifact: {
      ...(job.artifact || {}),
      ...detail.artifact,
    },
    artifactRecord: detail.artifactRecord || job.artifactRecord,
  };
}

function assertIncludes(value, expected, label) {
  if (!String(value || "").includes(expected)) {
    throw new Error(`${label} missing expected text: ${expected}`);
  }
}

function checkDraftMapping(job, payload) {
  const snapshot = job.artifact?.snapshotData || {};
  const conceptPackage = snapshot.conceptPackage || {};
  const designAuthorInput = snapshot.designAuthorInput || {};
  const executionBrief = conceptPackage.executionBrief || {};
  const authoringMode = String(executionBrief.authoringMode || "");
  const hierarchyGoals = JSON.stringify(conceptPackage.designPolicy?.hierarchyGoals || designAuthorInput.designPolicy?.hierarchyGoals || []);
  const planningDirection = JSON.stringify(designAuthorInput.targetGroup?.layoutIntent || []);
  const preservedConceptDocument = String(snapshot.conceptDocument || "");
  const targetGroup = designAuthorInput.targetGroup || executionBrief.targetGroup || {};
  const targetComponents = Array.isArray(targetGroup.componentIds) ? targetGroup.componentIds : [];
  const requestedComponents = payload.conceptPackage?.targetGroup?.componentIds || [];
  if (requestedComponents.length) {
    if (!targetComponents.includes("home.hero") || !targetComponents.includes("home.quickmenu")) {
      throw new Error(`component targetScope did not preserve requested componentIds: ${targetComponents.join(",")}`);
    }
    if (!authoringMode && !/component|section|group/i.test(JSON.stringify([conceptPackage, designAuthorInput]))) {
      throw new Error("component-scoped draft did not expose component/section authoring context");
    }
  }
  assertIncludes(`${hierarchyGoals}\n${planningDirection}`, "Hero premium builder section preserved", "approvedPlan planningDirection/designDirection");
  assertIncludes(`${hierarchyGoals}\n${planningDirection}`, "Design spec section preserved", "approvedPlan designDirection");
  assertIncludes(`${hierarchyGoals}\n${planningDirection}`, "Customer-facing concept display section preserved", "approvedPlan conceptDisplayMarkdown");
  assertIncludes(preservedConceptDocument, "Customer-facing concept display section preserved", "snapshot.conceptDocument");
  return {
    authoringMode,
    targetComponentCount: targetComponents.length,
    builderSectionPreserved: true,
    designSpecPreserved: true,
  };
}

function checkPageTargetFallback(job) {
  const snapshot = job.artifact?.snapshotData || {};
  const conceptPackage = snapshot.conceptPackage || {};
  const designAuthorInput = snapshot.designAuthorInput || {};
  const pageId = String(snapshot.pageId || job.artifactRecord?.pageId || job.artifact?.metadata?.pageId || "home").trim() || "home";
  const buildInputComponents = snapshot.authoringStageTrace?.buildInput?.componentIds || [];
  const targetComponents = Array.isArray(buildInputComponents) ? buildInputComponents : [];
  if (!targetComponents.length) {
    throw new Error("page target with empty componentIds did not use fallbackTargetComponents");
  }
  const packetSections = Array.isArray(designAuthorInput.designAuthorPacket?.sections)
    ? designAuthorInput.designAuthorPacket.sections
    : [];
  const misalignedPackets = packetSections
    .map((section) => ({
      slotId: String(section?.slotId || "").trim(),
      componentId: String(section?.componentId || "").trim(),
    }))
    .filter((section) => section.slotId && section.componentId.split(".").pop() !== section.slotId);
  if (misalignedPackets.length) {
    throw new Error(`author packet componentIds are not slot-aligned: ${JSON.stringify(misalignedPackets.slice(0, 8))}`);
  }
  const missingExpectedComponentIds = packetSections
    .map((section) => ({
      slotId: String(section?.slotId || "").trim(),
      componentId: String(section?.componentId || "").trim(),
    }))
    .filter((section) => section.slotId && section.componentId !== `${pageId}.${section.slotId}`);
  if (missingExpectedComponentIds.length) {
    throw new Error(`author packet componentIds did not preserve page.slot ids: ${JSON.stringify(missingExpectedComponentIds.slice(0, 8))}`);
  }
  const registryLosses = packetSections
    .filter((section) => section?.assetRegistry?.availableCounts)
    .filter((section) => {
      const counts = section.assetRegistry.availableCounts || {};
      const registry = section.assetRegistry || {};
      const expectedAssets =
        Number(counts.images || 0) +
        Number(counts.iconFamilies || 0) +
        Number(counts.interactionComponents || 0);
      const visibleAssets =
        (Array.isArray(registry.images) ? registry.images.length : 0) +
        (Array.isArray(registry.iconFamilies) ? registry.iconFamilies.length : 0) +
        (Array.isArray(registry.interactionComponents) ? registry.interactionComponents.length : 0);
      return expectedAssets > 0 && visibleAssets === 0;
    })
    .map((section) => ({ slotId: section.slotId, componentId: section.componentId, availableCounts: section.assetRegistry.availableCounts }));
  if (registryLosses.length) {
    throw new Error(`author packet lost asset registry cards for scoped sections: ${JSON.stringify(registryLosses.slice(0, 8))}`);
  }
  const quickmenuPacket = packetSections.find((section) => section?.slotId === "quickmenu") || {};
  if (targetComponents.includes("home.quickmenu")) {
    if (quickmenuPacket.componentId !== "home.quickmenu") {
      throw new Error(`page target did not preserve quickmenu componentId into author packet: ${quickmenuPacket.componentId || "missing"}`);
    }
    const iconFamilies = quickmenuPacket.assetRegistry?.iconFamilies || [];
    if (!Array.isArray(iconFamilies) || !iconFamilies.length) {
      throw new Error("page target quickmenu author packet did not expose approved icon families");
    }
  }
  const heroPacket = packetSections.find((section) => section?.slotId === "hero") || {};
  if (targetComponents.includes("home.hero")) {
    const images = heroPacket.assetRegistry?.images || [];
    const interactions = heroPacket.assetRegistry?.interactionComponents || [];
    if (!Array.isArray(images) || !images.length) {
      throw new Error("page target hero author packet did not expose image registry cards");
    }
    if (!Array.isArray(interactions) || !interactions.length) {
      throw new Error("page target hero author packet did not expose interaction registry cards");
    }
  }
  return {
    targetComponentCount: targetComponents.length,
    authoringMode: conceptPackage.executionBrief?.authoringMode || "",
    quickmenuIconFamilyCount: Array.isArray(quickmenuPacket.assetRegistry?.iconFamilies)
      ? quickmenuPacket.assetRegistry.iconFamilies.length
      : 0,
    heroImageCount: Array.isArray(heroPacket.assetRegistry?.images)
      ? heroPacket.assetRegistry.images.length
      : 0,
    heroInteractionCount: Array.isArray(heroPacket.assetRegistry?.interactionComponents)
      ? heroPacket.assetRegistry.interactionComponents.length
      : 0,
  };
}

async function main() {
  const sampleText = fs.readFileSync(SAMPLE_PATH, "utf8");
  const samplePayload = JSON.parse(sampleText);
  const preflight = await checkPreflight(samplePayload);
  const conceptPreview = await checkConceptPreview();
  const draftPayload = withBuilderMarkdownSections(samplePayload);
  const job = await createDraftAndWait(draftPayload);
  const artifact = checkArtifactRecord(job, draftPayload);
  const hydratedJob = await hydrateJobArtifact(job);
  const draftMapping = checkDraftMapping(hydratedJob, draftPayload);
  const pageTargetPayload = withBuilderMarkdownSections(samplePayload);
  pageTargetPayload.externalConceptId = `${pageTargetPayload.externalConceptId || "concept"}-page-target`;
  pageTargetPayload.conceptThreadId = "ct-00000000-0000-4000-8000-000000000002";
  pageTargetPayload.builderOptions = {
    ...(pageTargetPayload.builderOptions || {}),
    targetScope: "page",
    interventionLayer: "page",
  };
  pageTargetPayload.conceptPackage.targetGroup.componentIds = [];
  const pageTargetJob = await createDraftAndWait(pageTargetPayload);
  const hydratedPageTargetJob = await hydrateJobArtifact(pageTargetJob);
  const pageTargetFallback = checkPageTargetFallback(hydratedPageTargetJob);
  const preview = await checkHtml(`${BASE_URL}${job.previewPath}`, "preview");
  const compare = await checkHtml(`${BASE_URL}${job.comparePath}`, "compare");
  const ack = await requestJson(`${BASE_URL}/api/builder/lge/v1/jobs/${encodeURIComponent(job.jobId)}/ack`, {
    method: "POST",
    headers: requestHeaders(),
    body: JSON.stringify({ stored: true }),
  });
  console.log(JSON.stringify({
    ok: true,
    preflight,
    conceptPreview,
    draftMapping,
    pageTargetFallback,
    jobId: job.jobId,
    builderRunId: job.builderRunId,
    preview,
    compare,
    artifact,
    acknowledged: ack.acknowledged === true,
    previewUrl: `${BASE_URL}${job.previewPath}`,
    compareUrl: `${BASE_URL}${job.comparePath}`,
  }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
