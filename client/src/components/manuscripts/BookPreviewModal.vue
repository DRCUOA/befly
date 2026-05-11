<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 bg-black/80 flex items-stretch justify-center"
    role="dialog"
    aria-modal="true"
    :aria-label="stage === 'wizard' ? 'Printed book preview wizard' : 'Printed book preview'"
    @keydown="onRootKeydown"
  >
    <!-- =================================================================
         STAGE: chooser — pick a saved draft or start a fresh wizard run.
         Only renders when there are saved printings; on a clean
         manuscript the watcher skips straight to 'wizard'.
         ================================================================= -->
    <section
      v-if="stage === 'chooser'"
      class="bp-chooser bg-paper text-ink w-full h-full flex flex-col items-center justify-center px-8"
      aria-label="Choose a saved printing or start a new wizard run"
    >
      <div class="bp-chooser-card max-w-2xl w-full">
        <header class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-light tracking-tight">Printed book preview</h2>
          <button
            type="button"
            class="bp-btn-ghost"
            @click="emit('close')"
            aria-label="Close preview wizard"
          >Close</button>
        </header>
        <p class="text-sm text-ink-light mb-4">
          You have <strong>{{ drafts.length }}</strong>
          saved {{ drafts.length === 1 ? 'printing' : 'printings' }} for this manuscript.
          Load one to keep working, or start a fresh wizard run from
          paperback defaults.
        </p>

        <div v-if="draftsLoading" class="text-sm italic text-ink-lighter">
          Loading saved printings…
        </div>

        <ul v-else class="bp-chooser-list space-y-2 mb-6">
          <li v-for="d in drafts" :key="d.id">
            <button
              type="button"
              class="bp-chooser-row w-full text-left rounded border border-line hover:border-ink transition-colors p-3 flex items-baseline justify-between gap-4"
              @click="chooseDraft(d.id)"
            >
              <span>
                <span class="font-medium">v{{ d.versionNumber }}</span>
                <span v-if="d.draftLabel" class="ml-2">{{ d.draftLabel }}</span>
                <span v-else class="ml-2 italic text-ink-lighter">(no label)</span>
              </span>
              <span class="text-xs text-ink-lighter">
                {{ d.profileName }} · saved {{ new Date(d.updatedAt).toLocaleString() }}
              </span>
            </button>
          </li>
        </ul>

        <div class="flex items-center gap-3 pt-2 border-t border-line">
          <button
            type="button"
            class="bp-btn-primary"
            @click="chooseNewWizard"
          >Start a new wizard run</button>
          <p class="text-xs text-ink-lighter">
            Starts from the Modern Trade Paperback Fiction defaults.
          </p>
        </div>
      </div>
    </section>

    <!-- =================================================================
         STAGE: wizard — step-by-step configuration with live preview
         ================================================================= -->
    <section
      v-if="stage === 'wizard'"
      class="bp-wizard bg-paper text-ink w-full h-full flex flex-col"
    >
      <!-- Header strip: step indicator + close -->
      <header class="bp-wizard-header">
        <div class="flex items-center gap-2 min-w-0">
          <h2 class="text-lg font-light tracking-tight whitespace-nowrap">Printed book preview</h2>
          <span class="text-ink-lighter">·</span>
          <p class="text-sm text-ink-light truncate">
            Step {{ currentStepIndex + 1 }} of {{ steps.length }} —
            <strong class="font-medium">{{ currentStep.title }}</strong>
          </p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <!-- Drafts / versions picker. Each row in book_printings is one
               named draft for this manuscript; the dropdown switches the
               wizard between them. "New draft" abandons the loaded id so
               the next save creates a new version_number. -->
          <label class="text-xs text-ink-light flex items-center gap-1">
            Draft
            <select
              class="bp-select bp-select-sm"
              :value="currentPrintingId ?? ''"
              :disabled="draftsLoading"
              @change="onDraftSelect"
            >
              <option value="">— New draft —</option>
              <option v-for="d in drafts" :key="d.id" :value="d.id">
                v{{ d.versionNumber }}{{ d.draftLabel ? ` · ${d.draftLabel}` : '' }}
              </option>
            </select>
          </label>
          <button
            type="button"
            class="bp-link"
            @click="newDraft"
            :disabled="!currentPrintingId && lastSavedAt === null"
            title="Start a new draft from the current settings (will create a new version on next save)"
          >New draft</button>
          <button
            v-if="currentPrintingId"
            type="button"
            class="bp-link text-red-600"
            @click="deleteCurrentDraft"
            title="Delete the currently-loaded draft"
          >Delete draft</button>
          <button
            type="button"
            class="bp-link"
            @click="resetToDefaults"
            title="Restore default Modern Trade Paperback Fiction settings"
          >Reset to paperback defaults</button>
          <button
            type="button"
            class="bp-btn-ghost"
            @click="emit('close')"
            aria-label="Close preview wizard"
          >Close</button>
        </div>
      </header>

      <!-- Step navigator strip: keyboard-accessible list of step buttons -->
      <nav class="bp-stepbar" aria-label="Wizard steps">
        <ol class="bp-stepbar-list">
          <li
            v-for="(s, i) in steps"
            :key="s.id"
            :class="['bp-stepbar-item', i === currentStepIndex && 'is-current']"
          >
            <button
              type="button"
              class="bp-stepbar-btn"
              :aria-current="i === currentStepIndex ? 'step' : undefined"
              @click="goToStep(i)"
            >
              <span class="bp-stepbar-num">{{ i + 1 }}</span>
              <span class="bp-stepbar-label">{{ s.title }}</span>
            </button>
          </li>
        </ol>
      </nav>

      <!-- Two-pane body -->
      <div class="bp-wizard-body">
        <!-- LEFT: step controls -->
        <div class="bp-controls" role="region" :aria-labelledby="`bp-step-h-${currentStep.id}`">
          <div class="bp-controls-scroll">
            <h3 :id="`bp-step-h-${currentStep.id}`" class="bp-step-title">
              {{ currentStep.title }}
            </h3>
            <p class="bp-step-desc">{{ currentStep.description }}</p>

            <!-- ============ Step: manuscript ============ -->
            <div v-if="currentStep.id === 'manuscript'" class="space-y-4">
              <p class="text-sm text-ink-light">
                Choose the sections and items to include as chapters in the
                preview. Top-level sections become chapters; items inside a
                section flow as that chapter's body.
              </p>
              <div class="flex items-center gap-3 text-xs">
                <button type="button" class="bp-link" @click="selectAll">Select all</button>
                <span class="text-ink-lighter">·</span>
                <button type="button" class="bp-link" @click="clearAll">Clear all</button>
              </div>

              <div v-if="!sections.length && !unassignedItems.length" class="text-sm italic text-ink-lighter">
                Nothing in the spine yet.
              </div>

              <ul class="space-y-3">
                <li v-for="s in sortedSections" :key="s.id" class="bp-card">
                  <label class="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      :checked="isSectionFullySelected(s.id)"
                      :indeterminate.prop="isSectionPartiallySelected(s.id)"
                      @change="onSectionCheckboxChange(s.id, $event)"
                      class="mt-1 rounded border-line text-ink focus:ring-ink"
                    />
                    <span class="text-sm flex-1">
                      <span class="font-medium block">{{ s.title || 'Untitled section' }}</span>
                      <span class="text-ink-lighter text-xs">
                        {{ (itemsBySection.get(s.id) || []).length }} item(s) · chapter
                      </span>
                    </span>
                  </label>

                  <ul v-if="(itemsBySection.get(s.id) || []).length" class="mt-2 ml-7 space-y-1">
                    <li v-for="it in (itemsBySection.get(s.id) || [])" :key="it.id">
                      <label class="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          v-model="selectedItemIds"
                          :value="it.id"
                          class="rounded border-line text-ink focus:ring-ink"
                        />
                        <span class="text-ink-light truncate">
                          {{ it.title || 'Untitled' }}
                          <span class="text-ink-lighter text-xs italic">· {{ it.itemType }}</span>
                        </span>
                      </label>
                    </li>
                  </ul>
                </li>

                <li v-if="unassignedItems.length" class="bp-card">
                  <span class="text-xs uppercase tracking-widest text-ink-lighter font-sans">Unassigned</span>
                  <ul class="mt-2 space-y-1">
                    <li v-for="it in unassignedItems" :key="it.id">
                      <label class="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          v-model="selectedItemIds"
                          :value="it.id"
                          class="rounded border-line text-ink focus:ring-ink"
                        />
                        <span class="text-ink-light truncate">
                          {{ it.title || 'Untitled' }}
                          <span class="text-ink-lighter text-xs italic">· {{ it.itemType }}</span>
                        </span>
                      </label>
                    </li>
                  </ul>
                </li>
              </ul>
            </div>

            <!-- ============ Step: trim_size ============ -->
            <div v-else-if="currentStep.id === 'trim_size'" class="space-y-3">
              <fieldset class="bp-fieldset">
                <legend class="bp-legend">Paperback size</legend>
                <ul class="space-y-1">
                  <li v-for="t in trimOptions" :key="`${t.label}-${t.width}x${t.height}`">
                    <label class="bp-radio">
                      <input
                        type="radio"
                        name="trim"
                        :checked="config.trimSize.label === t.label"
                        @change="config.trimSize = { ...t }"
                      />
                      <span>
                        <strong>{{ t.label }}</strong>
                        <span class="text-ink-lighter"> — {{ t.width }} × {{ t.height }} {{ t.unit }}</span>
                      </span>
                    </label>
                  </li>
                </ul>
              </fieldset>
            </div>

            <!-- ============ Step: margins ============ -->
            <div v-else-if="currentStep.id === 'margins'" class="space-y-4">
              <p class="text-sm text-ink-light">
                Inside (gutter) is the inner edge near the spine. Make it
                bigger than the outside margin so text doesn't disappear into
                the binding on a thick book.
              </p>
              <NumberField
                label="Top margin"
                unit="in"
                v-model="config.margins.top"
                :min="0.5" :max="0.9" :step="0.01"
              />
              <NumberField
                label="Bottom margin"
                unit="in"
                v-model="config.margins.bottom"
                :min="0.6" :max="1.0" :step="0.01"
              />
              <NumberField
                label="Outside margin"
                unit="in"
                v-model="config.margins.outside"
                :min="0.5" :max="0.85" :step="0.01"
              />
              <NumberField
                label="Inside gutter"
                unit="in"
                v-model="config.margins.insideGutter"
                :min="0.65" :max="1.1" :step="0.01"
              />
            </div>

            <!-- ============ Step: typography ============ -->
            <div v-else-if="currentStep.id === 'typography'" class="space-y-4">
              <fieldset class="bp-fieldset">
                <legend class="bp-legend">Body font</legend>
                <select
                  v-model="config.typography.bodyFont"
                  class="bp-select"
                  aria-label="Body font"
                >
                  <option v-for="f in bodyFontOptions" :key="f" :value="f">{{ f }}</option>
                </select>
                <p class="text-xs text-ink-lighter mt-1">
                  Use a readable serif for paperback fiction. Avoid sans-serif body text.
                </p>
              </fieldset>
              <NumberField
                label="Font size"
                unit="pt"
                v-model="config.typography.fontSize"
                :min="10" :max="11.5" :step="0.25"
              />
              <NumberField
                label="Line height"
                unit="pt"
                v-model="config.typography.lineHeight"
                :min="12" :max="14" :step="0.25"
              />
              <fieldset class="bp-fieldset">
                <legend class="bp-legend">Alignment</legend>
                <label class="bp-radio">
                  <input type="radio" name="align" value="justified" v-model="config.typography.alignment" />
                  <span>Justified (recommended)</span>
                </label>
                <label class="bp-radio">
                  <input type="radio" name="align" value="left" v-model="config.typography.alignment" />
                  <span>Left-aligned</span>
                </label>
              </fieldset>
              <label class="bp-checkbox">
                <input type="checkbox" v-model="config.typography.hyphenation" />
                <span>Hyphenate at line breaks</span>
              </label>
            </div>

            <!-- ============ Step: paragraphs ============ -->
            <div v-else-if="currentStep.id === 'paragraphs'" class="space-y-4">
              <NumberField
                label="First-line indent"
                unit="in"
                v-model="config.paragraphs.firstLineIndent"
                :min="0.2" :max="0.3" :step="0.01"
              />
              <NumberField
                label="Paragraph spacing"
                unit="pt"
                v-model="config.paragraphs.paragraphSpacing"
                :min="0" :max="6" :step="0.5"
              />
              <p class="text-xs text-ink-lighter">
                Standard fiction: indented paragraphs with no blank line
                between them. Keep paragraph spacing at 0 unless you're
                designing a non-fiction layout.
              </p>
              <label class="bp-checkbox">
                <input type="checkbox" v-model="config.paragraphs.removeIndentAfterChapterHeading" />
                <span>Remove indent on the first paragraph after a chapter heading</span>
              </label>
              <label class="bp-checkbox">
                <input type="checkbox" v-model="config.paragraphs.removeIndentAfterSceneBreak" />
                <span>Remove indent on the first paragraph after a scene break</span>
              </label>
            </div>

            <!-- ============ Step: chapters ============ -->
            <div v-else-if="currentStep.id === 'chapters'" class="space-y-4">
              <fieldset class="bp-fieldset">
                <legend class="bp-legend">What counts as a chapter?</legend>
                <label class="bp-radio">
                  <input type="radio" :value="true" :checked="config.chapters.chaptersFromItems" @change="config.chapters.chaptersFromItems = true" />
                  <span>
                    <strong>Each essay is a chapter</strong>
                    <span class="text-ink-lighter"> — every item starts on its own page with its own heading. Recommended for essay collections.</span>
                  </span>
                </label>
                <label class="bp-radio">
                  <input type="radio" :value="false" :checked="!config.chapters.chaptersFromItems" @change="config.chapters.chaptersFromItems = false" />
                  <span>
                    <strong>Each section is a chapter</strong>
                    <span class="text-ink-lighter"> — items within a section flow together, separated by scene breaks.</span>
                  </span>
                </label>
              </fieldset>
              <fieldset class="bp-fieldset">
                <legend class="bp-legend">Chapter starts on</legend>
                <label class="bp-radio">
                  <input type="radio" name="chapterStart" value="new_page" v-model="config.chapters.chapterStart" />
                  <span>A new page (any side)</span>
                </label>
                <label class="bp-radio">
                  <input type="radio" name="chapterStart" value="right_hand_page" v-model="config.chapters.chapterStart" />
                  <span>The next right-hand page (recto)</span>
                </label>
              </fieldset>
              <fieldset class="bp-fieldset">
                <legend class="bp-legend">Chapter title style</legend>
                <label class="bp-radio">
                  <input type="radio" name="cts" value="chapter_number" v-model="config.chapters.chapterTitleStyle" />
                  <span>Number only — "1"</span>
                </label>
                <label class="bp-radio">
                  <input type="radio" name="cts" value="chapter_word_number" v-model="config.chapters.chapterTitleStyle" />
                  <span>Word + number — "Chapter 1"</span>
                </label>
                <label class="bp-radio">
                  <input type="radio" name="cts" value="title_only" v-model="config.chapters.chapterTitleStyle" />
                  <span>Title only — "Beginnings"</span>
                </label>
                <label class="bp-radio">
                  <input type="radio" name="cts" value="number_and_title" v-model="config.chapters.chapterTitleStyle" />
                  <span>Number and title — "1 · Beginnings"</span>
                </label>
              </fieldset>
              <fieldset class="bp-fieldset">
                <legend class="bp-legend">Opening position on the page</legend>
                <label class="bp-radio">
                  <input type="radio" name="cop" value="top" v-model="config.chapters.chapterOpeningPosition" />
                  <span>Top of the type page</span>
                </label>
                <label class="bp-radio">
                  <input type="radio" name="cop" value="upper_third" v-model="config.chapters.chapterOpeningPosition" />
                  <span>Upper third (default)</span>
                </label>
                <label class="bp-radio">
                  <input type="radio" name="cop" value="centered_high" v-model="config.chapters.chapterOpeningPosition" />
                  <span>Centred high (about ¼ down)</span>
                </label>
              </fieldset>
              <label class="bp-checkbox">
                <input type="checkbox" v-model="config.chapters.dropCap" />
                <span>Drop cap on the first paragraph</span>
              </label>
              <label class="bp-checkbox">
                <input type="checkbox" v-model="config.chapters.smallCapsOpening" />
                <span>Small-caps opening line</span>
              </label>
            </div>

            <!-- ============ Step: scene_breaks ============ -->
            <div v-else-if="currentStep.id === 'scene_breaks'" class="space-y-4">
              <fieldset class="bp-fieldset">
                <legend class="bp-legend">Scene break style</legend>
                <label class="bp-radio">
                  <input type="radio" name="sb" value="blank_line" v-model="config.sceneBreaks.style" />
                  <span>Blank line — invisible if it lands at a page break</span>
                </label>
                <label class="bp-radio">
                  <input type="radio" name="sb" value="centered_asterisks" v-model="config.sceneBreaks.style" />
                  <span>Centred asterisks (recommended)</span>
                </label>
                <label class="bp-radio">
                  <input type="radio" name="sb" value="centered_symbol" v-model="config.sceneBreaks.style" />
                  <span>Centred custom symbol</span>
                </label>
              </fieldset>
              <label class="block">
                <span class="text-sm font-medium block mb-1">Scene break symbol</span>
                <input
                  type="text"
                  class="bp-text-input"
                  v-model="config.sceneBreaks.symbol"
                  :disabled="config.sceneBreaks.style === 'blank_line'"
                  aria-label="Scene break symbol"
                />
              </label>
            </div>

            <!-- ============ Step: headers_footers ============ -->
            <div v-else-if="currentStep.id === 'headers_footers'" class="space-y-4">
              <label class="bp-checkbox">
                <input type="checkbox" v-model="config.headersAndFooters.runningHeaders" />
                <span>Show running headers</span>
              </label>
              <fieldset class="bp-fieldset" :class="{ 'opacity-60 pointer-events-none': !config.headersAndFooters.runningHeaders }">
                <legend class="bp-legend">Left-page (verso) header</legend>
                <select v-model="config.headersAndFooters.leftPageHeader" class="bp-select">
                  <option value="author_name">Author name</option>
                  <option value="book_title">Book title</option>
                  <option value="none">None</option>
                </select>
              </fieldset>
              <fieldset class="bp-fieldset" :class="{ 'opacity-60 pointer-events-none': !config.headersAndFooters.runningHeaders }">
                <legend class="bp-legend">Right-page (recto) header</legend>
                <select v-model="config.headersAndFooters.rightPageHeader" class="bp-select">
                  <option value="book_title">Book title</option>
                  <option value="author_name">Author name</option>
                  <option value="chapter_title">Chapter title</option>
                  <option value="none">None</option>
                </select>
              </fieldset>
              <fieldset class="bp-fieldset">
                <legend class="bp-legend">Page number position</legend>
                <label class="bp-radio">
                  <input type="radio" name="pnp" value="bottom_center" v-model="config.headersAndFooters.pageNumberPosition" />
                  <span>Bottom centre</span>
                </label>
                <label class="bp-radio">
                  <input type="radio" name="pnp" value="outer_top" v-model="config.headersAndFooters.pageNumberPosition" />
                  <span>Outer top</span>
                </label>
                <label class="bp-radio">
                  <input type="radio" name="pnp" value="outer_bottom" v-model="config.headersAndFooters.pageNumberPosition" />
                  <span>Outer bottom</span>
                </label>
              </fieldset>
              <label class="bp-checkbox">
                <input type="checkbox" v-model="config.headersAndFooters.suppressHeaderOnChapterOpenings" />
                <span>Suppress headers on chapter-opening pages</span>
              </label>
            </div>

            <!-- ============ Step: front_back_matter ============ -->
            <div v-else-if="currentStep.id === 'front_back_matter'" class="space-y-4">
              <p class="text-sm text-ink-light">
                Toggle a section to include it. When ticked, a text editor
                appears so you can write the actual dedication, epigraph,
                acknowledgements, and so on.
              </p>
              <fieldset class="bp-fieldset">
                <legend class="bp-legend">Front matter</legend>
                <div v-for="opt in frontMatterOptions" :key="opt.key" class="bp-matter-item">
                  <label class="bp-checkbox">
                    <input
                      type="checkbox"
                      :value="opt.key"
                      :checked="config.frontMatter.includes(opt.key)"
                      @change="toggleFrontMatter(opt.key, ($event.target as HTMLInputElement).checked)"
                    />
                    <span>
                      <strong>{{ opt.label }}</strong>
                      <span class="text-ink-lighter"> — {{ opt.description }}</span>
                    </span>
                  </label>
                  <!-- Editable text body for items that have one. -->
                  <div v-if="config.frontMatter.includes(opt.key)" class="bp-matter-body">
                    <template v-if="opt.key === 'also_by_author'">
                      <textarea
                        v-model="config.matterContent.alsoByFront"
                        rows="3"
                        class="bp-text-input"
                        placeholder="One title per line — e.g. The Other Book"
                        :aria-label="'Also-by-author list (front matter)'"
                      ></textarea>
                    </template>
                    <template v-else-if="opt.key === 'dedication'">
                      <textarea
                        v-model="config.matterContent.dedication"
                        rows="2"
                        class="bp-text-input"
                        placeholder="For…"
                        aria-label="Dedication"
                      ></textarea>
                    </template>
                    <template v-else-if="opt.key === 'epigraph'">
                      <textarea
                        v-model="config.matterContent.epigraph"
                        rows="3"
                        class="bp-text-input"
                        placeholder="The quotation that opens the book."
                        aria-label="Epigraph"
                      ></textarea>
                      <input
                        v-model="config.matterContent.epigraphAttribution"
                        type="text"
                        class="bp-text-input mt-1"
                        placeholder="Attribution (e.g. — Marilynne Robinson)"
                        aria-label="Epigraph attribution"
                      />
                    </template>
                    <p v-else class="text-xs text-ink-lighter">
                      No text input — generated from the manuscript title.
                    </p>
                  </div>
                </div>
              </fieldset>

              <fieldset class="bp-fieldset">
                <legend class="bp-legend">Back matter</legend>
                <div v-for="opt in backMatterOptions" :key="opt.key" class="bp-matter-item">
                  <label class="bp-checkbox">
                    <input
                      type="checkbox"
                      :value="opt.key"
                      :checked="config.backMatter.includes(opt.key)"
                      @change="toggleBackMatter(opt.key, ($event.target as HTMLInputElement).checked)"
                    />
                    <span>
                      <strong>{{ opt.label }}</strong>
                      <span class="text-ink-lighter"> — {{ opt.description }}</span>
                    </span>
                  </label>
                  <div v-if="config.backMatter.includes(opt.key)" class="bp-matter-body">
                    <template v-if="opt.key === 'acknowledgements'">
                      <textarea
                        v-model="config.matterContent.acknowledgements"
                        rows="5"
                        class="bp-text-input"
                        placeholder="Thanks and credits."
                        aria-label="Acknowledgements"
                      ></textarea>
                    </template>
                    <template v-else-if="opt.key === 'author_note'">
                      <textarea
                        v-model="config.matterContent.authorNote"
                        rows="5"
                        class="bp-text-input"
                        placeholder="A few words from the author."
                        aria-label="Author note"
                      ></textarea>
                    </template>
                    <template v-else-if="opt.key === 'discussion_questions'">
                      <textarea
                        v-model="config.matterContent.discussionQuestions"
                        rows="6"
                        class="bp-text-input"
                        placeholder="One question per line."
                        aria-label="Discussion questions"
                      ></textarea>
                    </template>
                    <template v-else-if="opt.key === 'also_by_author'">
                      <textarea
                        v-model="config.matterContent.alsoByBack"
                        rows="3"
                        class="bp-text-input"
                        placeholder="One title per line."
                        aria-label="Also-by-author list (back matter)"
                      ></textarea>
                    </template>
                    <template v-else-if="opt.key === 'preview_chapter'">
                      <textarea
                        v-model="config.matterContent.previewChapter"
                        rows="6"
                        class="bp-text-input"
                        placeholder="A short teaser for the next book."
                        aria-label="Preview chapter"
                      ></textarea>
                    </template>
                    <template v-else-if="opt.key === 'author_bio'">
                      <textarea
                        v-model="config.matterContent.authorBio"
                        rows="5"
                        class="bp-text-input"
                        placeholder="Short biography."
                        aria-label="About the author"
                      ></textarea>
                    </template>
                  </div>
                </div>
              </fieldset>
            </div>

            <!-- ============ Step: paper_and_print ============ -->
            <div v-else-if="currentStep.id === 'paper_and_print'" class="space-y-4">
              <fieldset class="bp-fieldset">
                <legend class="bp-legend">Paper colour</legend>
                <label class="bp-radio">
                  <input type="radio" name="paper" value="cream" v-model="config.paper.color" />
                  <span>Cream (recommended for fiction)</span>
                </label>
                <label class="bp-radio">
                  <input type="radio" name="paper" value="white" v-model="config.paper.color" />
                  <span>White</span>
                </label>
              </fieldset>
              <fieldset class="bp-fieldset">
                <legend class="bp-legend">Ink</legend>
                <p class="text-sm text-ink-light">Black interior ink (industry standard for paperback fiction).</p>
              </fieldset>
              <fieldset class="bp-fieldset">
                <legend class="bp-legend">Binding</legend>
                <p class="text-sm text-ink-light">Perfect-bound paperback.</p>
              </fieldset>
            </div>

            <!-- ============ Step: cover ============ -->
            <div v-else-if="currentStep.id === 'cover'" class="space-y-4">
              <p class="text-sm text-ink-light">
                Cover artwork is optional and isn't part of the print
                interior. The fields here flow through the on-screen book
                preview and the printed mock-up.
              </p>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label class="block">
                  <span class="text-sm font-medium block mb-1">Front cover image</span>
                  <input type="file" accept="image/*" @change="onFrontCoverChosen" class="block text-sm" />
                  <span v-if="frontCoverUrl" class="text-xs text-ink-lighter">Loaded.</span>
                </label>
                <label class="block">
                  <span class="text-sm font-medium block mb-1">Back cover image</span>
                  <input type="file" accept="image/*" @change="onBackCoverChosen" class="block text-sm" />
                  <span v-if="backCoverUrl" class="text-xs text-ink-lighter">Loaded.</span>
                </label>
              </div>

              <NumberField
                label="Cover image transparency"
                unit="%"
                :model-value="Math.round(config.cover.coverOpacity * 100)"
                :min="0" :max="100" :step="5"
                @update:model-value="config.cover.coverOpacity = Math.max(0, Math.min(1, ($event as number) / 100))"
              />

              <label class="block">
                <span class="text-sm font-medium block mb-1">Author name</span>
                <input
                  v-model.trim="config.cover.authorName"
                  type="text"
                  placeholder="e.g. R. D. Clark"
                  class="bp-text-input"
                />
                <span class="block text-xs text-ink-lighter mt-1">
                  Appears on the front cover, beneath the title on the back, and as the running header on left-hand pages.
                </span>
              </label>

              <fieldset class="bp-fieldset">
                <legend class="bp-legend">Title block</legend>
                <NumberField
                  label="Vertical position from top"
                  unit="%"
                  v-model="config.cover.titleY"
                  :min="5" :max="95" :step="1"
                />
                <NumberField
                  label="Size"
                  unit="px"
                  v-model="config.cover.titleSize"
                  :min="12" :max="72" :step="1"
                />
                <label class="block">
                  <span class="text-sm font-medium block mb-1">Colour</span>
                  <input v-model="config.cover.titleColor" type="color" class="bp-color-input" />
                </label>
                <fieldset class="bp-fieldset">
                  <legend class="bp-legend">Alignment</legend>
                  <div class="bp-segmented">
                    <button
                      v-for="a in (['left','center','right'] as const)"
                      :key="`tt-${a}`"
                      type="button"
                      @click="config.cover.titleAlign = a"
                      :class="['bp-segmented-btn', config.cover.titleAlign === a && 'is-on']"
                    >{{ a }}</button>
                  </div>
                </fieldset>
              </fieldset>

              <fieldset class="bp-fieldset" :class="{ 'opacity-60 pointer-events-none': !config.cover.authorName }">
                <legend class="bp-legend">Author block</legend>
                <NumberField
                  label="Vertical position from top"
                  unit="%"
                  v-model="config.cover.authorY"
                  :min="5" :max="95" :step="1"
                />
                <NumberField
                  label="Size"
                  unit="px"
                  v-model="config.cover.authorSize"
                  :min="10" :max="48" :step="1"
                />
                <label class="block">
                  <span class="text-sm font-medium block mb-1">Colour</span>
                  <input v-model="config.cover.authorColor" type="color" class="bp-color-input" />
                </label>
                <fieldset class="bp-fieldset">
                  <legend class="bp-legend">Alignment</legend>
                  <div class="bp-segmented">
                    <button
                      v-for="a in (['left','center','right'] as const)"
                      :key="`at-${a}`"
                      type="button"
                      @click="config.cover.authorAlign = a"
                      :class="['bp-segmented-btn', config.cover.authorAlign === a && 'is-on']"
                    >{{ a }}</button>
                  </div>
                </fieldset>
              </fieldset>

              <label class="block">
                <span class="text-sm font-medium block mb-1">Back cover text</span>
                <textarea
                  v-model="config.cover.backText"
                  rows="4"
                  placeholder="Blurb, quote, or dedication for the back cover."
                  class="bp-text-input resize-y leading-snug"
                ></textarea>
              </label>
              <label class="block max-w-xs" :class="{ 'opacity-60': !config.cover.backText }">
                <span class="text-sm font-medium block mb-1">Back text colour</span>
                <input
                  v-model="config.cover.backTextColor"
                  type="color"
                  :disabled="!config.cover.backText"
                  class="bp-color-input"
                />
              </label>

              <fieldset class="bp-fieldset">
                <legend class="bp-legend">Spoofed ISBN &amp; barcode</legend>
                <p class="text-xs text-ink-lighter mb-2">
                  Generated from the manuscript title. This is a fake ISBN
                  for previewing the back-cover panel only — never use it on
                  a real publication.
                </p>
                <label class="block">
                  <span class="text-sm font-medium block mb-1">ISBN-13 (spoofed)</span>
                  <div class="flex gap-2">
                    <input
                      v-model="config.cover.isbn"
                      type="text"
                      class="bp-text-input flex-1 font-mono"
                      aria-label="Spoofed ISBN-13"
                    />
                    <button type="button" class="bp-btn-ghost" @click="regenerateIsbn">Regenerate</button>
                  </div>
                </label>
                <label class="bp-checkbox mt-2">
                  <input type="checkbox" v-model="config.cover.showBarcode" />
                  <span>Show EAN-13 barcode panel on back cover</span>
                </label>
              </fieldset>
            </div>

            <!-- ============ Step: quality_checks ============ -->
            <div v-else-if="currentStep.id === 'quality_checks'" class="space-y-3">
              <p class="text-sm text-ink-light">
                Detected against the current pagination. Some checks (loose
                lines, rivers) require professional typesetting analysis and
                are reported as not-screened.
              </p>
              <ul class="space-y-2">
                <li
                  v-for="qc in qualityChecks"
                  :key="qc.id"
                  class="bp-card"
                >
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <strong class="text-sm">{{ qc.label }}</strong>
                      <p class="text-xs text-ink-lighter">{{ qc.description }}</p>
                    </div>
                    <span
                      :class="[
                        'bp-pill',
                        qc.count === 0 ? 'is-ok' : qc.count < 0 ? 'is-skip' : 'is-warn',
                      ]"
                    >
                      <template v-if="qc.count < 0">Not screened</template>
                      <template v-else-if="qc.count === 0">OK</template>
                      <template v-else>{{ qc.count }} {{ qc.count === 1 ? 'occurrence' : 'occurrences' }}</template>
                    </span>
                  </div>
                  <div v-if="qc.count > 0 && qc.pages.length" class="text-xs text-ink-light mt-2">
                    Pages: {{ qc.pages.slice(0, 12).join(', ') }}<span v-if="qc.pages.length > 12">…</span>
                  </div>
                </li>
              </ul>
            </div>

            <!-- ============ Step: summary ============ -->
            <div v-else-if="currentStep.id === 'summary'" class="space-y-4">
              <h4 class="text-sm font-medium uppercase tracking-widest text-ink-lighter">Selected settings</h4>
              <dl class="bp-summary">
                <div><dt>Trim size</dt><dd>{{ config.trimSize.label }} ({{ config.trimSize.width }} × {{ config.trimSize.height }} {{ config.trimSize.unit }})</dd></div>
                <div><dt>Body font</dt><dd>{{ config.typography.bodyFont }}</dd></div>
                <div><dt>Font size</dt><dd>{{ config.typography.fontSize }}pt</dd></div>
                <div><dt>Line height</dt><dd>{{ config.typography.lineHeight }}pt</dd></div>
                <div><dt>Margins</dt><dd>top {{ config.margins.top }}″, bottom {{ config.margins.bottom }}″, outside {{ config.margins.outside }}″</dd></div>
                <div><dt>Inside gutter</dt><dd>{{ config.margins.insideGutter }}″</dd></div>
                <div><dt>Estimated page count</dt><dd>{{ estimatedPageCount }}</dd></div>
                <div><dt>Estimated spine eligibility</dt><dd>{{ spineEligibility }}</dd></div>
              </dl>

              <h4 class="text-sm font-medium uppercase tracking-widest text-ink-lighter">Print &amp; export</h4>
              <p class="text-sm text-ink-light">
                Open the on-screen book to flip through pages, or print as
                A5. Use booklet imposition (A4 two-up) when you plan to fold
                the printout in half and saddle-stitch.
              </p>
              <div class="flex flex-wrap gap-2">
                <button type="button" class="bp-btn-primary" @click="openBook">Open on-screen book</button>
                <button type="button" class="bp-btn-ghost" @click="onPrint('a5_single')">Print as A5 (reading order)</button>
                <button type="button" class="bp-btn-ghost" @click="onPrint('a4_booklet_2up')">Print as A5 + booklet hint</button>
                <button type="button" class="bp-btn-ghost" @click="onExportJson">Export settings (JSON)</button>
              </div>
              <p class="text-xs text-ink-lighter">
                For saddle-stitch booklet printing, choose "A5 + booklet hint",
                then in the system Print dialog enable Layout → Booklet (or
                Pages-per-sheet → 2). The OS imposition engine reorders pages
                in book order automatically.
              </p>

              <h4 class="text-sm font-medium uppercase tracking-widest text-ink-lighter">Warnings &amp; recommended fixes</h4>
              <ul v-if="!validation.errors.length && !validation.warnings.length" class="text-sm text-ink-light italic">
                No issues — the configuration follows standard paperback fiction conventions.
              </ul>
              <ul v-else class="space-y-1">
                <li v-for="e in validation.errors" :key="`e-${e.field}`" class="bp-issue is-error">
                  <span class="bp-issue-tag">Error</span>
                  <span>{{ e.message }} <span class="text-ink-lighter">({{ e.field }})</span></span>
                </li>
                <li v-for="w in validation.warnings" :key="`w-${w.field}`" class="bp-issue is-warn">
                  <span class="bp-issue-tag">Warning</span>
                  <span>{{ w.message }} <span class="text-ink-lighter">({{ w.field }})</span></span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- RIGHT: live preview -->
        <div class="bp-preview">
          <div class="bp-preview-toolbar">
            <span class="text-xs uppercase tracking-widest text-ink-lighter">Live preview</span>
            <div class="flex gap-1">
              <button
                v-for="m in previewModes"
                :key="m.id"
                type="button"
                class="bp-toolbar-btn"
                :class="{ 'is-on': previewMode === m.id }"
                @click="previewMode = m.id"
              >{{ m.label }}</button>
            </div>
          </div>

          <div class="bp-preview-stage" ref="previewStage">
            <!-- Spread / single page preview -->
            <div
              v-if="previewMode !== 'cover'"
              class="bp-spread-mini"
              :style="{
                width: (pageWidth * (previewMode === 'single' ? 1 : 2)) + 'px',
                height: pageHeight + 'px',
                background: paperColor,
              }"
            >
              <PreviewPage
                v-if="previewMode !== 'single'"
                side="left"
                :pageHtml="previewLeftHtml"
                :folio="previewLeftFolio"
                :showFolio="previewLeftShowFolio"
                :headerText="previewLeftHeader"
                :showHeader="previewLeftShowHeader"
                :pageWidth="pageWidth"
                :pageHeight="pageHeight"
                :marginTop="marginPx.top"
                :marginBottom="marginPx.bottom"
                :marginInner="marginPx.gutter"
                :marginOuter="marginPx.outside"
                :pageNumberPosition="config.headersAndFooters.pageNumberPosition"
                :flowStyle="flowTypographyStyle"
                :paperColor="paperColor"
              />
              <PreviewPage
                side="right"
                :pageHtml="previewRightHtml"
                :folio="previewRightFolio"
                :showFolio="previewRightShowFolio"
                :headerText="previewRightHeader"
                :showHeader="previewRightShowHeader"
                :pageWidth="pageWidth"
                :pageHeight="pageHeight"
                :marginTop="marginPx.top"
                :marginBottom="marginPx.bottom"
                :marginInner="marginPx.gutter"
                :marginOuter="marginPx.outside"
                :pageNumberPosition="config.headersAndFooters.pageNumberPosition"
                :flowStyle="flowTypographyStyle"
                :paperColor="paperColor"
              />
            </div>

            <!-- Cover preview -->
            <div
              v-else
              class="bp-cover-spread"
              :style="{ width: (pageWidth * 2 + 18) + 'px', height: pageHeight + 'px' }"
            >
              <div
                class="bp-cover bp-cover-back"
                :style="{ width: pageWidth + 'px', height: pageHeight + 'px' }"
              >
                <div class="bp-cover-bg" :style="backCoverBgStyle"></div>
                <div class="bp-cover-content">
                  <div
                    class="bp-cover-back-stack"
                    :class="{ 'has-back-text': !!config.cover.backText }"
                  >
                    <p class="bp-cover-back-title">{{ manuscript.title }}</p>
                    <div
                      v-if="config.cover.backText"
                      ref="backTextWrap"
                      class="bp-cover-back-text-wrap"
                    >
                      <p
                        ref="backTextEl"
                        class="bp-cover-back-text"
                        :style="{ color: config.cover.backTextColor }"
                      >{{ config.cover.backText }}</p>
                    </div>
                    <p v-if="config.cover.authorName" class="bp-cover-back-author">
                      {{ config.cover.authorName }}
                    </p>
                    <div v-if="config.cover.showBarcode && config.cover.isbn" class="bp-barcode-panel">
                      <div class="bp-barcode-svg" v-html="barcodeMarkup"></div>
                      <div class="bp-barcode-isbn">ISBN {{ config.cover.isbn }}</div>
                    </div>
                  </div>
                </div>
                <div class="bp-cover-spine bp-cover-spine-back"></div>
              </div>
              <div class="bp-cover-gap"></div>
              <div
                class="bp-cover bp-cover-front"
                :style="{ width: pageWidth + 'px', height: pageHeight + 'px' }"
              >
                <div class="bp-cover-bg" :style="frontCoverBgStyle"></div>
                <div class="bp-cover-content">
                  <div class="bp-cover-title-block" :style="coverTitleStyle">
                    <h2 class="bp-cover-title" :style="coverTitleTextStyle">{{ manuscript.title }}</h2>
                    <p v-if="manuscript.workingSubtitle" class="bp-cover-subtitle">
                      {{ manuscript.workingSubtitle }}
                    </p>
                  </div>
                  <div
                    v-if="config.cover.authorName"
                    class="bp-cover-author-block"
                    :style="coverAuthorStyle"
                  >
                    {{ config.cover.authorName }}
                  </div>
                </div>
                <div class="bp-cover-spine"></div>
              </div>
            </div>
          </div>

          <!-- Hidden measurement layer used to paginate via CSS columns -->
          <div class="bp-measure" aria-hidden="true">
            <div
              ref="measureContainer"
              class="bp-measure-flow"
              :style="{
                width: contentWidth + 'px',
                height: contentHeight + 'px',
                columnWidth: contentWidth + 'px',
                ...flowTypographyStyle,
              }"
              v-html="bookFlowHtml"
            ></div>
          </div>
        </div>
      </div>

      <!-- Bottom action / status bar -->
      <footer class="bp-wizard-footer">
        <div class="bp-footer-status">
          <span class="bp-pill" :class="validation.errors.length ? 'is-error' : (validation.warnings.length ? 'is-warn' : 'is-ok')">
            <span v-if="validation.errors.length">{{ validation.errors.length }} error{{ validation.errors.length === 1 ? '' : 's' }}</span>
            <span v-else-if="validation.warnings.length">{{ validation.warnings.length }} warning{{ validation.warnings.length === 1 ? '' : 's' }}</span>
            <span v-else>OK</span>
          </span>
          <span class="text-xs text-ink-light">
            {{ estimatedPageCount }} pages · {{ config.profileName }}
            <template v-if="currentVersionNumber !== null">
              · Draft v{{ currentVersionNumber }}<template v-if="currentDraftLabel"> ({{ currentDraftLabel }})</template>
            </template>
            <template v-else>
              · Unsaved draft
            </template>
          </span>
          <span v-if="lastSavedAt" class="text-xs text-ink-lighter">Saved {{ lastSavedAt }}</span>
        </div>
        <div class="bp-footer-actions">
          <button
            type="button"
            class="bp-btn-ghost"
            @click="prevStep"
            :disabled="currentStepIndex === 0"
          >Back</button>
          <button
            type="button"
            class="bp-btn-ghost"
            @click="openSavePrompt"
            :disabled="isSaving"
          >{{ isSaving ? 'Saving…' : 'Save…' }}</button>
          <button
            type="button"
            class="bp-btn-primary"
            @click="onPrimaryAction"
          >{{ primaryActionLabel }}</button>
        </div>
      </footer>

      <!-- ===========================================================
           Save-prompt dialog. Appears on Save; collects the user's
           draft label and version number. The version field defaults
           to (next available) for new drafts or the loaded draft's
           current number for updates. Errors from the server (e.g.
           version collision) surface inline.
           =========================================================== -->
      <div
        v-if="showSavePrompt"
        class="bp-save-prompt-overlay fixed inset-0 z-[60] bg-black/50 flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-label="Save printing"
        @click.self="cancelSavePrompt"
      >
        <form
          class="bp-save-prompt bg-paper text-ink rounded shadow-lg p-6 w-full max-w-md"
          @submit.prevent="confirmSavePrompt"
        >
          <h3 class="text-lg font-light tracking-tight mb-4">
            {{ currentPrintingId ? 'Update saved printing' : 'Save printing' }}
          </h3>

          <label class="block mb-3">
            <span class="block text-xs uppercase tracking-wide text-ink-light mb-1">
              Draft name / label
            </span>
            <input
              type="text"
              class="bp-input w-full"
              v-model="savePromptLabel"
              maxlength="120"
              placeholder="e.g. First galley, Final cover, Trial"
              autofocus
            />
          </label>

          <label class="block mb-3">
            <span class="block text-xs uppercase tracking-wide text-ink-light mb-1">
              Version number
            </span>
            <input
              type="number"
              class="bp-input w-full"
              v-model.number="savePromptVersion"
              min="1"
              step="1"
              required
            />
            <span class="block text-xs text-ink-lighter mt-1">
              Must be unique within this manuscript's printings for your account.
            </span>
          </label>

          <p
            v-if="savePromptError"
            class="text-sm text-red-600 mb-3"
            role="alert"
          >{{ savePromptError }}</p>

          <div class="flex items-center justify-end gap-2 pt-2 border-t border-line">
            <button
              type="button"
              class="bp-btn-ghost"
              @click="cancelSavePrompt"
              :disabled="isSaving"
            >Cancel</button>
            <button
              type="submit"
              class="bp-btn-primary"
              :disabled="isSaving"
            >{{ isSaving ? 'Saving…' : (currentPrintingId ? 'Update' : 'Save') }}</button>
          </div>
        </form>
      </div>
    </section>

    <!-- =================================================================
         STAGE: book — interactive on-screen book viewer
         ================================================================= -->
    <div
      v-else-if="stage === 'book'"
      class="bp-stage"
      @click.self="emit('close')"
    >
      <div class="bp-topbar">
        <button type="button" class="bp-btn" @click="stage = 'wizard'">&larr; Wizard</button>
        <div class="bp-progress">
          <span v-if="bookState === 'closed-front'">Front cover</span>
          <span v-else-if="bookState === 'closed-back'">Back cover</span>
          <span v-else>{{ progressLabel }}</span>
        </div>
        <div class="flex gap-2">
          <button type="button" class="bp-btn" @click="onPrint('a5_single')">Print A5</button>
          <button type="button" class="bp-btn" @click="onPrint('a4_booklet_2up')" title="Open print dialog for booklet (use OS booklet/2-up option)">Print booklet</button>
          <button type="button" class="bp-btn" @click="emit('close')">Close</button>
        </div>
      </div>

      <div class="bp-book-wrap">
        <!-- Closed front cover -->
        <div
          v-if="bookState === 'closed-front'"
          class="bp-cover bp-cover-front"
          :style="{ width: pageWidth + 'px', height: pageHeight + 'px' }"
          @click="openFromFront"
          role="button"
          aria-label="Open book"
          tabindex="0"
          @keydown.enter="openFromFront"
          @keydown.space.prevent="openFromFront"
        >
          <div class="bp-cover-bg" :style="frontCoverBgStyle"></div>
          <div class="bp-cover-content">
            <div class="bp-cover-title-block" :style="coverTitleStyle">
              <h2 class="bp-cover-title" :style="coverTitleTextStyle">{{ manuscript.title }}</h2>
              <p v-if="manuscript.workingSubtitle" class="bp-cover-subtitle">
                {{ manuscript.workingSubtitle }}
              </p>
            </div>
            <div
              v-if="config.cover.authorName"
              class="bp-cover-author-block"
              :style="coverAuthorStyle"
            >
              {{ config.cover.authorName }}
            </div>
          </div>
          <div class="bp-cover-spine"></div>
        </div>

        <!-- Open spread -->
        <div
          v-else-if="bookState === 'open'"
          class="bp-spread"
          :style="{
            width: (pageWidth * 2) + 'px',
            height: pageHeight + 'px',
            background: paperColor,
          }"
        >
          <PreviewPage
            side="left"
            :pageHtml="pageHtml(currentSpread.left)"
            :folio="folioFor(currentSpread.left)"
            :showFolio="showFolio(currentSpread.left)"
            :headerText="headerFor(currentSpread.left, 'left')"
            :showHeader="showHeaderFor(currentSpread.left)"
            :pageWidth="pageWidth"
            :pageHeight="pageHeight"
            :marginTop="marginPx.top"
            :marginBottom="marginPx.bottom"
            :marginInner="marginPx.gutter"
            :marginOuter="marginPx.outside"
            :pageNumberPosition="config.headersAndFooters.pageNumberPosition"
            :flowStyle="flowTypographyStyle"
            :paperColor="paperColor"
            @click="prevSpread"
          />
          <div class="bp-spine-shadow"></div>
          <PreviewPage
            side="right"
            :pageHtml="pageHtml(currentSpread.right)"
            :folio="folioFor(currentSpread.right)"
            :showFolio="showFolio(currentSpread.right)"
            :headerText="headerFor(currentSpread.right, 'right')"
            :showHeader="showHeaderFor(currentSpread.right)"
            :pageWidth="pageWidth"
            :pageHeight="pageHeight"
            :marginTop="marginPx.top"
            :marginBottom="marginPx.bottom"
            :marginInner="marginPx.gutter"
            :marginOuter="marginPx.outside"
            :pageNumberPosition="config.headersAndFooters.pageNumberPosition"
            :flowStyle="flowTypographyStyle"
            :paperColor="paperColor"
            @click="nextSpread"
          />
        </div>

        <!-- Closed back cover -->
        <div
          v-else-if="bookState === 'closed-back'"
          class="bp-cover bp-cover-back"
          :style="{ width: pageWidth + 'px', height: pageHeight + 'px' }"
          @click="reopenFromBack"
          role="button"
          aria-label="Reopen book"
          tabindex="0"
          @keydown.enter="reopenFromBack"
          @keydown.space.prevent="reopenFromBack"
        >
          <div class="bp-cover-bg" :style="backCoverBgStyle"></div>
          <div class="bp-cover-content">
            <div
              class="bp-cover-back-stack"
              :class="{ 'has-back-text': !!config.cover.backText }"
            >
              <p class="bp-cover-back-title">{{ manuscript.title }}</p>
              <div
                v-if="config.cover.backText"
                ref="backTextWrapBook"
                class="bp-cover-back-text-wrap"
              >
                <p
                  ref="backTextElBook"
                  class="bp-cover-back-text"
                  :style="{ color: config.cover.backTextColor }"
                >{{ config.cover.backText }}</p>
              </div>
              <p v-if="config.cover.authorName" class="bp-cover-back-author">
                {{ config.cover.authorName }}
              </p>
              <div v-if="config.cover.showBarcode && config.cover.isbn" class="bp-barcode-panel">
                <div class="bp-barcode-svg" v-html="barcodeMarkup"></div>
                <div class="bp-barcode-isbn">ISBN {{ config.cover.isbn }}</div>
              </div>
            </div>
          </div>
          <div class="bp-cover-spine bp-cover-spine-back"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount, h, defineComponent, type PropType } from 'vue'
