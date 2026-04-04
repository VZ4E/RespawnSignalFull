#!/usr/bin/env node

/**
 * Fix the modal hierarchy by moving all modals outside of view-app
 * to be direct children of body, so they're not affected by view-app's display:none
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'index.html');

console.log('[Modal Fix] Reading HTML file...');
let html = fs.readFileSync(filePath, 'utf8');

// Find the <!-- MODALS --> comment and extract all modals until the closing </div></div></div> before </script>
const modalsStartMarker = '    <!-- MODALS -->';
const modalsStartIndex = html.indexOf(modalsStartMarker);

if (modalsStartIndex === -1) {
  console.error('[Modal Fix] ❌ Could not find "<!-- MODALS -->" marker');
  process.exit(1);
}

console.log(`[Modal Fix] Found modals section at position ${modalsStartIndex}`);

// Find where the modals end
// Modals end when we hit the closing </div></div></div> before the <script> tags
const afterModalsStartIndex = modalsStartIndex + modalsStartMarker.length;

// Look for the pattern that closes view-app and view structure before scripts
// The pattern is: </div>\n  </div>\n</div>\n\n<script

let searchIndex = afterModalsStartIndex;
let modalsEndIndex = -1;

// Find "    </div>\n  </div>\n</div>\n\n<script" pattern
const closePattern = '    </div>\n  </div>\n</div>\n\n<script';
modalsEndIndex = html.indexOf(closePattern, afterModalsStartIndex);

if (modalsEndIndex === -1) {
  // Try with different whitespace patterns
  const patterns = [
    '</div>\n  </div>\n</div>\n\n<script',
    '</div>\n</div>\n</div>\n\n<script',
    '    </div>\\n  </div>\\n</div>\\n\\n<script'
  ];
  
  for (const pattern of patterns) {
    modalsEndIndex = html.indexOf(pattern, afterModalsStartIndex);
    if (modalsEndIndex !== -1) {
      console.log(`[Modal Fix] Found closing pattern with variant: "${pattern.substring(0, 20)}..."`);
      break;
    }
  }
  
  if (modalsEndIndex === -1) {
    console.error('[Modal Fix] ❌ Could not find modals end marker');
    console.log('[Modal Fix] Looking for closing divs before <script>...');
    
    // Fallback: find the line with </div></div></div> before <script
    const scriptIndex = html.indexOf('<script', afterModalsStartIndex);
    if (scriptIndex > 0) {
      // Search backwards from script for the closing pattern
      let searchBack = scriptIndex - 1;
      while (searchBack > afterModalsStartIndex && html[searchBack] !== '\n') {
        searchBack--;
      }
      // Go back to find the three closing divs
      const beforeScript = html.substring(afterModalsStartIndex, scriptIndex);
      const lastThreeDivsMatch = beforeScript.lastIndexOf('    </div>\n  </div>\n</div>');
      if (lastThreeDivsMatch !== -1) {
        modalsEndIndex = afterModalsStartIndex + lastThreeDivsMatch;
        console.log(`[Modal Fix] Found via fallback at ${modalsEndIndex}`);
      }
    }
    
    if (modalsEndIndex === -1) {
      console.error('[Modal Fix] ❌ Could not find modals end with any method');
      process.exit(1);
    }
  }
}

// Extract the modals section (INCLUDING the <!-- MODALS --> comment)
const modalsContent = html.substring(modalsStartIndex, modalsEndIndex);

console.log(`[Modal Fix] Extracted ${modalsContent.length} bytes of modal content`);
console.log(`[Modal Fix] First 100 chars: ${modalsContent.substring(0, 100)}...`);
console.log(`[Modal Fix] Last 100 chars: ...${modalsContent.substring(modalsContent.length - 100)}`);

// Remove the modals from their current location
const beforeModals = html.substring(0, modalsStartIndex);
const afterModals = html.substring(modalsEndIndex);

// Find where to insert the modals (after </div></div></div> that closes view structures, before <script)
// Look for the pattern: </div>\n</div>\n<script
const bodyClosePattern = '</div>\n</body>\n\n<script';
let insertPoint = html.indexOf(bodyClosePattern);

if (insertPoint === -1) {
  // Try: </div>\n<script
  const patterns = ['</div>\n\n<script', '</div>\n<script'];
  for (const p of patterns) {
    insertPoint = html.indexOf(p, modalsStartIndex + 100);
    if (insertPoint !== -1) {
      console.log(`[Modal Fix] Found insert point with pattern: "${p}"`);
      break;
    }
  }
}

if (insertPoint === -1) {
  console.error('[Modal Fix] ❌ Could not find insert point');
  process.exit(1);
}

// Position right before the </div></div></div> that closes the view structure
const insertBeforeScript = html.indexOf('<script', modalsStartIndex + 100);
insertPoint = html.lastIndexOf('\n', insertBeforeScript - 1);

if (insertPoint < modalsStartIndex) {
  console.error('[Modal Fix] ❌ Insert point is before modals, something is wrong');
  process.exit(1);
}

console.log(`[Modal Fix] Insert point at position ${insertPoint}`);

// Reconstruct HTML without modals in view-app, then add them back at body level
const beforeInsert = html.substring(0, insertPoint);
const afterInsert = html.substring(insertPoint);

// Remove duplicate modals from afterModals (since we removed them from the original position)
const finalHtml = beforeInsert + '\n\n' + modalsContent + '\n\n' + afterInsert;

// Write back
console.log(`[Modal Fix] Writing fixed HTML...`);
fs.writeFileSync(filePath, finalHtml, 'utf8');

console.log('[Modal Fix] ✅ Successfully moved modals outside view-app!');
console.log('[Modal Fix] Modals are now direct children of body and will be visible regardless of login state');
