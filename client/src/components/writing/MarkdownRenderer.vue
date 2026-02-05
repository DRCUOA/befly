<template>
  <div
    class="prose prose-sm max-w-none"
    v-html="renderedMarkdown"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdown } from '../../utils/markdown'

interface Props {
  markdown: string
}

const props = defineProps<Props>()

const renderedMarkdown = computed(() => renderMarkdown(props.markdown))
</script>
