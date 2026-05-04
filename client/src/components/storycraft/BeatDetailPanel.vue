<template>
  <div
    v-if="open && beat"
    class="fixed inset-0 bg-black/30 flex justify-end z-40"
    @click.self="$emit('close')"
  >
    <div class="bg-paper w-full sm:max-w-2xl h-full overflow-y-auto shadow-lg flex flex-col">
      <header class="px-6 py-4 border-b border-line flex items-start justify-between sticky top-0 bg-paper z-10 gap-3">
        <div class="min-w-0">
          <p class="text-xs uppercase tracking-widest text-ink-lighter font-sans">
            <span v-if="beat.label">{{ beat.label }} ·</span>
            <span v-if="povName">{{ povName }} ·</span>
            {{ beat.timelinePoint || 'No timeline point' }}
          </p>
          <h3 class="text-lg font-light tracking-tight">{{ beat.title || '(untitled beat)' }}</h3>
        </div>
        <button
          type="button"
          @click="$emit('close')"
          class="p-2 text-ink-lighter hover:text-ink"
          aria-label="Close"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </header>

      <div class="px-6 py-5 space-y-5">
        <FieldRow label="Title">
          <input v-model="local.title" type="text" :readonly="!canModify" @blur="commit('title')" class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink" />
        </FieldRow>
        <div class="grid grid-cols-2 gap-3">
          <FieldRow label="POV">
            <select v-model="local.povCharacterId" :disabled="!canModify" @change="commit('povCharacterId')"
              class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink">
              <option :value="null">— none —</option>
              <option v-for="c in characters" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </FieldRow>
          <FieldRow label="Timeline">
            <input v-model="local.timelinePoint" type="text" :readonly="!canModify" @blur="commit('timelinePoint')"
              class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink" />
          </FieldRow>
          <FieldRow label="Movement">
            <input v-model="local.movement" type="text" :readonly="!canModify" @blur="commit('movement')"
              class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink" />
          </FieldRow>
          <FieldRow label="Withholding level">
            <select v-model="local.withholdingLevel" :disabled="!canModify" @change="commit('withholdingLevel')"
              class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink">
              <option :value="null">— none —</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </FieldRow>
          <FieldRow label="Scene function">
            <select v-model="local.sceneFunctionType" :disabled="!canModify" @change="commit('sceneFunctionType')"
              class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink col-span-2">
              <option :value="null">— none —</option>
              <option v-for="t in sceneFunctionTypes" :key="t" :value="t">{{ formatSnake(t) }}</option>
            </select>
          </FieldRow>
        </div>

        <FieldRow label="Outer event">
          <textarea v-model="local.outerEvent" rows="2" :readonly="!canModify" @blur="commit('outerEvent')"
            class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink" />
        </FieldRow>
        <FieldRow label="Inner turn">
          <textarea v-model="local.innerTurn" rows="2" :readonly="!canModify" @blur="commit('innerTurn')"
            class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink" />
        </FieldRow>

        <FieldRow label="What this voice can uniquely provide">
          <textarea v-model="local.uniquePerception" rows="2" :readonly="!canModify" @blur="commit('uniquePerception')"
            class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink" />
        </FieldRow>
        <FieldRow label="What this voice cannot know" hint="Their structural blind spot at this beat.">
          <textarea v-model="local.blindSpot" rows="2" :readonly="!canModify" @blur="commit('blindSpot')"
            class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink" />
        </FieldRow>
        <FieldRow label="What this voice misreads">
          <textarea v-model="local.misreading" rows="2" :readonly="!canModify" @blur="commit('misreading')"
            class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink" />
        </FieldRow>
        <FieldRow label="What the reader infers" hint="The dramatic-irony spine.">
          <textarea v-model="local.readerInference" rows="2" :readonly="!canModify" @blur="commit('readerInference')"
            class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink" />
        </FieldRow>

        <FieldRow label="Voice constraint">
          <textarea v-model="local.voiceConstraint" rows="2" :readonly="!canModify" @blur="commit('voiceConstraint')"
            class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink" />
        </FieldRow>
        <FieldRow label="Final image">
          <textarea v-model="local.finalImage" rows="2" :readonly="!canModify" @blur="commit('finalImage')"
            class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink" />
        </FieldRow>
        <FieldRow label="Reason for next POV switch" hint="Why the next beat must belong to its POV, not this one.">
          <textarea v-model="local.reasonForNextPovSwitch" rows="2" :readonly="!canModify" @blur="commit('reasonForNextPovSwitch')"
            class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink" />
        </FieldRow>

        <!-- Knowledge ledger -->
        <section class="border-t border-line pt-5">
          <h4 class="text-xs uppercase tracking-widest text-ink-lighter font-sans mb-3">Knowledge ledger</h4>
          <p class="text-xs italic text-ink-lighter mb-3">
            What each character — and the reader — knows / suspects / mis-reads / withholds / is silent about at this beat.
          </p>

          <div class="space-y-3">
            <div
              v-for="row in knowledgeRows"
              :key="row.label"
              class="border border-line bg-paper p-3"
            >
              <div class="flex items-center gap-2 mb-2">
                <span
                  class="w-2 h-2 rounded-full"
                  :style="{ backgroundColor: row.color }"
                />
                <span class="text-sm font-medium text-ink">{{ row.label }}</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <KnowledgeCell
                  v-for="kind in knowledgeKinds"
                  :key="kind"
                  :kind="kind"
                  :value="row.cells[kind]"
                  :read-only="!canModify"
                  @save="(text) => $emit('saveKnowledge', { beatId: beat!.id, characterId: row.characterId, knowledgeKind: kind, text })"
                />
              </div>
            </div>
          </div>
        </section>

        <div v-if="canModify" class="pt-4 border-t border-line">
          <button
            type="button"
            @click="$emit('delete', beat.id)"
            class="text-xs text-ink-lighter hover:text-red-600"
          >
            Delete this beat
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import FieldRow from './FieldRow.vue'
import KnowledgeCell from './KnowledgeCell.vue'
import { SCENE_FUNCTION_TYPES, KNOWLEDGE_KINDS } from '@shared/StoryCraft'
import type { Beat, Character, BeatKnowledge, KnowledgeKind } from '@shared/StoryCraft'

