<template>
  <div class="polyphonic-map-page">
    <ManuscriptHeader
      v-if="manuscript"
      :manuscript-id="manuscript.id"
      :manuscript-title="manuscript.title"
      eyebrow="Polyphonic Map"
      :subtitle="`${characters.length} voices · ${beats.length} beats`"
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
      </template>
    </ManuscriptHeader>

    <ManuscriptSubNav v-if="manuscript" :manuscript-id="manuscript.id" />

    <!-- Filter bar -->
    <div v-if="manuscript && characters.length > 0" class="border-b border-line bg-surface/40 px-4 sm:px-6 md:px-8 py-3">
      <div class="max-w-7xl mx-auto flex flex-wrap items-center gap-3">
        <span class="text-xs uppercase tracking-widest text-ink-lighter font-sans">Filters</span>
        <button
          v-for="f in (['knowledge','motifs','silences','irony'] as const)"
          :key="f"
          type="button"
          @click="filter = filter === f ? null : f"
          class="px-3 py-1 text-xs font-sans border transition-colors"
          :class="filter === f ? 'border-ink bg-ink text-paper' : 'border-line text-ink-light hover:text-ink'"
        >
          {{ f === 'knowledge' ? 'Knowledge' : f === 'motifs' ? 'Motifs' : f === 'silences' ? 'Silences' : 'Irony gap' }}
        </button>
        <span class="text-xs italic text-ink-lighter ml-2">Click a beat column to inspect & edit. Click a cell to write what that voice knows.</span>
      </div>
    </div>

    <div class="w-full px-4 sm:px-6 md:px-8 py-6 bg-paper min-h-screen">
      <div class="max-w-7xl mx-auto">
        <p v-if="loading" class="text-center text-ink-light py-16">Loading polyphonic map…</p>

        <div v-else-if="!manuscript" class="text-center py-16 text-ink-light">Manuscript not found.</div>

        <div v-else-if="characters.length === 0" class="text-center py-16 max-w-xl mx-auto">
          <h2 class="text-xl font-light tracking-tight mb-2">No characters yet.</h2>
          <p class="text-sm text-ink-light mb-6">
            The polyphonic map needs voices. Add characters in the Character Studio first.
          </p>
          <router-link
            v-if="manuscript"
            :to="`/manuscripts/${manuscript.id}/characters`"
            class="inline-block px-4 py-2 text-sm tracking-wide font-sans bg-ink text-paper hover:bg-ink-light"
          >
            Open Character Studio
          </router-link>
        </div>

        <div v-else-if="beats.length === 0" class="text-center py-16 max-w-xl mx-auto">
          <h2 class="text-xl font-light tracking-tight mb-2">No beats yet.</h2>
          <p class="text-sm text-ink-light mb-6">
            Add beats — planned scenes — to see the knowledge ledger across voices.
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

        <div v-else class="overflow-x-auto -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8">
          <table class="border-collapse text-xs">
            <thead>
              <tr>
                <th class="sticky left-0 z-10 bg-paper text-left p-2 border border-line w-32 min-w-[8rem]">
                  <span class="text-[10px] uppercase tracking-widest text-ink-lighter">Voice ↓ Beat →</span>
                </th>
                <th
                  v-for="b in sortedBeats"
                  :key="b.id"
                  class="p-2 border border-line bg-surface/30 text-left align-bottom min-w-[12rem] cursor-pointer hover:bg-surface"
                  @click="openBeat(b)"
                >
                  <div class="space-y-1">
                    <div class="flex items-center gap-2">
                      <span v-if="b.label" class="text-[10px] uppercase tracking-widest text-ink-lighter font-sans">{{ b.label }}</span>
                      <span v-if="getPov(b)" class="inline-flex items-center gap-1">
                        <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: getPovColor(b) }" />
                        <span class="text-[10px] text-ink-light">{{ getPov(b) }}</span>
                      </span>
                      <span
                        v-if="rotationWarning(b)"
                        class="text-amber-600 text-[10px]"
                        :title="rotationWarning(b) || ''"
                      >●</span>
                    </div>
                    <p class="text-xs text-ink leading-tight">{{ b.title || '(untitled)' }}</p>
                    <p v-if="b.timelinePoint" class="text-[10px] italic text-ink-lighter">{{ b.timelinePoint }}</p>
                  </div>
                </th>
                <th class="p-2 border border-dashed border-line text-left align-bottom min-w-[8rem]">
                  <button v-if="canModify" type="button" @click="addBeat" class="text-xs text-ink-lighter hover:text-ink">+ Beat</button>
                </th>
              </tr>
            </thead>
            <tbody>
              <!-- Reader row -->
              <tr class="bg-surface/20">
                <th class="sticky left-0 bg-surface/20 z-10 text-left p-2 border border-line">
                  <div class="flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full bg-ink" />
                    <span class="text-sm font-medium text-ink">Reader</span>
                  </div>
                  <p class="text-[10px] italic text-ink-lighter">dramatic-irony spine</p>
                </th>
                <td
                  v-for="b in sortedBeats"
                  :key="`reader-${b.id}`"
                  class="p-1 border border-line align-top cursor-pointer hover:bg-surface"
                  :class="cellHighlight(b, null)"
                  @click="openBeatAndFocusReader(b)"
                >
                  <CellSummary
                    :entries="entriesFor(b.id, null)"
                    :motif-count="filter === 'motifs' ? motifCountAt(b) : 0"
                    :silence-count="filter === 'silences' ? silenceCountAt(b, null) : 0"
                  />
                </td>
                <td class="border border-dashed border-line"></td>
              </tr>
              <!-- Character rows -->
              <tr v-for="c in sortedCharacters" :key="c.id">
                <th class="sticky left-0 bg-paper z-10 text-left p-2 border border-line">
                  <div class="flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: c.color || '#999' }" />
                    <span class="text-sm font-medium text-ink">{{ c.name }}</span>
                  </div>
                  <p v-if="c.contradiction" class="text-[10px] italic text-ink-lighter line-clamp-2">{{ c.contradiction }}</p>
                </th>
                <td
                  v-for="b in sortedBeats"
                  :key="`${c.id}-${b.id}`"
                  class="p-1 border border-line align-top cursor-pointer hover:bg-surface"
                  :class="[cellHighlight(b, c.id), b.povCharacterId === c.id ? 'ring-2 ring-inset ring-ink' : '']"
                  @click="openBeatAndFocusCharacter(b, c)"
                >
                  <CellSummary
                    :entries="entriesFor(b.id, c.id)"
                    :motif-count="filter === 'motifs' ? motifCountForCharacter(b, c.id) : 0"
                    :silence-count="filter === 'silences' ? silenceCountAt(b, c.id) : 0"
                  />
                </td>
                <td class="border border-dashed border-line"></td>
              </tr>
            </tbody>
          </table>

          <p class="text-xs text-ink-lighter italic mt-4">
            POV cells (outlined) belong to the beat's POV character.
            Amber dot on a beat header means the next-POV looks like mechanical rotation — ask why <em>this</em> voice now.
          </p>
        </div>
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
import { ref, computed, onMounted, watch, h } from 'vue'
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
  BeatMotif,
  Motif,
  Silence,
  KnowledgeKind,
} from '@shared/StoryCraft'

