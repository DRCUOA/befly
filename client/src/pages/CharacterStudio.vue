<template>
  <div class="character-studio-page">
    <ManuscriptHeader
      v-if="manuscript"
      :manuscript-id="manuscript.id"
      :manuscript-title="manuscript.title"
      eyebrow="Character Studio"
      :subtitle="characterCountLabel"
    >
      <template #actions>
        <button
          v-if="canModify"
          type="button"
          @click="addCharacter"
          class="px-4 py-2 text-sm tracking-wide font-sans bg-ink text-paper hover:bg-ink-light transition-colors"
        >
          + Character
        </button>
        <button
          v-if="canModify && characters.length === 0"
          type="button"
          :disabled="seeding"
          @click="importStCormacsSeed"
          class="px-4 py-2 text-sm tracking-wide font-sans border border-line text-ink-light hover:text-ink hover:border-ink-lighter transition-colors disabled:opacity-50"
          title="Bootstrap with the St Cormac's character / motif / beat material."
        >
          {{ seeding ? 'Importing…' : "Import St Cormac's seed" }}
        </button>
      </template>
    </ManuscriptHeader>

    <ManuscriptSubNav v-if="manuscript" :manuscript-id="manuscript.id" />

    <div class="w-full px-4 sm:px-6 md:px-8 py-8 bg-paper min-h-screen">
      <div class="max-w-7xl mx-auto">
        <p v-if="loading" class="text-center text-ink-light py-16">Loading character studio…</p>

        <div v-else-if="!manuscript" class="text-center py-16 text-ink-light">
          Manuscript not found.
        </div>

        <div v-else-if="characters.length === 0" class="text-center py-16 max-w-xl mx-auto">
          <h2 class="text-xl font-light tracking-tight mb-2">No characters yet.</h2>
          <p class="text-sm text-ink-light mb-6">
            Add characters one at a time, or — for the St Cormac's project — bootstrap
            the canonical voice bibles, motifs and scene seeds in one click.
          </p>
          <div v-if="canModify" class="flex items-center justify-center gap-2">
            <button
              type="button"
              @click="addCharacter"
              class="px-4 py-2 text-sm tracking-wide font-sans bg-ink text-paper hover:bg-ink-light transition-colors"
            >
              + Add a character
            </button>
            <button
              type="button"
              :disabled="seeding"
              @click="importStCormacsSeed"
              class="px-4 py-2 text-sm tracking-wide font-sans border border-line text-ink-light hover:text-ink hover:border-ink-lighter transition-colors disabled:opacity-50"
            >
              {{ seeding ? 'Importing…' : "Import St Cormac's seed" }}
            </button>
          </div>
        </div>

        <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <!-- LEFT: character list -->
          <aside class="lg:col-span-3">
            <ul class="space-y-1">
              <li v-for="c in sortedCharacters" :key="c.id">
                <button
                  type="button"
                  @click="selectedId = c.id"
                  class="w-full text-left px-3 py-3 border border-line bg-paper hover:bg-surface transition-colors flex items-start gap-3"
                  :class="selectedId === c.id ? 'border-ink' : ''"
                >
                  <span
                    class="w-3 h-3 rounded-full mt-1.5 shrink-0 border border-line"
                    :style="{ backgroundColor: c.color || '#999' }"
                  />
                  <span class="min-w-0">
                    <span class="block text-sm font-medium text-ink truncate">{{ c.name }}</span>
                    <span v-if="c.role" class="block text-xs text-ink-lighter italic line-clamp-2">{{ c.role }}</span>
                  </span>
                </button>
              </li>
            </ul>
          </aside>

          <!-- MIDDLE: editor -->
          <main class="lg:col-span-6 space-y-6" v-if="selected">
            <!-- tabs -->
            <div class="flex items-center gap-1 border-b border-line">
              <button
                v-for="t in editorTabs"
                :key="t"
                type="button"
                @click="activeTab = t"
                class="px-3 py-2 text-xs uppercase tracking-widest font-sans border-b-2 transition-colors"
                :class="activeTab === t ? 'border-ink text-ink' : 'border-transparent text-ink-lighter hover:text-ink'"
              >
                {{ t }}
              </button>
            </div>

            <!-- IDENTITY -->
            <section v-if="activeTab === 'Identity'" class="space-y-6">
              <FieldRow label="Name" required>
                <input
                  v-model="selected.name"
                  type="text"
                  :readonly="!canModify"
                  @blur="saveSelected({ name: selected.name })"
                  class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink"
                />
              </FieldRow>
              <FieldRow label="Full name">
                <input
                  v-model="selected.fullName"
                  type="text"
                  :readonly="!canModify"
                  @blur="saveSelected({ fullName: selected.fullName })"
                  class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink"
                />
              </FieldRow>
              <FieldRow label="Role" hint="One sentence: what this character is for.">
                <textarea
                  v-model="selected.role"
                  rows="2"
                  :readonly="!canModify"
                  @blur="saveSelected({ role: selected.role })"
                  class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink"
                />
              </FieldRow>
              <FieldRow label="Social position">
                <textarea
                  v-model="selected.socialPosition"
                  rows="2"
                  :readonly="!canModify"
                  @blur="saveSelected({ socialPosition: selected.socialPosition })"
                  class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink"
                />
              </FieldRow>
              <FieldRow label="Governing contradiction" hint="What internal gap makes this character feel alive and unstable?">
                <textarea
                  v-model="selected.contradiction"
                  rows="2"
                  :readonly="!canModify"
                  @blur="saveSelected({ contradiction: selected.contradiction })"
                  class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink"
                />
              </FieldRow>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldRow label="Public want" hint="What they consciously want.">
                  <textarea v-model="selected.publicWant" rows="2" :readonly="!canModify"
                    @blur="saveSelected({ publicWant: selected.publicWant })"
                    class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink" />
                </FieldRow>
                <FieldRow label="Private want" hint="What they want but cannot admit.">
                  <textarea v-model="selected.privateWant" rows="2" :readonly="!canModify"
                    @blur="saveSelected({ privateWant: selected.privateWant })"
                    class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink" />
                </FieldRow>
                <FieldRow label="Hidden need" hint="What would make them more whole, even if they resist it.">
                  <textarea v-model="selected.hiddenNeed" rows="2" :readonly="!canModify"
                    @blur="saveSelected({ hiddenNeed: selected.hiddenNeed })"
                    class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink" />
                </FieldRow>
                <FieldRow label="Greatest fear">
                  <textarea v-model="selected.greatestFear" rows="2" :readonly="!canModify"
                    @blur="saveSelected({ greatestFear: selected.greatestFear })"
                    class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink" />
                </FieldRow>
                <FieldRow label="False belief" hint="The lie they live by.">
                  <textarea v-model="selected.falseBelief" rows="2" :readonly="!canModify"
                    @blur="saveSelected({ falseBelief: selected.falseBelief })"
                    class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink" />
                </FieldRow>
                <FieldRow label="Wound / pressure" hint="The formative damage that shapes current behaviour.">
                  <textarea v-model="selected.wound" rows="2" :readonly="!canModify"
                    @blur="saveSelected({ wound: selected.wound })"
                    class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink" />
                </FieldRow>
              </div>
            </section>

            <!-- VOICE -->
            <section v-if="activeTab === 'Voice'" class="space-y-6">
              <p class="text-sm text-ink-lighter italic">
                The voice bible. Used by the polyphonic map and (Phase 4) by AI assist
                so generated drafts respect this character's syntax, lexicon and silences.
              </p>
              <FieldRow label="Sentence length">
                <input v-model="selectedVoice.sentenceLength" type="text" :readonly="!canModify" @blur="saveVoice"
                  class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink" />
              </FieldRow>
              <FieldRow label="Rhythm / syntax">
                <textarea v-model="selectedVoice.rhythm" rows="2" :readonly="!canModify" @blur="saveVoice"
                  class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink" />
              </FieldRow>
              <FieldRow label="Preferred words" hint="Comma-separated.">
                <input
                  type="text"
                  :value="selectedVoice.preferredWords?.join(', ') ?? ''"
                  :readonly="!canModify"
                  @change="selectedVoice.preferredWords = parseList(($event.target as HTMLInputElement).value)"
                  @blur="saveVoice"
                  class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink"
                />
              </FieldRow>
              <FieldRow label="Forbidden / rare words">
                <input
                  type="text"
                  :value="selectedVoice.forbiddenWords?.join(', ') ?? ''"
                  :readonly="!canModify"
                  @change="selectedVoice.forbiddenWords = parseList(($event.target as HTMLInputElement).value)"
                  @blur="saveVoice"
                  class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink"
                />
              </FieldRow>
              <FieldRow label="Metaphor sources">
                <input
                  type="text"
                  :value="selectedVoice.metaphorSources?.join(', ') ?? ''"
                  :readonly="!canModify"
                  @change="selectedVoice.metaphorSources = parseList(($event.target as HTMLInputElement).value)"
                  @blur="saveVoice"
                  class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink"
                />
              </FieldRow>
              <FieldRow label="Attention pattern">
                <textarea v-model="selectedVoice.attentionPattern" rows="2" :readonly="!canModify" @blur="saveVoice"
                  class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink" />
              </FieldRow>
              <FieldRow label="Avoidance pattern">
                <textarea v-model="selectedVoice.avoidancePattern" rows="2" :readonly="!canModify" @blur="saveVoice"
                  class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink" />
              </FieldRow>
              <FieldRow label="How emotion leaks">
                <textarea v-model="selectedVoice.howEmotionLeaks" rows="2" :readonly="!canModify" @blur="saveVoice"
                  class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink" />
              </FieldRow>
              <FieldRow label="Sample sentence — neutral">
                <textarea v-model="selectedVoice.sampleSentenceNeutral" rows="2" :readonly="!canModify" @blur="saveVoice"
                  class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink" />
              </FieldRow>
              <FieldRow label="Sample sentence — under pressure">
                <textarea v-model="selectedVoice.sampleSentenceUnderPressure" rows="2" :readonly="!canModify" @blur="saveVoice"
                  class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink" />
              </FieldRow>
            </section>

            <!-- ARC -->
            <section v-if="activeTab === 'Arc'" class="space-y-4">
              <p class="text-sm text-ink-lighter italic">Phase pills, in order. Drag to reorder; click × to remove.</p>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="(p, idx) in selected.arcPhases"
                  :key="idx"
                  class="inline-flex items-center gap-2 px-3 py-1.5 bg-surface border border-line text-sm cursor-move"
                  :draggable="canModify"
                  @dragstart="onPhaseDrag(idx)"
                  @dragover.prevent
                  @drop.prevent="onPhaseDrop(idx)"
                >
                  <span class="text-xs text-ink-lighter">{{ idx + 1 }}.</span>
                  {{ p }}
                  <button v-if="canModify" type="button" @click="removePhase(idx)" class="text-ink-lighter hover:text-red-600" aria-label="Remove">×</button>
                </span>
              </div>
              <form v-if="canModify" @submit.prevent="addPhase" class="flex gap-2">
                <input
                  v-model="newPhase"
                  type="text"
                  placeholder="Add a phase, e.g. Belonging, Disturbance, Denial…"
                  class="flex-1 rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink"
                />
                <button type="submit" class="px-3 py-2 text-sm font-sans bg-ink text-paper hover:bg-ink-light">Add</button>
              </form>
            </section>

            <!-- MISREADINGS -->
            <section v-if="activeTab === 'Misreadings'" class="space-y-4">
              <p class="text-sm text-ink-lighter italic">
                Each character is wrong in their own way. The polyphonic map will surface these against beats.
              </p>
              <ul class="space-y-2">
                <li
                  v-for="m in selectedMisreadings"
                  :key="m.id"
                  class="px-4 py-3 border border-line bg-paper flex items-start gap-3"
                >
                  <span class="text-ink-lighter text-xs mt-1 shrink-0">·</span>
                  <p class="flex-1 text-sm text-ink">{{ m.label }}</p>
                  <button v-if="canModify" type="button" @click="removeMisreading(m.id)" class="text-ink-lighter hover:text-red-600" aria-label="Remove">×</button>
                </li>
                <li v-if="selectedMisreadings.length === 0" class="text-sm italic text-ink-lighter px-4 py-3">No misreadings yet.</li>
              </ul>
              <form v-if="canModify" @submit.prevent="addMisreading" class="flex gap-2">
                <input
                  v-model="newMisreading"
                  type="text"
                  placeholder="What does this character mis-read or mis-interpret?"
                  class="flex-1 rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink"
                />
                <button type="submit" class="px-3 py-2 text-sm font-sans bg-ink text-paper hover:bg-ink-light">Add</button>
              </form>
            </section>

            <!-- PLOT FUNCTIONS -->
            <section v-if="activeTab === 'Plot'" class="space-y-4">
              <p class="text-sm text-ink-lighter italic">What this character does for the plot.</p>
              <ul class="space-y-2">
                <li
                  v-for="(pf, idx) in selected.plotFunctions"
                  :key="idx"
                  class="px-4 py-3 border border-line bg-paper flex items-start gap-3"
                >
                  <span class="text-ink-lighter text-xs mt-1 shrink-0">·</span>
                  <p class="flex-1 text-sm text-ink">{{ pf }}</p>
                  <button v-if="canModify" type="button" @click="removePlotFunction(idx)" class="text-ink-lighter hover:text-red-600" aria-label="Remove">×</button>
                </li>
                <li v-if="selected.plotFunctions.length === 0" class="text-sm italic text-ink-lighter px-4 py-3">None yet.</li>
              </ul>
              <form v-if="canModify" @submit.prevent="addPlotFunction" class="flex gap-2">
                <input
                  v-model="newPlotFunction"
                  type="text"
                  placeholder="One plot function, one sentence."
                  class="flex-1 rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink"
                />
                <button type="submit" class="px-3 py-2 text-sm font-sans bg-ink text-paper hover:bg-ink-light">Add</button>
              </form>
            </section>

            <div v-if="canModify" class="pt-6 border-t border-line">
              <button
                type="button"
                @click="deleteCharacter"
                class="text-xs text-ink-lighter hover:text-red-600"
              >
                Delete this character
              </button>
            </div>
          </main>

          <!-- RIGHT: live voice card -->
          <aside class="lg:col-span-3" v-if="selected">
            <div class="sticky top-32 space-y-4">
              <div class="border border-line bg-paper p-4">
                <header class="flex items-center gap-3 mb-3">
                  <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: selected.color || '#999' }" />
                  <h3 class="text-sm font-medium text-ink">{{ selected.name }}</h3>
                </header>
                <p v-if="selected.contradiction" class="text-xs italic text-ink-light mb-3">
                  "{{ selected.contradiction }}"
                </p>
                <dl class="space-y-2 text-xs">
                  <div v-if="selected.publicWant">
                    <dt class="uppercase tracking-widest text-ink-lighter">Wants (public)</dt>
                    <dd class="text-ink">{{ selected.publicWant }}</dd>
                  </div>
                  <div v-if="selected.privateWant">
                    <dt class="uppercase tracking-widest text-ink-lighter">Wants (private)</dt>
                    <dd class="text-ink">{{ selected.privateWant }}</dd>
                  </div>
                  <div v-if="selected.greatestFear">
                    <dt class="uppercase tracking-widest text-ink-lighter">Fears</dt>
                    <dd class="text-ink">{{ selected.greatestFear }}</dd>
                  </div>
                </dl>
              </div>

              <div v-if="hasVoiceSamples" class="border border-line bg-paper p-4 space-y-3">
                <h4 class="text-xs uppercase tracking-widest text-ink-lighter">Voice samples</h4>
                <p v-if="selectedVoice.sampleSentenceNeutral" class="text-sm font-light italic text-ink leading-relaxed">
                  {{ selectedVoice.sampleSentenceNeutral }}
                </p>
                <p v-if="selectedVoice.sampleSentenceUnderPressure" class="text-sm font-light italic text-ink leading-relaxed border-l-2 border-line pl-3">
                  Under pressure — {{ selectedVoice.sampleSentenceUnderPressure }}
                </p>
              </div>

              <button
                type="button"
                @click="openIsolationRead"
                class="w-full text-left px-4 py-3 border border-line text-sm text-ink-light hover:text-ink hover:border-ink-lighter transition-colors"
              >
                <span class="block font-medium">Isolation read →</span>
                <span class="block text-xs italic text-ink-lighter mt-0.5">
                  Stitch every beat in this character's voice into one document. Pass-1 voice-coherence check.
                </span>
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>

    <!-- Isolation read modal -->
    <div
      v-if="showIsolation"
      class="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-40 p-4"
      @click.self="showIsolation = false"
    >
      <div class="bg-paper w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col shadow-lg">
        <header class="px-6 py-4 border-b border-line flex items-center justify-between">
          <div>
            <h3 class="text-lg font-light tracking-tight">Isolation read · {{ selected?.name }}</h3>
            <p class="text-xs text-ink-lighter">
              Every beat in this character's voice, in order. Read straight through to catch voice drift.
            </p>
          </div>
          <button
            type="button"
            @click="showIsolation = false"
            class="p-2 text-ink-lighter hover:text-ink"
            aria-label="Close"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </header>
        <div class="flex-1 overflow-y-auto px-6 py-6">
          <article v-if="isolationBeats.length > 0" class="space-y-6">
            <section v-for="b in isolationBeats" :key="b.id" class="border-l-2 border-line pl-4">
              <p class="text-xs uppercase tracking-widest text-ink-lighter font-sans mb-1">
                <span v-if="b.label">{{ b.label }} ·</span> {{ b.timelinePoint || '—' }}
              </p>
              <h4 class="text-base font-light text-ink mb-1">{{ b.title || '(untitled beat)' }}</h4>
              <p v-if="b.outerEvent" class="text-sm text-ink-light leading-relaxed">{{ b.outerEvent }}</p>
              <p v-if="b.innerTurn" class="text-sm text-ink-light italic mt-1">Inner turn: {{ b.innerTurn }}</p>
            </section>
          </article>
          <p v-else class="text-sm italic text-ink-lighter text-center py-12">
            This character isn't on any beats yet. Add beats from the Polyphonic or Plot view.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, reactive } from 'vue'
