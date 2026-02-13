# Editor Layer Epic — Progress and Next Steps

**Last updated:** February 12, 2026

## Status Overview

| Phase | Status | Notes |
|-------|--------|-------|
| CNI 01–03 (investigate) | Complete | Audit, strategy, baseline done |
| Phase 1: Critical Safety | **Complete** | cni-04 done; cni-05 accepted as-is (no confirmation dialogs) |
| Phase 2: Validation | **Complete** | Undo/redo tests done; see findings below |
| Phase 3: Auto-correction | **Complete** | cni-06 and cni-07 implemented |

---

## Phase 1: Critical Safety

### cni-04: Draft Persistence + Recovery — **Complete**

| Criterion | Status |
|----------|--------|
| Draft persisted to localStorage within 60s of last edit | Yes (3s debounce in `useWriteDraft`) |
| Visible "Draft saved at" indicator | Yes (`Write.vue` lines 105–112) |
| Recovery offered on return with unsaved draft | Yes (`checkForDraft`, recovery modal) |
| Restore / Discard / Dismiss options | Yes |
| Draft cleared on successful publish | Yes (`handleSubmit` clears draft) |

**Implementation:** [`client/src/composables/useWriteDraft.ts`](../../../client/src/composables/useWriteDraft.ts), [`client/src/pages/Write.vue`](../../../client/src/pages/Write.vue)

---

### cni-05: Unsaved Changes Guard — **Complete (accepted as-is)**

**Decision:** Confirmation dialogs are not required. Current behavior is sufficient.

| Criterion | Status |
|----------|--------|
| beforeunload handler | Saves draft before leaving |
| Vue Router beforeRouteLeave | Saves draft before in-app navigation |
| Dirty state tracked | Yes (`hasUnsavedChanges` computed) |

**Current behavior:** Draft is saved to localStorage before navigation (no data loss). User is not prompted; navigation proceeds immediately. This is acceptable — draft recovery handles accidental navigation.

---

## Phase 2: Validation — **Complete**

- [x] Execute [UNDO_REDO_TEST_SCENARIOS.md](./UNDO_REDO_TEST_SCENARIOS.md) (8 scenarios)
- [x] Document browser behavior
- [x] Finding recorded

### Result

**Basic functions:** Browser native undo/redo works for normal typing (Scenario 1 and similar).

**Programmatic mutations:** When text is changed by code (e.g. script, auto-correction), those changes are **not reversible** with Cmd+Z. The browser undo stack does not integrate with programmatic edits.

**Decision: Option A selected.** No programmatic changes. Browser does not support undo of programmatic edits, so we will not apply corrections automatically.

- **Option A:** Suggest corrections only; validate on blur/save. Preserve 100% undo functionality.

---

## Phase 3: Auto-Correction — Option A Approach

**Strategy:** Suggest corrections, do not apply them programmatically. No cursor management or undo-stack work required.

**Implementation focus:**

| Original roadmap item | Option A approach |
|----------------------|-------------------|
| Debounced input handler | Optional; may run on blur/save only |
| Cursor position utilities | Not needed (no programmatic changes) |
| Correction rule engine | Same — rules detect issues |
| Apply corrections | **Suggest only** — show inline hints or modal; user chooses to accept |
| Undo wrapper | Not needed |

---

### cni-06: Autocorrection Option A — **Complete**

| Criterion | Status |
|----------|--------|
| Typography suggestions appear on blur or before save | Yes |
| User can accept or dismiss each suggestion | Yes |
| No programmatic text mutation without user action | Yes |
| Undo/redo behavior unchanged | Yes |
| Initial rules: smart quotes, en/em dashes, ellipsis | Yes |

**Implementation:**
- [`client/src/utils/typography-suggestions.ts`](../../../client/src/utils/typography-suggestions.ts) — rule engine, markdown-aware scan, apply helpers
- [`client/src/pages/Write.vue`](../../../client/src/pages/Write.vue) — suggestion modal before save, blur hint, user-initiated apply

**Delivered:** Modal before publish; Accept/Dismiss per suggestion or Accept all/Dismiss all; blur indicator for suggestion count.

---

### cni-07: Typography Rules Management — **Complete**

| Criterion | Status |
|----------|--------|
| Admin can create a new typography rule | Yes |
| Admin can edit existing rules | Yes |
| Admin can delete rules | Yes |
| Admin can reorder rules (up/down buttons) | Yes |
| Admin can enable/disable rules without deleting | Yes |
| Write page uses rules from API when available | Yes |
| Write page falls back to bundled defaults if API fails or returns empty | Yes |

**Implementation:**
- [`shared/TypographyRule.ts`](../../../shared/TypographyRule.ts) — shared types
- [`server/src/db/migrations/012_typography_rules.sql`](../../../server/src/db/migrations/012_typography_rules.sql) — DB table
- [`server/src/repositories/typography.repo.ts`](../../../server/src/repositories/typography.repo.ts), [`typography.service.ts`](../../../server/src/services/typography.service.ts), [`typography.controller.ts`](../../../server/src/controllers/typography.controller.ts)
- Public `GET /api/typography-rules` (no auth), Admin CRUD at `/api/admin/typography-rules`
- [`client/src/composables/useTypographyRules.ts`](../../../client/src/composables/useTypographyRules.ts) — fetches rules with fallback
- [`client/src/pages/AdminRules.vue`](../../../client/src/pages/AdminRules.vue) — admin CRUD UI
- [`client/src/pages/Write.vue`](../../../client/src/pages/Write.vue) — uses API rules; fallback to defaults

**Post-delivery enhancements:**
- Import from JSON — paste single rule or array of rules; same format as schema
- Download rules — export current rule set as `typography-rules.json`
- Download JSON schema — [`client/public/typography-rules-schema.json`](../../../client/public/typography-rules-schema.json) for AI/automation
- Pattern/replacement preservation — no `.trim()` on pattern or replacement; `sanitizePattern` and `sanitizeReplacementInput` in [`server/src/utils/sanitize.ts`](../../../server/src/utils/sanitize.ts)
- Guardrail tests — [`server/src/typography-rules-guardrail.test.ts`](../../../server/src/typography-rules-guardrail.test.ts) prevents regression if `.trim()` is reintroduced

---

## Documentation Updates Needed

- [x] **BASELINE_TESTING_README.md** — Known Risks updated (autosave/draft resolved)
- [ ] **EDITOR_PERFORMANCE_BASELINE.md** — Add note that critical autosave/draft items are addressed (optional)

---

## Recommended Next Steps

1. **Editor Layer Epic — Complete.** All Phase 3 atomics (cni-06, cni-07) are delivered. Optional enhancements added (import/export, guardrail tests).
2. **Optional: EDITOR_PERFORMANCE_BASELINE.md** — Add note that critical autosave/draft items are addressed.
3. **Future (out of scope):** Rule testing/preview UI in admin (from cni-07 spec); import/export of rule sets; version history or audit log for rule changes.
