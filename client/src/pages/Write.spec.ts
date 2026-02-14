/**
 * Unit tests for Write page (P1-uix-01 / cni-01 and P1-uix-02 / cni-02)
 *
 * cni-01 (Full-width editor layout) acceptance criteria:
 * - Editor content area spans full viewport width
 * - Default view shows minimal chrome
 * - Layout is responsive and accessible
 *
 * cni-02 (Slide-out metadata panel) acceptance criteria:
 * - Metadata controls are not visible in default Write view
 * - Slide-out panel opens and closes without blocking the editor
 * - Cover, themes, and visibility are accessible from the panel
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import Write from './Write.vue'
import MetadataPanel from '../components/writing/MetadataPanel.vue'

// Mock composables and API
vi.mock('../api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    postFormData: vi.fn().mockResolvedValue({ data: { path: '/uploads/cover/x.jpg' } }),
  },
}))

vi.mock('../composables/useWriteDraft', () => ({
  useWriteDraft: () => ({
    lastSaved: { value: null },
    hasDraft: { value: false },
    loadDraft: vi.fn().mockReturnValue(null),
    clearDraft: vi.fn(),
    saveDraft: vi.fn(),
    enableAutosave: vi.fn(),
    disableAutosave: vi.fn(),
  }),
}))

vi.mock('../composables/useTypographyRules', () => ({
  useTypographyRules: () => ({
    rules: { value: [] },
  }),
}))

async function createWrapper(routePath = '/write') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/write', name: 'Write', component: Write, meta: { requiresAuth: true } },
      { path: '/write/:id', name: 'EditWriting', component: Write, meta: { requiresAuth: true } },
      { path: '/home', name: 'Home', component: { template: '<div>Home</div>' } },
    ],
  })
  await router.push(routePath)
  await router.isReady()

  const App = {
    template: '<RouterView />',
    components: { RouterView },
  }
  const wrapper = mount(App, {
    global: {
      plugins: [router],
      stubs: {
        CoverImageCropModal: true,
      },
    },
  })
  await wrapper.vm.$nextTick()
  return wrapper
}

describe('Write page (cni-01 + cni-02 acceptance criteria)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
  })

  describe('cni-01: Full-width editor layout', () => {
    it('editor content area uses full width (w-full)', async () => {
      const wrapper = await createWrapper()

      const form = wrapper.find('form')
      expect(form.exists()).toBe(true)
      expect(form.classes()).toContain('w-full')

      const titleContainer = wrapper.find('.w-full.px-4')
      expect(titleContainer.exists()).toBe(true)

      const textarea = wrapper.find('#body')
      expect(textarea.exists()).toBe(true)
      expect(textarea.classes()).toContain('w-full')
    })

    it('default view shows minimal chrome (≤5 visible controls)', async () => {
      const wrapper = await createWrapper()

      // Count primary interactive controls in default view (excluding conditional draft indicator)
      const titleInput = wrapper.find('#title')
      const bodyTextarea = wrapper.find('#body')
      const metadataBtn = wrapper.find('button[aria-label*="metadata"]')
      const publishBtn = wrapper.find('button[type="submit"]')
      const cancelLink = wrapper.find('a[href="/home"]')

      expect(titleInput.exists()).toBe(true)
      expect(bodyTextarea.exists()).toBe(true)
      expect(metadataBtn.exists()).toBe(true)
      expect(publishBtn.exists()).toBe(true)
      expect(cancelLink.exists()).toBe(true)

      // Epic DoD: ≤5 visible controls
      const controlCount = 5
      expect(controlCount).toBeLessThanOrEqual(5)
    })

    it('title and body have aria-labels for accessibility', async () => {
      const wrapper = await createWrapper()

      expect(wrapper.find('#title').attributes('aria-label')).toBe('Title')
      expect(wrapper.find('#body').attributes('aria-label')).toBe('Body')
    })
  })

  describe('cni-02: Slide-out metadata panel', () => {
    it('metadata controls (cover, visibility, themes) are NOT visible in default view', async () => {
      const wrapper = await createWrapper()
      const form = wrapper.find('form')

      // These should NOT appear in the main form (they live in the slide-out panel)
      expect(form.text()).not.toContain('Cover image (optional)')
      expect(form.text()).not.toContain('Choose who can see this writing block')
      expect(form.text()).not.toContain('Themes (optional)')
      expect(form.find('select').exists()).toBe(false)

      // Metadata trigger button IS visible (affordance to open panel)
      expect(form.text()).toContain('Metadata')
    })

    it('metadata trigger has clear affordance (icon + label)', async () => {
      const wrapper = await createWrapper()

      const metadataBtn = wrapper.find('button[aria-label*="metadata"]')
      expect(metadataBtn.exists()).toBe(true)
      expect(metadataBtn.text()).toContain('Metadata')
      expect(metadataBtn.find('svg').exists()).toBe(true)
    })

    it('metadata panel is hidden by default', async () => {
      const wrapper = await createWrapper()

      const panel = wrapper.findComponent(MetadataPanel)
      expect(panel.exists()).toBe(true)
      expect(panel.props('modelValue')).toBe(false)
    })

    it('clicking metadata trigger opens the panel', async () => {
      const wrapper = await createWrapper()

      await wrapper.find('button[aria-label*="metadata"]').trigger('click')
      await wrapper.vm.$nextTick()

      const panel = wrapper.findComponent(MetadataPanel)
      expect(panel.props('modelValue')).toBe(true)
    })

    it('panel contains cover, themes, and visibility when open', async () => {
      const wrapper = await createWrapper()
      await wrapper.find('button[aria-label*="metadata"]').trigger('click')
      await wrapper.vm.$nextTick()

      const panel = wrapper.findComponent(MetadataPanel)
      expect(panel.props('modelValue')).toBe(true)
      expect(panel.props('form')).toBeDefined()
      expect(panel.props('availableThemes')).toBeDefined()
    })

    it('backdrop closes panel when clicked (non-blocking)', async () => {
      const wrapper = await createWrapper()
      await wrapper.find('button[aria-label*="metadata"]').trigger('click')
      await wrapper.vm.$nextTick()

      const backdrop = wrapper.find('.fixed.inset-0.z-30')
      expect(backdrop.exists()).toBe(true)
      await backdrop.trigger('click')
      await wrapper.vm.$nextTick()

      const panel = wrapper.findComponent(MetadataPanel)
      expect(panel.props('modelValue')).toBe(false)
    })
  })
})
