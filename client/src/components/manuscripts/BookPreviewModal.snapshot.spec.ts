/**
 * Phase 1: Book Preview Wizard snapshot regression harness.
 *
 * Locks in the current `bookFlowHtml` (the assembled front-matter + chapters
 * + back-matter HTML the wizard splits across pages on screen) and
 * `buildNaturalPrintHtml` output (the full standalone print document) across
 * 3 fixture manuscripts × 4 configuration permutations = 12 of each.
 *
 * Snapshots are the immutable baseline before the Configurable Spine Depth
 * refactor. Any byte-level diff at depth=1 fails the suite; CI gates merges
 * on that diff. Subsequent phases must keep these outputs identical until
 * the wizard's depth-1 behaviour is explicitly changed.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'

// The api modules are mocked so the wizard's open-hook (refreshDrafts) and
// body-loader (loadBodiesForSelected) don't touch the network. Drafts come
// back empty so the chooser stage immediately yields to the wizard stage.
vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(async () => ({ data: { body: '' } })),
    post: vi.fn(async () => ({ data: {} })),
    put: vi.fn(async () => ({ data: {} })),
    delete: vi.fn(async () => ({ data: {} })),
  },
}))
vi.mock('../../api/bookPrinting', () => ({
  bookPrintingApi: {
    list: vi.fn(async () => []),
    get: vi.fn(async () => ({})),
    create: vi.fn(async () => ({})),
    update: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({ deleted: 'x' })),
  },
}))

import BookPreviewModal from './BookPreviewModal.vue'
import { buildNaturalPrintHtml } from './bookPreview/print'
import type {
  PreviewConfig,
  FrontMatterKey,
  BackMatterKey,
  SceneBreakStyle,
} from './bookPreview/types'
import type {
  ManuscriptProject,
  ManuscriptSection,
  ManuscriptItem,
} from '@shared/Manuscript'

import essayCollection from './__fixtures__/book-preview/essay-collection.json'
import traditionalSectioned from './__fixtures__/book-preview/traditional-sectioned.json'
import singleLongForm from './__fixtures__/book-preview/single-long-form.json'

/**
 * JSON imports widen literal-union fields (purpose, itemType, form, etc.)
 * to plain `string`, which isn't assignable to ManuscriptSection /
 * ManuscriptItem / ManuscriptProject. The runtime values are vetted
 * fixtures whose unions are correct, so the cast is sound. We name the
 * type explicitly here rather than `typeof essayCollection` so vue-tsc
 * sees the strict shape the modal's props require.
 */
interface Fixture {
  manuscript: ManuscriptProject
  sections: ManuscriptSection[]
  items: ManuscriptItem[]
  bodies: Record<string, string>
}
const FIXTURES: { name: string; data: Fixture }[] = [
  { name: 'essay-collection', data: essayCollection as unknown as Fixture },
  { name: 'traditional-sectioned', data: traditionalSectioned as unknown as Fixture },
  { name: 'single-long-form', data: singleLongForm as unknown as Fixture },
]

/**
 * Permutation matrix. Four shapes per fixture exercise the configuration
 * axes the plan calls out: chaptersFromItems × sceneBreak × TOC on/off ×
 * frontMatter combos.
 */
type Permutation = {
  id: string
  description: string
  apply: (cfg: PreviewConfig) => void
}

const PERMUTATIONS: Permutation[] = [
  {
    id: 'P1-defaults',
    description: 'chaptersFromItems=true, asterisk scene breaks, minimal matter',
    apply: cfg => {
      cfg.chapters.chaptersFromItems = true
      cfg.sceneBreaks = { style: 'centered_asterisks', symbol: '* * *' }
      cfg.frontMatter = ['half_title', 'title_page', 'copyright_page', 'dedication']
      cfg.backMatter = ['acknowledgements', 'author_bio']
    },
  },
  {
    id: 'P2-sections-as-chapters',
    description: 'chaptersFromItems=false, asterisk scene breaks, minimal matter',
    apply: cfg => {
      cfg.chapters.chaptersFromItems = false
      cfg.sceneBreaks = { style: 'centered_asterisks', symbol: '* * *' }
      cfg.frontMatter = ['title_page']
      cfg.backMatter = []
    },
  },
  {
    id: 'P3-toc-blank-breaks',
    description: 'chaptersFromItems=true, blank-line scene breaks, TOC on',
    apply: cfg => {
      cfg.chapters.chaptersFromItems = true
      cfg.sceneBreaks = { style: 'blank_line', symbol: '' }
      cfg.frontMatter = ['half_title', 'title_page', 'contents']
      cfg.backMatter = []
    },
  },
  {
    id: 'P4-full-matter-symbol-breaks',
    description: 'chaptersFromItems=true, custom symbol scene breaks, full front+back matter',
    apply: cfg => {
      cfg.chapters.chaptersFromItems = true
      cfg.sceneBreaks = { style: 'centered_symbol', symbol: '◆ ◆ ◆' } as { style: SceneBreakStyle; symbol: string }
      cfg.frontMatter = [
        'half_title',
        'also_by_author',
        'title_page',
        'copyright_page',
        'dedication',
        'epigraph',
        'contents',
      ] as FrontMatterKey[]
      cfg.backMatter = [
        'acknowledgements',
        'author_note',
        'discussion_questions',
        'also_by_author',
        'preview_chapter',
        'author_bio',
      ] as BackMatterKey[]
      cfg.matterContent = {
        alsoByFront: 'A Quieter Year\nThe Long Hall',
        dedication: 'For E., who waited.',
        epigraph: 'We shape our dwellings,\nand afterwards our dwellings shape us.',
        epigraphAttribution: 'Winston Churchill',
        acknowledgements: 'Thanks to everyone who read these in draft.\n\nAnd to the early-morning cafés that let me linger.',
        authorNote: 'A note on what these are.',
        discussionQuestions: 'What does attention cost?\nWhere does it accrue?',
        alsoByBack: 'A Quieter Year\nThe Long Hall',
        previewChapter: 'A teaser will go here.',
        authorBio: 'The author lives nowhere in particular and is grateful for that.',
      }
      cfg.cover.authorName = 'A. Reader'
    },
  },
]