import { useRoute } from 'vue-router'
import { manuscriptsApi } from '../api/manuscripts'
import { storyCraftApi } from '../api/storycraft'
import { useAuth } from '../stores/auth'
import ManuscriptHeader from '../components/storycraft/ManuscriptHeader.vue'
import ManuscriptSubNav from '../components/storycraft/ManuscriptSubNav.vue'
import FieldRow from '../components/storycraft/FieldRow.vue'
import type { ManuscriptProject } from '@shared/Manuscript'
import type {
  Character,
  CharacterMisreading,
  Beat,
  VoiceBible,
} from '@shared/StoryCraft'

const route = useRoute()
const { user, isAdmin } = useAuth()

const loading = ref(true)
const seeding = ref(false)
const manuscript = ref<ManuscriptProject | null>(null)
const characters = ref<Character[]>([])
const misreadings = ref<CharacterMisreading[]>([])
const beats = ref<Beat[]>([])

const selectedId = ref<string | null>(null)
const editorTabs = ['Identity', 'Voice', 'Arc', 'Misreadings', 'Plot'] as const
type EditorTab = typeof editorTabs[number]
const activeTab = ref<EditorTab>('Identity')

const newPhase = ref('')
const newMisreading = ref('')
const newPlotFunction = ref('')
const showIsolation = ref(false)

