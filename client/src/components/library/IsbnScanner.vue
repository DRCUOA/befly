<template>
  <div class="isbn-scanner">
    <div class="bg-paper border border-line p-4 sm:p-6">
      <div class="flex items-center justify-between mb-4">
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

      <p class="text-sm text-ink-light mb-4">
        Point the back cover&rsquo;s barcode at the camera. We&rsquo;ll catch
        the ISBN and pull in the rest from Google Books / Open Library.
      </p>

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
        <div
          v-if="scanning && !lastCode"
          class="absolute bottom-2 left-2 right-2 text-center text-xs text-white/80 font-sans tracking-wide"
        >
          Looking for a barcode&hellip;
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
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'

const emit = defineEmits<{
  detected: [isbn: string]
  close: []
}>()

const videoEl = ref<HTMLVideoElement | null>(null)
const devices = ref<MediaDeviceInfo[]>([])
const selectedDeviceId = ref<string | null>(null)
const cameraError = ref<string | null>(null)
const scanning = ref(false)
const lastCode = ref<string | null>(null)
const manualIsbn = ref('')

let reader: BrowserMultiFormatReader | null = null
let controls: IScannerControls | null = null

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

  try {
    // Prefer the chosen device. If we don't have one (permission not yet
    // granted), fall back to a constraint that asks the browser for the
    // back-facing camera — works on iOS Safari and Android Chrome.
    const constraints: MediaStreamConstraints = selectedDeviceId.value
      ? { video: { deviceId: { exact: selectedDeviceId.value } } }
      : { video: { facingMode: { ideal: 'environment' } } }

    controls = await reader.decodeFromConstraints(
      constraints,
      videoEl.value,
      (result, err) => {
        if (result) {
          const text = result.getText().replace(/[^0-9Xx]/g, '')
          // ISBN-13 barcodes are EAN-13 starting with 978 or 979. ISBN-10
          // is uncommon on modern back covers but we accept anyway.
          if (text.length === 13 || text.length === 10) {
            if (text !== lastCode.value) {
              lastCode.value = text
              emit('detected', text)
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
  emit('detected', digits)
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
</style>
