/**
 * Tests for markdown utilities, including word count (P3-uix-07 / cni-07)
 */
import { describe, it, expect } from 'vitest'
import {
  stripMarkdownForWordCount,
  countWordsInMarkdown,
  markdownToText,
  bodyMarkdownAfterExcerptPrefix,
  excerptPlainCutLength,
  readingExcerptPlainCutLength,
  READING_EXCERPT_PLAIN_LENGTH,
  isStandaloneHtmlDoc
} from './markdown'

describe('isStandaloneHtmlDoc', () => {
  it('detects DOCTYPE-led documents (case-insensitive)', () => {
    expect(isStandaloneHtmlDoc('<!DOCTYPE html><html><body></body></html>')).toBe(true)
    expect(isStandaloneHtmlDoc('<!doctype html>\n<html></html>')).toBe(true)
  })

  it('detects bare <html> openers (with or without attrs)', () => {
    expect(isStandaloneHtmlDoc('<html lang="en"><body></body></html>')).toBe(true)
    expect(isStandaloneHtmlDoc('<HTML>')).toBe(true)
  })

  it('tolerates leading whitespace before the document', () => {
    expect(isStandaloneHtmlDoc('   \n  <!DOCTYPE html><html></html>')).toBe(true)
  })

  it('returns false for prose, markdown and HTML fragments', () => {
    expect(isStandaloneHtmlDoc('# Hello\n\nA paragraph.')).toBe(false)
    expect(isStandaloneHtmlDoc('<p>just a fragment</p>')).toBe(false)
    expect(isStandaloneHtmlDoc('<div><html></html></div>')).toBe(false) // <html> not at start
    expect(isStandaloneHtmlDoc('')).toBe(false)
    expect(isStandaloneHtmlDoc(null)).toBe(false)
    expect(isStandaloneHtmlDoc(undefined)).toBe(false)
  })
})

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

describe('excerptPlainCutLength', () => {
  it('snaps to the nearer sentence boundary when the hint falls mid-sentence', () => {
    const plain =
      'First sentence is short. Second is short. ' + 'word '.repeat(200)
    const hint = 40
    const cut = excerptPlainCutLength(plain, hint)
    expect(cut).toBeGreaterThan(hint)
    expect(plain.substring(0, cut).trimEnd().endsWith('short.')).toBe(true)
  })

  it('uses the last sentence end at or before the hint when it is closer than the next', () => {
    const plain = 'One. Two. Three. ' + 'x'.repeat(300)
    const cut = excerptPlainCutLength(plain, READING_EXCERPT_PLAIN_LENGTH)
    expect(plain.substring(0, cut).trimEnd().endsWith('Three.')).toBe(true)
  })
})

describe('bodyMarkdownAfterExcerptPrefix', () => {
  it('returns empty when plain text fits in excerpt length', () => {
    const md = 'Short piece.'
    expect(bodyMarkdownAfterExcerptPrefix(md)).toBe('')
  })

  it('continues body after excerpt without repeating opening lines', () => {
    const opening = 'A family.\n\nA group.\n\nA circle of friends.\n\n'
    const rest = 'A rabbit warren.\n\nA nest.\n\nA hive.'
    const md = opening + rest
    const fullPlain = markdownToText(md)
    const cut = readingExcerptPlainCutLength(md)
    const excerptPlain = fullPlain.substring(0, cut)
    const bodyPlain = markdownToText(bodyMarkdownAfterExcerptPrefix(md) ?? '')
    expect(fullPlain).toBe(excerptPlain + bodyPlain)
  })

  it('handles markdown syntax before the split', () => {
    const md = '**Hello** ' + 'word '.repeat(120)
    const full = markdownToText(md)
    const cut = excerptPlainCutLength(full)
    const after = bodyMarkdownAfterExcerptPrefix(md)
    expect(full.substring(cut).trimStart()).toBe(markdownToText(after).trimStart())
  })
})
