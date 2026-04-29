"use strict";

const { callOpenRouterText, resolveOpenRouterModel } = require("../llm");
const { buildLocalAuthoredSectionHtmlPackage } = require("./author-output");
const { resolveDesignStageModel } = require("./model-profile");
const {
  buildSectionSequencePlan,
  summarizeAuthoredSectionsForContext,
} = require("./section-sequence");
const {
  buildAuthoredSectionMarkdownDocument,
  projectAuthoredMarkdownToHtmlPackage,
  analyzeAuthoredMarkdownProjection,
} = require("./author-document");

function toStringArray(value, limit = 24) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, limit);
  }
  if (typeof value === "string") {
    return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, limit);
  }
  return [];
}

function buildSectionRequests(authorInput = {}) {
  const source = authorInput && typeof authorInput === "object" ? authorInput : {};
  const packetSections = Array.isArray(source.designAuthorPacket?.sections)
    ? source.designAuthorPacket.sections
    : null;
  if (packetSections) {
      return packetSections
      .map((section) => ({
        slotId: String(section?.slotId || "").trim(),
        componentId: String(section?.componentId || "").trim(),
        label: String(section?.label || section?.slotId || "").trim(),
        objective: String(section?.objective || "").trim(),
        visualDirection: String(section?.visualDirection || "").trim(),
        hierarchy: String(section?.hierarchy || "").trim(),
      mustKeep: toStringArray(section?.mustKeep, 8),
      mustChange: toStringArray(section?.mustChange, 8),
      currentHtml: String(section?.currentSectionHtml || "").trim(),
      currentTexts: Array.isArray(section?.currentTextOutline) ? section.currentTextOutline.slice(0, 8) : [],
        currentAssets: Array.isArray(section?.reusableAssets) ? section.reusableAssets.slice(0, 8) : [],
        availableAssetFamilies: Array.isArray(section?.availableAssetFamilies)
          ? section.availableAssetFamilies.slice(0, 4)
          : [],
        assetRegistry: section?.assetRegistry && typeof section.assetRegistry === "object"
          ? section.assetRegistry
          : {},
        assetUsagePolicy: section?.assetUsagePolicy && typeof section.assetUsagePolicy === "object"
          ? section.assetUsagePolicy
          : null,
        assetFallbackPolicy: section?.assetFallbackPolicy && typeof section.assetFallbackPolicy === "object"
          ? section.assetFallbackPolicy
          : null,
        designDiversityProfiles: Array.isArray(section?.designDiversityProfiles)
          ? section.designDiversityProfiles.slice(0, 3)
          : [],
        changeProfile: section?.changeProfile && typeof section.changeProfile === "object"
          ? { ...section.changeProfile }
          : null,
    }))
      .filter((item) => item.slotId);
  }
  const targetGroup = source.authoringRequest?.targetGroup && typeof source.authoringRequest.targetGroup === "object"
    ? source.authoringRequest.targetGroup
    : {};
  const slotIds = Array.isArray(targetGroup.slotIds) ? targetGroup.slotIds : [];
  const componentIds = Array.isArray(targetGroup.componentIds) ? targetGroup.componentIds : [];
  const sectionBlueprints = Array.isArray(source.conceptPackage?.executionBrief?.sectionBlueprints)
    ? source.conceptPackage.executionBrief.sectionBlueprints
    : [];
  return slotIds.map((slotId, index) => {
    const componentId = String(componentIds[index] || "").trim();
    const blueprint = sectionBlueprints.find((item) => String(item?.slotId || "").trim() === String(slotId || "").trim()) || {};
    return {
      slotId: String(slotId || "").trim(),
      componentId,
      label: String(blueprint.label || slotId || "").trim(),
      objective: String(blueprint.objective || "").trim(),
      visualDirection: String(blueprint.visualDirection || blueprint.visual || "").trim(),
      hierarchy: String(blueprint.hierarchy || "").trim(),
      mustKeep: toStringArray([blueprint.mustKeep || blueprint.keep]).filter(Boolean),
      mustChange: toStringArray([blueprint.mustChange || blueprint.change]).filter(Boolean),
      currentHtml: String(source.currentSectionContext?.currentSectionHtmlMap?.[slotId] || "").trim(),
      currentTexts: Array.isArray(source.currentSectionContext?.currentSectionTextMap?.[slotId])
        ? source.currentSectionContext.currentSectionTextMap[slotId].slice(0, 12)
        : [],
      currentAssets: Array.isArray(source.currentSectionContext?.currentSectionAssetMap?.[slotId])
        ? source.currentSectionContext.currentSectionAssetMap[slotId].slice(0, 12)
        : [],
      availableAssetFamilies: Array.isArray(
        source.designAuthorPacket?.sections?.find((section) => String(section?.slotId || "").trim() === String(slotId || "").trim())
          ?.availableAssetFamilies
      )
        ? source.designAuthorPacket.sections
            .find((section) => String(section?.slotId || "").trim() === String(slotId || "").trim())
            .availableAssetFamilies.slice(0, 4)
        : [],
      assetRegistry:
        source.designAuthorPacket?.sections?.find((section) => String(section?.slotId || "").trim() === String(slotId || "").trim())
          ?.assetRegistry || {},
      assetUsagePolicy:
        source.designAuthorPacket?.sections?.find((section) => String(section?.slotId || "").trim() === String(slotId || "").trim())
          ?.assetUsagePolicy || null,
      assetFallbackPolicy:
        source.designAuthorPacket?.sections?.find((section) => String(section?.slotId || "").trim() === String(slotId || "").trim())
          ?.assetFallbackPolicy || null,
      designDiversityProfiles: Array.isArray(
        source.designAuthorPacket?.sections?.find((section) => String(section?.slotId || "").trim() === String(slotId || "").trim())
          ?.designDiversityProfiles
      )
        ? source.designAuthorPacket.sections
            .find((section) => String(section?.slotId || "").trim() === String(slotId || "").trim())
            .designDiversityProfiles.slice(0, 3)
        : [],
      changeProfile:
        source.designAuthorPacket?.execution?.changeProfile &&
        typeof source.designAuthorPacket.execution.changeProfile === "object"
          ? { ...source.designAuthorPacket.execution.changeProfile }
          : null,
    };
  }).filter((item) => item.slotId);
}

