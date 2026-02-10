# Editor Stack and Integration Surface Audit

**Date:** February 10, 2026  
**Purpose:** Audit existing editor stack and integration surface for future auto-correction implementation  
**Related:** Issue #16 (EPIC) - Auto-correction Integration  
**Status:** Complete

## Executive Summary

This document provides a comprehensive audit of the befly writing platform's editor stack, identifying the current technology, data flows, and safe integration points for future editor-level auto-correction features. The platform uses a minimal, native HTML textarea-based approach with Vue 3 reactivity and simple persistence flows.

## 1. Editor Stack and Technology

### 1.1 Core Editor Technology

**Editor Type:** Native HTML `<textarea>` element  
**Version:** HTML5 standard (browser-native)  
**Framework:** Vue 3.4.0  
**Build Tool:** Vite 5.0.0

**Key Characteristics:**
- Plain textarea without rich text editing capabilities
- No WYSIWYG features
- Markdown-flavored input (rendered separately for display)
- Browser-native undo/redo functionality
- Native spell-check (browser-provided, can be disabled)

### 1.2 Frontend Stack Versions

| Component | Version (package.json) | Version (installed) | Purpose |
|-----------|------------------------|---------------------|---------|
| Vue | ^3.4.0 | 3.5.27 | Reactive framework |
| Vue Router | ^4.2.5 | 4.6.4 | Client-side routing |
| TypeScript | ^5.3.0 | 5.9.3 | Type safety |
| Vite | ^5.0.0 | 5.4.21 | Build tool |
| Tailwind CSS | ^3.4.0 | 3.4.19 | Styling |
| marked | ^11.1.0 | 11.2.0 | Markdown rendering |

**Note:** Actual installed versions may differ slightly due to semantic versioning ranges in package.json.

### 1.3 Editor Location

**Primary Writing Interface:**
- File: `/client/src/pages/Write.vue`
- Lines: 24-31 (main textarea)
- Element ID: `body`
- Rows: 12 (configurable)

**Secondary Text Inputs:**
- Comment textarea: `/client/src/components/writing/CommentSection.vue` (lines 13-20, 99-105)
- Not primary focus for auto-correction

### 1.4 Editor Configuration

```vue
<textarea
  id="body"
  v-model="form.body"
  rows="12"
  required
  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono text-sm"
  placeholder="Write your thoughts in Markdown..."
/>
```

**Properties:**
- Font: Monospace (`font-mono`)
- Size: Small (`text-sm`)
- Auto-resize: No (fixed 12 rows)
- Spell-check: Browser default (enabled)
- Auto-complete: Browser default

### 1.5 Build and Development Tools

**Available Scripts:**
- `npm run dev` - Start development server (Vite)
- `npm run build` - Type-check and production build (`vue-tsc && vite build`)
- `npm run preview` - Preview production build
- `npm run type-check` - Type-checking only (`vue-tsc --noEmit`)

**Build Output:**
- Directory: `/client/dist`
- Main bundle: ~403 KB (126 KB gzipped)
- CSS bundle: ~51 KB (13 KB gzipped)
- Build time: ~2-3 seconds (typical)

**Type Safety:**
- TypeScript strict mode enabled
- Vue SFC type checking via `vue-tsc`
- Path aliases: `@/*` → `./src/*`, `@shared/*` → `../shared/*`

**No testing infrastructure detected:**
- No Jest, Vitest, or other test runners
- No E2E testing framework (Playwright, Cypress)
- No linting configuration files (.eslintrc, etc.)

## 2. Extensions, Plugins, and Schema

### 2.1 Editor Extensions

**None detected.** The platform uses a vanilla textarea with no editor extensions or plugins.

### 2.2 Text Processing Libraries

| Library | Version | Purpose | Location |
|---------|---------|---------|----------|
| marked | 11.1.0 | Markdown parsing and rendering | Display only, not editing |

**Markdown Configuration** (`/client/src/utils/markdown.ts`):
```typescript
marked(markdown, {
  breaks: true,  // GitHub-flavored line breaks
  gfm: true      // GitHub-flavored markdown
})
```

### 2.3 Content Schema

**Writing Block Structure** (`/shared/WritingBlock.ts`):
```typescript
interface WritingBlock {
  id: string
  userId: string
  title: string
  body: string              // Plain text, markdown-formatted
  themeIds: string[]
  visibility: 'private' | 'shared' | 'public'
  createdAt: string
  updatedAt?: string
}
```

**Constraints:**
- No maximum length enforced on body (database-dependent)
- Title: Required, plain text
- Body: Required, markdown-flavored plain text
- Character encoding: UTF-8