beforeAll(() => {
  // bookFlowHtml's copyright page renders `new Date().getFullYear()`; freeze
  // it so snapshots stay stable across calendar years.
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2025-06-01T00:00:00.000Z'))
})

afterAll(() => {
  vi.useRealTimers()
})

/**
 * Build a fresh wrapper for a fixture, inject canned essay bodies into the
 * component's bodyById ref so renderedHtmlById fills in, and return the
 * setup-state handle the test will manipulate.
 */
async function mountWithFixture(fix: Fixture) {
  // Mount with open=false first. The component's `watch(() => props.open,
  // ..., { immediate: true })` runs synchronously during setup, and its
  // `if (isOpen)` branch references state (currentSpreadIndex) that is
  // declared later in the script. In production the modal is always
  // mounted closed first and then opened, which is the path we mirror here.
  const wrapper = mount(BookPreviewModal, {
    props: {
      open: false,
      manuscript: fix.manuscript,
      sections: fix.sections,
      items: fix.items,
    },
    attachTo: document.body,
  })

  await wrapper.setProps({ open: true })

  // Wait for the watch on `props.open` to run refreshDrafts (mocked to
  // resolve empty) and selectedItemIds to populate.
  await flushPromises()
  await nextTick()

  const setup = (wrapper.vm as unknown as { $: { setupState: Record<string, unknown> } }).$.setupState

  // setupState is a proxyRefs proxy — refs are auto-unwrapped on read,
  // so `setup.bodyById` is the live Map, `setup.config` is the
  // PreviewConfig, `setup.bookFlowHtml` is the current string, etc.
  // Mutate collections in place to trigger reactivity; Vue 3 tracks
  // Map.set / Map.delete out of the box.
  const bodyById = setup.bodyById as Map<string, string>
  for (const [id, body] of Object.entries(fix.bodies)) bodyById.set(id, body)

  await flushPromises()
  await nextTick()

  return { wrapper, setup }
}

describe('BookPreviewModal — depth-1 regression snapshots (Phase 1 baseline)', () => {
  for (const { name, data } of FIXTURES) {
    describe(`fixture: ${name}`, () => {
      for (const perm of PERMUTATIONS) {
        it(`${perm.id} — ${perm.description}`, async () => {
          const { wrapper, setup } = await mountWithFixture(data)

          const config = setup.config as PreviewConfig
          perm.apply(config)

          // Pin the deterministic-but-randomly-generated config id so the
          // snapshot stays stable. (bookFlowHtml does not reference id,
          // but pin it anyway in case downstream code starts to.)
          config.id = `cfg-${name}-${perm.id}`

          await nextTick()

          const bookFlowHtml = setup.bookFlowHtml as string
          expect(bookFlowHtml).toMatchSnapshot('bookFlowHtml')

          const printHtml = buildNaturalPrintHtml({
            cfg: config,
            bookFlowHtml,
            // Use empty cover bodies so the snapshot focuses on the print
            // shell + book flow, not cover artwork (covers are a separate
            // concern and rendered by buildPrintCoverHtml in production).
            frontCoverHtml: '',
            backCoverHtml: '',
            bookTitle: data.manuscript.title,
            authorName: config.cover.authorName || '',
            documentTitle: `${data.manuscript.title} — A5`,
            layout: 'a5_single',
          })
          expect(printHtml).toMatchSnapshot('printHtml')

          wrapper.unmount()
        })
      }
    })
  }
})
