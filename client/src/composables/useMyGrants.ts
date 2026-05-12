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
  } catch {
    // If the endpoint 401s (signed out) or 500s (migration not run),
    // leave the grants set empty — worst case the user sees no edit
    // icon on shared frags, which is the safe default.
    grants.value = []
    loaded.value = true
  } finally {
    loading.value = false
  }
}

function clear(): void {
  grants.value = []
  loaded.value = false
}

// Auto-clear when the signed-in user changes (sign-out, account switch).
// Runs once at module load; the watcher persists for the page lifetime.
const { user } = useAuth()
watch(
  () => user.value?.id ?? null,
  (newId, oldId) => {
    if (newId !== oldId) clear()
  }
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
