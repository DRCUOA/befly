import { marked } from 'marked'

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
