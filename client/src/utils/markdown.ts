import { marked } from 'marked'

/**
 * True when the body is a complete standalone HTML document (an SPA pasted
 * by the author, e.g. with `<!DOCTYPE html>` or starting with `<html>`).
 *
 * When true, the reader and editor must skip the markdown pipeline entirely
 * and render the body in a sandboxed iframe instead. The markdown renderer
 * would mangle the document, the paragraph splitter would chop `<script>`
 * tags across paragraphs, and the typography scanner would emit nonsense
 * suggestions on HTML attributes.
 */
export function isStandaloneHtmlDoc(s: string | undefined | null): boolean {
  if (!s) return false
  const head = s.trimStart().slice(0, 200).toLowerCase()
  return head.startsWith('<!doctype html') || head.startsWith('<html')
}

/**
 * Render markdown to HTML
 */
export function renderMarkdown(markdown: string): string {
  const result = marked(markdown, {
    breaks: true,
    gfm: true
  })
  return typeof result === 'string' ? result : String(result)
}

/**
 * Extract plain text from markdown
 */
export function markdownToText(markdown: string): string {
  return markdown
    .replace(/#{1,6}\s+/g, '') // Remove headers
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1') // Remove italic
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove links
    .replace(/`([^`]+)`/g, '$1') // Remove inline code
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .trim()
}

/** Target plain-text length for the reading-page excerpt; actual cut is at the next sentence end. */
export const READING_EXCERPT_PLAIN_LENGTH = 200

/**
 * Sentence-ending punctuation in plain text (after {@link markdownToText}), then optional closers,
 * before whitespace or end of string. Matches `...`, Unicode ellipsis, `.`, `?`, `!`.
 */
const SENTENCE_END_IN_PLAIN = /(?:\.\.\.|…|[.!?])(?:["'""'')\]]*)(?=\s|$)/g

function collectSentenceEndIndices(plain: string): number[] {
  const ends: number[] = []
  let m: RegExpExecArray | null
  const re = new RegExp(SENTENCE_END_IN_PLAIN.source, 'g')
  while ((m = re.exec(plain)) !== null) {
    ends.push(m.index + m[0].length)
  }
  return ends
}

/**
 * Exclusive end index in `fullPlain` for the reading excerpt: prefers not to split mid-sentence.
 * Uses {@link READING_EXCERPT_PLAIN_LENGTH} as a soft target (prefers the last sentence end at or
 * before that point; otherwise the first sentence end after it). Falls back to paragraph or
 * newline boundaries, then to the character hint (may split mid-sentence) when no boundary exists.
 */
export function excerptPlainCutLength(fullPlain: string, hint: number = READING_EXCERPT_PLAIN_LENGTH): number {
  if (fullPlain.length <= hint) return fullPlain.length

  const ends = collectSentenceEndIndices(fullPlain)
  if (ends.length > 0) {
    let lastBefore = -1
    for (const e of ends) {
      if (e <= hint) lastBefore = e
    }
    let firstAfter = -1
    for (const e of ends) {
      if (e > hint) {
        firstAfter = e
        break
      }
    }
    if (lastBefore !== -1 && firstAfter !== -1) {
      const dBack = hint - lastBefore
      const dFwd = firstAfter - hint
      return dFwd < dBack ? firstAfter : lastBefore
    }
    if (lastBefore !== -1) return lastBefore
    if (firstAfter !== -1) return firstAfter
    return ends[ends.length - 1]!
  }

  const paraAfter = fullPlain.indexOf('\n\n', hint)
  if (paraAfter !== -1) return paraAfter + 2

  const paraBefore = fullPlain.lastIndexOf('\n\n', hint)
  if (paraBefore > 0) return paraBefore + 2

  const nlAfter = fullPlain.indexOf('\n', hint)
  if (nlAfter !== -1) return nlAfter + 1

  const nlBefore = fullPlain.lastIndexOf('\n', hint)
  if (nlBefore > 0) return nlBefore + 1

  // No sentence or line break: fall back to the soft character target (may split mid-sentence).
  return hint
}

/**
 * Plain-text exclusive end index for the excerpt derived from markdown (sentence-safe).
 */
export function readingExcerptPlainCutLength(markdown: string): number {
  return excerptPlainCutLength(markdownToText(markdown))
}

/**
 * Returns the markdown that follows the excerpt plain-text prefix (same rules as {@link markdownToText}),
 * so the essay body does not repeat the italic excerpt. If `excerptPlainLength` is omitted, the cut
 * follows {@link excerptPlainCutLength} (sentence boundaries).
 */
export function bodyMarkdownAfterExcerptPrefix(markdown: string, excerptPlainLength?: number): string {
  if (!markdown.trim()) return ''
  const fullPlain = markdownToText(markdown)
  const cut = excerptPlainLength ?? excerptPlainCutLength(fullPlain)
  if (fullPlain.length <= cut) return ''
  const target = fullPlain.substring(0, cut)

  for (let i = 0; i <= markdown.length; i++) {
    const p = markdownToText(markdown.slice(0, i))
    if (p === target) {
      return markdown.slice(i).trimStart()
    }
  }

  for (let i = 0; i <= markdown.length; i++) {
    const p = markdownToText(markdown.slice(0, i))
    if (p.length >= cut && p.substring(0, cut) === target) {
      return markdown.slice(i).trimStart()
    }
  }

  return ''
}

/**
 * Strip Markdown syntax to get plain text for word counting.
 * Excludes headings, links, images, code fences, and other syntax tokens
 * so the count matches the visible text a reader would see.
 * (P3-uix-07 / cni-07)
 */
export function stripMarkdownForWordCount(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, '') // Fenced code blocks (before inline code)
    .replace(/#{1,6}\s+/g, '') // Headers
    .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
    .replace(/\*(.*?)\*/g, '$1') // Italic
    .replace(/_(.*?)_/g, '$1') // Italic (underscore)
    .replace(/__([^_]+)__/g, '$1') // Bold (underscore)
    .replace(/!\[([^\]]*)\]\([^\)]+\)/g, '$1') // Images ![alt](url) — before links
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Links [text](url)
    .replace(/`([^`]+)`/g, '$1') // Inline code
    .replace(/^>\s*/gm, '') // Blockquote prefix
    .replace(/^[-*+]\s+/gm, '') // Unordered list prefix
    .replace(/^\d+\.\s+/gm, '') // Ordered list prefix
    .replace(/^#{1,6}\s+/gm, '') // Headers at line start (alternate)
    .replace(/^---+$|^\*\*\*+$/gm, '') // Horizontal rules
    .replace(/\|/g, ' ') // Table cell separators (keep cell content)
    .trim()
}

/**
 * Count words in Markdown content, excluding syntax tokens.
 * Splits on whitespace after stripping Markdown.
 * (P3-uix-07 / cni-07)
 */
export function countWordsInMarkdown(markdown: string): number {
  if (!markdown || !markdown.trim()) return 0
  const plain = stripMarkdownForWordCount(markdown)
  const words = plain.split(/\s+/).filter(Boolean)
  return words.length
}