const route = useRoute()
const { user, isAdmin } = useAuth()

const loading = ref(true)
const manuscript = ref<ManuscriptProject | null>(null)
const characters = ref<Character[]>([])
const beats = ref<Beat[]>([])
const beatKnowledge = ref<BeatKnowledge[]>([])
const motifs = ref<Motif[]>([])
const beatMotifs = ref<BeatMotif[]>([])
const silences = ref<Silence[]>([])

const detailBeat = ref<Beat | null>(null)
const filter = ref<'knowledge' | 'motifs' | 'silences' | 'irony' | null>('knowledge')

const canModify = computed(() => {
  if (!manuscript.value || !user.value) return false
  return manuscript.value.userId === user.value.id || isAdmin.value
})

const sortedCharacters = computed(() =>
  [...characters.value].sort((a, b) => a.orderIndex - b.orderIndex || a.name.localeCompare(b.name))
)

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

/* Mechanical-rotation guard.
 * If 3 beats in a row alternate between exactly 2 POVs (A/B/A) and the
 * `reasonForNextPovSwitch` field is empty on the previous beat, flag.
 * Heuristic only — gentle warning, not a block. */
function rotationWarning(beat: Beat): string | null {
  const idx = sortedBeats.value.findIndex(b => b.id === beat.id)
  if (idx < 2) return null
  const a = sortedBeats.value[idx - 2]
  const b = sortedBeats.value[idx - 1]
  if (!a.povCharacterId || !b.povCharacterId || !beat.povCharacterId) return null
  if (a.povCharacterId === beat.povCharacterId && b.povCharacterId !== beat.povCharacterId) {
    if (!b.reasonForNextPovSwitch || !b.reasonForNextPovSwitch.trim()) {
      return 'Looks like A/B/A rotation. Why this voice here? (set "reason for next POV switch" on the previous beat to silence)'
    }
  }
  return null
}

function entriesFor(beatId: string, characterId: string | null): { kind: KnowledgeKind; text: string }[] {
  return beatKnowledge.value
    .filter(k => k.beatId === beatId && (k.characterId ?? null) === characterId)
    .map(k => ({ kind: k.knowledgeKind, text: k.text }))
}

