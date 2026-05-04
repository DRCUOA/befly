<template>
  <div class="plot-causality-page">
    <ManuscriptHeader
      v-if="manuscript"
      :manuscript-id="manuscript.id"
      :manuscript-title="manuscript.title"
      eyebrow="Plot Causality"
      :subtitle="beats.length === 0 ? 'No beats yet — add some on the Polyphonic view, or import the seed.' : `${beats.length} beats · ${causalLinks.length} causal links`"
    >
      <template #actions>
        <button
          v-if="canModify"
          type="button"
          @click="addBeat"
          class="px-4 py-2 text-sm tracking-wide font-sans bg-ink text-paper hover:bg-ink-light transition-colors"
        >
          + Beat
        </button>
        <button
          type="button"
          @click="showIronyRibbon = !showIronyRibbon"
          class="px-3 py-2 text-sm tracking-wide font-sans border border-line transition-colors"
          :class="showIronyRibbon ? 'border-ink text-ink' : 'border-line text-ink-light hover:text-ink'"
        >
          {{ showIronyRibbon ? '✓ ' : '' }}Irony spine
        </button>
      </template>
    </ManuscriptHeader>

    <ManuscriptSubNav v-if="manuscript" :manuscript-id="manuscript.id" />

    <div class="w-full px-4 sm:px-6 md:px-8 py-8 bg-paper min-h-screen">
      <div class="max-w-7xl mx-auto">
        <p v-if="loading" class="text-center text-ink-light py-16">Loading plot causality…</p>

        <div v-else-if="!manuscript" class="text-center py-16 text-ink-light">Manuscript not found.</div>

        <div v-else-if="beats.length === 0" class="text-center py-16 max-w-xl mx-auto">
          <h2 class="text-xl font-light tracking-tight mb-2">No beats yet.</h2>
          <p class="text-sm text-ink-light mb-6">
            A beat is one planned scene. Plot causality reveals the because/therefore
            chain that turns events into consequences.
          </p>
          <button
            v-if="canModify"
            type="button"
            @click="addBeat"
            class="px-4 py-2 text-sm tracking-wide font-sans bg-ink text-paper hover:bg-ink-light transition-colors"
          >
            + Add the first beat
          </button>
        </div>

        <template v-else>
          <!-- Causality gut-check banner -->
          <div v-if="andThenCount > 0" class="mb-6 p-3 border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/30">
            <p class="text-sm text-ink">
              <strong>Causality gut-check:</strong>
              {{ andThenCount }} of your {{ adjacencyCount }} adjacent beat pairs are connected only by "and then" — that's chronology, not causality.
              Consider tightening to <em>because</em> / <em>therefore</em> / <em>but because</em>.
            </p>
          </div>

          <!-- Dramatic-irony ribbon -->
          <section v-if="showIronyRibbon" class="mb-8 p-4 border border-line bg-paper">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-xs uppercase tracking-widest text-ink-lighter font-sans">Dramatic-irony spine</h3>
              <p class="text-xs text-ink-lighter italic">Reader knowledge vs. average character knowledge across beats</p>
            </div>
            <svg :width="ironySvg.width" :height="ironySvg.height" class="w-full h-auto">
              <!-- baseline -->
              <line :x1="0" :y1="ironySvg.height - 16" :x2="ironySvg.width" :y2="ironySvg.height - 16" stroke="#ddd" />
              <!-- character knowledge area -->
              <polyline
                :points="ironySvg.charPath"
                fill="none"
                stroke="#888"
                stroke-width="1.5"
                stroke-dasharray="4,4"
              />
              <!-- reader knowledge area -->
              <polyline
                :points="ironySvg.readerPath"
                fill="none"
                stroke="#000"
                stroke-width="2"
              />
              <!-- gap shading -->
              <polygon
                :points="ironySvg.gapPath"
                fill="rgba(0,0,0,0.06)"
              />
            </svg>
            <div class="flex items-center gap-4 mt-2 text-xs text-ink-lighter">
              <span class="inline-flex items-center gap-1"><span class="w-3 h-0.5 bg-black inline-block" /> Reader</span>
              <span class="inline-flex items-center gap-1"><span class="w-3 h-0 border-t border-dashed border-gray-500 inline-block" /> Avg. character</span>
              <span class="italic">Wider gap = sharper irony</span>
            </div>
          </section>

          <!-- Beat sequence with causal links -->
          <div class="space-y-4">
            <div
              v-for="(b, idx) in sortedBeats"
              :key="b.id"
              class="relative"
            >
              <!-- Beat card -->
              <article
                class="border bg-paper transition-colors cursor-pointer group hover:border-ink"
                :class="getBeatBorderClass(b)"
                @click="openBeat(b)"
              >
                <header class="px-5 py-3 border-b border-line flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-baseline gap-2">
                      <span v-if="b.label" class="text-xs uppercase tracking-widest text-ink-lighter font-sans">{{ b.label }}</span>
                      <span v-if="getPov(b)" class="inline-flex items-center gap-1 text-xs">
                        <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: getPovColor(b) }" />
                        {{ getPov(b) }}
                      </span>
                      <span v-if="b.timelinePoint" class="text-xs text-ink-lighter italic">· {{ b.timelinePoint }}</span>
                      <span v-for="badge in beatBadges(b)" :key="badge" class="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded">{{ badge }}</span>
                    </div>
                    <h3 class="text-base font-light text-ink mt-1">{{ b.title || '(untitled beat)' }}</h3>
                    <p v-if="b.outerEvent" class="text-sm text-ink-light mt-0.5 line-clamp-2">{{ b.outerEvent }}</p>
                  </div>
                </header>
              </article>

              <!-- Causal arrow to next beat -->
              <div
                v-if="idx < sortedBeats.length - 1"
                class="flex items-center gap-2 px-5 py-2"
                @click.stop
              >
                <span class="text-ink-lighter text-xl leading-none">↓</span>
                <select
                  v-if="canModify"
                  :value="getLinkType(b.id, sortedBeats[idx + 1].id)"
                  @change="onLinkTypeChange(b.id, sortedBeats[idx + 1].id, ($event.target as HTMLSelectElement).value)"
                  class="text-xs rounded border-line bg-paper text-ink-light focus:border-ink focus:ring-ink"
                >
                  <option value="">— no link —</option>
                  <option value="because">because</option>
                  <option value="therefore">therefore</option>
                  <option value="but_because">but because</option>
                  <option value="until">until</option>
                  <option value="and_then">and then (chronology only)</option>
                  <option value="reversal">↺ reversal</option>
                  <option value="recognition">! recognition</option>
                  <option value="crisis_choice">⚖ crisis choice</option>
                  <option value="climax">★ climax</option>
                  <option value="plant">✿ plant</option>
                  <option value="payoff">↑ payoff</option>
                </select>
                <span v-else class="text-xs text-ink-light italic">{{ formatLinkType(getLinkType(b.id, sortedBeats[idx + 1].id)) || '— no causal link —' }}</span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <BeatDetailPanel
      :open="!!detailBeat"
      :beat="detailBeat"
      :characters="characters"
      :beat-knowledge="beatKnowledge"
      :can-modify="canModify"
      @close="detailBeat = null"
      @save="onSaveBeat"
      @delete="onDeleteBeat"
      @save-knowledge="onSaveKnowledge"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { manuscriptsApi } from '../api/manuscripts'
