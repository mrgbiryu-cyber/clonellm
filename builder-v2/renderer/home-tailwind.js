"use strict";

const recipeLibrary = require("../../data/normalized/home-recipe-library.json");

function esc(value, escapeHtml) {
  return typeof escapeHtml === "function" ? escapeHtml(value) : String(value || "");
}

function normalizeTone(value) {
  return String(value || "").trim().toLowerCase();
}

function hasTopStageCompanionRole(primitiveProps = {}, styleContract = {}) {
  const tokenHints = styleContract?.tokenHints && typeof styleContract.tokenHints === "object" ? styleContract.tokenHints : {};
  return [
    primitiveProps?.clusterRole,
    tokenHints?.clusterRole,
    primitiveProps?.heroBridge,
    tokenHints?.heroBridge,
  ].some((item) => /companion|top-stage|journey/i.test(String(item || "").trim()));
}

function resolveRecipe(kind, { recipeId = "", primitiveId = "", variant = "", tone = "" } = {}) {
  const collection = kind === "quickmenu"
    ? Array.isArray(recipeLibrary?.quickmenuRecipes) ? recipeLibrary.quickmenuRecipes : []
    : Array.isArray(recipeLibrary?.heroRecipes) ? recipeLibrary.heroRecipes : [];
  const normalizedRecipeId = String(recipeId || "").trim();
  if (normalizedRecipeId) {
    const exact = collection.find((item) => String(item?.recipeId || "").trim() === normalizedRecipeId);
    if (exact) return exact;
  }
  const normalizedPrimitiveId = String(primitiveId || "").trim();
  const normalizedVariant = String(variant || "").trim();
  const normalizedTone = normalizeTone(tone);
  return (
    collection.find((item) =>
      String(item?.primitiveId || "").trim() === normalizedPrimitiveId &&
      String(item?.variant || "").trim() === normalizedVariant &&
      normalizeTone(item?.tone) === normalizedTone
    ) ||
    collection.find((item) =>
      String(item?.primitiveId || "").trim() === normalizedPrimitiveId &&
      String(item?.variant || "").trim() === normalizedVariant
    ) ||
    collection[0] ||
    null
  );
}

