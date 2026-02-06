<template>
  <component :is="layout">
    <router-view />
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DefaultLayout from './layouts/DefaultLayout.vue'
import MinimalLayout from './layouts/MinimalLayout.vue'
import PassThroughLayout from './layouts/PassThroughLayout.vue'

const route = useRoute()

const layout = computed(() => {
  // Reading pages handle their own layout (ReadingLayout is included in Read.vue)
  if (route.name === 'Read') {
    return PassThroughLayout
  }
  // Use minimal layout for landing page to allow full-width sections
  if (route.name === 'Landing') {
    return MinimalLayout
  }
  return DefaultLayout
})
</script>
