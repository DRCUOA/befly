<template>
  <div
    ref="containerRef"
    class="relative overflow-hidden bg-gray-200 select-none"
    :class="[containerClass, editable && 'cursor-grab active:cursor-grabbing']"
    @mousedown="onMouseDown"
  >
    <img
      :src="src"
      alt=""
      class="w-full h-full object-cover pointer-events-none"
      :style="{ objectPosition: positionStyle }"
      draggable="false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

const props = withDefaults(
  defineProps<{
    src: string
    position?: string
    editable?: boolean
    containerClass?: string
  }>(),
  {
    position: '50% 50%',
    editable: true,
    containerClass: 'aspect-square'
  }
)

const emit = defineEmits<{
  (e: 'update:position', value: string): void
}>()

const containerRef = ref<HTMLElement | null>(null)
const positionStyle = ref(props.position)
const isDragging = ref(false)
let startX = 0
let startY = 0
let startPosX = 50
let startPosY = 50

function parsePosition(pos: string): [number, number] {
  const parts = pos.trim().split(/\s+/)
  const x = parseFloat(parts[0] || '50')
  const y = parseFloat(parts[1] ?? parts[0] ?? '50')
  return [isNaN(x) ? 50 : x, isNaN(y) ? 50 : y]
}

function formatPosition(x: number, y: number): string {
  return `${Math.round(x)}% ${Math.round(y)}%`
}

function onMouseDown(e: MouseEvent) {
  if (!props.editable || !containerRef.value) return
  e.preventDefault()
  const [x, y] = parsePosition(positionStyle.value)
  startPosX = x
  startPosY = y
  startX = e.clientX
  startY = e.clientY
  isDragging.value = true
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e: MouseEvent) {
  if (!containerRef.value || !isDragging.value) return
  const rect = containerRef.value.getBoundingClientRect()
  const deltaX = e.clientX - startX
  const deltaY = e.clientY - startY
  const deltaXPercent = (deltaX / rect.width) * 100
  const deltaYPercent = (deltaY / rect.height) * 100
  let newX = startPosX - deltaXPercent
  let newY = startPosY - deltaYPercent
  newX = Math.max(0, Math.min(100, newX))
  newY = Math.max(0, Math.min(100, newY))
  const newPos = formatPosition(newX, newY)
  positionStyle.value = newPos
  emit('update:position', newPos)
}

function onMouseUp() {
  isDragging.value = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}

// Sync when prop changes externally
watch(() => props.position, (p) => {
  if (!isDragging.value) {
    positionStyle.value = p
  }
})

onMounted(() => {
  positionStyle.value = props.position
})
</script>
