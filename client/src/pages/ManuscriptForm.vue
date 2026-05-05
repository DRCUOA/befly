<template>
  <div class="max-w-3xl mx-auto">
    <h1 class="text-3xl font-light tracking-tight mb-2">
      {{ isEditing ? 'Edit Manuscript' : 'Start a Manuscript' }}
    </h1>
    <p class="text-sm text-ink-light mb-8">
      A manuscript gives a body of writing literary direction.
      Be specific where you can; leave blank what you don&rsquo;t yet know.
    </p>

    <form @submit.prevent="handleSubmit" class="space-y-6">
      <!-- Title + subtitle -->
      <div>
        <label for="title" class="block text-sm font-medium mb-1">Working title</label>
        <input
          id="title"
          v-model="form.title"
          type="text"
          required
          class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink"
          placeholder="The Shape of Absence"
        />
      </div>

      <div>
        <label for="subtitle" class="block text-sm font-medium mb-1">Working subtitle <span class="text-ink-lighter font-normal">(optional)</span></label>
        <input
          id="subtitle"
          v-model="form.workingSubtitle"
          type="text"
          class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink"
          placeholder="Frags on grief, memory, and the discipline of continuing"
        />
      </div>

      <!-- Form + status + visibility -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label class="block text-sm font-medium mb-1 inline-flex items-center">
            Form
            <HelpTooltip link="/help/manuscripts#form" aria-label="About form">
              What kind of book this wants to be. Shapes how the AI treats it &mdash; an
              frag collection allows variation between pieces; a long-form frag
              expects a single sustained argument.
            </HelpTooltip>
          </label>
          <select v-model="form.form" class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink">
            <option v-for="opt in FORM_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <p class="mt-1 text-xs text-ink-lighter">Shapes how the AI assistant later treats the work.</p>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1 inline-flex items-center">
            Status
            <HelpTooltip link="/help/manuscripts#status" aria-label="About status">
              Where the manuscript is in its life: gathering, structuring, drafting,
              bridging, revising, finalising. Just a label &mdash; not enforced by the app.
            </HelpTooltip>
          </label>
          <select v-model="form.status" class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink">
            <option v-for="opt in STATUS_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Visibility</label>
          <select v-model="form.visibility" class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink">
            <option value="private">Private</option>
            <option value="shared">Shared</option>
            <option value="public">Public</option>
          </select>
        </div>
      </div>

      <!-- Source themes -->
      <div>
        <label class="block text-sm font-medium mb-2 inline-flex items-center">
          Source themes
          <HelpTooltip link="/help/manuscripts#source-themes" aria-label="About source themes">
            Themes whose frags seed this manuscript. A manuscript can draw from many
            themes. Linking a theme doesn&rsquo;t auto-add its frags &mdash; you still
            choose what goes on the spine.
          </HelpTooltip>
        </label>
        <p class="mt-1 mb-2 text-xs text-ink-lighter">
          Themes whose frags seed this manuscript. A manuscript can draw from many themes.
        </p>
        <div v-if="themes.length === 0" class="text-sm text-ink-lighter italic">
          No themes yet. <router-link to="/themes/create" class="underline hover:text-ink">Create a theme first</router-link>.
        </div>
        <div v-else class="flex flex-wrap gap-2">
          <button
            v-for="t in themes"
            :key="t.id"
            type="button"
            @click="toggleTheme(t.id)"
            :class="[
              'px-3 py-1 text-sm rounded-sm border transition-colors',
              form.sourceThemeIds.includes(t.id)
                ? 'bg-ink text-paper border-ink'
                : 'bg-paper text-ink-light border-line hover:border-ink-lighter'
            ]"
          >
            {{ t.name }}
          </button>
        </div>
      </div>

      <!-- The literary fields. These are what give AI assist its job later. -->
      <div class="space-y-6 pt-4 border-t border-line">
        <h2 class="text-sm uppercase tracking-widest text-ink-lighter">Literary direction</h2>

        <div>
          <label for="centralQuestion" class="block text-sm font-medium mb-1 inline-flex items-center">
            Central question
            <HelpTooltip link="/help/manuscripts#central-question" aria-label="About central question">
              The single question your work keeps circling. Not a topic
              (&ldquo;grief&rdquo;) but an interrogation of it. Used by the AI to weigh
              which gaps matter.
            </HelpTooltip>
          </label>
          <p class="mb-2 text-xs text-ink-lighter">What question does this body of work keep circling?</p>
          <textarea
            id="centralQuestion"
            v-model="form.centralQuestion"
            rows="2"
            class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink"
            placeholder="How does a person keep living when absence becomes part of the furniture of life?"
          />
        </div>

        <div>
          <label for="throughLine" class="block text-sm font-medium mb-1 inline-flex items-center">
            Through-line
            <HelpTooltip link="/help/manuscripts#through-line" aria-label="About through-line">
              The thread that holds the frags together as one work. Often discovered
              rather than declared. Leave blank if you can&rsquo;t name it yet.
            </HelpTooltip>
          </label>
          <p class="mb-2 text-xs text-ink-lighter">What holds the frags together? (Leave blank if not yet clear.)</p>
          <textarea
            id="throughLine"
            v-model="form.throughLine"
            rows="3"
            class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink"
          />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label for="emotionalArc" class="block text-sm font-medium mb-1 inline-flex items-center">
              Emotional arc
              <HelpTooltip link="/help/manuscripts#emotional-arc" aria-label="About emotional arc">
                The shape of feeling across the book. Not the plot &mdash; the change
                in how the reader feels (refusal to acceptance, certainty to doubt).
              </HelpTooltip>
            </label>
            <p class="mb-2 text-xs text-ink-lighter">How should the reader feel the journey changing over time?</p>
            <textarea
              id="emotionalArc"
              v-model="form.emotionalArc"
              rows="3"
              class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink"
            />
          </div>
          <div>
            <label for="narrativePromise" class="block text-sm font-medium mb-1 inline-flex items-center">
              Narrative promise
              <HelpTooltip link="/help/manuscripts#narrative-promise" aria-label="About narrative promise">
                The contract the opening implies. What the first few pages tell the
                reader to expect. If you can&rsquo;t name it, the opening probably
                isn&rsquo;t doing its work yet.
              </HelpTooltip>
            </label>
            <p class="mb-2 text-xs text-ink-lighter">What does the opening imply the book will deliver?</p>
            <textarea
              id="narrativePromise"
              v-model="form.narrativePromise"
              rows="3"
              class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink"
            />
          </div>
        </div>

        <div>
          <label for="intendedReader" class="block text-sm font-medium mb-1">Intended reader</label>
          <p class="mb-2 text-xs text-ink-lighter">Who is this for, in the writer&rsquo;s mind?</p>
          <input
            id="intendedReader"
            v-model="form.intendedReader"
            type="text"
            class="block w-full rounded-md border-line bg-paper text-ink shadow-sm focus:border-ink focus:ring-ink"
          />
        </div>
      </div>

      <div v-if="error" class="bg-red-50 border border-red-200 rounded-md p-4">
        <p class="text-red-800 text-sm">{{ error }}</p>
      </div>

      <div class="flex space-x-4 pt-4">
        <button
          type="submit"
          :disabled="submitting || loadingManuscript"
          class="px-6 py-2 bg-ink text-paper hover:bg-ink-light transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm tracking-wide font-sans"
        >
          {{ submitting ? (isEditing ? 'Saving…' : 'Creating…') : (isEditing ? 'Save Changes' : 'Create Manuscript') }}
        </button>
        <router-link
          :to="cancelTo"
          class="px-6 py-2 border border-line text-ink-light hover:text-ink hover:border-ink-lighter transition-colors duration-300 text-sm tracking-wide font-sans"
        >
          Cancel
        </router-link>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { manuscriptsApi } from '../api/manuscripts'
