import type { ManuscriptSection, ManuscriptItem } from '@shared/Manuscript'
import { isStandaloneHtmlDoc } from './markdown'

/**
 * One entry in the immersive reader's flow.
 *
 * - `section`  — a part/section divider (title only, rendered as a break)
 * - `chapter`  — a full prose chapter (frag body)
 * - `bridge`   — short connective tissue rendered as a centred interstitial
 */
export interface ReaderChapter {
  id: string
  kind: 'section' | 'chapter' | 'bridge'
  title: string
  markdown: string
}

/**
 * Flatten a manuscript spine into the immersive reader's chapter list,
 * mirroring the Book Room's reading order: sections by orderIndex, each
 * section's items by orderIndex, then unassigned items.
 *
 * Working artefacts (notes, fragments) and unwritten placeholders are the
 * writer's scaffolding, not the reader's text, so they are skipped. Frags
 * whose body is a standalone HTML document (interactive SPAs) can't be read
 * as prose and get an explanatory stub instead. Section dividers are only
 * emitted when the section actually contributed something readable.
 */
export function buildManuscriptChapters(
  sortedSections: ManuscriptSection[],
  itemsBySection: Map<string, ManuscriptItem[]>,
  unassignedItems: ManuscriptItem[],
  bodyByWritingBlockId: Map<string, string>,
): ReaderChapter[] {
  const out: ReaderChapter[] = []

  const pushItems = (items: ManuscriptItem[]) => {
    let pushed = 0
    for (const item of items) {
      const chapter = itemToChapter(item, bodyByWritingBlockId)
      if (chapter) {
        out.push(chapter)
        pushed++
      }
    }
    return pushed
  }

  for (const section of sortedSections) {
    const items = itemsBySection.get(section.id) ?? []
    const dividerAt = out.length
    if (pushItems(items) > 0) {
      out.splice(dividerAt, 0, {
        id: `section-${section.id}`,
        kind: 'section',
        title: section.title,
        markdown: '',
      })
    }
  }

  pushItems(unassignedItems)
  return out
}

function itemToChapter(
  item: ManuscriptItem,
  bodyByWritingBlockId: Map<string, string>,
): ReaderChapter | null {
  if (item.itemType === 'essay' && item.writingBlockId) {
    const body = bodyByWritingBlockId.get(item.writingBlockId) ?? ''
    return {
      id: `item-${item.id}`,
      kind: 'chapter',
      title: item.title,
      markdown: isStandaloneHtmlDoc(body)
        ? '*This is an interactive frag — open it from the library to experience it.*'
        : body || '*(Body unavailable.)*',
    }
  }
  if (item.itemType === 'bridge') {
    const text = (item.summary ?? '').trim() || item.title
    if (!text) return null
    return { id: `item-${item.id}`, kind: 'bridge', title: item.title, markdown: text }
  }
  return null
}
