/**
 * Unit tests for MetadataPanel (P1-uix-02 / cni-02)
 *
 * Acceptance criteria from cni-02-slide-out-metadata-panel.json:
 * - Cover, themes, and visibility are accessible from the panel
 * - Panel interaction is accessible (keyboard, screen reader)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MetadataPanel from './MetadataPanel.vue'

const baseForm = {
  coverImageUrl: '',
  coverImagePosition: '50% 50%',
  visibility: 'private' as const,
  themeIds: [] as string[],
}

describe('MetadataPanel (cni-02 acceptance criteria)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exposes cover, themes, and visibility controls when open', async () => {
    const wrapper = mount(MetadataPanel, {
      props: {
        modelValue: true,
        form: { ...baseForm },
        availableThemes: [{ id: 't1', name: 'Theme A', slug: 'theme-a', userId: 'u1', visibility: 'private', createdAt: '' }],
        loadingThemes: false,
        loadingWriting: false,
      },
    })

    expect(wrapper.text()).toContain('Cover image (optional)')
    expect(wrapper.text()).toContain('Upload image')
    expect(wrapper.text()).toContain('Visibility')
    expect(wrapper.text()).toContain('Themes (optional)')
    expect(wrapper.text()).toContain('Theme A')
    expect(wrapper.find('select').exists()).toBe(true)
    expect(wrapper.find('select').element.innerHTML).toContain('Private')
    expect(wrapper.find('select').element.innerHTML).toContain('Shared')
    expect(wrapper.find('select').element.innerHTML).toContain('Public')
  })

  it('has role="dialog" and aria-label for screen reader accessibility', () => {
    const wrapper = mount(MetadataPanel, {
      props: {
        modelValue: true,
        form: { ...baseForm },
        availableThemes: [],
        loadingThemes: false,
        loadingWriting: false,
      },
    })

    const panel = wrapper.find('[role="dialog"]')
    expect(panel.exists()).toBe(true)
    expect(panel.attributes('aria-label')).toBe('Metadata settings')
    expect(panel.attributes('aria-modal')).toBe('true')
  })

  it('has aria-hidden when closed', () => {
    const wrapper = mount(MetadataPanel, {
      props: {
        modelValue: false,
        form: { ...baseForm },
        availableThemes: [],
        loadingThemes: false,
        loadingWriting: false,
      },
    })

    expect(wrapper.find('[role="dialog"]').attributes('aria-hidden')).toBe('true')
  })

  it('has close button with aria-label', () => {
    const wrapper = mount(MetadataPanel, {
      props: {
        modelValue: true,
        form: { ...baseForm },
        availableThemes: [],
        loadingThemes: false,
        loadingWriting: false,
      },
    })

    const closeBtn = wrapper.find('button[aria-label="Close metadata panel"]')
    expect(closeBtn.exists()).toBe(true)
  })

  it('emits update:modelValue(false) when close button clicked', async () => {
    const wrapper = mount(MetadataPanel, {
      props: {
        modelValue: true,
        form: { ...baseForm },
        availableThemes: [],
        loadingThemes: false,
        loadingWriting: false,
      },
    })

    await wrapper.find('button[aria-label="Close metadata panel"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })

  it('uses duration-150 for transition (<200ms per spec)', () => {
    const wrapper = mount(MetadataPanel, {
      props: {
        modelValue: true,
        form: { ...baseForm },
        availableThemes: [],
        loadingThemes: false,
        loadingWriting: false,
      },
    })

    expect(wrapper.find('[role="dialog"]').classes()).toContain('duration-150')
  })

  it('closes on Escape key (keyboard accessibility)', async () => {
    const wrapper = mount(MetadataPanel, {
      props: {
        modelValue: true,
        form: { ...baseForm },
        availableThemes: [],
        loadingThemes: false,
        loadingWriting: false,
      },
    })

    await wrapper.find('[role="dialog"]').trigger('keydown.escape')
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })

  it('visibility select has aria-label', () => {
    const wrapper = mount(MetadataPanel, {
      props: {
        modelValue: true,
        form: { ...baseForm },
        availableThemes: [],
        loadingThemes: false,
        loadingWriting: false,
      },
    })

    const select = wrapper.find('select[aria-label="Choose who can see this writing block"]')
    expect(select.exists()).toBe(true)
  })
})
