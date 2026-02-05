<template>
  <button
    @click="handleClick"
    :disabled="loading"
    class="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    :class="isAppreciated ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
  >
    <span v-if="loading">...</span>
    <span v-else>
      {{ isAppreciated ? '✓ Appreciated' : 'Appreciate' }}
      <span v-if="count > 0" class="ml-1">({{ count }})</span>
    </span>
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { api } from '../../api/client'

interface Props {
  writingId: string
  initialCount?: number
  isAppreciated?: boolean
}

const props = defineProps<Props>()

const isAppreciated = ref(props.isAppreciated || false)
const count = ref(props.initialCount || 0)
const loading = ref(false)

const emit = defineEmits<{
  appreciated: []
  unappreciated: []
}>()

const handleClick = async () => {
  if (loading.value) return

  try {
    loading.value = true
    
    if (isAppreciated.value) {
      await api.delete(`/appreciations/writing/${props.writingId}`)
      isAppreciated.value = false
      count.value = Math.max(0, count.value - 1)
      emit('unappreciated')
    } else {
      await api.post(`/appreciations/writing/${props.writingId}`)
      isAppreciated.value = true
      count.value += 1
      emit('appreciated')
    }
  } catch (err) {
    console.error('Failed to toggle appreciation:', err)
    // Revert on error
    isAppreciated.value = !isAppreciated.value
  } finally {
    loading.value = false
  }
}
</script>
