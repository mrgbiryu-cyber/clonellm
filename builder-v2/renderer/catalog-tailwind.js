"use strict";

function esc(value, escapeHtml) {
  return typeof escapeHtml === "function" ? escapeHtml(value) : String(value || "");
}

function buildTailwindCatalogStyleTag() {
  return `<style data-codex-v2-catalog-tailwind>
    .codex-v2-catalog-surface {
      position: relative;
      overflow: hidden;
      border-radius: 24px;
      border: 1px solid rgba(148,163,184,0.18);
      background: linear-gradient(145deg, #f8fafc 0%, #eef4fb 54%, #e3ebf7 100%);
      box-shadow: 0 20px 48px rgba(15,23,42,0.10);
      isolation: isolate;
    }
    .codex-v2-catalog-surface::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        radial-gradient(circle at top right, rgba(59,130,246,0.12), transparent 22%),
        linear-gradient(180deg, rgba(255,255,255,0.22), transparent 30%);
      z-index: 0;
    }
    .ctx-stage {
      position: relative;
      z-index: 1;
      display: grid;
      gap: 16px;
      padding: 22px;
    }
    .ctx-head {
      display: grid;
      gap: 10px;
      max-width: 56rem;
    }
    .ctx-badge {
      display: inline-flex;
      width: fit-content;
      align-items: center;
      padding: 8px 14px;
      border-radius: 999px;
      background: rgba(15,23,42,0.08);
      color: rgba(15,23,42,0.74);
      font: 700 0.72rem/1 "Pretendard Variable","Inter",sans-serif;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .ctx-title {
      margin: 0;
      color: #0f172a;
      font: 800 clamp(1.35rem, 2.2vw, 2.2rem)/1.02 "Pretendard Variable","Inter",sans-serif;
      letter-spacing: -0.03em;
      text-wrap: balance;
    }
    .ctx-copy {
      margin: 0;
      color: rgba(15,23,42,0.70);
      font: 500 0.98rem/1.58 "Pretendard Variable","Inter",sans-serif;
      max-width: 60ch;
    }
    .ctx-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }
    .ctx-btn,
    .ctx-btn-subtle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 18px;
      border-radius: 999px;
      text-decoration: none;
      font: 700 0.9rem/1 "Pretendard Variable","Inter",sans-serif;
    }
    .ctx-btn { background:#111827; color:#fff; }
    .ctx-btn-subtle { background:rgba(255,255,255,0.42); border:1px solid rgba(148,163,184,0.22); color:#0f172a; }
    .ctx-banner {
      display:grid;
      grid-template-columns:minmax(0,1fr) minmax(240px,0.72fr);
      gap:16px;
      align-items:center;
    }
    .ctx-banner-visual,
    .ctx-summary-visual {
      position:relative;
      overflow:hidden;
      min-height:180px;
      border-radius:20px;
      background:rgba(15,23,42,0.08);
    }
    .ctx-banner-visual img,
    .ctx-summary-visual img {
      position:absolute;
      inset:0;
      width:100%;
      height:100%;
      object-fit:cover;
    }
    .ctx-summary {
      display:grid;
      grid-template-columns:minmax(260px,0.88fr) minmax(0,1fr);
      gap:18px;
      align-items:stretch;
    }
    .ctx-summary-specs {
      display:grid;
      gap:12px;
      grid-template-columns:repeat(2,minmax(0,1fr));
    }
    .ctx-chip {
      display:grid;
      gap:6px;
      padding:14px;
      border-radius:18px;
      background:rgba(255,255,255,0.42);
      border:1px solid rgba(148,163,184,0.18);
    }
    .ctx-chip em {
      color:rgba(15,23,42,0.52);
      font:700 0.74rem/1 "Pretendard Variable","Inter",sans-serif;
      letter-spacing:0.06em;
      text-transform:uppercase;
      font-style:normal;
    }
    .ctx-chip strong {
      color:#0f172a;
      font:760 0.98rem/1.22 "Pretendard Variable","Inter",sans-serif;
      letter-spacing:-0.02em;
    }
    .ctx-sticky {
      display:grid;
      gap:14px;
      grid-template-columns:minmax(0,1fr) auto;
      align-items:center;
    }
    .ctx-price {
      display:grid;
      gap:6px;
    }
    .ctx-price strong {
      color:#0f172a;
      font:800 clamp(1.35rem,2vw,1.9rem)/1 "Pretendard Variable","Inter",sans-serif;
      letter-spacing:-0.04em;
    }
    .ctx-price span {
      color:rgba(15,23,42,0.64);
      font:500 0.92rem/1.5 "Pretendard Variable","Inter",sans-serif;
    }
    @media (max-width: 900px) {
      .ctx-banner,
      .ctx-summary,
      .ctx-sticky {
        grid-template-columns:1fr;
      }
      .ctx-summary-specs {
        grid-template-columns:1fr;
      }
    }
  </style>`;
}

function renderShell({ attrs, sectionStyle = "", inner = "", escapeHtml }) {
  return `<section ${attrs}${sectionStyle ? ` style="${esc(sectionStyle, escapeHtml)}"` : ""}>${buildTailwindCatalogStyleTag()}${inner}</section>`;
}