import { api } from '../../api/client'
import { bookPrintingApi } from '../../api/bookPrinting'
import { renderMarkdown } from '../../utils/markdown'
import type { ApiResponse } from '@shared/ApiResponses'
import type {
  ManuscriptProject,
  ManuscriptSection,
  ManuscriptItem,
} from '@shared/Manuscript'
import type {
  BookPrinting,
  BookPrintingInput,
  BookPrintingSummary,
} from '@shared/BookPrinting'
import type { WritingBlock } from '../../domain/WritingBlock'
import type {
  PreviewConfig,
  FrontMatterKey,
  BackMatterKey,
  QualityCheckResult,
} from './bookPreview/types'
import {
  TRIM_SIZE_OPTIONS as trimOptions,
  BODY_FONT_OPTIONS as bodyFontOptions,
  FRONT_MATTER_OPTIONS as frontMatterOptions,
  BACK_MATTER_OPTIONS as backMatterOptions,
  WIZARD_STEPS,
  defaultPaperbackProfile,
  trimInches,
} from './bookPreview/defaults'
import { validateConfig } from './bookPreview/validation'
import { spoofIsbn, barcodeSvg } from './bookPreview/isbn'
import { buildNaturalPrintHtml, openPrintWindow, type PrintLayout } from './bookPreview/print'

