const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DATA_PATH = path.join(ROOT, "data", "normalized", "editable-prototype.json");

const WORKSPACE_DEFAULT_PAGE_IDS = [
  "home",
  "support",
  "bestshop",
  "care-solutions",
  "category-tvs",
  "category-refrigerators",
];

function buildDefaultSourceSet(prefix) {
  return [
    { sourceId: `captured-${prefix}`, sourceType: "captured", renderer: "iframe", status: "active" },
    { sourceId: `custom-${prefix}-v1`, sourceType: "custom", renderer: "component", status: "draft" },
    { sourceId: `figma-${prefix}-v1`, sourceType: "figma-derived", renderer: "component", status: "draft" },
  ];
}

function buildDefaultSlotEntry(pageId, slotId, componentType) {
  const prefix = `${pageId}-${slotId}`;
  return {
    slotId,
    componentType,
    activeSourceId: `captured-${prefix}`,
    sources: buildDefaultSourceSet(prefix),
  };
}

function buildDefaultHomeSlotRegistry() {
  return {
    pageId: "home",
    slots: [
      {
        slotId: "header-top",
        componentType: "header-top",
        activeSourceId: "captured-home-header-top",
        sources: [
          { sourceId: "captured-home-header-top", sourceType: "captured", renderer: "iframe", status: "active" },
          { sourceId: "custom-home-header-top-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-header-top-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "header-bottom",
        componentType: "header-bottom",
        activeSourceId: "captured-home-header-bottom",
        sources: [
          { sourceId: "captured-home-header-bottom", sourceType: "captured", renderer: "iframe", status: "active" },
          { sourceId: "custom-home-header-bottom-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-header-bottom-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "hero",
        componentType: "hero",
        activeSourceId: "captured-home-hero",
        sources: [
          { sourceId: "captured-home-hero", sourceType: "captured", renderer: "iframe", status: "active" },
          { sourceId: "custom-home-hero-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-hero-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "quickmenu",
        componentType: "quickmenu",
        activeSourceId: "captured-home-quickmenu",
        sources: [
          { sourceId: "captured-home-quickmenu", sourceType: "captured", renderer: "iframe", status: "active" },
          { sourceId: "custom-home-quickmenu-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-quickmenu-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "timedeal",
        componentType: "product-section",
        activeSourceId: "captured-home-timedeal",
        sources: [
          { sourceId: "captured-home-timedeal", sourceType: "captured", renderer: "iframe", status: "active" },
          { sourceId: "custom-home-timedeal-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-timedeal-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "md-choice",
        componentType: "product-section",
        activeSourceId: "captured-home-md-choice",
        sources: [
          { sourceId: "captured-home-md-choice", sourceType: "captured", renderer: "iframe", status: "active" },
          { sourceId: "custom-home-md-choice-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-md-choice-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "best-ranking",
        componentType: "product-section",
        activeSourceId: "custom-renderer",
        sources: [
          { sourceId: "custom-renderer", sourceType: "custom", renderer: "component", status: "active" },
          { sourceId: "figma-home-best-ranking-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "space-renewal",
        componentType: "home-lower",
        activeSourceId: "mobile-derived",
        sources: [
          { sourceId: "mobile-derived", sourceType: "mobile-derived", renderer: "component", status: "active" },
          { sourceId: "custom-home-space-renewal-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-space-renewal-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "subscription",
        componentType: "home-lower",
        activeSourceId: "mobile-derived",
        sources: [
          { sourceId: "mobile-derived", sourceType: "mobile-derived", renderer: "component", status: "active" },
          { sourceId: "custom-home-subscription-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-subscription-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "brand-showroom",
        componentType: "home-lower",
        activeSourceId: "mobile-derived",
        sources: [
          { sourceId: "mobile-derived", sourceType: "mobile-derived", renderer: "component", status: "active" },
          { sourceId: "custom-home-brand-showroom-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-brand-showroom-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "latest-product-news",
        componentType: "home-lower",
        activeSourceId: "mobile-derived",
        sources: [
          { sourceId: "mobile-derived", sourceType: "mobile-derived", renderer: "component", status: "active" },
          { sourceId: "custom-home-latest-product-news-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-latest-product-news-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "smart-life",
        componentType: "home-lower",
        activeSourceId: "mobile-derived",
        sources: [
          { sourceId: "mobile-derived", sourceType: "mobile-derived", renderer: "component", status: "active" },
          { sourceId: "custom-home-smart-life-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-smart-life-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "summary-banner-2",
        componentType: "banner",
        activeSourceId: "mobile-derived",
        sources: [
          { sourceId: "mobile-derived", sourceType: "mobile-derived", renderer: "component", status: "active" },
          { sourceId: "custom-home-summary-banner-2-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-summary-banner-2-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "missed-benefits",
        componentType: "home-lower",
        activeSourceId: "mobile-derived",
        sources: [
          { sourceId: "mobile-derived", sourceType: "mobile-derived", renderer: "component", status: "active" },
          { sourceId: "custom-home-missed-benefits-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-missed-benefits-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "lg-best-care",
        componentType: "home-lower",
        activeSourceId: "mobile-derived",
        sources: [
          { sourceId: "mobile-derived", sourceType: "mobile-derived", renderer: "component", status: "active" },
          { sourceId: "custom-home-lg-best-care-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-lg-best-care-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      },
      {
        slotId: "bestshop-guide",
        componentType: "home-lower",
        activeSourceId: "mobile-derived",
        sources: [
          { sourceId: "mobile-derived", sourceType: "mobile-derived", renderer: "component", status: "active" },
          { sourceId: "custom-home-bestshop-guide-v1", sourceType: "custom", renderer: "component", status: "draft" },
          { sourceId: "figma-home-bestshop-guide-v1", sourceType: "figma-derived", renderer: "component", status: "draft" }
        ]
      }
    ]
  };
}

function buildDefaultServiceSlotRegistry(pageId) {
  const slotIdsByPage = {
    support: [
      ["mainService", "navigation"],
      ["notice", "content"],
      ["tipsBanner", "banner"],
      ["bestcare", "section"],
    ],
    bestshop: [
      ["hero", "hero"],
      ["shortcut", "navigation"],
      ["review", "content"],
      ["brandBanner", "banner"],
    ],
    "care-solutions": [
      ["hero", "hero"],
      ["ranking", "section"],
      ["benefit", "section"],
      ["tabs", "controls"],
      ["careBanner", "banner"],
    ],
  };
  const slots = (slotIdsByPage[pageId] || []).map(([slotId, componentType]) =>
    buildDefaultSlotEntry(pageId, slotId, componentType)
  );
  return { pageId, slots };
}

function buildDefaultCategorySlotRegistry(pageId) {
  const slots = [
    ["banner", "banner"],
    ["filter", "controls"],
    ["sort", "controls"],
    ["productGrid", "product-list"],
    ["firstRow", "product-list"],
    ["firstProduct", "product-card"],
    ["gallery", "gallery"],
    ["option", "controls"],
    ["review", "content"],
    ["qna", "content"],
  ].map(([slotId, componentType]) => buildDefaultSlotEntry(pageId, slotId, componentType));
  return { pageId, slots };
}

function buildDefaultSlotRegistry(pageId) {
  if (pageId === "home") return buildDefaultHomeSlotRegistry();
  if (["support", "bestshop", "care-solutions"].includes(pageId)) {
    return buildDefaultServiceSlotRegistry(pageId);
  }
  if (String(pageId || "").startsWith("category-")) {
    return buildDefaultCategorySlotRegistry(pageId);
  }
  return null;
}

function normalizeSlotRegistry(existingRegistry, defaultRegistry) {
  const current = existingRegistry || {};
  const currentSlots = Array.isArray(current.slots) ? current.slots : [];
  return {
    pageId: defaultRegistry.pageId,
    slots: defaultRegistry.slots.map((defaultSlot) => {
      const existing = currentSlots.find((slot) => slot.slotId === defaultSlot.slotId) || {};
      const sources = Array.isArray(existing.sources) && existing.sources.length ? existing.sources : defaultSlot.sources;
      const capturedSource = sources.find((source) => source.sourceType === "captured") || defaultSlot.sources[0];
      const requestedActiveSourceId =
        typeof existing.activeSourceId === "string" && sources.some((source) => source.sourceId === existing.activeSourceId)
          ? existing.activeSourceId
          : capturedSource.sourceId;
      return {
        ...defaultSlot,
        ...existing,
        activeSourceId: requestedActiveSourceId,
        sources: sources.map((source) => ({
          ...source,
          status:
            source.sourceId === requestedActiveSourceId
              ? "active"
              : source.sourceType === "captured"
                ? "validated"
                : "draft",
        })),
      };
    }),
  };
}

function normalizeEditableData(data) {
  const next = JSON.parse(JSON.stringify(data || {}));
  next.slotRegistries = Array.isArray(next.slotRegistries) ? next.slotRegistries : [];
  next.componentPatches = Array.isArray(next.componentPatches) ? next.componentPatches : [];
  next.acceptanceResults = Array.isArray(next.acceptanceResults) ? next.acceptanceResults : [];
  for (const pageId of WORKSPACE_DEFAULT_PAGE_IDS) {
    const defaultRegistry = buildDefaultSlotRegistry(pageId);
    if (!defaultRegistry) continue;
    const registryIndex = next.slotRegistries.findIndex((item) => item.pageId === pageId);
    if (registryIndex < 0) {
      next.slotRegistries.push(defaultRegistry);
      continue;
    }
    next.slotRegistries[registryIndex] = normalizeSlotRegistry(next.slotRegistries[registryIndex], defaultRegistry);
  }
  return next;
}

function readEditableData() {
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  return normalizeEditableData(JSON.parse(raw));
}

function writeEditableData(data) {
  fs.writeFileSync(DATA_PATH, `${JSON.stringify(normalizeEditableData(data), null, 2)}\n`, "utf-8");
}

function buildSystemPrompt() {
  return [
    "You are an assistant that edits a page prototype JSON.",
    "Return valid JSON only.",
    "You must output an object with keys: summary, operations.",
    "operations must be an array of structured edits.",
    "Allowed actions: rename_section, toggle_section, reorder_section, update_page_title.",
    "Do not invent page ids or section ids that do not exist.",
    "Keep changes minimal and targeted to the request.",
  ].join(" ");
}

function buildUserPrompt(requestText, data) {
  const compact = {
    siteId: data.siteId,
    pages: (data.pages || []).map((page) => ({
      id: page.id,
      title: page.title,
      pageGroup: page.pageGroup,
      sections: (page.sections || []).map((section) => ({
        id: section.id,
        name: section.name,
        componentType: section.componentType,
        visible: section.visible,
        order: section.order,
      })),
    })),
  };

  return JSON.stringify(
    {
      task: "Apply a natural language change request to the prototype document.",
      request: requestText,
      document: compact,
      expectedSchema: {
        summary: "short summary string",
        operations: [
          {
            action: "rename_section | toggle_section | reorder_section | update_page_title",
            pageId: "string",
            sectionId: "string when needed",
            value: "new value when needed",
            visible: "boolean when action is toggle_section",
            order: "number when action is reorder_section",
          },
        ],
      },
    },
    null,
    2,
  );
}

async function callOpenRouter(requestText, data) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const model = process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini";
  const siteUrl = process.env.OPENROUTER_SITE_URL || "http://localhost:3000";
  const siteName = process.env.OPENROUTER_SITE_NAME || "lge-site-analysis";

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": siteUrl,
      "X-Title": siteName,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(requestText, data) },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter request failed: ${response.status} ${text}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter returned empty content");
  }

  return JSON.parse(content);
}

function applyOperations(data, operations) {
  const next = JSON.parse(JSON.stringify(data));

  for (const op of operations || []) {
    const page = (next.pages || []).find((item) => item.id === op.pageId);
    if (!page) continue;

    if (op.action === "update_page_title" && typeof op.value === "string") {
      page.title = op.value;
      continue;
    }

    const section = (page.sections || []).find((item) => item.id === op.sectionId);
    if (!section) continue;

    if (op.action === "rename_section" && typeof op.value === "string") {
      section.name = op.value;
    }

    if (op.action === "toggle_section" && typeof op.visible === "boolean") {
      section.visible = op.visible;
    }

    if (op.action === "reorder_section" && Number.isFinite(op.order)) {
      section.order = Number(op.order);
      page.sections.sort((a, b) => a.order - b.order);
    }
  }

  return next;
}

async function handleLlmChange(requestText) {
  const current = readEditableData();
  const llmResult = await callOpenRouter(requestText, current);
  const next = applyOperations(current, llmResult.operations || []);
  writeEditableData(next);
  return {
    summary: llmResult.summary || "Applied changes",
    operations: llmResult.operations || [],
    data: next,
  };
}

async function handleLlmChangeOnData(requestText, currentData) {
  const current = normalizeEditableData(currentData || {});
  const llmResult = await callOpenRouter(requestText, current);
  const next = applyOperations(current, llmResult.operations || []);
  return {
    summary: llmResult.summary || "Applied changes",
    operations: llmResult.operations || [],
    data: next,
  };
}

module.exports = {
  handleLlmChange,
  handleLlmChangeOnData,
  normalizeEditableData,
  readEditableData,
  writeEditableData,
};
