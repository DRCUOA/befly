# Changelog

All notable changes to the Rambulations writing platform are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.5] - 2026-02-20

### Fixed
- **Cover image persistence** — uploaded cover images were lost after Heroku dyno restarts because files were stored on the ephemeral filesystem; images are now persisted in PostgreSQL and served from the database with aggressive caching headers (`Cache-Control: immutable`, `ETag`)
- New `uploaded_files` table (migration 015) stores image binary data, content type, and metadata
- New `uploads.repo.ts` repository for database-backed file CRUD
- Upload controller reads multer temp files into PostgreSQL, then cleans up disk; `GET /uploads/cover/:filename` serves images from DB
- One-time backfill script (`scripts/backfill-uploads.sh`) to import existing filesystem images into PostgreSQL before next dyno cycle

### Changed
- Version bump 0.5.4 → 0.5.5

---

## [0.5.4] - 2026-02-17

### Added
- **Breathing space (cni-05)** — add whitespace and reduce density for visual calm in the Write view; second Sensory atomic in Phase 2
- CSS custom properties spacing scale: `--space-xs` (4px) through `--space-4xl` (80px) on a 4px grid for consistent vertical rhythm
- Tailwind `breath-*` spacing tokens (`breath-xs` through `breath-4xl`) with CSS variable references and pixel fallbacks
- Content area `max-w-[70ch]` for comfortable line length (65–75ch) within the full-width viewport
- Body textarea `leading-[1.6]` line-height for comfortable reading/writing
- `min-h-[44px]` tap targets on all interactive controls (Metadata, Publish, Cancel, Accept, Dismiss)
- **MetadataPanel Done button** — visible full-width close button at all viewport widths; solves the UX problem where narrow viewports (<600px) left no backdrop area to tap for dismissal
- **MetadataPanel swipe-to-dismiss** — touch swipe right (>80px threshold) closes the panel with finger-tracking feedback
- **WriteLayout hamburger menu** — nav collapses into hamburger toggle below 640px (`sm` breakpoint) with animated slide-down/up dropdown (200ms open, 150ms close) and 90-degree icon rotation transition
- Mobile dropdown menu items have 44px min-height touch targets

### Changed
- Write view: editor content, typography suggestions, body, and footer sections use `max-w-[70ch]` centred layout with responsive padding (px-4 → px-16 across breakpoints)
- Write view: footer controls use increased inter-element spacing (`gap-6` / `gap-8`) and `items-stretch` on mobile for full-width buttons
- Write view: error container, draft indicator use increased margins and padding
- Typography suggestions: summary bar, suggestion rows, Accept/Dismiss buttons have increased padding and 44px tap targets
- WriteLayout header: responsive padding scales with breakpoints; 44px min-height for touch accessibility
- WriteLayout: profile display name visually distinguished from nav links — smaller text (`text-xs`), lighter colour (`text-ink-whisper`), italic, wide letter-spacing, left border separator
- Version bump 0.5.3 → 0.5.4 (build number in footer)

---

## [0.5.3] - 2026-02-16

