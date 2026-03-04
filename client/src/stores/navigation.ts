import { useRouter, useRoute } from 'vue-router'
import { computed } from 'vue'

const STORAGE_KEY = 'befly-nav-origins'

const TRACKED_ROUTES = new Set([
  'Read', 'Write', 'EditWriting',
  'CreateTheme', 'EditTheme', 'ThemeDetail',
])

function getOrigins(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveOrigins(origins: Record<string, string>) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(origins))
}

export function setOriginForRoute(routeName: string, originPath: string) {
  const origins = getOrigins()
  origins[routeName] = originPath
  saveOrigins(origins)
}

export function getOriginForRoute(routeName: string): string | null {
  return getOrigins()[routeName] || null
}

export function clearOriginForRoute(routeName: string) {
  const origins = getOrigins()
  delete origins[routeName]
  saveOrigins(origins)
}

export function isTrackedRoute(routeName: string): boolean {
  return TRACKED_ROUTES.has(routeName)
}

export function useNavigationOrigin(fallback: string = '/home') {
  const router = useRouter()
  const route = useRoute()

  const origin = computed(() => {
    const name = route.name as string
    return getOriginForRoute(name) || fallback
  })

  const originLabel = computed(() => {
    const path = origin.value
    if (path.startsWith('/themes/') && path !== '/themes/create') return 'Back to theme'
    if (path === '/themes') return 'Back to themes'
    if (path.startsWith('/read/')) return 'Back to essay'
    if (path === '/admin') return 'Back to admin'
    return 'Back to essays'
  })

  function navigateBack() {
    const dest = origin.value
    clearOriginForRoute(route.name as string)
    router.push(dest)
  }

  return { origin, originLabel, navigateBack }
}
