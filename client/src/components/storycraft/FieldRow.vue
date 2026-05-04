<template>
  <label class="block">
    <span class="block text-xs uppercase tracking-widest text-ink-lighter font-sans mb-1">
      {{ label }}
      <span v-if="required" class="text-red-600">*</span>
    </span>
    <slot />
    <span v-if="hint" class="block text-xs italic text-ink-lighter mt-1">{{ hint }}</span>
  </label>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  hint?: string
  required?: boolean
}>()
</script>
