<template>
  <div class="p-4 sm:p-6 max-w-4xl mx-auto">
    <h1 class="text-2xl font-bold mb-4">Editor Performance Baseline Test</h1>
    <p class="text-gray-600 mb-6 text-sm">
      Measures typing latency for the Vue textarea (same pattern as Write.vue). Record baseline before any editor changes.
      <a href="/write" class="text-blue-600 hover:underline">← Back to Write</a>
    </p>

    <div class="space-y-6">
      <section class="border rounded-lg p-4 bg-gray-50">
        <h2 class="font-semibold mb-2">1. Load document</h2>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="s in sizes"
            :key="s.key"
            type="button"
            :disabled="measuring"
            class="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
            @click="loadDocument(s)"
          >
            {{ s.name }} ({{ s.label }})
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded border border-gray-300 text-sm hover:bg-gray-100"
            @click="clearDocument"
          >
            Clear
          </button>
        </div>
      </section>

      <section class="border rounded-lg p-4">
        <h2 class="font-semibold mb-2">2. Editor (Vue v-model, same as Write)</h2>
        <textarea
          id="editor"
          ref="editorRef"
          v-model="body"
          rows="12"
          class="w-full font-mono text-sm border rounded p-3"
          placeholder="Load a document and type to measure latency..."
          @input="onInput"
        />
        <div class="mt-2 text-sm text-gray-600">
          {{ docStats.charCount.toLocaleString() }} chars ·
          {{ docStats.wordCount.toLocaleString() }} words ·
          {{ docStats.sizeKB }} KB
        </div>
      </section>

      <section class="border rounded-lg p-4 bg-gray-50">
        <h2 class="font-semibold mb-2">3. Measured latency</h2>
        <p class="text-sm text-gray-600 mb-2">
          Input → Vue update → next frame. Good: &lt;16ms (60fps). Poor: &gt;50ms.
        </p>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div><span class="text-gray-500">Inputs:</span> {{ metrics.inputCount }}</div>
          <div><span class="text-gray-500">Avg:</span> {{ metrics.avgMs }}</div>
          <div><span class="text-gray-500">Max:</span> {{ metrics.maxMs }}</div>
          <div><span class="text-gray-500">P95:</span> {{ metrics.p95Ms }}</div>
          <div><span class="text-gray-500">P99:</span> {{ metrics.p99Ms }}</div>
          <div><span class="text-gray-500">&gt;16ms:</span> {{ metrics.slowPercent }}</div>
          <div><span class="text-gray-500">&gt;50ms:</span> {{ metrics.verySlowPercent }}</div>
        </div>
      </section>

      <section class="border rounded-lg p-4">
        <h2 class="font-semibold mb-2">4. Undo/Redo test (programmatic change)</h2>
        <p class="text-sm text-gray-600 mb-2">
          Apply programmatic change, then Ctrl+Z. Document the behavior.
        </p>
        <div class="flex gap-2">
          <button
            type="button"
            class="px-3 py-1.5 rounded bg-amber-600 text-white text-sm hover:bg-amber-700"
            @click="applyProgrammaticChange"
          >
            Replace "the" → "THE"
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded border border-gray-300 text-sm hover:bg-gray-100"
            @click="insertProgrammatic"
          >
            Insert at cursor
          </button>
        </div>
      </section>

      <section class="border rounded-lg p-4 bg-gray-50">
        <h2 class="font-semibold mb-2">5. Export report</h2>
        <p class="text-sm text-gray-600 mb-2">
          Export measured data + documented constraints and risks.
        </p>
        <div class="flex gap-2">
          <button
            type="button"
            class="px-3 py-1.5 rounded bg-green-600 text-white text-sm hover:bg-green-700"
            @click="exportJSON"
          >
            Export JSON
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded border border-gray-300 text-sm hover:bg-gray-100"
            @click="exportHTML"
          >
            Export HTML report
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'

const sizes = [
  { key: 'small', name: 'Small', bytes: 1024, label: '1KB' },
  { key: 'medium', name: 'Medium', bytes: 10240, label: '10KB' },
  { key: 'large', name: 'Large', bytes: 102400, label: '100KB' },
  { key: 'xlarge', name: 'X-Large', bytes: 512000, label: '500KB' }
]

