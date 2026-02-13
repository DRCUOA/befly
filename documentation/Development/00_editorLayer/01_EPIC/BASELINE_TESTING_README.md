# Performance Baseline Testing

Establishes performance and safety baseline for the long-form editor per [cni-03-editor-baseline-performance.json](./Atomics/cni-03-editor-baseline-performance.json).

## What This Measures

- **Typing latency** — Real measurement (input → Vue update → next frame) for small, medium, and large documents
- **Undo/redo behavior** — Observe behavior under programmatic text changes (browser-dependent)
- **Document size limits** — Document size thresholds and risks
- **Data loss risks** — Autosave, draft persistence, network failures

## Quick Start

### 1. Run the app

```bash
npm run dev
```

### 2. Open baseline test page

Navigate to **http://localhost:5173/baseline-test** (or your dev URL).

### 3. Measure latency

1. Click **Small (1KB)**, **Medium (10KB)**, or **Large (100KB)** to load a document
2. Type in the editor for 10–30 seconds
3. Review the measured latency (avg, max, P95, P99, % slow events)

### 4. Test undo/redo

1. Type some text
2. Click **Replace "the" → "THE"** or **Insert at cursor**
3. Press Ctrl+Z (Cmd+Z) and document the behavior

### 5. Export report

- **Export JSON** — Saves `performance-baseline-results-{timestamp}.json`
- **Export HTML report** — Saves self-contained HTML report

### 6. View report (optional)

Open `performance-baseline-view.html` in a browser, then drag-and-drop or select the exported JSON file to view it.

## Files

| File | Purpose |
|------|---------|
| `performance-baseline-view.html` | Standalone viewer for exported JSON (file input) |
| `EDITOR_PERFORMANCE_BASELINE.md` | Comprehensive baseline report and findings |
| `UNDO_REDO_TEST_SCENARIOS.md` | Manual undo/redo test procedures |

## Implementation

The baseline test uses **Vue v-model on a textarea** — the same pattern as `Write.vue`. Latency is measured as:

```
input event → Vue nextTick → requestAnimationFrame → record
```

This captures the actual time from user input to the next frame (Vue reactivity + DOM update).

## Known Risks

- ~~🔴 **HIGH:** No autosave~~ — **Resolved:** localStorage autosave in `useWriteDraft` (3s debounce)
- ~~🔴 **HIGH:** No draft persistence~~ — **Resolved:** Draft recovery modal on Write page load
- 🔴 **HIGH:** Undo stack corruption with programmatic changes
- 🟡 **MEDIUM:** Performance degradation at 500KB+ documents
- 🟡 **MEDIUM:** Unsaved changes confirmation — draft is saved before leaving but user is not warned (see cni-05)

## Related

- [EPIC_PROGRESS.md](./EPIC_PROGRESS.md) — Current status and next steps
- [cni-03-editor-baseline-performance.json](./Atomics/cni-03-editor-baseline-performance.json) — Atomic spec
- `EDITOR_STACK_AUDIT.md` — Technical details
- `EDITOR_STRATEGY_DECISION.md` — Architectural decisions
