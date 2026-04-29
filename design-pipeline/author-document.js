"use strict";

function toStringArray(value, limit = 24) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, limit);
  }
  if (typeof value === "string") {
    return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, limit);
  }
  return [];
}

function escapeMarkdownText(value = "") {
  return String(value || "").replace(/\r/g, "").trim();
}

function extractNamedValue(block = "", label = "") {
  const pattern = new RegExp(`^${label}:[ \\t]*(.*)$`, "im");
  const match = String(block || "").match(pattern);
  return String(match?.[1] || "").trim();
}

function escapeRegExp(value = "") {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractSectionBody(block = "", heading = "") {
  const text = String(block || "").replace(/\r/g, "");
  const headingPattern = new RegExp(`^###\\s+${escapeRegExp(heading)}\\s*$`, "m");
  const headingMatch = headingPattern.exec(text);
  if (!headingMatch) return "";
  const startIndex = headingMatch.index + headingMatch[0].length;
  const remainder = text.slice(startIndex).replace(/^\n/, "");
  const nextHeadingMatch = /^###\s+/m.exec(remainder);
  const sectionBody = nextHeadingMatch ? remainder.slice(0, nextHeadingMatch.index) : remainder;
  return String(sectionBody || "").trim();
}

function extractListItems(block = "") {
  return Array.from(String(block || "").matchAll(/^\-\s+(.+)$/gm))
    .map((match) => String(match?.[1] || "").trim())
    .filter(Boolean)
    .slice(0, 24);
}

function extractDeliveryMetadata(block = "") {
  const text = String(block || "").replace(/\r/g, "");
  const lines = text.split("\n");
  const metadata = {
    sectionKey: "",
    componentId: "",
    assetSlots: [],
  };
  let collectingAssetSlots = false;
  for (const rawLine of lines) {
    const line = String(rawLine || "");
    const trimmed = line.trim();
    if (!trimmed) {
      if (collectingAssetSlots) continue;
      continue;
    }
    if (/^SectionKey:/i.test(trimmed)) {
      metadata.sectionKey = trimmed.replace(/^SectionKey:\s*/i, "").trim();
      collectingAssetSlots = false;
      continue;
    }
    if (/^ComponentId:/i.test(trimmed)) {
      metadata.componentId = trimmed.replace(/^ComponentId:\s*/i, "").trim();
      collectingAssetSlots = false;
      continue;
    }
    if (/^AssetSlots:/i.test(trimmed)) {
      collectingAssetSlots = true;
      continue;
    }
    if (collectingAssetSlots && /^\-\s+/.test(trimmed)) {
      metadata.assetSlots.push(trimmed.replace(/^\-\s+/, "").trim());
      continue;
    }
    if (/^[A-Za-z][A-Za-z0-9_-]*:/i.test(trimmed)) {
      collectingAssetSlots = false;
    }
  }
  metadata.assetSlots = uniqueValues(metadata.assetSlots, 24);
  return metadata;
}

function extractHtmlFence(block = "") {
  const match = String(block || "").match(/```html\s*([\s\S]*?)```/i);
  return String(match?.[1] || "").trim();
}

function uniqueValues(values = [], limit = 48) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [values])
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  ).slice(0, limit);
}

function collectAssetSlotsFromHtml(html = "") {
  return uniqueValues(
    Array.from(String(html || "").matchAll(/data-asset-slot="([^"]+)"/g))
      .map((match) => String(match?.[1] || "").trim())
      .filter(Boolean),
    24
  );
}

function ensureSectionRuntimeAttributes(html = "", slotId = "", componentId = "") {
  const source = String(html || "").trim();
  const normalizedSlotId = String(slotId || "").trim();
  const normalizedComponentId = String(componentId || "").trim();
  if (!source || !normalizedSlotId) return source;
  return source.replace(/<section\b([^>]*)>/i, (match, attrs = "") => {
    let nextAttrs = String(attrs || "");
    if (!/\sdata-codex-slot=/.test(nextAttrs)) {
      nextAttrs += ` data-codex-slot="${normalizedSlotId}"`;
    }
    if (normalizedComponentId && !/\sdata-codex-component-id=/.test(nextAttrs)) {
      nextAttrs += ` data-codex-component-id="${normalizedComponentId}"`;
    }
    return `<section${nextAttrs}>`;
  });
}

function buildAuthoredSectionMarkdownDocument(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const pageId = String(source.pageId || "").trim();
  const viewportProfile = String(source.viewportProfile || "pc").trim() || "pc";
  const targetGroup = source.targetGroup && typeof source.targetGroup === "object" ? source.targetGroup : {};
  const advisory = Array.isArray(source.advisory) ? source.advisory.slice(0, 24) : [];
  const sections = Array.isArray(source.sections) ? source.sections : [];

  const lines = [
    "# Authored Section Document",
    "",
    `PageId: ${pageId}`,
    `ViewportProfile: ${viewportProfile}`,
    `TargetGroupId: ${String(targetGroup.groupId || "").trim()}`,
    `TargetGroupLabel: ${String(targetGroup.groupLabel || "").trim()}`,
    "",
  ];

  sections.forEach((section) => {
    const slotId = String(section?.slotId || "").trim();
    if (!slotId) return;
    const componentId = String(section?.componentId || "").trim();
    const content = section?.content && typeof section.content === "object" ? section.content : {};
    const role = String(section?.role || content.role || "").trim();
    const intent = String(content.intent || content.supportText || content.headline || "").trim();
    const assetPlaceholders = Array.isArray(section?.assetPlaceholders) ? section.assetPlaceholders.slice(0, 24) : [];
    const sectionAdvisory = Array.isArray(section?.advisory) ? section.advisory.slice(0, 24) : [];

    lines.push(`## Section: ${slotId}`);
    if (componentId) lines.push(`ComponentId: ${componentId}`);
    lines.push("");
    if (role) {
      lines.push("### Role");
      lines.push(escapeMarkdownText(role));
      lines.push("");
    }
    if (intent) {
      lines.push("### Intent");
      lines.push(escapeMarkdownText(intent));
      lines.push("");
    }
    lines.push("### Delivery");
    lines.push(`SectionKey: ${slotId}`);
    if (componentId) lines.push(`ComponentId: ${componentId}`);
    if (assetPlaceholders.length) {
      lines.push("AssetSlots:");
      assetPlaceholders.forEach((item) => lines.push(`- ${escapeMarkdownText(item)}`));
    }
    lines.push("");
    lines.push("### HTML");
    lines.push("```html");
    lines.push(String(section?.html || "").trim());
    lines.push("```");
    lines.push("");
    if (sectionAdvisory.length) {
      lines.push("### Advisory");
      sectionAdvisory.forEach((item) => lines.push(`- ${escapeMarkdownText(item)}`));
      lines.push("");
    }
  });

  if (advisory.length) {
    lines.push("## Advisory");
    advisory.forEach((item) => lines.push(`- ${escapeMarkdownText(item)}`));
    lines.push("");
  }

  return lines.join("\n").trim();
}

