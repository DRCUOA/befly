<template>
  <div class="isbn-scanner">
    <div class="bg-paper border border-line p-4 sm:p-6">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-light tracking-tight">Scan an ISBN</h3>
        <button
          @click="emit('close')"
          class="text-ink-lighter hover:text-ink p-1"
          aria-label="Close scanner"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Mode line -->
      <div class="flex items-center justify-between gap-3 mb-3">
        <p class="text-sm text-ink-light leading-snug">
          <template v-if="rapidMode">
            Point the camera at a barcode &mdash; we&rsquo;ll add each book straight to your library.
          </template>
          <template v-else>
            Point the back cover&rsquo;s barcode at the camera. We&rsquo;ll catch the ISBN and pull in the rest.
          </template>
        </p>
        <label class="flex items-center gap-2 cursor-pointer shrink-0 select-none">
          <span class="text-[10px] uppercase tracking-widest text-ink-lighter">Rapid</span>
          <button
            type="button"
            role="switch"
            :aria-checked="rapidMode"
            @click="rapidMode = !rapidMode"
            class="toggle"
            :class="rapidMode ? 'toggle-on' : ''"
          >
            <span class="toggle-knob" />
          </button>
        </label>
      </div>

      <!-- Live camera viewport -->
      <div
        v-show="!cameraError"
        class="scanner-viewport relative bg-black overflow-hidden mb-3"
      >
        <video
          ref="videoEl"
          class="w-full h-full object-cover"
          playsinline
          muted
          autoplay
        ></video>
        <!-- Reticle to help the user line up the barcode -->
        <div class="scanner-reticle" aria-hidden="true"></div>

        <!-- Per-scan result overlay (rapid mode) -->
        <transition name="fade">
          <div
            v-if="lastResult"
            class="absolute top-2 left-2 right-2 mx-auto max-w-md px-3 py-2 text-sm font-sans tracking-wide flex items-center gap-2"
            :class="lastResult.ok
              ? 'bg-emerald-600/90 text-white'
              : 'bg-red-600/90 text-white'"
          >
            <svg v-if="lastResult.ok" class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
            </svg>
            <svg v-else class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v3m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="truncate">{{ lastResult.label }}</span>
          </div>
        </transition>

        <div
          v-if="scanning && !lastCode && !lastResult"
          class="absolute bottom-2 left-2 right-2 text-center text-xs text-white/80 font-sans tracking-wide"
        >
          Looking for a barcode&hellip;
        </div>

        <!-- Mini tally for rapid runs -->
        <div
          v-if="rapidMode && (tally.added > 0 || tally.failed > 0)"
          class="absolute bottom-2 left-2 text-[10px] uppercase tracking-widest text-white/90 bg-black/40 px-2 py-1"
        >
          Added {{ tally.added }} &middot; Skipped {{ tally.failed }}
        </div>
      </div>

      <div
        v-if="cameraError"
        class="bg-red-50 border border-red-200 text-red-800 text-sm p-3 mb-3"
      >
        {{ cameraError }}
      </div>

      <!-- Device picker (multi-camera devices like iPad / Macbook) -->
      <div v-if="devices.length > 1" class="mb-3">
        <label class="block text-xs uppercase tracking-widest text-ink-lighter mb-1">Camera</label>
        <select
          v-model="selectedDeviceId"
          @change="restart"
          class="w-full px-3 py-2 border border-line bg-paper text-ink text-sm"
        >
          <option v-for="d in devices" :key="d.deviceId" :value="d.deviceId">
            {{ d.label || `Camera ${devices.indexOf(d) + 1}` }}
          </option>
        </select>
      </div>

      <!-- Manual fallback -->
      <form @submit.prevent="submitManual" class="flex gap-2">
        <input
          v-model="manualIsbn"
          type="text"
          inputmode="numeric"
          placeholder="Or type an ISBN (10 or 13 digits)"
          class="flex-1 px-3 py-2 border border-line bg-paper text-ink text-sm placeholder:text-ink-lighter"
        />
        <button
          type="submit"
          class="px-4 py-2 bg-ink text-paper text-sm tracking-wide font-sans hover:bg-ink-light transition-colors"
        >
          Use
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { primeAudio } from '../../utils/notificationSound'

export interface ScanDetectedPayload {
  isbn: string
  durationMs: number
  scanner: 'zxing' | 'manual'
  format?: string
  /** True when the user opted into auto-save-and-continue. */
  rapid: boolean
}

export interface ScanResult {
  ok: boolean
  /** Short message shown in the in-camera overlay. */
  label: string
}

const props = withDefaults(defineProps<{
  /** v-model. When true, parent auto-saves and calls `acceptNextScan(result)`
   *  after each scan so we keep the camera running. */
  rapidMode?: boolean
}>(), {
  rapidMode: false,
})

const emit = defineEmits<{
  detected: [payload: ScanDetectedPayload]
  close: []
  'update:rapidMode': [value: boolean]
}>()

const startedAt = Date.now()

const videoEl = ref<HTMLVideoElement | null>(null)
const devices = ref<MediaDeviceInfo[]>([])
const selectedDeviceId = ref<string | null>(null)
const cameraError = ref<string | null>(null)
const scanning = ref(false)
const lastCode = ref<string | null>(null)
const manualIsbn = ref('')