// ---- Props / emits ----
const props = defineProps<{
  open: boolean
  manuscript: ManuscriptProject
  sections: ManuscriptSection[]
  items: ManuscriptItem[]
}>()

const emit = defineEmits<{ (e: 'close'): void }>()

// ---- Top-level stage state ----
const stage = ref<'chooser' | 'wizard' | 'book'>('wizard')
const bookState = ref<'closed-front' | 'open' | 'closed-back'>('closed-front')

// ---- Wizard step state ----
const steps = WIZARD_STEPS
const currentStepIndex = ref(0)
const currentStep = computed(() => steps[currentStepIndex.value])

function goToStep(i: number) {
  if (i < 0 || i >= steps.length) return
  currentStepIndex.value = i
}
function prevStep() { if (currentStepIndex.value > 0) currentStepIndex.value-- }
function nextStep() { if (currentStepIndex.value < steps.length - 1) currentStepIndex.value++ }

// ---- Configuration (single source of truth) ----
//
// The wizard works with a deeply-nested PreviewConfig in memory. Persistence
// goes through the /api/manuscripts/:id/printings endpoints, which save each
// setting to its own column in the book_printings table (no JSON blob).
// Each saved row is one "printing" — a user-defined draft identified by a
// version_number plus an optional draftLabel. The drafts picker at the top
// of the wizard switches between them.