function renderCategoryTailwindBannerSection({
  attrs,
  sectionStyle,
  titleStyle,
  subtitleStyle,
  title,
  subtitle,
  ctaLabel,
  href,
  imageSrc,
  imageAlt,
  escapeHtml,
}) {
  return renderShell({
    attrs,
    sectionStyle,
    escapeHtml,
    inner: `
      <div class="codex-v2-catalog-surface">
        <div class="ctx-stage">
          <a class="ctx-banner" href="${esc(href || "#", escapeHtml)}">
            <span class="ctx-head">
              <span class="ctx-badge">Category highlight</span>
              <strong class="ctx-title"${titleStyle ? ` style="${esc(titleStyle, escapeHtml)}"` : ""}>${esc(title, escapeHtml)}</strong>
              ${subtitle ? `<span class="ctx-copy"${subtitleStyle ? ` style="${esc(subtitleStyle, escapeHtml)}"` : ""}>${esc(subtitle, escapeHtml)}</span>` : ""}
              ${ctaLabel ? `<span class="ctx-btn-subtle">${esc(ctaLabel, escapeHtml)}</span>` : ""}
            </span>
            <span class="ctx-banner-visual">${imageSrc ? `<img src="${esc(imageSrc, escapeHtml)}" alt="${esc(imageAlt || title, escapeHtml)}" />` : ""}</span>
          </a>
        </div>
      </div>
    `,
  });
}

function renderPdpTailwindSummarySection({
  attrs,
  sectionStyle,
  titleStyle,
  subtitleStyle,
  title,
  subtitle,
  imageSrc,
  imageAlt,
  highlights = [],
  primaryCta,
  secondaryCta,
  escapeHtml,
}) {
  return renderShell({
    attrs,
    sectionStyle,
    escapeHtml,
    inner: `
      <div class="codex-v2-catalog-surface">
        <div class="ctx-stage">
          <div class="ctx-summary">
            <div class="ctx-head">
              <span class="ctx-badge">Product summary</span>
              <h2 class="ctx-title"${titleStyle ? ` style="${esc(titleStyle, escapeHtml)}"` : ""}>${esc(title, escapeHtml)}</h2>
              ${subtitle ? `<p class="ctx-copy"${subtitleStyle ? ` style="${esc(subtitleStyle, escapeHtml)}"` : ""}>${esc(subtitle, escapeHtml)}</p>` : ""}
              <div class="ctx-actions">
                ${primaryCta ? `<a class="ctx-btn" href="${esc(primaryCta.href || "#", escapeHtml)}">${esc(primaryCta.label || "구매하기", escapeHtml)}</a>` : ""}
                ${secondaryCta ? `<a class="ctx-btn-subtle" href="${esc(secondaryCta.href || "#", escapeHtml)}">${esc(secondaryCta.label || "혜택 확인", escapeHtml)}</a>` : ""}
              </div>
              ${highlights.length ? `
                <div class="ctx-summary-specs">
                  ${highlights.map((item) => `
                    <span class="ctx-chip">
                      <em>${esc(item.label || "Point", escapeHtml)}</em>
                      <strong>${esc(item.value || "", escapeHtml)}</strong>
                    </span>
                  `).join("")}
                </div>
              ` : ""}
            </div>
            <div class="ctx-summary-visual">${imageSrc ? `<img src="${esc(imageSrc, escapeHtml)}" alt="${esc(imageAlt || title, escapeHtml)}" />` : ""}</div>
          </div>
        </div>
      </div>
    `,
  });
}

function renderPdpTailwindStickySection({
  attrs,
  sectionStyle,
  titleStyle,
  subtitleStyle,
  title,
  subtitle,
  priceText,
  primaryCta,
  secondaryCta,
  escapeHtml,
}) {
  return renderShell({
    attrs,
    sectionStyle,
    escapeHtml,
    inner: `
      <div class="codex-v2-catalog-surface">
        <div class="ctx-stage">
          <div class="ctx-sticky">
            <div class="ctx-head">
              <strong class="ctx-title"${titleStyle ? ` style="${esc(titleStyle, escapeHtml)}"` : ""}>${esc(title, escapeHtml)}</strong>
              ${subtitle ? `<span class="ctx-copy"${subtitleStyle ? ` style="${esc(subtitleStyle, escapeHtml)}"` : ""}>${esc(subtitle, escapeHtml)}</span>` : ""}
            </div>
            <div class="ctx-actions">
              <div class="ctx-price">
                <strong>${esc(priceText || "가격 확인", escapeHtml)}</strong>
                <span>혜택과 구매 동선을 한 영역에 정리한 sticky buy box replacement</span>
              </div>
              ${secondaryCta ? `<a class="ctx-btn-subtle" href="${esc(secondaryCta.href || "#", escapeHtml)}">${esc(secondaryCta.label || "혜택", escapeHtml)}</a>` : ""}
              ${primaryCta ? `<a class="ctx-btn" href="${esc(primaryCta.href || "#", escapeHtml)}">${esc(primaryCta.label || "구매하기", escapeHtml)}</a>` : ""}
            </div>
          </div>
        </div>
      </div>
    `,
  });
}

module.exports = {
  renderCategoryTailwindBannerSection,
  renderPdpTailwindSummarySection,
  renderPdpTailwindStickySection,
};