const canModify = computed(() => {
  if (!manuscript.value || !user.value) return false
  return manuscript.value.userId === user.value.id || isAdmin.value
})

const sortedCharacters = computed(() =>
  [...characters.value].sort((a, b) => a.orderIndex - b.orderIndex || a.name.localeCompare(b.name))
)

const selected = computed<Character | null>(() => {
  if (!selectedId.value) return null
  return characters.value.find(c => c.id === selectedId.value) ?? null
})

// Reactive proxy of the voice bible so v-model works without mutating the
// shared character object's reference identity.
const selectedVoice = reactive<VoiceBible>({})
watch(selected, c => {
  // Refill the voice proxy whenever the selected character changes.
  for (const k of Object.keys(selectedVoice)) delete (selectedVoice as any)[k]
  if (c?.voice) Object.assign(selectedVoice, c.voice)
}, { immediate: true })

const hasVoiceSamples = computed(() =>
  Boolean(selectedVoice.sampleSentenceNeutral || selectedVoice.sampleSentenceUnderPressure)
)

const selectedMisreadings = computed(() =>
  selectedId.value ? misreadings.value.filter(m => m.characterId === selectedId.value) : []
)

const isolationBeats = computed(() =>
  selectedId.value
    ? beats.value
        .filter(b => b.povCharacterId === selectedId.value)
        .sort((a, b) => a.orderIndex - b.orderIndex)
    : []
)

