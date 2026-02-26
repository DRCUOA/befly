<template>
  <div class="cv-enrichment-page">
    <div class="w-full px-4 sm:px-6 md:px-8 py-12 sm:py-16 md:py-24 bg-gradient-to-b from-paper to-gray-50">
      <div class="max-w-xl mx-auto">

        <!-- Progress -->
        <div v-if="currentIdx > 0 && currentIdx < totalScreens - 1" class="mb-6">
          <p class="text-xs tracking-widest uppercase font-sans text-ink-lighter mb-2">
            {{ currentIdx }} of {{ totalScreens - 2 }}
          </p>
          <div class="h-1 bg-line rounded-full overflow-hidden">
            <div
              class="h-full bg-accent rounded-full transition-all duration-500"
              :style="{ width: ((currentIdx) / (totalScreens - 1)) * 100 + '%' }"
            />
          </div>
        </div>

        <!-- Welcome screen -->
        <div v-if="currentIdx === 0" class="text-center py-12 sm:py-16">
          <h1 class="text-3xl sm:text-4xl font-light tracking-tight mb-6">
            CV Enrichment
          </h1>
          <p class="text-base sm:text-lg font-light text-ink-light leading-relaxed max-w-md mx-auto mb-4">
            For: <strong class="font-medium">{{ questionsData.candidate }}</strong>
          </p>
          <p class="text-base font-light text-ink-lighter leading-relaxed max-w-md mx-auto">
            Help match you to the right opportunities. A few quick questions — tap Next to begin.
          </p>
        </div>

        <!-- Question screens -->
        <div v-else-if="currentIdx < totalScreens - 1 && currentQuestion" class="py-4">
          <p class="text-xs tracking-widest uppercase font-sans text-ink-lighter mb-3">
            {{ categoryLabel(currentQuestion.category) }}
          </p>
          <h2 class="text-xl sm:text-2xl font-light tracking-tight mb-8 leading-snug">
            {{ currentQuestion.question }}
          </h2>

          <!-- Array with options (multi-select) -->
          <div v-if="currentQuestion.expected_type === 'array' && currentQuestion.options?.length" class="space-y-3">
            <button
              v-for="opt in currentQuestion.options"
              :key="opt"
              type="button"
              class="w-full text-left px-5 py-4 rounded-lg border transition-all duration-200 text-base font-light"
              :class="isSelected(currentQuestion.id, opt)
                ? 'bg-accent text-paper border-accent shadow-sm'
                : 'bg-paper border-line hover:border-ink-lighter'"
              @click="toggleMulti(currentQuestion.id, opt)"
            >
              {{ opt }}
            </button>
          </div>

          <!-- String with options (single-select) -->
          <div v-else-if="(currentQuestion.expected_type === 'string' || currentQuestion.expected_type === 'boolean') && currentQuestion.options?.length" class="space-y-3">
            <button
              v-for="opt in currentQuestion.options"
              :key="opt"
              type="button"
              class="w-full text-left px-5 py-4 rounded-lg border transition-all duration-200 text-base font-light"
              :class="responses[currentQuestion.id] === opt
                ? 'bg-accent text-paper border-accent shadow-sm'
                : 'bg-paper border-line hover:border-ink-lighter'"
              @click="selectSingle(currentQuestion.id, opt)"
            >
              {{ opt }}
            </button>

            <!-- Follow-up (e.g. Hybrid days) -->
            <div
              v-if="currentQuestion.follow_up && responses[currentQuestion.id]?.toString().includes('Hybrid')"
              class="mt-6 pt-6 border-t border-line"
            >
              <label class="block text-sm font-light text-ink-lighter mb-2">{{ currentQuestion.follow_up }}</label>
              <input
                type="text"
                v-model="responses[currentQuestion.id + '_followup']"
                placeholder="e.g. 2 days"
                class="w-full px-5 py-4 rounded-lg border border-line bg-paper text-base font-light focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          <!-- Salary (object with min/max/currency) -->
          <div v-else-if="currentQuestion.id === 'salary_expectation' || currentQuestion.id === 'q_salary'" class="space-y-4">
            <div class="flex gap-4">
              <input
                type="text"
                inputmode="numeric"
                v-model="salaryForm.min"
                placeholder="Min"
                class="flex-1 px-5 py-4 rounded-lg border border-line bg-paper text-base font-light focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <input
                type="text"
                inputmode="numeric"
                v-model="salaryForm.max"
                placeholder="Max"
                class="flex-1 px-5 py-4 rounded-lg border border-line bg-paper text-base font-light focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div class="flex gap-4">
              <select
                v-model="salaryForm.currency"
                class="flex-1 px-5 py-4 rounded-lg border border-line bg-paper text-base font-light focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="NZD">NZD</option>
                <option value="AUD">AUD</option>
              </select>
              <select
                v-model="salaryForm.includes_super"
                class="flex-1 px-5 py-4 rounded-lg border border-line bg-paper text-base font-light focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="no">Excl. super</option>
                <option value="yes">Incl. super</option>
              </select>
            </div>
          </div>

          <!-- Object with fields (free-text per field) -->
          <div v-else-if="currentQuestion.expected_type === 'object' && currentQuestion.fields?.length" class="space-y-4">
            <div v-for="field in currentQuestion.fields" :key="field">
              <label class="block text-sm font-light text-ink-lighter mb-1 capitalize">{{ field.replace(/_/g, ' ') }}</label>
              <input
                type="text"
                v-model="objectFields[currentQuestion.id + '_' + field]"
                class="w-full px-5 py-4 rounded-lg border border-line bg-paper text-base font-light focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          <!-- Free text (string with no options, or array with no options) -->
          <div v-else>
            <textarea
              v-model="textInputs[currentQuestion.id]"
              rows="4"
              class="w-full px-5 py-4 rounded-lg border border-line bg-paper text-base font-light resize-none focus:outline-none focus:ring-2 focus:ring-accent"
              :placeholder="getPlaceholder(currentQuestion)"
            />
          </div>
        </div>

        <!-- Done screen -->
        <div v-else class="text-center py-12 sm:py-16">
          <h2 class="text-3xl sm:text-4xl font-light tracking-tight mb-6">
            {{ submitted ? 'Saved!' : "You're all set!" }}
          </h2>
          <p v-if="submitted" class="text-base font-light text-ink-lighter leading-relaxed max-w-md mx-auto">
            Responses saved as an essay. You can view it from the Essays page.
          </p>
          <p v-else-if="submitError" class="text-base font-light text-red-600 leading-relaxed max-w-md mx-auto">
            {{ submitError }}
          </p>
          <p v-else class="text-base font-light text-ink-lighter leading-relaxed max-w-md mx-auto">
            Tap Submit to save your responses.
          </p>
        </div>

        <!-- Navigation buttons -->
        <div class="flex items-center gap-4 mt-10">
          <button
            v-if="currentIdx > 0 && !submitted"
            @click="goBack"
            class="px-4 py-3 text-sm tracking-wide font-sans text-ink-lighter hover:text-ink min-h-[44px]"
          >
            Back
          </button>
          <div class="flex-1" />
          <button
            v-if="currentIdx < totalScreens - 1"
            @click="goNext"
            class="px-8 py-3 bg-ink text-paper hover:bg-ink-light transition-colors duration-300 text-sm tracking-wide font-sans min-h-[44px]"
          >
            Next
          </button>
          <button
            v-else-if="!submitted"
            @click="handleSubmit"
            :disabled="submitting"
            class="px-8 py-3 bg-accent text-paper hover:bg-accent-hover transition-colors duration-300 text-sm tracking-wide font-sans min-h-[44px] disabled:opacity-50"
          >
            {{ submitting ? 'Saving...' : 'Submit' }}
          </button>
          <router-link
            v-else
            to="/home"
            class="px-8 py-3 bg-ink text-paper hover:bg-ink-light transition-colors duration-300 text-sm tracking-wide font-sans min-h-[44px] inline-flex items-center"
          >
            Go to Essays
          </router-link>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { api } from '../api/client'