function buildDesignAuthorSystemPrompt() {
  return [
    "You are the Design Author model for a Korean ecommerce/site redesign system.",
    "Your job is to write only the requested section-level HTML with Tailwind utility classes directly.",
    "Follow the design author packet only. Do not expand outside the target sections.",
    "You are not choosing templates, family ids, presets, or internal modes.",
    "Think deeply about design hierarchy, spacing, color contrast, asset use, and brand tone before you write.",
    "Do not expose your reasoning. Use the output budget on the final authored document only.",
    "Output must be a Markdown document, not JSON.",
    "Use this structure exactly:",
    "# Authored Section Document",
    "PageId: ...",
    "ViewportProfile: ...",
    "TargetGroupId: ...",
    "TargetGroupLabel: ...",
    "## Section: <slotId>",
    "### Role",
    "### Intent",
    "### Delivery",
    "SectionKey: <slotId>",
    "ComponentId: <componentId>",
    "AssetSlots:",
    "- exact-approved-asset-id-or-leave-empty",
    "### HTML",
    "```html",
    "<section>...</section>",
    "```",
    "### Advisory",
    "- note",
    "Rules:",
    "1. Write complete section HTML only. Do not write <html>, <head>, <body>, or global shell.",
    "2. Use Tailwind classes directly in the authored HTML.",
    "3. Keep authored HTML inside a single root <section> per section.",
    "4. Use data-asset-slot only when the id is explicitly provided in currentAssets or availableAssetFamilies. Do not create semantic aliases.",
    "4a. If no exact asset id is available, do not write data-asset-slot. Use CSS/Tailwind composition or a normal decorative block instead.",
    "4b. If availableAssetFamilies are provided, use only the exact generatedFamilyPackage.members[*].assetId values for icon placeholders.",
    "5. Preserve userFixedContent and userDirectEdits when provided.",
    "6. Do not mention internal template/family/preset names.",
    "7. Be specific in the HTML. Be brief in Role, Intent, and Advisory.",
    "8. Keep copy concise and production-like.",
    "9. Do not add explanation outside the document format.",
    "10. Avoid repeated wrappers, duplicate text, filler copy, and unnecessary decorative markup.",
    "11. Stop after the section HTML fence and short advisory. Do not continue with extra variants or alternate structures.",
  ].join("\n");
}