/** Strip wizard-only fields from PreviewConfig down to the wire input shape. */
function configToInput(c: PreviewConfig, draftLabel: string): BookPrintingInput {
  return {
    draftLabel,
    profileName: c.profileName,
    trimSize: c.trimSize,
    margins: {
      top: c.margins.top,
      bottom: c.margins.bottom,
      outside: c.margins.outside,
      insideGutter: c.margins.insideGutter,
    },
    typography: c.typography,
    paragraphs: c.paragraphs,
    chapters: c.chapters,
    sceneBreaks: c.sceneBreaks,
    headersAndFooters: c.headersAndFooters,
    frontMatter: c.frontMatter,
    backMatter: c.backMatter,
    matterContent: c.matterContent,
    paper: c.paper,
    cover: c.cover,
  }
}

/** Hydrate a saved BookPrinting back into a PreviewConfig the wizard understands. */
function printingToConfig(p: BookPrinting): PreviewConfig {
  return {
    id: p.id,
    projectId: p.manuscriptId,
    profileName: p.profileName,
    trimSize: p.trimSize,
    margins: { ...p.margins, unit: 'in' as const },
    typography: p.typography,
    paragraphs: p.paragraphs,
    chapters: p.chapters,
    sceneBreaks: p.sceneBreaks,
    headersAndFooters: p.headersAndFooters,
    frontMatter: p.frontMatter,
    backMatter: p.backMatter,
    matterContent: p.matterContent,
    paper: p.paper,
    cover: p.cover,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
}

const config = ref<PreviewConfig>(defaultPaperbackProfile(props.manuscript.id))
// Spoof an ISBN deterministically on first load if missing.
if (!config.value.cover.isbn) {
  config.value.cover.isbn = spoofIsbn(props.manuscript.title || props.manuscript.id)
}

const lastSavedAt = ref<string | null>(null)
const isSaving = ref(false)

// ---- Drafts / versions state ----
const drafts = ref<BookPrintingSummary[]>([])
/** id of the currently-loaded printing, or null when this is unsaved (new). */
const currentPrintingId = ref<string | null>(null)
const currentDraftLabel = ref<string>('')
const currentVersionNumber = ref<number | null>(null)
const draftsLoading = ref(false)

function regenerateIsbn() {
  config.value.cover.isbn = spoofIsbn(`${props.manuscript.title || props.manuscript.id}#${Date.now()}`)
}

function resetToDefaults() {
  if (!confirm('Restore the Modern Trade Paperback Fiction defaults? Cover artwork and the ISBN will be re-generated.')) return
  const fresh = defaultPaperbackProfile(props.manuscript.id)
  fresh.cover.isbn = spoofIsbn(props.manuscript.title || props.manuscript.id)
  config.value = fresh
  frontCoverUrl.value = null
  backCoverUrl.value = null
}

async function refreshDrafts(): Promise<BookPrintingSummary[]> {
  draftsLoading.value = true
  try {
    drafts.value = await bookPrintingApi.list(props.manuscript.id)
    return drafts.value
  } finally {
    draftsLoading.value = false
  }
}

/**
 * Load the printing for the given id. If `id` is null, leave the wizard
 * with its current in-memory config and clear the "currently-loaded"
 * marker so the next save creates a new draft.
 */
async function loadDraft(id: string | null) {
  if (!id) {
    currentPrintingId.value = null
    currentVersionNumber.value = null
    currentDraftLabel.value = ''
    return
  }
  const printing = await bookPrintingApi.get(props.manuscript.id, id)
  config.value = printingToConfig(printing)
  currentPrintingId.value = printing.id
  currentVersionNumber.value = printing.versionNumber
  currentDraftLabel.value = printing.draftLabel
  if (!config.value.cover.isbn) {
    config.value.cover.isbn = spoofIsbn(props.manuscript.title || props.manuscript.id)
  }
}

function onDraftSelect(ev: Event) {
  const value = (ev.target as HTMLSelectElement).value
  void loadDraft(value || null)
}

// ---- Save prompt state ----
//
// Save always goes through a confirm dialog that asks for a draft label
// and a version number. When updating an existing draft the dialog
// pre-fills with that draft's current values; when creating, the
// version number defaults to (highest existing + 1) so most writers
// can accept the suggestion without thinking.
const showSavePrompt = ref(false)
const savePromptLabel = ref('')
const savePromptVersion = ref<number>(1)
const savePromptError = ref<string | null>(null)

function nextSuggestedVersion(): number {
  const highest = drafts.value.reduce((max, d) => Math.max(max, d.versionNumber), 0)
  return highest + 1
}

function openSavePrompt() {
  savePromptError.value = null
  if (currentPrintingId.value && currentVersionNumber.value !== null) {
    savePromptLabel.value = currentDraftLabel.value
    savePromptVersion.value = currentVersionNumber.value
  } else {
    savePromptLabel.value = currentDraftLabel.value
    savePromptVersion.value = nextSuggestedVersion()
  }
  showSavePrompt.value = true
}

function cancelSavePrompt() {
  showSavePrompt.value = false
  savePromptError.value = null
}

/**
 * Commit the save from the dialog. Sends the user-supplied label and
 * version number; if either field is invalid (empty version, collides
 * with another draft, etc.) the server responds with a 400 and we
 * surface the error inline.
 */
async function confirmSavePrompt() {
  if (isSaving.value) return
  const versionNumber = Math.floor(Number(savePromptVersion.value))
  if (!Number.isFinite(versionNumber) || versionNumber < 1) {
    savePromptError.value = 'Version number must be a whole number, 1 or greater.'
    return
  }
  const label = savePromptLabel.value.trim()
  isSaving.value = true
  savePromptError.value = null
  try {
    const input: BookPrintingInput = {
      ...configToInput(config.value, label),
      versionNumber,
    }
    let printing: BookPrinting
    if (currentPrintingId.value) {
      printing = await bookPrintingApi.update(
        props.manuscript.id,
        currentPrintingId.value,
        input
      )
    } else {
      printing = await bookPrintingApi.create(props.manuscript.id, input)
      currentPrintingId.value = printing.id
    }
    currentVersionNumber.value = printing.versionNumber
    currentDraftLabel.value = printing.draftLabel
    config.value.updatedAt = printing.updatedAt
    lastSavedAt.value = new Date().toLocaleTimeString()
    await refreshDrafts()
    showSavePrompt.value = false
  } catch (err) {
    savePromptError.value = err instanceof Error ? err.message : String(err)
  } finally {
    isSaving.value = false
  }
}

/** Start a fresh draft from the current settings — next save creates a new version. */
function newDraft() {
  currentPrintingId.value = null
  currentVersionNumber.value = null
  currentDraftLabel.value = ''
  lastSavedAt.value = null
}

async function deleteCurrentDraft() {
  if (!currentPrintingId.value) return
  if (!confirm(`Delete draft v${currentVersionNumber.value}? This cannot be undone.`)) return
  try {
    await bookPrintingApi.delete(props.manuscript.id, currentPrintingId.value)
    currentPrintingId.value = null
    currentVersionNumber.value = null
    currentDraftLabel.value = ''
    lastSavedAt.value = null
    await refreshDrafts()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    alert(`Could not delete printing: ${message}`)
  }
}

function onExportJson() {
  const blob = new Blob([JSON.stringify(config.value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `book-preview-${(props.manuscript.title || 'manuscript').replace(/\W+/g, '-')}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ---- Manuscript selection (Step 0) ----
const sortedSections = computed(() =>
  [...props.sections].sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt))
)
const itemsBySection = computed(() => {
  const map = new Map<string, ManuscriptItem[]>()
  for (const s of props.sections) map.set(s.id, [])
  for (const it of props.items) {
    if (it.sectionId && map.has(it.sectionId)) map.get(it.sectionId)!.push(it)
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt))
  }
  return map
})
const unassignedItems = computed(() =>
  props.items
    .filter(i => !i.sectionId || !props.sections.some(s => s.id === i.sectionId))
    .sort((a, b) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt))
)
const allSelectableItemIds = computed(() => [
  ...sortedSections.value.flatMap(s => (itemsBySection.value.get(s.id) || []).map(i => i.id)),
  ...unassignedItems.value.map(i => i.id),
])
const selectedItemIds = ref<string[]>([])

function selectAll() { selectedItemIds.value = [...allSelectableItemIds.value] }
function clearAll() { selectedItemIds.value = [] }
function isSectionFullySelected(sectionId: string): boolean {
  const ids = (itemsBySection.value.get(sectionId) || []).map(i => i.id)
  return ids.length > 0 && ids.every(id => selectedItemIds.value.includes(id))
}
function isSectionPartiallySelected(sectionId: string): boolean {
  const ids = (itemsBySection.value.get(sectionId) || []).map(i => i.id)
  const sel = ids.filter(id => selectedItemIds.value.includes(id)).length
  return sel > 0 && sel < ids.length
}
function onSectionCheckboxChange(sectionId: string, ev: Event) {
  toggleSection(sectionId, (ev.target as HTMLInputElement).checked)
}
function toggleSection(sectionId: string, on: boolean) {
  const ids = (itemsBySection.value.get(sectionId) || []).map(i => i.id)
  if (on) selectedItemIds.value = [...new Set([...selectedItemIds.value, ...ids])]
  else { const drop = new Set(ids); selectedItemIds.value = selectedItemIds.value.filter(id => !drop.has(id)) }
}
function toggleFrontMatter(key: FrontMatterKey, on: boolean) {
  const cur = new Set(config.value.frontMatter)
  if (on) cur.add(key); else cur.delete(key)
  config.value.frontMatter = [...cur]
}
function toggleBackMatter(key: BackMatterKey, on: boolean) {
  const cur = new Set(config.value.backMatter)
  if (on) cur.add(key); else cur.delete(key)
  config.value.backMatter = [...cur]
}

/**
 * Pick up where the writer left off. On open we always check what's
 * already saved for this manuscript before deciding which stage to
 * show:
 *   - If there are saved printings → show the chooser so the writer
 *     decides between loading one and starting a fresh wizard run.
 *   - If none exist → drop straight into the wizard with factory
 *     defaults; there is nothing to choose between.
 */
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    bookState.value = 'closed-front'
    currentSpreadIndex.value = 0
    if (!selectedItemIds.value.length) {
      selectedItemIds.value = [...allSelectableItemIds.value]
    }
    // Pre-fetch chapter bodies so the live preview shows real content
    // instead of "(Body not loaded.)" placeholders.
    void loadBodiesForSelected()
    // Show the chooser stage while drafts load; on result, either keep
    // the chooser open (drafts exist — writer picks) or go straight to
    // the wizard with factory defaults.
    stage.value = 'chooser'
    void refreshDrafts().then(list => {
      if (list.length === 0) {
        stage.value = 'wizard'
      }
    })
  }
}, { immediate: true })

/** Chooser → wizard: load the picked draft, then enter the wizard. */
async function chooseDraft(printingId: string) {
  await loadDraft(printingId)
  stage.value = 'wizard'
}

/** Chooser → wizard: discard any in-flight load, start from defaults. */
function chooseNewWizard() {
  const fresh = defaultPaperbackProfile(props.manuscript.id)
  fresh.cover.isbn = spoofIsbn(props.manuscript.title || props.manuscript.id)
  config.value = fresh
  currentPrintingId.value = null
  currentVersionNumber.value = null
  currentDraftLabel.value = ''
  lastSavedAt.value = null
  stage.value = 'wizard'
}

// When the user changes the included items mid-wizard, fetch any newly
// selected bodies so the preview keeps up.
watch(selectedItemIds, () => { void loadBodiesForSelected() })

// ---- Cover image data URLs ----
const frontCoverUrl = ref<string | null>(null)
const backCoverUrl = ref<string | null>(null)

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}
async function onFrontCoverChosen(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  frontCoverUrl.value = await readFileAsDataUrl(f)
}
async function onBackCoverChosen(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  backCoverUrl.value = await readFileAsDataUrl(f)
}

// ---- Page geometry ----
const viewportH = ref(typeof window !== 'undefined' ? window.innerHeight : 1000)
const viewportW = ref(typeof window !== 'undefined' ? window.innerWidth : 1600)
function onResize() { viewportH.value = window.innerHeight; viewportW.value = window.innerWidth }
onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))

const TOPBAR_PX = 56

const pageDims = computed(() => {
  const trim = trimInches(config.value.trimSize)
  const aspect = trim.height / trim.width
  // Available area depends on stage. For wizard, the right pane is roughly
  // 55% of viewport width and the inner stage gets ~70vh. For book stage,
  // we're centred with about 92vh and 100vw available.
  const availH = stage.value === 'book'
    ? Math.max(360, viewportH.value - TOPBAR_PX - 40)
    : Math.max(280, viewportH.value * 0.68)
  const availW = stage.value === 'book'
    ? Math.max(360, viewportW.value - 96)
    : Math.max(360, viewportW.value * 0.55 - 48)

  let pageH = availH
  let pageW = pageH / aspect
  if (pageW * 2 + 12 > availW) {
    pageW = (availW - 12) / 2
    pageH = pageW * aspect
  }
  // Clamp the page to a sensible range so tiny viewports stay readable.
  pageW = Math.max(180, Math.floor(pageW))
  pageH = Math.max(180 * aspect, Math.floor(pageH))
  return { pageW, pageH }
})
const pageWidth = computed(() => pageDims.value.pageW)
const pageHeight = computed(() => pageDims.value.pageH)

/** px-per-inch effective scale based on the rendered page size. */
const screenDpi = computed(() => {
  const trim = trimInches(config.value.trimSize)
  return pageWidth.value / trim.width
})

const marginPx = computed(() => {
  const dpi = screenDpi.value
  return {
    top: Math.round(config.value.margins.top * dpi),
    bottom: Math.round(config.value.margins.bottom * dpi),
    outside: Math.round(config.value.margins.outside * dpi),
    gutter: Math.round(config.value.margins.insideGutter * dpi),
  }
})

const contentWidth = computed(() => Math.max(80, pageWidth.value - marginPx.value.outside - marginPx.value.gutter))
const contentHeight = computed(() => Math.max(80, pageHeight.value - marginPx.value.top - marginPx.value.bottom))

// ---- Typography (screen) ----
const flowTypographyStyle = computed(() => {
  // Scale point sizes by the same DPI as the page so the on-screen preview
  // shows true-relative type. We don't render at exact print resolution, but
  // the ratios match.
  const dpi = screenDpi.value
  const pxPerPt = dpi / 72
  const fontPx = config.value.typography.fontSize * pxPerPt
  const lineRatio = config.value.typography.lineHeight / config.value.typography.fontSize
  const indentPx = config.value.paragraphs.firstLineIndent * dpi
  const paraSpacingPx = config.value.paragraphs.paragraphSpacing * pxPerPt
  return {
    fontFamily: bodyFontStack.value,
    fontSize: fontPx + 'px',
    lineHeight: String(lineRatio),
    textAlign: (config.value.typography.alignment === 'justified' ? 'justify' : 'left') as 'justify' | 'left',
    hyphens: (config.value.typography.hyphenation ? 'auto' : 'manual') as 'auto' | 'manual',
    '--bp-indent': indentPx + 'px',
    '--bp-para-space': paraSpacingPx + 'px',
    '--bp-paper-color': paperColor.value,
  }
})

const bodyFontStack = computed(() => {
  // Use the chosen face name first, then a serif fallback chain so the
  // browser still renders something sensible if the user has only the
  // system fonts available.
  const f = config.value.typography.bodyFont
  return `"${f}", "Iowan Old Style", Georgia, "Times New Roman", serif`
})

const paperColor = computed(() => config.value.paper.color === 'white' ? '#ffffff' : '#f4ecdd')

// ---- Build the book HTML flow ----
const loadingBodies = ref(false)
const loadError = ref<string | null>(null)
const bodyById = ref<Map<string, string>>(new Map())

// Cache rendered markdown by writingBlockId. renderMarkdown can be slow for
// long essays, and bookFlowHtml depends on enough fields that even unrelated
// settings (chapter title style, scene break symbol, author name keystrokes)
// would otherwise re-run renderMarkdown for every essay each time. Caching
// here means renderMarkdown only runs when the underlying body changes.
const renderedHtmlById = computed<Map<string, string>>(() => {
  const map = new Map<string, string>()
  for (const [id, body] of bodyById.value) {
    map.set(id, body ? renderMarkdown(body) : '<p><em>(Body not loaded.)</em></p>')
  }
  return map
})

async function loadBodiesForSelected(): Promise<void> {
  loadingBodies.value = true
  loadError.value = null
  try {
    const essayItems = props.items.filter(
      it => selectedItemIds.value.includes(it.id) && it.itemType === 'essay' && it.writingBlockId,
    )
    const need = essayItems
      .map(it => it.writingBlockId!)
      .filter(id => !bodyById.value.has(id))
    const fresh = await Promise.all(
      need.map(id =>
        api
          .get<ApiResponse<WritingBlock>>(`/writing/${id}`)
          .then(r => ({ id, body: r.data?.body || '' }))
          .catch(() => ({ id, body: '' })),
      ),
    )
    const next = new Map(bodyById.value)
    for (const { id, body } of fresh) next.set(id, body)
    bodyById.value = next
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : 'Failed to load chapter content'
  } finally {
    loadingBodies.value = false
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** HTML-escape, then turn newlines into <br> for short single-block fields
 *  (dedication, epigraph) where line breaks are meaningful but full
 *  paragraphing would over-format. */
function escapeMultilineHtml(s: string): string {
  return escapeHtml(s).replace(/\n/g, '<br>')
}

/** HTML-escape and split blank-line-separated text into <p> blocks. Used
 *  for back-matter sections (acknowledgements, author note, bio) where the
 *  user typically writes multi-paragraph content. */
function paragraphsFromText(s: string): string {
  if (!s.trim()) return ''
  return s
    .split(/\n\s*\n/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function chapterHeaderText(ci: number, title: string): string {
  switch (config.value.chapters.chapterTitleStyle) {
    case 'chapter_number': return String(ci + 1)
    case 'chapter_word_number': return `Chapter ${ci + 1}`
    case 'title_only': return title
    case 'number_and_title': return `${ci + 1}  ·  ${title}`
  }
}

function sceneBreakHtml(): string {
  const s = config.value.sceneBreaks
  if (s.style === 'blank_line') {
    return `<p class="bp-scene-break bp-scene-break-blank" aria-hidden="true">&nbsp;</p>`
  }
  const sym = s.style === 'centered_asterisks' ? '* * *' : (s.symbol || '* * *')
  return `<p class="bp-scene-break bp-scene-break-symbol">${escapeHtml(sym)}</p>`
}

const openingPaddingTop = computed(() => {
  switch (config.value.chapters.chapterOpeningPosition) {
    case 'top': return '0%'
    case 'centered_high': return '20%'
    case 'upper_third':
    default: return '32%'
  }
})

const chapters = computed(() => {
  const selSet = new Set(selectedItemIds.value)
  const chList: { title: string; items: ManuscriptItem[] }[] = []

  if (config.value.chapters.chaptersFromItems) {
    // Per-item chapters. Each essay (or placeholder / bridge) becomes its
    // own chapter, with the item's title used as the chapter title. The
    // section structure is preserved in the order — items keep their
    // section's order — but sections themselves are no longer rendered
    // as chapter containers. This is the right model for essay
    // collections, where each piece is a standalone chapter.
    for (const s of sortedSections.value) {
      const list = (itemsBySection.value.get(s.id) || []).filter(i => selSet.has(i.id))
      for (const item of list) {
        chList.push({ title: item.title || 'Untitled', items: [item] })
      }
    }
    for (const item of unassignedItems.value.filter(i => selSet.has(i.id))) {
      chList.push({ title: item.title || 'Untitled', items: [item] })
    }
  } else {
    // Section-based chapters (legacy). Each section is one chapter;
    // multiple items within flow with scene breaks between them.
    for (const s of sortedSections.value) {
      const list = (itemsBySection.value.get(s.id) || []).filter(i => selSet.has(i.id))
      if (list.length) chList.push({ title: s.title || 'Untitled', items: list })
    }
    const orphans = unassignedItems.value.filter(i => selSet.has(i.id))
    if (orphans.length) chList.push({ title: 'Other', items: orphans })
  }

  return chList
})

const bookFlowHtml = computed(() => {
  const m = props.manuscript
  const fm = new Set(config.value.frontMatter)
  const bm = new Set(config.value.backMatter)
  const author = config.value.cover.authorName
  const parts: string[] = []

  // ---- Front matter (in conventional order) ----
  const matter = config.value.matterContent
  if (fm.has('half_title')) {
    parts.push(`<section class="bp-frontmatter bp-page-break-before bp-page-break-after"><div class="bp-half-title">${escapeHtml(m.title)}</div></section>`)
  }
  if (fm.has('also_by_author')) {
    const lines = (matter.alsoByFront || '').split(/\r?\n/).filter(s => s.trim())
    const inner = lines.length
      ? lines.map(l => `<p class="bp-fm-line">${escapeHtml(l)}</p>`).join('')
      : `<p class="bp-fm-line">—</p>`
    parts.push(`<section class="bp-frontmatter bp-page-break-before bp-page-break-after"><h3 class="bp-fm-h">Also by the author</h3>${inner}</section>`)
  }
  if (fm.has('title_page')) {
    parts.push(
      `<section class="bp-titlepage bp-page-break-before bp-page-break-after">
         <h1 class="bp-book-title">${escapeHtml(m.title)}</h1>
         ${m.workingSubtitle ? `<p class="bp-book-subtitle">${escapeHtml(m.workingSubtitle)}</p>` : ''}
         ${author ? `<p class="bp-book-author">${escapeHtml(author)}</p>` : ''}
       </section>`,
    )
  }
  if (fm.has('copyright_page')) {
    parts.push(
      `<section class="bp-frontmatter bp-page-break-before bp-page-break-after">
         <p class="bp-fm-line">${escapeHtml(m.title)}</p>
         ${author ? `<p class="bp-fm-line">© ${new Date().getFullYear()} ${escapeHtml(author)}.</p>` : ''}
         <p class="bp-fm-line">All rights reserved.</p>
         ${config.value.cover.isbn ? `<p class="bp-fm-line">ISBN ${escapeHtml(config.value.cover.isbn)}</p>` : ''}
         <p class="bp-fm-line">First edition.</p>
       </section>`,
    )
  }
  if (fm.has('dedication')) {
    const text = matter.dedication.trim() || 'For…'
    parts.push(`<section class="bp-frontmatter bp-page-break-before bp-page-break-after"><p class="bp-dedication">${escapeMultilineHtml(text)}</p></section>`)
  }
  if (fm.has('epigraph')) {
    const text = matter.epigraph.trim() || 'An epigraph would sit here.'
    const attribution = matter.epigraphAttribution.trim()
    parts.push(
      `<section class="bp-frontmatter bp-page-break-before bp-page-break-after">
         <blockquote class="bp-epigraph">${escapeMultilineHtml(text)}</blockquote>
         ${attribution ? `<p class="bp-epigraph-attribution">${escapeHtml(attribution)}</p>` : ''}
       </section>`,
    )
  }
  if (fm.has('contents') && chapters.value.length) {
    const lis = chapters.value.map((c, i) => `<li><span class="bp-toc-num">${i + 1}.</span> ${escapeHtml(c.title)}</li>`).join('')
    parts.push(
      `<section class="bp-toc bp-page-break-before bp-page-break-after">
         <h2 class="bp-h2">Contents</h2>
         <ol class="bp-toc-list">${lis}</ol>
       </section>`,
    )
  }

  // ---- Chapters ----
  for (let ci = 0; ci < chapters.value.length; ci++) {
    const c = chapters.value[ci]
    const headerText = chapterHeaderText(ci, c.title)
    const dropCapClass = config.value.chapters.dropCap ? 'bp-has-drop-cap' : ''
    const smallCapsClass = config.value.chapters.smallCapsOpening ? 'bp-has-small-caps-opening' : ''

    parts.push(
      `<section class="bp-chapter bp-chapter-opening bp-page-break-before ${dropCapClass} ${smallCapsClass}"
                data-chapter-index="${ci}"
                data-chapter-title="${escapeHtml(c.title)}">
         <div class="bp-chapter-spacer" style="height:${openingPaddingTop.value}"></div>
         <div class="bp-chapter-heading">${escapeHtml(headerText)}</div>
       </section>`,
    )

    for (let ii = 0; ii < c.items.length; ii++) {
      const it = c.items[ii]
      let body = ''
      if (it.itemType === 'essay' && it.writingBlockId) {
        body = renderedHtmlById.value.get(it.writingBlockId) || '<p><em>(Body not loaded.)</em></p>'
      } else if (it.itemType === 'placeholder') {
        body = `<p class="bp-placeholder"><em>${escapeHtml(it.summary || 'Placeholder — not yet written.')}</em></p>`
      } else if (it.itemType === 'bridge') {
        body = `<div class="bp-bridge"><p><em>${escapeHtml(it.title || 'Bridge')}</em></p>${it.summary ? `<p>${escapeHtml(it.summary)}</p>` : ''}</div>`
      } else if (it.summary) {
        body = `<p>${escapeHtml(it.summary)}</p>`
      }
      const wrapClass = ii === 0 ? 'bp-item bp-item-opening' : 'bp-item'
      parts.push(`<div class="${wrapClass}">${body}</div>`)
      if (ii < c.items.length - 1) parts.push(sceneBreakHtml())
    }
  }

  // ---- Back matter ----
  if (bm.has('acknowledgements')) {
    const text = matter.acknowledgements.trim() || '—'
    parts.push(`<section class="bp-backmatter bp-page-break-before"><h2 class="bp-h2">Acknowledgements</h2>${paragraphsFromText(text)}</section>`)
  }
  if (bm.has('author_note')) {
    const text = matter.authorNote.trim() || '—'
    parts.push(`<section class="bp-backmatter bp-page-break-before"><h2 class="bp-h2">Author's note</h2>${paragraphsFromText(text)}</section>`)
  }
  if (bm.has('discussion_questions')) {
    const lines = (matter.discussionQuestions || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
    const lis = lines.length ? lines.map(l => `<li>${escapeHtml(l)}</li>`).join('') : `<li>—</li>`
    parts.push(`<section class="bp-backmatter bp-page-break-before"><h2 class="bp-h2">Discussion questions</h2><ol>${lis}</ol></section>`)
  }
  if (bm.has('also_by_author')) {
    const lines = (matter.alsoByBack || '').split(/\r?\n/).filter(s => s.trim())
    const inner = lines.length
      ? lines.map(l => `<p class="bp-fm-line">${escapeHtml(l)}</p>`).join('')
      : `<p class="bp-fm-line">—</p>`
    parts.push(`<section class="bp-backmatter bp-page-break-before"><h2 class="bp-h2">Also by the author</h2>${inner}</section>`)
  }
  if (bm.has('preview_chapter')) {
    const text = matter.previewChapter.trim() || '—'
    parts.push(`<section class="bp-backmatter bp-page-break-before"><h2 class="bp-h2">Coming next</h2>${paragraphsFromText(text)}</section>`)
  }
  if (bm.has('author_bio')) {
    const text = matter.authorBio.trim() || (author ? escapeHtml(author) + ' …' : '—')
    parts.push(`<section class="bp-backmatter bp-page-break-before"><h2 class="bp-h2">About the author</h2>${paragraphsFromText(text)}</section>`)
  }

  return parts.join('\n')
})

// ---- Pagination via CSS columns ----
//
// We don't store rendered HTML per page — that would mean N copies of the
// full bookFlowHtml in memory (one per page, with translateX picking out a
// different column each time). Instead each Page records just the column
// index it represents, and pageHtml() builds the column-translated div on
// demand from a SINGLE shared flow snapshot. For a 200-page novel this
// changes pages-array memory from "200 × full book HTML" to "200 × ~80
// bytes of metadata", and rendering one screen page is still O(1).
type Page = {
  blank?: boolean
  /** True for chapter-opening / front-matter pages that must land on a recto. */
  mustRecto?: boolean
  /** Index into `chapters`, when this page is part of a chapter body. -1 for none. */
  chapterIndex?: number
  /** True for chapter-opening pages specifically. */
  isChapterOpening?: boolean
  /** Column index into the shared paginatedFlow.html. -1 for blanks. */
  columnIndex: number
}

interface PaginatedFlow {
  /** The bookFlowHtml string captured at pagination time. */
  html: string
  /** Total column count produced for that flow at the current geometry. */
  columnCount: number
  /** Column width in CSS px. */
  columnWidth: number
  /** Column height in CSS px. */
  columnHeight: number
}

const RECTO_SELECTOR = '.bp-frontmatter, .bp-titlepage, .bp-toc, .bp-chapter-opening'

const measureContainer = ref<HTMLElement | null>(null)
const pages = ref<Page[]>([])
const paginatedFlow = ref<PaginatedFlow | null>(null)
const currentSpreadIndex = ref(0)

const totalPages = computed(() => Math.max(0, pages.value.length - 1))
const totalSpreads = computed(() => Math.max(1, Math.ceil(pages.value.length / 2)))
const currentSpread = computed(() => ({
  left: currentSpreadIndex.value * 2,
  right: currentSpreadIndex.value * 2 + 1,
}))

async function paginate() {
  await nextTick()
  const el = measureContainer.value
  if (!el) { pages.value = []; return }
  await new Promise(r => requestAnimationFrame(() => r(null)))
  await new Promise(r => requestAnimationFrame(() => r(null)))

  const cw = contentWidth.value
  const ch = contentHeight.value
  const total = el.scrollWidth
  const count = Math.max(1, Math.round(total / cw))

  // Identify recto columns and chapter associations.
  const originalWidth = (el.style as CSSStyleDeclaration).width
  el.style.width = `${count * cw}px`
  void el.offsetWidth

  const containerRect = el.getBoundingClientRect()
  const rectoColumns = new Set<number>()
  const chapterColumns: { col: number; index: number; isOpening: boolean }[] = []

  for (const r of Array.from(el.querySelectorAll<HTMLElement>(RECTO_SELECTOR))) {
    const rect = r.getBoundingClientRect()
    if (!rect.width && !rect.height) continue
    const colIdx = Math.max(0, Math.min(count - 1, Math.floor((rect.left - containerRect.left) / cw)))
    rectoColumns.add(colIdx)
    if (r.classList.contains('bp-chapter-opening')) {
      chapterColumns.push({ col: colIdx, index: parseInt(r.dataset.chapterIndex || '-1', 10), isOpening: true })
    }
  }

  // Track the chapter that owns each column. We sweep through every chapter
  // section and every body item to map columns -> chapter index.
  const colToChapter = new Map<number, number>()
  for (const a of Array.from(el.querySelectorAll<HTMLElement>('.bp-item, .bp-chapter-opening'))) {
    const chapterEl = a.classList.contains('bp-chapter-opening')
      ? a
      : a.previousElementSibling // not robust; we'll use a different approach below
    void chapterEl
  }
  // Robust mapping: walk each chapter section and its trailing items until
  // the next chapter-opening, recording columns covered.
  let currentChIdx = -1
  for (const node of Array.from(el.children)) {
    const elNode = node as HTMLElement
    const rect = elNode.getBoundingClientRect()
    if (!rect.width && !rect.height) continue
    if (elNode.classList.contains('bp-chapter-opening')) {
      currentChIdx = parseInt(elNode.dataset.chapterIndex || '-1', 10)
    }
    if (currentChIdx >= 0) {
      const startCol = Math.max(0, Math.min(count - 1, Math.floor((rect.left - containerRect.left) / cw)))
      const endCol = Math.max(0, Math.min(count - 1, Math.floor((rect.right - containerRect.left - 1) / cw)))
      for (let c = startCol; c <= endCol; c++) {
        if (!colToChapter.has(c)) colToChapter.set(c, currentChIdx)
      }
    }
  }

  el.style.width = originalWidth

  // Capture the shared flow once; pageHtml() reuses it for every page.
  paginatedFlow.value = {
    html: el.innerHTML,
    columnCount: count,
    columnWidth: cw,
    columnHeight: ch,
  }

  // Recto-aware page list. Index 0 is the inside-front-cover blank.
  const finalPages: Page[] = []
  finalPages.push({ blank: true, columnIndex: -1 })
  const wantRectoForChapters = config.value.chapters.chapterStart === 'right_hand_page'

  for (let i = 0; i < count; i++) {
    const isOpening = chapterColumns.some(c => c.col === i && c.isOpening)
    const needsRecto = rectoColumns.has(i) || (isOpening && wantRectoForChapters)
    if (needsRecto && finalPages.length % 2 === 0) {
      finalPages.push({ blank: true, columnIndex: -1 })
    }
    finalPages.push({
      mustRecto: needsRecto,
      chapterIndex: colToChapter.get(i) ?? -1,
      isChapterOpening: isOpening,
      columnIndex: i,
    })
  }

  if (finalPages.length % 2 !== 0) finalPages.push({ blank: true, columnIndex: -1 })
  pages.value = finalPages

  if (currentSpreadIndex.value > totalSpreads.value - 1) {
    currentSpreadIndex.value = Math.max(0, totalSpreads.value - 1)
  }
}

function pageAt(idx: number): Page | null { return pages.value[idx] || null }

/**
 * Build the column-translated flow div for a given page on demand. The
 * heavy `flowHtml` string is shared across every page — we only create the
 * wrapper div with the right `translateX` offset for the column.
 */
function pageHtml(idx: number): string {
  const p = pageAt(idx)
  const flow = paginatedFlow.value
  if (!p || p.blank || !flow || p.columnIndex < 0) return ''
  const { columnWidth, columnHeight, columnCount, html } = flow
  const flowWidth = columnCount * columnWidth
  return (
    `<div class="bp-page-flow" style="width:${flowWidth}px;height:${columnHeight}px;column-width:${columnWidth}px;column-gap:0;column-fill:auto;transform:translateX(-${p.columnIndex * columnWidth}px);">` +
    html +
    `</div>`
  )
}
function isContentPage(idx: number): boolean { const p = pageAt(idx); return !!p && !p.blank }

function showFolio(idx: number): boolean {
  if (idx <= 0) return false
  const p = pageAt(idx)
  if (!p || p.blank) return false
  if (p.isChapterOpening) return false
  return true
}
function folioFor(idx: number): number { return idx }

function showHeaderFor(idx: number): boolean {
  if (!config.value.headersAndFooters.runningHeaders) return false
  if (idx <= 0) return false
  const p = pageAt(idx)
  if (!p || p.blank) return false
  if (p.isChapterOpening && config.value.headersAndFooters.suppressHeaderOnChapterOpenings) return false
  return true
}

function headerFor(idx: number, side: 'left' | 'right'): string {
  const hf = config.value.headersAndFooters
  const p = pageAt(idx)
  const author = config.value.cover.authorName || ''
  const title = props.manuscript.title || ''
  const chTitle = (p && p.chapterIndex !== undefined && p.chapterIndex >= 0)
    ? (chapters.value[p.chapterIndex]?.title || '')
    : ''
  const which = side === 'left' ? hf.leftPageHeader : hf.rightPageHeader
  switch (which) {
    case 'author_name': return author
    case 'book_title': return title
    case 'chapter_title': return chTitle
    case 'none': return ''
  }
}

const progressLabel = computed(() => {
  const left = currentSpread.value.left
  const right = currentSpread.value.right
  const total = totalPages.value
  const lShown = isContentPage(left)
  const rShown = isContentPage(right)
  if (lShown && rShown) return `Pages ${folioFor(left)}–${folioFor(right)} of ${total}`
  if (lShown) return `Page ${folioFor(left)} of ${total}`
  if (rShown) return `Page ${folioFor(right)} of ${total}`
  return ''
})

// ---- Pagination scheduler ----
//
// Pagination is the single most expensive thing in the wizard — it walks
// every element in the measurement DOM to compute column boundaries — so
// running it on every keystroke or slider tick is what makes the preview
// feel sluggish. We debounce: any number of rapid changes within the wait
// window collapse into a single paginate() call once the user pauses.
//
// We also coalesce across the watcher's flush phases: if a watcher fires
// while a paginate is already in flight, we re-queue rather than
// interleaving, so we never measure a half-stable DOM.
let paginateTimer: number | null = null
let paginateInFlight = false
let paginateQueued = false
const PAGINATE_DEBOUNCE_MS = 150

async function runPaginate() {
  if (paginateInFlight) {
    paginateQueued = true
    return
  }
  paginateInFlight = true
  try {
    await paginate()
  } finally {
    paginateInFlight = false
    if (paginateQueued) {
      paginateQueued = false
      schedulePaginate(0)
    }
  }
}

function schedulePaginate(delayMs: number = PAGINATE_DEBOUNCE_MS) {
  if (paginateTimer !== null) {
    clearTimeout(paginateTimer)
  }
  paginateTimer = window.setTimeout(() => {
    paginateTimer = null
    void runPaginate()
  }, delayMs)
}

watch(
  [bookFlowHtml, () => stage.value, contentWidth, contentHeight, flowTypographyStyle],
  () => {
    schedulePaginate()
  },
  { flush: 'post' },
)

onMounted(() => {
  // Trigger the first pagination after the measurement container has
  // mounted. Use a short delay so the initial layout settles before we
  // measure column boundaries.
  schedulePaginate(0)
})

onBeforeUnmount(() => {
  if (paginateTimer !== null) clearTimeout(paginateTimer)
})

// ---- Validation & summary ----
const estimatedPageCount = computed(() => totalPages.value)
const spineEligibility = computed(() => {
  const n = estimatedPageCount.value
  if (n < 70) return 'Spine text not recommended (under 70 pages).'
  if (n < 130) return 'Thin spine — short title only.'
  if (n < 250) return 'Standard spine — title + author.'
  return 'Wide spine — title, author, publisher mark.'
})
const validation = computed(() => validateConfig(config.value, { estimatedPageCount: estimatedPageCount.value }))

// ---- Quality checks ----
const qualityChecks = computed<QualityCheckResult[]>(() => {
  const out: QualityCheckResult[] = []
  // narrow_gutter — config-only.
  const narrowGutter = (estimatedPageCount.value > 350 && config.value.margins.insideGutter < 0.85) ? 1 : 0
  out.push({
    id: 'narrow_gutter',
    label: 'Narrow gutter',
    description: 'The inside gutter may be too small for the estimated page count.',
    count: narrowGutter,
    pages: [],
  })
  // paragraph_spacing — config-only.
  out.push({
    id: 'paragraph_spacing',
    label: 'Paragraph spacing',
    description: 'Normal fiction paragraphs should not be separated by blank lines.',
    count: config.value.paragraphs.paragraphSpacing > 0 ? 1 : 0,
    pages: [],
  })
  // bad_scene_breaks — only flagged when style is blank_line.
  const badSceneBreaks = config.value.sceneBreaks.style === 'blank_line' ? 1 : 0
  out.push({
    id: 'bad_scene_breaks',
    label: 'Bad scene breaks',
    description: 'Blank-line scene breaks may be missed at a page boundary.',
    count: badSceneBreaks,
    pages: [],
  })
  // widows / orphans — approximate from the live DOM after pagination.
  const wo = countWidowsOrphans()
  out.push({ id: 'widows', label: 'Widows', description: 'Final paragraph lines stranded at the top of a page.', count: wo.widows.length, pages: wo.widows })
  out.push({ id: 'orphans', label: 'Orphans', description: 'First paragraph lines stranded at the bottom of a page.', count: wo.orphans.length, pages: wo.orphans })
  // loose_lines / rivers — not screened on-screen.
  out.push({ id: 'loose_lines', label: 'Loose lines', description: 'Justified lines with excessive word spacing — requires print-grade analysis.', count: -1, pages: [] })
  out.push({ id: 'rivers', label: 'Rivers', description: 'Vertical streams of whitespace in justified text — requires print-grade analysis.', count: -1, pages: [] })
  return out
})

function countWidowsOrphans(): { widows: number[]; orphans: number[] } {
  const widows: number[] = []
  const orphans: number[] = []
  const el = measureContainer.value
  if (!el) return { widows, orphans }

  // We approximate: a widow is any paragraph whose first line lives at the
  // bottom of one column while the rest spills into the next; an orphan is
  // the inverse. Without column-aware DOM APIs, we use bounding-rect
  // overlap with column boundaries.
  const cw = contentWidth.value
  const containerRect = el.getBoundingClientRect()
  const ps = Array.from(el.querySelectorAll<HTMLElement>('.bp-item p, .bp-item li, .bp-item blockquote'))
  const lineHeightPx = parseFloat(getComputedStyle(el).lineHeight) || 18
  const epsilon = lineHeightPx * 0.4

  for (const p of ps) {
    const rect = p.getBoundingClientRect()
    if (!rect.width || !rect.height) continue
    const startCol = Math.floor((rect.left - containerRect.left) / cw)
    const endCol = Math.floor((rect.right - containerRect.left - 1) / cw)
    if (startCol === endCol) continue
    // Crosses a column boundary. Estimate how much of the paragraph height
    // fell in the first column vs. the last column. If only ~one line ended
    // up alone on either side, flag it.
    const colBoundaryX = (startCol + 1) * cw + containerRect.left
    const firstColLines = Math.max(0, Math.round((colBoundaryX - rect.left) / lineHeightPx))
    const lastColLines = Math.max(0, Math.round((rect.right - colBoundaryX) / lineHeightPx))
    if (lastColLines === 1 && rect.height > epsilon) {
      // Paragraph's tail is a single line at the top of the next column.
      widows.push(endCol + 1)
    }
    if (firstColLines === 1 && rect.height > epsilon) {
      // Paragraph starts with a single line at the bottom of a column.
      orphans.push(startCol + 1)
    }
  }
  return {
    widows: dedupeSort(widows),
    orphans: dedupeSort(orphans),
  }
}
function dedupeSort(arr: number[]): number[] { return [...new Set(arr)].sort((a, b) => a - b) }

// ---- Preview pane ----
type PreviewMode = 'single' | 'spread' | 'chapter' | 'body' | 'dialogue' | 'scene' | 'cover'
const previewMode = ref<PreviewMode>('spread')
const previewModes: { id: PreviewMode; label: string }[] = [
  { id: 'spread', label: 'Spread' },
  { id: 'single', label: 'Single page' },
  { id: 'chapter', label: 'Chapter open' },
  { id: 'body', label: 'Body' },
  { id: 'dialogue', label: 'Dialogue' },
  { id: 'scene', label: 'Scene break' },
  { id: 'cover', label: 'Cover' },
]

// Auto-pick a preview mode when the wizard step changes.
watch(currentStepIndex, () => {
  const sid = currentStep.value.id
  if (sid === 'cover') previewMode.value = 'cover'
  else if (sid === 'chapters') previewMode.value = 'chapter'
  else if (sid === 'scene_breaks') previewMode.value = 'scene'
  else if (sid === 'paragraphs' || sid === 'typography') previewMode.value = 'body'
  else if (sid === 'headers_footers') previewMode.value = 'spread'
  else if (sid === 'trim_size' || sid === 'margins') previewMode.value = 'spread'
})

const previewLeftIndex = computed(() => {
  // Pick a sensible spread to show based on the mode.
  switch (previewMode.value) {
    case 'chapter': return findChapterOpeningPair().left
    case 'body': return findBodyPair().left
    case 'dialogue': return findBodyPair().left  // body is fine for dialogue
    case 'scene': return findBodyPair().left
    default: return Math.min(2, totalPages.value - 1)
  }
})
const previewRightIndex = computed(() => {
  switch (previewMode.value) {
    case 'single': return previewLeftIndex.value
    case 'chapter': return findChapterOpeningPair().right
    case 'body': return findBodyPair().right
    case 'dialogue': return findBodyPair().right
    case 'scene': return findBodyPair().right
    default: return previewLeftIndex.value + 1
  }
})

function findChapterOpeningPair(): { left: number; right: number } {
  const idx = pages.value.findIndex(p => p?.isChapterOpening)
  if (idx < 0) return { left: 2, right: 3 }
  // openings live on rectos (odd indices). Pair = [idx - 1, idx].
  return idx % 2 === 1 ? { left: idx - 1, right: idx } : { left: idx, right: idx + 1 }
}
function findBodyPair(): { left: number; right: number } {
  // Find a content page that is not a chapter opening or front-matter page.
  const idx = pages.value.findIndex(p => p && !p.blank && !p.isChapterOpening && !p.mustRecto)
  if (idx < 0) return { left: 2, right: 3 }
  return idx % 2 === 0 ? { left: idx, right: idx + 1 } : { left: idx - 1, right: idx }
}

const previewLeftHtml = computed(() => previewMode.value === 'single' ? '' : pageHtml(previewLeftIndex.value))
const previewRightHtml = computed(() => pageHtml(previewRightIndex.value))
const previewLeftFolio = computed(() => folioFor(previewLeftIndex.value))
const previewRightFolio = computed(() => folioFor(previewRightIndex.value))
const previewLeftShowFolio = computed(() => showFolio(previewLeftIndex.value))
const previewRightShowFolio = computed(() => showFolio(previewRightIndex.value))
const previewLeftHeader = computed(() => headerFor(previewLeftIndex.value, 'left'))
const previewRightHeader = computed(() => headerFor(previewRightIndex.value, 'right'))
const previewLeftShowHeader = computed(() => showHeaderFor(previewLeftIndex.value))
const previewRightShowHeader = computed(() => showHeaderFor(previewRightIndex.value))

// ---- Cover styles ----
const coverTitleStyle = computed(() => ({
  top: config.value.cover.titleY + '%',
  color: config.value.cover.titleColor,
  textAlign: config.value.cover.titleAlign,
}))
const coverTitleTextStyle = computed(() => ({
  fontSize: config.value.cover.titleSize + 'px',
}))
const coverAuthorStyle = computed(() => ({
  top: config.value.cover.authorY + '%',
  fontSize: config.value.cover.authorSize + 'px',
  color: config.value.cover.authorColor,
  textAlign: config.value.cover.authorAlign,
}))
const frontCoverBgStyle = computed(() => {
  if (!frontCoverUrl.value) return { background: '#3a2f24' }
  return { backgroundImage: `url('${frontCoverUrl.value}')`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: config.value.cover.coverOpacity }
})
const backCoverBgStyle = computed(() => {
  if (!backCoverUrl.value) return { background: '#3a2f24' }
  return { backgroundImage: `url('${backCoverUrl.value}')`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: config.value.cover.coverOpacity }
})

// ---- Barcode SVG ----
const barcodeMarkup = computed(() => {
  if (!config.value.cover.isbn) return ''
  try { return barcodeSvg(config.value.cover.isbn) } catch { return '' }
})

// ---- Back-cover blurb auto-fit (for both wizard preview and book stage) ----
const backTextEl = ref<HTMLParagraphElement | null>(null)
const backTextWrap = ref<HTMLDivElement | null>(null)
const backTextElBook = ref<HTMLParagraphElement | null>(null)
const backTextWrapBook = ref<HTMLDivElement | null>(null)
const BACK_TEXT_MAX_FONT_PX = 18
const BACK_TEXT_MIN_FONT_PX = 7

function fitBackCoverText(textEl: HTMLElement | null, wrap: HTMLElement | null) {
  if (!textEl || !wrap) return
  let size = BACK_TEXT_MAX_FONT_PX
  textEl.style.fontSize = size + 'px'
  void wrap.offsetHeight
  const availW = wrap.clientWidth
  const availH = wrap.clientHeight
  if (availW <= 0 || availH <= 0) return
  while (size > BACK_TEXT_MIN_FONT_PX && (textEl.scrollHeight > availH || textEl.scrollWidth > availW)) {
    size -= 0.5
    textEl.style.fontSize = size + 'px'
    void textEl.offsetHeight
  }
}

watch(
  [() => config.value.cover.backText, () => config.value.cover.authorName, () => bookState.value, () => previewMode.value, pageWidth, pageHeight],
  async () => {
    await nextTick()
    fitBackCoverText(backTextEl.value, backTextWrap.value)
    fitBackCoverText(backTextElBook.value, backTextWrapBook.value)
  },
  { flush: 'post' },
)

// ---- Book stage interactions ----
async function openBook() {
  await loadBodiesForSelected()
  if (loadError.value) { alert(loadError.value); return }
  stage.value = 'book'
  bookState.value = 'closed-front'
  currentSpreadIndex.value = 0
}
function openFromFront() { bookState.value = 'open'; currentSpreadIndex.value = 0 }
function reopenFromBack() { bookState.value = 'open'; currentSpreadIndex.value = totalSpreads.value - 1 }
function nextSpread() {
  if (currentSpreadIndex.value < totalSpreads.value - 1) currentSpreadIndex.value++
  else bookState.value = 'closed-back'
}
function prevSpread() {
  if (currentSpreadIndex.value > 0) currentSpreadIndex.value--
  else bookState.value = 'closed-front'
}

function onRootKeydown(ev: KeyboardEvent) {
  if (stage.value === 'book' && bookState.value === 'open') {
    if (ev.key === 'ArrowRight' || ev.key === 'PageDown') { ev.preventDefault(); nextSpread() }
    else if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') { ev.preventDefault(); prevSpread() }
    else if (ev.key === 'Escape') { ev.preventDefault(); emit('close') }
  } else if (stage.value === 'wizard') {
    if (ev.key === 'Escape') { ev.preventDefault(); emit('close') }
  }
}

// ---- Print ----
//
// Natural CSS pagination. The print document contains the bookFlowHtml ONCE
// — the browser's print engine handles page splitting via @page rules,
// `break-before` on chapter sections, and `@page :left` / `:right` for
// mirrored margins, running headers and folios.
//
// Why this matters: the old snapshot pipeline embedded the entire book
// content once per paginated page. For a 200-page novel that's 200×
// duplication, which made print HTML enormous and stalled the print dialog
// for several seconds. The natural approach scales linearly with manuscript
// length, so the dialog opens almost instantly even on long books.
async function onPrint(layout: PrintLayout) {
  await loadBodiesForSelected()
  if (loadError.value) { alert(loadError.value); return }

  const cfg = config.value
  const docTitle = `${props.manuscript.title || 'Book'} — ${layout === 'a4_booklet_2up' ? 'A5 (booklet 2-up via OS print dialog)' : 'A5 (reading order)'}`

  const html = buildNaturalPrintHtml({
    cfg,
    bookFlowHtml: bookFlowHtml.value,
    frontCoverHtml: buildPrintCoverHtml('front', cfg, frontCoverUrl.value),
    backCoverHtml: buildPrintCoverHtml('back', cfg, backCoverUrl.value, barcodeMarkup.value),
    bookTitle: props.manuscript.title || '',
    authorName: cfg.cover.authorName || '',
    documentTitle: docTitle,
    layout,
  })

  if (!openPrintWindow(html)) {
    alert('Could not open the print window. Please allow pop-ups for this site.')
  }
}

function buildPrintCoverHtml(
  side: 'front' | 'back',
  cfg: PreviewConfig,
  imgUrl: string | null,
  barcode?: string,
): string {
  // We render artwork as an explicit <img> rather than a CSS background-image
  // because some browser print engines drop large data: URLs from background
  // properties under @page rules, but render <img> reliably. The img also
  // exposes a Promise via .decode() so the print window can wait for it
  // before opening the system print dialog.
  const cover = cfg.cover
  const title = props.manuscript.title || ''
  const subtitle = props.manuscript.workingSubtitle || ''
  const author = cover.authorName || ''
  const fallbackBg = '#3a2f24'

  const imgEl = imgUrl
    ? `<img src="${imgUrl}" class="pp-cover-art" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:${cover.coverOpacity};" />`
    : ''
  const bgFill = `<div style="position:absolute;inset:0;background:${fallbackBg};"></div>`

  if (side === 'front') {
    return `
      ${bgFill}
      ${imgEl}
      <div style="position:absolute;inset:0;text-align:center;padding:8mm;color:#f4ecdd;text-shadow:0 1px 4px rgba(0,0,0,0.55);">
        <div style="position:absolute;left:50%;top:${cover.titleY}%;transform:translate(-50%,-50%);width:calc(100% - 16mm);text-align:${cover.titleAlign};color:${cover.titleColor};">
          <h2 style="font-family:'${cfg.typography.bodyFont}',Georgia,serif;font-size:${cover.titleSize}pt;font-weight:300;margin:0;letter-spacing:0.04em;line-height:1.15;">${escapeHtml(title)}</h2>
          ${subtitle ? `<p style="font-style:italic;margin:2mm 0 0 0;">${escapeHtml(subtitle)}</p>` : ''}
        </div>
        ${author ? `<div style="position:absolute;left:50%;top:${cover.authorY}%;transform:translate(-50%,-50%);width:calc(100% - 16mm);font-family:'${cfg.typography.bodyFont}',Georgia,serif;font-style:italic;font-size:${cover.authorSize}pt;color:${cover.authorColor};text-align:${cover.authorAlign};letter-spacing:0.08em;">${escapeHtml(author)}</div>` : ''}
      </div>
    `
  }
  // back
  return `
    ${bgFill}
    ${imgEl}
    <div style="position:absolute;inset:0;padding:10mm;color:#f4ecdd;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center;">
      <p style="font-family:'${cfg.typography.bodyFont}',Georgia,serif;font-style:italic;font-size:14pt;letter-spacing:0.04em;margin:0;line-height:1.2;">${escapeHtml(title)}</p>
      <p style="font-family:'${cfg.typography.bodyFont}',Georgia,serif;font-size:11pt;line-height:1.5;color:${cover.backTextColor};max-width:90mm;white-space:pre-wrap;margin:0;">${escapeHtml(cover.backText || '')}</p>
      <div style="display:flex;flex-direction:column;align-items:center;gap:3mm;">
        ${author ? `<p style="font-family:'${cfg.typography.bodyFont}',Georgia,serif;font-size:9pt;letter-spacing:0.12em;text-transform:uppercase;margin:0;">${escapeHtml(author)}</p>` : ''}
        ${cover.showBarcode && cover.isbn && barcode ? `
          <div style="background:#fff;color:#000;padding:2mm;display:inline-block;">
            <div style="width:30mm;height:18mm;">${barcode}</div>
            <div style="font-family:'OCR-B',Consolas,monospace;font-size:7pt;text-align:center;margin-top:1mm;color:#000;">ISBN ${escapeHtml(cover.isbn)}</div>
          </div>` : ''}
      </div>
    </div>
  `
}

// ---- Footer primary action depends on which step is current ----
const primaryActionLabel = computed(() => {
  if (currentStep.value.id === 'summary') return 'Open book'
  return 'Next'
})
function onPrimaryAction() {
  if (currentStep.value.id === 'summary') openBook()
  else nextStep()
}

// ---- Inline preview-page renderer ----
//
// Defining this here (rather than in its own .vue file) keeps the wizard a
// single SFC. It renders one page (verso or recto) with mirrored margins,
// running header, folio, and the v-html'd column-translated flow.
const PreviewPage = defineComponent({
  name: 'PreviewPage',
  props: {
    side: { type: String as PropType<'left' | 'right'>, required: true },
    pageHtml: { type: String, default: '' },
    folio: { type: Number, default: 0 },
    showFolio: { type: Boolean, default: false },
    headerText: { type: String, default: '' },
    showHeader: { type: Boolean, default: false },
    pageWidth: { type: Number, required: true },
    pageHeight: { type: Number, required: true },
    marginTop: { type: Number, required: true },
    marginBottom: { type: Number, required: true },
    marginInner: { type: Number, required: true },
    marginOuter: { type: Number, required: true },
    pageNumberPosition: { type: String as PropType<'bottom_center' | 'outer_top' | 'outer_bottom'>, required: true },
    flowStyle: { type: Object as PropType<Record<string, string | number>>, required: true },
    paperColor: { type: String, required: true },
  },
  setup(p) {
    return () => {
      const isLeft = p.side === 'left'
      const padLeft = isLeft ? p.marginOuter : p.marginInner
      const padRight = isLeft ? p.marginInner : p.marginOuter
      const folioStyle: Record<string, string | undefined> = (() => {
        switch (p.pageNumberPosition) {
          case 'bottom_center':
            return { left: '0', right: '0', bottom: Math.max(8, p.marginBottom * 0.45) + 'px', textAlign: 'center' }
          case 'outer_top':
            return isLeft
              ? { left: p.marginOuter + 'px', top: Math.max(6, p.marginTop * 0.45) + 'px' }
              : { right: p.marginOuter + 'px', top: Math.max(6, p.marginTop * 0.45) + 'px' }
          case 'outer_bottom':
          default:
            return isLeft
              ? { left: p.marginOuter + 'px', bottom: Math.max(8, p.marginBottom * 0.45) + 'px' }
              : { right: p.marginOuter + 'px', bottom: Math.max(8, p.marginBottom * 0.45) + 'px' }
        }
      })()
      const blank = !p.pageHtml
      return h('div', {
        class: ['bp-page', isLeft ? 'bp-page-left' : 'bp-page-right'],
        style: { width: p.pageWidth + 'px', height: p.pageHeight + 'px', background: p.paperColor },
      }, [
        p.showHeader && p.headerText
          ? h('div', { class: 'bp-page-header', style: { top: Math.max(6, p.marginTop * 0.4) + 'px' } }, p.headerText)
          : null,
        h('div', {
          class: 'bp-page-inner',
          style: {
            top: p.marginTop + 'px',
            bottom: p.marginBottom + 'px',
            left: padLeft + 'px',
            right: padRight + 'px',
            ...p.flowStyle,
          },
          ...(blank ? {} : { innerHTML: p.pageHtml }),
        }),
        p.showFolio
          ? h('div', { class: 'bp-page-folio', style: folioStyle }, String(p.folio))
          : null,
      ])
    }
  },
})

// ---- Inline NumberField helper component ----
const NumberField = defineComponent({
  name: 'NumberField',
  props: {
    label: { type: String, required: true },
    unit: { type: String, default: '' },
    modelValue: { type: Number, required: true },
    min: { type: Number, required: true },
    max: { type: Number, required: true },
    step: { type: Number, required: true },
  },
  emits: ['update:modelValue'],
  setup(p, { emit }) {
    return () => h('label', { class: 'bp-numberfield' }, [
      h('span', { class: 'bp-numberfield-label' }, [
        p.label,
        h('span', { class: 'bp-numberfield-value' }, ` ${p.modelValue}${p.unit ? ' ' + p.unit : ''}`),
      ]),
      h('div', { class: 'bp-numberfield-row' }, [
        h('input', {
          type: 'range',
          min: p.min, max: p.max, step: p.step,
          value: p.modelValue,
          'aria-label': p.label,
          onInput: (e: Event) => emit('update:modelValue', parseFloat((e.target as HTMLInputElement).value)),
        }),
        h('input', {
          type: 'number',
          class: 'bp-numberfield-num',
          min: p.min, max: p.max, step: p.step,
          value: p.modelValue,
          'aria-label': p.label + ' (numeric)',
          onInput: (e: Event) => {
            const v = parseFloat((e.target as HTMLInputElement).value)
            if (!Number.isNaN(v)) emit('update:modelValue', v)
          },
        }),
      ]),
    ])
  },
})
</script>

<style scoped>
/* ============ Wizard chrome ============ */
.bp-wizard { font-family: ui-sans-serif, system-ui, sans-serif; }
.bp-wizard-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.75rem 1rem; border-bottom: 1px solid var(--line, #e6dfd0);
  background: var(--paper-light, #faf6ec);
  gap: 1rem;
}
.bp-stepbar {
  border-bottom: 1px solid var(--line, #e6dfd0);
  background: #faf6ec;
  overflow-x: auto;
}
.bp-stepbar-list {
  display: flex; gap: 0; padding: 0; margin: 0; list-style: none;
}
.bp-stepbar-item {
  border-right: 1px solid #ece4d3;
}
.bp-stepbar-btn {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.5rem 0.85rem;
  font-size: 0.78rem; color: #5a4f3f;
  background: transparent; border: 0; cursor: pointer; white-space: nowrap;
}
.bp-stepbar-btn:hover { color: #1f1a14; background: #f3eddc; }
.bp-stepbar-item.is-current .bp-stepbar-btn {
  color: #1f1a14; background: #f3eddc; font-weight: 500;
  box-shadow: inset 0 -2px 0 0 #1f1a14;
}
.bp-stepbar-num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 1.4rem; height: 1.4rem;
  border: 1px solid currentColor; border-radius: 999px;
  font-size: 0.72rem;
}

.bp-wizard-body {
  flex: 1 1 auto;
  display: grid; grid-template-columns: minmax(320px, 45%) 1fr;
  min-height: 0;
}
.bp-controls {
  border-right: 1px solid var(--line, #e6dfd0);
  background: var(--paper, #fbf7ec);
  overflow: hidden;
  display: flex; flex-direction: column;
}
.bp-controls-scroll { overflow-y: auto; padding: 1rem 1.25rem 1.5rem; }

.bp-step-title { font-size: 1.05rem; font-weight: 500; margin: 0 0 0.25rem; }
.bp-step-desc { font-size: 0.85rem; color: var(--ink-light, #5a4f3f); margin: 0 0 1rem; }

.bp-fieldset { display: block; margin: 0; padding: 0; border: 0; }
.bp-legend { display: block; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.12em; color: var(--ink-lighter, #8a7e69); margin-bottom: 0.4rem; }
.bp-radio, .bp-checkbox {
  display: flex; align-items: flex-start; gap: 0.6rem;
  font-size: 0.88rem; padding: 0.25rem 0; cursor: pointer;
}
.bp-radio input, .bp-checkbox input {
  margin-top: 0.2rem; accent-color: #1f1a14;
}
.bp-select, .bp-text-input {
  display: block; width: 100%;
  border: 1px solid var(--line, #d6cdba);
  background: #fff; color: var(--ink, #1f1a14);
  padding: 0.4rem 0.6rem; font-size: 0.9rem; border-radius: 2px;
}
.bp-text-input:focus, .bp-select:focus { outline: 2px solid #1f1a14; outline-offset: -1px; }
.bp-color-input { width: 100%; height: 32px; padding: 0; border: 1px solid var(--line, #d6cdba); cursor: pointer; background: #fff; border-radius: 2px; }

.bp-numberfield { display: block; margin-bottom: 0.5rem; }
.bp-numberfield-label { display: flex; align-items: baseline; justify-content: space-between; font-size: 0.85rem; font-weight: 500; }
.bp-numberfield-value { color: var(--ink-lighter, #8a7e69); font-weight: 400; font-feature-settings: 'tnum' 1; }
.bp-numberfield-row { display: flex; align-items: center; gap: 0.5rem; }
.bp-numberfield-row input[type=range] { flex: 1 1 auto; }
.bp-numberfield-num { width: 5.5rem; padding: 0.2rem 0.4rem; border: 1px solid var(--line, #d6cdba); background: #fff; border-radius: 2px; font-size: 0.85rem; }

.bp-segmented { display: inline-flex; border: 1px solid var(--line, #d6cdba); border-radius: 2px; overflow: hidden; font-size: 0.85rem; }
.bp-segmented-btn { padding: 0.3rem 0.7rem; background: transparent; border: 0; cursor: pointer; text-transform: capitalize; color: var(--ink-light, #5a4f3f); }
.bp-segmented-btn.is-on { background: #1f1a14; color: #fbf7ec; }

.bp-card { border: 1px solid var(--line, #e6dfd0); border-radius: 3px; padding: 0.6rem 0.75rem; background: #fff; }
.bp-pill {
  display: inline-flex; align-items: center; gap: 0.3rem;
  font-size: 0.72rem; padding: 0.18rem 0.5rem; border-radius: 999px;
  background: #ece4d3; color: #4a4030;
}
.bp-pill.is-ok { background: #dfe9d3; color: #2c4220; }
.bp-pill.is-warn { background: #f4e3c4; color: #6a4a14; }
.bp-pill.is-error { background: #f4d3d3; color: #6a1a1a; }
.bp-pill.is-skip { background: #e0d8c5; color: #5a4f3f; }

.bp-issue { display: flex; align-items: flex-start; gap: 0.4rem; font-size: 0.85rem; padding: 0.2rem 0; }
.bp-issue-tag { flex: 0 0 auto; font-size: 0.68rem; padding: 0.05rem 0.4rem; border-radius: 2px; text-transform: uppercase; letter-spacing: 0.08em; }
.bp-issue.is-error .bp-issue-tag { background: #6a1a1a; color: #fff; }
.bp-issue.is-warn .bp-issue-tag { background: #b07520; color: #fff; }

.bp-matter-item { padding: 0.25rem 0; }
.bp-matter-body {
  margin: 0.4rem 0 0.6rem 1.6rem;
  padding-left: 0.6rem;
  border-left: 2px solid var(--line, #e6dfd0);
}
.bp-matter-body textarea { font-family: ui-serif, Georgia, serif; font-size: 0.88rem; line-height: 1.4; }
.bp-matter-body .mt-1 { margin-top: 0.4rem; }

.bp-summary { display: grid; grid-template-columns: max-content 1fr; gap: 0.3rem 1rem; font-size: 0.88rem; }
.bp-summary > div { display: contents; }
.bp-summary dt { color: var(--ink-light, #5a4f3f); }
.bp-summary dd { margin: 0; color: var(--ink, #1f1a14); }

/* ============ Preview pane ============ */
.bp-preview {
  display: flex; flex-direction: column;
  background: radial-gradient(ellipse at center, #2a2620 0%, #100d0a 80%, #000 100%);
  color: #d6cdbf;
  min-height: 0;
}
.bp-preview-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.5rem 0.85rem;
  background: rgba(0,0,0,0.35); border-bottom: 1px solid rgba(255,255,255,0.08);
}
.bp-toolbar-btn {
  font-size: 0.75rem; padding: 0.2rem 0.55rem;
  background: transparent; color: #d6cdbf; border: 1px solid rgba(255,255,255,0.18);
  border-radius: 2px; cursor: pointer;
}
.bp-toolbar-btn.is-on { background: #d6cdbf; color: #100d0a; }
.bp-preview-stage {
  flex: 1 1 auto; overflow: auto;
  display: flex; align-items: center; justify-content: center;
  padding: 1.5rem;
}

.bp-spread-mini { display: flex; box-shadow: 0 18px 40px -12px rgba(0,0,0,0.6); }

/* ============ Footer ============ */
.bp-wizard-footer {
  display: flex; align-items: center; justify-content: space-between;
  gap: 1rem; padding: 0.6rem 1rem;
  border-top: 1px solid var(--line, #e6dfd0); background: #faf6ec;
}
.bp-footer-status { display: flex; align-items: center; gap: 0.6rem; }
.bp-footer-actions { display: flex; align-items: center; gap: 0.5rem; }

.bp-btn-primary, .bp-btn-ghost, .bp-link {
  font-size: 0.85rem; padding: 0.35rem 0.85rem; border-radius: 2px; border: 1px solid transparent;
  cursor: pointer; font-family: inherit;
}
.bp-btn-primary { background: #1f1a14; color: #fbf7ec; }
.bp-btn-primary:hover { background: #2c2520; }
.bp-btn-primary[disabled] { opacity: 0.5; cursor: not-allowed; }
.bp-btn-ghost { background: transparent; color: #1f1a14; border-color: #d6cdba; }
.bp-btn-ghost:hover { background: #f3eddc; }
.bp-btn-ghost[disabled] { opacity: 0.5; cursor: not-allowed; }
.bp-link { background: transparent; color: var(--ink-light, #5a4f3f); padding: 0; border: 0; text-decoration: underline; cursor: pointer; }
.bp-link:hover { color: #1f1a14; }

/* ============ Book stage (preserved from earlier implementation) ============ */
.bp-stage {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: radial-gradient(ellipse at center, #2a2620 0%, #100d0a 70%, #050403 100%);
}
.bp-topbar {
  position: absolute; top: 0; left: 0; right: 0;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.75rem 1rem; color: #d6cdbf;
  font-family: ui-sans-serif, system-ui, sans-serif; font-size: 0.85rem;
  background: rgba(0,0,0,0.35); border-bottom: 1px solid rgba(255,255,255,0.08);
}
.bp-btn {
  background: transparent; color: #d6cdbf;
  padding: 0.35rem 0.75rem;
  border: 1px solid rgba(255,255,255,0.18); border-radius: 2px; cursor: pointer;
}
.bp-btn:hover { border-color: rgba(255,255,255,0.4); }
.bp-progress { letter-spacing: 0.08em; text-transform: uppercase; font-size: 0.7rem; color: #b6ad9f; }

.bp-book-wrap { display: flex; align-items: center; justify-content: center; }

/* ---- Page (used by the inline PreviewPage component) ---- */
.bp-page {
  position: relative;
  user-select: text;
  cursor: pointer;
  overflow: hidden;
  color: #1f1a14;
}
.bp-page-left { background: linear-gradient(to right, rgba(0,0,0,0.06), transparent 4%, transparent 96%, rgba(0,0,0,0.06)); }
.bp-page-right { background: linear-gradient(to right, rgba(0,0,0,0.06), transparent 4%, transparent 96%, rgba(0,0,0,0.06)); }

.bp-page-header {
  position: absolute; left: 0; right: 0;
  text-align: center; font-family: inherit; font-size: 0.72rem;
  color: #5a4f3f; letter-spacing: 0.06em;
}
.bp-page-folio {
  position: absolute; font-family: inherit; font-size: 0.72rem;
  color: #5a4f3f;
}
.bp-page-inner {
  position: absolute; overflow: hidden;
  font-family: ui-serif, Georgia, "Iowan Old Style", serif;
  color: #1f1a14;
}

/* Spread */
.bp-spread {
  display: flex; position: relative;
  box-shadow: 0 30px 70px -20px rgba(0,0,0,0.8), 0 0 0 1px rgba(0,0,0,0.6);
  border-radius: 6px; overflow: hidden;
}
.bp-spine-shadow {
  position: absolute; top: 0; bottom: 0; left: 50%; width: 30px;
  transform: translateX(-50%); pointer-events: none;
  background: radial-gradient(ellipse at center, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0) 70%);
}

/* Body / column flow rules — applied to v-html'd content via :deep */
.bp-page-inner :deep(.bp-page-flow) { padding: 0; }

.bp-page-inner :deep(p) {
  margin: 0;
  text-indent: var(--bp-indent, 0.25in);
  padding-bottom: var(--bp-para-space, 0);
}
/* First paragraph in any item / section is not indented (chapter or scene
   break followed by text). */
.bp-page-inner :deep(.bp-item-opening > p:first-child) { text-indent: 0; }
.bp-page-inner :deep(.bp-item > p:first-child) { text-indent: 0; }
.bp-page-inner :deep(.bp-scene-break + .bp-item > p:first-child) { text-indent: 0; }

.bp-page-inner :deep(.bp-scene-break) {
  text-indent: 0; text-align: center;
  margin: 1.2em 0;
  font-style: italic;
  letter-spacing: 0.4em;
}
.bp-page-inner :deep(.bp-scene-break-blank) { color: transparent; }

.bp-page-inner :deep(.bp-chapter-heading) {
  text-align: center; font-family: inherit;
  font-size: 1.6em; font-weight: 300; margin: 0 0 1em 0;
  letter-spacing: 0.04em;
}
.bp-page-inner :deep(.bp-has-drop-cap + .bp-item > p:first-child::first-letter),
.bp-page-inner :deep(.bp-chapter-opening + .bp-item > p:first-child::first-letter) { /* no-op without conf */ }
.bp-page-inner :deep(.bp-has-drop-cap ~ .bp-item:first-of-type p:first-child::first-letter) { /* no-op */ }
/* True drop-cap: first-letter of the first-child p of the first-item-opening
   that follows a chapter with drop-cap class. */
.bp-page-inner :deep(.bp-has-drop-cap ~ .bp-item-opening > p:first-child::first-letter) {
  font-size: 3.6em; line-height: 1; font-weight: 500;
  float: left; padding: 0.06em 0.1em 0 0;
}
.bp-page-inner :deep(.bp-has-small-caps-opening ~ .bp-item-opening > p:first-child::first-line) {
  font-variant: small-caps; letter-spacing: 0.04em;
}

.bp-page-inner :deep(.bp-half-title) { text-align: center; margin-top: 40%; font-size: 1.2em; letter-spacing: 0.06em; }
.bp-page-inner :deep(.bp-titlepage) { text-align: center; padding-top: 18%; }
.bp-page-inner :deep(.bp-book-title) { font-family: inherit; font-size: 1.8em; font-weight: 300; margin: 0 0 0.4em 0; }
.bp-page-inner :deep(.bp-book-subtitle) { font-style: italic; font-size: 1.05em; }
.bp-page-inner :deep(.bp-book-author) { margin-top: 1.5em; font-style: italic; }
.bp-page-inner :deep(.bp-fm-h) { text-align: center; margin-top: 30%; }
.bp-page-inner :deep(.bp-fm-line) { text-align: center; font-size: 0.85em; margin: 0.4em 0; text-indent: 0; }
.bp-page-inner :deep(.bp-dedication) { text-align: center; margin-top: 40%; text-indent: 0; }
.bp-page-inner :deep(.bp-epigraph) { text-align: center; margin: 30% 1.5em 0; font-style: italic; }
.bp-page-inner :deep(.bp-epigraph-attribution) { text-align: center; margin: 0.6em 1.5em 0; font-style: normal; font-size: 0.85em; text-indent: 0; }
.bp-page-inner :deep(.bp-toc) { padding-top: 8%; }
.bp-page-inner :deep(.bp-h2) { text-align: center; font-size: 1.4em; margin: 8% 0 1em 0; }
.bp-page-inner :deep(.bp-toc-list) { list-style: none; padding: 0; margin: 1em 0; font-size: 0.95em; }
.bp-page-inner :deep(.bp-toc-list li) { margin: 0.35em 0; }
.bp-page-inner :deep(.bp-toc-num) { display: inline-block; width: 1.6em; }
.bp-page-inner :deep(.bp-page-break-before) { break-before: column; }
.bp-page-inner :deep(.bp-page-break-after)  { break-after: column; }
.bp-page-inner :deep(.bp-bridge) {
  margin: 0.6em 1.2em; padding: 0.6em 0;
  border-top: 1px solid #c7bfae; border-bottom: 1px solid #c7bfae;
  text-align: center; font-style: italic;
}
.bp-page-inner :deep(.bp-placeholder) { font-style: italic; color: #6a5f4d; }
.bp-page-inner :deep(blockquote) { margin: 0.6em 1.2em; font-style: italic; color: #3a3022; }
.bp-page-inner :deep(em) { font-style: italic; }
.bp-page-inner :deep(strong) { font-weight: 600; }

/* Hidden measurement layer */
.bp-measure { position: fixed; top: -10000px; left: -10000px; visibility: hidden; pointer-events: none; }
.bp-measure-flow {
  column-gap: 0; column-fill: auto; overflow: hidden;
  font-family: ui-serif, Georgia, "Iowan Old Style", serif;
}
.bp-measure-flow :deep(.bp-page-break-before) { break-before: column; }
.bp-measure-flow :deep(.bp-page-break-after) { break-after: column; }
.bp-measure-flow :deep(.bp-chapter-opening) { break-before: column; break-inside: avoid; text-align: center; }
.bp-measure-flow :deep(.bp-frontmatter), .bp-measure-flow :deep(.bp-titlepage), .bp-measure-flow :deep(.bp-toc) { break-inside: avoid; }
.bp-measure-flow :deep(.bp-half-title) { margin-top: 40%; }
.bp-measure-flow :deep(.bp-titlepage) { padding-top: 18%; }
.bp-measure-flow :deep(.bp-toc) { padding-top: 8%; }
.bp-measure-flow :deep(p) { margin: 0; text-indent: var(--bp-indent, 0.25in); padding-bottom: var(--bp-para-space, 0); }
.bp-measure-flow :deep(.bp-item-opening > p:first-child) { text-indent: 0; }
.bp-measure-flow :deep(.bp-item > p:first-child) { text-indent: 0; }
.bp-measure-flow :deep(.bp-scene-break) { text-indent: 0; text-align: center; margin: 1.2em 0; font-style: italic; letter-spacing: 0.4em; }

/* ============ Cover (closed) ============ */
.bp-cover {
  position: relative;
  border-radius: 4px 8px 8px 4px;
  box-shadow: 0 30px 60px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.6) inset;
  overflow: hidden; cursor: pointer; user-select: none;
  transition: transform 250ms ease;
}
.bp-cover:hover { transform: translateY(-2px); }
.bp-cover-back { border-radius: 8px 4px 4px 8px; }
.bp-cover-bg { position: absolute; inset: 0; background: #3a2f24; }
.bp-cover-content { position: absolute; inset: 0; text-align: center; padding: 2rem; color: #f4ecdd; text-shadow: 0 1px 4px rgba(0,0,0,0.55); }
.bp-cover-title-block, .bp-cover-author-block {
  position: absolute; left: 50%;
  transform: translate(-50%, -50%);
  width: calc(100% - 4rem);
}
.bp-cover-title { font-family: ui-serif, Georgia, serif; font-size: 1.6rem; font-weight: 300; letter-spacing: 0.04em; line-height: 1.25; margin: 0; }
.bp-cover-subtitle { font-style: italic; margin-top: 0.5rem; opacity: 0.9; }
.bp-cover-author-block { font-family: ui-serif, Georgia, serif; font-size: 1rem; font-style: italic; letter-spacing: 0.08em; opacity: 0.95; }

.bp-cover-back-stack { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.4rem; padding: 1.5rem 1.5rem 1.2rem; }
.bp-cover-back-stack.has-back-text { justify-content: space-between; gap: 0.8rem; }
.bp-cover-back-text-wrap { flex: 1 1 auto; width: 100%; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.bp-cover-back-title { font-family: ui-serif, Georgia, serif; font-style: italic; font-size: 1rem; letter-spacing: 0.04em; }
.bp-cover-back-author { font-family: ui-serif, Georgia, serif; font-size: 0.85rem; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.85; }
.bp-cover-back-text { font-family: ui-serif, Georgia, serif; font-size: 16px; line-height: 1.5; white-space: pre-wrap; max-width: 28em; margin: 0; opacity: 0.92; text-align: center; }

.bp-barcode-panel {
  background: #fff; color: #000; padding: 6px 8px; border-radius: 2px;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  width: clamp(110px, 35%, 150px);
  box-shadow: 0 2px 6px rgba(0,0,0,0.4);
}
.bp-barcode-svg { width: 100%; height: 50px; display: flex; align-items: center; justify-content: center; }
.bp-barcode-svg :deep(svg) { width: 100%; height: 100%; }
.bp-barcode-isbn { font-family: 'OCR-B', Consolas, ui-monospace, monospace; font-size: 8px; letter-spacing: 0.04em; color: #000; }

.bp-cover-spread { display: flex; }
.bp-cover-gap { width: 18px; }

.bp-cover-spine {
  position: absolute; top: 0; bottom: 0; left: 0; width: 14px;
  background: linear-gradient(to right, rgba(0,0,0,0.55), rgba(0,0,0,0.15) 70%, transparent);
}
.bp-cover-spine-back {
  left: auto; right: 0;
  background: linear-gradient(to left, rgba(0,0,0,0.55), rgba(0,0,0,0.15) 70%, transparent);
}
</style>
