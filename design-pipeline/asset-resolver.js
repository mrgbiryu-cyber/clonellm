"use strict";

function escapeRegExp(value = "") {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toStringArray(value, limit = 24) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, limit);
  }
  if (typeof value === "string") {
    return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, limit);
  }
  return [];
}

function normalizeLabelKey(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function getAttributeValue(tag = "", attributeName = "") {
  const pattern = new RegExp(`\\s${escapeRegExp(attributeName)}=(["'])(.*?)\\1`, "i");
  const match = String(tag || "").match(pattern);
  return String(match?.[2] || "").trim();
}

function removeAttribute(tag = "", attributeName = "") {
  const pattern = new RegExp(`\\s${escapeRegExp(attributeName)}=(["']).*?\\1`, "gi");
  return String(tag || "").replace(pattern, "");
}

function setAttribute(tag = "", attributeName = "", value = "") {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) return removeAttribute(tag, attributeName);
  const safeValue = normalizedValue.replace(/"/g, "&quot;");
  const stripped = removeAttribute(tag, attributeName);
  return stripped.replace(/\s*\/?>$/, (ending) => {
    const close = ending.includes("/") ? " />" : ">";
    return ` ${attributeName}="${safeValue}"${close}`;
  });
}

function buildNeutralAssetPlaceholder(tag = "", reason = "asset unavailable") {
  const className = getAttributeValue(tag, "class");
  const alt = getAttributeValue(tag, "alt") || reason;
  const safeAlt = alt.replace(/"/g, "&quot;");
  const safeClass = [
    className,
    "inline-flex items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400",
  ].filter(Boolean).join(" ").replace(/"/g, "&quot;");
  return `<span role="img" aria-label="${safeAlt}" class="${safeClass}"></span>`;
}

function buildFamilyAssetMap(authoredSectionHtmlPackage = {}) {
  const sections = Array.isArray(authoredSectionHtmlPackage?.sections)
    ? authoredSectionHtmlPackage.sections
    : [];
  const familyAssetMap = {};

  sections.forEach((section) => {
    const slotId = String(section?.slotId || "").trim();
    if (!slotId) return;
    const families = Array.isArray(section?.availableAssetFamilies)
      ? section.availableAssetFamilies
      : [];
    const generatedFamily =
      families.find((item) =>
        item?.generatedFamilyPackage &&
        typeof item.generatedFamilyPackage === "object" &&
        Array.isArray(item.generatedFamilyPackage.members) &&
        item.generatedFamilyPackage.members.length
      )?.generatedFamilyPackage || null;
    if (!generatedFamily) return;
    const members = Array.isArray(generatedFamily.members)
      ? generatedFamily.members
          .map((member) => ({
            label: String(member?.label || "").trim(),
            assetId: String(member?.assetId || "").trim(),
            assetUrl: String(member?.assetUrl || "").trim(),
          }))
          .filter((member) => (member.label || member.assetId) && member.assetUrl)
      : [];
    members.forEach((member, index) => {
      const numberedSlotId = `${slotId}-icon-${index + 1}`;
      familyAssetMap[numberedSlotId] = member.assetUrl;
      if (member.assetId) {
        familyAssetMap[member.assetId] = member.assetUrl;
      }
      const keyedSlotId = `${slotId}-${normalizeLabelKey(member.label)}`;
      if (member.label) {
        familyAssetMap[keyedSlotId] = member.assetUrl;
      }
    });
  });

  return familyAssetMap;
}

function findSectionPacket(authorInputSnapshot = {}, slotId = "") {
  const packets = Array.isArray(authorInputSnapshot?.designAuthorPacket?.sections)
    ? authorInputSnapshot.designAuthorPacket.sections
    : [];
  return packets.find((item) => String(item?.slotId || "").trim() === String(slotId || "").trim()) || {};
}

function buildGeneratedFamilyAssetMap(section = {}, sectionPacket = {}) {
  const families = [
    ...(Array.isArray(section?.availableAssetFamilies) ? section.availableAssetFamilies : []),
    ...(Array.isArray(sectionPacket?.availableAssetFamilies) ? sectionPacket.availableAssetFamilies : []),
  ];
  const assetMap = new Map();
  families.forEach((family) => {
    const members = Array.isArray(family?.generatedFamilyPackage?.members)
      ? family.generatedFamilyPackage.members
      : [];
    members.forEach((member) => {
      const assetId = String(member?.assetId || "").trim();
      const assetUrl = String(member?.assetUrl || "").trim();
      if (assetId && assetUrl) assetMap.set(assetId, assetUrl);
    });
  });
  return assetMap;
}

function buildCurrentAssetSlotSet(section = {}, sectionPacket = {}) {
  const currentAssets = [
    ...(Array.isArray(section?.currentAssets) ? section.currentAssets : []),
    ...(Array.isArray(sectionPacket?.currentAssets) ? sectionPacket.currentAssets : []),
    ...(Array.isArray(section?.reusableAssets) ? section.reusableAssets : []),
    ...(Array.isArray(sectionPacket?.reusableAssets) ? sectionPacket.reusableAssets : []),
  ];
  return new Set(
    currentAssets
      .map((item) => String(item?.assetSlotId || "").trim())
      .filter(Boolean)
  );
}

function buildRegistryImageMaps(section = {}, sectionPacket = {}) {
  const images = [
    ...(Array.isArray(section?.assetRegistry?.images) ? section.assetRegistry.images : []),
    ...(Array.isArray(sectionPacket?.assetRegistry?.images) ? sectionPacket.assetRegistry.images : []),
  ];
  const approved = new Map();
  const disallowed = new Set();
  images.forEach((asset) => {
    const assetId = String(asset?.assetId || "").trim();
    if (!assetId) return;
    const status = String(asset?.status || asset?.variant?.status || "candidate").trim() || "candidate";
    const assetUrl = String(asset?.variant?.assetUrl || asset?.variant?.sourceUrl || asset?.variant?.sourceRef || "").trim();
    if (status === "approved" && assetUrl) {
      approved.set(assetId, assetUrl);
    } else {
      disallowed.add(assetId);
    }
  });
  return { approved, disallowed };
}

function refreshSectionAssetPlaceholders(section = {}) {
  const html = String(section?.html || "");
  return Array.from(new Set(
    Array.from(html.matchAll(/data-asset-slot=(["'])([^"']+)\1/gi))
      .map((match) => String(match?.[2] || "").trim())
      .filter(Boolean)
  ));
}

function normalizeAuthoredAssetUsage(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const authoredPackage =
    source.authoredSectionHtmlPackage && typeof source.authoredSectionHtmlPackage === "object"
      ? source.authoredSectionHtmlPackage
      : {};
  const authorInputSnapshot =
    source.authorInputSnapshot && typeof source.authorInputSnapshot === "object"
      ? source.authorInputSnapshot
      : {};
  const sections = Array.isArray(authoredPackage.sections) ? authoredPackage.sections : [];
  const advisory = [];
  const normalizedSections = sections.map((section) => {
    const slotId = String(section?.slotId || "").trim();
    const sectionPacket = findSectionPacket(authorInputSnapshot, slotId);
    const familyAssetMap = buildGeneratedFamilyAssetMap(section, sectionPacket);
    const currentAssetSlotSet = buildCurrentAssetSlotSet(section, sectionPacket);
    const registryImages = buildRegistryImageMaps(section, sectionPacket);
    let familyIndex = 0;
    let html = String(section?.html || "");

    html = html.replace(/<img\b[^>]*>/gi, (tag) => {
      const assetSlotId = getAttributeValue(tag, "data-asset-slot");
      const registryAssetId =
        getAttributeValue(tag, "data-registry-asset-id") ||
        getAttributeValue(tag, "data-asset-registry-id") ||
        getAttributeValue(tag, "data-image-asset-id");
      const src = getAttributeValue(tag, "src");

      if (slotId === "quickmenu" && familyAssetMap.size) {
        const familyAssetId = assetSlotId && familyAssetMap.has(assetSlotId)
          ? assetSlotId
          : Array.from(familyAssetMap.keys())[familyIndex % familyAssetMap.size];
        familyIndex += 1;
        const familyUrl = familyAssetMap.get(familyAssetId);
        advisory.push(`quickmenu_icon_family_normalized:${slotId}:${assetSlotId || src || "img"}`);
        return setAttribute(
          setAttribute(removeAttribute(removeAttribute(tag, "data-registry-asset-id"), "data-asset-registry-id"), "data-asset-slot", familyAssetId),
          "src",
          familyUrl
        );
      }

      if (registryAssetId) {
        if (registryImages.approved.has(registryAssetId)) {
          return setAttribute(
            removeAttribute(removeAttribute(tag, "data-asset-slot"), "data-asset-registry-id"),
            "src",
            registryImages.approved.get(registryAssetId)
          );
        }
        advisory.push(`registry_image_disallowed_normalized:${slotId}:${registryAssetId}`);
        return buildNeutralAssetPlaceholder(tag, "asset unavailable");
      }

      if (!assetSlotId) return tag;

      if (familyAssetMap.has(assetSlotId) || currentAssetSlotSet.has(assetSlotId)) return tag;
      if (registryImages.approved.has(assetSlotId)) {
        advisory.push(`registry_image_slot_converted:${slotId}:${assetSlotId}`);
        return setAttribute(
          setAttribute(removeAttribute(tag, "data-asset-slot"), "data-registry-asset-id", assetSlotId),
          "src",
          registryImages.approved.get(assetSlotId)
        );
      }
      if (registryImages.disallowed.has(assetSlotId)) {
        advisory.push(`asset_slot_disallowed_registry_image_normalized:${slotId}:${assetSlotId}`);
        return buildNeutralAssetPlaceholder(tag, "asset unavailable");
      }
      advisory.push(`asset_slot_invalid_normalized:${slotId}:${assetSlotId}`);
      return src ? removeAttribute(tag, "data-asset-slot") : buildNeutralAssetPlaceholder(tag, "asset unavailable");
    });

    return {
      ...section,
      html,
      assetPlaceholders: refreshSectionAssetPlaceholders({ html }),
    };
  });
  return {
    package: {
      ...authoredPackage,
      sections: normalizedSections,
    },
    advisory,
  };
}

function resolveAuthoredAssetPlaceholders(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const baseAssetMap =
    source.assetMap && typeof source.assetMap === "object" && !Array.isArray(source.assetMap)
      ? source.assetMap
      : {};
  const familyAssetMap = buildFamilyAssetMap(
    source.authoredSectionHtmlPackage && typeof source.authoredSectionHtmlPackage === "object"
      ? source.authoredSectionHtmlPackage
      : {}
  );
  const assetMap = {
    ...familyAssetMap,
    ...baseAssetMap,
  };
  let html = String(source.html || "").trim();
  const advisory = Array.isArray(source.advisory) ? source.advisory.slice(0, 24) : [];
  const resolvedAssets = [];

  Object.entries(assetMap).forEach(([assetSlotId, assetValue]) => {
    const slotId = String(assetSlotId || "").trim();
    const assetUrl =
      typeof assetValue === "string"
        ? String(assetValue || "").trim()
        : String(assetValue?.url || assetValue?.src || "").trim();
    if (!slotId || !assetUrl) return;
    const pattern = new RegExp(`(<img[^>]*?)\\sdata-asset-slot=(["'])${escapeRegExp(slotId)}\\2([^>]*?)>`, "gi");
    const nextHtml = html.replace(pattern, (_match, beforeAttrs, _quote, afterAttrs) => {
      resolvedAssets.push({ assetSlotId: slotId, url: assetUrl });
      return `${beforeAttrs} src="${assetUrl}" data-asset-slot="${slotId}"${afterAttrs}>`;
    });
    html = nextHtml;
  });

  const unresolvedMatches = Array.from(html.matchAll(/data-asset-slot=(["'])([^"']+)\1/gi)).map((match) => String(match[2] || "").trim()).filter(Boolean);
  unresolvedMatches.forEach((slotId) => {
    if (!resolvedAssets.some((item) => item.assetSlotId === slotId)) {
      advisory.push(`asset_unresolved:${slotId}`);
    }
  });

  return {
    html,
    resolvedAssets,
    advisory,
  };
}

module.exports = {
  normalizeAuthoredAssetUsage,
  resolveAuthoredAssetPlaceholders,
};
