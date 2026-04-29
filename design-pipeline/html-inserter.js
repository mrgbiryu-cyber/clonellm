"use strict";

function escapeHtmlAttribute(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeBoundaryEntry(entry = null) {
  if (typeof entry === "string") {
    const html = String(entry || "").trim();
    return html ? { currentHtml: html } : null;
  }
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const currentHtml = String(entry.currentHtml || entry.html || "").trim();
  if (!currentHtml) return null;
  return {
    currentHtml,
  };
}

function replaceFirstOccurrence(haystack = "", needle = "", replacement = "") {
  const source = String(haystack || "");
  const target = String(needle || "");
  if (!source || !target) return { html: source, replaced: false };
  const index = source.indexOf(target);
  if (index < 0) return { html: source, replaced: false };
  return {
    html: `${source.slice(0, index)}${replacement}${source.slice(index + target.length)}`,
    replaced: true,
  };
}

function replaceMainInnerHtml(html = "", replacement = "") {
  const source = String(html || "");
  const mainOpenMatch = source.match(/<main\b[^>]*>/i);
  if (!mainOpenMatch || typeof mainOpenMatch.index !== "number") {
    return { html: source, replaced: false };
  }
  const start = mainOpenMatch.index + mainOpenMatch[0].length;
  const end = source.lastIndexOf("</main>");
  if (end < start) {
    return { html: source, replaced: false };
  }
  return {
    html: `${source.slice(0, start)}${replacement}${source.slice(end)}`,
    replaced: true,
  };
}

function upsertSectionRootAttribute(html = "", attributeName = "", attributeValue = "") {
  const source = String(html || "").trim();
  const normalizedAttributeName = String(attributeName || "").trim();
  const normalizedAttributeValue = String(attributeValue || "").trim();
  if (!source || !normalizedAttributeName || !normalizedAttributeValue) return source;
  const sectionOpenMatch = source.match(/^<section\b[^>]*>/i);
  if (!sectionOpenMatch) return source;
  const openingTag = sectionOpenMatch[0];
  const escapedValue = escapeHtmlAttribute(normalizedAttributeValue);
  const hasAttributePattern = new RegExp(`\\s${normalizedAttributeName}=(["']).*?\\1`, "i");
  const nextOpeningTag = hasAttributePattern.test(openingTag)
    ? openingTag.replace(hasAttributePattern, ` ${normalizedAttributeName}="${escapedValue}"`)
    : openingTag.replace(/>$/, ` ${normalizedAttributeName}="${escapedValue}">`);
  return `${nextOpeningTag}${source.slice(openingTag.length)}`;
}

function normalizeSectionHtmlForRuntime(section = {}) {
  const slotId = String(section?.slotId || "").trim();
  const componentId = String(section?.componentId || "").trim();
  let html = String(section?.html || "").trim();
  if (!html) return "";
  const hasSectionRoot = /^<section\b/i.test(html);
  if (!hasSectionRoot) {
    const attrs = [
      slotId ? `data-codex-slot="${escapeHtmlAttribute(slotId)}"` : "",
      componentId ? `data-codex-component-id="${escapeHtmlAttribute(componentId)}"` : "",
      `data-design-author-source="runtime-authored"`,
    ].filter(Boolean).join(" ");
    return `<section ${attrs}>${html}</section>`;
  }
  if (slotId) {
    html = upsertSectionRootAttribute(html, "data-codex-slot", slotId);
  }
  if (componentId) {
    html = upsertSectionRootAttribute(html, "data-codex-component-id", componentId);
  }
  html = upsertSectionRootAttribute(html, "data-design-author-source", "runtime-authored");
  return html;
}

function insertAuthoredSectionsIntoShell(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const authoredSectionHtmlPackage =
    source.authoredSectionHtmlPackage && typeof source.authoredSectionHtmlPackage === "object"
      ? source.authoredSectionHtmlPackage
      : {};
  const boundaryMap =
    source.sectionBoundaryMap && typeof source.sectionBoundaryMap === "object" && !Array.isArray(source.sectionBoundaryMap)
      ? source.sectionBoundaryMap
      : {};
  const beforeHtml = String(source.beforeHtml || source.rawShellHtml || "").trim();
  let afterHtml = beforeHtml;
  const advisory = Array.isArray(source.advisory) ? source.advisory.slice(0, 24) : [];
  const sections = Array.isArray(authoredSectionHtmlPackage.sections) ? authoredSectionHtmlPackage.sections : [];
  const targetGroup = authoredSectionHtmlPackage.targetGroup && typeof authoredSectionHtmlPackage.targetGroup === "object"
    ? authoredSectionHtmlPackage.targetGroup
    : {};
  const isPageScopeGroup = String(targetGroup.groupId || "").trim() === "page";
  const replacementMode = String(targetGroup.replacementMode || "").trim();
  const hasBoundaryEntries = Object.keys(boundaryMap).length > 0;

  if (isPageScopeGroup && (!hasBoundaryEntries || replacementMode === "main") && sections.length) {
    const fullPageHtml = sections
      .map((section) => normalizeSectionHtmlForRuntime(section))
      .filter(Boolean)
      .join("\n");
    const replacedMain = replaceMainInnerHtml(afterHtml, fullPageHtml);
    if (replacedMain.replaced) {
      return {
        beforeHtml,
        afterHtml: replacedMain.html,
        advisory,
      };
    }
    advisory.push("page_scope_main_not_found");
  }

  for (const section of sections) {
    const slotId = String(section?.slotId || "").trim();
    const sectionHtml = normalizeSectionHtmlForRuntime(section);
    if (!slotId || !sectionHtml) continue;
    const boundaryEntry = normalizeBoundaryEntry(boundaryMap[slotId]);
    if (!boundaryEntry?.currentHtml) {
      advisory.push(`boundary_missing:${slotId}`);
      continue;
    }
    const replaced = replaceFirstOccurrence(afterHtml, boundaryEntry.currentHtml, sectionHtml);
    afterHtml = replaced.html;
    if (!replaced.replaced) {
      advisory.push(`boundary_not_found_in_shell:${slotId}`);
    }
  }

  return {
    beforeHtml,
    afterHtml,
    advisory,
  };
}

module.exports = {
  insertAuthoredSectionsIntoShell,
};
