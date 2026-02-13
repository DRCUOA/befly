<template>
  <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
    <div class="bg-paper rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
      <div class="px-6 py-4 border-b border-line">
        <h3 class="text-lg font-sans font-medium text-ink">Crop cover image</h3>
        <p class="text-sm text-ink-lighter mt-1">
          Adjust the crop area. The result will be saved at 512×512 for sharp display at any size.
        </p>
      </div>
      <div class="flex-1 min-h-0 p-4 overflow-hidden">
        <Cropper
          ref="cropperRef"
          class="cropper h-[min(60vh,400px)] bg-[#E5E5E5] rounded"
          :src="imageSrc"
          :stencil-props="{ aspectRatio: 1 }"
          :canvas="canvasOptions"
          @ready="onReady"
          @error="onError"
        />
      </div>
      <div v-if="cropError" class="px-6 py-2 text-sm text-red-600">{{ cropError }}</div>
      <div class="px-6 py-4 border-t border-line flex justify-end gap-3">
        <button
          type="button"
          class="px-4 py-2 border border-line rounded-md text-ink-lighter hover:text-ink font-sans text-sm"
          @click="$emit('cancel')"
        >
          Cancel
        </button>
        <button
          type="button"
          class="px-4 py-2 bg-ink text-paper rounded-md hover:bg-ink-light font-sans text-sm disabled:opacity-50"
          :disabled="cropping"
          @click="applyCrop"
        >
          {{ cropping ? 'Saving…' : 'Apply crop' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { api } from '../../api/client'
import { Cropper } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'

const props = defineProps<{
  imageUrl: string
}>()

const emit = defineEmits<{
  (e: 'cropped', newUrl: string): void
  (e: 'cancel'): void
}>()

const cropperRef = ref<InstanceType<typeof Cropper> | null>(null)
const cropping = ref(false)
const cropError = ref<string | null>(null)

// Output at 512×512 for high-resolution display at any size
const canvasOptions = { height: 512, width: 512 }

// Use image URL as-is; for /uploads/ paths it's same-origin
const imageSrc = computed(() => props.imageUrl)

function onReady() {
  cropError.value = null
}

function onError() {
  cropError.value = 'Failed to load image'
}

async function applyCrop() {
  const cropper = cropperRef.value
  if (!cropper || cropping.value) return

  try {
    cropping.value = true
    cropError.value = null
    const { canvas } = cropper.getResult()
    if (!canvas) {
      cropError.value = 'No image to crop'
      return
    }

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.92)
    })
    if (!blob) {
      cropError.value = 'Failed to create image'
      return
    }

    const formData = new FormData()
    formData.append('file', blob, 'cover.jpg')
    const data = await api.postFormData<{ data: { path: string } }>('/writing/upload', formData)
    const path = data?.data?.path
    if (!path) throw new Error('No path in response')
    emit('cropped', path)
  } catch (err) {
    cropError.value = err instanceof Error ? err.message : 'Crop failed'
  } finally {
    cropping.value = false
  }
}
</script>
