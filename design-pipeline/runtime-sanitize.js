"use strict";

function sanitizeRuntimeHtml(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  let html = String(source.html || "").trim();
  const removedItems = Array.isArray(source.removedItems) ? source.removedItems.slice(0, 24) : [];
  const advisory = Array.isArray(source.advisory) ? source.advisory.slice(0, 24) : [];

  const scriptMatches = html.match(/<script\b[\s\S]*?<\/script>/gi) || [];
  if (scriptMatches.length) {
    removedItems.push(`script:${scriptMatches.length}`);
    html = html.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  }
  const inlineHandlerMatches = html.match(/\son[a-z]+=(["'])[\s\S]*?\1/gi) || [];
  if (inlineHandlerMatches.length) {
    removedItems.push(`inline-handler:${inlineHandlerMatches.length}`);
    html = html.replace(/\son[a-z]+=(["'])[\s\S]*?\1/gi, "");
  }
  const javascriptHrefMatches = html.match(/\s(href|src)=(["'])javascript:[\s\S]*?\2/gi) || [];
  if (javascriptHrefMatches.length) {
    removedItems.push(`javascript-url:${javascriptHrefMatches.length}`);
    html = html.replace(/\s(href|src)=(["'])javascript:[\s\S]*?\2/gi, "");
  }
  if (removedItems.length) {
    advisory.push("runtime_sanitize_applied");
  }

  return {
    html,
    removedItems,
    advisory,
  };
}

module.exports = {
  sanitizeRuntimeHtml,
};
