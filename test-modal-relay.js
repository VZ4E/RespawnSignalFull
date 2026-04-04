#!/usr/bin/env node

const puppeteer = require('puppeteer');

/**
 * Test the Agency Search Modal using OpenClaw Browser Relay
 * Connects to the local CDP server and tests modal interaction
 */

async function testModal() {
  console.log('[Modal Test] Connecting to OpenClaw Browser Relay...\n');

  let browser;
  try {
    // Connect to the local CDP relay server (OpenClaw Browser Relay)
    browser = await puppeteer.connect({
      browserWSEndpoint: 'http://localhost:9222'
    });

    console.log('[Modal Test] ✓ Connected to browser\n');

    // Get the first page (should be your open tab)
    const pages = await browser.pages();
    const page = pages[0];

    if (!page) {
      throw new Error('No pages found in browser');
    }

    const url = page.url();
    console.log(`[Modal Test] Current URL: ${url}\n`);

    // Navigate to the Railway app if not already there
    if (!url.includes('railway.app') && !url.includes('localhost')) {
      console.log('[Modal Test] Navigating to RespawnSignal...\n');
      await page.goto('https://web-production-00a4a4.up.railway.app', { waitUntil: 'networkidle2' });
    }

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Check for any console errors
    console.log('[Modal Test] Checking for console errors...\n');
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Get the page's current errors from execution
    const errors = await page.evaluate(() => {
      return window.__errors || [];
    });

    if (consoleErrors.length > 0) {
      console.log('[Modal Test] ⚠️  Console errors detected:');
      consoleErrors.forEach(e => console.log(`  - ${e}`));
      console.log('');
    }

    // Find the "+ Find Agency" button
    console.log('[Modal Test] Looking for "+ Find Agency" button...\n');
    const buttonExists = await page.$('button[onclick*="showAgencySearchModal"]');
    
    if (!buttonExists) {
      console.log('[Modal Test] ❌ Button not found in DOM\n');
      // Take screenshot to see what's on screen
      await page.screenshot({ path: 'modal-test-notfound.png' });
      console.log('[Modal Test] Screenshot saved: modal-test-notfound.png\n');
      return;
    }

    console.log('[Modal Test] ✓ Button found\n');

    // Get button text to verify
    const buttonText = await page.evaluate(() => {
      const btn = document.querySelector('button[onclick*="showAgencySearchModal"]');
      return btn ? btn.textContent : 'NOT FOUND';
    });

    console.log(`[Modal Test] Button text: "${buttonText}"\n`);

    // Check if modal element exists
    console.log('[Modal Test] Checking for modal element...\n');
    const modalExists = await page.$('#agency-search-modal');
    
    if (!modalExists) {
      console.log('[Modal Test] ❌ Modal element not found in DOM\n');
      return;
    }

    console.log('[Modal Test] ✓ Modal element found\n');

    // Get initial modal visibility state
    const initialState = await page.evaluate(() => {
      const modal = document.getElementById('agency-search-modal');
      if (!modal) return null;
      const styles = window.getComputedStyle(modal);
      return {
        display: styles.display,
        visibility: styles.visibility,
        opacity: styles.opacity,
        zIndex: styles.zIndex,
        hasActiveClass: modal.classList.contains('active')
      };
    });

    console.log('[Modal Test] Initial modal state:');
    console.log(`  display: ${initialState.display}`);
    console.log(`  visibility: ${initialState.visibility}`);
    console.log(`  opacity: ${initialState.opacity}`);
    console.log(`  z-index: ${initialState.zIndex}`);
    console.log(`  has .active class: ${initialState.hasActiveClass}\n`);

    // Click the button
    console.log('[Modal Test] Clicking "+ Find Agency" button...\n');
    await page.click('button[onclick*="showAgencySearchModal"]');
    await page.waitForTimeout(500);

    // Check modal state after click
    const afterClickState = await page.evaluate(() => {
      const modal = document.getElementById('agency-search-modal');
      if (!modal) return null;
      const styles = window.getComputedStyle(modal);
      return {
        display: styles.display,
        visibility: styles.visibility,
        opacity: styles.opacity,
        zIndex: styles.zIndex,
        hasActiveClass: modal.classList.contains('active'),
        html: modal.innerHTML ? modal.innerHTML.substring(0, 200) : 'empty'
      };
    });

    console.log('[Modal Test] Modal state AFTER click:');
    console.log(`  display: ${afterClickState.display}`);
    console.log(`  visibility: ${afterClickState.visibility}`);
    console.log(`  opacity: ${afterClickState.opacity}`);
    console.log(`  z-index: ${afterClickState.zIndex}`);
    console.log(`  has .active class: ${afterClickState.hasActiveClass}\n`);

    // Check if modal is visible
    const isVisible = afterClickState.display === 'flex' && afterClickState.visibility === 'visible';
    
    if (isVisible) {
      console.log('[Modal Test] ✅ MODAL IS VISIBLE - SUCCESS!\n');
    } else {
      console.log('[Modal Test] ❌ Modal is not visible (display or visibility issue)\n');
    }

    // Take a screenshot to show current state
    console.log('[Modal Test] Taking screenshot...\n');
    await page.screenshot({ path: 'modal-test-after-click.png' });
    console.log('[Modal Test] Screenshot saved: modal-test-after-click.png\n');

    // Try typing in the URL input if modal is visible
    if (isVisible) {
      console.log('[Modal Test] Testing modal interaction...\n');
      const inputExists = await page.$('#agency-url-input');
      if (inputExists) {
        await page.type('#agency-url-input', 'https://example-agency.com');
        console.log('[Modal Test] ✓ Successfully typed in URL input\n');
      }
    }

    // Check for any JavaScript errors in the modal function
    console.log('[Modal Test] Checking if showAgencySearchModal() function exists...\n');
    const funcExists = await page.evaluate(() => {
      return typeof window.showAgencySearchModal === 'function';
    });

    console.log(`[Modal Test] Function exists: ${funcExists}\n`);

    if (!funcExists) {
      console.log('[Modal Test] ❌ showAgencySearchModal function not defined\n');
    }

    console.log('[Modal Test] ✅ Test complete\n');

  } catch (error) {
    console.error('[Modal Test] ❌ Error:', error.message);
    console.error(error);
  }
}

// Run the test
testModal();