interface Props {
  open: boolean
  beat: Beat | null
  characters: Character[]
  beatKnowledge: BeatKnowledge[]
  canModify: boolean
}
const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', updates: Partial<Beat>): void
  (e: 'delete', beatId: string): void
  (e: 'saveKnowledge', payload: { beatId: string; characterId: string | null; knowledgeKind: KnowledgeKind; text: string | null }): void
}>()

// Local mutable copy of the beat so v-model edits don't mutate the prop directly.
const local = ref<Partial<Beat>>({})
watch(() => props.beat, (b) => {
  local.value = b ? { ...b } : {}
}, { immediate: true })

const sceneFunctionTypes = SCENE_FUNCTION_TYPES
const knowledgeKinds = KNOWLEDGE_KINDS

function commit(field: keyof Beat) {
  if (!props.beat) return
  const newValue = (local.value as any)[field]
  const oldValue = (props.beat as any)[field]
  if (newValue === oldValue) return
  emit('save', { [field]: newValue } as Partial<Beat>)
}

function formatSnake(s: string) {
  return s.replace(/_/g, ' ')
}

interface KnowledgeRow {
  label: string
  characterId: string | null
  color: string
  cells: Record<KnowledgeKind, string>
}

const knowledgeRows = computed<KnowledgeRow[]>(() => {
  if (!props.beat) return []
  const rows: KnowledgeRow[] = []
  // Reader row first — it's the dramatic-irony spine.
  rows.push({
    label: 'Reader',
    characterId: null,
    color: '#000',
    cells: cellsFor(null),
  })
  for (const c of props.characters) {
    rows.push({
      label: c.name,
      characterId: c.id,
      color: c.color || '#999',
      cells: cellsFor(c.id),
    })
  }
  return rows
})

function cellsFor(characterId: string | null): Record<KnowledgeKind, string> {
  const out = {} as Record<KnowledgeKind, string>
  for (const k of knowledgeKinds) out[k] = ''
  if (!props.beat) return out
  for (const k of props.beatKnowledge) {
    if (k.beatId !== props.beat.id) continue
    if ((k.characterId ?? null) !== characterId) continue
    out[k.knowledgeKind] = k.text
  }
  return out
}

const povName = computed(() => {
  if (!props.beat?.povCharacterId) return null
  return props.characters.find(c => c.id === props.beat!.povCharacterId)?.name ?? null
})
</script>
