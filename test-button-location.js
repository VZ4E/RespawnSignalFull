const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  await page.goto('https://web-production-00a4a4.up.railway.app', { waitUntil: 'networkidle2', timeout: 30000 });

  // Find all buttons with "Find Agency"
  const buttons = await page.evaluate(() => {
    const allButtons = Array.from(document.querySelectorAll('button'));
    return allButtons
      .filter(btn => btn.textContent.includes('Find Agency') || btn.onclick?.toString().includes('showAgencySearchModal'))
      .map((btn, i) => ({
        index: i,
        text: btn.textContent.trim(),
        onclick: btn.onclick?.toString().substring(0, 50),
        id: btn.id,
        className: btn.className,
        display: window.getComputedStyle(btn).display,
        visibility: window.getComputedStyle(btn).visibility,
        offsetParent: btn.offsetParent ? btn.offsetParent.tagName : 'null',
        boundingRect: btn.getBoundingClientRect(),
        parentId: btn.parentElement?.id,
        grandparentId: btn.parentElement?.parentElement?.id
      }));
  });

  console.log('[Button Check] Found matching buttons:');
  console.log(JSON.stringify(buttons, null, 2));

  // Also check the page structure
  const pageStructure = await page.evaluate(() => {
    return {
      bodyDisplay: window.getComputedStyle(document.body).display,
      viewLandingDisplay: window.getComputedStyle(document.getElementById('view-landing')).display,
      viewAuthDisplay: window.getComputedStyle(document.getElementById('view-auth')).display,
      viewAppDisplay: window.getComputedStyle(document.getElementById('view-app')).display,
      viewLandingActive: document.getElementById('view-landing').classList.contains('active'),
      viewAuthActive: document.getElementById('view-auth').classList.contains('active'),
      viewAppActive: document.getElementById('view-app').classList.contains('active')
    };
  });

  console.log('[Page Structure]:', pageStructure);

  await browser.close();
})().catch(err => {
  console.error('[Error]', err);
  process.exit(1);
});
