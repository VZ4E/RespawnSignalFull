#!/usr/bin/env python3
"""Fix HTML by moving modals outside view-app"""

# Read file
with open('public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the MODALS section start
modal_marker = '    <!-- MODALS -->'
modal_start = content.find(modal_marker)

if modal_start == -1:
    print("ERROR: Could not find modals marker")
    exit(1)

print(f"Found modals at position {modal_start}")

# Find where the modals section ends
search_from = modal_start + 100

# Pattern: closing divs before <script
pattern = "    </div>\n  </div>\n</div>\n\n<script"
pattern_idx = content.find(pattern, search_from)

if pattern_idx == -1:
    print("ERROR: Could not find closing pattern")
    exit(1)

print(f"Found closing pattern at {pattern_idx}")

# Extract modals section (from marker to just before the three closing divs)
modals_section = content[modal_start:pattern_idx]

print(f"Modals section is {len(modals_section)} bytes")

# Get everything before modals
before_modals = content[:modal_start]

# Get everything after the pattern (which is "\n\n<script...")
after_pattern = content[pattern_idx + len("    </div>\n  </div>\n</div>\n\n"):]

# Build new content with modals moved outside view-app
new_content = (
    before_modals +                      # Before modals (still inside view-app structure)
    "    </div>\n  </div>\n</div>" +    # Close view-app properly
    "\n\n" +                             # Spacing
    modals_section +                     # Modals now OUTSIDE view-app!
    "\n\n<script" +                      # Script tag
    after_pattern[7:]  # Skip the "<script" from after_pattern since we added it
)

# Write back
with open('public/index.html', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("\n[✅] Successfully restructured HTML!")
print("[✅] Modals moved outside view-app hierarchy")

# Verify
if new_content.count('<div id="view-app"') == 1 and new_content.count('</div>\n  </div>\n</div>') >= 1:
    print("[✓] Structure verified")
else:
    print("[⚠️] Warning: Structure may need verification")