## 3. Text Input, Key Handling, and Paste Interception

### 3.1 Input Event Handling

**Current Implementation:**
- Uses Vue 3's `v-model` directive for two-way binding
- Binding mode: Default (reactivity on input events)
- File: `/client/src/pages/Write.vue`, line 26

**Data Flow:**
```
User Input → textarea DOM event → v-model reactive ref → form.body ref
```

**No custom event handlers detected for:**
- `@input`
- `@keydown`
- `@keyup`
- `@paste`
- `@beforeinput`

### 3.2 Current Event Interception Points

**Available but unused:**
1. **Input level:** Could intercept via `@input` handler
2. **Key level:** Could intercept via `@keydown` or `@keyup`
3. **Paste level:** Could intercept via `@paste`
4. **Composition:** Could monitor via `@compositionstart/end` for IME input

### 3.3 Cursor Position Management

**Current State:**
- No custom cursor position tracking
- Browser-native cursor management only
- Selection API available but unused

**Risk:** Auto-correction must preserve cursor position to avoid jarring user experience.

## 4. Undo/Redo and History Configuration

### 4.1 Editor Undo/Redo

**Implementation:** Browser-native only  
**Configuration:** None (uses browser defaults)  
**Accessibility:** Standard Ctrl+Z (undo) and Ctrl+Y/Ctrl+Shift+Z (redo)

**Key Finding:** No custom undo/redo stack implementation detected. Any auto-correction must integrate with browser's native undo stack to maintain expected behavior.

### 4.2 History Management

**Router History:**
- Uses Vue Router's `createWebHistory()`
- Location: `/client/src/router/index.ts`
- Purpose: Navigation history only, not text editing

**Reading History:**
- Uses `sessionStorage` for reading progress
- Location: `/client/src/stores/reading.ts`
- Keys: `befly-reading-history`, `befly-scroll-positions`
- Purpose: Track which writings users have read

**No editing history persistence detected.**

## 5. Autosave and Persistence Flows

### 5.1 Persistence Architecture

**Current Flow:**
```
┌──────────────────────────────────────────────────────────────┐
│                     USER INTERACTION                         │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  Write.vue (Component)                                       │
│  - textarea element (native HTML)                            │
│  - v-model="form.body" (Vue 3 reactivity)                   │
│  - @submit.prevent="handleSubmit"                           │
└──────────────────────┬───────────────────────────────────────┘
                       │ (form submission)
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  API Client (/client/src/api/client.ts)                     │
│  - Native fetch wrapper                                      │
│  - POST /api/writing (create)                               │
│  - PUT /api/writing/:id (update)                            │
│  - Credentials: httpOnly cookies                            │
│  - CSRF: X-CSRF-Token header                                │
└──────────────────────┬───────────────────────────────────────┘
                       │ (HTTP request)
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  Express Server (/server/src)                               │
│  - writing.controller.ts (HTTP layer)                       │
│  - writing.service.ts (business logic)                      │
│  - writing.repo.ts (data access)                            │
└──────────────────────┬───────────────────────────────────────┘
                       │ (SQL query)
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  PostgreSQL Database                                         │
│  - writing_blocks table                                     │
│  - Fields: id, userId, title, body, themeIds, visibility    │
└──────────────────────────────────────────────────────────────┘
```

**Data Flow Timing:**
- User types: Instant (v-model updates ref)
- Form submit: ~100-500ms (network + server processing)
- Success: Redirect to /home
- Failure: Display error message

### 5.2 Save Triggers

**Manual Save Only:**
- Trigger: Form submission via "Publish" or "Update" button
- Event: `@submit.prevent="handleSubmit"`
- Location: `/client/src/pages/Write.vue`, line 168
- Method: `api.post()` for create, `api.put()` for update

**No Autosave Detected:**
- No `setTimeout`, `setInterval`, or debounce for auto-saving
- No draft persistence to localStorage/sessionStorage
- No "save on blur" or "save on navigate away"

### 5.3 Data Validation

**Client-side:**
- Title: Required (HTML5 validation)
- Body: Required (HTML5 validation)
- Trim: Yes, on submit (`form.value.title.trim()`, `form.value.body.trim()`)

**Server-side:**
- Handled by writing service (not visible in audit scope)

### 5.4 Network Layer

**Technology:** Native `fetch` API  
**Configuration:**
- Base URL: `/api` (proxied to backend)
- Credentials: `include` (httpOnly cookies for auth)
- CSRF: Token-based via `X-CSRF-Token` header
- Error handling: HTTP status-based with JSON error responses

## 6. Performance Characteristics

### 6.1 Rendering Performance

