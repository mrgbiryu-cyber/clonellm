"use strict";

const {
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

function collectBlocking(reasonList = [], reason = "") {
  const normalized = String(reason || "").trim();
  if (normalized) reasonList.push(normalized);
}

function sectionContainsShellRewrite(html = "") {
  return /<(html|head|body)\b/i.test(String(html || ""));
}

function collectExternalImageSources(html = "") {
  return Array.from(String(html || "").matchAll(/<img\b[^>]*src="([^"]+)"/gi))
    .map((match) => String(match?.[1] || "").trim())
    .filter(Boolean)
    .filter((src) => /^https?:\/\//i.test(src));
}

function collectImageSources(html = "") {
  return Array.from(String(html || "").matchAll(/<img\b[^>]*src="([^"]+)"/gi))
    .map((match) => String(match?.[1] || "").trim())
    .filter(Boolean);
}

function decodeAssetSource(assetUrl = "") {
  const value = String(assetUrl || "").trim();
  if (!value) return "";
  try {
    const parsed = new URL(value, "http://localhost");
    const embedded = String(parsed.searchParams.get("url") || "").trim();
    if (embedded) return decodeURIComponent(embedded);
  } catch {}
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function classifyAssetRole(assetSlotId = "", assetUrl = "", altText = "") {
  const slotId = String(assetSlotId || "").trim().toLowerCase();
  const decoded = decodeAssetSource(assetUrl).toLowerCase();
  const normalizedAltText = String(altText || "").trim().toLowerCase();
  const promoKeywords = [
    "혜택", "이벤트", "할인", "라이브", "카드혜택", "구독", "sale", "days",
    "event", "coupon", "promotion", "banner", "hero", "타이틀", "타이포"
  ].map((item) => String(item).toLowerCase());
  const iconKeywords = ["icon", "glyph", "symbol", "line", ".svg"];
  const objectKeywords = [
    "소파", "가전", "공기청정기", "거실", "공간", "배치", "제품", "오브젝트", "배경"
  ].map((item) => String(item).toLowerCase());
  const badgeKeywords = ["홈스타일", "기획전", "가전 구독", "브랜드", "label", "badge"].map((item) =>
    String(item).toLowerCase()
  );
  const hasIconKeyword = iconKeywords.some((keyword) => decoded.includes(keyword));
  const hasPromoKeyword =
    promoKeywords.some((keyword) => decoded.includes(keyword)) ||
    promoKeywords.some((keyword) => normalizedAltText.includes(keyword));
  const hasObjectKeyword =
    objectKeywords.some((keyword) => decoded.includes(keyword)) ||
    objectKeywords.some((keyword) => normalizedAltText.includes(keyword));
  const hasBadgeKeyword =
    badgeKeywords.some((keyword) => decoded.includes(keyword)) ||
    badgeKeywords.some((keyword) => normalizedAltText.includes(keyword));
  const shortAltLabel =
    normalizedAltText &&
    normalizedAltText.length <= 12 &&
    !/\s{2,}/.test(normalizedAltText) &&
    !hasObjectKeyword &&
    !hasPromoKeyword;
  if (hasIconKeyword) return "icon-only";
  if (slotId.startsWith("quickmenu-") && (hasPromoKeyword || decoded.endsWith(".gif") || decoded.endsWith(".png"))) {
    return "promo-complete";
  }
  if (slotId.startsWith("hero-") && hasPromoKeyword) return "promo-complete";
  if (slotId.startsWith("hero-") && (hasBadgeKeyword || shortAltLabel)) return "object-only";
  if (slotId.startsWith("hero-") && hasObjectKeyword) return "background-only";
  return hasPromoKeyword ? "promo-complete" : "reference-only";
}

function buildCurrentAssetInfoMap(sectionPacket = {}) {
  const currentAssets = Array.isArray(sectionPacket?.currentAssets)
    ? sectionPacket.currentAssets
    : [];
  return new Map(
    currentAssets
      .map((item) => [String(item?.assetSlotId || "").trim(), item])
      .filter(([assetSlotId]) => assetSlotId)
  );
}

function collectHeroBackgroundAssetIds(html = "") {
  return Array.from(String(html || "").matchAll(/<img\b[^>]*data-asset-slot="([^"]+)"[^>]*class="([^"]*)"/gi))
    .filter((match) => {
      const className = String(match?.[2] || "");
      return /\bobject-cover\b/i.test(className) && /\bw-full\b/i.test(className) && /\bh-full\b/i.test(className);
    })
    .map((match) => String(match?.[1] || "").trim())
    .filter(Boolean);
}

function getAllowedBackgroundRoles(sectionPacket = {}) {
  const policy = sectionPacket?.assetUsagePolicy && typeof sectionPacket.assetUsagePolicy === "object"
    ? sectionPacket.assetUsagePolicy
    : null;
  const fromPolicy = Array.isArray(policy?.allowedBackgroundRoles)
    ? policy.allowedBackgroundRoles.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  return fromPolicy.length ? fromPolicy : ["background-only"];
}

function findSectionPacket(authorInputSnapshot = {}, slotId = "") {
  const normalizedSlotId = String(slotId || "").trim();
  const packets = Array.isArray(authorInputSnapshot?.designAuthorPacket?.sections)
    ? authorInputSnapshot.designAuthorPacket.sections
    : [];
  return packets.find((item) => String(item?.slotId || "").trim() === normalizedSlotId) || {};
}

function extractGeneratedFamilyMembers(sectionPacket = {}, role = "") {
  const normalizedRole = String(role || "").trim();
  const families = Array.isArray(sectionPacket?.availableAssetFamilies)
    ? sectionPacket.availableAssetFamilies
    : [];
  const family = families.find((item) =>
    (!normalizedRole || String(item?.role || "").trim() === normalizedRole) &&
    item?.generatedFamilyPackage &&
    typeof item.generatedFamilyPackage === "object"
  ) || null;
  if (!family) return null;
  const generated = family.generatedFamilyPackage;
  const members = Array.isArray(generated.members)
    ? generated.members
        .map((member) => ({
          label: String(member?.label || "").trim(),
          assetId: String(member?.assetId || "").trim(),
          assetUrl: String(member?.assetUrl || "").trim(),
        }))
        .filter((member) => (member.label || member.assetId) && member.assetUrl)
    : [];
  return {
    assetFamilyId: String(family.assetFamilyId || "").trim(),
    familyId: String(family.familyId || "").trim(),
    status: String(generated.status || family.status || "").trim(),
    members,
  };
}

function extractAllGeneratedFamilyMembers(sectionPacket = {}, role = "") {
  const normalizedRole = String(role || "").trim();
  const families = Array.isArray(sectionPacket?.availableAssetFamilies)
    ? sectionPacket.availableAssetFamilies
    : [];
  return families
    .filter((item) =>
      (!normalizedRole || String(item?.role || "").trim() === normalizedRole) &&
      item?.generatedFamilyPackage &&
      typeof item.generatedFamilyPackage === "object"
    )
    .flatMap((family) =>
      Array.isArray(family.generatedFamilyPackage.members)
        ? family.generatedFamilyPackage.members.map((member) => ({
            label: String(member?.label || "").trim(),
            assetId: String(member?.assetId || "").trim(),
            assetUrl: String(member?.assetUrl || "").trim(),
          }))
        : []
    )
    .filter((member) => (member.label || member.assetId) && member.assetUrl);
}

function buildAllowedAssetSlotIds(sectionPacket = {}) {
  const currentAssets = Array.isArray(sectionPacket?.currentAssets)
    ? sectionPacket.currentAssets
    : [];
  const generatedIconFamily = extractGeneratedFamilyMembers(sectionPacket, "icon-only");
  const registryIconFamilies =
    sectionPacket?.assetRegistry && typeof sectionPacket.assetRegistry === "object" && Array.isArray(sectionPacket.assetRegistry.iconFamilies)
      ? sectionPacket.assetRegistry.iconFamilies
      : [];
  const registryIconMemberIds = registryIconFamilies.flatMap((family) =>
    Array.isArray(family?.members)
      ? family.members.map((member) => String(member?.assetId || "").trim()).filter(Boolean)
      : []
  );
  return new Set([
    ...currentAssets.map((item) => String(item?.assetSlotId || "").trim()).filter(Boolean),
    ...(
      Array.isArray(generatedIconFamily?.members)
        ? generatedIconFamily.members.map((item) => String(item?.assetId || "").trim()).filter(Boolean)
        : []
    ),
    ...registryIconMemberIds,
  ]);
}

function normalizeComparableAssetUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return decodeAssetSource(raw).trim() || raw;
}

function collectDataAttributeValues(html = "", attributeName = "") {
  const safeAttribute = String(attributeName || "").trim();
  if (!safeAttribute) return [];
  const pattern = new RegExp(`${safeAttribute}="([^"]+)"`, "gi");
  return Array.from(String(html || "").matchAll(pattern))
    .map((match) => String(match?.[1] || "").trim())
    .filter(Boolean);
}

function collectRegistryImageUsage(sectionPacket = {}, html = "") {
  const registry = sectionPacket?.assetRegistry && typeof sectionPacket.assetRegistry === "object"
    ? sectionPacket.assetRegistry
    : {};
  const images = Array.isArray(registry.images) ? registry.images : [];
  const htmlText = String(html || "");
  const imageSources = collectImageSources(htmlText);
  const normalizedImageSources = new Set(imageSources.map(normalizeComparableAssetUrl).filter(Boolean));
  const explicitIds = new Set([
    ...collectDataAttributeValues(htmlText, "data-asset-registry-id"),
    ...collectDataAttributeValues(htmlText, "data-registry-asset-id"),
    ...collectDataAttributeValues(htmlText, "data-image-asset-id"),
  ]);
  return images
    .map((asset) => {
      const probes = [
        asset.assetId,
        asset.variant?.variantId,
        asset.variant?.assetUrl,
        asset.variant?.sourceUrl,
        asset.variant?.sourceRef,
      ].map((item) => String(item || "").trim()).filter(Boolean);
      const normalizedProbes = probes.map(normalizeComparableAssetUrl).filter(Boolean);
      const usedById = probes.some((probe) => explicitIds.has(probe) || htmlText.includes(probe));
      const usedByUrl = normalizedProbes.some((probe) => normalizedImageSources.has(probe));
      if (!usedById && !usedByUrl) return null;
      return {
        assetId: String(asset.assetId || "").trim(),
        status: String(asset.status || "candidate").trim() || "candidate",
        role: String(asset.role || "").trim(),
        viewportProfile: String(asset.viewportProfile || "").trim(),
        variantId: String(asset.variant?.variantId || "").trim(),
        variantViewportProfile: String(asset.variant?.viewportProfile || "").trim(),
        usedBy: usedByUrl ? "url" : "id",
      };
    })
    .filter(Boolean);
}

function collectRegistryInteractionUsage(sectionPacket = {}, html = "") {
  const registry = sectionPacket?.assetRegistry && typeof sectionPacket.assetRegistry === "object"
    ? sectionPacket.assetRegistry
    : {};
  const interactions = Array.isArray(registry.interactionComponents) ? registry.interactionComponents : [];
  const explicitIds = new Set([
    ...collectDataAttributeValues(html, "data-interaction-id"),
    ...collectDataAttributeValues(html, "data-registry-interaction-id"),
  ]);
  return interactions
    .map((component) => {
      const interactionId = String(component?.interactionId || "").trim();
      if (!interactionId) return null;
      if (!explicitIds.has(interactionId) && !String(html || "").includes(interactionId)) return null;
      return {
        interactionId,
        status: String(component.status || "candidate").trim() || "candidate",
        componentType: String(component.componentType || "").trim(),
        runtimeModule: String(component.runtimeModule || "").trim(),
      };
    })
    .filter(Boolean);
}

function summarizeSectionAssetRegistry(sectionPacket = {}) {
  const registry = sectionPacket?.assetRegistry && typeof sectionPacket.assetRegistry === "object"
    ? sectionPacket.assetRegistry
    : {};
  const countByStatus = (items = []) => items.reduce((acc, item) => {
    const status = String(item?.status || "candidate").trim() || "candidate";
    acc[status] = Number(acc[status] || 0) + 1;
    return acc;
  }, {});
  const images = Array.isArray(registry.images) ? registry.images : [];
  const iconFamilies = Array.isArray(registry.iconFamilies) ? registry.iconFamilies : [];
  const interactionComponents = Array.isArray(registry.interactionComponents) ? registry.interactionComponents : [];
  return {
    imageCount: images.length,
    imageStatus: countByStatus(images),
    iconFamilyCount: iconFamilies.length,
    iconFamilyStatus: countByStatus(iconFamilies),
    interactionComponentCount: interactionComponents.length,
    interactionStatus: countByStatus(interactionComponents),
  };
}

function validateDesignAuthorOutput(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const authoredSectionHtmlPackage = (() => {
    if (source.authoredSectionHtmlPackage && typeof source.authoredSectionHtmlPackage === "object") {
      return source.authoredSectionHtmlPackage;
    }
    if (String(source.authoredSectionMarkdownDocument || "").trim()) {
      return projectAuthoredMarkdownToHtmlPackage(source.authoredSectionMarkdownDocument);
    }
    return {};
  })();
  const conceptPackage = source.conceptPackage && typeof source.conceptPackage === "object" ? source.conceptPackage : {};
  const authorInputSnapshot = source.authorInputSnapshot && typeof source.authorInputSnapshot === "object"
    ? source.authorInputSnapshot
    : {};
  const validationContext = source.validationContext && typeof source.validationContext === "object"
    ? source.validationContext
    : {};
  const markdownDiagnostics = String(source.authoredSectionMarkdownDocument || "").trim()
    ? analyzeAuthoredMarkdownProjection(source.authoredSectionMarkdownDocument)
    : null;

  const targetGroup =
    authoredSectionHtmlPackage.targetGroup && typeof authoredSectionHtmlPackage.targetGroup === "object"
      ? authoredSectionHtmlPackage.targetGroup
      : conceptPackage.executionBrief?.targetGroup && typeof conceptPackage.executionBrief.targetGroup === "object"
        ? conceptPackage.executionBrief.targetGroup
        : authorInputSnapshot.targetGroup && typeof authorInputSnapshot.targetGroup === "object"
          ? authorInputSnapshot.targetGroup
          : {};
  const sections = Array.isArray(authoredSectionHtmlPackage.sections) ? authoredSectionHtmlPackage.sections : [];
  const allowedSlotIds = new Set(toStringArray(targetGroup.slotIds, 64));
  const fixedContent = toStringArray(conceptPackage.executionBrief?.userFixedContent, 24);
  const userDirectEdits = Array.isArray(authorInputSnapshot.userDirectEdits) ? authorInputSnapshot.userDirectEdits : [];
  const currentPageAssetMap =
    validationContext.assetResolutionContext?.currentPageAssetMap &&
    typeof validationContext.assetResolutionContext.currentPageAssetMap === "object"
      ? validationContext.assetResolutionContext.currentPageAssetMap
      : {};

  const blockingReasons = [];
  const checkRecords = [];
  const advisory = [];
  const assetRegistryDiagnostics = [];

  if (!String(targetGroup.groupId || "").trim()) {
    collectBlocking(blockingReasons, "target_group_missing");
  } else {
    checkRecords.push(`target group 확인: ${String(targetGroup.groupId || "").trim()}`);
  }

  if (!sections.length) {
    collectBlocking(blockingReasons, "sections_missing");
  } else {
    checkRecords.push(`authored sections 존재 확인: ${sections.length}`);
  }

  if (markdownDiagnostics) {
    const declaredKeys = Array.isArray(markdownDiagnostics.declaredSectionKeys)
      ? markdownDiagnostics.declaredSectionKeys
      : [];
    const projectedKeys = Array.isArray(markdownDiagnostics.projectedSectionKeys)
      ? markdownDiagnostics.projectedSectionKeys
      : [];
    const missingKeys = Array.isArray(markdownDiagnostics.missingSectionKeys)
      ? markdownDiagnostics.missingSectionKeys
      : [];
    checkRecords.push(`declared section keys 확인: ${declaredKeys.join(",") || "none"}`);
    checkRecords.push(`projected section keys 확인: ${projectedKeys.join(",") || "none"}`);
    if (missingKeys.length) {
      collectBlocking(blockingReasons, `missing_section_identifiers:${missingKeys.join(",")}`);
    }
  }

  for (const section of sections) {
    const slotId = String(section?.slotId || "").trim();
    const html = String(section?.html || "").trim();
    if (!slotId) {
      collectBlocking(blockingReasons, "section_slot_id_missing");
      continue;
    }
    if (!html) {
      collectBlocking(blockingReasons, `section_html_missing:${slotId}`);
      continue;
    }
    checkRecords.push(`${slotId} html 존재 확인`);
    if (allowedSlotIds.size && !allowedSlotIds.has(slotId)) {
      collectBlocking(blockingReasons, `section_out_of_scope:${slotId}`);
    }
    if (sectionContainsShellRewrite(html)) {
      collectBlocking(blockingReasons, `shell_rewrite_attempt:${slotId}`);
    }
    const externalImageSources = collectExternalImageSources(html);
    const imageSources = collectImageSources(html);
    const sectionPacket = findSectionPacket(authorInputSnapshot, slotId);
    const registrySummary = summarizeSectionAssetRegistry(sectionPacket);
    const registryImageUsage = collectRegistryImageUsage(sectionPacket, html);
    const registryInteractionUsage = collectRegistryInteractionUsage(sectionPacket, html);
    assetRegistryDiagnostics.push({
      slotId,
      componentId: String(sectionPacket?.componentId || "").trim(),
      viewportProfile: String(authorInputSnapshot?.designAuthorPacket?.page?.viewportProfile || "").trim(),
      summary: registrySummary,
      usedImages: registryImageUsage,
      usedInteractions: registryInteractionUsage,
    });
    if (registrySummary.imageCount || registrySummary.iconFamilyCount || registrySummary.interactionComponentCount) {
      checkRecords.push(`${slotId} asset registry 확인: image=${registrySummary.imageCount}, iconFamily=${registrySummary.iconFamilyCount}, interaction=${registrySummary.interactionComponentCount}`);
    }
    const blockedRegistryImages = registryImageUsage.filter((asset) => asset.status === "blocked");
    const candidateRegistryImages = registryImageUsage.filter((asset) => asset.status === "candidate");
    if (blockedRegistryImages.length) {
      collectBlocking(blockingReasons, `asset_registry_blocked_image_used:${slotId}:${blockedRegistryImages.map((asset) => asset.assetId).join(",")}`);
    }
    if (candidateRegistryImages.length) {
      collectBlocking(blockingReasons, `asset_registry_candidate_image_used:${slotId}:${candidateRegistryImages.map((asset) => asset.assetId).join(",")}`);
    }
    const pageViewport = String(authorInputSnapshot?.designAuthorPacket?.page?.viewportProfile || "").trim();
    const wrongViewportRegistryImages = pageViewport
      ? registryImageUsage.filter((asset) => asset.variantViewportProfile && asset.variantViewportProfile !== pageViewport)
      : [];
    if (wrongViewportRegistryImages.length) {
      collectBlocking(blockingReasons, `asset_registry_viewport_mismatch:${slotId}:${wrongViewportRegistryImages.map((asset) => `${asset.assetId}@${asset.variantViewportProfile}`).join(",")}`);
    }
    const unapprovedInteractions = registryInteractionUsage.filter((component) => component.status !== "approved");
    if (unapprovedInteractions.length) {
      collectBlocking(blockingReasons, `interaction_registry_not_approved:${slotId}:${unapprovedInteractions.map((component) => component.interactionId).join(",")}`);
    }
    if (
      (sectionPacket?.assetUsagePolicy?.imageUsageMode === "full-bleed-background" || slotId === "hero") &&
      registrySummary.imageCount &&
      !Number(registrySummary.imageStatus?.approved || 0)
    ) {
      advisory.push(`asset_registry_no_approved_image_variant:${slotId}`);
    }
    const allowedAssetSlotIds = buildAllowedAssetSlotIds(sectionPacket);
    if (externalImageSources.length) {
      advisory.push(`external_image_source_detected:${slotId}`);
    }
    const assetPlaceholders = Array.isArray(section?.assetPlaceholders) ? section.assetPlaceholders : [];
    const unknownPlaceholders = assetPlaceholders.filter((assetSlotId) => {
      const normalized = String(assetSlotId || "").trim();
      return normalized && allowedAssetSlotIds.size && !allowedAssetSlotIds.has(normalized);
    });
    if (unknownPlaceholders.length) {
      collectBlocking(blockingReasons, `asset_placeholder_unknown:${slotId}:${unknownPlaceholders.join(",")}`);
    }
    const unresolvedPlaceholders = assetPlaceholders.filter((assetSlotId) => {
      const normalized = String(assetSlotId || "").trim();
      return normalized && !currentPageAssetMap[normalized] && !allowedAssetSlotIds.has(normalized);
    });
    if (unresolvedPlaceholders.length) {
      collectBlocking(blockingReasons, `asset_placeholder_unresolved:${slotId}:${unresolvedPlaceholders.join(",")}`);
    }
    const currentAssetInfoMap = buildCurrentAssetInfoMap(sectionPacket);
    const assetRoles = assetPlaceholders
      .map((assetSlotId) => {
        const normalizedAssetSlotId = String(assetSlotId || "").trim();
        const currentAsset = currentAssetInfoMap.get(normalizedAssetSlotId) || null;
        const source = currentAsset?.source || currentPageAssetMap[normalizedAssetSlotId];
        return {
          assetSlotId: normalizedAssetSlotId,
          source,
          altText: String(currentAsset?.altText || "").trim(),
          role:
            currentAsset?.assetRole?.role ||
            classifyAssetRole(normalizedAssetSlotId, source, currentAsset?.altText || ""),
        };
      })
      .filter((item) => item.assetSlotId && item.source);
    const assetUsagePolicy = sectionPacket?.assetUsagePolicy && typeof sectionPacket.assetUsagePolicy === "object"
      ? sectionPacket.assetUsagePolicy
      : null;
    const disallowPromoReoverlay =
      assetUsagePolicy?.disallowPromoReoverlay === true ||
      slotId === "quickmenu" ||
      slotId === "hero";
    if (slotId === "quickmenu" && assetRoles.some((item) => item.role === "promo-complete")) {
      collectBlocking(blockingReasons, `asset_role_mismatch:${slotId}:promo-complete`);
    }
    if (disallowPromoReoverlay && assetRoles.some((item) => item.role === "promo-complete")) {
      collectBlocking(blockingReasons, `asset_role_reoverlay_blocked:${slotId}:promo-complete`);
    }
    const shouldCheckBackgroundRoles =
      assetUsagePolicy?.imageUsageMode === "full-bleed-background" || slotId === "hero";
    if (shouldCheckBackgroundRoles) {
      const allowedBackgroundRoles = new Set(getAllowedBackgroundRoles(sectionPacket));
      const backgroundAssetIds = collectHeroBackgroundAssetIds(html);
      const invalidBackgroundAssets = backgroundAssetIds.filter((assetSlotId) => {
        const assetInfo = assetRoles.find((item) => item.assetSlotId === assetSlotId);
        return assetInfo && !allowedBackgroundRoles.has(assetInfo.role);
      });
      if (invalidBackgroundAssets.length) {
        collectBlocking(blockingReasons, `background_asset_role_mismatch:${slotId}:${invalidBackgroundAssets.join(",")}`);
      }
    }
    if (slotId === "quickmenu") {
      const generatedIconFamily = extractGeneratedFamilyMembers(sectionPacket, "icon-only");
      const hasInlineSvg = /<svg\b/i.test(html);
      if (!generatedIconFamily || !generatedIconFamily.members.length) {
        advisory.push(`quickmenu_icon_family_not_ready:${slotId}`);
      } else {
        const allowedUrls = new Set(
          extractAllGeneratedFamilyMembers(sectionPacket, "icon-only").map((item) => decodeAssetSource(item.assetUrl)).filter(Boolean)
        );
        const nonFamilyImageSources = imageSources.filter((src) => {
          const decoded = decodeAssetSource(src);
          if (!decoded) return false;
          return !allowedUrls.has(decoded);
        });
        if (nonFamilyImageSources.length) {
          collectBlocking(blockingReasons, `quickmenu_icon_family_mismatch:${slotId}`);
        }
        if (!hasInlineSvg && !imageSources.length) {
          advisory.push(`quickmenu_icon_family_unused:${slotId}`);
        }
      }
    }
  }

  if (fixedContent.length) {
    const combinedHtml = sections.map((section) => String(section?.html || "").trim()).join("\n");
    fixedContent.forEach((text) => {
      if (!combinedHtml.includes(text)) {
        collectBlocking(blockingReasons, `fixed_content_missing:${text}`);
      }
    });
    checkRecords.push(`user fixed content 확인: ${fixedContent.length}`);
  }

  if (userDirectEdits.length) {
    const combinedHtml = sections.map((section) => String(section?.html || "").trim()).join("\n");
    userDirectEdits.forEach((edit) => {
      const value = String(edit?.value || "").trim();
      if (value && !combinedHtml.includes(value)) {
        collectBlocking(blockingReasons, `direct_edit_missing:${value}`);
      }
    });
    checkRecords.push(`user direct edits 확인: ${userDirectEdits.length}`);
  }

  if (!blockingReasons.length) {
    checkRecords.push("runtime delivery 가능");
  }

  return {
    deliveryReadiness: {
      summary: blockingReasons.length
        ? "authored result에 runtime 전달 차단 사유가 있습니다."
        : "authored result는 runtime에 전달 가능합니다.",
      readyForRuntime: blockingReasons.length === 0,
      blockingReasons,
    },
    checkRecords,
    advisory,
    assetRegistryDiagnostics,
  };
}

module.exports = {
  validateDesignAuthorOutput,
};
