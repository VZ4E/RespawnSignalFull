#!/usr/bin/env python3
"""
Fix the modal hierarchy by moving modals outside of view-app.

The problem: Modals are children of view-app, which has display:none when not logged in.
The solution: Move modals to be siblings of view-app (direct children of body).
"""

import re

# Read the file
with open('public/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Find the modals section (from <!-- MODALS --> to the closing </div> after agency-search-modal)
# Pattern: <!-- MODALS --> ... </div> (the one that closes agency-search-modal, before </div></div></div>)

# Find the start
modals_start_marker = '    <!-- MODALS -->'
modals_start_idx = html.find(modals_start_marker)

if modals_start_idx == -1:
    print("ERROR: Could not find <!-- MODALS --> marker")
    exit(1)

print(f"[✓] Found modals start at position {modals_start_idx}")

# Find the end - look for "    </div>\n  </div>\n</div>" which closes all the view structures
# This pattern comes after the last modal (agency-search-modal closes at "    </div>")

# Search for the closing pattern after modals
search_start = modals_start_idx + len(modals_start_marker)

# Look for the signature end pattern: closing the modals, then closing view-app, then closing body structure
# Pattern in the file:
#     </div>     <- closes agency-search-modal
#
#     </div>     <- closes add-platform-modal comment/start
#   </div>       <- closes view-app
# </div>         <- closes body

# Find "</div>" after "agency-search-modal"
last_modal_close = html.find('    </div>\n\n    </div>', search_start)

if last_modal_close == -1:
    # Try different whitespace
    last_modal_close = html.find('</div>\n\n    </div>', search_start)
    
if last_modal_close == -1:
    # Look for the last "  </div>" before "  </div>\n</div>"
    # This is the line that closes view-app
    remaining = html[search_start:]
    
    # Find first occurrence of the closing pattern
    pattern = '    </div>\n  </div>\n</div>'
    pattern_idx = remaining.find(pattern)
    if pattern_idx != -1:
        last_modal_close = search_start + pattern_idx
    else:
        print("ERROR: Could not find modal end pattern")
        print("Looking for pattern after position", search_start)
        print("Context:")
        print(html[search_start:search_start+500])
        exit(1)

# The modals_end should be right before the "  </div>" that closes view-app
# So we want to include everything up to and including "    </div>\n" which closes the last modal

# More precisely, modals_end should point to the character right after the last modal's closing "</div>"
# and before the blank line and "  </div>"

# Find the exact line boundaries
modals_content_start = modals_start_idx
modals_content_end = last_modal_close  # This is where "</div>\n  </div>\n</div>" starts

print(f"[✓] Found modals end at position {modals_content_end}")
print(f"[✓] Modals section is {modals_content_end - modals_content_start} bytes")

# Extract the modals content (including the marker)
modals_content = html[modals_content_start:modals_content_end]

print(f"[✓] Extracted modals section")
print(f"    First 50 chars: {modals_content[:50]}")
print(f"    Last 50 chars: {modals_content[-50:]}")

# Now find where to insert the modals
# They should go right after the closing of view-app structure
# Look for the pattern: "</div>\n</div>\n\n<script"

insert_pattern = '</div>\n</div>\n\n<script'
insert_idx = html.find(insert_pattern, modals_content_end + 50)

if insert_idx == -1:
    # Try alternative pattern
    insert_pattern = '</div>\n\n<script'
    insert_idx = html.find(insert_pattern, modals_content_end + 50)

if insert_idx == -1:
    print("ERROR: Could not find insertion point before <script>")
    exit(1)

print(f"[✓] Found insertion point at {insert_idx}")

# Now construct the new HTML:
# 1. Everything before modals in view-app
# 2. The structure that closes view-app (the "</div>\n  </div>\n</div>")
# 3. The modals (moved here)
# 4. Everything from after the moved modals to the end

before_modals = html[:modals_content_start]
closing_view_app = html[modals_content_end:modals_content_end + 30]  # Get the closing divs
after_modals_old_location = html[modals_content_end:insert_idx]

# Build new structure
new_html = (
    before_modals +                    # Before modals
    closing_view_app +                 # Close view-app structure
    '\n' +                             # Spacing
    modals_content +                   # Insert modals here (outside view-app)
    '\n' +                             # Spacing
    after_modals_old_location[closing_len:] + html[insert_idx:]  # Everything after
)

# Wait, this is getting confusing. Let me use a simpler approach:
# Just remove modals from their current location, then add them back after view-app closes

# Rebuild:
#  [before modals] + [closing structure from modals_end to before <script>] + [modals here]  + [<script...>]

before_modals = html[:modals_content_start]
after_modals_section = html[modals_content_end:]  # This includes "</div>\n  </div>\n</div>\n\n<script..."

# Remove the duplicate/old modals from after_modals_section
# Actually after_modals_section already doesn't have modals, since we end modals_content_end at the right spot

# Find where view-app closes in after_modals_section
# Look for "  </div>\n</div>\n\n<script" which closes view-app and starts script

pattern_in_after = '  </div>\n</div>\n\n<script'
pattern_idx_in_after = after_modals_section.find(pattern_in_after)

if pattern_idx_in_after == -1:
    pattern_in_after = '</div>\n\n<script'
    pattern_idx_in_after = after_modals_section.find(pattern_in_after)

if pattern_idx_in_after == -1:
    print("ERROR: Could not find pattern in after_modals_section")
    exit(1)

# Find where to insert modals - right after view-app structure closes
insert_in_after = pattern_idx_in_after + len('  </div>\n</div>')

# Build final HTML
new_html = (
    before_modals +                                           # Content before modals
    after_modals_section[:insert_in_after] +                 # View structure closing
    '\n\n' +                                                 # Spacing
    modals_content +                                         # Modals (now outside view-app)
    '\n' +                                                   # Spacing
    after_modals_section[insert_in_after:]                   # Everything after (scripts, etc)
)

# Verify the result makes sense
if new_html.count('<div id="view-app"') != 1:
    print("ERROR: Something went wrong with view-app count")
    exit(1)

if new_html.count('<!-- MODALS -->') != 1:
    print("ERROR: Modals marker count is off")
    exit(1)

# Write the file
with open('public/index.html', 'w', encoding='utf-8') as f:
    f.write(new_html)

print("\n[✅] Successfully fixed modal hierarchy!")
print("[✅] Modals are now siblings of view-app (outside the display:none container)")
print("[✅] Modals will be visible regardless of login state")

# Verify structure
if new_html.find('view-app') < new_html.find('<!-- MODALS -->'):
    print("[✓] Verification: view-app opens before modals close")
else:
    print("[✗] WARNING: Structure may be incorrect")
