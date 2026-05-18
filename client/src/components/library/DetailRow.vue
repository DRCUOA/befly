<template>
  <div>
    <dt class="text-[10px] uppercase tracking-widest text-ink-lighter mb-0.5">{{ label }}</dt>
    <dd
      :class="[
        'text-ink break-words',
        mono ? 'font-mono text-xs' : 'text-sm font-light',
      ]"
    >{{ value }}</dd>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  value: string
  mono?: boolean
}>()
</script>
