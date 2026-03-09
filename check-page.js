const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8082/decks/run-1772854293979.html');
  await page.waitForTimeout(2000); // wait for JS

  const slideHTML = await page.evaluate(() => {
    const slide = document.querySelector('.slide');
    if (!slide) return { error: 'No slide found' };
    
    // Check computed styles
    const anims = slide.querySelectorAll('.anim');
    const results = Array.from(anims).map(a => {
      const computed = window.getComputedStyle(a);
      return {
        className: a.className,
        opacity: computed.opacity,
        display: computed.display,
        visibility: computed.visibility,
        transform: computed.transform
      };
    });
    
    const slideComputed = window.getComputedStyle(slide);
    return {
      slideHeight: slide.clientHeight,
      slideOpacity: slideComputed.opacity,
      slideDisplay: slideComputed.display,
      anims: results
    };
  });
  console.log(JSON.stringify(slideHTML, null, 2));
  await browser.close();
})();