const body = ref('')
const editorRef = ref<HTMLTextAreaElement | null>(null)
const measuring = ref(false)
const latencies = ref<number[]>([])

function lorem(size: number): string {
  const words = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur Excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum'.split(' ')
  let t = ''
  while (new Blob([t]).size < size) {
    t += words[Math.floor(Math.random() * words.length)] + ' '
    if (Math.random() > 0.92) t += '\n\n'
  }
  return t.trim()
}

function loadDocument(s: { bytes: number; name: string }) {
  body.value = lorem(s.bytes)
  latencies.value = []
  measuring.value = true
}

function clearDocument() {
  body.value = ''
  latencies.value = []
  measuring.value = false
}

function onInput() {
  const t0 = performance.now()
  nextTick(() => {
    requestAnimationFrame(() => {
      const latency = performance.now() - t0
      latencies.value = [...latencies.value, latency]
    })
  })
}

const docStats = computed(() => {
  const text = body.value
  const chars = text.length
  const words = text.trim().split(/\s+/).filter(Boolean).length
  const bytes = new Blob([text]).size
  return {
    charCount: chars,
    wordCount: words,
    sizeBytes: bytes,
    sizeKB: (bytes / 1024).toFixed(2)
  }
})

const metrics = computed(() => {
  const arr = latencies.value
  if (arr.length === 0) {
    return {
      inputCount: 0,
      avgMs: '—',
      maxMs: '—',
      p95Ms: '—',
      p99Ms: '—',
      slowPercent: '—',
      verySlowPercent: '—'
    }
  }
  const sorted = [...arr].sort((a, b) => a - b)
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0
  const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0
  const slow = arr.filter((l) => l > 16).length
  const verySlow = arr.filter((l) => l > 50).length
  return {
    inputCount: arr.length,
    avgMs: avg.toFixed(2) + 'ms',
    maxMs: (Math.max(...arr)).toFixed(2) + 'ms',
    p95Ms: p95.toFixed(2) + 'ms',
    p99Ms: p99.toFixed(2) + 'ms',
    slowPercent: `${slow} (${((slow / arr.length) * 100).toFixed(1)}%)`,
    verySlowPercent: `${verySlow} (${((verySlow / arr.length) * 100).toFixed(1)}%)`
  }
})

function applyProgrammaticChange() {
  body.value = body.value.replace(/the/gi, 'THE')
  alert('Replaced "the" with "THE". Try Ctrl+Z and document what happens.')
}

function insertProgrammatic() {
  const el = editorRef.value
  if (!el) return
  const pos = el.selectionStart
  const text = body.value
  body.value = text.slice(0, pos) + '[INSERTED] ' + text.slice(pos)
  el.selectionStart = el.selectionEnd = pos + '[INSERTED] '.length
  alert('Inserted at cursor. Try Ctrl+Z and document what happens.')
}

