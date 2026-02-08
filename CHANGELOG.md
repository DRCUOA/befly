# Changelog

All notable changes to the Rambulations writing platform are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.2.0]: https://github.com/DRCUOA/befly/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/DRCUOA/befly/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/DRCUOA/befly/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/DRCUOA/befly/releases/tag/v0.1.0