const lastResult = ref<ScanResult | null>(null)
const tally = reactive({ added: 0, failed: 0 })

const rapidMode = computed<boolean>({
  get: () => props.rapidMode,
  set: (v: boolean) => emit('update:rapidMode', v),
})

let reader: BrowserMultiFormatReader | null = null
let controls: IScannerControls | null = null
let resultClearTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Parent calls this via `defineExpose` after each rapid-scan attempt
 * resolves, so the next different barcode can fire. We deliberately do
 * NOT clear if the same code is still in view — the user must move the
 * book away to scan it again.
 */
function acceptNextScan(result: ScanResult): void {
  lastResult.value = result
  if (result.ok) tally.added++
  else tally.failed++

  // Free the "same-code debounce" so a different book can fire next.
  lastCode.value = null

  if (resultClearTimer) clearTimeout(resultClearTimer)
  resultClearTimer = setTimeout(() => {
    lastResult.value = null
  }, 2200)
}

defineExpose({ acceptNextScan })

function buildReader(): BrowserMultiFormatReader {
  // Constrain decoding to the 1D book/product formats. Cuts CPU
  // significantly on iPad/Android vs. the all-formats default.
  const hints = new Map<DecodeHintType, unknown>()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
  ])
  hints.set(DecodeHintType.TRY_HARDER, true)
  return new BrowserMultiFormatReader(hints)
}

async function listCameras() {
  try {
    const all = await BrowserMultiFormatReader.listVideoInputDevices()
    devices.value = all
    if (!selectedDeviceId.value && all.length > 0) {
      // Prefer a back-facing camera if the label hints at one (iPad / Android).
      const back = all.find(d => /back|rear|environment/i.test(d.label))
      selectedDeviceId.value = (back ?? all[0]).deviceId
    }
  } catch {
    // Some browsers won't expose device labels until permission is granted.
    devices.value = []
  }
}

async function start() {
  if (!videoEl.value) return
  cameraError.value = null
  scanning.value = true
  lastCode.value = null
  reader = buildReader()

  // Prime the audio context off the user gesture that opened the scanner.
  primeAudio()

  try {
    const constraints: MediaStreamConstraints = selectedDeviceId.value
      ? { video: { deviceId: { exact: selectedDeviceId.value } } }
      : { video: { facingMode: { ideal: 'environment' } } }

    controls = await reader.decodeFromConstraints(
      constraints,
      videoEl.value,
      (result, err) => {
        if (result) {
          const text = result.getText().replace(/[^0-9Xx]/g, '')
          if (text.length === 13 || text.length === 10) {
            if (text !== lastCode.value) {
              lastCode.value = text
              emit('detected', {
                isbn: text,
                durationMs: Date.now() - startedAt,
                scanner: 'zxing',
                format: result.getBarcodeFormat ? String(result.getBarcodeFormat()) : undefined,
                rapid: rapidMode.value,
              })
            }
          }
        }
        // err on every non-match frame — ignore, that's how the loop works.
        void err
      }
    )

    // Once the stream is live, re-enumerate so we get real device labels.
    if (devices.value.length === 0 || !devices.value[0].label) {
      await listCameras()
    }
  } catch (err: any) {
    scanning.value = false
    if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
      cameraError.value = 'Camera permission denied. Allow camera access or type the ISBN below.'
    } else if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
      cameraError.value = 'No usable camera was found. You can type the ISBN below.'
    } else if (err?.name === 'NotReadableError') {
      cameraError.value = 'Camera is in use by another app. Close it and try again.'
    } else {
      cameraError.value = err?.message || 'Could not start the camera. Type the ISBN below.'
    }
  }
}

function stop() {
  scanning.value = false
  try {
    controls?.stop()
  } catch {
    // ignore
  }
  controls = null
  reader = null
  if (resultClearTimer) {
    clearTimeout(resultClearTimer)
    resultClearTimer = null
  }
}

async function restart() {
  stop()
  await nextTick()
  await start()
}

function submitManual() {
  const digits = manualIsbn.value.replace(/[^0-9Xx]/g, '')
  if (digits.length !== 10 && digits.length !== 13) {
    cameraError.value = 'ISBN must be 10 or 13 digits.'
    return
  }
  emit('detected', {
    isbn: digits,
    durationMs: Date.now() - startedAt,
    scanner: 'manual',
    rapid: rapidMode.value,
  })
  manualIsbn.value = ''
}

onMounted(async () => {
  await listCameras()
  await start()
})

onBeforeUnmount(() => {
  stop()
})
</script>

<style scoped>
.scanner-viewport {
  aspect-ratio: 4 / 3;
  max-height: 60vh;
}
.scanner-reticle {
  position: absolute;
  inset: 20% 10%;
  border: 2px solid rgba(255, 255, 255, 0.7);
  border-radius: 4px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.25);
  pointer-events: none;
}
.toggle {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
  border-radius: 999px;
  background: #d6d3d1;
  transition: background-color 0.2s;
}
.toggle-on {
  background: var(--color-ink, #1c1917);
}
.toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
}
.toggle-on .toggle-knob {
  transform: translateX(16px);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