function motifCountAt(b: Beat): number {
  return beatMotifs.value.filter(m => m.beatId === b.id).length
}
function motifCountForCharacter(_b: Beat, _characterId: string): number {
  // We don't have per-character motif variants per beat (only per-character overall),
  // so this is the same as motifCountAt right now. Left as a placeholder so the
  // filter can later include per-voice variant differentiation.
  return motifCountAt(_b)
}
function silenceCountAt(b: Beat, characterId: string | null): number {
  return silences.value.filter(s =>
    s.beatId === b.id &&
    (characterId === null ? s.characterId === null : s.characterId === characterId)
  ).length
}

/* Cell highlight by filter mode.
 * - knowledge: subtle bg if any entry exists.
 * - irony: highlight cells where the reader knows but the character doesn't.
 * - silences/motifs: highlight where there's a silence/motif entry.
 */
function cellHighlight(b: Beat, characterId: string | null): string {
  if (filter.value === 'knowledge') {
    return entriesFor(b.id, characterId).length > 0 ? 'bg-stone-50 dark:bg-stone-900/40' : ''
  }
  if (filter.value === 'irony') {
    if (characterId === null) {
      // reader cell highlighted bright if it knows something
      return entriesFor(b.id, null).some(e => e.kind === 'known') ? 'bg-amber-50' : ''
    } else {
      // character cell highlighted if reader knows AND character does not
      const readerKnows = entriesFor(b.id, null).some(e => e.kind === 'known')
      const charKnows = entriesFor(b.id, characterId).some(e => e.kind === 'known')
      return readerKnows && !charKnows ? 'bg-amber-50' : ''
    }
  }
  if (filter.value === 'motifs') {
    return motifCountAt(b) > 0 ? 'bg-emerald-50' : ''
  }
  if (filter.value === 'silences') {
    return silenceCountAt(b, characterId) > 0 ? 'bg-violet-50' : ''
  }
  return ''
}

function openBeat(b: Beat) {
  detailBeat.value = b
}
function openBeatAndFocusReader(b: Beat) {
  detailBeat.value = b
}
function openBeatAndFocusCharacter(b: Beat, _c: Character) {
  detailBeat.value = b
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
    motifs.value = bundle.motifs
    beatMotifs.value = bundle.beatMotifs
    silences.value = bundle.silences
  } catch (err) {
    console.error('Failed to load polyphonic map:', err)
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
  if (!confirm('Delete this beat?')) return
  try {
    await storyCraftApi.deleteBeat(beatId)
    beats.value = beats.value.filter(b => b.id !== beatId)
    beatKnowledge.value = beatKnowledge.value.filter(k => k.beatId !== beatId)
    if (detailBeat.value?.id === beatId) detailBeat.value = null
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to delete beat')
  }
}

async function onSaveKnowledge(payload: { beatId: string; characterId: string | null; knowledgeKind: KnowledgeKind; text: string | null }) {
  try {
    const result = await storyCraftApi.setBeatKnowledge(payload.beatId, payload)
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

/* Inline cell summary component — shows up to 3 entries with kind glyph + text. */
const CellSummary = (props: { entries: { kind: KnowledgeKind; text: string }[]; motifCount: number; silenceCount: number }) => {
  const glyph: Record<KnowledgeKind, string> = {
    known: '●',
    suspected: '◐',
    misread: '✗',
    hidden: '◯',
    silent: '—',
  }
  if (props.entries.length === 0 && props.motifCount === 0 && props.silenceCount === 0) {
    return h('span', { class: 'text-ink-lighter text-[10px] italic' }, '·')
  }
  const items = props.entries.slice(0, 3).map((e, i) =>
    h('div', { key: i, class: 'flex items-start gap-1 leading-tight' }, [
      h('span', { class: 'text-[10px] text-ink-lighter shrink-0' }, glyph[e.kind] ?? '·'),
      h('span', { class: 'text-[10px] text-ink line-clamp-2' }, e.text),
    ])
  )
  if (props.entries.length > 3) {
    items.push(h('span', { class: 'text-[10px] italic text-ink-lighter' }, `+${props.entries.length - 3} more`))
  }
  if (props.motifCount > 0) items.push(h('span', { class: 'text-[10px] text-emerald-700' }, `${props.motifCount} motif${props.motifCount > 1 ? 's' : ''}`))
  if (props.silenceCount > 0) items.push(h('span', { class: 'text-[10px] text-violet-700' }, `${props.silenceCount} silence${props.silenceCount > 1 ? 's' : ''}`))
  return h('div', { class: 'space-y-0.5' }, items)
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
