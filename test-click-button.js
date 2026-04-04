const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  
  console.log('[Test] Navigating...');
  await page.goto('https://web-production-00a4a4.up.railway.app', { waitUntil: 'networkidle2', timeout: 30000 });

  // Get all buttons
  const buttons = await page.$$('button');
  console.log(`[Test] Found ${buttons.length} buttons total`);

  // Find the first visible "+ Find Agency" button
  let targetButton = null;
  for (let i = 0; i < buttons.length; i++) {
    const text = await page.evaluate(btn => btn.textContent, buttons[i]);
    const offsetParent = await page.evaluate(btn => btn.offsetParent ? 'visible' : 'hidden', buttons[i]);
    
    if (text.includes('Find Agency') && offsetParent === 'visible') {
      console.log(`[Test] Found visible "+ Find Agency" button at index ${i}`);
      targetButton = buttons[i];
      break;
    }
  }

  if (!targetButton) {
    console.error('[Test] No visible "+ Find Agency" button found!');
    await browser.close();
    process.exit(1);
  }

  console.log('[Test] Clicking button...');
  await targetButton.click();
  await new Promise(resolve => setTimeout(resolve, 300));

  // Check if modal is now visible
  const modalState = await page.evaluate(() => {
    const modal = document.getElementById('agency-search-modal');
    return {
      display: window.getComputedStyle(modal).display,
      hasActiveClass: modal.classList.contains('active'),
      isVisible: window.getComputedStyle(modal).display === 'flex'
    };
  });

  console.log('[Test] Modal state after click:');
  console.log(JSON.stringify(modalState, null, 2));

  if (modalState.isVisible) {
    console.log('[SUCCESS] Modal is now visible!');
  } else {
    console.log('[FAIL] Modal is still not visible');
  }

  await browser.close();
})().catch(err => {
  console.error('[Error]', err);
  process.exit(1);
});