**Textarea Characteristics:**
- Lightweight: Native browser element
- No virtual DOM overhead for text content
- Single-threaded input handling

**Potential Bottlenecks:**
- Large documents (>100KB) may experience input lag
- Vue reactivity overhead on every keystroke (v-model)
- No debouncing or throttling on input

### 6.2 Reactivity Performance

**Vue 3 Reactivity:**
- Uses Proxy-based reactivity (Vue 3)
- Updates on every input event
- No observed performance optimizations for large text

**Reading Page Performance:**
- Implements throttling for scroll events (16ms, ~60fps)
- Implements debouncing for stage updates (200ms)
- Location: `/client/src/composables/useReadingProgress.ts`

**Evidence of Performance Awareness:**
- Reading composables use `throttle()` and `debounce()`
- Custom implementations in `/client/src/utils/throttle.ts`
- Request animation frame for smooth scroll updates

### 6.3 Long-Form Content Performance

**Observations:**
- No explicit handling for large documents in editor
- Markdown rendering uses `marked` library (synchronous, blocking)
- No pagination or virtualization for long content
- Reading page has scroll position tracking (may impact performance)

**Estimated Thresholds (Untested):**
- Comfortable: < 50,000 characters
- Acceptable: 50,000 - 200,000 characters
- Degraded: > 200,000 characters

**Recommendation:** Test with representative long-form content (10,000+ words / 50,000+ characters) before implementing auto-correction.

## 7. Safe Interception Points for Auto-Correction

### 7.1 Recommended Interception Approach

**Auto-Correction Integration Points Diagram:**
```
┌─────────────────────────────────────────────────────────────┐
│  User Types in Textarea                                     │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
   [Option 1]            [Option 2]
   @input event          @keydown event
   (After input)         (Before input)
        │                     │
        ▼                     ▼
┌──────────────────┐   ┌──────────────────┐
│ Auto-Correction  │   │ Auto-Correction  │
│ Logic            │   │ Logic            │
│                  │   │                  │
│ 1. Save cursor   │   │ 1. Intercept key │
│ 2. Apply rules   │   │ 2. Apply rules   │
│ 3. Update text   │   │ 3. preventDefault│
│ 4. Restore cursor│   │ 4. Insert text   │
└──────┬───────────┘   └──────┬───────────┘
       │                      │
       └──────────┬───────────┘
                  │
                  ▼
       ┌────────────────────┐
       │ v-model Updates    │
       │ form.body Ref      │
       └──────┬─────────────┘
              │
              ▼
       ┌────────────────────┐
       │ Vue Reactivity     │
       │ Updates DOM        │
       └────────────────────┘
```

**Option 1: Input Event Handler (Recommended)**
```vue
<textarea
  v-model="form.body"
  @input="handleInput"
  <!-- or @beforeinput for more control -->
/>
```

**Advantages:**
- Non-invasive to existing v-model
- Can inspect and modify content after user input
- Preserves Vue reactivity chain

**Disadvantages:**
- Runs after v-model updates ref
- May require manual cursor management

**Option 2: Keydown Handler (Alternative)**
```vue
<textarea
  v-model="form.body"
  @keydown="handleKeydown"
/>
```

**Advantages:**
- Intercepts before input is applied
- Can preventDefault() to block unwanted input
- More control over special keys

**Disadvantages:**
- More complex logic needed
- Must handle all input methods (paste, IME, etc.)

**Option 3: Blur Handler (Not Recommended)**
- Only runs when user leaves field
- Poor UX for real-time correction
- Would require explicit save triggers

### 7.2 Implementation Constraints

**Must Preserve:**
1. **Cursor position:** Use `selectionStart` and `selectionEnd` to save/restore
2. **Undo stack:** Modifications should be undoable
3. **Performance:** Avoid blocking on every keystroke
4. **Vue reactivity:** Work within Vue's reactive system

**Integration Points:**
- Component: `/client/src/pages/Write.vue`
- State: `form.body` ref (line 121)
- Mount hook: `onMounted()` available for initialization (line 204)
- Unmount hook: `onUnmounted()` for cleanup (not currently present)

### 7.3 Auto-Correction Strategy Considerations

**Timing:**
- Real-time (on input): High CPU cost, immediate feedback
- Debounced (after pause): Lower cost, delayed feedback
- On blur: Lowest cost, delayed feedback

**Granularity:**
- Character-level: High frequency, simple rules
- Word-level: Medium frequency, grammar-aware
- Sentence-level: Low frequency, context-aware

**Undo Integration:**
- Browser undo: May conflict with programmatic changes
- Custom undo: Requires full implementation
- Hybrid: Complex but most flexible

