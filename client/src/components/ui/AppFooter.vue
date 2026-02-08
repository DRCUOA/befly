<template>
  <footer class="w-full border-t border-line bg-paper py-4 px-4 sm:px-6 md:px-8">
    <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0">
      <div class="text-xs sm:text-sm text-ink-lighter font-sans">
        Copyrighted Material 2026 All rights reserved
      </div>
      <div class="text-xs sm:text-sm text-ink-lighter font-sans">
        Build Nbr: {{ buildNumber }}
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { APP_VERSION } from '../../config/version'

const buildNumber = APP_VERSION.startsWith('0') ? APP_VERSION : `0${APP_VERSION}`
</script>
