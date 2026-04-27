<template>
  <!--
    In local dev (import.meta.env.DEV) we render a "tools" icon so it's
    obvious at a glance that you're looking at a development build rather
    than the live site. In any other environment the production logo image
    is rendered.
  -->
  <svg
    v-if="isDev"
    :class="['app-logo-dev', sizeClass]"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-label="Local development build"
    role="img"
  >
    <!-- Heroicons-style "wrench & screwdriver" tools icon -->
    <path d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" />
  </svg>
  <img
    v-else
    :src="logoUrl"
    :class="sizeClass"
    alt=""
  />
</template>

<script setup lang="ts">
import logoUrl from '../../assets/logo2.png'

interface Props {
  /**
   * Tailwind sizing classes (e.g. "h-8 w-8 sm:h-9 sm:w-9").
   * Applied to both the dev SVG and the production <img> so the swap is
   * pixel-stable.
   */
  sizeClass?: string
}

withDefaults(defineProps<Props>(), {
  sizeClass: 'h-8 w-8',
})

// Vite exposes import.meta.env.DEV at build time; this is `true` only when
// running `vite` (dev server) and `false` for production builds.
const isDev = import.meta.env.DEV
</script>

<style scoped>
.app-logo-dev {
  /* Use a distinct accent color so the dev marker is unmistakable. */
  color: #d97706; /* amber-600 — visible on the paper background */
}
</style>
