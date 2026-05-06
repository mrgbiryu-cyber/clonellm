"use strict";

const { callOpenRouterText, resolveOpenRouterModel } = require("../llm");
const { buildLocalAuthoredSectionHtmlPackage } = require("./author-output");
const { resolveDesignStageModel } = require("./model-profile");
const {
  buildSectionSequencePlan,
  buildSectionClusterPlan,
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

function resolveDesignAuthorConcurrency(sequencePlan = []) {
  const configured = Number(process.env.DESIGN_AUTHOR_CONCURRENCY || process.env.DESIGN_AUTHOR_MAX_CONCURRENCY || 3);
  const count = Array.isArray(sequencePlan) ? sequencePlan.length : 0;
  if (count <= 2) return 1;
  return Math.max(1, Math.min(6, Number.isFinite(configured) ? configured : 3));
}

function resolveDesignAuthorSectionMaxTokens(section = {}, options = {}) {
  const slotId = String(section?.slotId || "").trim().toLowerCase();
  const stage = String(options?.stage || "").trim().toLowerCase();
  const isAnchor = stage === "anchor" || slotId === "hero" || slotId === "summary";
  const isComplexSupport = slotId === "quickmenu" || slotId === "sticky";
  const configured = Number(
    process.env.DESIGN_AUTHOR_SECTION_MAX_TOKENS ||
      process.env.DESIGN_AUTHOR_MAX_TOKENS ||
      process.env.BUILDER_MAX_TOKENS ||
      ""
  );
  if (Number.isFinite(configured) && configured > 0) return Math.max(4000, configured);
  const roleConfigured = Number(
    isAnchor
      ? process.env.DESIGN_AUTHOR_ANCHOR_MAX_TOKENS
      : isComplexSupport
        ? process.env.DESIGN_AUTHOR_COMPLEX_SUPPORT_MAX_TOKENS
        : process.env.DESIGN_AUTHOR_SUPPORT_MAX_TOKENS
  );
  if (Number.isFinite(roleConfigured) && roleConfigured > 0) return Math.max(4000, roleConfigured);
  if (isAnchor) return 32000;
  if (isComplexSupport) return 24000;
  return 16000;
}

function resolveDesignAuthorBatchingEnabled() {
  return String(process.env.DESIGN_AUTHOR_BATCHING_ENABLED || "1").trim() !== "0";
}

function resolveDesignAuthorClusterMaxSections() {
  const configured = Number(process.env.DESIGN_AUTHOR_CLUSTER_MAX_SECTIONS || 4);
  return Math.max(2, Math.min(6, Number.isFinite(configured) ? configured : 4));
}

function resolveDesignAuthorClusterMaxTokens(sections = []) {
  const configured = Number(process.env.DESIGN_AUTHOR_CLUSTER_MAX_TOKENS || "");
  if (Number.isFinite(configured) && configured > 0) return Math.max(8000, configured);
  const requested = (Array.isArray(sections) ? sections : []).reduce((sum, section) => {
    return sum + resolveDesignAuthorSectionMaxTokens(section, { stage: section?.stage || "support" });
  }, 0);
  return Math.min(64000, Math.max(12000, Math.ceil(requested * 1.15)));
}

function isLeadingSequenceStep(step = {}) {
  const priority = Number(step?.priority);
  return Number.isFinite(priority) && priority <= 0;
}

function buildTruncatedSectionError(sectionRequest = {}, responseMeta = null) {
  const slotId = String(sectionRequest?.slotId || "").trim();
  const error = new Error(`design_author_output_truncated:${slotId || "unknown"}`);
  error.code = "design_author_output_truncated";
  error.responseMeta = responseMeta;
  error.diagnostics = {
    reason: "finish_reason_length",
    slotId,
    finishReason: String(responseMeta?.finishReason || "").trim(),
    usage: responseMeta?.usage || null,
  };
  return error;
}

function buildTruncatedClusterError(sectionRequests = [], responseMeta = null) {
  const slotIds = (Array.isArray(sectionRequests) ? sectionRequests : [])
    .map((section) => String(section?.slotId || "").trim())
    .filter(Boolean);
  const error = new Error(`design_author_cluster_output_truncated:${slotIds.join(",") || "unknown"}`);
  error.code = "design_author_cluster_output_truncated";
  error.responseMeta = responseMeta;
  error.diagnostics = {
    reason: "finish_reason_length",
    slotIds,
    finishReason: String(responseMeta?.finishReason || "").trim(),
    usage: responseMeta?.usage || null,
  };
  return error;
}

function mergePartialAuthoredSections(fallbackPackage = {}, partialSections = []) {
  const fallbackSections = Array.isArray(fallbackPackage?.sections) ? fallbackPackage.sections : [];
  const partialBySlot = new Map(
    (Array.isArray(partialSections) ? partialSections : [])
      .map((section) => [String(section?.slotId || "").trim(), section])
      .filter(([slotId, section]) => slotId && section)
  );
  const mergedSections = fallbackSections.map((section) => {
    const slotId = String(section?.slotId || "").trim();
    return partialBySlot.get(slotId) || section;
  });
  for (const [slotId, section] of partialBySlot.entries()) {
    if (!mergedSections.some((item) => String(item?.slotId || "").trim() === slotId)) {
      mergedSections.push(section);
    }
  }
  return {
    ...fallbackPackage,
    sections: mergedSections,
  };
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
    "Use sequenceContext.upstreamSections as real implementation context: match its visible rhythm, color surface, spacing scale, typography scale, and CTA treatment unless the current section has a strong reason to differ.",
    "When upstreamSections include htmlExcerpt or styleSignature.classTokens, treat them as the page's already-authored visual language, not as copy to duplicate verbatim.",
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

function buildClusterAuthorUserPrompt(authorInput = {}, sectionRequests = [], options = {}) {
  const source = authorInput && typeof authorInput === "object" ? authorInput : {};
  const context = options && typeof options === "object" ? options : {};
  const packet = source.designAuthorPacket && typeof source.designAuthorPacket === "object"
    ? source.designAuthorPacket
    : {};
  const sections = (Array.isArray(sectionRequests) ? sectionRequests : []).filter(Boolean);
  const expectedSlotIds = sections.map((section) => String(section?.slotId || "").trim()).filter(Boolean);
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
      stage: "cluster-support",
      anchorSectionSlotId: String(context.anchorSectionSlotId || "").trim(),
      upstreamSections: Array.isArray(context.upstreamSections) ? context.upstreamSections : [],
    },
    cluster: {
      clusterId: String(context.clusterId || "").trim(),
      goal: String(context.goal || "").trim(),
      rules: toStringArray(context.rules, 8),
      expectedSlotIds,
    },
    sections,
    reference: packet.reference || {},
  };
  const sectionRuleBlocks = sections.flatMap((section) => [
    `Section ${String(section?.slotId || "").trim()} rules:`,
    ...buildSectionAuthoringRules(section).map((rule, index) => `${index + 1}. ${rule}`),
  ]);
  return [
    "Create one Authored Section Markdown document for a section cluster.",
    "The document must contain one `## Section:` block for each requested slot in cluster.expectedSlotIds, and no other sections.",
    "Inside each `### Delivery`, repeat the same SectionKey as that section slot.",
    "Keep each section independent with one root <section>, but make the cluster read as one visual system.",
    "Use sequenceContext.upstreamSections as the already-authored page language; match rhythm, color surface, spacing scale, typography scale, and CTA treatment without copying text verbatim.",
    "Use the Korean language for visible copy unless the reference clearly requires English.",
    `Viewport contract: ${String(payload.page?.viewportProfile || "pc")} / ${String(payload.page?.viewportMode || "desktop")}`,
    `Asset variant policy: ${String(payload.execution?.assetVariantPolicy || "use-current-viewport-variants-only")}`,
    "- Use only assetRegistry image variants matching the current viewportProfile unless a fallback is explicitly marked.",
    "- PC-approved assets do not imply Mobile approval; Mobile-approved assets do not imply PC approval.",
    `Requested change profile: ${String(payload.execution?.changeProfile?.profileId || payload.execution?.requestedChangeLevel || "stable")}`,
    "Asset usage rules:",
    "- Use only exact asset ids provided in each section's currentAssets or availableAssetFamilies.",
    "- Do not rename, reinterpret, or invent placeholder ids such as semantic aliases.",
    "Cluster authoring rules:",
    ...sectionRuleBlocks,
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

function buildClusterProjectionError(expectedSlotIds = [], rawDocument = "", document = "") {
  const normalizedExpectedSlotIds = toStringArray(expectedSlotIds, 12);
  const rawText = String(rawDocument || "").trim();
  const projectedDiagnostics = analyzeAuthoredMarkdownProjection(document || rawText);
  const projectedKeys = Array.isArray(projectedDiagnostics.projectedSectionKeys)
    ? projectedDiagnostics.projectedSectionKeys
    : [];
  const missing = normalizedExpectedSlotIds.filter((slotId) => !projectedKeys.includes(slotId));
  const reason = [
    "design_author_cluster_missing_section_identifiers",
    `expected=${normalizedExpectedSlotIds.join(",") || "none"}`,
    `projectedKeys=${projectedKeys.join(",") || "none"}`,
    `missing=${missing.join(",") || "none"}`,
  ].join(" ");
  const error = new Error(reason);
  error.diagnostics = {
    ...projectedDiagnostics,
    expectedSectionKeys: normalizedExpectedSlotIds,
    missingSectionKeys: missing,
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
    maxTokens: resolveDesignAuthorSectionMaxTokens(sectionRequest, { stage: opts.stage }),
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
  if (String(responseMeta?.finishReason || "").trim() === "length") {
    const error = buildTruncatedSectionError(sectionRequest, responseMeta);
    error.rawDocument = rawDocument;
    error.rawDocumentPreview = rawDocument.slice(0, 1200);
    throw error;
  }
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

async function authorClusterSections(input = {}, options = {}) {
  const source = input && typeof input === "object" ? input : {};
  const opts = options && typeof options === "object" ? options : {};
  const authorInput = source.authorInput && typeof source.authorInput === "object" ? source.authorInput : {};
  const sectionRequests = (Array.isArray(source.sectionRequests) ? source.sectionRequests : []).filter(Boolean);
  const expectedSlotIds = sectionRequests.map((section) => String(section?.slotId || "").trim()).filter(Boolean);
  const model = resolveDesignStageModel(
    "designAuthor",
    opts.model || process.env.DESIGN_AUTHOR_MODEL || resolveOpenRouterModel("BUILDER_MODEL", "OPENROUTER_MODEL")
  );
  const response = await callOpenRouterText({
    model,
    temperature: 0.2,
    timeoutMs: Number(process.env.DESIGN_AUTHOR_TIMEOUT_MS || 180000),
    maxTokens: resolveDesignAuthorClusterMaxTokens(sectionRequests),
    maxAttempts: Number(process.env.DESIGN_AUTHOR_MAX_ATTEMPTS || 1),
    returnMeta: true,
    messages: [
      { role: "system", content: buildDesignAuthorSystemPrompt() },
      {
        role: "user",
        content: buildClusterAuthorUserPrompt(authorInput, sectionRequests, {
          sequenceIndex: opts.sequenceIndex,
          totalSections: opts.totalSections,
          anchorSectionSlotId: opts.anchorSectionSlotId,
          upstreamSections: opts.upstreamSections,
          clusterId: opts.clusterId,
          goal: opts.goal,
          rules: opts.rules,
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
  if (String(responseMeta?.finishReason || "").trim() === "length") {
    const error = buildTruncatedClusterError(sectionRequests, responseMeta);
    error.rawDocument = rawDocument;
    error.rawDocumentPreview = rawDocument.slice(0, 1200);
    throw error;
  }
  const document = extractMarkdownDocument(rawDocument);
  const normalized = projectAuthoredMarkdownToHtmlPackage(document);
  const projectedSections = Array.isArray(normalized.sections) ? normalized.sections : [];
  const sectionsBySlot = new Map(projectedSections.map((section) => [String(section?.slotId || "").trim(), section]));
  const matchedSections = expectedSlotIds.map((slotId) => sectionsBySlot.get(slotId)).filter(Boolean);
  if (matchedSections.length !== expectedSlotIds.length) {
    const error = buildClusterProjectionError(expectedSlotIds, rawDocument, document);
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
      sections: matchedSections,
    },
    diagnostics: analyzeAuthoredMarkdownProjection(document),
    responseMeta,
  };
}

async function authorSequenceStep({ authorInput, step, sequencePlan, accumulatedSections, model }) {
  const sectionRequest =
    Array.isArray(authorInput.designAuthorPacket?.sections)
      ? authorInput.designAuthorPacket.sections.find((section) => String(section?.slotId || "").trim() === step.slotId) || null
      : null;
  if (!sectionRequest) {
    throw new Error(`design_author_section_request_missing:${step.slotId}`);
  }
  const upstreamSections = summarizeAuthoredSectionsForContext(accumulatedSections);
  const sectionResult = await authorSingleSection(
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
  const authoredSection = Array.isArray(sectionResult?.package?.sections) ? sectionResult.package.sections[0] : null;
  if (!authoredSection) {
    throw buildProjectionError(sectionResult?.document || "", sectionResult?.document || "");
  }
  return {
    authoredSection,
    sectionSummary: {
      slotId: step.slotId,
      stage: step.stage,
      callType: "section",
      diagnostics: sectionResult.diagnostics,
      responseMeta: sectionResult.responseMeta,
    },
  };
}

async function authorClusterStep({ authorInput, group, sequencePlan, accumulatedSections, model }) {
  const packetSections = Array.isArray(authorInput.designAuthorPacket?.sections)
    ? authorInput.designAuthorPacket.sections
    : [];
  const sectionRequests = (Array.isArray(group?.steps) ? group.steps : [])
    .map((step) => packetSections.find((section) => String(section?.slotId || "").trim() === step.slotId) || null)
    .filter(Boolean);
  if (sectionRequests.length < 2) {
    throw new Error(`design_author_cluster_request_too_small:${String(group?.clusterId || "cluster").trim()}`);
  }
  const upstreamSections = summarizeAuthoredSectionsForContext(accumulatedSections);
  const clusterResult = await authorClusterSections(
    {
      authorInput,
      sectionRequests,
    },
    {
      model,
      sequenceIndex: group.firstSequenceIndex,
      totalSections: sequencePlan.length,
      anchorSectionSlotId: sequencePlan[0]?.slotId || "",
      upstreamSections,
      clusterId: group.clusterId,
      goal: group.goal,
      rules: group.rules,
    }
  );
  const authoredSections = Array.isArray(clusterResult?.package?.sections) ? clusterResult.package.sections : [];
  if (authoredSections.length !== sectionRequests.length) {
    throw buildClusterProjectionError(sectionRequests.map((section) => section.slotId), clusterResult?.document || "", clusterResult?.document || "");
  }
  return {
    authoredSections,
    sectionSummaries: authoredSections.map((section) => ({
      slotId: String(section?.slotId || "").trim(),
      stage: "support",
      callType: "cluster",
      clusterId: String(group?.clusterId || "").trim(),
      diagnostics: clusterResult.diagnostics,
      responseMeta: clusterResult.responseMeta,
    })),
  };
}

async function authorSupportStepsConcurrently({ authorInput, supportSteps, sequencePlan, accumulatedSections, model, concurrency }) {
  const sectionResults = [];
  const authoredSections = [];
  for (let index = 0; index < supportSteps.length; index += concurrency) {
    const batch = supportSteps.slice(index, index + concurrency);
    const upstreamSnapshot = accumulatedSections.slice();
    const settled = await Promise.allSettled(
      batch.map((step) => authorSequenceStep({
        authorInput,
        step,
        sequencePlan,
        accumulatedSections: upstreamSnapshot,
        model,
      }))
    );
    const batchAuthoredSections = [];
    const batchSectionResults = [];
    settled.forEach((item) => {
      if (item.status !== "fulfilled" || !item.value) return;
      batchAuthoredSections.push(item.value.authoredSection);
      batchSectionResults.push(item.value.sectionSummary);
    });
    authoredSections.push(...batchAuthoredSections);
    sectionResults.push(...batchSectionResults);
    accumulatedSections.push(...batchAuthoredSections);
    const rejected = settled.find((item) => item.status === "rejected");
    if (rejected) {
      const error = rejected.reason instanceof Error ? rejected.reason : new Error(String(rejected.reason || "design_author_parallel_section_failed"));
      error.sectionResults = sectionResults.slice();
      error.partialAuthoredSections = accumulatedSections.slice();
      throw error;
    }
  }
  return { authoredSections, sectionResults };
}

async function authorSupportStepsWithClusters({ authorInput, supportSteps, sequencePlan, accumulatedSections, model }) {
  const sectionResults = [];
  const authoredSections = [];
  const maxClusterSections = resolveDesignAuthorClusterMaxSections();
  const clusterPlan = buildSectionClusterPlan(authorInput, sequencePlan, supportSteps).flatMap((group) => {
    if (group.type !== "cluster" || group.steps.length <= maxClusterSections) return [group];
    const chunks = [];
    for (let index = 0; index < group.steps.length; index += maxClusterSections) {
      const steps = group.steps.slice(index, index + maxClusterSections);
      chunks.push({
        ...group,
        clusterId: `${group.clusterId}.${chunks.length + 1}`,
        slotIds: steps.map((step) => step.slotId),
        steps,
        firstSequenceIndex: steps[0]?.sequenceIndex || group.firstSequenceIndex,
      });
    }
    return chunks;
  });
  let clusterCallCount = 0;
  let sectionCallCount = 0;
  let clusterFallbackSectionCount = 0;
  for (const group of clusterPlan) {
    if (group.type === "cluster" && group.steps.length >= 2) {
      try {
        clusterCallCount += 1;
        const result = await authorClusterStep({ authorInput, group, sequencePlan, accumulatedSections, model });
        authoredSections.push(...result.authoredSections);
        sectionResults.push(...result.sectionSummaries);
        accumulatedSections.push(...result.authoredSections);
        continue;
      } catch (clusterError) {
        const fallbackSummaries = [];
        const fallbackSections = [];
        for (const step of group.steps) {
          sectionCallCount += 1;
          clusterFallbackSectionCount += 1;
          const result = await authorSequenceStep({ authorInput, step, sequencePlan, accumulatedSections, model });
          fallbackSections.push(result.authoredSection);
          fallbackSummaries.push({
            ...result.sectionSummary,
            clusterFallbackFrom: group.clusterId,
            clusterError: String(clusterError?.message || clusterError || ""),
          });
          accumulatedSections.push(result.authoredSection);
        }
        authoredSections.push(...fallbackSections);
        sectionResults.push(...fallbackSummaries);
        continue;
      }
    }
    const step = group.steps[0];
    if (!step) continue;
    sectionCallCount += 1;
    const result = await authorSequenceStep({ authorInput, step, sequencePlan, accumulatedSections, model });
    authoredSections.push(result.authoredSection);
    sectionResults.push(result.sectionSummary);
    accumulatedSections.push(result.authoredSection);
  }
  return {
    authoredSections,
    sectionResults,
    clusterPlan,
    clusterCallCount,
    sectionCallCount,
    clusterFallbackSectionCount,
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
    let modelCallCount = 0;
    let clusterMeta = null;
    const leadingSteps = sequencePlan.filter(isLeadingSequenceStep);
    const supportSteps = sequencePlan.filter((step) => !isLeadingSequenceStep(step));
    for (const step of leadingSteps) {
      try {
        modelCallCount += 1;
        const result = await authorSequenceStep({ authorInput, step, sequencePlan, accumulatedSections, model });
        accumulatedSections.push(result.authoredSection);
        sectionResults.push(result.sectionSummary);
      } catch (error) {
        error.sectionResults = sectionResults.slice();
        error.partialAuthoredSections = accumulatedSections.slice();
        throw error;
      }
    }
    if (supportSteps.length) {
      const concurrency = resolveDesignAuthorConcurrency(sequencePlan);
      const clusterEnabled = resolveDesignAuthorBatchingEnabled();
      const clusterPlan = clusterEnabled ? buildSectionClusterPlan(authorInput, sequencePlan, supportSteps) : [];
      const hasCluster = clusterPlan.some((group) => group.type === "cluster" && group.steps.length >= 2);
      if (hasCluster) {
        let clusterResult;
        try {
          clusterResult = await authorSupportStepsWithClusters({
            authorInput,
            supportSteps,
            sequencePlan,
            accumulatedSections,
            model,
          });
        } catch (error) {
          error.sectionResults = sectionResults.slice();
          error.partialAuthoredSections = accumulatedSections.slice();
          throw error;
        }
        modelCallCount += clusterResult.clusterCallCount + clusterResult.sectionCallCount;
        clusterMeta = {
          clusterCount: clusterResult.clusterPlan.filter((group) => group.type === "cluster").length,
          singleCount: clusterResult.clusterPlan.filter((group) => group.type === "single").length,
          clusterCallCount: clusterResult.clusterCallCount,
          sectionCallCount: clusterResult.sectionCallCount,
          clusterFallbackSectionCount: clusterResult.clusterFallbackSectionCount,
          clusterPlan: clusterResult.clusterPlan.map((group) => ({
            type: group.type,
            clusterId: group.clusterId,
            slotIds: group.slotIds,
          })),
        };
        sectionResults.push(...clusterResult.sectionResults);
      } else {
        modelCallCount += supportSteps.length;
        const concurrentResult = await authorSupportStepsConcurrently({
          authorInput,
          supportSteps,
          sequencePlan,
          accumulatedSections,
          model,
          concurrency,
        });
        sectionResults.push(...concurrentResult.sectionResults);
      }
    }
    const targetGroup = authorInput.authoringRequest?.targetGroup && typeof authorInput.authoringRequest.targetGroup === "object"
      ? authorInput.authoringRequest.targetGroup
      : (authorInput.conceptPackage?.executionBrief?.targetGroup && typeof authorInput.conceptPackage.executionBrief.targetGroup === "object"
        ? authorInput.conceptPackage.executionBrief.targetGroup
        : {});
    const sectionOrder = new Map(sequencePlan.map((step, index) => [String(step?.slotId || "").trim(), index]));
    const orderedSections = accumulatedSections.slice().sort((left, right) => {
      const leftOrder = sectionOrder.has(String(left?.slotId || "").trim())
        ? sectionOrder.get(String(left?.slotId || "").trim())
        : Number.MAX_SAFE_INTEGER;
      const rightOrder = sectionOrder.has(String(right?.slotId || "").trim())
        ? sectionOrder.get(String(right?.slotId || "").trim())
        : Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder;
    });
    const document = buildAuthoredSectionMarkdownDocument({
      pageId: authorInput.designAuthorPacket?.page?.pageId || source.pageId || "",
      viewportProfile: authorInput.designAuthorPacket?.page?.viewportProfile || source.viewportProfile || "pc",
      targetGroup,
      sections: orderedSections,
    });
    const normalized = projectAuthoredMarkdownToHtmlPackage(document);
    return {
      package: normalized,
      document,
      providerMeta: {
        provider: "openrouter",
        model,
        usedDemoFallback: false,
        authorExecutionMode: clusterMeta
          ? "anchor-then-cluster-support"
          : sequencePlan.length > 2 ? "anchor-then-parallel-support" : "sequential",
        concurrency: resolveDesignAuthorConcurrency(sequencePlan),
        modelCallCount,
        clusterMeta,
        sectionResults,
      },
    };
  } catch (error) {
    if (!Array.isArray(error?.sectionResults)) {
      error.sectionResults = null;
    }
    const fallbackPackage = fallback();
    const partialSections = Array.isArray(error?.partialAuthoredSections) ? error.partialAuthoredSections : [];
    const mergedPackage = partialSections.length ? mergePartialAuthoredSections(fallbackPackage, partialSections) : fallbackPackage;
    return {
      package: mergedPackage,
      document: buildAuthoredSectionMarkdownDocument(mergedPackage),
      providerMeta: {
        provider: "local-fallback",
        model,
        usedDemoFallback: true,
        partialAuthoredSectionCount: partialSections.length,
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
  resolveDesignAuthorBatchingEnabled,
};