import type { ApiResponse } from '@shared/ApiResponses'
import questionsJson from '@cv/clarification-questions.json'

interface Question {
  id: string
  category: string
  priority?: string
  question: string
  expected_type: string
  options?: string[]
  fields?: string[]
  follow_up?: string
  matching_use?: string
}

interface QuestionsData {
  candidate: string
  questions: Question[]
}

const questionsData = questionsJson as unknown as QuestionsData

const CATEGORY_LABELS: Record<string, string> = {
  role_preferences: 'Role Preferences',
  experience: 'Experience',
  skills: 'Skills',
  skills_enrichment: 'Skills & Expertise',
  work_arrangement: 'Work Arrangement',
  employment_type: 'Employment',
  sector_preferences: 'Sector Preferences',
  eligibility: 'Eligibility',
  compensation: 'Compensation',
  motivation: 'Motivation',
  resume_clarifications: 'Resume Clarifications',
}

const categoryLabel = (cat: string) => CATEGORY_LABELS[cat] || cat

const allQuestions = questionsData.questions
const totalScreens = allQuestions.length + 2

const currentIdx = ref(0)
const responses = reactive<Record<string, any>>({})
const textInputs = reactive<Record<string, string>>({})
const objectFields = reactive<Record<string, string>>({})
const salaryForm = reactive({ min: '', max: '', currency: 'NZD', includes_super: 'no' })
const submitting = ref(false)
const submitted = ref(false)
const submitError = ref<string | null>(null)