const characterCountLabel = computed(() => {
  if (characters.value.length === 0) return ''
  return `${characters.value.length} ${characters.value.length === 1 ? 'character' : 'characters'}`
})

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
    misreadings.value = bundle.misreadings
    beats.value = bundle.beats
    if (!selectedId.value && characters.value.length > 0) {
      selectedId.value = sortedCharacters.value[0].id
    }
  } catch (err) {
    console.error('Failed to load character studio:', err)
    manuscript.value = null
  } finally {
    loading.value = false
  }
}

async function addCharacter() {
  const name = window.prompt('Character name', 'New character')
  if (!name || !name.trim()) return
  try {
    const created = await storyCraftApi.createCharacter(manuscript.value!.id, { name: name.trim() })
    characters.value.push(created)
    selectedId.value = created.id
    activeTab.value = 'Identity'
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to add character')
  }
}

async function importStCormacsSeed() {
  if (!manuscript.value) return
  if (!confirm("Import the St Cormac's character / motif / scene-seed material into this manuscript?\n\nIt's safe to run on an empty manuscript. Existing rows with the same name or label will be skipped.")) return
  seeding.value = true
  try {
    await storyCraftApi.importStCormacsSeed(manuscript.value.id)
    await loadAll()
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to import seed')
  } finally {
    seeding.value = false
  }
}

