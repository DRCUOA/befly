<template>
  <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-accent-muted text-accent">
    {{ name }}
  </span>
</template>

<script setup lang="ts">
interface Props {
  name: string
}

defineProps<Props>()
</script>
