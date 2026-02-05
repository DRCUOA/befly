<template>
  <button
    @click="handleClick"
    class="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium"
    :class="isAppreciated ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'"
  >
    {{ isAppreciated ? '✓ Appreciated' : 'Appreciate' }}
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  writingId: string
  initialAppreciated?: boolean
}

const props = defineProps<Props>()
const isAppreciated = ref(props.initialAppreciated || false)

function handleClick() {
  isAppreciated.value = !isAppreciated.value
  // TODO: Call API to toggle appreciation
}
</script>