async function saveSelected(updates: Partial<Character>) {
  if (!selected.value) return
  try {
    const updated = await storyCraftApi.updateCharacter(selected.value.id, updates)
    const idx = characters.value.findIndex(c => c.id === updated.id)
    if (idx >= 0) characters.value[idx] = updated
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to save')
  }
}

async function saveVoice() {
  if (!selected.value) return
  await saveSelected({ voice: { ...selectedVoice } })
}

function parseList(value: string): string[] {
  return value.split(',').map(s => s.trim()).filter(Boolean)
}

/* ---- arc phases ---- */
let dragPhaseFrom: number | null = null
function onPhaseDrag(idx: number) { dragPhaseFrom = idx }
function onPhaseDrop(idx: number) {
  if (!selected.value || dragPhaseFrom === null || dragPhaseFrom === idx) return
  const next = [...selected.value.arcPhases]
  const [moved] = next.splice(dragPhaseFrom, 1)
  next.splice(idx, 0, moved)
  dragPhaseFrom = null
  saveSelected({ arcPhases: next })
}
function removePhase(idx: number) {
  if (!selected.value) return
  const next = [...selected.value.arcPhases]
  next.splice(idx, 1)
  saveSelected({ arcPhases: next })
}
function addPhase() {
  if (!selected.value || !newPhase.value.trim()) return
  const next = [...selected.value.arcPhases, newPhase.value.trim()]
  newPhase.value = ''
  saveSelected({ arcPhases: next })
}

