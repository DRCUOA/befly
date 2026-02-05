import { marked } from 'marked'

/**
 * Render markdown to HTML
 */
export function renderMarkdown(markdown: string): string {
  return marked(markdown, {
    breaks: true,
    gfm: true
  })
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