import { api } from '../api/client'
import HelpTooltip from '../components/ui/HelpTooltip.vue'
import type { ApiResponse } from '@shared/ApiResponses'
import type { Theme } from '../domain/Theme'
import type { ManuscriptForm, ManuscriptStatus, ManuscriptVisibility } from '@shared/Manuscript'

const route = useRoute()
const router = useRouter()

const FORM_OPTIONS: { value: ManuscriptForm; label: string }[] = [
  { value: 'essay_collection', label: 'Frag collection' },
  { value: 'memoir', label: 'Memoir' },
  { value: 'long_form_essay', label: 'Long-form frag' },
  { value: 'creative_nonfiction', label: 'Creative nonfiction' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'fictionalised_memoir', label: 'Fictionalised memoir' },
]
const STATUS_OPTIONS: { value: ManuscriptStatus; label: string }[] = [
  { value: 'gathering', label: 'Gathering' },
  { value: 'structuring', label: 'Structuring' },
  { value: 'drafting', label: 'Drafting' },
  { value: 'bridging', label: 'Bridging' },
  { value: 'revising', label: 'Revising' },
  { value: 'finalising', label: 'Finalising' },
]

const manuscriptId = computed(() => route.params.id as string | undefined)
const isEditing = computed(() => !!manuscriptId.value)
const cancelTo = computed(() => isEditing.value ? `/manuscripts/${manuscriptId.value}` : '/manuscripts')

