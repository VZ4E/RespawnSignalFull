const puppeteer = require('puppeteer');

(async () => {
  console.log('[Test] Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Disable cache
  await page.setCacheEnabled(false);

  console.log('[Test] Navigating to live site...');
  await page.goto('https://web-production-00a4a4.up.railway.app', { waitUntil: 'networkidle2', timeout: 30000 });

  console.log('[Test] Checking modal HTML structure...');
  
  // Check if modal is INSIDE or OUTSIDE view-app
  const modalStructure = await page.evaluate(() => {
    const modal = document.getElementById('agency-search-modal');
    const viewApp = document.getElementById('view-app');
    
    if (!modal || !viewApp) {
      return { error: 'Modal or view-app not found' };
    }

    // Check if modal is a child of view-app
    const isChildOfViewApp = viewApp.contains(modal);
    
    // Check modal's actual parent
    let parent = modal.parentElement;
    let parentChain = [];
    for (let i = 0; i < 5 && parent; i++) {
      parentChain.push(`${parent.tagName}#${parent.id || 'no-id'}`);
      parent = parent.parentElement;
    }

    return {
      isChildOfViewApp,
      parentChain,
      modalDisplay: window.getComputedStyle(modal).display,
      modalVisibility: window.getComputedStyle(modal).visibility,
      modalOpacity: window.getComputedStyle(modal).opacity,
      hasActiveClass: modal.classList.contains('active'),
      viewAppDisplay: window.getComputedStyle(viewApp).display
    };
  });

  console.log('[Test] Modal structure:', JSON.stringify(modalStructure, null, 2));

  // Find the button
  const buttonExists = await page.$('button[onclick="showAgencySearchModal()"]');
  console.log('[Test] Button exists:', !!buttonExists);

  if (buttonExists) {
    console.log('[Test] Attempting to click button...');
    await buttonExists.click();
    await page.waitForTimeout(500);

    const modalStateAfter = await page.evaluate(() => {
      const modal = document.getElementById('agency-search-modal');
      return {
        display: window.getComputedStyle(modal).display,
        hasActiveClass: modal.classList.contains('active'),
        visibility: window.getComputedStyle(modal).visibility,
        opacity: window.getComputedStyle(modal).opacity,
        innerHTML: modal.innerHTML.substring(0, 150)
      };
    });

    console.log('[Test] After click:', JSON.stringify(modalStateAfter, null, 2));
  }

  await browser.close();
})().catch(err => {
  console.error('[Test Error]', err);
  process.exit(1);
});