const currentQuestion = computed<Question | null>(() => {
  const qIdx = currentIdx.value - 1
  if (qIdx < 0 || qIdx >= allQuestions.length) return null
  return allQuestions[qIdx]
})

function isSelected(qid: string, opt: string): boolean {
  const val = responses[qid]
  return Array.isArray(val) && val.includes(opt)
}

function toggleMulti(qid: string, opt: string) {
  if (!responses[qid]) responses[qid] = []
  const arr = responses[qid] as string[]
  const idx = arr.indexOf(opt)
  if (idx >= 0) arr.splice(idx, 1)
  else arr.push(opt)
}

function selectSingle(qid: string, opt: string) {
  responses[qid] = opt
}

function getPlaceholder(q: Question): string {
  if (q.id.includes('tech') || q.id.includes('hris')) return 'e.g. ServiceNow, JIRA, Workday'
  if (q.id.includes('cert')) return 'e.g. CIPD, SHRM'
  if (q.id.includes('metrics')) return 'e.g. Led team of 12; Hired 100+/month'
  return 'Type your answer...'
}

function collectCurrent() {
  const q = currentQuestion.value
  if (!q) return

  if (q.id === 'salary_expectation' || q.id === 'q_salary') {
    responses[q.id] = { ...salaryForm }
  } else if (q.expected_type === 'object' && q.fields?.length) {
    const obj: Record<string, string> = {}
    for (const f of q.fields) {
      obj[f] = objectFields[q.id + '_' + f] || ''
    }
    responses[q.id] = obj
  } else if (textInputs[q.id] !== undefined) {
    const v = textInputs[q.id].trim()
    if (q.expected_type === 'array' && (!q.options || !q.options.length)) {
      responses[q.id] = v ? v.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean) : []
    } else {
      responses[q.id] = v || null
    }
  }
}

function goBack() {
  if (currentIdx.value > 0) currentIdx.value--
}

function goNext() {
  collectCurrent()
  if (currentIdx.value < totalScreens - 1) currentIdx.value++
}

async function handleSubmit() {
  collectCurrent()
  submitting.value = true
  submitError.value = null

  const payload = {
    candidate: questionsData.candidate,
    submittedAt: new Date().toISOString(),
    responses: { ...responses },
  }

  const title = `CV Enrichment — ${questionsData.candidate} — ${new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}`
  const body = JSON.stringify(payload, null, 2)

  try {
    await api.post<ApiResponse<any>>('/writing', {
      title,
      body,
      themeIds: [],
      visibility: 'private',
    })
    submitted.value = true
  } catch (err) {
    submitError.value = err instanceof Error ? err.message : 'Failed to save responses'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.cv-enrichment-page {
  min-height: 100vh;
}
</style>
