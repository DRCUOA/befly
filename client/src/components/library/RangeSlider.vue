<template>
  <div class="range-slider">
    <div class="flex items-baseline justify-between mb-1">
      <label :for="id" class="text-xs uppercase tracking-widest text-ink-lighter">
        {{ label }}
      </label>
      <span class="text-sm font-medium tabular-nums text-ink">{{ value }}</span>
    </div>
    <input
      :id="id"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="value"
      @input="onInput"
      @wheel.prevent="onWheel"
      class="w-full range-input"
    />
    <div v-if="lowLabel || highLabel" class="flex justify-between text-[10px] uppercase tracking-widest text-ink-lighter mt-1">
      <span>{{ lowLabel }}</span>
      <span>{{ highLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Single-knob 0-100 slider. Backed by a native <input type="range"> so
 * touch and keyboard work out of the box; a wheel handler lets a mouse
 * user nudge by 1 with the scroll wheel. The thumb is sized for finger
 * use on iPad/Android.
 */
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: number
  label: string
  min?: number
  max?: number
  step?: number
  lowLabel?: string
  highLabel?: string
}>(), {
  min: 0,
  max: 100,
  step: 1,
  lowLabel: '',
  highLabel: '',
})

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const id = computed(() => `range-${Math.random().toString(36).slice(2, 9)}`)
const value = computed(() => clamp(Math.round(props.modelValue), props.min, props.max))

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function onInput(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  emit('update:modelValue', clamp(Math.round(v), props.min, props.max))
}

/** Mouse wheel: one notch = one step. Up increases, down decreases. */
function onWheel(e: WheelEvent) {
  const delta = e.deltaY > 0 ? -props.step : props.step
  emit('update:modelValue', clamp(value.value + delta, props.min, props.max))
}
</script>

<style scoped>
.range-input {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  cursor: pointer;
  touch-action: pan-y;
}

/* Track */
.range-input::-webkit-slider-runnable-track {
  height: 4px;
  background: var(--color-line, #d6d3d1);
  border-radius: 2px;
}
.range-input::-moz-range-track {
  height: 4px;
  background: var(--color-line, #d6d3d1);
  border-radius: 2px;
}

/* Thumb — sized for finger use on touch screens */
.range-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  height: 22px;
  width: 22px;
  background: var(--color-ink, #1c1917);
  border: 2px solid var(--color-paper, #fafaf9);
  border-radius: 50%;
  margin-top: -9px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}
.range-input::-moz-range-thumb {
  height: 22px;
  width: 22px;
  background: var(--color-ink, #1c1917);
  border: 2px solid var(--color-paper, #fafaf9);
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.range-input:focus {
  outline: none;
}
.range-input:focus::-webkit-slider-thumb {
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.15);
}
.range-input:focus::-moz-range-thumb {
  box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.15);
}
</style>
