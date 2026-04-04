#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');

/**
 * Test the Agency Search Modal directly
 * Launches a headless Chrome and tests the modal interaction
 */

async function testModal() {
  console.log('[Modal Test] Starting browser automation test...\n');

  let browser;
  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: false,  // Show the browser window
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });

    console.log('[Modal Test] ✓ Browser launched\n');

    // Create a new page
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Set up console message logging
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`[Console Error] ${msg.text()}`);
      }
    });

    page.on('error', (err) => {
      console.error('[Page Error]', err);
    });

    // Navigate to the site
    console.log('[Modal Test] Navigating to https://web-production-00a4a4.up.railway.app\n');
    try {
      await page.goto('https://web-production-00a4a4.up.railway.app', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      console.log('[Modal Test] ✓ Page loaded\n');
    } catch (navErr) {
      console.log('[Modal Test] ⚠️  Navigation error (might be timeout, continuing anyway):', navErr.message);
      await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));
    }

    // Wait a bit for JS to execute
    await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));

    // Check if the button exists
    console.log('[Modal Test] Checking for "+ Find Agency" button...\n');
    const buttonSelector = 'button[onclick*="showAgencySearchModal"]';
    const buttonExists = await page.$(buttonSelector);
    
    if (!buttonExists) {
      console.log('[Modal Test] ❌ Button not found. Checking page content...\n');
      
      // Take screenshot anyway
      await page.screenshot({ path: 'modal-test-button-missing.png', fullPage: true });
      console.log('[Modal Test] Screenshot: modal-test-button-missing.png\n');
      
      // Get the page HTML to see what's there
      const html = await page.content();
      if (html.includes('Find Agency')) {
        console.log('[Modal Test] "Find Agency" text IS in the HTML, checking structure...\n');
      } else {
        console.log('[Modal Test] "Find Agency" text NOT found in HTML\n');
      }
      
      browser.close();
      return;
    }

    console.log('[Modal Test] ✓ Button found!\n');

    // Get button details
    const buttonInfo = await page.evaluate(() => {
      const btn = document.querySelector('button[onclick*="showAgencySearchModal"]');
      return {
        text: btn.textContent,
        visible: btn.offsetParent !== null,
        onclick: btn.getAttribute('onclick')
      };
    });

    console.log('[Modal Test] Button details:');
    console.log(`  Text: "${buttonInfo.text}"`);
    console.log(`  Visible: ${buttonInfo.visible}`);
    console.log(`  onclick: "${buttonInfo.onclick}"\n`);

    // Check if modal exists
    console.log('[Modal Test] Checking for modal element...\n');
    const modalExists = await page.$('#agency-search-modal');
    
    if (!modalExists) {
      console.log('[Modal Test] ❌ Modal element not found\n');
      browser.close();
      return;
    }

    console.log('[Modal Test] ✓ Modal element found\n');

    // Get initial state
    const initialState = await page.evaluate(() => {
      const modal = document.getElementById('agency-search-modal');
      const styles = window.getComputedStyle(modal);
      return {
        display: styles.display,
        visibility: styles.visibility,
        opacity: styles.opacity,
        zIndex: styles.zIndex,
        hasActiveClass: modal.classList.contains('active'),
        parentDisplay: modal.parentElement ? window.getComputedStyle(modal.parentElement).display : 'N/A'
      };
    });

    console.log('[Modal Test] Initial modal state:');
    console.log(`  display: ${initialState.display}`);
    console.log(`  visibility: ${initialState.visibility}`);
    console.log(`  opacity: ${initialState.opacity}`);
    console.log(`  z-index: ${initialState.zIndex}`);
    console.log(`  has .active class: ${initialState.hasActiveClass}`);
    console.log(`  parent display: ${initialState.parentDisplay}\n`);

    // Take screenshot before click
    console.log('[Modal Test] Taking screenshot before click...\n');
    await page.screenshot({ path: 'modal-test-before-click.png', fullPage: true });

    // Click the button
    console.log('[Modal Test] Clicking "+ Find Agency" button...\n');
    try {
      await page.click(buttonSelector);
      console.log('[Modal Test] ✓ Click executed\n');
    } catch (clickErr) {
      console.error('[Modal Test] ❌ Click failed:', clickErr.message);
    }

    // Wait for any animations
    await page.evaluate(() => new Promise(r => setTimeout(r, 800)));

    // Get state after click
    const afterClickState = await page.evaluate(() => {
      const modal = document.getElementById('agency-search-modal');
      const styles = window.getComputedStyle(modal);
      const backdrop = modal.querySelector('.modal-backdrop');
      
      return {
        display: styles.display,
        visibility: styles.visibility,
        opacity: styles.opacity,
        zIndex: styles.zIndex,
        hasActiveClass: modal.classList.contains('active'),
        backdropExists: !!backdrop,
        contentExists: !!modal.querySelector('.modal-content'),
        headerExists: !!modal.querySelector('.modal-header'),
        hasVisibleContent: modal.querySelector('.modal-content') && 
                          window.getComputedStyle(modal.querySelector('.modal-content')).display !== 'none'
      };
    });

    console.log('[Modal Test] Modal state AFTER click:');
    console.log(`  display: ${afterClickState.display}`);
    console.log(`  visibility: ${afterClickState.visibility}`);
    console.log(`  opacity: ${afterClickState.opacity}`);
    console.log(`  z-index: ${afterClickState.zIndex}`);
    console.log(`  has .active class: ${afterClickState.hasActiveClass}`);
    console.log(`  backdrop exists: ${afterClickState.backdropExists}`);
    console.log(`  content exists: ${afterClickState.contentExists}`);
    console.log(`  header exists: ${afterClickState.headerExists}\n`);

    // Check if visible
    const isVisible = afterClickState.display === 'flex' && 
                     afterClickState.visibility === 'visible' && 
                     afterClickState.opacity !== '0';
    
    if (isVisible) {
      console.log('[Modal Test] ✅ MODAL IS VISIBLE - SUCCESS!\n');
      console.log('[Modal Test] The modal opened successfully. Testing interaction...\n');
      
      // Try to type in the URL field
      try {
        await page.type('#agency-url-input', 'https://example-agency.com');
        console.log('[Modal Test] ✓ Successfully typed in URL input\n');
      } catch (e) {
        console.log('[Modal Test] ⚠️  Could not type in input:', e.message);
      }
      
    } else {
      console.log('[Modal Test] ❌ Modal is NOT visible');
      if (afterClickState.display !== 'flex') {
        console.log(`  Issue: display is "${afterClickState.display}", expected "flex"`);
      }
      if (afterClickState.visibility !== 'visible') {
        console.log(`  Issue: visibility is "${afterClickState.visibility}", expected "visible"`);
      }
      if (afterClickState.opacity === '0') {
        console.log(`  Issue: opacity is 0 (transparent)`);
      }
      console.log('');
    }

    // Take screenshot after click
    console.log('[Modal Test] Taking screenshot after click...\n');
    await page.screenshot({ path: 'modal-test-after-click.png', fullPage: true });

    // Check function exists
    console.log('[Modal Test] Verifying showAgencySearchModal() function...\n');
    const funcStatus = await page.evaluate(() => {
      return {
        exists: typeof window.showAgencySearchModal === 'function',
        code: window.showAgencySearchModal ? window.showAgencySearchModal.toString().substring(0, 100) : 'not found'
      };
    });

    console.log(`[Modal Test] Function exists: ${funcStatus.exists}`);
    console.log(`[Modal Test] Function code preview: ${funcStatus.code}...\n`);

    // Generate report
    console.log('\n========== TEST REPORT ==========\n');
    console.log('FINDINGS:');
    if (buttonExists && modalExists && isVisible) {
      console.log('✅ Button found');
      console.log('✅ Modal found');
      console.log('✅ Modal becomes visible on click');
      console.log('\n🎉 MODAL IS WORKING CORRECTLY!\n');
    } else {
      console.log(`❌ Button found: ${!!buttonExists}`);
      console.log(`❌ Modal found: ${!!modalExists}`);
      console.log(`❌ Modal visible: ${isVisible}`);
      console.log('\n📋 See screenshots for debugging:\n');
      if (!buttonExists) console.log('  - modal-test-button-missing.png');
      if (buttonExists && !isVisible) {
        console.log('  - modal-test-before-click.png');
        console.log('  - modal-test-after-click.png');
      }
      console.log('\n');
    }

    console.log('========== END REPORT ==========\n');

    // Keep browser open for 10 seconds to see the result
    console.log('[Modal Test] Browser will close in 10 seconds...\n');
    await page.evaluate(() => new Promise(r => setTimeout(r, 10000)));

  } catch (error) {
    console.error('[Modal Test] ❌ Fatal error:', error.message);
    console.error(error);
  } finally {
    if (browser) {
      await browser.close();
      console.log('[Modal Test] Browser closed\n');
    }
  }
}

// Run the test
testModal();
