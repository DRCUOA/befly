<template>
  <div class="min-h-screen bg-paper flex flex-col">
    <!-- Minimal layout for landing page - full width sections -->
    <div class="flex-1">
      <slot />
    </div>
    <AppFooter />
  </div>
</template>

<script setup lang="ts">
import AppFooter from '../components/ui/AppFooter.vue'
</script>