import { storyCraftApi } from '../api/storycraft'
import { useAuth } from '../stores/auth'
import ManuscriptHeader from '../components/storycraft/ManuscriptHeader.vue'
import ManuscriptSubNav from '../components/storycraft/ManuscriptSubNav.vue'
import BeatDetailPanel from '../components/storycraft/BeatDetailPanel.vue'
import type { ManuscriptProject } from '@shared/Manuscript'
import type {
  Character,
  Beat,
  BeatKnowledge,
  CausalLink,
  CausalLinkType,
  KnowledgeKind,
} from '@shared/StoryCraft'

const route = useRoute()
const { user, isAdmin } = useAuth()

const loading = ref(true)
const manuscript = ref<ManuscriptProject | null>(null)
const characters = ref<Character[]>([])
const beats = ref<Beat[]>([])
const beatKnowledge = ref<BeatKnowledge[]>([])
const causalLinks = ref<CausalLink[]>([])

const detailBeat = ref<Beat | null>(null)
const showIronyRibbon = ref(true)

const canModify = computed(() => {
  if (!manuscript.value || !user.value) return false
  return manuscript.value.userId === user.value.id || isAdmin.value
})

const sortedBeats = computed(() =>
  [...beats.value].sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt))
)

const characterById = computed(() => {
  const m = new Map<string, Character>()
  for (const c of characters.value) m.set(c.id, c)
  return m
})

