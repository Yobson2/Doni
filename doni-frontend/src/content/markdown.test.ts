import { describe, expect, it } from 'vitest'
import { parseInline, parseMarkdown } from './markdown'

describe('parseMarkdown', () => {
  it('reads front matter fields as strings', () => {
    const { meta } = parseMarkdown(
      '---\ntitle: Qu\'est-ce que la BRVM ?\nupdated: 2026-11-24\nquoted: "a: b"\n---\nBody'
    )
    expect(meta).toEqual({
      title: "Qu'est-ce que la BRVM ?",
      updated: '2026-11-24',
      quoted: 'a: b',
    })
  })

  it('reads headings, paragraphs, lists and quotes', () => {
    const { blocks } = parseMarkdown(
      [
        '## Title',
        '',
        'One line',
        'continued.',
        '',
        '- first',
        '- second',
        '  wrapped',
        '',
        '1. step',
        '2. next',
        '',
        '> note',
      ].join('\n')
    )
    expect(blocks).toEqual([
      {
        type: 'heading',
        level: 2,
        children: [{ type: 'text', text: 'Title' }],
      },
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'One line continued.' }],
      },
      {
        type: 'list',
        ordered: false,
        items: [
          [{ type: 'text', text: 'first' }],
          [{ type: 'text', text: 'second wrapped' }],
        ],
      },
      {
        type: 'list',
        ordered: true,
        items: [
          [{ type: 'text', text: 'step' }],
          [{ type: 'text', text: 'next' }],
        ],
      },
      { type: 'quote', children: [{ type: 'text', text: 'note' }] },
    ])
  })
})

describe('parseInline', () => {
  it('reads bold, italics, code and links', () => {
    expect(
      parseInline('A **bold** and *em* `x*y` [the **SGI**](/sgi).')
    ).toEqual([
      { type: 'text', text: 'A ' },
      { type: 'strong', children: [{ type: 'text', text: 'bold' }] },
      { type: 'text', text: ' and ' },
      { type: 'em', children: [{ type: 'text', text: 'em' }] },
      { type: 'text', text: ' ' },
      { type: 'code', text: 'x*y' },
      { type: 'text', text: ' ' },
      {
        type: 'link',
        href: '/sgi',
        children: [
          { type: 'text', text: 'the ' },
          { type: 'strong', children: [{ type: 'text', text: 'SGI' }] },
        ],
      },
      { type: 'text', text: '.' },
    ])
  })
})