function isCarouselLikeSection(sectionRequest = {}) {
  const slotId = String(sectionRequest?.slotId || "").trim().toLowerCase();
  const label = String(sectionRequest?.label || "").trim().toLowerCase();
  const currentHtml = String(sectionRequest?.currentHtml || "").trim().toLowerCase();
  if (slotId === "hero" || slotId.includes("banner")) return true;
  if (label.includes("hero") || label.includes("banner")) return true;
  if (currentHtml.includes("swiper") || currentHtml.includes("slick") || currentHtml.includes("carousel")) {
    return true;
  }
  return false;
}

function buildSectionAuthoringRules(sectionRequest = {}) {
  const changeProfile = sectionRequest?.changeProfile && typeof sectionRequest.changeProfile === "object"
    ? sectionRequest.changeProfile
    : null;
  const rules = [
    "Write only the requested section.",
    "Make deep design decisions, but spend tokens on the final HTML rather than long prose.",
    "Visible copy should be concise. Prefer one headline, one short support paragraph, and up to two CTA labels.",
    "Keep Role, Intent, and Advisory short. Put the real detail into the section HTML structure and classes.",
    "Do not produce alternate versions, optional branches, or commentary.",
  ];
  if (isCarouselLikeSection(sectionRequest)) {
    rules.push("If this section uses a carousel/swiper/banner pattern, fully author only the primary slide.");
    rules.push("For remaining slides, keep only lightweight scaffold structure with minimal or no promotional copy.");
    rules.push("Do not fully author every slide. Do not create a large multi-campaign carousel.");
    rules.push("Prefer one dominant image slot for the primary slide. Additional slides should reuse simple scaffold blocks.");
  }
  if (String(sectionRequest?.slotId || "").trim().toLowerCase() === "hero") {
    rules.push("If you use a full-bleed or stage-filling hero image, choose only a current asset whose assetRole is background-only.");
    rules.push("Do not use object-only, badge-like, or label-like hero assets as the main background image.");
  }
  const assetUsagePolicy = sectionRequest?.assetUsagePolicy && typeof sectionRequest.assetUsagePolicy === "object"
    ? sectionRequest.assetUsagePolicy
    : null;
  const assetFallbackPolicy = sectionRequest?.assetFallbackPolicy && typeof sectionRequest.assetFallbackPolicy === "object"
    ? sectionRequest.assetFallbackPolicy
    : null;
  if (assetFallbackPolicy) {
    const mode = String(assetFallbackPolicy.mode || "").trim();
    const finalFallback = String(assetFallbackPolicy.finalFallback || "").trim();
    rules.push(`Asset fallback mode for this section is ${mode || "unspecified"} because ${String(assetFallbackPolicy.reason || "no reason provided")}.`);
    if (mode === "asset-first") {
      rules.push("Use approved, viewport-matched registry assets only when their role matches the asset usage policy.");
    } else if (mode === "image-router" || mode === "icon-family-router") {
      rules.push("Do not invent external image URLs or unregistered asset ids. If needed, describe the generated asset need in Advisory and render a safe CSS/Tailwind placeholder that still looks complete.");
      rules.push("Generated assets are draft-generated/candidate material only; do not treat them as approved reusable assets.");
    } else if (mode === "css-composition") {
      rules.push("Complete this section with CSS/Tailwind composition, typography, cards, badges, layout, and state styling instead of requiring an image.");
    }
    if (finalFallback && finalFallback !== mode) {
      rules.push(`If the preferred fallback cannot be satisfied, use ${finalFallback} without leaving the section empty.`);
    }
    if (assetFallbackPolicy.allowGeneratedTextInImage === false) {
      rules.push("Never require generated images with embedded text; all visible text must remain live HTML.");
    }
  }
  if (assetUsagePolicy?.imageUsageMode === "icon-family") {
    rules.push("This section must use one consistent icon family. Use icon-only assets only.");
    rules.push("Do not use promo-complete thumbnails or banner art as icon shells.");
  }
  if (assetUsagePolicy?.imageUsageMode === "full-bleed-background") {
    const allowedBackgroundRoles = Array.isArray(assetUsagePolicy.allowedBackgroundRoles)
      ? assetUsagePolicy.allowedBackgroundRoles.filter(Boolean)
      : [];
    if (allowedBackgroundRoles.length) {
      rules.push(`If you use a full-bleed background image, it must come from currentAssets with assetRole in: ${allowedBackgroundRoles.join(", ")}.`);
    }
    if (assetUsagePolicy.disallowPromoReoverlay) {
      rules.push("Do not place new headline, support copy, or CTA on top of promo-complete art.");
    }
  }
  const assetRegistry = sectionRequest?.assetRegistry && typeof sectionRequest.assetRegistry === "object"
    ? sectionRequest.assetRegistry
    : {};
  const approvedImages = Array.isArray(assetRegistry.images)
    ? assetRegistry.images.filter((asset) => String(asset?.status || "").trim() === "approved")
    : [];
  const candidateImages = Array.isArray(assetRegistry.images)
    ? assetRegistry.images.filter((asset) => String(asset?.status || "").trim() === "candidate")
    : [];
  const blockedImages = Array.isArray(assetRegistry.images)
    ? assetRegistry.images.filter((asset) => String(asset?.status || "").trim() === "blocked")
    : [];
  const approvedIconFamilies = Array.isArray(assetRegistry.iconFamilies)
    ? assetRegistry.iconFamilies.filter((family) => String(family?.status || "").trim() === "approved")
    : [];
  const interactionComponents = Array.isArray(assetRegistry.interactionComponents)
    ? assetRegistry.interactionComponents.filter(Boolean)
    : [];
  const diversityProfiles = Array.isArray(sectionRequest?.designDiversityProfiles)
    ? sectionRequest.designDiversityProfiles.filter(Boolean)
    : [];
  if (diversityProfiles.length) {
    rules.push("To avoid same-looking outputs, pick one design diversity profile for this section and make its layout language visibly affect the HTML. Do not blend all profiles.");
    rules.push("Reference samples attached to diversity profiles are not templates. Do not copy them verbatim; adapt their hierarchy, rhythm, and interaction cue while preserving the requested section id and allowed asset ids.");
    diversityProfiles.forEach((profile) => {
      const moves = [
        profile.visualLanguage,
        Array.isArray(profile.layoutMoves) && profile.layoutMoves.length ? `layout: ${profile.layoutMoves.join(" / ")}` : "",
        Array.isArray(profile.colorMoves) && profile.colorMoves.length ? `color: ${profile.colorMoves.join(" / ")}` : "",
        profile.motionIntent ? `motion: ${profile.motionIntent}` : "",
      ].filter(Boolean).join(" | ");
      if (moves) rules.push(`Design diversity option ${profile.profileId}: ${moves}`);
      const samples = Array.isArray(profile.samples) ? profile.samples.filter(Boolean).slice(0, 2) : [];
      samples.forEach((sample) => {
        const sampleLine = [
          sample.designIntent ? `intent: ${sample.designIntent}` : "",
          sample.layoutSketch ? `layout: ${sample.layoutSketch}` : "",
          sample.interactionCue ? `interaction: ${sample.interactionCue}` : "",
          sample.assetCue ? `asset: ${sample.assetCue}` : "",
          sample.htmlSketch ? `sketch: ${sample.htmlSketch}` : "",
        ].filter(Boolean).join(" | ");
        if (sampleLine) rules.push(`Reference sample ${sample.sampleId}: ${sampleLine}`);
      });
    });
    rules.push("Do not mention the diversity profile id in visible copy. Use it only to guide structure, spacing, color, and interaction decisions.");
  }
  if (approvedImages.length) {
    rules.push(`Use approved image asset registry cards when they match the requested role: ${approvedImages.map((asset) => asset.assetId).join(", ")}.`);
    rules.push("For approved assetRegistry.images, render the provided variant assetUrl/sourceUrl as the img src and add data-registry-asset-id with the exact assetId. Do not put registry image assetIds into data-asset-slot.");
  }
  if (candidateImages.length) {
    rules.push(`Candidate image variants are reference or experiment candidates, not automatic final approved assets: ${candidateImages.map((asset) => asset.assetId).join(", ")}.`);
    rules.push("Do not use candidate image assetIds in img src, data-asset-slot, data-registry-asset-id, or visible output.");
  }
  if (blockedImages.length) {
    rules.push(`Do not use blocked image assets except as reference context: ${blockedImages.map((asset) => asset.assetId).join(", ")}.`);
  }
  if (approvedIconFamilies.length) {
    rules.push(`For icon-family slots, use one approved icon family package and preserve its style language: ${approvedIconFamilies.map((family) => `${family.familyId} (${family.styleSummary || family.semanticRole || "icon family"})`).join(", ")}.`);
  }
  if (interactionComponents.length) {
    rules.push(`If interaction is needed, select from interaction component cards only: ${interactionComponents.map((component) => component.interactionId).join(", ")}.`);
    rules.push("Do not write arbitrary inline JavaScript for registered interactions; describe the intended controls through the interaction card.");
  }
  if (changeProfile?.profileId === "conservative") {
    rules.push("Keep the current structure recognizable. Improve hierarchy, spacing, and readability before changing composition.");
    rules.push("Avoid bold color shifts, dramatic asymmetry, or novel visual devices unless the current section clearly needs them.");
  } else if (changeProfile?.profileId === "bold") {
    rules.push("You may significantly change layout, typography scale, and visual contrast inside the target section if it improves redesign impact.");
    rules.push("Prefer a clearly new first impression over small cosmetic cleanup, while staying within the section boundary and brand tone.");
    rules.push("Use stronger visual hierarchy, more decisive container rhythm, and more assertive color/spacing contrast than the current section when justified.");
  } else {
    rules.push("Treat this as a stable redesign: improve hierarchy and layout enough to feel new, but keep the result calm, plausible, and production-ready.");
  }
  return rules;
}

