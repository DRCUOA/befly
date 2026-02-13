# Changelog

All notable changes to the Rambulations writing platform are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.4.1]: https://github.com/DRCUOA/befly/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/DRCUOA/befly/compare/v0.3.3...v0.4.0
[0.3.3]: https://github.com/DRCUOA/befly/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/DRCUOA/befly/compare/v0.3.1...v0.3.2
[0.3.0]: https://github.com/DRCUOA/befly/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/DRCUOA/befly/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/DRCUOA/befly/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/DRCUOA/befly/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/DRCUOA/befly/releases/tag/v0.1.0