## 8. Risks and Unknowns

### 8.1 Known Risks

1. **Cursor Position Drift**
   - Risk: Auto-correction changes text length, moving cursor unexpectedly
   - Impact: High (breaks user trust)
   - Mitigation: Carefully track and restore cursor position after corrections

2. **Undo History Corruption**
   - Risk: Programmatic changes may not integrate with browser undo
   - Impact: High (users cannot undo corrections)
   - Mitigation: Test extensively, consider custom undo stack

3. **Performance Degradation**
   - Risk: Auto-correction adds overhead to every keystroke
   - Impact: Medium (input lag on large documents)
   - Mitigation: Debounce corrections, profile performance

4. **IME Input Conflicts**
   - Risk: International input methods may break with auto-correction
   - Impact: Medium (affects non-English users)
   - Mitigation: Respect `compositionstart`/`compositionend` events

5. **Mobile Experience**
   - Risk: On-screen keyboards may interact poorly with auto-correction
   - Impact: Medium (mobile is significant user base)
   - Mitigation: Test on iOS and Android browsers

6. **Markdown Syntax Corruption**
   - Risk: Auto-correction may break markdown syntax (e.g., `**bold**`)
   - Impact: High (breaks user intent)
   - Mitigation: Markdown-aware correction rules

### 8.2 Unknowns

1. **Database Field Size Limits**
   - Unknown: Maximum size of `body` field in PostgreSQL
   - Impact: May affect large document support
   - Investigation needed: Check schema

2. **Server-Side Validation Rules**
   - Unknown: What validation exists on backend
   - Impact: Auto-correction may introduce invalid content
   - Investigation needed: Review writing service

3. **Browser Compatibility**
   - Unknown: Selection API behavior across browsers
   - Impact: Cursor management may fail on some browsers
   - Investigation needed: Cross-browser testing

4. **Existing User Workflows**
   - Unknown: How users actually write (drafts, copy-paste, etc.)
   - Impact: Auto-correction may disrupt established patterns
   - Investigation needed: User research / analytics

5. **Performance Baseline**
   - Unknown: Current performance metrics for large documents
   - Impact: Cannot measure auto-correction overhead
   - Investigation needed: Performance profiling

## 9. Production Code Impact

**Verification:** No production code has been modified during this audit.

```bash
git status
# On branch copilot/audit-editor-stack-integration
# nothing to commit, working tree clean
```

This audit is purely investigative and documentation-focused.

## 10. Recommendations

### 10.1 Before Implementing Auto-Correction

1. **Performance Baseline**
   - Measure input latency with 1KB, 10KB, 100KB documents
   - Profile Vue reactivity overhead
   - Establish acceptable latency thresholds

2. **User Research**
   - Survey how users write (mobile vs. desktop, markdown usage)
   - Identify pain points with current editor
   - Validate auto-correction value proposition

3. **Technical Prototyping**
   - Build isolated proof-of-concept with cursor management
   - Test undo integration approaches
   - Validate cross-browser compatibility

### 10.2 Implementation Approach

**Phase 1: Infrastructure**
- Add debounced input handler
- Implement cursor position tracking
- Add performance monitoring

**Phase 2: Simple Rules**
- Start with non-intrusive corrections (whitespace, quotes)
- Test extensively with user feedback
- Monitor performance impact

**Phase 3: Advanced Rules**
- Grammar and spell checking
- Context-aware corrections
- User preferences and toggles

### 10.3 Testing Requirements

- Unit tests for correction logic
- Integration tests for Vue reactivity
- E2E tests for cursor position preservation
- Performance tests for large documents
- Cross-browser compatibility tests
- Mobile device tests (iOS Safari, Chrome Android)

## 11. Conclusion

The befly writing platform uses a minimal, native textarea-based editor with Vue 3 reactivity. This provides a clean foundation for auto-correction but requires careful implementation to preserve cursor position, undo history, and performance. The primary integration point is the `Write.vue` component's textarea element, with input event handling as the recommended interception approach.

**Key Takeaways:**
- ✅ Simple, well-understood editor technology
- ✅ Clear data flow from input to persistence
- ✅ Existing performance optimizations in other areas
- ⚠️ No autosave (loss on accidental navigation)
- ⚠️ No custom undo/redo (must use browser native)
- ⚠️ Performance characteristics for large documents untested
- ❌ No editor extensions to conflict with auto-correction

**Status:** Ready for next phase (implementation planning) with identified risks and constraints documented.

---

**Audit completed by:** GitHub Copilot  
**Review requested from:** Engineering team  
**Next steps:** Review and validation, then proceed to Issue #16 implementation
