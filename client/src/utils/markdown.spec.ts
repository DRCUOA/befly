/**
 * Tests for markdown utilities, including word count (P3-uix-07 / cni-07)
 */
import { describe, it, expect } from 'vitest'
import { stripMarkdownForWordCount, countWordsInMarkdown } from './markdown'

describe('stripMarkdownForWordCount', () => {
  it('strips headers and keeps content', () => {
    expect(stripMarkdownForWordCount('# Hello world')).toBe('Hello world')
    expect(stripMarkdownForWordCount('## Two words here')).toBe('Two words here')
  })

  it('strips bold and italic', () => {
    expect(stripMarkdownForWordCount('**bold** and *italic*')).toBe('bold and italic')
  })

  it('strips links and keeps link text', () => {
    expect(stripMarkdownForWordCount('[click here](https://example.com)')).toBe('click here')
  })

  it('strips images and keeps alt text', () => {
    expect(stripMarkdownForWordCount('![alt text](image.png)')).toBe('alt text')
  })

  it('strips inline code', () => {
    expect(stripMarkdownForWordCount('Use `code` here')).toBe('Use code here')
  })

  it('strips fenced code blocks', () => {
    const md = 'Before\n```\ncode block\n```\nAfter'
    expect(stripMarkdownForWordCount(md)).toBe('Before\n\nAfter')
  })

  it('strips blockquote prefix', () => {
    expect(stripMarkdownForWordCount('> quoted text')).toBe('quoted text')
  })

  it('strips list prefixes', () => {
    expect(stripMarkdownForWordCount('- list item')).toBe('list item')
    expect(stripMarkdownForWordCount('1. first item')).toBe('first item')
  })
})

describe('countWordsInMarkdown', () => {
  it('returns 0 for empty string', () => {
    expect(countWordsInMarkdown('')).toBe(0)
    expect(countWordsInMarkdown('   ')).toBe(0)
  })

  it('counts plain text words', () => {
    expect(countWordsInMarkdown('one two three')).toBe(3)
    expect(countWordsInMarkdown('single')).toBe(1)
  })

  it('excludes markdown syntax from count', () => {
    // "Hello world" = 2 words, not counting # or link URL
    expect(countWordsInMarkdown('# Hello world')).toBe(2)
    expect(countWordsInMarkdown('[Hello world](https://url.com)')).toBe(2)
  })

  it('counts visible text only for links and images', () => {
    expect(countWordsInMarkdown('[link text](url)')).toBe(2)
    expect(countWordsInMarkdown('![image alt](path)')).toBe(2)
  })

  it('handles mixed markdown', () => {
    const md = '# Title\n\nSome **bold** and *italic* with [a link](x.com).'
    expect(countWordsInMarkdown(md)).toBe(8) // Title Some bold and italic with a link
  })
})