/* ---- plot functions ---- */
function removePlotFunction(idx: number) {
  if (!selected.value) return
  const next = [...selected.value.plotFunctions]
  next.splice(idx, 1)
  saveSelected({ plotFunctions: next })
}
function addPlotFunction() {
  if (!selected.value || !newPlotFunction.value.trim()) return
  const next = [...selected.value.plotFunctions, newPlotFunction.value.trim()]
  newPlotFunction.value = ''
  saveSelected({ plotFunctions: next })
}

/* ---- misreadings ---- */
async function addMisreading() {
  if (!selected.value || !newMisreading.value.trim()) return
  try {
    const m = await storyCraftApi.createMisreading(selected.value.id, { label: newMisreading.value.trim() })
    misreadings.value.push(m)
    newMisreading.value = ''
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to add misreading')
  }
}
async function removeMisreading(id: string) {
  try {
    await storyCraftApi.deleteMisreading(id)
    misreadings.value = misreadings.value.filter(m => m.id !== id)
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to remove misreading')
  }
}

/* ---- delete character ---- */
async function deleteCharacter() {
  if (!selected.value) return
  if (!confirm(`Delete "${selected.value.name}"? Their beats will lose their POV link, but will not be deleted.`)) return
  try {
    await storyCraftApi.deleteCharacter(selected.value.id)
    characters.value = characters.value.filter(c => c.id !== selectedId.value)
    selectedId.value = sortedCharacters.value[0]?.id ?? null
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to delete character')
  }
}

function openIsolationRead() {
  showIsolation.value = true
}

onMounted(loadAll)
watch(() => route.params.id, () => {
  selectedId.value = null
  loadAll()
})
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
