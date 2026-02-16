<template>
  <div
    ref="panelRef"
    role="dialog"
    aria-label="Metadata settings"
    aria-modal="true"
    :aria-hidden="!modelValue"
    class="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-paper border-l border-line shadow-xl flex flex-col transform transition-transform duration-150 ease-out"
    :class="modelValue ? 'translate-x-0' : 'translate-x-full'"
    tabindex="-1"
    @keydown.escape="close"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-line shrink-0">
      <h2 class="text-lg font-sans font-medium text-ink">Metadata</h2>
      <button
        type="button"
        class="p-2 -m-2 text-ink-lighter hover:text-ink rounded focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
        aria-label="Close metadata panel"
        @click="close"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-6">
      <!-- Cover image -->
      <div>
        <label class="block text-sm font-medium text-ink-lighter mb-1">
          Cover image (optional)
        </label>
        <div class="flex items-center gap-3 flex-wrap">
          <div v-if="form.coverImageUrl" class="w-32 h-32 rounded overflow-hidden border border-line flex-shrink-0">
            <DraggableCoverImage
              :src="form.coverImageUrl"
              v-model:position="form.coverImagePosition"
              editable
              container-class="w-full h-full"
            />
          </div>
          <input
            ref="coverFileInputRef"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            class="hidden"
            @change="$emit('cover-file-select', $event)"
          />
          <button
            type="button"
            class="px-3 py-1.5 text-sm rounded border border-line text-ink hover:bg-line font-sans"
            @click="coverFileInputRef?.click()"
          >
            Upload image
          </button>
          <button
            v-if="form.coverImageUrl"
            type="button"
            class="px-3 py-1.5 text-sm rounded border border-line text-ink hover:bg-line font-sans"
            @click="$emit('open-crop')"
          >
            Crop
          </button>
          <button
            v-if="form.coverImageUrl"
            type="button"
            class="px-3 py-1.5 text-sm rounded border border-line text-ink-lighter hover:bg-line font-sans"
            @click="form.coverImageUrl = ''"
          >
            Clear
          </button>
        </div>
        <p class="mt-1 text-xs sm:text-sm text-ink-lighter">
          Upload an image for the essay card thumbnail. Crop for best framing, or drag to reposition when larger than frame. JPEG, PNG, GIF, WebP up to 5MB.
        </p>
      </div>

      <!-- Visibility -->
      <div>
        <label class="block text-sm font-medium text-ink-lighter mb-1">
          Visibility
        </label>
        <select
          v-model="form.visibility"
          class="mt-1 block w-full rounded-md border-line shadow-sm focus:border-accent focus:ring-accent text-base sm:text-sm bg-paper"
          aria-label="Choose who can see this writing block"
        >
          <option value="private">Private (only you can see)</option>
          <option value="shared">Shared (others can see but not edit)</option>
          <option value="public">Public (everyone can see)</option>
        </select>
        <p class="mt-1 text-xs sm:text-sm text-ink-lighter">
          Choose who can see this writing block
        </p>
      </div>

      <!-- Themes -->
      <div>
        <label class="block text-sm font-medium text-ink-lighter mb-2">
          Themes (optional)
        </label>
        <div v-if="loadingThemes || loadingWriting" class="text-xs sm:text-sm text-ink-lighter">
          {{ loadingWriting ? 'Loading writing...' : 'Loading themes...' }}
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="theme in availableThemes"
            :key="theme.id"
            class="flex items-center"
          >
            <input
              :id="`theme-${theme.id}`"
              v-model="form.themeIds"
              type="checkbox"
              :value="theme.id"
              class="h-4 w-4 text-accent focus:ring-accent border-line rounded"
              :aria-label="`Assign theme: ${theme.name}`"
            />
            <label
              :for="`theme-${theme.id}`"
              class="ml-2 text-sm text-ink font-sans"
            >
              {{ theme.name }}
            </label>
          </div>
          <p v-if="availableThemes.length === 0" class="text-xs sm:text-sm text-ink-lighter">
            No themes available. Create themes on the Themes page.
          </p>
        </div>
      </div>

      <!-- Error -->
      <div v-if="error" class="bg-accent-muted border border-line rounded-md p-3 sm:p-4">
        <p class="text-ink text-xs sm:text-sm">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import DraggableCoverImage from './DraggableCoverImage.vue'
import type { Theme } from '../../domain/Theme'

const props = defineProps<{
  modelValue: boolean
  form: {
    coverImageUrl: string
    coverImagePosition: string
    visibility: 'private' | 'shared' | 'public'
    themeIds: string[]
  }
  availableThemes: Theme[]
  loadingThemes: boolean
  loadingWriting: boolean
  error?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'cover-file-select': [event: Event]
  'open-crop': []
}>()

const panelRef = ref<HTMLElement | null>(null)
const coverFileInputRef = ref<HTMLInputElement | null>(null)

function close() {
  emit('update:modelValue', false)
}

// Focus panel when opened for keyboard accessibility
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen && panelRef.value) {
      requestAnimationFrame(() => {
        panelRef.value?.focus()
      })
    }
  }
)
</script>
