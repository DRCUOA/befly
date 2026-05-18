/**
 * Tiny audio-feedback helper for the rapid-scan flow.
 *
 * Sounds are synthesised inline with the Web Audio API so we don't ship
 * an audio asset and don't pay a network round-trip on the first beep.
 *
 * The browser blocks AudioContext creation until a user gesture has
 * happened on the page, so we lazily create it inside the play
 * functions — they will only ever be called from inside an event
 * handler triggered by a user action (scanner button, scan event).
 */

let ctx: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (ctx) {
    // Some browsers suspend the context if it sits idle; resume on demand.
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  }
  const Ctor = window.AudioContext ?? (window as any).webkitAudioContext
  if (!Ctor) return null
  try {
    ctx = new Ctor()
    return ctx
  } catch {
    return null
  }
}

interface ToneStep {
  /** Frequency in Hz. */
  freq: number
  /** Duration in seconds. */
  dur: number
  /** Peak gain (0..1). Defaults to 0.18 — comfortable on speakers and headphones. */
  gain?: number
}

/**
 * Play a sequence of pure-sine tones with a short attack/release envelope
 * so they don't click. Steps run back-to-back.
 */
function playTones(steps: ToneStep[]): void {
  const c = getContext()
  if (!c) return

  let t = c.currentTime
  for (const step of steps) {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(step.freq, t)

    const peak = step.gain ?? 0.18
    const attack = Math.min(0.012, step.dur / 4)
    const release = Math.min(0.04, step.dur / 2)

    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(peak, t + attack)
    gain.gain.setValueAtTime(peak, t + step.dur - release)
    gain.gain.linearRampToValueAtTime(0, t + step.dur)

    osc.connect(gain).connect(c.destination)
    osc.start(t)
    osc.stop(t + step.dur)

    t += step.dur
  }
}

/** Ascending two-tone "ding" — book found and added. */
export function playSuccess(): void {
  playTones([
    { freq: 659.25, dur: 0.09 }, // E5
    { freq: 987.77, dur: 0.14 }, // B5
  ])
}

/** Descending two-tone "bonk" — book not found or duplicate. */
export function playFailure(): void {
  playTones([
    { freq: 246.94, dur: 0.10, gain: 0.22 }, // B3
    { freq: 174.61, dur: 0.16, gain: 0.22 }, // F3
  ])
}

/**
 * Touch the audio context so the first real beep doesn't carry the
 * one-off cost of creating it. Safe to call from any user gesture.
 */
export function primeAudio(): void {
  getContext()
}
