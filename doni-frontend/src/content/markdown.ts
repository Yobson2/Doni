/**
 * A deliberately small Markdown reader for Doni's own content (guides, legal
 * pages): front matter, headings, paragraphs, lists, block quotes and inline
 * bold, italics, code and links. It yields a tree rendered as React elements,
 * never as HTML, and adds no dependency to the bundle.
 */

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'em'; children: Inline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: Inline[] }

export type Block =
  | { type: 'heading'; level: 2 | 3 | 4; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'quote'; children: Inline[] }

export interface MarkdownDocument {
  /** Front matter fields, as strings. */
  meta: Record<string, string>
  blocks: Block[]
}

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

function parseFrontMatter(source: string) {
  const match = FRONT_MATTER.exec(source)
  if (!match) return { meta: {}, body: source }
  const meta: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const field = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line)
    if (field) meta[field[1]] = field[2].trim().replace(/^(['"])(.*)\1$/, '$2')
  }
  return { meta, body: source.slice(match[0].length) }
}

// Order matters: code first (its content is literal), then links, then bold
// before italics so that "**" is not read as two "*".
const INLINE = /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|\*(.+?)\*/

export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  let rest = text
  while (rest) {
    const match = INLINE.exec(rest)
    if (!match) {
      out.push({ type: 'text', text: rest })
      break
    }
    if (match.index > 0) {
      out.push({ type: 'text', text: rest.slice(0, match.index) })
    }
    const [whole, code, label, href, strong, em] = match
    if (code !== undefined) out.push({ type: 'code', text: code })
    else if (label !== undefined)
      out.push({ type: 'link', href, children: parseInline(label) })
    else if (strong !== undefined)
      out.push({ type: 'strong', children: parseInline(strong) })
    else out.push({ type: 'em', children: parseInline(em) })
    rest = rest.slice(match.index + whole.length)
  }
  return out
}

const HEADING = /^(#{2,4})\s+(.*)$/
const BULLET = /^[-*]\s+(.*)$/
const NUMBERED = /^\d+[.)]\s+(.*)$/
const QUOTE = /^>\s?(.*)$/

function parseBlocks(body: string): Block[] {
  const blocks: Block[] = []
  const lines = body.split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) {
      i++
      continue
    }
    const heading = HEADING.exec(line)
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1].length as 2 | 3 | 4,
        children: parseInline(heading[2]),
      })
      i++
      continue
    }
    const ordered = NUMBERED.test(line)
    if (ordered || BULLET.test(line)) {
      const pattern = ordered ? NUMBERED : BULLET
      const items: string[] = []
      while (i < lines.length && lines[i].trim()) {
        const current = lines[i].trim()
        const item = pattern.exec(current)
        if (item) items.push(item[1])
        else items[items.length - 1] += ` ${current}` // continuation line
        i++
      }
      blocks.push({ type: 'list', ordered, items: items.map(parseInline) })
      continue
    }
    if (QUOTE.test(line)) {
      const parts: string[] = []
      while (i < lines.length && QUOTE.test(lines[i].trim())) {
        parts.push(QUOTE.exec(lines[i].trim())![1])
        i++
      }
      blocks.push({ type: 'quote', children: parseInline(parts.join(' ')) })
      continue
    }
    const parts: string[] = []
    while (i < lines.length) {
      const current = lines[i].trim()
      if (
        !current ||
        HEADING.test(current) ||
        BULLET.test(current) ||
        NUMBERED.test(current) ||
        QUOTE.test(current)
      )
        break
      parts.push(current)
      i++
    }
    blocks.push({ type: 'paragraph', children: parseInline(parts.join(' ')) })
  }
  return blocks
}

export function parseMarkdown(source: string): MarkdownDocument {
  const { meta, body } = parseFrontMatter(source)
  return { meta, blocks: parseBlocks(body) }
}
