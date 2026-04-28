import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { useAuth } from './stores/auth'
import { loadAppConfig } from './config/app'
import './index.css'

/* ============================================================
 * Boot-time theme-var recovery sweep
 *
 * The brightness slider in Write.vue (zen-brightness-slider) sets
 * inline CSS vars directly on document.documentElement and was
 * historically also stripping the .dark class. If the writer left
 * /write before the cleanup landed, those inline vars persisted on
 * <html> and survived SPA navigation — pairing the structural .dark
 * CSS (page-canvas gradient) with light-valued inline vars (--color-
 * ink at 37 37 32) produced dark text on a dark gradient = invisible
 * content, site-wide.
 *
 * This sweep runs ONCE per app boot, BEFORE Vue mounts. It removes any
 * theme-var inline overrides that might be lingering from a previous
 * session (or a non-SPA reload that didn't fully tear down the DOM).
 * Effectively: every user gets a clean slate every time the app loads,
 * regardless of what state Write.vue may have left behind.
 *
 * Cheap to run (a small loop over a fixed list of property names) and
 * idempotent. Keep in sync with THEME_PAIRS in pages/Write.vue —
 * adding a new theme token there means adding it here too, otherwise
 * a future leak of the new token won't be cleaned up at boot.
 */
const THEME_VAR_NAMES = [
  '--color-paper',
  '--color-surface',
  '--color-ink',
  '--color-ink-light',
  '--color-ink-lighter',
  '--color-ink-whisper',
  '--color-line',
  '--color-accent',
  '--color-accent-hover',
  '--color-accent-muted',
  '--cluster-icon-color',
] as const
for (const name of THEME_VAR_NAMES) {
  document.documentElement.style.removeProperty(name)
}

const app = createApp(App)
app.use(router)

// Initialize app config and auth state on app start
Promise.all([
  loadAppConfig(),
  useAuth().fetchCurrentUser()
]).then(() => {
  app.mount('#app')
})
