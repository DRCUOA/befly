<template>
  <!--
    Full-viewport sandboxed view for an essay whose body is a complete HTML
    SPA (DOCTYPE / <html>…). Uses srcdoc + sandbox so the iframe runs CDN
    scripts (Tailwind, Chart.js, fonts) inside its own document context
    without ever touching the host app's cookies or localStorage.

    A small floating "Back" pill is the only chrome — everything else is
    the author's SPA at 100vw × 100vh.
  -->
  <div class="spa-view">
    <div v-if="loading" class="spa-status">Loading…</div>
    <div v-else-if="error" class="spa-status spa-status-error">
      <p>{{ error }}</p>
      <router-link :to="backRoute" class="spa-back-link">← Back</router-link>
    </div>
    <template v-else-if="writing">
      <iframe
        v-if="isSpa"
        :srcdoc="writing.body"
        :title="writing.title"
        class="spa-frame"
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        referrerpolicy="no-referrer"
        loading="eager"
      />
      <div v-else class="spa-status spa-status-error">
        <p>This frag isn't a standalone HTML document.</p>
        <router-link :to="`/read/${writing.id}`" class="spa-back-link">← Read instead</router-link>
      </div>

      <!-- Floating back pill, top-left, very small. Hidden on hover-out so
           it never visually intrudes on the SPA when the reader isn't
           reaching for it. -->
      <button
        type="button"
        class="spa-back-pill"
        :title="backLabel"
        :aria-label="backLabel"
        @click="goBack"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none"
             stroke="currentColor" stroke-width="1.6"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 4 6 10l6 6" />
        </svg>
        <span class="spa-back-label">{{ backLabel }}</span>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api/client'
import type { WritingBlock } from '../domain/WritingBlock'
import type { ApiResponse } from '@shared/ApiResponses'
import { isStandaloneHtmlDoc } from '../utils/markdown'

const route = useRoute()
const router = useRouter()

const writing = ref<WritingBlock | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const isSpa = computed(() => isStandaloneHtmlDoc(writing.value?.body))

const backRoute = computed(() => writing.value ? `/read/${writing.value.id}` : '/home')
const backLabel = 'Back to frag'

function goBack() {
  // Prefer browser history when possible (we were opened from /read/:id in a
  // new tab — there'll be no history entry, so fall back to the read route).
  if (window.history.length > 1 && document.referrer) {
    router.back()
    return
  }
  router.push(backRoute.value)
}

onMounted(async () => {
  const id = route.params.id as string
  if (!id) {
    error.value = 'No writing ID provided'
    loading.value = false
    return
  }
  try {
    const res = await api.get<ApiResponse<WritingBlock>>(`/writing/${id}`)
    writing.value = res.data
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load frag'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.spa-view {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  background: #000;
  overflow: hidden;
}

.spa-frame {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
  background: #fff;
}

.spa-status {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-family: 'Inter', sans-serif;
  color: rgb(var(--color-ink-light, 30 46 28));
  background: rgb(var(--color-paper, 226 204 172));
}
.spa-status-error {
  color: #b91c1c;
}
.spa-back-link {
  font-size: 13px;
  color: rgb(var(--color-accent, 255 128 24));
  text-decoration: underline;
}

/* Tiny floating back pill — top-left, low-contrast, grows label on hover.
   Sits above the iframe via z-index but never inside it (iframes are their
   own stacking context, but we use position:fixed which is fine since the
   iframe doesn't overlap the chrome region). */
.spa-back-pill {
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(15, 18, 24, 0.55);
  color: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.15);
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  letter-spacing: 0.02em;
  cursor: pointer;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  transition: background 180ms ease, transform 180ms ease;
}
.spa-back-pill:hover,
.spa-back-pill:focus-visible {
  background: rgba(15, 18, 24, 0.85);
  outline: none;
  transform: translateY(-1px);
}
.spa-back-label {
  font-weight: 500;
}
@media (max-width: 640px) {
  .spa-back-label { display: none; }
  .spa-back-pill { padding: 8px; }
}
</style>
