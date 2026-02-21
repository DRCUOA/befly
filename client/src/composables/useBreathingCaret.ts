import { onMounted, onBeforeUnmount, nextTick, type Ref } from 'vue'

/**
 * CSS properties mirrored from the input/textarea to the measurement div.
 * Covers font metrics, spacing, and box model for accurate cursor positioning.
 */
const MIRROR_PROPS = [
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
  'letterSpacing', 'textTransform', 'wordSpacing',
  'textIndent', 'lineHeight',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'tabSize', 'direction',
] as const

interface CaretInstance {
  el: HTMLTextAreaElement | HTMLInputElement
  scheduleUpdate: () => void
  destroy: () => void
}

function syncMirrorStyles(
  mirror: HTMLDivElement,
  el: HTMLTextAreaElement | HTMLInputElement,
  isTextarea: boolean,
): void {
  const cs = window.getComputedStyle(el)
  for (const prop of MIRROR_PROPS) {
    ;(mirror.style as any)[prop] = (cs as any)[prop]
  }
  mirror.style.position = 'fixed'
  mirror.style.left = '-9999px'
  mirror.style.top = '-9999px'
  mirror.style.visibility = 'hidden'
  mirror.style.overflow = 'hidden'
  mirror.style.height = 'auto'
  mirror.style.boxSizing = 'border-box'
  mirror.style.width = `${el.offsetWidth}px`

  if (isTextarea) {
    mirror.style.whiteSpace = 'pre-wrap'
    mirror.style.wordWrap = 'break-word'
    mirror.style.overflowWrap = 'break-word'
  } else {
    mirror.style.whiteSpace = 'pre'
  }
}

function measureCaretPosition(
  el: HTMLTextAreaElement | HTMLInputElement,
  position: number,
  mirror: HTMLDivElement,
): { top: number; left: number; height: number } {
  const text = el.value.substring(0, position)

  mirror.textContent = ''
  mirror.appendChild(document.createTextNode(text))

  const marker = document.createElement('span')
  marker.textContent = '\u200b'
  mirror.appendChild(marker)

  const rest = el.value.substring(position)
  if (rest) {
    mirror.appendChild(document.createTextNode(rest))
  }

  const cs = window.getComputedStyle(el)
  const lineHeight =
    parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2

  return {
    top: marker.offsetTop,
    left: marker.offsetLeft,
    height: Math.round(lineHeight),
  }
}

/**
 * Replaces the native blinking caret with a smooth breathing animation
 * (opacity pulse) on the given textarea/input refs. Hides the native caret
 * via caret-color:transparent and overlays a custom div tracked to the
 * cursor position using an off-screen mirror element.
 *
 * Respects prefers-reduced-motion: falls back to a static accent-coloured
 * native caret with no overlay. During IME composition the native caret is
 * temporarily restored so the IME UI renders correctly.
 *
 * Returns { refresh } — call after programmatic value changes that don't
 * fire DOM input events (e.g. v-model updates from outside the element).
 */
export function useBreathingCaret(
  ...refs: Ref<HTMLTextAreaElement | HTMLInputElement | null>[]
): { refresh: () => void } {
  const instances: CaretInstance[] = []
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)')

  function createInstance(
    el: HTMLTextAreaElement | HTMLInputElement,
  ): CaretInstance {
    const isTextarea = el.tagName === 'TEXTAREA'

    const mirror = document.createElement('div')
    mirror.setAttribute('aria-hidden', 'true')
    document.body.appendChild(mirror)
    syncMirrorStyles(mirror, el, isTextarea)

    const caret = document.createElement('div')
    caret.className = 'breathing-caret'
    caret.setAttribute('aria-hidden', 'true')

    const parent = el.parentElement!
    if (getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative'
    }
    parent.appendChild(caret)

    el.style.caretColor = 'transparent'

    let rafId: number | null = null
    let isComposing = false
    let lastPos = -1

    function updatePosition() {
      if (isComposing || document.activeElement !== el) {
        caret.style.display = 'none'
        return
      }

      const pos = el.selectionStart
      const end = el.selectionEnd
      if (pos === null || pos !== end) {
        caret.style.display = 'none'
        return
      }

      mirror.style.width = `${el.offsetWidth}px`
      const coords = measureCaretPosition(el, pos, mirror)

      const visibleTop = coords.top - el.scrollTop
      const visibleLeft = coords.left - (el.scrollLeft || 0)
      if (
        visibleTop < 0 ||
        visibleTop + coords.height > el.clientHeight ||
        visibleLeft < 0 ||
        visibleLeft > el.clientWidth
      ) {
        caret.style.display = 'none'
        return
      }

      const top = el.offsetTop + coords.top - el.scrollTop
      const left = el.offsetLeft + coords.left - (el.scrollLeft || 0)

      caret.style.display = ''
      caret.style.top = `${top}px`
      caret.style.left = `${left}px`
      caret.style.height = `${coords.height}px`

      if (pos !== lastPos) {
        lastPos = pos
        caret.style.animation = 'none'
        void caret.offsetWidth
        caret.style.animation = ''
      }
    }

    function scheduleUpdate() {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        rafId = null
        updatePosition()
      })
    }

    const listeners: [EventTarget, string, EventListener][] = []
    function listen(target: EventTarget, evt: string, fn: EventListener) {
      target.addEventListener(evt, fn)
      listeners.push([target, evt, fn])
    }

    listen(el, 'input', scheduleUpdate)
    listen(el, 'focus', scheduleUpdate)
    listen(el, 'blur', () => {
      caret.style.display = 'none'
    })
    listen(el, 'scroll', scheduleUpdate)
    listen(el, 'mouseup', scheduleUpdate)

    listen(el, 'compositionstart', () => {
      isComposing = true
      caret.style.display = 'none'
      el.style.caretColor = 'var(--color-accent)'
    })
    listen(el, 'compositionend', () => {
      isComposing = false
      el.style.caretColor = 'transparent'
      scheduleUpdate()
    })

    listen(document, 'selectionchange', () => {
      if (document.activeElement === el) scheduleUpdate()
    })

    const ro = new ResizeObserver(() => {
      syncMirrorStyles(mirror, el, isTextarea)
      scheduleUpdate()
    })
    ro.observe(el)

    if (document.activeElement === el) scheduleUpdate()

    function destroy() {
      if (rafId !== null) cancelAnimationFrame(rafId)
      for (const [target, evt, fn] of listeners) {
        target.removeEventListener(evt, fn)
      }
      listeners.length = 0
      ro.disconnect()
      mirror.remove()
      caret.remove()
      el.style.caretColor = ''
    }

    return { el, scheduleUpdate, destroy }
  }

  function setupAll() {
    teardownAll()

    if (mql.matches) {
      for (const r of refs) {
        if (r.value) r.value.style.caretColor = 'var(--color-accent)'
      }
      return
    }

    for (const r of refs) {
      if (r.value) instances.push(createInstance(r.value))
    }
  }

  function teardownAll() {
    for (const inst of instances) inst.destroy()
    instances.length = 0
    for (const r of refs) {
      if (r.value) r.value.style.caretColor = ''
    }
  }

  function refresh() {
    for (const inst of instances) inst.scheduleUpdate()
  }

  const onMotionChange = () => setupAll()
  mql.addEventListener('change', onMotionChange)

  onMounted(() => nextTick(setupAll))
  onBeforeUnmount(() => {
    teardownAll()
    mql.removeEventListener('change', onMotionChange)
  })

  return { refresh }
}
