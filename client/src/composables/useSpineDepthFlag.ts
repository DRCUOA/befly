/**
 * Feature flag for the Configurable Spine Depth refactor.
 *
 * The plan calls for a user-level boolean controlling whether the
 * Book Room exposes layer-management UI (the "Configure layers"
 * button and the recursive depth picker). We back it with localStorage
 * for Phase 4 — the flag is purely a UI gate, so persisting it server-
 * side adds infrastructure we don't yet need. A future Phase 4b can
 * promote it to user settings once the rollout sequence in the plan
 * reaches the "opt-in beta users" step.
 *
 * Defaulting to `false` matches the plan: existing manuscripts at
 * depth=1 are visually byte-identical whether the flag is on or off
 * (SpineSection at depth=1 produces the same DOM as the legacy inline
 * markup), but ANY ADDITIVE UI — the Configure-layers button, the
 * modal, layer labels in section headers — is hidden when the flag
 * is off. That keeps the rollout reversible at the click of a setting.
 */
import { ref, watch } from 'vue'

const STORAGE_KEY = 'feature:spine_depth_configurable'

/**
 * Read the flag from localStorage on module load. We treat any value
 * other than '1' or 'true' as off; that includes the missing-key case
 * for a brand-new user. localStorage access is synchronous so we can
 * initialize the ref at module scope without flashing the wrong UI.
 */
function readInitial(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    return v === '1' || v === 'true'
  } catch {
    // localStorage can throw in private-mode Safari and a handful of
    // strict-quota cases. Default to off so the user never sees the
    // flag enabled unless they explicitly turned it on.
    return false
  }
}

const flagState = ref<boolean>(readInitial())

// Persist on change. We don't subscribe to `storage` events across tabs
// because the flag changes rarely and a stale value in a background tab
// is harmless until that tab refreshes.
watch(flagState, value => {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    // Same rationale as readInitial — best-effort.
  }
})

/**
 * Composable wrapper. Components reach for `.value` to read the flag
 * and `setEnabled(true|false)` to flip it (e.g. a future "Beta features"
 * panel in user settings).
 */
export function useSpineDepthFlag() {
  return {
    enabled: flagState,
    setEnabled(value: boolean) {
      flagState.value = value
    },
  }
}
