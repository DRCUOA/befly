import { ref, computed, watch } from 'vue'
import { api } from '../api/client'
import { useAuth } from '../stores/auth'
import type { ApiResponse } from '@shared/ApiResponses'
import type { WritingBlockEditorPermission } from '@shared/WritingBlockEditor'

/**
 * Module-level singleton: the current user's editor grants on other
 * authors' frags. Loaded once after sign-in and refreshed when the
 * Editors panel mutates a grant.
 *
 * Keeps the WritingCard / WritingListRow / Read.vue edit-icon gates
 * cheap (Set lookup, no per-card request).
 */
interface Grant {
  writingBlockId: string
  permission: WritingBlockEditorPermission
}

const grants = ref<Grant[]>([])
const loaded = ref(false)
const loading = ref(false)

async function loadOnce(force = false): Promise<void> {
  if (loading.value) return
  if (loaded.value && !force) return
  loading.value = true
  try {
    const res = await api.get<ApiResponse<Grant[]>>('/writing/my-grants')
    grants.value = res.data || []
    loaded.value = true
  } catch (err) {
    // Leave loaded=false so a transient failure (e.g. the server
    // hasn't restarted to pick up the new route) doesn't permanently
    // suppress the edit icon. The next trigger will retry.
    grants.value = []
    if (typeof console !== 'undefined') {
      console.warn('[useMyGrants] /writing/my-grants failed', err)
    }
  } finally {
    loading.value = false
  }
}

function clear(): void {
  grants.value = []
  loaded.value = false
}

// React to auth state: fetch grants when a user appears or changes,
// clear them on sign-out. `immediate: true` covers the case where the
// composable is imported AFTER the user has already been restored
// (the usual path on a page refresh).
const { user } = useAuth()
watch(
  () => user.value?.id ?? null,
  (newId, oldId) => {
    if (oldId !== undefined && newId !== oldId) clear()
    if (newId) {
      void loadOnce(true)
    } else {
      clear()
    }
  },
  { immediate: true }
)

export function useMyGrants() {
  const grantedIds = computed(() => new Set(grants.value.map(g => g.writingBlockId)))

  function hasEditGrant(writingBlockId: string): boolean {
    return grantedIds.value.has(writingBlockId)
  }

  return {
    grants,
    loaded,
    loadOnce,
    /** Force a re-fetch — call after the Editors panel adds/removes grants. */
    refresh: () => loadOnce(true),
    clear,
    hasEditGrant,
  }
}