const form = ref({
  title: '',
  workingSubtitle: '',
  form: 'essay_collection' as ManuscriptForm,
  status: 'gathering' as ManuscriptStatus,
  visibility: 'private' as ManuscriptVisibility,
  centralQuestion: '',
  throughLine: '',
  emotionalArc: '',
  narrativePromise: '',
  intendedReader: '',
  sourceThemeIds: [] as string[],
})

const themes = ref<Theme[]>([])
const loadingManuscript = ref(false)
const submitting = ref(false)
const error = ref<string | null>(null)

function toggleTheme(id: string) {
  const i = form.value.sourceThemeIds.indexOf(id)
  if (i >= 0) form.value.sourceThemeIds.splice(i, 1)
  else form.value.sourceThemeIds.push(id)
}

async function loadThemes() {
  try {
    const response = await api.get<ApiResponse<Theme[]>>('/themes')
    themes.value = response.data
  } catch {
    themes.value = []
  }
}

async function loadManuscript() {
  if (!manuscriptId.value) return
  try {
    loadingManuscript.value = true
    error.value = null
    const m = await manuscriptsApi.get(manuscriptId.value)
    form.value = {
      title: m.title,
      workingSubtitle: m.workingSubtitle ?? '',
      form: m.form,
      status: m.status,
      visibility: m.visibility,
      centralQuestion: m.centralQuestion ?? '',
      throughLine: m.throughLine ?? '',
      emotionalArc: m.emotionalArc ?? '',
      narrativePromise: m.narrativePromise ?? '',
      intendedReader: m.intendedReader ?? '',
      sourceThemeIds: [...m.sourceThemeIds],
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load manuscript'
  } finally {
    loadingManuscript.value = false
  }
}

async function handleSubmit() {
  if (!form.value.title.trim()) {
    error.value = 'Title is required'
    return
  }
  try {
    submitting.value = true
    error.value = null
    // Empty strings in optional fields are normalised to null on the wire so the
    // backend stores NULL rather than '' (cleaner downstream).
    const payload = {
      title: form.value.title.trim(),
      workingSubtitle: form.value.workingSubtitle.trim() || null,
      form: form.value.form,
      status: form.value.status,
      visibility: form.value.visibility,
      centralQuestion: form.value.centralQuestion.trim() || null,
      throughLine: form.value.throughLine.trim() || null,
      emotionalArc: form.value.emotionalArc.trim() || null,
      narrativePromise: form.value.narrativePromise.trim() || null,
      intendedReader: form.value.intendedReader.trim() || null,
      sourceThemeIds: form.value.sourceThemeIds,
    }

    if (isEditing.value && manuscriptId.value) {
      await manuscriptsApi.update(manuscriptId.value, payload as any)
      router.push(`/manuscripts/${manuscriptId.value}`)
    } else {
      const created = await manuscriptsApi.create(payload as any)
      router.push(`/manuscripts/${created.id}`)
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to save manuscript'
  } finally {
    submitting.value = false
  }
}

// Pre-fill source themes from ?theme=<id> when arriving from a theme detail page.
function applyThemeQueryParam() {
  if (isEditing.value) return
  const queryTheme = route.query.theme
  if (typeof queryTheme === 'string' && queryTheme && !form.value.sourceThemeIds.includes(queryTheme)) {
    form.value.sourceThemeIds.push(queryTheme)
  }
}

onMounted(async () => {
  await loadThemes()
  if (isEditing.value) await loadManuscript()
  else applyThemeQueryParam()
})
</script>
