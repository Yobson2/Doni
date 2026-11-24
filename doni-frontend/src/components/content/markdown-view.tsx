import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import type { Block, Inline } from '@/content/markdown'

const linkClass = 'text-primary font-medium underline underline-offset-4'

function renderInline(nodes: Inline[]): ReactNode[] {
  return nodes.map((node, i) => {
    switch (node.type) {
      case 'text':
        return node.text
      case 'strong':
        return <strong key={i}>{renderInline(node.children)}</strong>
      case 'em':
        return <em key={i}>{renderInline(node.children)}</em>
      case 'code':
        return (
          <code key={i} className='bg-muted rounded px-1 text-sm'>
            {node.text}
          </code>
        )
      case 'link':
        // In-app links stay in the app (and work offline); others open the site.
        return node.href.startsWith('/') ? (
          <Link key={i} to={node.href as never} className={linkClass}>
            {renderInline(node.children)}
          </Link>
        ) : (
          <a
            key={i}
            href={node.href}
            className={linkClass}
            target='_blank'
            rel='noopener noreferrer'
          >
            {renderInline(node.children)}
          </a>
        )
    }
  })
}

const LIST_TAG = { ordered: 'ol', bullet: 'ul' } as const

const headingClass = {
  2: 'font-manrope mt-10 text-xl font-bold tracking-tight',
  3: 'mt-8 text-lg font-semibold',
  4: 'mt-6 font-semibold',
} as const

/** Renders Doni's own Markdown content (see `@/content/markdown`). */
export function MarkdownView({ blocks }: { blocks: Block[] }) {
  return (
    <div className='text-text-secondary leading-relaxed'>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'heading': {
            const Tag = `h${block.level}` as const
            return (
              <Tag
                key={i}
                className={`text-foreground ${headingClass[block.level]}`}
              >
                {renderInline(block.children)}
              </Tag>
            )
          }
          case 'paragraph':
            return (
              <p key={i} className='mt-4'>
                {renderInline(block.children)}
              </p>
            )
          case 'list': {
            const Tag = block.ordered ? LIST_TAG.ordered : LIST_TAG.bullet
            return (
              <Tag
                key={i}
                className={`mt-4 flex flex-col gap-2 pl-6 ${block.ordered ? 'list-decimal' : 'list-disc'}`}
              >
                {block.items.map((item, j) => (
                  <li key={j}>{renderInline(item)}</li>
                ))}
              </Tag>
            )
          }
          case 'quote':
            return (
              <blockquote
                key={i}
                className='border-warning bg-warning-subtle text-foreground mt-6 rounded-md border-l-4 px-4 py-3'
              >
                {renderInline(block.children)}
              </blockquote>
            )
        }
      })}
    </div>
  )
}
