<template>
  <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
    {{ name }}
  </span>
</template>

<script setup lang="ts">
interface Props {
  name: string
}

defineProps<Props>()
</script>