function getPov(b: Beat): string | null {
  return b.povCharacterId ? characterById.value.get(b.povCharacterId)?.name ?? null : null
}
function getPovColor(b: Beat): string {
  return (b.povCharacterId && characterById.value.get(b.povCharacterId)?.color) || '#999'
}

const ANDTHEN_TYPE: CausalLinkType = 'and_then'
const adjacencyCount = computed(() => Math.max(0, sortedBeats.value.length - 1))
const andThenCount = computed(() => {
  const links = sortedBeats.value
    .slice(0, -1)
    .map((b, i) => getLinkType(b.id, sortedBeats.value[i + 1].id))
  return links.filter(t => t === ANDTHEN_TYPE).length
})

function getLinkType(fromId: string, toId: string): CausalLinkType | '' {
  // Pick the most "primary" link type if multiple exist (because/therefore/until/etc).
  const found = causalLinks.value.find(l => l.fromBeatId === fromId && l.toBeatId === toId)
  return (found?.linkType as CausalLinkType | undefined) ?? ''
}

const REVERSAL_KINDS = new Set<CausalLinkType>(['reversal','recognition','crisis_choice','climax'])

function beatBadges(b: Beat): string[] {
  const badges: string[] = []
  // Look at incoming or outgoing reversal/recognition links
  const has = (kind: CausalLinkType) =>
    causalLinks.value.some(l =>
      (l.fromBeatId === b.id || l.toBeatId === b.id) && l.linkType === kind
    )
  if (has('reversal')) badges.push('↺ reversal')
  if (has('recognition')) badges.push('! recognition')
  if (has('crisis_choice')) badges.push('⚖ crisis')
  if (has('climax')) badges.push('★ climax')
  return badges
}

function getBeatBorderClass(b: Beat): string {
  if (REVERSAL_KINDS.size === 0) return 'border-line'
  const isPivot = causalLinks.value.some(l =>
    (l.fromBeatId === b.id || l.toBeatId === b.id) && REVERSAL_KINDS.has(l.linkType)
  )
  return isPivot ? 'border-amber-500 border-2' : 'border-line'
}

/* Irony ribbon: a quick-and-dirty knowledge density per beat. We count distinct
 * knowledge entries for the reader and average across characters at each beat. */
const ironySvg = computed(() => {
  const beatsArr = sortedBeats.value
  const W = Math.max(beatsArr.length * 60, 600)
  const H = 100
  if (beatsArr.length === 0) return { width: W, height: H, charPath: '', readerPath: '', gapPath: '' }

  const readerCounts = beatsArr.map(b =>
    beatKnowledge.value.filter(k => k.beatId === b.id && k.characterId === null && k.knowledgeKind === 'known').length
  )
  // Cumulative reader knowledge — once revealed, the reader keeps knowing.
  const cumReader: number[] = []
  let acc = 0
  for (const r of readerCounts) { acc += r; cumReader.push(acc) }

  const charCounts = beatsArr.map(b => {
    const perChar = characters.value.map(c =>
      beatKnowledge.value.filter(k => k.beatId === b.id && k.characterId === c.id && k.knowledgeKind === 'known').length
    )
    return perChar.length === 0 ? 0 : perChar.reduce((s, n) => s + n, 0) / perChar.length
  })
  const cumChar: number[] = []
  acc = 0
  for (const c of charCounts) { acc += c; cumChar.push(acc) }

  const max = Math.max(1, ...cumReader, ...cumChar)
  const xStep = W / Math.max(1, beatsArr.length - 1 || 1)
  const yMax = H - 16

  const toPoint = (v: number, i: number) => `${i * xStep},${yMax - (v / max) * yMax}`
  const readerPoints = cumReader.map((v, i) => toPoint(v, i))
  const charPoints = cumChar.map((v, i) => toPoint(v, i))

  const gapPolygon = [
    ...readerPoints,
    ...[...charPoints].reverse(),
  ].join(' ')

  return {
    width: W,
    height: H,
    readerPath: readerPoints.join(' '),
    charPath: charPoints.join(' '),
    gapPath: gapPolygon,
  }
})