function projectAuthoredMarkdownToHtmlPackage(markdown = "") {
  const source = String(markdown || "").trim();
  if (!source) {
    return {
      pageId: "",
      viewportProfile: "pc",
      targetGroup: {},
      sections: [],
      advisory: [],
    };
  }

  const pageId = extractNamedValue(source, "PageId");
  const viewportProfile = extractNamedValue(source, "ViewportProfile") || "pc";
  const targetGroupId = extractNamedValue(source, "TargetGroupId");
  const targetGroupLabel = extractNamedValue(source, "TargetGroupLabel");

  const sections = Array.from(source.matchAll(/^##\s+Section:\s+(.+)$/gm)).map((match, index, allMatches) => {
    const slotIdFromHeading = String(match?.[1] || "").trim();
    const start = match.index + match[0].length;
    const end = index + 1 < allMatches.length ? allMatches[index + 1].index : source.search(/^##\s+Advisory\s*$/m) >= 0 ? source.search(/^##\s+Advisory\s*$/m) : source.length;
    const block = source.slice(start, end).trim();
    const delivery = extractSectionBody(block, "Delivery");
    const deliveryMetadata = extractDeliveryMetadata(delivery);
    const slotId = deliveryMetadata.sectionKey || slotIdFromHeading;
    const componentId = deliveryMetadata.componentId || extractNamedValue(block, "ComponentId");
    const role = extractSectionBody(block, "Role");
    const intent = extractSectionBody(block, "Intent");
    const rawHtml = extractHtmlFence(extractSectionBody(block, "HTML") || block);
    const html = ensureSectionRuntimeAttributes(rawHtml, slotId, componentId);
    const htmlAssetSlots = collectAssetSlotsFromHtml(html);
    const assetPlaceholders = htmlAssetSlots.length
      ? htmlAssetSlots
      : deliveryMetadata.assetSlots.filter((assetSlotId) => /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(String(assetSlotId || "").trim()));
    const advisory = extractListItems(extractSectionBody(block, "Advisory"));
    return {
      slotId,
      componentId,
      role,
      html,
      content: {
        role,
        intent,
      },
      assetPlaceholders,
      advisory,
    };
  }).filter((section) => section.slotId && section.html);

  const documentAdvisoryMatch = source.match(/^##\s+Advisory\s*$([\s\S]*)$/m);
  const advisory = documentAdvisoryMatch ? extractListItems(documentAdvisoryMatch[1]) : [];

  return {
    pageId,
    viewportProfile,
    targetGroup: {
      groupId: targetGroupId,
      groupLabel: targetGroupLabel,
    },
    sections,
    advisory,
  };
}

function analyzeAuthoredMarkdownProjection(markdown = "") {
  const source = String(markdown || "").trim();
  const sectionHeadingMatches = Array.from(source.matchAll(/^##\s+Section:\s+(.+)$/gm));
  const htmlFenceMatches = Array.from(source.matchAll(/```html\s*([\s\S]*?)```/gi));
  const componentIdMatches = Array.from(source.matchAll(/^ComponentId:\s+(.+)$/gm));
  const hasDocumentHeader = /^#\s+Authored Section Document\s*$/m.test(source);
  const projected = projectAuthoredMarkdownToHtmlPackage(source);
  const declaredSectionKeys = uniqueValues(sectionHeadingMatches.map((match) => String(match?.[1] || "").trim()));
  const projectedSectionKeys = uniqueValues(
    Array.isArray(projected.sections) ? projected.sections.map((section) => section?.slotId) : []
  );
  const missingSectionKeys = declaredSectionKeys.filter((key) => !projectedSectionKeys.includes(key));
  const unexpectedSectionKeys = projectedSectionKeys.filter((key) => !declaredSectionKeys.includes(key));
  return {
    hasDocumentHeader,
    sectionHeadingCount: sectionHeadingMatches.length,
    htmlFenceCount: htmlFenceMatches.length,
    componentIdCount: componentIdMatches.length,
    projectedSectionCount: Array.isArray(projected.sections) ? projected.sections.length : 0,
    declaredSectionKeys,
    projectedSectionKeys,
    missingSectionKeys,
    unexpectedSectionKeys,
    preview: source.slice(0, 1200),
  };
}

module.exports = {
  buildAuthoredSectionMarkdownDocument,
  projectAuthoredMarkdownToHtmlPackage,
  analyzeAuthoredMarkdownProjection,
};