function buildTailwindHomeStyleTag() {
  return `<style data-codex-v2-home-tailwind>
    .codex-v2-home-surface--tailwind {
      position: relative;
      overflow: hidden;
      border-radius: 32px;
      border: 1px solid rgba(148,163,184,0.18);
      box-shadow: 0 34px 80px rgba(15,23,42,0.16);
      isolation: isolate;
      background: linear-gradient(140deg, #f8fafc 0%, #e8eff8 48%, #d8e3f2 100%);
    }
    .codex-v2-home-surface--tailwind[data-tone="cinematic"],
    .codex-v2-home-surface--tailwind[data-tone="premium"] {
      background: linear-gradient(145deg, #020617 0%, #0f172a 40%, #172554 100%);
      color: #f8fafc;
    }
    .codex-v2-home-surface--tailwind[data-tone="editorial"] {
      background: linear-gradient(145deg, #f8f1e6 0%, #f4eadb 42%, #ead9bf 100%);
    }
    .codex-v2-home-surface--tailwind::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        radial-gradient(circle at top right, rgba(59,130,246,0.18), transparent 26%),
        linear-gradient(180deg, rgba(255,255,255,0.12), transparent 32%);
      z-index: 0;
    }
    .twx-stage {
      position: relative;
      z-index: 1;
      display: grid;
      gap: 18px;
      padding: 28px;
    }
    .twx-stage--companion {
      gap: 12px;
      padding: 18px 20px 20px;
    }
    .twx-badge {
      display: inline-flex;
      width: fit-content;
      align-items: center;
      padding: 8px 14px;
      border-radius: 999px;
      background: rgba(255,255,255,0.16);
      border: 1px solid rgba(255,255,255,0.22);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font: 700 0.75rem/1 "Pretendard Variable", "Inter", sans-serif;
    }
    .twx-title {
      margin: 0;
      font: 820 clamp(2.8rem, 5vw, 4.9rem)/0.97 "Pretendard Variable", "Inter", sans-serif;
      letter-spacing: -0.05em;
      text-wrap: balance;
      color: inherit;
    }
    .twx-title--companion {
      font: 760 clamp(1.3rem, 2.2vw, 1.85rem)/1.08 "Pretendard Variable", "Inter", sans-serif;
      letter-spacing: -0.03em;
      max-width: 28ch;
    }
    .twx-body {
      margin: 0;
      max-width: 62ch;
      font: 500 clamp(1rem, 1.4vw, 1.15rem)/1.6 "Pretendard Variable", "Inter", sans-serif;
      color: rgba(15,23,42,0.72);
    }
    .twx-body--companion {
      max-width: 56ch;
      font-size: 0.96rem;
      line-height: 1.45;
    }
    .twx-copy--companion {
      display: grid;
      gap: 6px;
      align-content: start;
    }
    .twx-bridge {
      display: inline-flex;
      width: fit-content;
      align-items: center;
      gap: 8px;
      border-radius: 999px;
      padding: 6px 12px;
      background: rgba(15,23,42,0.08);
      color: rgba(15,23,42,0.78);
      font: 700 0.72rem/1 "Pretendard Variable", "Inter", sans-serif;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .codex-v2-home-surface--tailwind[data-tone="cinematic"] .twx-bridge,
    .codex-v2-home-surface--tailwind[data-tone="premium"] .twx-bridge {
      background: rgba(255,255,255,0.12);
      color: rgba(248,250,252,0.86);
    }
    .codex-v2-home-surface--tailwind[data-tone="cinematic"] .twx-body,
    .codex-v2-home-surface--tailwind[data-tone="premium"] .twx-body {
      color: rgba(226,232,240,0.84);
    }
    .twx-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .twx-btn,
    .twx-btn-subtle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 50px;
      padding: 0 18px;
      border-radius: 999px;
      text-decoration: none;
      font: 700 0.95rem/1 "Pretendard Variable", "Inter", sans-serif;
      transition: transform 180ms ease, box-shadow 180ms ease;
    }
    .twx-btn {
      background: #111827;
      color: #fff;
      box-shadow: 0 16px 30px rgba(15,23,42,0.14);
    }
    .codex-v2-home-surface--tailwind[data-tone="cinematic"] .twx-btn,
    .codex-v2-home-surface--tailwind[data-tone="premium"] .twx-btn {
      background: #f8fafc;
      color: #0f172a;
    }
    .twx-btn-subtle {
      background: rgba(255,255,255,0.16);
      border: 1px solid rgba(255,255,255,0.24);
      color: inherit;
      backdrop-filter: blur(14px);
    }
    .twx-btn:hover,
    .twx-btn-subtle:hover {
      transform: translateY(-2px);
    }
    .twx-hero-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.45fr) minmax(300px, 0.92fr);
      gap: 18px;
      align-items: stretch;
    }
    .twx-hero-grid[data-variant="centered"],
    .twx-hero-grid[data-variant="stacked"] {
      grid-template-columns: 1fr;
    }
    .twx-hero-grid[data-variant="centered"] .twx-copy {
      text-align: center;
      justify-items: center;
      max-width: 920px;
      margin-inline: auto;
    }
    .twx-lead {
      position: relative;
      overflow: hidden;
      min-height: clamp(360px, 44vw, 560px);
      border-radius: 28px;
      border: 1px solid rgba(255,255,255,0.16);
      background: rgba(15,23,42,0.12);
    }
    .twx-lead img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .twx-lead::after {
      content: "";
      position: absolute;
      inset: auto 0 0;
      height: 58%;
      background: linear-gradient(180deg, transparent, rgba(2,6,23,0.78));
    }
    .twx-lead-copy {
      position: absolute;
      inset: auto 0 0;
      z-index: 1;
      display: grid;
      gap: 8px;
      padding: 22px;
      color: #fff;
    }
    .twx-side-rail,
    .twx-stack-rail,
    .twx-menu-grid {
      display: grid;
      gap: 14px;
    }
    .twx-side-card,
    .twx-stack-card,
    .twx-menu-card,
    .twx-menu-lead {
      position: relative;
      overflow: hidden;
      display: grid;
      gap: 12px;
      padding: 18px;
      border-radius: 22px;
      background: rgba(255,255,255,0.26);
      border: 1px solid rgba(255,255,255,0.24);
      color: inherit;
      text-decoration: none;
      backdrop-filter: blur(16px);
    }
    .codex-v2-home-surface--tailwind[data-tone="cinematic"] .twx-side-card,
    .codex-v2-home-surface--tailwind[data-tone="cinematic"] .twx-stack-card,
    .codex-v2-home-surface--tailwind[data-tone="cinematic"] .twx-menu-card,
    .codex-v2-home-surface--tailwind[data-tone="cinematic"] .twx-menu-lead,
    .codex-v2-home-surface--tailwind[data-tone="premium"] .twx-side-card,
    .codex-v2-home-surface--tailwind[data-tone="premium"] .twx-stack-card,
    .codex-v2-home-surface--tailwind[data-tone="premium"] .twx-menu-card,
    .codex-v2-home-surface--tailwind[data-tone="premium"] .twx-menu-lead {
      background: rgba(15,23,42,0.42);
      border-color: rgba(255,255,255,0.12);
    }
    .twx-menu-grid {
      grid-template-columns: minmax(0, 1.3fr) repeat(3, minmax(0, 1fr));
      align-items: stretch;
    }
    .twx-menu-grid--companion {
      grid-template-columns: minmax(240px, 0.95fr) repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    .twx-menu-grid[data-variant="grid"] {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .twx-menu-grid[data-variant="editorial-strip"] {
      grid-template-columns: minmax(0, 1.45fr) repeat(2, minmax(0, 1fr));
    }
    .twx-menu-lead {
      min-height: 100%;
      align-content: space-between;
    }
    .twx-menu-lead--companion {
      min-height: auto;
      gap: 10px;
      padding: 16px 18px;
      background: rgba(255,255,255,0.42);
    }
    .twx-menu-card--companion {
      gap: 10px;
      padding: 14px 14px 16px;
      align-content: start;
    }
    .twx-menu-card--companion strong {
      font-size: 0.98rem;
      line-height: 1.28;
    }
    .twx-menu-card--companion .twx-menu-kicker {
      opacity: 0.56;
    }
    .twx-menu-icon,
    .twx-menu-fallback {
      width: 44px;
      height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 14px;
      background: rgba(255,255,255,0.72);
      border: 1px solid rgba(148,163,184,0.16);
      overflow: hidden;
    }
    .twx-menu-icon img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .twx-menu-kicker,
    .twx-mini {
      font: 700 0.76rem/1 "Pretendard Variable", "Inter", sans-serif;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      opacity: 0.72;
    }
    @media (max-width: 980px) {
      .twx-hero-grid,
      .twx-menu-grid,
      .twx-menu-grid--companion,
      .twx-menu-grid[data-variant="editorial-strip"] {
        grid-template-columns: 1fr;
      }
    }
  </style>`;
}