function formatLinkType(t: string): string {
  if (!t) return ''
  return t.replace(/_/g, ' ')
}

async function loadAll() {
  const id = route.params.id as string
  if (!id) return
  loading.value = true
  try {
    const [m, bundle] = await Promise.all([
      manuscriptsApi.get(id),
      storyCraftApi.getBundle(id),
    ])
    manuscript.value = m
    characters.value = bundle.characters
    beats.value = bundle.beats
    beatKnowledge.value = bundle.beatKnowledge
    causalLinks.value = bundle.causalLinks
  } catch (err) {
    console.error('Failed to load plot view:', err)
    manuscript.value = null
  } finally {
    loading.value = false
  }
}

async function addBeat() {
  if (!manuscript.value) return
  const title = window.prompt('Beat title (or short description)', 'New beat')
  if (!title || !title.trim()) return
  try {
    const created = await storyCraftApi.createBeat(manuscript.value.id, { title: title.trim() })
    beats.value.push(created)
    detailBeat.value = created
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to add beat')
  }
}

function openBeat(b: Beat) {
  detailBeat.value = b
}

async function onSaveBeat(updates: Partial<Beat>) {
  if (!detailBeat.value) return
  try {
    const updated = await storyCraftApi.updateBeat(detailBeat.value.id, updates)
    const idx = beats.value.findIndex(b => b.id === updated.id)
    if (idx >= 0) beats.value[idx] = updated
    detailBeat.value = updated
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to save beat')
  }
}

async function onDeleteBeat(beatId: string) {
  if (!confirm('Delete this beat? Knowledge entries and causal links touching it will be removed.')) return
  try {
    await storyCraftApi.deleteBeat(beatId)
    beats.value = beats.value.filter(b => b.id !== beatId)
    causalLinks.value = causalLinks.value.filter(l => l.fromBeatId !== beatId && l.toBeatId !== beatId)
    beatKnowledge.value = beatKnowledge.value.filter(k => k.beatId !== beatId)
    if (detailBeat.value?.id === beatId) detailBeat.value = null
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to delete beat')
  }
}

async function onSaveKnowledge(payload: { beatId: string; characterId: string | null; knowledgeKind: KnowledgeKind; text: string | null }) {
  try {
    const result = await storyCraftApi.setBeatKnowledge(payload.beatId, payload)
    // Locally remove any existing entry for this (beat, character, kind) and append the new one.
    beatKnowledge.value = beatKnowledge.value.filter(k =>
      !(k.beatId === payload.beatId &&
        (k.characterId ?? null) === payload.characterId &&
        k.knowledgeKind === payload.knowledgeKind)
    )
    if (result) beatKnowledge.value.push(result)
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to save knowledge')
  }
}

async function onLinkTypeChange(fromId: string, toId: string, raw: string) {
  if (!manuscript.value) return
  // Remove any existing link, then create the new one (or leave deleted).
  const existing = causalLinks.value.find(l => l.fromBeatId === fromId && l.toBeatId === toId)
  try {
    if (existing) {
      await storyCraftApi.deleteCausalLink(existing.id)
      causalLinks.value = causalLinks.value.filter(l => l.id !== existing.id)
    }
    if (raw) {
      const link = await storyCraftApi.createCausalLink(manuscript.value.id, {
        fromBeatId: fromId,
        toBeatId: toId,
        linkType: raw as CausalLinkType,
      })
      causalLinks.value.push(link)
    }
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to update causal link')
  }
}

onMounted(loadAll)
watch(() => route.params.id, loadAll)
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
