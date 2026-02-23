
 RUN  v2.1.9 /Volumes/SecureData/c26/active/befly/client

[32m[1] strips headers and keeps content pass[0m
[32m[2] strips bold and italic pass[0m
[32m[3] strips links and keeps link text pass[0m
[32m[4] strips images and keeps alt text pass[0m
[32m[5] strips inline code pass[0m
[32m[6] strips fenced code blocks pass[0m
[32m[7] strips blockquote prefix pass[0m
[32m[8] strips list prefixes pass[0m
[32m[9] returns 0 for empty string pass[0m
[32m[10] counts plain text words pass[0m
[32m[11] excludes markdown syntax from count pass[0m
[32m[12] counts visible text only for links and images pass[0m
[32m[13] handles mixed markdown pass[0m
 ✓ src/utils/markdown.spec.ts (13 tests) 5ms
[32m[1] exposes cover, themes, and visibility controls when open pass[0m
[32m[2] has role="dialog" and aria-label for screen reader accessibility pass[0m
[32m[3] has aria-hidden when closed pass[0m
[32m[4] has close button with aria-label pass[0m
[32m[5] emits update:modelValue(false) when close button clicked pass[0m
[32m[6] uses duration-150 for transition (<200ms per spec) pass[0m
[32m[7] closes on Escape key (keyboard accessibility) pass[0m
[32m[8] visibility select has aria-label pass[0m
 ✓ src/components/writing/MetadataPanel.spec.ts (8 tests) 23ms
[32m[1] editor content area uses full width (w-full) pass[0m
[32m[2] default view shows minimal chrome (≤5 visible controls) pass[0m
[32m[3] title and body have aria-labels for accessibility pass[0m
[32m[4] metadata controls (cover, visibility, themes) are NOT visible in default view pass[0m
[32m[5] metadata trigger has clear affordance (icon + label) pass[0m
[32m[6] metadata panel is hidden by default pass[0m
[32m[7] clicking metadata trigger opens the panel pass[0m
[32m[8] panel contains cover, themes, and visibility when open pass[0m
[32m[9] backdrop closes panel when clicked (non-blocking) pass[0m
[32m[10] no blocking modal overlay for typography in default view pass[0m
[32m[11] form submits directly without intermediate blocking modal pass[0m
[32m[12] typography suggestions region uses inline layout (not fixed overlay) pass[0m
[32m[13] inline suggestion panel has accessible expand/collapse control pass[0m
[32m[14] typing is never blocked by typography UI (textarea always accessible) pass[0m
[32m[15] word count is not visible while user is actively typing (default view) pass[0m
[32m[16] word count element exists in body editor area when shown pass[0m
[32m[17] word count excludes markdown syntax (accurate count) pass[0m
 ✓ src/pages/Write.spec.ts (17 tests) 83ms

 Test Files  3 passed (3)
      Tests  38 passed (38)
   Start at  21:24:54
   Duration  717ms (transform 235ms, setup 29ms, collect 390ms, tests 111ms, environment 460ms, prepare 144ms)