function buildReport() {
  const arr = latencies.value
  const sorted = [...arr].sort((a, b) => a - b)
  const avg = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0
  const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0
  const slowPct = arr.length ? (arr.filter((l) => l > 16).length / arr.length) * 100 : 0
  const verySlowPct = arr.length ? (arr.filter((l) => l > 50).length / arr.length) * 100 : 0

  const dbConstraints = {
    fieldType: 'TEXT',
    theoreticalMaxSize: '1 GB (PostgreSQL TEXT limit)',
    practicalMaxSize: '10-100 MB (recommended for performance)',
    titleConstraint: 'VARCHAR(500)',
    concerns: [
      'No explicit size limit enforced in application layer',
      'Very large documents may cause memory issues during save/load',
      'Database backup and replication may be impacted by large BLOBs',
      'API response times will degrade with large payloads'
    ]
  }

  const dataLossRisks = {
    noAutosave: { risk: 'HIGH', impact: 'Complete loss of work since last manual save', scenarios: ['Browser crash', 'Tab close', 'Power loss', 'Navigate away'] },
    noDraftPersistence: { risk: 'HIGH', impact: 'No recovery mechanism available', scenarios: ['No recovery after crash', 'No version history'] },
    networkFailures: { risk: 'MEDIUM', impact: 'User may believe work is saved when it is not', scenarios: ['Save fails silently', 'Poor error handling'] }
  }

  const recommendations = [
    { priority: 'CRITICAL', item: 'Implement localStorage-based autosave (every 30-60 seconds)', reason: 'Prevent data loss on crash or navigation' },
    { priority: 'HIGH', item: 'Add draft persistence with recovery mechanism', reason: 'Allow recovery after interruptions' },
    { priority: 'HIGH', item: 'Implement "unsaved changes" warning on navigation', reason: 'Prevent accidental data loss' },
    { priority: 'MEDIUM', item: 'Add soft size limit warning at 100KB', reason: 'Warn before performance degradation' }
  ]

  return {
    timestamp: new Date().toISOString(),
    source: 'measured',
    testEnvironment: {
      userAgent: navigator.userAgent,
      platform: navigator.platform
    },
    documentSize: docStats.value.sizeBytes,
    characteristics: {
      characterCount: docStats.value.charCount,
      wordCount: docStats.value.wordCount,
      sizeBytes: docStats.value.sizeBytes,
      sizeKB: docStats.value.sizeKB
    },
    measuredLatency: {
      inputCount: arr.length,
      avgMs: Math.round(avg * 100) / 100,
      maxMs: arr.length ? Math.max(...arr) : 0,
      p95Ms: Math.round(p95 * 100) / 100,
      p99Ms: Math.round(p99 * 100) / 100,
      slowEventsPercent: Math.round(slowPct * 10) / 10,
      verySlowEventsPercent: Math.round(verySlowPct * 10) / 10
    },
    databaseConstraints: dbConstraints,
    dataLossRisks,
    recommendations,
    undoRedoNote: 'Document behavior after programmatic change + Ctrl+Z (browser-dependent)'
  }
}

function exportJSON() {
  const report = buildReport()
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `performance-baseline-results-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function exportHTML() {
  const report = buildReport()
  const data = JSON.stringify(report).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Editor Performance Baseline Report</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem}
    h1{font-size:1.25rem}h2{font-size:1rem;margin-top:1.5rem;color:#1e40af}
    table{width:100%;border-collapse:collapse;font-size:0.9rem}
    th,td{padding:0.5rem;text-align:left;border-bottom:1px solid #e5e7eb}
    .muted{color:#6b7280}.good{color:#059669}.warn{color:#d97706}.bad{color:#dc2626}
  </style>
</head>
<body>
  <h1>Editor Performance Baseline Report</h1>
  <p class="muted">Source: measured · ${report.timestamp}</p>
  <h2>Measured latency</h2>
  <table>
    <tr><th>Inputs</th><td>${report.measuredLatency.inputCount}</td></tr>
    <tr><th>Avg</th><td>${report.measuredLatency.avgMs}ms</td></tr>
    <tr><th>Max</th><td>${report.measuredLatency.maxMs}ms</td></tr>
    <tr><th>P95</th><td>${report.measuredLatency.p95Ms}ms</td></tr>
    <tr><th>P99</th><td>${report.measuredLatency.p99Ms}ms</td></tr>
    <tr><th>&gt;16ms</th><td>${report.measuredLatency.slowEventsPercent}%</td></tr>
    <tr><th>&gt;50ms</th><td>${report.measuredLatency.verySlowEventsPercent}%</td></tr>
  </table>
  <h2>Document</h2>
  <p>${report.characteristics.characterCount.toLocaleString()} chars · ${report.characteristics.wordCount.toLocaleString()} words · ${report.characteristics.sizeKB} KB</p>
  <h2>Data loss risks</h2>
  <ul>
    <li><strong>No autosave:</strong> ${report.dataLossRisks.noAutosave.risk} — ${report.dataLossRisks.noAutosave.impact}</li>
    <li><strong>No draft persistence:</strong> ${report.dataLossRisks.noDraftPersistence.risk} — ${report.dataLossRisks.noDraftPersistence.impact}</li>
  </ul>
  <h2>Recommendations</h2>
  <ul>${report.recommendations.map((r) => `<li>${r.priority}: ${r.item}</li>`).join('')}</ul>
  <script>
    (function(){var d=${data};console.log('Report data:',d);})();
  <\/script>
</body>
</html>`
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `performance-baseline-report-${Date.now()}.html`
  a.click()
  URL.revokeObjectURL(url)
}
</script>