### Added
- **Single accent colour (cni-04)** — reduce colour palette to one accent; remove visual noise; opens Phase 2 (Sensory)
- CSS custom properties: `--color-accent` (#7C6F64), `--color-accent-hover` (#5C524A), `--color-accent-muted` (#F3EFEB) — warm stone derived from existing paper/ink palette
- Tailwind design tokens `accent`, `accent-hover`, `accent-muted` referencing CSS variables so downstream atomics inherit the palette automatically

### Changed
- Write view: consolidated 5 accent hues (amber, green, blue, red, gray) into single accent colour with lightness/weight shifts for interactive states
- Typography suggestions panel: moved above textarea (between title and body) so writers see suggestions without scrolling past text
- Typography suggestions detail: expanded max height from `max-h-48` (192px) to `max-h-[50vh]` so users can review all suggestions
- Typography suggestions summary bar: differentiated "Accept all" (font-medium, accent-hover) from "Dismiss" (ink-lighter) and chevron affordance (ink-lighter) for clear visual hierarchy
- MetadataPanel: focus rings, checkboxes, and select use `accent`/`accent-hover` instead of `ink`; button hovers use `line` token instead of hardcoded `#E5E5E5`
- ThemeTag: `bg-blue-100 text-blue-800` → `bg-accent-muted text-accent`
- CoverImageCropModal: cropper background uses `line` token; error text uses `ink` instead of `red-600`
- DraggableCoverImage: placeholder background uses `line` token instead of `gray-200`
- Draft saved indicator: uses accent-muted tint with ink weight shift instead of red/green semantic colours
- Recovery modal: restore button uses accent; dismiss/discard use neutral line/ink-light; preview area uses accent-muted
- Error displays (Write, MetadataPanel): use `bg-accent-muted border-line text-ink` instead of red palette
- Version bump 0.5.2 → 0.5.3 (build number in footer)

### Removed
- All secondary accent colours from Write view: amber (typography), green (accept/success), blue (restore/tags), red (errors/discard)
- Hardcoded hex colour values (`#E5E5E5`) from interactive hover states in Write view components

---

## [0.5.2] - 2026-02-16

### Added
- **Non-blocking typography (cni-03)** — typography suggestions no longer block writing or publishing; completes Phase 1 structural changes
- Inline collapsible suggestion panel: progressive reveal below textarea with Accept/Dismiss per suggestion, Accept all, Dismiss actions
- Debounced typography scanning: suggestions appear after 1.5 s typing pause or on blur — never interrupts keystrokes
- Dismissed-suggestion tracking: dismissed suggestions don't reappear on re-scan
- 5 new Vitest tests for cni-03 acceptance criteria (no blocking modal, direct submit, inline layout, accessible controls, unblocked textarea)

### Changed
- Write page: publish/update submits immediately — no modal gate, no scanning before submit
- Typography suggestion flow refactored from blocking modal (fixed overlay, z-50) to non-blocking inline panel (progressive reveal, role="region")
- Footer (Metadata, Publish, Cancel, draft indicator) is now sticky at viewport bottom (`sticky bottom-0`)
- Version bump 0.5.1 → 0.5.2 (build number in footer)

### Removed
- Blocking typography suggestions modal (`fixed inset-0 z-50` overlay before publish)
- `pendingSubmit` / `showTypographyModal` / `blurSuggestionCount` refs and `closeTypographyModalAndSubmit` function

---

## [0.5.1] - 2026-02-14

### Added
- **Slide-out metadata panel (cni-02)** — cover, themes, visibility moved into drawer; hidden from default Write view
- `MetadataPanel.vue`: slide-out drawer with cover image, themes, and visibility controls
- Vitest unit tests for MetadataPanel and Write page

### Changed
- Write page: metadata controls (cover, themes, visibility) moved into slide-out panel; ≤5 visible controls in default view
- Metadata panel opens via non-blocking interaction; accessible (keyboard, screen reader)

---

## [0.5.0] - 2026-02-14

### Added
- **Write layout (P1-uix-01)** — full viewport width, minimal chrome (≤5 controls per epic DoD)
- `WriteLayout.vue`: dedicated layout for Write/Edit with sticky header, Essays link, user name, Sign out
- `CoverImageCropModal.vue`: cover image crop with vue-advanced-cropper (1:1 aspect, 512×512 output)
- `vue-advanced-cropper` dependency for cover crop workflow
- `generateUUID()` util (`server/src/utils/uuid.ts`) — central UUID generation for app consistency

### Changed
- Write page: full-width editor, minimal header, typography styling
- Read page: cover image display in header (32×32 thumbnail when present)
- App routing: Write/Edit routes use WriteLayout instead of DefaultLayout
- Write page: upload cover → crop modal → apply crop → save as new upload
- Cover image upload: allow `.svg` in safe extensions
- Upload activity logging: use UUID from filename (before extension) for `resource_id`; `generateUUID()` for filenames

### Fixed
- Upload activity log: `resource_id` was UUID type but received `uuid.jpg`; now extracts UUID from filename

---

## [0.4.3] - 2026-02-13

### Fixed
- Server TypeScript build: add `upload` to `ResourceType` for upload activity logging
- Server TypeScript build: allow `coverImageUrl: null` in writing update to clear cover image (fix `string | null` vs `string | undefined`)

### Changed
- Version bump 0.4.2 → 0.4.3 (build number in footer)

---

## [0.4.2] - 2026-02-13

### Added
- **Essay cover images (cni-01)** — replace grey placeholders with admin-uploaded featured images
- `cover_image_url` and `cover_image_position` on writing_blocks (migrations 013, 014)
- Admin/author upload: images stored in `server/uploads/`, served at `/uploads/` as public assets
- Admin stock: `POST /api/admin/uploads`, `GET /api/admin/uploads` for image library
- Authenticated upload: `POST /api/writing/upload` for authors
- Browse modal: select from stock with two-step flow — choose image, drag to reposition, confirm
- Reposition: click-and-drag to adjust visible area when image is larger than 256×256 frame
- `DraggableCoverImage` component for repositioning in Browse modal, Write page, and Admin Reposition
- Admin writings table: Upload, Browse, Reposition, Clear for each essay
- Write page: upload cover image with draggable preview
- `.gitignore`: exclude `server/uploads/*` (keep `.gitkeep`)

### Changed
- WritingCard displays cover image with `object-position` when set; grey placeholder otherwise
- Home page: show image area for first 3 essays or any with `coverImageUrl`
- Version bump 0.4.1 → 0.4.2 (build number in footer)

---

## [0.4.1] - 2026-02-13

### Added
- Bulk import endpoint `POST /api/admin/typography-rules/import` — import many rules in one request (cni-08)
- Admin Rules import now uses bulk endpoint; avoids 429 rate limits when importing 230+ rules

### Changed
- Version bump 0.4.0 → 0.4.1 (build number in footer)

---

## [0.4.0] - 2026-02-12

### Added
- Typography rules import from JSON — paste single rule or array of rules in Admin Rules UI
- Download rules — export current rule set as `typography-rules.json`
- Download JSON schema — `typography-rules-schema.json` for AI/automation compatibility
- Vitest and guardrail tests (`server/src/typography-rules-guardrail.test.ts`) — prevent regression if `.trim()` is reintroduced on pattern/replacement

### Changed
- Pattern and replacement preservation — `sanitizePattern` and `sanitizeReplacementInput` no longer trim; patterns like `" {2,}"` and replacement `" "` are preserved
- EPIC_PROGRESS.md: Phase 3 complete; cni-07 post-delivery enhancements documented
- Version bump 0.3.3 → 0.4.0 (build number in footer)

### Fixed
- Pattern `" {2,}"` previously rejected due to `sanitizeString` trimming leading space; now preserved correctly

---

## [0.3.3] - 2026-02-12

### Added
- Typography suggestions (cni-06): suggest-only autocorrection on blur and before save
- Typography rule engine (`client/src/utils/typography-suggestions.ts`): smart quotes, en/em dashes, ellipsis
- Markdown-aware rules: skip inline code, code blocks, and URLs to avoid corrupting syntax
- Suggestion modal on Write page before publish: Accept/Dismiss per suggestion, Accept all, Continue without changes
- Blur hint: "X typography suggestions — review before publishing" when body textarea blurs
- **Typography rules management (cni-07)** — admin CRUD for typography rules:
  - `typography_rules` table (migration 012) with sort_order, enabled, pattern, replacement
  - Public `GET /api/typography-rules` (no auth) returns enabled rules for Write page
  - Admin `GET/POST/PUT/DELETE /api/admin/typography-rules` with reorder (up/down)
  - Admin Rules page at `/admin/rules` with create, edit, delete, reorder, enable/disable
  - Write page fetches rules from API; falls back to bundled defaults if API fails or returns empty

### Changed
- EPIC_PROGRESS.md: Phase 3 in progress; cni-06 complete; cni-07 drafted
- Version bump 0.3.2 → 0.3.3 (build number in footer)

## [0.3.2] - 2026-02-11

### Added
- Editor performance baseline test at `/baseline-test`: Vue textarea with real typing latency measurement (input → nextTick → rAF)
- Performance baseline report viewer: load exported JSON via file input

### Changed
- Replaced spoofed `measure-performance.js` and `performance-baseline-test.html` with proper measurement tooling per cni-03 spec

### Removed
- `measure-performance.js` (simulated metrics)
- `performance-baseline-test.html` (plain textarea, wrong target)
- `measure-performance` npm script

## [0.3.1] - 2026-02-10

### Changed
- Landing page corner year 2025 → 2026

## [0.3.0] - 2026-02-10

### Added
- Admin user locations map: global Leaflet/OpenStreetMap view with pins for users who have coordinates set
- Optional `latitude` and `longitude` on users (migration 011); admin can set location per user in the expanded panel
- `PUT /api/admin/users/:id` accepts `latitude` and `longitude` for location updates

### Changed
- Removed debug console logging: admin stats queries, DB pool init/connect/close, graceful shutdown messages, client CSRF and config load warnings

## [0.2.0] - 2026-02-09

### Added
- Role-based access control (RBAC) with admin and normal user roles
- Admin dashboard (`/admin`) for user management with role/status controls
- Admin content management: view, change visibility, and delete any user's essays, comments, and appreciations
- Usage analytics section in admin dashboard with graphical charts:
  - Authenticated vs anonymous donut chart
  - Activity-by-type horizontal bar chart
  - 30-day daily activity stacked bar chart
  - Hourly activity heatmap
  - Top active users and most interacted writings rankings
  - Action breakdown pills and recent activity feed
- `GET /api/admin/stats` endpoint with aggregated usage statistics
- Admin-only navigation link in the default layout
- `requireAdmin` middleware for admin-only route protection
- `isAdminRequest` helper for passing admin context through service layers
- Activity logging infrastructure (`user_activity_logs` table, migration 010)
- Activity service and repository for tracking user actions (auth, writing, theme, appreciation, comment, view)
- Admin actions are logged for audit trail

### Changed
- Auth middleware now fetches user role from database and attaches `userRole` to request
- Writing, theme, and comment repositories accept `isAdmin` flag to bypass ownership/visibility checks
- Writing, theme, and comment controllers pass admin context through to services and repositories
- `WritingCard` and `CommentSection` components allow admin edit/delete on any content
- `Themes` page allows admin edit/delete on any theme
- Activity routes restricted: `getRecentLogs` and `getResourceLogs` are now admin-only
- `ActivityType` model expanded to include `'admin'` type
- `asyncHandler` type signature relaxed to `Promise<any>` for broader controller compatibility

### Fixed
- User repo expanded with `findAll`, `count`, and `delete` methods for admin operations
- Safeguards prevent admin from demoting, suspending, or deleting their own account

## [0.1.2] - 2026-02-08

### Added
- User activity logging system with `activityService` and `activityRepo`
- Activity log migration (`010_user_activity_logs.sql`)
- Activity controller and routes for viewing logs
- `AppFooter` component displaying build number
- Version config (`client/src/config/version.ts`) with Vite build-time injection
- Database migration for nullable usernames (009)
- Userlog JSON file and cleanup script

### Changed
- Footer added to default layout with copyright and build number

## [0.1.1] - 2026-02-07

### Added
- Heroku Docker deployment support (`Dockerfile`, `heroku.yml`)
- Production deployment documentation
- Start script for production server

### Fixed
- PostgreSQL SSL configuration for Heroku
- Dockerfile build and runtime configuration
- Concurrent dev script shell compatibility

## [0.1.0] - 2026-02-05

### Added
- Initial project scaffold: monorepo with `client`, `server`, and `shared` workspaces
- **Server**: Express.js backend with TypeScript, PostgreSQL via `pg`, JWT authentication (httpOnly cookies)
- **Client**: Vue 3 with Composition API, Vue Router, Pinia state management, Tailwind CSS
- **Shared**: TypeScript type definitions for `User`, `WritingBlock`, `Theme`, `Appreciation`, `Comment`
- Core data model: users, writing blocks, themes, appreciations
- CRUD operations for writings, themes, and appreciations with ownership and visibility controls
- User authentication: signup, login, logout, token refresh
- Reading experience with stage-based progression, auto-continue, and progress tracking
- Browse/collection views with filter navigation
- Comment system with CRUD operations (migration 008)
- Wireframes imported from Inkwell design tool
- Database migrations (001-008): users, writing_blocks, themes, appreciations, auth/visibility, roles, reaction types, comments
- Development setup documentation and quick-start guide

[0.5.4]: https://github.com/DRCUOA/befly/compare/v0.5.3...v0.5.4
[0.5.3]: https://github.com/DRCUOA/befly/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/DRCUOA/befly/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/DRCUOA/befly/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/DRCUOA/befly/compare/v0.4.3...v0.5.0
[0.4.3]: https://github.com/DRCUOA/befly/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/DRCUOA/befly/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/DRCUOA/befly/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/DRCUOA/befly/compare/v0.3.3...v0.4.0
[0.3.3]: https://github.com/DRCUOA/befly/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/DRCUOA/befly/compare/v0.3.1...v0.3.2
[0.3.0]: https://github.com/DRCUOA/befly/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/DRCUOA/befly/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/DRCUOA/befly/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/DRCUOA/befly/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/DRCUOA/befly/releases/tag/v0.1.0