function renderHeroFallback(recipe, escapeHtml, label) {
  return `<span class="twx-menu-fallback"><strong>${esc(label || recipe?.fallbackWord || "Stage", escapeHtml)}</strong></span>`;
}

function renderHomeTailwindHeroSection({
  attrs,
  sectionStyle,
  titleStyle,
  subtitleStyle,
  badge,
  headline,
  description,
  ctaLabel,
  ctaHref,
  firstSlide,
  supportSlides,
  heroVariant,
  escapeHtml,
  resolveHeroImageSrc,
  primitiveId,
  recipeId,
  primitiveTone,
  primitiveProps,
  styleContract,
}) {
  const recipe = resolveRecipe("hero", {
    recipeId,
    primitiveId,
    variant: heroVariant,
    tone: primitiveTone,
  });
  const tone = normalizeTone(primitiveTone || recipe?.tone || "neutral");
  const leadImage = resolveHeroImageSrc(firstSlide, 0);
  return `
    <section ${attrs}${sectionStyle ? ` style="${esc(sectionStyle, escapeHtml)}"` : ""}>
      ${buildTailwindHomeStyleTag()}
      <div class="codex-v2-home-surface codex-v2-home-surface--tailwind codex-v2-home-hero" data-tone="${esc(tone, escapeHtml)}" data-recipe="${esc(recipe?.recipeId || "", escapeHtml)}">
        <div class="twx-stage">
          <div class="twx-copy">
            ${badge ? `<span class="twx-badge">${esc(badge, escapeHtml)}</span>` : ""}
            <h2 class="twx-title"${titleStyle ? ` style="${esc(titleStyle, escapeHtml)}"` : ""}>${esc(headline, escapeHtml)}</h2>
            ${description ? `<p class="twx-body"${subtitleStyle ? ` style="${esc(subtitleStyle, escapeHtml)}"` : ""}>${esc(description, escapeHtml)}</p>` : ""}
            <div class="twx-actions">
              <a class="twx-btn" href="${esc(ctaHref, escapeHtml)}">${esc(ctaLabel, escapeHtml)}</a>
              <a class="twx-btn-subtle" href="${esc(ctaHref, escapeHtml)}">더 알아보기</a>
            </div>
          </div>
          <div class="twx-hero-grid" data-variant="${esc(heroVariant, escapeHtml)}">
            <article class="twx-lead">
              ${leadImage ? `<img src="${esc(leadImage, escapeHtml)}" alt="${esc(String(firstSlide?.headline || headline || "").trim(), escapeHtml)}" />` : renderHeroFallback(recipe, escapeHtml, headline)}
              <div class="twx-lead-copy">
                <span class="twx-mini">${esc(String(firstSlide?.badge || badge || recipe?.layoutPattern || "lead").trim(), escapeHtml)}</span>
                <strong>${esc(String(firstSlide?.headline || headline || "").trim(), escapeHtml)}</strong>
                ${firstSlide?.description ? `<span>${esc(String(firstSlide.description || "").trim(), escapeHtml)}</span>` : ""}
              </div>
            </article>
            <div class="${heroVariant === "stacked" ? "twx-stack-rail" : "twx-side-rail"}">
              ${supportSlides.map((slide, index) => {
                const image = resolveHeroImageSrc(slide, index + 1);
                return `
                  <a class="${heroVariant === "stacked" ? "twx-stack-card" : "twx-side-card"}" href="${esc(String(slide?.href || ctaHref).trim() || ctaHref, escapeHtml)}">
                    <span class="twx-mini">${esc(String(slide?.badge || recipe?.fallbackWord || "support").trim(), escapeHtml)}</span>
                    <strong>${esc(String(slide?.headline || `지원 카드 ${index + 1}`).trim(), escapeHtml)}</strong>
                    ${image ? `<img src="${esc(image, escapeHtml)}" alt="${esc(String(slide?.headline || "").trim(), escapeHtml)}" />` : ""}
                  </a>
                `;
              }).join("")}
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderHomeTailwindQuickmenuSection({
  attrs,
  sectionStyle,
  titleStyle,
  subtitleStyle,
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  items,
  quickmenuVariant,
  escapeHtml,
  resolveQuickmenuIconSrc,
  primitiveId,
  recipeId,
  primitiveTone,
  primitiveProps,
  styleContract,
}) {
  const recipe = resolveRecipe("quickmenu", {
    recipeId,
    primitiveId,
    variant: quickmenuVariant,
    tone: primitiveTone,
  });
  const tone = normalizeTone(primitiveTone || recipe?.tone || "neutral");
  const companionBand = hasTopStageCompanionRole(primitiveProps, styleContract);
  const leadItem = items[0] || null;
  const secondaryItemsRaw =
    quickmenuVariant === "grid" ? items : (leadItem ? items.slice(1, 8) : items);
  const secondaryItems = companionBand ? secondaryItemsRaw.slice(0, 3) : secondaryItemsRaw;
  const densityTarget = String(primitiveProps?.densityTarget || styleContract?.tokenHints?.densityTarget || "").trim();
  const groupingMode = String(primitiveProps?.groupingMode || styleContract?.tokenHints?.groupingMode || "").trim();
  return `
    <section ${attrs}${sectionStyle ? ` style="${esc(sectionStyle, escapeHtml)}"` : ""}>
      ${buildTailwindHomeStyleTag()}
      <div class="codex-v2-home-surface codex-v2-home-surface--tailwind codex-v2-home-quickmenu" data-tone="${esc(tone, escapeHtml)}" data-recipe="${esc(recipe?.recipeId || "", escapeHtml)}">
        <div class="twx-stage ${companionBand ? "twx-stage--companion" : ""}">
          <div class="twx-copy ${companionBand ? "twx-copy--companion" : ""}">
            <h2 class="twx-title ${companionBand ? "twx-title--companion" : ""}"${titleStyle ? ` style="${esc(titleStyle, escapeHtml)}"` : ""}>${esc(title, escapeHtml)}</h2>
            ${subtitle ? `<p class="twx-body ${companionBand ? "twx-body--companion" : ""}"${subtitleStyle ? ` style="${esc(subtitleStyle, escapeHtml)}"` : ""}>${esc(subtitle, escapeHtml)}</p>` : ""}
          </div>
          <div class="twx-menu-grid ${companionBand ? "twx-menu-grid--companion" : ""}" data-variant="${esc(quickmenuVariant, escapeHtml)}" data-density="${esc(densityTarget || "", escapeHtml)}">
            ${leadItem && quickmenuVariant !== "grid" ? `
              <a class="twx-menu-lead ${companionBand ? "twx-menu-lead--companion" : ""}" href="${esc(String(leadItem?.href || ctaHref).trim() || ctaHref, escapeHtml)}">
                ${companionBand ? "" : `<span class="twx-menu-kicker">${esc(recipe?.layoutPattern || "lead", escapeHtml)}</span>`}
                <strong>${esc(String(leadItem?.title || "").trim(), escapeHtml)}</strong>
                <span>${esc(String(leadItem?.description || subtitle || recipe?.summary || "").trim(), escapeHtml)}</span>
                <span class="twx-menu-icon">
                  ${resolveQuickmenuIconSrc(leadItem, 0)
                    ? `<img src="${esc(resolveQuickmenuIconSrc(leadItem, 0), escapeHtml)}" alt="${esc(String(leadItem?.alt || leadItem?.title || "").trim(), escapeHtml)}" />`
                    : renderHeroFallback(recipe, escapeHtml, "01")}
                </span>
              </a>
            ` : ""}
            ${secondaryItems.map((item, index) => {
              const iconIndex = quickmenuVariant === "grid" ? index : index + 1;
              const icon = resolveQuickmenuIconSrc(item, iconIndex);
              return `
                <a class="twx-menu-card ${companionBand ? "twx-menu-card--companion" : ""}" href="${esc(String(item?.href || ctaHref).trim() || ctaHref, escapeHtml)}">
                  <span class="twx-menu-icon">
                    ${icon
                      ? `<img src="${esc(icon, escapeHtml)}" alt="${esc(String(item?.alt || item?.title || "").trim(), escapeHtml)}" />`
                      : renderHeroFallback(recipe, escapeHtml, String(iconIndex + 1).padStart(2, "0"))}
                  </span>
                  ${companionBand ? "" : `<span class="twx-menu-kicker">${esc(recipe?.fallbackWord || "entry", escapeHtml)}</span>`}
                  <strong>${esc(String(item?.title || `항목 ${index + 1}`).trim(), escapeHtml)}</strong>
                </a>
              `;
            }).join("")}
          </div>
          ${companionBand ? "" : `
            <div class="twx-actions">
              <a class="twx-btn-subtle" href="${esc(ctaHref, escapeHtml)}">${esc(ctaLabel, escapeHtml)}</a>
            </div>
          `}
        </div>
      </div>
    </section>
  `;
}

module.exports = {
  renderHomeTailwindHeroSection,
  renderHomeTailwindQuickmenuSection,
};
