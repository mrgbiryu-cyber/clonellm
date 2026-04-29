"use strict";

const { buildAuthoredSectionMarkdownDocument } = require("./author-document");

function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function uniqueList(values = [], limit = 8) {
  return Array.from(
    new Set(
      Array.isArray(values)
        ? values.map((item) => String(item || "").replace(/\s+/g, " ").trim()).filter(Boolean)
        : []
    )
  ).slice(0, limit);
}

function stripHtml(value = "") {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLabelKey(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function extractReferenceTextsFromHtml(html = "", limit = 8) {
  const source = String(html || "");
  const matches = Array.from(source.matchAll(/<(a|button|strong|span|p|h1|h2|h3|li)\b[^>]*>([\s\S]*?)<\/\1>/gi));
  return uniqueList(
    matches
      .map((match) => stripHtml(match?.[2] || ""))
      .filter((text) => text && text.length <= 36),
    limit
  );
}

function buildCurrentSectionReferenceMap(input = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  return Object.fromEntries(
    Object.entries(source)
      .map(([slotId, html]) => [String(slotId || "").trim(), String(html || "").trim()])
      .filter(([slotId, html]) => slotId && html)
  );
}

function deriveVisualSurfaceClass(section = {}) {
  const slotId = String(section?.slotId || "").trim();
  const visualIntent = [
    section?.tone?.surfaceTone,
    section?.tone?.emphasisTone,
    section?.layout?.layoutMode,
    section?.content?.primaryMessage,
  ].join(" ").toLowerCase();
  if (slotId === "hero") {
    return "bg-gradient-to-br from-[#f7f8fb] via-white to-[#eef2f7]";
  }
  if (slotId === "quickmenu") {
    return "bg-[#f7f7f5]";
  }
  if (slotId === "summary") {
    return "bg-white";
  }
  if (slotId === "sticky") {
    return "bg-white";
  }
  if (/trust|service/.test(visualIntent)) {
    return "bg-[#f6faf8]";
  }
  return "bg-white";
}

function normalizeSlotId(value = "") {
  return String(value || "").trim().toLowerCase();
}

function getSectionFallbackMode(options = {}) {
  const sectionPacket =
    options.sectionPacket && typeof options.sectionPacket === "object"
      ? options.sectionPacket
      : {};
  return String(sectionPacket?.assetFallbackPolicy?.mode || "").trim();
}

function buildReferenceItems(options = {}, fallbackItems = [], limit = 6) {
  const referenceTexts = extractReferenceTextsFromHtml(options?.currentSectionHtml || "", limit * 2);
  const items = referenceTexts.length ? referenceTexts : fallbackItems;
  return uniqueList(items, limit);
}

function looksInternalAuthoringText(value = "") {
  const text = String(value || "").trim();
  if (!text) return false;
  return [
    /운영 카피 확인용/,
    /재구성한다/,
    /정리합니다/,
    /보존하면서/,
    /현재 원본 구조/,
    /명확한 디자인 시안/,
    /섹션을 현재/,
    /자산 없이/,
    /fallback/i,
    /coverage validation/i,
    /concept/i,
    /layout system/i,
    /target group/i,
    /visual direction/i,
    /must keep/i,
    /must change/i,
  ].some((pattern) => pattern.test(text));
}

function visibleText(value = "", fallback = "") {
  const text = String(value || "").trim();
  if (!text || looksInternalAuthoringText(text)) return String(fallback || "").trim();
  return text;
}

function deriveEyebrow(section = {}) {
  return visibleText(section?.patch?.badge, "추천");
}

function deriveHeadline(section = {}) {
  return (
    visibleText(section?.patch?.headline) ||
    visibleText(section?.patch?.title) ||
    visibleText(section?.content?.primaryMessage) ||
    "필요한 정보를 한눈에 확인하세요"
  );
}

function deriveSupport(section = {}) {
  return (
    visibleText(section?.patch?.subtitle) ||
    visibleText(section?.patch?.support) ||
    visibleText(section?.content?.supportMessage) ||
    "중요한 정보와 다음 행동을 보기 쉽게 정리했습니다."
  );
}

function derivePrimaryCta(section = {}) {
  return (
    String(section?.patch?.primaryCtaLabel || "").trim() ||
    String(section?.content?.ctaLabels?.[0] || "").trim() ||
    "자세히 보기"
  );
}

function findSectionPacket(authorInput = {}, slotId = "") {
  const normalizedSlotId = String(slotId || "").trim();
  const packets = Array.isArray(authorInput?.designAuthorPacket?.sections)
    ? authorInput.designAuthorPacket.sections
    : [];
  return packets.find((item) => String(item?.slotId || "").trim() === normalizedSlotId) || {};
}

function pickQuickmenuFamilyMembers(section = {}, options = {}) {
  const sectionPacket =
    options.sectionPacket && typeof options.sectionPacket === "object"
      ? options.sectionPacket
      : {};
  const families = Array.isArray(sectionPacket.availableAssetFamilies)
    ? sectionPacket.availableAssetFamilies
    : [];
  const family =
    families.find((item) =>
      String(item?.role || "").trim() === "icon-only" &&
      Array.isArray(item?.generatedFamilyPackage?.members) &&
      item.generatedFamilyPackage.members.length
    ) || null;
  return family && Array.isArray(family.generatedFamilyPackage.members)
    ? family.generatedFamilyPackage.members
        .map((member) => ({
          label: String(member?.label || "").trim(),
          assetUrl: String(member?.assetUrl || "").trim(),
        }))
        .filter((member) => member.label && member.assetUrl)
    : [];
}

function deriveSecondaryCta(section = {}) {
  return (
    String(section?.patch?.secondaryCtaLabel || "").trim() ||
    String(section?.content?.ctaLabels?.[1] || "").trim()
  );
}

function pickHeroBackgroundAssetSlotId(options = {}) {
  const sectionPacket =
    options.sectionPacket && typeof options.sectionPacket === "object"
      ? options.sectionPacket
      : {};
  const currentAssets = Array.isArray(sectionPacket.currentAssets)
    ? sectionPacket.currentAssets
    : [];
  const backgroundAsset = currentAssets.find((item) => String(item?.assetRole?.role || "").trim() === "background-only");
  if (backgroundAsset?.assetSlotId) {
    return String(backgroundAsset.assetSlotId).trim();
  }
  return "";
}

function pickAllowedCurrentAssetSlotId(options = {}, allowedRoles = []) {
  const sectionPacket =
    options.sectionPacket && typeof options.sectionPacket === "object"
      ? options.sectionPacket
      : {};
  const currentAssets = Array.isArray(sectionPacket.currentAssets)
    ? sectionPacket.currentAssets
    : [];
  const allowed = new Set(
    (Array.isArray(allowedRoles) ? allowedRoles : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  );
  if (!allowed.size) return "";
  const matched = currentAssets.find((item) => allowed.has(String(item?.assetRole?.role || "").trim()));
  return matched?.assetSlotId ? String(matched.assetSlotId).trim() : "";
}

function renderHeroSectionHtml(section = {}, options = {}) {
  const slotId = String(section?.slotId || "hero").trim() || "hero";
  const componentId = String(section?.componentId || `${slotId}`).trim() || slotId;
  const eyebrow = deriveEyebrow(section);
  const headline = deriveHeadline(section);
  const support = deriveSupport(section);
  const primaryCta = derivePrimaryCta(section);
  const secondaryCta = deriveSecondaryCta(section);
  const preserve = uniqueList(section?.constraints?.preserve || section?.content?.keep || [], 3);
  const imageSlotId = pickHeroBackgroundAssetSlotId(options);
  return `
<section data-codex-slot="${escapeHtml(slotId)}" data-codex-component-id="${escapeHtml(componentId)}" data-design-author-source="local" class="mx-auto w-full ${deriveVisualSurfaceClass(section)}">
  <div class="mx-auto grid max-w-[1280px] gap-10 px-6 py-14 lg:grid-cols-[minmax(0,0.88fr)_minmax(360px,1.12fr)] lg:items-center lg:px-10 lg:py-20">
    <div class="flex min-w-0 flex-col gap-5">
      ${eyebrow ? `<span class="inline-flex w-fit items-center rounded-full border border-[#d7dbe5] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">${escapeHtml(eyebrow)}</span>` : ""}
      <div class="flex flex-col gap-4">
        <h1 class="max-w-[12ch] text-4xl font-semibold leading-[1.02] tracking-[-0.05em] text-[#111827] lg:text-[64px]">${escapeHtml(headline)}</h1>
        ${support ? `<p class="max-w-[56ch] text-[15px] leading-7 text-[#4b5563] lg:text-[17px]">${escapeHtml(support)}</p>` : ""}
      </div>
      ${preserve.length ? `
      <ul class="grid gap-2 text-sm leading-6 text-[#374151]">
        ${preserve.map((item) => `<li class="flex items-start gap-2"><span class="mt-[7px] h-1.5 w-1.5 rounded-full bg-[#a50034]"></span><span>${escapeHtml(item)}</span></li>`).join("")}
      </ul>` : ""}
      <div class="flex flex-wrap items-center gap-3 pt-2">
        <a href="#" class="inline-flex items-center justify-center rounded-full bg-[#a50034] px-5 py-3 text-sm font-semibold text-white no-underline">${escapeHtml(primaryCta)}</a>
        ${secondaryCta ? `<a href="#" class="inline-flex items-center justify-center rounded-full border border-[#d1d5db] bg-white px-5 py-3 text-sm font-semibold text-[#111827] no-underline">${escapeHtml(secondaryCta)}</a>` : ""}
      </div>
    </div>
    <div class="min-w-0">
      <div class="overflow-hidden rounded-[32px] border border-white/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div class="aspect-[5/4] w-full bg-[linear-gradient(135deg,#f8fafc_0%,#eef2f7_100%)]">
          ${imageSlotId
            ? `<img data-asset-slot="${escapeHtml(imageSlotId)}" alt="${escapeHtml(headline)}" class="h-full w-full object-cover" />`
            : `<div class="flex h-full w-full items-end justify-start bg-[radial-gradient(circle_at_70%_30%,rgba(165,0,52,0.18),transparent_34%),linear-gradient(135deg,#f8fafc_0%,#e5e7eb_100%)] p-8">
              <div class="h-24 w-24 rounded-full border border-white/80 bg-white/55 shadow-[0_18px_45px_rgba(15,23,42,0.12)]"></div>
            </div>`}
        </div>
      </div>
    </div>
  </div>
</section>`.trim();
}

function renderQuickmenuSectionHtml(section = {}, options = {}) {
  const slotId = String(section?.slotId || "quickmenu").trim() || "quickmenu";
  const componentId = String(section?.componentId || `${slotId}`).trim() || slotId;
  const headline = deriveHeadline(section);
  const support = deriveSupport(section);
  const referenceTexts = extractReferenceTextsFromHtml(options?.currentSectionHtml || "", 8);
  const itemLabels = referenceTexts.length
    ? referenceTexts.slice(0, 8)
    : uniqueList([
        "혜택 모아보기",
        "추천 제품",
        "카테고리 탐색",
        "이벤트",
        "멤버십",
        "고객 지원",
      ], 8);
  const familyMembers = pickQuickmenuFamilyMembers(section, options);
  const familyMemberMap = new Map(
    familyMembers.map((item) => [normalizeLabelKey(item.label), item.assetUrl])
  );
  const fallbackGlyphs = ["◇", "○", "△", "□", "✦", "↗", "◎", "◌"];
  return `
<section data-codex-slot="${escapeHtml(slotId)}" data-codex-component-id="${escapeHtml(componentId)}" data-design-author-source="local" class="mx-auto w-full ${deriveVisualSurfaceClass(section)} border-t border-[#eceff3]">
  <div class="mx-auto flex max-w-[1280px] flex-col gap-6 px-6 py-8 lg:px-10 lg:py-10">
    <div class="flex flex-col gap-2">
      <h2 class="text-[24px] font-semibold tracking-[-0.04em] text-[#111827]">${escapeHtml(headline)}</h2>
      ${support ? `<p class="text-[14px] leading-6 text-[#6b7280]">${escapeHtml(support)}</p>` : ""}
    </div>
    <div class="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
      ${itemLabels.map((label, index) => {
        const exactAssetUrl = familyMemberMap.get(normalizeLabelKey(label));
        const indexedAssetUrl = familyMembers[index]?.assetUrl || "";
        const assetUrl = exactAssetUrl || indexedAssetUrl;
        return `
        <a href="#" class="flex min-h-[96px] flex-col justify-between rounded-[20px] border border-[#e5e7eb] bg-white p-4 text-[#111827] no-underline shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition hover:-translate-y-[1px]">
          ${
            assetUrl
              ? `<span class="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#f4f5f7] ring-1 ring-inset ring-[#e5e7eb]"><img src="${escapeHtml(assetUrl)}" alt="${escapeHtml(label)}" class="h-7 w-7 object-contain" /></span>`
              : `<span class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f4f5f7] text-[16px] font-medium text-[#374151] ring-1 ring-inset ring-[#e5e7eb]">${fallbackGlyphs[index % fallbackGlyphs.length]}</span>`
          }
          <span class="text-sm font-medium leading-5">${escapeHtml(label)}</span>
        </a>`;
      }).join("")}
    </div>
  </div>
</section>`.trim();
}

function renderVisualBannerSectionHtml(section = {}, options = {}) {
  const slotId = String(section?.slotId || "visual").trim() || "visual";
  const componentId = String(section?.componentId || `${slotId}`).trim() || slotId;
  const eyebrow = deriveEyebrow(section);
  const headline = deriveHeadline(section);
  const support = deriveSupport(section);
  const primaryCta = derivePrimaryCta(section);
  const imageSlotId = pickAllowedCurrentAssetSlotId(options, ["background-only", "object-only"]);
  const fallbackMode = getSectionFallbackMode(options);
  return `
<section data-codex-slot="${escapeHtml(slotId)}" data-codex-component-id="${escapeHtml(componentId)}" data-design-author-source="local" data-asset-fallback-mode="${escapeHtml(fallbackMode)}" class="mx-auto w-full bg-[#f7f4ef]">
  <div class="mx-auto grid max-w-[1280px] gap-6 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)] lg:px-10 lg:py-14">
    <div class="relative overflow-hidden rounded-[30px] border border-white/80 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.08)]">
      <div class="aspect-[16/9] w-full">
        ${imageSlotId
          ? `<img data-asset-slot="${escapeHtml(imageSlotId)}" alt="${escapeHtml(headline)}" class="h-full w-full object-cover" />`
          : `<div class="flex h-full w-full items-end bg-[radial-gradient(circle_at_28%_28%,rgba(165,0,52,0.16),transparent_30%),linear-gradient(135deg,#fff7ed_0%,#eef2f7_55%,#f8fafc_100%)] p-6">
            <div class="grid w-full grid-cols-3 gap-3">
              <span class="h-20 rounded-[24px] bg-white/70 shadow-sm"></span>
              <span class="h-28 rounded-[28px] bg-white/55 shadow-sm"></span>
              <span class="h-16 self-end rounded-[20px] bg-[#111827]/10"></span>
            </div>
          </div>`}
      </div>
    </div>
    <div class="flex flex-col justify-center gap-4 rounded-[30px] border border-white/70 bg-white/82 p-6 shadow-[0_12px_45px_rgba(15,23,42,0.05)] lg:p-8">
      ${eyebrow ? `<span class="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#8a6f58]">${escapeHtml(eyebrow)}</span>` : ""}
      <h2 class="text-[32px] font-semibold leading-[1.05] tracking-[-0.05em] text-[#111827] lg:text-[48px]">${escapeHtml(headline)}</h2>
      ${support ? `<p class="text-[15px] leading-7 text-[#4b5563]">${escapeHtml(support)}</p>` : ""}
      <a href="#" class="mt-2 inline-flex w-fit items-center justify-center rounded-full bg-[#111827] px-5 py-3 text-sm font-semibold text-white no-underline">${escapeHtml(primaryCta)}</a>
    </div>
  </div>
</section>`.trim();
}

function renderCommerceGridSectionHtml(section = {}, options = {}) {
  const slotId = String(section?.slotId || "commerce").trim() || "commerce";
  const componentId = String(section?.componentId || `${slotId}`).trim() || slotId;
  const headline = deriveHeadline(section);
  const support = deriveSupport(section);
  const items = buildReferenceItems(options, ["프리미엄 추천", "인기 모델", "신제품", "혜택 구성"], 4);
  return `
<section data-codex-slot="${escapeHtml(slotId)}" data-codex-component-id="${escapeHtml(componentId)}" data-design-author-source="local" data-asset-fallback-mode="${escapeHtml(getSectionFallbackMode(options))}" class="mx-auto w-full bg-white">
  <div class="mx-auto max-w-[1280px] px-6 py-10 lg:px-10 lg:py-12">
    <div class="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <span class="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#a50034]">Curated</span>
        <h2 class="mt-2 text-[30px] font-semibold tracking-[-0.05em] text-[#111827] lg:text-[42px]">${escapeHtml(headline)}</h2>
      </div>
      ${support ? `<p class="max-w-[46ch] text-[14px] leading-6 text-[#6b7280]">${escapeHtml(support)}</p>` : ""}
    </div>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      ${items.map((item, index) => `
      <article class="group overflow-hidden rounded-[26px] border border-[#e8ebf1] bg-[#f8fafc] shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        <div class="flex aspect-[4/3] items-end bg-[radial-gradient(circle_at_64%_28%,rgba(165,0,52,0.13),transparent_30%),linear-gradient(145deg,#ffffff,#edf1f6)] p-5">
          <div class="h-20 w-full rounded-[22px] bg-white/72 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.8),0_14px_32px_rgba(15,23,42,0.08)]"></div>
        </div>
        <div class="flex min-h-[128px] flex-col justify-between gap-4 bg-white p-5">
          <div>
            <strong class="block text-[17px] font-semibold tracking-[-0.03em] text-[#111827]">${escapeHtml(item)}</strong>
            <p class="mt-2 text-[13px] leading-5 text-[#6b7280]">${escapeHtml(index % 2 ? "비교하기 쉽게 핵심 조건을 정리했습니다." : "지금 확인해야 할 특징을 한눈에 보여줍니다.")}</p>
          </div>
          <span class="inline-flex w-fit items-center rounded-full border border-[#d1d5db] px-3 py-1 text-[12px] font-semibold text-[#374151]">자세히 보기</span>
        </div>
      </article>`).join("")}
    </div>
  </div>
</section>`.trim();
}

function renderUtilityContentSectionHtml(section = {}, options = {}) {
  const slotId = String(section?.slotId || "section").trim() || "section";
  const componentId = String(section?.componentId || `${slotId}`).trim() || slotId;
  const headline = deriveHeadline(section);
  const support = deriveSupport(section);
  const items = buildReferenceItems(options, ["핵심 정보", "선택 기준", "확인 사항"], 3);
  return `
<section data-codex-slot="${escapeHtml(slotId)}" data-codex-component-id="${escapeHtml(componentId)}" data-design-author-source="local" data-asset-fallback-mode="${escapeHtml(getSectionFallbackMode(options))}" class="mx-auto w-full bg-[#f8fafc]">
  <div class="mx-auto max-w-[1120px] px-6 py-9 lg:px-10">
    <div class="rounded-[28px] border border-[#e5e7eb] bg-white p-6 shadow-[0_10px_36px_rgba(15,23,42,0.045)] lg:p-8">
      <div class="grid gap-6 lg:grid-cols-[0.72fr_1fr] lg:items-start">
        <div>
          <span class="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">Information</span>
          <h2 class="mt-2 text-[28px] font-semibold leading-[1.08] tracking-[-0.05em] text-[#111827]">${escapeHtml(headline)}</h2>
          ${support ? `<p class="mt-3 text-[14px] leading-6 text-[#6b7280]">${escapeHtml(support)}</p>` : ""}
        </div>
        <div class="grid gap-3">
          ${items.map((item, index) => `
          <div class="flex items-start gap-4 rounded-[20px] border border-[#edf0f4] bg-[#fbfcfe] p-4">
            <span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#111827] text-[12px] font-semibold text-white">${index + 1}</span>
            <div>
              <strong class="block text-[15px] font-semibold text-[#111827]">${escapeHtml(item)}</strong>
              <p class="mt-1 text-[13px] leading-5 text-[#6b7280]">사용자가 바로 판단할 수 있도록 상태와 기준을 분명하게 나눕니다.</p>
            </div>
          </div>`).join("")}
        </div>
      </div>
    </div>
  </div>
</section>`.trim();
}

function renderSummarySectionHtml(section = {}, options = {}) {
  const slotId = String(section?.slotId || "summary").trim() || "summary";
  const componentId = String(section?.componentId || `${slotId}`).trim() || slotId;
  const eyebrow = deriveEyebrow(section);
  const headline = deriveHeadline(section);
  const support = deriveSupport(section);
  const primaryCta = derivePrimaryCta(section);
  const imageSlotId = pickAllowedCurrentAssetSlotId(options, ["background-only"]);
  const hasSafeBackgroundImage = Boolean(imageSlotId);
  return `
<section data-codex-slot="${escapeHtml(slotId)}" data-codex-component-id="${escapeHtml(componentId)}" data-design-author-source="local" class="mx-auto w-full ${deriveVisualSurfaceClass(section)}">
  <div class="mx-auto ${hasSafeBackgroundImage ? "grid max-w-[1280px] gap-8 px-6 py-10 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.15fr)] lg:px-10" : "max-w-[960px] px-6 py-10 lg:px-10"}">
    ${hasSafeBackgroundImage ? `
    <div class="overflow-hidden rounded-[28px] border border-[#edf0f4] bg-[#f8fafc]">
      <div class="aspect-square">
        <img data-asset-slot="${escapeHtml(imageSlotId)}" alt="${escapeHtml(headline)}" class="h-full w-full object-cover" />
      </div>
    </div>` : ""}
    <div class="flex flex-col justify-center gap-4 ${hasSafeBackgroundImage ? "" : "rounded-[28px] border border-[#edf0f4] bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] lg:p-8"}">
      ${eyebrow ? `<span class="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">${escapeHtml(eyebrow)}</span>` : ""}
      <h1 class="text-3xl font-semibold leading-[1.08] tracking-[-0.04em] text-[#111827] lg:text-[48px]">${escapeHtml(headline)}</h1>
      ${support ? `<p class="max-w-[48ch] text-[15px] leading-7 text-[#4b5563]">${escapeHtml(support)}</p>` : ""}
      <div class="pt-2">
        <a href="#" class="inline-flex items-center justify-center rounded-full bg-[#111827] px-5 py-3 text-sm font-semibold text-white no-underline">${escapeHtml(primaryCta)}</a>
      </div>
    </div>
  </div>
</section>`.trim();
}

function renderStickySectionHtml(section = {}) {
  const slotId = String(section?.slotId || "sticky").trim() || "sticky";
  const componentId = String(section?.componentId || `${slotId}`).trim() || slotId;
  const headline = deriveHeadline(section);
  const support = deriveSupport(section);
  const primaryCta = derivePrimaryCta(section);
  return `
<section data-codex-slot="${escapeHtml(slotId)}" data-codex-component-id="${escapeHtml(componentId)}" data-design-author-source="local" class="mx-auto w-full ${deriveVisualSurfaceClass(section)} border-t border-[#eceff3]">
  <div class="mx-auto flex max-w-[1280px] flex-col gap-4 px-6 py-6 lg:flex-row lg:items-center lg:justify-between lg:px-10">
    <div class="min-w-0">
      <strong class="block text-[22px] font-semibold tracking-[-0.03em] text-[#111827]">${escapeHtml(headline)}</strong>
      ${support ? `<p class="mt-2 text-[14px] leading-6 text-[#6b7280]">${escapeHtml(support)}</p>` : ""}
    </div>
    <a href="#" class="inline-flex shrink-0 items-center justify-center rounded-full bg-[#a50034] px-6 py-3 text-sm font-semibold text-white no-underline">${escapeHtml(primaryCta)}</a>
  </div>
</section>`.trim();
}

function renderGenericSectionHtml(section = {}) {
  const slotId = String(section?.slotId || "section").trim() || "section";
  const componentId = String(section?.componentId || `${slotId}`).trim() || slotId;
  const headline = deriveHeadline(section);
  const support = deriveSupport(section);
  return `
<section data-codex-slot="${escapeHtml(slotId)}" data-codex-component-id="${escapeHtml(componentId)}" data-design-author-source="local" class="mx-auto w-full ${deriveVisualSurfaceClass(section)}">
  <div class="mx-auto max-w-[1280px] px-6 py-10 lg:px-10">
    <div class="rounded-[24px] border border-[#e7eaf0] bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
      <h2 class="text-[28px] font-semibold tracking-[-0.04em] text-[#111827]">${escapeHtml(headline)}</h2>
      ${support ? `<p class="mt-3 text-[15px] leading-7 text-[#4b5563]">${escapeHtml(support)}</p>` : ""}
    </div>
  </div>
</section>`.trim();
}

function renderLocalAuthoredSectionHtml(section = {}, options = {}) {
  const slotId = String(section?.slotId || "").trim();
  const normalizedSlotId = normalizeSlotId(slotId);
  if (slotId === "hero") return renderHeroSectionHtml(section, options);
  if (normalizedSlotId === "quickmenu" || normalizedSlotId === "shortcut" || normalizedSlotId === "tabs") return renderQuickmenuSectionHtml(section, options);
  if (slotId === "summary") return renderSummarySectionHtml(section, options);
  if (slotId === "sticky") return renderStickySectionHtml(section, options);
  if (["visual", "brandbanner", "labelbanner", "brandstory", "marketing-area", "brand-showroom"].includes(normalizedSlotId)) {
    return renderVisualBannerSectionHtml(section, options);
  }
  if (["md-choice", "timedeal", "best-ranking", "bestproduct", "firstrow", "firstproduct", "latest-product-news", "subscription"].includes(normalizedSlotId)) {
    return renderCommerceGridSectionHtml(section, options);
  }
  if (["price", "option", "review", "reviewinfo", "qna", "guides", "seller", "benefit", "noticebanner", "detailinfo", "header-top", "header-bottom", "smart-life", "lg-best-care", "bestshop-guide"].includes(normalizedSlotId)) {
    return renderUtilityContentSectionHtml(section, options);
  }
  return renderGenericSectionHtml(section, options);
}

function collectAssetPlaceholdersFromHtml(html = "") {
  return Array.from(String(html || "").matchAll(/data-asset-slot="([^"]+)"/g))
    .map((match) => String(match?.[1] || "").trim())
    .filter(Boolean)
    .slice(0, 24);
}

function buildLocalAuthoredSectionHtmlPackage(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const authorInput = source.authorInput && typeof source.authorInput === "object" ? source.authorInput : {};
  const cloneRenderModel = source.cloneRenderModel && typeof source.cloneRenderModel === "object" ? source.cloneRenderModel : {};
  const referenceContext = source.referenceContext && typeof source.referenceContext === "object" ? source.referenceContext : {};
  const currentSectionReferenceMap = buildCurrentSectionReferenceMap(
    authorInput.currentSectionContext?.currentSectionHtmlMap || referenceContext.currentSectionHtmlMap
  );
  const conceptPackage = authorInput.conceptPackage && typeof authorInput.conceptPackage === "object"
    ? authorInput.conceptPackage
    : {};
  const requestedSlotIds = new Set(
    Array.isArray(authorInput.authoringRequest?.targetGroup?.slotIds)
      ? authorInput.authoringRequest.targetGroup.slotIds.map((item) => String(item || "").trim()).filter(Boolean)
      : (Array.isArray(conceptPackage.executionBrief?.targetGroup?.slotIds)
        ? conceptPackage.executionBrief.targetGroup.slotIds.map((item) => String(item || "").trim()).filter(Boolean)
        : [])
  );
  const sections = Array.isArray(cloneRenderModel.sections)
    ? cloneRenderModel.sections
        .filter((section) => {
          const slotId = String(section?.slotId || "").trim();
          if (!requestedSlotIds.size) return true;
          return requestedSlotIds.has(slotId);
        })
        .map((section) => {
          const slotId = String(section?.slotId || "").trim();
          if (!slotId) return null;
          const sectionPacket = findSectionPacket(authorInput, slotId);
          const html = renderLocalAuthoredSectionHtml(section, {
            currentSectionHtml: currentSectionReferenceMap[slotId] || "",
            sectionPacket,
          });
          return {
            slotId,
            componentId: String(section?.componentId || "").trim(),
            html,
            content: {
              sourceMode: "generated",
              headline: deriveHeadline(section),
              supportText: deriveSupport(section),
              ctaLabels: uniqueList(section?.content?.ctaLabels || [], 4),
            },
            assetPlaceholders: collectAssetPlaceholdersFromHtml(html),
            advisory: uniqueList(section?.constraints?.guardrails || [], 8),
            availableAssetFamilies: Array.isArray(sectionPacket.availableAssetFamilies)
              ? sectionPacket.availableAssetFamilies.slice(0, 8)
              : [],
            assetFallbackPolicy:
              sectionPacket.assetFallbackPolicy && typeof sectionPacket.assetFallbackPolicy === "object"
                ? { ...sectionPacket.assetFallbackPolicy }
                : null,
          };
        })
        .filter(Boolean)
    : [];
  return normalizeAuthoredSectionHtmlPackage({
    pageId: String(source.pageId || cloneRenderModel.pageId || "").trim(),
    viewportProfile: String(source.viewportProfile || cloneRenderModel.viewportProfile || "pc").trim() || "pc",
    targetGroup: cloneRenderModel.targetGroup && typeof cloneRenderModel.targetGroup === "object"
      ? { ...cloneRenderModel.targetGroup }
      : (conceptPackage.executionBrief?.targetGroup && typeof conceptPackage.executionBrief.targetGroup === "object"
        ? { ...conceptPackage.executionBrief.targetGroup }
        : {}),
    sections,
    advisory: uniqueList(cloneRenderModel?.renderIntent?.guardrails || [], 12),
  });
}

function buildLocalAuthoredSectionMarkdownDocument(input = {}) {
  const htmlPackage = buildLocalAuthoredSectionHtmlPackage(input);
  return buildAuthoredSectionMarkdownDocument(htmlPackage);
}

function normalizeAuthoredSectionHtmlPackage(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const sections = Array.isArray(source.sections)
    ? source.sections
        .map((section) => {
          const item = section && typeof section === "object" ? section : {};
          return {
            slotId: String(item.slotId || "").trim(),
            componentId: String(item.componentId || "").trim(),
            html: String(item.html || "").trim(),
            content: item.content && typeof item.content === "object" ? { ...item.content } : {},
            assetPlaceholders: Array.isArray(item.assetPlaceholders) ? item.assetPlaceholders.slice(0, 24) : [],
            advisory: Array.isArray(item.advisory) ? item.advisory.slice(0, 24) : [],
            availableAssetFamilies: Array.isArray(item.availableAssetFamilies)
              ? item.availableAssetFamilies.slice(0, 8)
              : [],
            assetFallbackPolicy:
              item.assetFallbackPolicy && typeof item.assetFallbackPolicy === "object"
                ? { ...item.assetFallbackPolicy }
                : null,
          };
        })
        .filter((section) => section.slotId && section.html)
    : [];
  return {
    pageId: String(source.pageId || "").trim(),
    viewportProfile: String(source.viewportProfile || "pc").trim() || "pc",
    targetGroup: source.targetGroup && typeof source.targetGroup === "object" ? { ...source.targetGroup } : {},
    sections,
    advisory: Array.isArray(source.advisory) ? source.advisory.slice(0, 24) : [],
  };
}

function enrichAuthoredSectionHtmlPackageWithAuthorInput(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const authoredSectionHtmlPackage = normalizeAuthoredSectionHtmlPackage(source.authoredSectionHtmlPackage || {});
  const authorInput =
    source.authorInput && typeof source.authorInput === "object"
      ? source.authorInput
      : {};
  const sourceTargetGroup =
    authorInput.authoringRequest?.targetGroup && typeof authorInput.authoringRequest.targetGroup === "object"
      ? authorInput.authoringRequest.targetGroup
      : (authorInput.conceptPackage?.executionBrief?.targetGroup && typeof authorInput.conceptPackage.executionBrief.targetGroup === "object"
        ? authorInput.conceptPackage.executionBrief.targetGroup
        : {});
  const cloneTargetGroup =
    source.cloneRenderModel?.targetGroup && typeof source.cloneRenderModel.targetGroup === "object"
      ? source.cloneRenderModel.targetGroup
      : {};
  const sectionPackets = Array.isArray(authorInput?.designAuthorPacket?.sections)
    ? authorInput.designAuthorPacket.sections
    : [];
  const packetMap = new Map(
    sectionPackets
      .map((item) => [String(item?.slotId || "").trim(), item])
      .filter(([slotId]) => slotId)
  );

  return normalizeAuthoredSectionHtmlPackage({
    ...authoredSectionHtmlPackage,
    targetGroup: {
      ...(cloneTargetGroup && typeof cloneTargetGroup === "object" ? cloneTargetGroup : {}),
      ...(sourceTargetGroup && typeof sourceTargetGroup === "object" ? sourceTargetGroup : {}),
      ...(authoredSectionHtmlPackage.targetGroup && typeof authoredSectionHtmlPackage.targetGroup === "object"
        ? authoredSectionHtmlPackage.targetGroup
        : {}),
      replacementMode: String(
        authoredSectionHtmlPackage.targetGroup?.replacementMode ||
        sourceTargetGroup?.replacementMode ||
        cloneTargetGroup?.replacementMode ||
        ""
      ).trim(),
    },
    sections: (authoredSectionHtmlPackage.sections || []).map((section) => {
      const slotId = String(section?.slotId || "").trim();
      const packet = packetMap.get(slotId) || {};
      return {
        ...section,
        availableAssetFamilies: Array.isArray(section?.availableAssetFamilies) && section.availableAssetFamilies.length
          ? section.availableAssetFamilies
          : (Array.isArray(packet?.availableAssetFamilies) ? packet.availableAssetFamilies.slice(0, 8) : []),
        assetFallbackPolicy:
          section?.assetFallbackPolicy && typeof section.assetFallbackPolicy === "object"
            ? section.assetFallbackPolicy
            : (packet?.assetFallbackPolicy && typeof packet.assetFallbackPolicy === "object" ? { ...packet.assetFallbackPolicy } : null),
      };
    }),
  });
}

module.exports = {
  buildLocalAuthoredSectionHtmlPackage,
  buildLocalAuthoredSectionMarkdownDocument,
  normalizeAuthoredSectionHtmlPackage,
  enrichAuthoredSectionHtmlPackageWithAuthorInput,
};
