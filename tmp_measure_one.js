const { chromium } = require('playwright');
const url = process.argv[2];
(async () => {
  const started = Date.now();
  const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1460, height: 2200 } });
  await page.route('**/*', (route) => {
    const t = route.request().resourceType();
    if (t === 'image' || t === 'media' || t === 'font') return route.abort();
    route.continue();
  });
  console.log('goto', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  console.log('loaded in', Date.now() - started);
  await page.waitForTimeout(1200);
  const data = await page.evaluate(() => {
    const pickRect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    };
    const slot = document.querySelector('[data-codex-slot="timedeal"]') || document.querySelector('section[class*="HomeMoTimedeal_timedeal__"]');
    if (!slot) return { missing: true };
    const slides = Array.from(slot.querySelectorAll('.swiper-slide')).slice(0, 2);
    return {
      slot: pickRect(slot),
      slides: slides.map((slide, index) => ({
        index: index + 1,
        slide: pickRect(slide),
        card: pickRect(slide.querySelector('.HomeMoTimedeal_timedeal_item__rwiPz') || slide),
        imageWrap: pickRect(slide.querySelector('.HomeMoTimedeal_image__M6OoV')),
        image: pickRect(slide.querySelector('.product-card-image_image img')),
        bottom: pickRect(slide.querySelector('.HomeMoTimedeal_item_bottom__YMRu9')),
      }))
    };
  });
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
})();
