<template>
  <div class="bg-white rounded-lg shadow p-6">
    <h2 class="text-xl font-semibold mb-2">{{ title }}</h2>
    <p class="text-gray-600 mb-4">{{ preview }}</p>
    <div class="flex items-center justify-between">
      <div class="flex space-x-2">
        <span
          v-for="theme in themes"
          :key="theme"
          class="px-2 py-1 text-xs bg-gray-100 rounded"
        >
          {{ theme }}
        </span>
      </div>
      <span class="text-sm text-gray-500">{{ date }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title: string
  preview: string
  themes: string[]
  date: string
}

defineProps<Props>()
</script>
