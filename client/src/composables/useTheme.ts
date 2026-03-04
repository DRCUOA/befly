import { ref, computed } from 'vue'

const STORAGE_KEY = 'rambulations-theme'

const darkState = ref(false)

function apply() {
  document.documentElement.classList.toggle('dark', darkState.value)
}

let initialized = false

export function useTheme() {
  if (!initialized) {
    initialized = true
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark') {
      darkState.value = true
    } else if (stored === 'light') {
      darkState.value = false
    } else {
      darkState.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    apply()

    window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', (e) => {
        if (!localStorage.getItem(STORAGE_KEY)) {
          darkState.value = e.matches
          apply()
        }
      })
  }

  const toggle = () => {
    darkState.value = !darkState.value
    localStorage.setItem(STORAGE_KEY, darkState.value ? 'dark' : 'light')
    apply()
  }

  return {
    isDark: computed(() => darkState.value),
    toggle,
  }
}