function buildDesignAuthorUserPrompt(authorInput = {}) {
  const source = authorInput && typeof authorInput === "object" ? authorInput : {};
  const packet = source.designAuthorPacket && typeof source.designAuthorPacket === "object"
    ? source.designAuthorPacket
    : null;
  const payload = {
    designAuthorPacket: packet || {
      page: {},
      concept: {},
      execution: {},
      sections: buildSectionRequests(source),
      reference: {},
    },
    packetStats: source.packetStats || null,
  };
  return [
    "Create an Authored Section Markdown document.",
    "Each section html must be production-like Tailwind HTML for the requested slot.",
    "Use the Korean language for visible copy unless the reference clearly requires English.",
    `Viewport contract: ${String(packet?.page?.viewportProfile || "pc")} / ${String(packet?.page?.viewportMode || "desktop")}`,
    `Asset variant policy: ${String(packet?.execution?.assetVariantPolicy || "use-current-viewport-variants-only")}`,
    "Use only asset registry variants that match the current viewportProfile unless the packet explicitly marks a fallback.",
    "",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}

function buildSectionAuthorUserPrompt(authorInput = {}, sectionRequest = {}, options = {}) {
  const source = authorInput && typeof authorInput === "object" ? authorInput : {};
  const currentSection = sectionRequest && typeof sectionRequest === "object" ? sectionRequest : {};
  const context = options && typeof options === "object" ? options : {};
  const packet = source.designAuthorPacket && typeof source.designAuthorPacket === "object"
    ? source.designAuthorPacket
    : {};
  const payload = {
    page: packet.page || {},
    concept: packet.concept || {},
    execution: {
      ...(packet.execution || {}),
      targetGroup: packet.execution?.targetGroup || {},
    },
    sequenceContext: {
      sequenceIndex: Number(context.sequenceIndex || 0),
      totalSections: Number(context.totalSections || 1),
      stage: String(context.stage || "").trim(),
      anchorSectionSlotId: String(context.anchorSectionSlotId || "").trim(),
      upstreamSections: Array.isArray(context.upstreamSections) ? context.upstreamSections : [],
    },
    currentSection,
    reference: packet.reference || {},
  };
  return [
    "Create an Authored Section Markdown document for exactly one section.",
    "The document must contain exactly one `## Section:` block, for the requested slot only.",
    "Inside `### Delivery`, repeat the same SectionKey as the requested slot.",
    "Do not write any other sections.",
    "Use the Korean language for visible copy unless the reference clearly requires English.",
    `Viewport contract: ${String(payload.page?.viewportProfile || "pc")} / ${String(payload.page?.viewportMode || "desktop")}`,
    `Asset variant policy: ${String(payload.execution?.assetVariantPolicy || "use-current-viewport-variants-only")}`,
    "- Use only assetRegistry image variants matching the current viewportProfile unless a fallback is explicitly marked.",
    "- PC-approved assets do not imply Mobile approval; Mobile-approved assets do not imply PC approval.",
    `Requested change profile: ${String(payload.execution?.changeProfile?.profileId || payload.execution?.requestedChangeLevel || "stable")}`,
    "Asset usage rules:",
    "- Use only exact asset ids provided in currentAssets or availableAssetFamilies.",
    "- Do not rename, reinterpret, or invent placeholder ids such as semantic aliases.",
    "Authoring rules:",
    ...buildSectionAuthoringRules(currentSection).map((rule, index) => `${index + 1}. ${rule}`),
    "",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}

function extractMarkdownDocument(raw = "") {
  const text = String(raw || "").trim();
  if (!text) return "";
  const start = text.search(/^#\s+Authored Section Document\s*$/m);
  if (start >= 0) {
    return text.slice(start).trim();
  }
  return text;
}

function buildProjectionError(rawDocument = "", document = "") {
  const rawText = String(rawDocument || "").trim();
  const projectedDiagnostics = analyzeAuthoredMarkdownProjection(document || rawText);
  const declaredKeys = Array.isArray(projectedDiagnostics.declaredSectionKeys)
    ? projectedDiagnostics.declaredSectionKeys
    : [];
  const projectedKeys = Array.isArray(projectedDiagnostics.projectedSectionKeys)
    ? projectedDiagnostics.projectedSectionKeys
    : [];
  const missingKeys = Array.isArray(projectedDiagnostics.missingSectionKeys)
    ? projectedDiagnostics.missingSectionKeys
    : [];
  const reason = [
    missingKeys.length ? "design_author_missing_section_identifiers" : "design_author_returned_no_supported_sections",
    `header=${projectedDiagnostics.hasDocumentHeader ? "yes" : "no"}`,
    `declaredKeys=${declaredKeys.join(",") || "none"}`,
    `projectedKeys=${projectedKeys.join(",") || "none"}`,
    `missingKeys=${missingKeys.join(",") || "none"}`,
  ].join(" ");
  const error = new Error(reason);
  error.diagnostics = projectedDiagnostics;
  error.rawDocument = rawText;
  error.document = String(document || "").trim();
  error.rawDocumentPreview = rawText.slice(0, 1200);
  return error;
}

function buildSingleSectionProjectionError(expectedSlotId = "", rawDocument = "", document = "") {
  const normalizedExpectedSlotId = String(expectedSlotId || "").trim();
  const rawText = String(rawDocument || "").trim();
  const projectedDiagnostics = analyzeAuthoredMarkdownProjection(document || rawText);
  const declaredKeys = Array.isArray(projectedDiagnostics.declaredSectionKeys)
    ? projectedDiagnostics.declaredSectionKeys
    : [];
  const projectedKeys = Array.isArray(projectedDiagnostics.projectedSectionKeys)
    ? projectedDiagnostics.projectedSectionKeys
    : [];
  const missingExpectedInDeclared =
    normalizedExpectedSlotId && !declaredKeys.includes(normalizedExpectedSlotId);
  const missingExpectedInProjected =
    normalizedExpectedSlotId && !projectedKeys.includes(normalizedExpectedSlotId);
  const reason = [
    "design_author_missing_section_identifiers",
    `expected=${normalizedExpectedSlotId || "none"}`,
    `declaredKeys=${declaredKeys.join(",") || "none"}`,
    `projectedKeys=${projectedKeys.join(",") || "none"}`,
    `missingDeclared=${missingExpectedInDeclared ? "yes" : "no"}`,
    `missingProjected=${missingExpectedInProjected ? "yes" : "no"}`,
  ].join(" ");
  const error = new Error(reason);
  error.diagnostics = {
    ...projectedDiagnostics,
    expectedSectionKey: normalizedExpectedSlotId,
    missingExpectedInDeclared,
    missingExpectedInProjected,
  };
  error.rawDocument = rawText;
  error.document = String(document || "").trim();
  error.rawDocumentPreview = rawText.slice(0, 1200);
  return error;
}

async function authorSingleSection(input = {}, options = {}) {
  const source = input && typeof input === "object" ? input : {};
  const opts = options && typeof options === "object" ? options : {};
  const authorInput = source.authorInput && typeof source.authorInput === "object" ? source.authorInput : {};
  const sectionRequest = source.sectionRequest && typeof source.sectionRequest === "object" ? source.sectionRequest : {};
  const expectedSlotId = String(sectionRequest.slotId || "").trim();
  const model = resolveDesignStageModel(
    "designAuthor",
    opts.model || process.env.DESIGN_AUTHOR_MODEL || resolveOpenRouterModel("BUILDER_MODEL", "OPENROUTER_MODEL")
  );
  const response = await callOpenRouterText({
    model,
    temperature: 0.2,
    timeoutMs: Number(process.env.DESIGN_AUTHOR_TIMEOUT_MS || 180000),
    maxTokens: Number(process.env.DESIGN_AUTHOR_SECTION_MAX_TOKENS || process.env.DESIGN_AUTHOR_MAX_TOKENS || 50000),
    maxAttempts: Number(process.env.DESIGN_AUTHOR_MAX_ATTEMPTS || 1),
    returnMeta: true,
    messages: [
      { role: "system", content: buildDesignAuthorSystemPrompt() },
      {
        role: "user",
        content: buildSectionAuthorUserPrompt(authorInput, sectionRequest, {
          sequenceIndex: opts.sequenceIndex,
          totalSections: opts.totalSections,
          stage: opts.stage,
          anchorSectionSlotId: opts.anchorSectionSlotId,
          upstreamSections: opts.upstreamSections,
        }),
      },
    ],
  });
  const rawDocument =
    response && typeof response === "object" && !Array.isArray(response)
      ? String(response.text || "").trim()
      : String(response || "").trim();
  const responseMeta =
    response && typeof response === "object" && !Array.isArray(response) && response.meta && typeof response.meta === "object"
      ? response.meta
      : null;
  const document = extractMarkdownDocument(rawDocument);
  const normalized = projectAuthoredMarkdownToHtmlPackage(document);
  const projectedSections = Array.isArray(normalized.sections) ? normalized.sections : [];
  const matchedSection = projectedSections.find((section) => String(section?.slotId || "").trim() === expectedSlotId) || null;
  if (!matchedSection) {
    const error = buildSingleSectionProjectionError(expectedSlotId, rawDocument, document);
    error.responseMeta = responseMeta;
    throw error;
  }
  return {
    document,
    package: {
      pageId: normalized.pageId,
      viewportProfile: normalized.viewportProfile,
      targetGroup: normalized.targetGroup,
      advisory: normalized.advisory,
      sections: [matchedSection],
    },
    diagnostics: analyzeAuthoredMarkdownProjection(document),
    responseMeta,
  };
}

async function buildLlmAuthoredSectionHtmlPackage(input = {}, options = {}) {
  const source = input && typeof input === "object" ? input : {};
  const opts = options && typeof options === "object" ? options : {};
  const authorInput = source.authorInput && typeof source.authorInput === "object" ? source.authorInput : {};
  const model = resolveDesignStageModel(
    "designAuthor",
    opts.model || process.env.DESIGN_AUTHOR_MODEL || resolveOpenRouterModel("BUILDER_MODEL", "OPENROUTER_MODEL")
  );
  const fallback = () => buildLocalAuthoredSectionHtmlPackage(source);

  try {
    const sequencePlan = buildSectionSequencePlan(authorInput);
    if (!sequencePlan.length) {
      throw new Error("design_author_sequence_plan_empty");
    }
    const accumulatedSections = [];
    const sectionResults = [];
    for (const step of sequencePlan) {
      const sectionRequest =
        Array.isArray(authorInput.designAuthorPacket?.sections)
          ? authorInput.designAuthorPacket.sections.find((section) => String(section?.slotId || "").trim() === step.slotId) || null
          : null;
      if (!sectionRequest) {
        throw new Error(`design_author_section_request_missing:${step.slotId}`);
      }
      const upstreamSections = summarizeAuthoredSectionsForContext(accumulatedSections);
      let sectionResult;
      try {
        sectionResult = await authorSingleSection(
          {
            authorInput,
            sectionRequest,
          },
          {
            model,
            sequenceIndex: step.sequenceIndex,
            totalSections: sequencePlan.length,
            stage: step.stage,
            anchorSectionSlotId: sequencePlan[0]?.slotId || "",
            upstreamSections,
          }
        );
      } catch (error) {
        error.sectionResults = sectionResults.slice();
        throw error;
      }
      const authoredSection = Array.isArray(sectionResult?.package?.sections) ? sectionResult.package.sections[0] : null;
      if (!authoredSection) {
        throw buildProjectionError(sectionResult?.document || "", sectionResult?.document || "");
      }
      accumulatedSections.push(authoredSection);
      sectionResults.push({
        slotId: step.slotId,
        stage: step.stage,
        diagnostics: sectionResult.diagnostics,
        responseMeta: sectionResult.responseMeta,
      });
    }
    const targetGroup = authorInput.authoringRequest?.targetGroup && typeof authorInput.authoringRequest.targetGroup === "object"
      ? authorInput.authoringRequest.targetGroup
      : (authorInput.conceptPackage?.executionBrief?.targetGroup && typeof authorInput.conceptPackage.executionBrief.targetGroup === "object"
        ? authorInput.conceptPackage.executionBrief.targetGroup
        : {});
    const document = buildAuthoredSectionMarkdownDocument({
      pageId: authorInput.designAuthorPacket?.page?.pageId || source.pageId || "",
      viewportProfile: authorInput.designAuthorPacket?.page?.viewportProfile || source.viewportProfile || "pc",
      targetGroup,
      sections: accumulatedSections,
    });
    const normalized = projectAuthoredMarkdownToHtmlPackage(document);
    return {
      package: normalized,
      document,
      providerMeta: {
        provider: "openrouter",
        model,
        usedDemoFallback: false,
        sectionResults,
      },
    };
  } catch (error) {
    if (!Array.isArray(error?.sectionResults)) {
      error.sectionResults = null;
    }
    const fallbackPackage = fallback();
    return {
      package: fallbackPackage,
      document: buildAuthoredSectionMarkdownDocument(fallbackPackage),
      providerMeta: {
        provider: "local-fallback",
        model,
        usedDemoFallback: true,
        error: String(error?.message || error || ""),
        diagnostics: error?.diagnostics && typeof error.diagnostics === "object" ? error.diagnostics : null,
        sectionResults: Array.isArray(error?.sectionResults) ? error.sectionResults : null,
        responseMeta: error?.responseMeta && typeof error.responseMeta === "object" ? error.responseMeta : null,
        failedDocument: String(error?.document || "").trim(),
        failedRawDocument: String(error?.rawDocument || "").trim(),
        rawDocumentPreview: String(error?.rawDocumentPreview || "").trim(),
      },
    };
  }
}

module.exports = {
  buildSectionRequests,
  buildSectionAuthorUserPrompt,
  buildDesignAuthorSystemPrompt,
  buildDesignAuthorUserPrompt,
  buildLlmAuthoredSectionHtmlPackage,
};
